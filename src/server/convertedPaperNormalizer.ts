import { EXPANDED_NTA_58_CHAPTERS } from '../data/expandedNta58Chapters';
import {
  AdvancedQuestionFormat,
  CBTQuestion,
  ConvertedPaperPattern,
  ConvertedTestSummary,
  ExamTrack,
  evaluateSingleQuestionMarks,
} from '../utils/jeeEngine';

export type RawConvertedQuestionType =
  | 'MCQ'
  | 'NUMERICAL'
  | 'MULTI_CORRECT'
  | 'COMPREHENSION'
  | 'MATRIX_MATCH';

export interface RawConvertedPaperQuestionInput {
  questionNumber?: number;
  subject?: string;
  chapter?: string;
  type?: string;
  stem?: string;
  paragraphContext?: string;
  matrixListI?: string[];
  matrixListII?: string[];
  options?: string[];
  correctIndex?: number | null;
  correctIndices?: number[] | null;
  numericalAnswer?: number | string | null;
  solution?: string;
  explanation?: string;
  sourcePageNumber?: number;
  hasDiagramReference?: boolean;
  needsReview?: boolean;
}

export interface ParsedAttachedAnswerEntry {
  questionNumber: number;
  letters?: number[];
  numericalAnswer?: number;
  raw: string;
}

const STOP_WORDS = new Set([
  'and',
  'of',
  'in',
  'the',
  'to',
  'for',
  'with',
  'on',
  'unit',
  'its',
  'their',
]);

function tokenize(input: string): string[] {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}

export function normalizeExamPatternToTrack(pattern: ConvertedPaperPattern): ExamTrack {
  if (pattern === 'JEE Advanced +4/-2 Partial') return 'JEE Advanced';
  if (pattern === 'NEET +4/-1') return 'NEET UG';
  return 'JEE Main';
}

export function normalizeSubjectValue(rawSubject?: string): {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  isBiology: boolean;
} {
  const norm = String(rawSubject || '').trim().toLowerCase();
  if (norm.includes('bio') || norm.includes('botany') || norm.includes('zoology')) {
    return { subject: 'Chemistry', isBiology: true };
  }
  if (norm.includes('math') || norm.includes('calc') || norm.includes('alg') || norm.includes('geom')) {
    return { subject: 'Mathematics', isBiology: false };
  }
  if (norm.includes('chem') || norm.includes('organic') || norm.includes('inorganic')) {
    return { subject: 'Chemistry', isBiology: false };
  }
  return { subject: 'Physics', isBiology: false };
}

/**
 * Maps a raw AI-extracted chapter string onto the canonical 58-chapter NTA JEE syllabus.
 */
export function mapChapterToNta58(
  rawChapter?: string,
  subjectHint?: 'Physics' | 'Chemistry' | 'Mathematics',
  isBiology = false
): string {
  const cleaned = String(rawChapter || '').trim();
  if (isBiology) {
    return cleaned ? `Biology — ${cleaned}`.slice(0, 115) : 'Biology (NEET UG Syllabus)';
  }

  if (!cleaned) {
    const firstInSubj = EXPANDED_NTA_58_CHAPTERS.find((c) => c.subject === subjectHint);
    return firstInSubj?.chapterName || 'General';
  }

  const lowerCleaned = cleaned.toLowerCase();
  const exactMatch = EXPANDED_NTA_58_CHAPTERS.find(
    (c) =>
      c.chapterName.toLowerCase() === lowerCleaned ||
      c.unitName.toLowerCase() === lowerCleaned
  );
  if (exactMatch) return exactMatch.chapterName;

  const queryTokens = tokenize(cleaned);
  let bestScore = 0;
  let bestChapterName = '';

  for (const entry of EXPANDED_NTA_58_CHAPTERS) {
    const entryText = `${entry.unitName} ${entry.chapterName} ${entry.branch || ''}`.toLowerCase();
    let score = 0;

    if (entry.chapterName.toLowerCase().includes(lowerCleaned) || lowerCleaned.includes(entry.chapterName.toLowerCase())) {
      score += 8;
    }

    const entryTokens = new Set(tokenize(entryText));
    for (const tok of queryTokens) {
      if (entryTokens.has(tok)) {
        score += 2;
      } else {
        for (const et of entryTokens) {
          if (et.length >= 4 && tok.length >= 4 && (et.startsWith(tok) || tok.startsWith(et))) {
            score += 1;
            break;
          }
        }
      }
    }

    if (subjectHint && entry.subject === subjectHint && score > 0) {
      score += 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestChapterName = entry.chapterName;
    }
  }

  if (bestScore >= 2 && bestChapterName) {
    return bestChapterName;
  }

  return cleaned.slice(0, 115);
}

