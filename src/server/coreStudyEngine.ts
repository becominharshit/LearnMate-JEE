import { GoogleGenAI } from '@google/genai';
import { Response } from 'express';
import {
  CBTQuestion,
  CBTMockSummary,
  calculateCBTMockScore,
  QuestionResponseState,
  ExamTrack,
} from '../utils/jeeEngine';
import { redactSensitiveText } from './middleware/authAndSecurity';
import {
  AUTHORITATIVE_KEY_VERSION,
  resolveServerAnswerKey,
} from './data/authoritativeAnswerKeys';

export const ALLOWED_GEMINI_MODELS = {
  fast: 'gemini-3.5-flash-lite',
  lite: 'gemini-3.5-flash-lite',
  thinking: 'gemini-3.8-flash',
  reasoning: 'gemini-3.8-flash',
  analyze: 'gemini-3.8-flash',
  intermediate: 'gemini-3.6-flash',
  image: 'gemini-3-pro-image',
  imageEdit: 'gemini-nano-banana-2.1',
  video: 'gemini-omni-1.2-flash',
  transcribe: 'gemini-3.5-transcribe',
  tts: 'gemini-3.8-flash-tts',
  live: 'gemini-3.8-live',
  musicClip: 'lyria-3-clip-preview',
  musicPro: 'lyria-3-pro-preview',
} as const;

const LEGACY_BLOCKED_RE = /gemini-1\.5|gemini-2\.0|gemini-2\.5|^gemini-pro/i;

export function resolveConfiguredModel(
  envKey: string | undefined,
  defaultModel: string
): string {
  const candidate = (envKey || '').trim();
  if (!candidate || LEGACY_BLOCKED_RE.test(candidate)) {
    return defaultModel;
  }
  return candidate;
}

export function getModelRoutingConfig() {
  const fast = resolveConfiguredModel(process.env.GEMINI_MODEL_FAST, ALLOWED_GEMINI_MODELS.fast);
  const thinking = resolveConfiguredModel(process.env.GEMINI_MODEL_THINKING, ALLOWED_GEMINI_MODELS.thinking);
  const analyze = resolveConfiguredModel(process.env.GEMINI_MODEL_ANALYZE, thinking);
  const lite = resolveConfiguredModel(process.env.GEMINI_MODEL_LITE, fast);
  const reasoning = resolveConfiguredModel(process.env.GEMINI_MODEL_REASONING, thinking);
  return {
    fast,
    lite,
    thinking,
    reasoning,
    analyze,
    image: resolveConfiguredModel(process.env.GEMINI_MODEL_IMAGE, ALLOWED_GEMINI_MODELS.image),
    imageEdit: resolveConfiguredModel(process.env.GEMINI_MODEL_IMAGE_EDIT, ALLOWED_GEMINI_MODELS.imageEdit),
    transcribe: resolveConfiguredModel(process.env.GEMINI_MODEL_TRANSCRIBE, ALLOWED_GEMINI_MODELS.transcribe),
    tts: resolveConfiguredModel(process.env.GEMINI_MODEL_TTS, ALLOWED_GEMINI_MODELS.tts),
    live: resolveConfiguredModel(process.env.GEMINI_MODEL_LIVE, ALLOWED_GEMINI_MODELS.live),
  };
}

export function buildThinkingFallbackChain(primaryModel?: string): string[] {
  const cfg = getModelRoutingConfig();
  const raw = [
    primaryModel || cfg.thinking,
    ALLOWED_GEMINI_MODELS.intermediate,
    cfg.fast,
    ALLOWED_GEMINI_MODELS.fast,
  ];
  return Array.from(new Set(raw.filter(Boolean)));
}

