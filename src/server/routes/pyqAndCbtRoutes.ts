import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
  NEET_UG_PAPER_QUESTIONS,
  BITSAT_PAPER_QUESTIONS,
} from '../../data/jeeInitialContent';
import { EXPANDED_NTA_58_CHAPTERS } from '../../data/expandedNta58Chapters';
import { Type } from '@google/genai';
import {
  buildThinkingFallbackChain,
  generateWithModelFallback,
  getValidatedGenAIClient,
  gradeCbtAttemptOnServer,
  sendStructuredUpstreamError,
} from '../coreStudyEngine';
import { AuthenticatedRequest, requireAuthenticatedStudent } from '../middleware/authAndSecurity';
import {
  createRouteRateLimiter,
  rateLimiterAndQuotaMiddleware,
} from '../middleware/rateLimiterAndQuotas';
import { OFFICIAL_EXAM_SPECS } from '../../config/examSpecs';
import {
  AUTHORITATIVE_KEY_VERSION,
  resolveServerAnswerKey,
  stripQuestionAnswerKeys,
} from '../data/authoritativeAnswerKeys';
import { adminListCollection, adminSetDoc } from '../persistence/firestoreAdminStore';
import {
  normalizeConvertedCbtPaper,
  parseModelJsonPayload,
} from '../convertedPaperNormalizer';
import { ConvertedPaperPattern } from '../../utils/jeeEngine';

export const pyqAndCbtRouter = Router();

export interface QuestionIssueReportRecord {
  reportId: string;
  uid: string;
  questionId: string;
  issueType:
    | 'wrong_answer_key'
    | 'typo_or_latex'
    | 'missing_diagram'
    | 'provenance_mismatch'
    | 'other';
  details: string;
  status: 'open';
  createdAtIso: string;
}

const reportRateLimit = createRouteRateLimiter({
  maxPerMinute: 10,
  keyPrefix: 'pyq_report',
  errorCode: 'ISSUE_REPORT_RATE_LIMIT',
});

const ALL_SERVER_PYQS = [
  ...CBT_MOCK_QUESTIONS,
  ...JEE_ADVANCED_PAPER_QUESTIONS,
  ...NEET_UG_PAPER_QUESTIONS,
  ...BITSAT_PAPER_QUESTIONS,
];

// Official versioned exam blueprint specs (/api/cbt/exam-specs)
pyqAndCbtRouter.get('/cbt/exam-specs', (_req: Request, res: Response) => {
  res.json({
    defaultVersion: 'jee-main-2027-paper1',
    specs: OFFICIAL_EXAM_SPECS,
  });
});

// 1. Paginated PYQ & 58-Chapter Filter Endpoint (/api/pyq/questions) — STRIPS ANSWER KEYS
pyqAndCbtRouter.get('/pyq/questions', (req: Request, res: Response) => {
  const subject = String(req.query.subject || 'All');
  const chapter = String(req.query.chapter || 'All');
  const provenance = String(req.query.provenance || 'All');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));

  const filtered = ALL_SERVER_PYQS.filter((q) => {
    const subjMatch = subject === 'All' || q.subject === subject;
    const chapMatch =
      chapter === 'All' || q.chapter.toLowerCase().includes(chapter.toLowerCase());
    const provMatch =
      provenance === 'All' || (q.provenanceType || 'LEARNMATE_ORIGINAL') === provenance;
    return subjMatch && chapMatch && provMatch;
  });

  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map(stripQuestionAnswerKeys);

  res.json({
    page,
    limit,
    totalCount: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    chaptersCount: EXPANDED_NTA_58_CHAPTERS.length,
    isPartialArchive: true,
    answerKeysStripped: true,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
    items,
  });
});