/**
 * Parses common coaching answer-key text formats:
 * e.g. "1. A", "Q2: (B)", "3) 4.5", "4 - A, C", "5: [B, D]", "6 -> -12", "1 A 2 B 3 14"
 */
export function parseAttachedAnswerKeyText(rawKeyText?: string): Map<number, ParsedAttachedAnswerEntry> {
  const map = new Map<number, ParsedAttachedAnswerEntry>();
  const text = String(rawKeyText || '').trim();
  if (!text) return map;

  const pairRegex =
    /(?:^|[\s,;|])(?:Q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*(?:[.):\-=>]+|\s)\s*(\[[A-Da-d,\s/&]+\]|\([A-Da-d0-9.,\s/+-]+\)|[A-Da-d](?:\s*[,/&]\s*[A-Da-d])*|-?\d+(?:\.\d+)?)(?=$|[\s,;|])/gm;

  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(text)) !== null) {
    const qNum = Number(match[1]);
    const rawAns = String(match[2] || '').trim();
    if (!Number.isInteger(qNum) || qNum <= 0 || qNum > 500 || !rawAns) continue;

    const stripped = rawAns.replace(/^[\[(]+|[\])]+$/g, '').trim();
    if (/^[A-Da-d](?:\s*[,/&]\s*[A-Da-d])*$/.test(stripped)) {
      const letters = Array.from(
        new Set(
          stripped
            .toUpperCase()
            .split(/[,/&\s]+/)
            .filter(Boolean)
            .map((ch) => ch.charCodeAt(0) - 65)
            .filter((idx) => idx >= 0 && idx <= 3)
        )
      ).sort((a, b) => a - b);
      if (letters.length > 0) {
        map.set(qNum, { questionNumber: qNum, letters, raw: stripped });
      }
      continue;
    }

    if (/^-?\d+(?:\.\d+)?$/.test(stripped)) {
      const numVal = Number(stripped);
      if (Number.isFinite(numVal)) {
        map.set(qNum, { questionNumber: qNum, numericalAnswer: numVal, raw: stripped });
      }
    }
  }

  return map;
}

export function parseModelJsonPayload(rawText: string): any {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return { questions: [] };
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(withoutFences);
  } catch {
    const firstBrace = withoutFences.indexOf('{');
    const lastBrace = withoutFences.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1));
      } catch {
        // fall through
      }
    }
    const firstBracket = withoutFences.indexOf('[');
    const lastBracket = withoutFences.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      try {
        return { questions: JSON.parse(withoutFences.slice(firstBracket, lastBracket + 1)) };
      } catch {
        // fall through
      }
    }
    return { questions: [] };
  }
}