export function getValidatedGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err: any = new Error(
      'GEMINI_API_KEY is not configured on the server. Set GEMINI_API_KEY in your environment variables to enable live AI tutoring and document extraction.'
    );
    err.statusCode = 503;
    err.errorCode = 'MISSING_GEMINI_API_KEY';
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRetryableModelFallbackError(err: any): boolean {
  const msg = String(err?.message || err || '');
  const status = Number(err?.status || err?.statusCode || 0);
  return (
    status === 403 ||
    status === 404 ||
    status === 429 ||
    /\b404\b|\b429\b|permission|quota|not found|unsupported|resource_exhausted|unavailable|paid/i.test(msg)
  );
}

export async function generateWithModelFallback<T>(
  modelsOrPrimary: string | string[],
  fallbackOrInvoke: string | null | ((model: string) => Promise<T>),
  maybeInvoke?: (model: string) => Promise<T>
): Promise<{ result: T; modelUsed: string; fallbackUsed: boolean; attemptedModels: string[] }> {
  const candidateModels = Array.isArray(modelsOrPrimary)
    ? Array.from(new Set(modelsOrPrimary.map((m) => String(m || '').trim()).filter(Boolean)))
    : Array.from(
        new Set(
          [modelsOrPrimary, typeof fallbackOrInvoke === 'string' ? fallbackOrInvoke : null]
            .map((m) => String(m || '').trim())
            .filter(Boolean)
        )
      );

  const invoke: ((model: string) => Promise<T>) | undefined =
    typeof fallbackOrInvoke === 'function' ? fallbackOrInvoke : maybeInvoke;

  if (!invoke || candidateModels.length === 0) {
    throw new Error('generateWithModelFallback requires at least one model and an invoke callback.');
  }

  const attemptedModels: string[] = [];
  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i += 1) {
    const model = candidateModels[i];
    attemptedModels.push(model);
    try {
      const result = await invoke(model);
      return {
        result,
        modelUsed: model,
        fallbackUsed: i > 0,
        attemptedModels,
      };
    } catch (err: any) {
      lastError = err;
      const hasNext = i < candidateModels.length - 1;
      if (!hasNext || !isRetryableModelFallbackError(err)) {
        break;
      }
    }
  }

  const lastMessage = redactSensitiveText(String(lastError?.message || lastError || 'Model invocation failed'));
  const diagnosticErr: any = new Error(
    `All configured Gemini models failed (${attemptedModels.join(' -> ')}): ${lastMessage}`
  );
  diagnosticErr.status = lastError?.status;
  diagnosticErr.statusCode = lastError?.statusCode || (lastError?.status === 429 ? 429 : 503);
  diagnosticErr.errorCode = lastError?.errorCode || (lastError?.status === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_AI_UNAVAILABLE');
  diagnosticErr.attemptedModels = attemptedModels;
  throw diagnosticErr;
}

export function sendStructuredUpstreamError(
  res: Response,
  error: any,
  contextLabel: string,
  requestId?: string
): void {
  const rawMessage = redactSensitiveText(
    error?.message || String(error || 'Upstream Gemini service error')
  );
  const isRateLimit =
    error?.status === 429 ||
    error?.statusCode === 429 ||
    /429|quota|rate limit|resource_exhausted/i.test(rawMessage);
  const statusCode = isRateLimit ? 429 : error?.statusCode || 503;
  const errorCode = isRateLimit
    ? 'UPSTREAM_RATE_LIMITED'
    : error?.errorCode || 'UPSTREAM_AI_UNAVAILABLE';
  const retryAfterSeconds = isRateLimit ? 15 : 5;

  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'upstream_ai_error',
      contextLabel,
      errorCode,
      requestId,
      message: rawMessage.slice(0, 220),
    })
  );
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(statusCode).json({
    errorCode,
    message: isRateLimit
      ? 'The AI Tutor is experiencing high request volume right now. Please wait a few seconds and click Retry.'
      : `AI service temporarily unavailable (${rawMessage.slice(0, 180)}). Please click Retry.`,
    retryAfterSeconds,
    requestId,
  });
}