// 2. Lazy-Loaded PYQ JSON Pack Endpoint (/api/pyq/packs/:packId) — STRIPS ANSWER KEYS
pyqAndCbtRouter.get('/pyq/packs/:packId', (req: Request, res: Response) => {
  const rawPackId = String(req.params.packId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const publicPacksDir = path.resolve(process.cwd(), 'public', 'pyq-packs');
  const filePath = path.join(publicPacksDir, `${rawPackId}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const strippedQuestions = Array.isArray(parsed?.questions)
        ? parsed.questions.map(stripQuestionAnswerKeys)
        : [];
      res.json({
        ...parsed,
        answerKeysStripped: true,
        keyVersion: AUTHORITATIVE_KEY_VERSION,
        questions: strippedQuestions,
      });
      return;
    } catch {
      // fall through
    }
  }

  if (rawPackId === 'jee-advanced-papers') {
    res.json({
      packId: 'jee-advanced-papers',
      title: 'JEE Advanced Multi-Format Sample Pack (Curated Sample)',
      isPartialArchive: true,
      answerKeysStripped: true,
      keyVersion: AUTHORITATIVE_KEY_VERSION,
      archiveNote:
        'Curated multi-format sample bank showcasing JEE Advanced partial marking, matrix-match, and integer patterns.',
      questionCount: JEE_ADVANCED_PAPER_QUESTIONS.length,
      questions: JEE_ADVANCED_PAPER_QUESTIONS.map(stripQuestionAnswerKeys),
    });
    return;
  }

  res.json({
    packId: rawPackId || 'jee-main-shifts',
    title: 'JEE Main 2027 Blueprint 75-Q Practice Simulator Pack',
    isPartialArchive: true,
    answerKeysStripped: true,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
    archiveNote:
      '75-question blueprint drill generator combining curated reference problems and LearnMate Original practice variants.',
    questionCount: CBT_MOCK_QUESTIONS.length,
    questions: CBT_MOCK_QUESTIONS.map(stripQuestionAnswerKeys),
  });
});

// 2b. Server-side Single Question Answer Verification for Practice Cards & Explorer
pyqAndCbtRouter.post('/pyq/verify-answer', (req: Request, res: Response) => {
  const { questionId, selectedOption, selectedOptions, numericalValue } = req.body || {};
  const id = String(questionId || '').trim();
  const keyEntry = resolveServerAnswerKey(id);
  if (!keyEntry) {
    res.status(404).json({
      errorCode: 'QUESTION_KEY_NOT_FOUND',
      message: 'Authoritative server answer key not found for this question ID.',
    });
    return;
  }

  let isCorrect = false;
  if (
    typeof keyEntry.numericalAnswer === 'number' &&
    numericalValue !== undefined &&
    numericalValue !== ''
  ) {
    const tol = keyEntry.numericalTolerance ?? 0.01;
    const numVal = Number(numericalValue);
    isCorrect = Number.isFinite(numVal) && Math.abs(numVal - keyEntry.numericalAnswer) <= tol;
  } else if (
    keyEntry.advancedFormat === 'multiple' &&
    Array.isArray(keyEntry.correctIndices) &&
    Array.isArray(selectedOptions)
  ) {
    const a = [...keyEntry.correctIndices].sort();
    const b = [...selectedOptions].map(Number).sort();
    isCorrect = a.length === b.length && a.every((v, idx) => v === b[idx]);
  } else if (typeof selectedOption === 'number') {
    isCorrect = selectedOption === keyEntry.correctIndex;
  }

  res.json({
    questionId: id,
    isCorrect,
    correctIndex: keyEntry.correctIndex,
    correctIndices: keyEntry.correctIndices,
    numericalAnswer: keyEntry.numericalAnswer,
    explanation: keyEntry.explanation,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
  });
});

// 3. Server-Verified CBT Grading (/api/cbt/grade)
pyqAndCbtRouter.post('/cbt/grade', (req: Request, res: Response) => {
  const {
    questions,
    questionIds,
    attemptType = 'official_mock',
    responses = {},
    examMode = 'JEE Main',
  } = req.body || {};

  const hasQuestions = Array.isArray(questions) && questions.length > 0;
  const hasIds = Array.isArray(questionIds) && questionIds.length > 0;
  if (!hasQuestions && !hasIds) {
    res.status(400).json({
      errorCode: 'EMPTY_CBT_QUESTIONS',
      message: 'A non-empty questions or questionIds array is required for server CBT grading.',
    });
    return;
  }

  if (typeof responses !== 'object' || responses === null || Array.isArray(responses)) {
    res.status(400).json({
      errorCode: 'INVALID_RESPONSES_FORMAT',
      message: 'responses must be a map keyed by questionId.',
    });
    return;
  }

  try {
    const graded = gradeCbtAttemptOnServer({
      questions: hasQuestions ? questions : undefined,
      questionIds: hasIds ? questionIds : undefined,
      attemptType: attemptType === 'custom_drill' ? 'custom_drill' : 'official_mock',
      responses,
      examMode,
    });

    res.json(graded);
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      errorCode: err?.errorCode || 'CBT_GRADING_FAILED',
      message: err?.message || 'Unable to grade CBT attempt against server keys.',
    });
  }
});

// 4. Question / PYQ Issue Reporting Workflow (/api/pyq/report-issue) — Persisted via firestoreAdminStore
pyqAndCbtRouter.post(
  '/pyq/report-issue',
  requireAuthenticatedStudent,
  reportRateLimit,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    const { questionId, issueType = 'other', details = '' } = req.body || {};

    if (!questionId || typeof questionId !== 'string' || questionId.trim().length > 128) {
      res.status(400).json({
        errorCode: 'INVALID_QUESTION_ID',
        message: 'A valid questionId is required.',
        requestId: req.requestId,
      });
      return;
    }

    const cleanDetails = String(details || '').trim();
    if (cleanDetails.length < 5 || cleanDetails.length > 2000) {
      res.status(400).json({
        errorCode: 'INVALID_ISSUE_DETAILS',
        message: 'Issue details must be between 5 and 2000 characters.',
        requestId: req.requestId,
      });
      return;
    }

    const allowedIssueTypes = new Set([
      'wrong_answer_key',
      'typo_or_latex',
      'missing_diagram',
      'provenance_mismatch',
      'other',
    ]);
    const safeType = allowedIssueTypes.has(String(issueType))
      ? (String(issueType) as QuestionIssueReportRecord['issueType'])
      : 'other';

    const report: QuestionIssueReportRecord = {
      reportId: `rep-${crypto.randomUUID().slice(0, 12)}`,
      uid,
      questionId: questionId.trim(),
      issueType: safeType,
      details: cleanDetails,
      status: 'open',
      createdAtIso: new Date().toISOString(),
    };

    try {
      await adminSetDoc(`issue_reports/${uid}/items`, report.reportId, report, true);
      res.status(201).json({
        status: 'REPORT_LOGGED',
        report,
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
        message: err?.message || 'Unable to persist issue report.',
        requestId: req.requestId,
      });
    }
  }
);

pyqAndCbtRouter.get(
  '/pyq/report-issue',
  requireAuthenticatedStudent,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    try {
      const reports = await adminListCollection<QuestionIssueReportRecord>(
        `issue_reports/${uid}/items`,
        100
      );
      res.json({
        reports: reports.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
        message: err?.message || 'Unable to load issue reports.',
        requestId: req.requestId,
      });
    }
  }
);

const ALLOWED_CONVERSION_PATTERNS = new Set<ConvertedPaperPattern>([
  'JEE Main +4/-1',
  'JEE Advanced +4/-2 Partial',
  'NEET +4/-1',
]);

// 5. Offline Question Paper / Multi-Photo -> CBT Converter (/api/cbt/convert-paper)
pyqAndCbtRouter.post(
  '/cbt/convert-paper',
  requireAuthenticatedStudent,
  rateLimiterAndQuotaMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      pages,
      pattern = 'JEE Main +4/-1',
      answerKeyText = '',
      answerKeyImages,
      questionNumberOffset = 0,
    } = req.body || {};

    if (!Array.isArray(pages) || pages.length === 0 || pages.length > 6) {
      res.status(400).json({
        errorCode: 'INVALID_PAPER_PAGES',
        message: 'Provide between 1 and 6 pages per conversion batch.',
        requestId: req.requestId,
      });
      return;
    }

    const safePattern: ConvertedPaperPattern = ALLOWED_CONVERSION_PATTERNS.has(pattern)
      ? pattern
      : 'JEE Main +4/-1';

    const cleanAnswerKeyText = String(answerKeyText || '').slice(0, 40_000).trim();
    const safeKeyImages = Array.isArray(answerKeyImages)
      ? answerKeyImages
          .filter(
            (img: any) =>
              img &&
              typeof img.imageBase64 === 'string' &&
              img.imageBase64.trim().length > 20
          )
          .slice(0, 4)
      : [];

    const hasAnyContent = pages.some(
      (p: any) =>
        (typeof p?.text === 'string' && p.text.trim().length >= 10) ||
        (typeof p?.imageBase64 === 'string' && p.imageBase64.trim().length > 20)
    );

    if (!hasAnyContent) {
      res.status(400).json({
        errorCode: 'EMPTY_PAPER_CONTENT',
        message: 'Each batch must contain readable text or page images.',
        requestId: req.requestId,
      });
      return;
    }

    try {
      const ai = getValidatedGenAIClient();
      const chapterReferenceList = EXPANDED_NTA_58_CHAPTERS.map(
        (c) => `${c.subject}: ${c.chapterName}`
      ).join('\n');

      const contentParts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [
        {
          text: [
            `You are an expert ${safePattern} exam parser and physics/chemistry/math/biology solver.`,
            `Extract EVERY complete question visible on the provided paper page(s) in sequential order.`,
            `Rules:`,
            `1. Format all equations, units, ions, vectors, and formulas using standard $...$ LaTeX.`,
            `2. Classify subject strictly as Physics, Chemistry, Mathematics${safePattern === 'NEET +4/-1' ? ', or Biology' : ''}.`,
            `3. Map chapter to the closest chapter name from this official NTA syllabus list:\n${chapterReferenceList}`,
            `4. Classify type strictly as MCQ, NUMERICAL, MULTI_CORRECT, COMPREHENSION, or MATRIX_MATCH.`,
            `5. For MCQ, MULTI_CORRECT, COMPREHENSION, and MATRIX_MATCH provide exactly 4 option strings (without "(A)" prefixes). For NUMERICAL provide options as [].`,
            `6. If an official answer key is attached below, match the exact answer from the official key and write a concise derivation explaining why it is correct. Otherwise solve carefully step by step and verify your answer.`,
            `7. Set hasDiagramReference: true ONLY if the question explicitly references a figure, circuit, graph, ray diagram, organic structure image, or table shown on the page. Never invent SVG diagrams.`,
            `8. Set needsReview: true if the question text, options, diagram, or answer is partially cut off, blurry, or ambiguous.`,
            `9. Set sourcePageNumber to the exact 1-based page number header for that question.`,
            cleanAnswerKeyText
              ? `\nATTACHED OFFICIAL ANSWER KEY TEXT (strict precedence):\n${cleanAnswerKeyText}`
              : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ];

      for (const page of pages) {
        const pageNum = Math.max(1, Number(page?.pageNumber || 1));
        contentParts.push({ text: `\n--- QUESTION PAPER PAGE ${pageNum} ---` });
        if (typeof page?.text === 'string' && page.text.trim()) {
          contentParts.push({
            text: `Extracted Page ${pageNum} Text:\n${page.text.trim().slice(0, 24_000)}`,
          });
        }
        if (typeof page?.imageBase64 === 'string' && page.imageBase64.trim()) {
          const cleanBase64 = page.imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
          const mime =
            typeof page?.mimeType === 'string' && page.mimeType.startsWith('image/')
              ? page.mimeType
              : 'image/jpeg';
          contentParts.push({
            inlineData: { mimeType: mime, data: cleanBase64 },
          });
        }
      }

      if (safeKeyImages.length > 0) {
        contentParts.push({
          text: `\n--- ATTACHED OFFICIAL ANSWER KEY IMAGES (strict precedence over AI guessing) ---`,
        });
        for (const keyImg of safeKeyImages) {
          const cleanBase64 = String(keyImg.imageBase64)
            .replace(/^data:[^;]+;base64,/, '')
            .trim();
          const mime =
            typeof keyImg.mimeType === 'string' && keyImg.mimeType.startsWith('image/')
              ? keyImg.mimeType
              : 'image/jpeg';
          contentParts.push({
            inlineData: { mimeType: mime, data: cleanBase64 },
          });
        }
      }

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionNumber: { type: Type.INTEGER },
                subject: { type: Type.STRING },
                chapter: { type: Type.STRING },
                type: { type: Type.STRING },
                stem: { type: Type.STRING },
                paragraphContext: { type: Type.STRING },
                matrixListI: { type: Type.ARRAY, items: { type: Type.STRING } },
                matrixListII: { type: Type.ARRAY, items: { type: Type.STRING } },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                correctIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                numericalAnswer: { type: Type.NUMBER },
                solution: { type: Type.STRING },
                sourcePageNumber: { type: Type.INTEGER },
                hasDiagramReference: { type: Type.BOOLEAN },
                needsReview: { type: Type.BOOLEAN },
              },
              required: ['subject', 'chapter', 'type', 'stem', 'options', 'sourcePageNumber'],
            },
          },
        },
        required: ['questions'],
      };

      const models = buildThinkingFallbackChain();
      const { result, modelUsed, fallbackUsed } = await generateWithModelFallback(
        models,
        (model) =>
          ai.models.generateContent({
            model,
            contents: contentParts,
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseSchema,
            },
          })
      );

      const parsedPayload = parseModelJsonPayload(result.text || '');
      const normalized = normalizeConvertedCbtPaper({
        rawPayload: parsedPayload,
        pattern: safePattern,
        attachedAnswerKeyText: cleanAnswerKeyText,
        questionNumberOffset: Number(questionNumberOffset || 0),
        batchIdPrefix: `conv-${crypto.randomUUID().slice(0, 8)}`,
      });

      res.json({
        ok: true,
        pattern: safePattern,
        questions: normalized.questions,
        summary: normalized.summary,
        modelUsed,
        fallbackUsed,
      });
    } catch (error: any) {
      sendStructuredUpstreamError(res, error, '/api/cbt/convert-paper', req.requestId);
    }
  }
);