function normalizeQuestionType(rawType?: string, options?: string[]): RawConvertedQuestionType {
  const upper = String(rawType || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (upper.includes('NUMER') || upper.includes('INTEGER')) return 'NUMERICAL';
  if (upper.includes('MULTI') || upper.includes('ONE_OR_MORE')) return 'MULTI_CORRECT';
  if (upper.includes('COMPREH') || upper.includes('PARAGRAPH') || upper.includes('PASSAGE')) {
    return 'COMPREHENSION';
  }
  if (upper.includes('MATRIX') || upper.includes('MATCH')) return 'MATRIX_MATCH';
  if ((!options || options.length === 0) && upper === '') return 'NUMERICAL';
  return 'MCQ';
}

function mapTypeToAdvancedFormat(type: RawConvertedQuestionType): AdvancedQuestionFormat {
  switch (type) {
    case 'NUMERICAL':
      return 'numerical';
    case 'MULTI_CORRECT':
      return 'multiple';
    case 'COMPREHENSION':
      return 'paragraph';
    case 'MATRIX_MATCH':
      return 'matrix';
    case 'MCQ':
    default:
      return 'single';
  }
}

export function computeConvertedPaperSummary(questions: CBTQuestion[]): ConvertedTestSummary {
  let physicsCount = 0;
  let chemistryCount = 0;
  let mathematicsCount = 0;
  let biologyCount = 0;
  let maxMarks = 0;
  let needsReviewCount = 0;
  let diagramQuestionCount = 0;

  for (const q of questions) {
    if (q.subTrackLabel === 'Biology (Botany & Zoology)') {
      biologyCount += 1;
    } else if (q.subject === 'Physics') {
      physicsCount += 1;
    } else if (q.subject === 'Chemistry') {
      chemistryCount += 1;
    } else {
      mathematicsCount += 1;
    }

    if (q.keySource === 'needs_review') needsReviewCount += 1;
    if (q.hasDiagramReference) diagramQuestionCount += 1;
    maxMarks += evaluateSingleQuestionMarks(q).maxMarks;
  }

  return {
    physicsCount,
    chemistryCount,
    mathematicsCount,
    ...(biologyCount > 0 ? { biologyCount } : {}),
    totalQuestions: questions.length,
    maxMarks,
    needsReviewCount,
    diagramQuestionCount,
  };
}

export function normalizeConvertedCbtPaper(params: {
  rawPayload: any;
  pattern: ConvertedPaperPattern;
  attachedAnswerKeyText?: string;
  attachedKeyMap?: Map<number, ParsedAttachedAnswerEntry>;
  pageImagesByNumber?: Record<number, string>;
  questionNumberOffset?: number;
  batchIdPrefix?: string;
}): {
  questions: CBTQuestion[];
  summary: ConvertedTestSummary;
} {
  const examTrack = normalizeExamPatternToTrack(params.pattern);
  const offset = Math.max(0, Number(params.questionNumberOffset || 0));
  const keyMap =
    params.attachedKeyMap ||
    parseAttachedAnswerKeyText(params.attachedAnswerKeyText || '');

  const rawList: RawConvertedPaperQuestionInput[] = Array.isArray(params.rawPayload)
    ? params.rawPayload
    : Array.isArray(params.rawPayload?.questions)
    ? params.rawPayload.questions
    : [];

  const questions: CBTQuestion[] = [];
  const prefix = params.batchIdPrefix || `conv-${Date.now()}`;

  rawList.forEach((raw, idx) => {
    const stem = String(raw?.stem || '').trim();
    if (!stem) return;

    const { subject, isBiology } = normalizeSubjectValue(raw.subject);
    const assignedNumber =
      typeof raw.questionNumber === 'number' && Number.isInteger(raw.questionNumber) && raw.questionNumber > 0
        ? raw.questionNumber
        : offset + questions.length + 1;

    const cleanOptions = Array.isArray(raw.options)
      ? raw.options.map((opt) => String(opt || '').trim()).filter(Boolean).slice(0, 4)
      : [];

    let qType = normalizeQuestionType(raw.type, cleanOptions);
    const attachedKey = keyMap.get(assignedNumber);

    // If official key specifies multiple letters, honour MULTI_CORRECT
    if (attachedKey?.letters && attachedKey.letters.length > 1) {
      qType = 'MULTI_CORRECT';
    } else if (
      attachedKey?.numericalAnswer !== undefined &&
      cleanOptions.length === 0
    ) {
      qType = 'NUMERICAL';
    }

    const isNumerical = qType === 'NUMERICAL';
    const finalOptions = isNumerical
      ? []
      : cleanOptions.length === 4
      ? cleanOptions
      : [
          ...cleanOptions,
          ...Array.from(
            { length: Math.max(0, 4 - cleanOptions.length) },
            (_, padIdx) => `Option ${String.fromCharCode(65 + cleanOptions.length + padIdx)}`
          ),
        ];

    const incompleteOptions = !isNumerical && cleanOptions.length < 4;

    let correctIndex = 0;
    let correctIndices: number[] | undefined;
    let numericalAnswer: number | undefined;
    let keySource: 'official_key_attached' | 'ai_verified' | 'needs_review' = 'needs_review';

    if (attachedKey) {
      keySource = 'official_key_attached';
      if (isNumerical && attachedKey.numericalAnswer !== undefined) {
        numericalAnswer = attachedKey.numericalAnswer;
      } else if (qType === 'MULTI_CORRECT' && attachedKey.letters && attachedKey.letters.length > 0) {
        correctIndices = attachedKey.letters;
        correctIndex = attachedKey.letters[0];
      } else if (attachedKey.letters && attachedKey.letters.length > 0) {
        correctIndex = attachedKey.letters[0];
      } else if (attachedKey.numericalAnswer !== undefined) {
        numericalAnswer = attachedKey.numericalAnswer;
      } else {
        keySource = 'needs_review';
      }
    } else if (!raw.needsReview && !incompleteOptions) {
      if (isNumerical) {
        const parsedNum =
          raw.numericalAnswer !== null && raw.numericalAnswer !== undefined && raw.numericalAnswer !== ''
            ? Number(raw.numericalAnswer)
            : NaN;
        if (Number.isFinite(parsedNum)) {
          numericalAnswer = parsedNum;
          keySource = 'ai_verified';
        }
      } else if (qType === 'MULTI_CORRECT') {
        const validIndices = Array.isArray(raw.correctIndices)
          ? Array.from(
              new Set(
                raw.correctIndices
                  .map(Number)
                  .filter((n) => Number.isInteger(n) && n >= 0 && n <= 3)
              )
            ).sort((a, b) => a - b)
          : [];
        if (validIndices.length > 0) {
          correctIndices = validIndices;
          correctIndex = validIndices[0];
          keySource = 'ai_verified';
        }
      } else {
        const idxCandidate = Number(raw.correctIndex);
        if (Number.isInteger(idxCandidate) && idxCandidate >= 0 && idxCandidate <= 3) {
          correctIndex = idxCandidate;
          keySource = 'ai_verified';
        }
      }
    }

    if (isNumerical && numericalAnswer === undefined) {
      numericalAnswer = 0;
      keySource = 'needs_review';
    }
    if (qType === 'MULTI_CORRECT' && (!correctIndices || correctIndices.length === 0)) {
      const fallbackIdx = Number.isInteger(Number(raw.correctIndex)) && Number(raw.correctIndex) >= 0 && Number(raw.correctIndex) <= 3
        ? Number(raw.correctIndex)
        : 0;
      correctIndices = [fallbackIdx];
      correctIndex = fallbackIdx;
    }
    if (incompleteOptions) {
      keySource = attachedKey ? 'official_key_attached' : 'needs_review';
    }

    const sourcePageNumber =
      typeof raw.sourcePageNumber === 'number' && Number.isInteger(raw.sourcePageNumber) && raw.sourcePageNumber >= 1
        ? raw.sourcePageNumber
        : 1;
    const hasDiagramReference = Boolean(raw.hasDiagramReference);
    const diagramImageUrl =
      hasDiagramReference && params.pageImagesByNumber?.[sourcePageNumber]
        ? params.pageImagesByNumber[sourcePageNumber]
        : undefined;

    const chapter = mapChapterToNta58(raw.chapter, subject, isBiology);
    const explanationText = String(raw.solution || raw.explanation || '').trim() ||
      (keySource === 'official_key_attached'
        ? 'Verified against your attached official answer key.'
        : 'Extracted from uploaded question paper.');

    const normalizedQ: CBTQuestion = {
      id: `${prefix}-q${assignedNumber}-${idx + 1}`,
      number: assignedNumber,
      subject,
      ...(isBiology ? { subTrackLabel: 'Biology (Botany & Zoology)' as const } : {}),
      section: isNumerical ? 'Section B' : 'Section A',
      chapter,
      stem,
      ...(raw.paragraphContext ? { paragraphContext: String(raw.paragraphContext).trim() } : {}),
      ...(Array.isArray(raw.matrixListI) && raw.matrixListI.length > 0
        ? { matrixListI: raw.matrixListI.map((item) => String(item).trim()).filter(Boolean) }
        : {}),
      ...(Array.isArray(raw.matrixListII) && raw.matrixListII.length > 0
        ? { matrixListII: raw.matrixListII.map((item) => String(item).trim()).filter(Boolean) }
        : {}),
      options: finalOptions,
      correctIndex,
      ...(correctIndices ? { correctIndices } : {}),
      ...(numericalAnswer !== undefined ? { numericalAnswer } : {}),
      explanation: explanationText,
      examType: examTrack,
      advancedFormat: mapTypeToAdvancedFormat(qType),
      pyqTag: `${params.pattern} • Page ${sourcePageNumber}`,
      provenanceType: 'AI_GENERATED',
      sourcePageNumber,
      keySource,
      hasDiagramReference,
      ...(diagramImageUrl ? { diagramImageUrl } : {}),
      convertedQuestionType: qType,
    };

    questions.push(normalizedQ);
  });

  // Ensure strictly sequential numbering across merged paper if needed while preserving extracted numbers when monotonic
  const summary = computeConvertedPaperSummary(questions);
  return { questions, summary };
}