export interface ServerVerifiedCbtGradeResult {
  summary: CBTMockSummary;
  scaledScoreOutOf300: number;
  verifiedAtIso: string;
  examMode: ExamTrack;
  keyVersion: string;
  questionSolutions: Record<
    string,
    {
      correctIndex: number;
      correctIndices?: number[];
      numericalAnswer?: number;
      explanation: string;
    }
  >;
}

export function gradeCbtAttemptOnServer(params: {
  questions?: CBTQuestion[];
  questionIds?: string[];
  attemptType?: 'official_mock' | 'custom_drill';
  responses: Record<string, QuestionResponseState>;
  examMode?: ExamTrack;
}): ServerVerifiedCbtGradeResult {
  const examMode: ExamTrack = params.examMode || 'JEE Main';
  const attemptType = params.attemptType || 'official_mock';

  const sourceQuestions: CBTQuestion[] =
    params.questions && params.questions.length > 0
      ? params.questions
      : (params.questionIds || []).map((qid, idx) => {
          const entry = resolveServerAnswerKey(qid);
          if (!entry) {
            const err: any = new Error(`Unknown official question ID: ${qid}`);
            err.statusCode = 400;
            err.errorCode = 'UNKNOWN_OFFICIAL_QUESTION_ID';
            throw err;
          }
          return {
            id: entry.id,
            number: entry.number || idx + 1,
            subject: entry.subject,
            section: entry.section || 'Section A',
            chapter: entry.chapter,
            stem: entry.stem,
            options: entry.options,
            examType: entry.examType || examMode,
            examVersion: entry.examVersion,
            advancedFormat: entry.advancedFormat,
            correctIndex: entry.correctIndex,
            correctIndices: entry.correctIndices,
            numericalAnswer: entry.numericalAnswer,
            explanation: entry.explanation,
          };
        });

  const authoritativeQuestions: CBTQuestion[] = sourceQuestions.map((q) => {
    const baseId = attemptType === 'custom_drill' ? q.id.split('__copy_')[0] : q.id;
    const authEntry = resolveServerAnswerKey(q.id) || (baseId !== q.id ? resolveServerAnswerKey(baseId) : undefined);
    if (attemptType === 'official_mock' && !authEntry) {
      const err: any = new Error(
        `Question "${q.id}" is missing from authoritative server answer keys for official_mock grading.`
      );
      err.statusCode = 400;
      err.errorCode = 'UNKNOWN_OFFICIAL_QUESTION_ID';
      throw err;
    }
    if (authEntry) {
      // Security: Server-side key overrides any client-supplied answer key or explanation
      return {
        ...q,
        section: authEntry.section || q.section,
        examType: authEntry.examType || q.examType || examMode,
        examVersion: authEntry.examVersion || q.examVersion,
        advancedFormat: authEntry.advancedFormat || q.advancedFormat,
        correctIndex: authEntry.correctIndex,
        correctIndices: authEntry.correctIndices,
        numericalAnswer: authEntry.numericalAnswer,
        explanation: authEntry.explanation,
      };
    }
    return q.examType ? q : { ...q, examType: examMode };
  });

  const summary = calculateCBTMockScore(authoritativeQuestions, params.responses);
  const scaledScoreOutOf300 = Math.max(
    0,
    Math.min(300, Math.round((summary.totalScore / Math.max(1, summary.maxScore)) * 300))
  );

  const questionSolutions: ServerVerifiedCbtGradeResult['questionSolutions'] = {};
  for (const q of authoritativeQuestions) {
    questionSolutions[q.id] = {
      correctIndex: q.correctIndex,
      ...(q.correctIndices ? { correctIndices: q.correctIndices } : {}),
      ...(typeof q.numericalAnswer === 'number' ? { numericalAnswer: q.numericalAnswer } : {}),
      explanation: q.explanation || '',
    };
  }

  return {
    summary,
    scaledScoreOutOf300,
    verifiedAtIso: new Date().toISOString(),
    examMode,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
    questionSolutions,
  };
}
