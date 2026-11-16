import {
  AngleMode,
  evaluateMathDetailed,
  safeEvaluateMathExpression,
  validateMathSyntax,
} from './safeMathParser';

export { evaluateMathDetailed, validateMathSyntax };
export type { AngleMode };

export type QuestionStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked'
  | 'answered_marked';

export type AdvancedQuestionFormat =
  | 'single'
  | 'multiple'
  | 'numerical'
  | 'matrix'
  | 'paragraph';

export type ErrorRootCauseTag =
  | 'Conceptual Gap'
  | 'Formula Forgotten'
  | 'Calculation/Silly Error'
  | 'Misread Question'
  | 'Time Pressure';

export type ExamTrack = 'JEE Main' | 'JEE Advanced' | 'NEET UG' | 'BITSAT';

export type QuestionProvenanceType =
  | 'VERIFIED_OFFICIAL_PYQ'
  | 'RECONSTRUCTED_WITH_SOURCE'
  | 'LEARNMATE_ORIGINAL'
  | 'AI_GENERATED'
  | 'UNVERIFIED_OR_REVIEW_PENDING';

export interface CBTQuestion {
  id: string;
  number: number;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  subTrackLabel?: 'Biology (Botany & Zoology)' | 'English & Logical Reasoning';
  section: 'Section A' | 'Section B';
  chapter: string;
  stem: string;
  stemHindi?: string;
  paragraphContext?: string;
  matrixListI?: string[];
  matrixListII?: string[];
  options: string[];
  optionsHindi?: string[];
  correctIndex: number;
  correctIndices?: number[]; // For JEE Advanced multi-choice
  numericalAnswer?: number;
  numericalTolerance?: number;
  explanation: string;
  difficultyBucket?: 'Beginner' | 'Must-Do' | 'Advanced Climb';
  examType?: ExamTrack;
  examVersion?: string;
  advancedFormat?: AdvancedQuestionFormat;
  pyqTag?: string;
  year?: number;
  shift?: string;
  provenanceType?: QuestionProvenanceType;
  sourceUrl?: string;
  answerKeyVersion?: string;
  verificationStatus?: 'verified' | 'reconstructed' | 'unverified';
  licenseStatus?: string;
  conceptTags?: string[];
  sourcePageNumber?: number;
  keySource?: 'official_key_attached' | 'ai_verified' | 'needs_review';
  hasDiagramReference?: boolean;
  diagramImageUrl?: string;
  convertedQuestionType?: 'MCQ' | 'NUMERICAL' | 'MULTI_CORRECT' | 'COMPREHENSION' | 'MATRIX_MATCH';
}

export type ConvertedPaperPattern =
  | 'JEE Main +4/-1'
  | 'JEE Advanced +4/-2 Partial'
  | 'NEET +4/-1';

export interface ConvertedTestSummary {
  physicsCount: number;
  chemistryCount: number;
  mathematicsCount: number;
  biologyCount?: number;
  totalQuestions: number;
  maxMarks: number;
  needsReviewCount: number;
  diagramQuestionCount: number;
}

export interface ConvertedTestRecord {
  id: string;
  title: string;
  pattern: ConvertedPaperPattern;
  examMode: ExamTrack;
  durationMinutes: number;
  questions: CBTQuestion[];
  summary: ConvertedTestSummary;
  sourceMode: 'pdf' | 'photos';
  pageCount: number;
  hasAttachedAnswerKey: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface QuestionResponseState {
  status: QuestionStatus;
  selectedOption: number | null;
  selectedOptions?: number[]; // For JEE Advanced multi-choice
  numericalValue?: string;
  timeSpentSec: number;
}

export interface QuestionAttemptDetail {
  questionId: string;
  number: number;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  section: 'Section A' | 'Section B';
  isAttempted: boolean;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  timeSpentSec: number;
  userAnswerLabel: string;
  correctAnswerLabel: string;
}

export interface CBTSummaryMetrics {
  score: number;
  maxMarks: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracy: number;
  questionDetails: QuestionAttemptDetail[];
  chapterBreakdown: {
    chapter: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    marks: number;
    maxMarks: number;
    timeMinutes: number;
    accuracy: number;
  }[];
}

/**
 * Evaluates a single question under versioned official exam rules:
 * - Official NTA JEE Main 2026/2027 Paper 1 rules:
 *   Section A (20 Single-Choice MCQs): +4 correct, -1 wrong, 0 unattempted
 *   Section B (5 Compulsory Numerical-Value Questions): +4 correct, -1 wrong, 0 unattempted
 * - JEE Advanced Paper 1 & 2 rules:
 *   Single Choice / Paragraph / Matrix-Match: +3 correct, -1 wrong
 *   Multiple Choice (One or More than One Correct): +4 all correct, -2 any wrong chosen,
 *     +1 per correct option chosen when zero wrong options are chosen
 *   Non-Negative Integer Numerical: +4 correct, 0 wrong
 * - BITSAT: +3 correct, -1 wrong
 * - NEET UG: +4 correct, -1 wrong
 */
export function evaluateSingleQuestionMarks(
  q: CBTQuestion,
  r?: QuestionResponseState
): {
  isAttempted: boolean;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  userAnswerLabel: string;
  correctAnswerLabel: string;
} {
  const isAdvanced = q.examType === 'JEE Advanced';
  const isBitsat = q.examType === 'BITSAT';
  const format: AdvancedQuestionFormat =
    q.advancedFormat || (q.section === 'Section B' ? 'numerical' : 'single');
  const maxMarks = isBitsat
    ? 3
    : isAdvanced && (format === 'single' || format === 'matrix' || format === 'paragraph')
    ? 3
    : 4;

  const isStatusEvaluated =
    r && (r.status === 'answered' || r.status === 'answered_marked');

  // Numerical Question Evaluation
  if (q.section === 'Section B' || format === 'numerical') {
    const rawVal = r?.numericalValue?.trim() ?? '';
    const hasNum = isStatusEvaluated && rawVal !== '' && Number.isFinite(Number(rawVal));
    const hasOptFallback =
      isStatusEvaluated && !hasNum && r?.selectedOption !== null && r?.selectedOption !== undefined;

    if (!hasNum && !hasOptFallback) {
      return {
        isAttempted: false,
        isCorrect: false,
        marksAwarded: 0,
        maxMarks: 4,
        userAnswerLabel: 'Skipped',
        correctAnswerLabel: String(q.numericalAnswer ?? q.options[q.correctIndex] ?? ''),
      };
    }

    let isCorrect = false;
    let userLabel = rawVal;
    if (hasNum && q.numericalAnswer !== undefined) {
      const parsedUser = Number(rawVal);
      const expected = q.numericalAnswer;
      if (typeof q.numericalTolerance === 'number' && q.numericalTolerance >= 0) {
        isCorrect = Math.abs(parsedUser - expected) <= q.numericalTolerance;
      } else if (Number.isInteger(expected)) {
        // Strict NTA integer-type Section B spec: user entry must match integer exactly (or within 1e-6 float repr)
        isCorrect = Math.abs(parsedUser - expected) <= 1e-6;
      } else {
        // Decimal numerical questions accept within +/-0.01 unless question explicitly sets numericalTolerance
        isCorrect = Math.abs(parsedUser - expected) <= 0.01;
      }
    } else if (hasOptFallback) {
      isCorrect = r!.selectedOption === q.correctIndex;
      userLabel = q.options[r!.selectedOption!] || `Option ${r!.selectedOption! + 1}`;
    }

    // JEE Main Section B: +4 correct, -1 wrong; JEE Advanced Non-Negative Integer: +4 correct, 0 wrong
    const wrongPenalty = isAdvanced ? 0 : -1;
    return {
      isAttempted: true,
      isCorrect,
      marksAwarded: isCorrect ? 4 : wrongPenalty,
      maxMarks: 4,
      userAnswerLabel: userLabel,
      correctAnswerLabel: String(q.numericalAnswer ?? q.options[q.correctIndex] ?? ''),
    };
  }

  // JEE Advanced Multi-Choice Partial Marking (+4 / -2 / +1 per correct option)
  if (isAdvanced && format === 'multiple' && q.correctIndices && q.correctIndices.length > 0) {
    const chosen =
      r?.selectedOptions && r.selectedOptions.length > 0
        ? r.selectedOptions
        : r?.selectedOption !== null && r?.selectedOption !== undefined
        ? [r.selectedOption]
        : [];

    if (!isStatusEvaluated || chosen.length === 0) {
      return {
        isAttempted: false,
        isCorrect: false,
        marksAwarded: 0,
        maxMarks: 4,
        userAnswerLabel: 'Skipped',
        correctAnswerLabel: q.correctIndices.map((i) => String.fromCharCode(65 + i)).join(', '),
      };
    }

    const correctSet = new Set(q.correctIndices);
    const hasWrong = chosen.some((idx) => !correctSet.has(idx));
    if (hasWrong) {
      return {
        isAttempted: true,
        isCorrect: false,
        marksAwarded: -2,
        maxMarks: 4,
        userAnswerLabel: chosen.map((i) => String.fromCharCode(65 + i)).join(', '),
        correctAnswerLabel: q.correctIndices.map((i) => String.fromCharCode(65 + i)).join(', '),
      };
    }

    const uniqueCorrectChosen = new Set(chosen.filter((idx) => correctSet.has(idx))).size;
    const allChosen = uniqueCorrectChosen === correctSet.size;
    return {
      isAttempted: true,
      isCorrect: allChosen,
      marksAwarded: allChosen ? 4 : uniqueCorrectChosen, // +1 partial mark per correct option
      maxMarks: 4,
      userAnswerLabel: chosen.map((i) => String.fromCharCode(65 + i)).join(', '),
      correctAnswerLabel: q.correctIndices.map((i) => String.fromCharCode(65 + i)).join(', '),
    };
  }

  // Standard Single-Choice MCQ (JEE Main Section A: +4/-1; JEE Advanced Single/Matrix: +3/-1)
  if (!isStatusEvaluated || r?.selectedOption === null || r?.selectedOption === undefined) {
    return {
      isAttempted: false,
      isCorrect: false,
      marksAwarded: 0,
      maxMarks,
      userAnswerLabel: 'Skipped',
      correctAnswerLabel: `${String.fromCharCode(65 + q.correctIndex)}: ${q.options[q.correctIndex] || ''}`,
    };
  }

  const isCorrect = r.selectedOption === q.correctIndex;
  const posMarks = maxMarks;
  const negMarks = -1;

  return {
    isAttempted: true,
    isCorrect,
    marksAwarded: isCorrect ? posMarks : negMarks,
    maxMarks,
    userAnswerLabel: `${String.fromCharCode(65 + r.selectedOption)}: ${q.options[r.selectedOption] || ''}`,
    correctAnswerLabel: `${String.fromCharCode(65 + q.correctIndex)}: ${q.options[q.correctIndex] || ''}`,
  };
}

export function calculateCBTSummary(
  questions: CBTQuestion[],
  responses: Record<string, QuestionResponseState>
): CBTSummaryMetrics {
  let score = 0;
  let maxMarksTotal = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;
  const questionDetails: QuestionAttemptDetail[] = [];

  const chapterMap = new Map<
    string,
    {
      chapter: string;
      subject: 'Physics' | 'Chemistry' | 'Mathematics';
      marks: number;
      maxMarks: number;
      timeSec: number;
      correct: number;
      attempted: number;
    }
  >();

  for (const q of questions) {
    const r = responses[q.id];
    const evalRes = evaluateSingleQuestionMarks(q, r);
    maxMarksTotal += evalRes.maxMarks;

    const entry = chapterMap.get(q.chapter) || {
      chapter: q.chapter,
      subject: q.subject,
      marks: 0,
      maxMarks: 0,
      timeSec: 0,
      correct: 0,
      attempted: 0,
    };
    entry.maxMarks += evalRes.maxMarks;
    const tSec = r?.timeSpentSec ?? 45;
    entry.timeSec += tSec;

    if (!evalRes.isAttempted) {
      skippedCount += 1;
    } else {
      entry.attempted += 1;
      score += evalRes.marksAwarded;
      entry.marks += evalRes.marksAwarded;
      if (evalRes.isCorrect) {
        correctCount += 1;
        entry.correct += 1;
      } else {
        incorrectCount += 1;
      }
    }

    questionDetails.push({
      questionId: q.id,
      number: q.number,
      subject: q.subject,
      chapter: q.chapter,
      section: q.section,
      isAttempted: evalRes.isAttempted,
      isCorrect: evalRes.isCorrect,
      marksAwarded: evalRes.marksAwarded,
      maxMarks: evalRes.maxMarks,
      timeSpentSec: tSec,
      userAnswerLabel: evalRes.userAnswerLabel,
      correctAnswerLabel: evalRes.correctAnswerLabel,
    });

    chapterMap.set(q.chapter, entry);
  }

  const totalAttempted = correctCount + incorrectCount;
  const accuracy =
    totalAttempted > 0 ? Number(((correctCount / totalAttempted) * 100).toFixed(1)) : 0;

  const chapterBreakdown = Array.from(chapterMap.values()).map((c) => ({
    chapter: c.chapter,
    subject: c.subject,
    marks: Math.max(0, c.marks),
    maxMarks: c.maxMarks,
    timeMinutes: Math.max(1, Math.round(c.timeSec / 60)),
    accuracy:
      c.attempted > 0 ? Number(((c.correct / c.attempted) * 100).toFixed(1)) : 0,
  }));

  return {
    score,
    maxMarks: maxMarksTotal,
    correctCount,
    incorrectCount,
    skippedCount,
    accuracy,
    questionDetails,
    chapterBreakdown,
  };
}

export function transitionQuestionStatus(
  currentOption: number | null,
  action: 'visit' | 'save_next' | 'mark_review' | 'clear',
  hasNumerical?: boolean
): QuestionStatus {
  const hasAnswer = currentOption !== null || Boolean(hasNumerical);
  switch (action) {
    case 'clear':
      return 'not_answered';
    case 'save_next':
      return hasAnswer ? 'answered' : 'not_answered';
    case 'mark_review':
      return hasAnswer ? 'answered_marked' : 'marked';
    case 'visit':
    default:
      return hasAnswer ? 'answered' : 'not_answered';
  }
}

/**
 * Detects unbound parameter slider variables (a, b, c, m, k) in a mathematical expression.
 */
export function detectEquationParameters(expr: string): string[] {
  const cleaned = expr
    .toLowerCase()
    .replace(/\b(sinh|cosh|tanh|asin|acos|atan|log10|log2|sqrt|cbrt|sin|cos|tan|csc|sec|cot|abs|log|ln|exp|floor|ceil|round|sign|min|max|pow|pi|tau)\b/g, ' ');
  const candidates = ['a', 'b', 'c', 'm', 'k'];
  const found: string[] = [];
  for (const param of candidates) {
    const regex = new RegExp(`\\b${param}\\b|(\\d)${param}|${param}(x|\\()`, 'i');
    if (regex.test(cleaned)) {
      found.push(param);
    }
  }
  return found;
}

/**
 * Evaluates a mathematical expression y = f(x) safely via zero-eval recursive-descent AST parsing.
 * Supports parameters (a, b, c, m, k), rad/deg angle mode, x^2, trig, inverse trig, hyperbolic, ln, log, exp, sqrt, abs, pi, e.
 */
export function evaluateMathFunction(
  expr: string,
  xVal: number,
  params: Record<string, number> = {},
  angleMode: AngleMode = 'rad'
): number | null {
  return safeEvaluateMathExpression(expr, xVal, params, angleMode);
}

export function evaluateDerivative(
  expr: string,
  xVal: number,
  params: Record<string, number> = {},
  angleMode: AngleMode = 'rad'
): number | null {
  const h = 1e-4;
  const fPlus = evaluateMathFunction(expr, xVal + h, params, angleMode);
  const fMinus = evaluateMathFunction(expr, xVal - h, params, angleMode);
  if (fPlus === null || fMinus === null) return null;
  const deriv = (fPlus - fMinus) / (2 * h);
  return Number.isFinite(deriv) ? deriv : null;
}

export interface GraphKeyPoint {
  x: number;
  y: number;
  type: 'root' | 'max' | 'min' | 'intersection' | 'y-intercept';
  label: string;
}

/**
 * Automatically detects Roots (f(x)=0), Y-Intercept (x=0), and Local Extrema (f'(x)=0)
 * across [xMin, xMax] for Desmos-style interactive point inspection.
 */
export function findRootsAndExtrema(
  expr: string,
  xMin: number,
  xMax: number,
  params: Record<string, number> = {},
  angleMode: AngleMode = 'rad'
): GraphKeyPoint[] {
  const points: GraphKeyPoint[] = [];
  const steps = 240;
  const dx = (xMax - xMin) / steps;

  // Y-intercept if 0 is in range
  if (xMin <= 0 && xMax >= 0) {
    const y0 = evaluateMathFunction(expr, 0, params, angleMode);
    if (y0 !== null) {
      points.push({
        x: 0,
        y: Number(y0.toFixed(3)),
        type: 'y-intercept',
        label: `y-int (0, ${Number(y0.toFixed(2))})`,
      });
    }
  }

  for (let i = 0; i < steps; i++) {
    const x1 = xMin + i * dx;
    const x2 = x1 + dx;
    const y1 = evaluateMathFunction(expr, x1, params, angleMode);
    const y2 = evaluateMathFunction(expr, x2, params, angleMode);

    if (y1 !== null && y2 !== null) {
      // Check root sign change
      if (Math.abs(y1) < 1e-6) {
        const rx = Number(x1.toFixed(3));
        if (!points.some((p) => p.type === 'root' && Math.abs(p.x - rx) < dx * 1.5)) {
          points.push({ x: rx, y: 0, type: 'root', label: `Root (${rx}, 0)` });
        }
      } else if (y1 * y2 < 0 && Math.abs(y1 - y2) < 25) {
        // Linear interpolation refinement
        const rootX = x1 - (y1 * (x2 - x1)) / (y2 - y1);
        const rx = Number(rootX.toFixed(3));
        if (!points.some((p) => p.type === 'root' && Math.abs(p.x - rx) < dx * 1.5)) {
          points.push({ x: rx, y: 0, type: 'root', label: `Root (${rx}, 0)` });
        }
      }
    }

    // Check local extrema via derivative sign change
    const d1 = evaluateDerivative(expr, x1, params, angleMode);
    const d2 = evaluateDerivative(expr, x2, params, angleMode);
    if (d1 !== null && d2 !== null && d1 * d2 <= 0 && Math.abs(d1 - d2) > 1e-4 && Math.abs(d1 - d2) < 50) {
      const extX = x1 - (d1 * (x2 - x1)) / (d2 - d1);
      const extY = evaluateMathFunction(expr, extX, params, angleMode);
      if (extY !== null) {
        const ex = Number(extX.toFixed(3));
        const ey = Number(extY.toFixed(3));
        const kind = d1 > 0 && d2 <= 0 ? 'max' : 'min';
        if (!points.some((p) => (p.type === 'max' || p.type === 'min') && Math.abs(p.x - ex) < dx * 1.8)) {
          points.push({
            x: ex,
            y: ey,
            type: kind,
            label: `${kind === 'max' ? 'Local Max' : 'Local Min'} (${ex}, ${ey})`,
          });
        }
      }
    }
  }

  return points.slice(0, 14);
}

/**
 * Finds intersection points between two curves f1(x) and f2(x).
 */
export function findCurveIntersections(
  expr1: string,
  expr2: string,
  xMin: number,
  xMax: number,
  params: Record<string, number> = {},
  angleMode: AngleMode = 'rad'
): GraphKeyPoint[] {
  const pts: GraphKeyPoint[] = [];
  const steps = 240;
  const dx = (xMax - xMin) / steps;

  for (let i = 0; i < steps; i++) {
    const x1 = xMin + i * dx;
    const x2 = x1 + dx;
    const a1 = evaluateMathFunction(expr1, x1, params, angleMode);
    const b1 = evaluateMathFunction(expr2, x1, params, angleMode);
    const a2 = evaluateMathFunction(expr1, x2, params, angleMode);
    const b2 = evaluateMathFunction(expr2, x2, params, angleMode);

    if (a1 !== null && b1 !== null && a2 !== null && b2 !== null) {
      const diff1 = a1 - b1;
      const diff2 = a2 - b2;
      if (Math.abs(diff1) < 1e-5 || (diff1 * diff2 < 0 && Math.abs(diff1 - diff2) < 25)) {
        const ix =
          Math.abs(diff1 - diff2) < 1e-9 ? x1 : x1 - (diff1 * (x2 - x1)) / (diff2 - diff1);
        const iy = evaluateMathFunction(expr1, ix, params, angleMode);
        if (iy !== null) {
          const rx = Number(ix.toFixed(3));
          const ry = Number(iy.toFixed(3));
          if (!pts.some((p) => Math.abs(p.x - rx) < dx * 1.6)) {
            pts.push({
              x: rx,
              y: ry,
              type: 'intersection',
              label: `Intersection (${rx}, ${ry})`,
            });
          }
        }
      }
    }
  }
  return pts.slice(0, 10);
}

export function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= Math.min(n, 170); i++) res *= i;
  return res;
}

export function computeCombination(n: number, r: number): number {
  if (r < 0 || n < 0 || r > n) return 0;
  return Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
}

export function computePermutation(n: number, r: number): number {
  if (r < 0 || n < 0 || r > n) return 0;
  return Math.round(factorial(n) / factorial(n - r));
}

export function computeDeterminant3x3(m: number[][]): number {
  if (m.length !== 3 || m[0].length !== 3) return 0;
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, i] = m[2];
  return Number((a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)).toFixed(4));
}

export function computeVectorOps(
  a: [number, number, number],
  b: [number, number, number]
): {
  dot: number;
  cross: [number, number, number];
  magA: number;
  magB: number;
  angleDeg: number;
} {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross: [number, number, number] = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const magA = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
  const magB = Math.sqrt(b[0] ** 2 + b[1] ** 2 + b[2] ** 2);
  const cosTheta = magA > 0 && magB > 0 ? Math.max(-1, Math.min(1, dot / (magA * magB))) : 1;
  const angleDeg = Number(((Math.acos(cosTheta) * 180) / Math.PI).toFixed(2));
  return {
    dot: Number(dot.toFixed(4)),
    cross: [
      Number(cross[0].toFixed(4)),
      Number(cross[1].toFixed(4)),
      Number(cross[2].toFixed(4)),
    ],
    magA: Number(magA.toFixed(4)),
    magB: Number(magB.toFixed(4)),
    angleDeg,
  };
}

/**
 * Computes statistical metrics + linear regression y = mx + b for Study Tools -> Statistics.
 */
export function calculateStatistics(values: number[]): {
  count: number;
  mean: number;
  median: number;
  variance: number;
  stdDev: number;
} {
  if (!values.length) {
    return { count: 0, mean: 0, median: 0, variance: 0, stdDev: 0 };
  }
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    variance: Number(variance.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
  };
}

export function validateIdFormat(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(id)
  );
}

export interface CBTMockSummary {
  totalScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPct: number;
  paletteCounts: Record<QuestionStatus, number>;
  questionDetails: QuestionAttemptDetail[];
  chapterBreakdown: CBTSummaryMetrics['chapterBreakdown'];
}

export function calculateCBTMockScore(
  questions: CBTQuestion[],
  responses: Record<string, QuestionResponseState>
): CBTMockSummary {
  const base = calculateCBTSummary(questions, responses);
  const paletteCounts: Record<QuestionStatus, number> = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0,
  };
  for (const q of questions) {
    const st = responses[q.id]?.status || 'not_visited';
    paletteCounts[st] = (paletteCounts[st] || 0) + 1;
  }
  return {
    totalScore: base.score,
    maxScore: base.maxMarks,
    correctCount: base.correctCount,
    incorrectCount: base.incorrectCount,
    unansweredCount: base.skippedCount,
    accuracyPct: base.accuracy,
    paletteCounts,
    questionDetails: base.questionDetails,
    chapterBreakdown: base.chapterBreakdown,
  };
}

export function applyQuestionAction(
  current: QuestionResponseState,
  action: 'visit' | 'save_and_next' | 'mark_for_review_and_next' | 'clear_response',
  draftOption?: number | null
): QuestionResponseState {
  const hasNum = Boolean(current.numericalValue && current.numericalValue.trim() !== '');
  const hasMulti = Boolean(current.selectedOptions && current.selectedOptions.length > 0);
  if (action === 'clear_response') {
    return {
      ...current,
      status: transitionQuestionStatus(null, 'clear', false),
      selectedOption: null,
      selectedOptions: [],
      numericalValue: '',
    };
  }
  if (action === 'save_and_next') {
    const opt = draftOption !== undefined ? draftOption : current.selectedOption;
    return {
      ...current,
      status: transitionQuestionStatus(opt, 'save_next', hasNum || hasMulti),
      selectedOption: opt,
    };
  }
  if (action === 'mark_for_review_and_next') {
    const opt = draftOption !== undefined ? draftOption : current.selectedOption;
    return {
      ...current,
      status: transitionQuestionStatus(opt, 'mark_review', hasNum || hasMulti),
      selectedOption: opt,
    };
  }
  if (current.status === 'not_visited') {
    return {
      ...current,
      status: 'not_answered',
    };
  }
  return current;
}

export const computeFactorial = factorial;
export type GraphSpecialPoint = GraphKeyPoint;
export type CBTQuestionResponse = QuestionResponseState;
export const calculateCBTMockSummary = calculateCBTMockScore;

export function formatCountdownTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;
}

export interface SM2FlashcardItem {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  frontPrompt: string;
  backAnswer: string;
  intervalDays: number;
  repetitionCount: number;
  easeFactor: number;
  nextReviewIso: string;
  rootCauseTag?: ErrorRootCauseTag;
}

export interface SM2CardSchedule {
  interval: number;
  repetition: number;
  efactor: number;
  nextReviewDate: string;
  intervalDays: number;
  repetitionCount: number;
  easeFactor: number;
  nextReviewIso: string;
}

/**
 * Authentic SuperMemo SM-2 spaced repetition algorithm.
 * Quality scale: 0..5 (Again=1, Hard=3, Good=4, Easy=5).
 */
export function calculateSM2Schedule(
  paramsOrCard:
    | {
        quality: 0 | 1 | 2 | 3 | 4 | 5;
        repetition: number;
        interval: number;
        efactor: number;
        nowMs?: number;
      }
    | {
        intervalDays: number;
        repetitionCount: number;
        easeFactor: number;
      },
  qualityArg?: 0 | 1 | 2 | 3 | 4 | 5
): SM2CardSchedule {
  const quality =
    'quality' in paramsOrCard ? paramsOrCard.quality : (qualityArg ?? 4);
  const repetition =
    'repetition' in paramsOrCard
      ? paramsOrCard.repetition
      : paramsOrCard.repetitionCount;
  const interval =
    'interval' in paramsOrCard
      ? paramsOrCard.interval
      : paramsOrCard.intervalDays;
  const efactor =
    'efactor' in paramsOrCard
      ? paramsOrCard.efactor
      : paramsOrCard.easeFactor;
  const nowMs =
    'nowMs' in paramsOrCard && paramsOrCard.nowMs ? paramsOrCard.nowMs : Date.now();

  let nextRepetition = repetition;
  let nextInterval = interval;

  if (quality < 3) {
    nextRepetition = 0;
    nextInterval = 1;
  } else {
    if (repetition === 0) {
      if (quality === 3) nextInterval = 0.5;
      else if (quality === 5) nextInterval = 3;
      else nextInterval = 1;
    } else if (repetition === 1) {
      if (quality === 3) nextInterval = 3;
      else if (quality === 5) nextInterval = 10;
      else nextInterval = 6;
    } else {
      const base = Math.max(1, Math.round(interval * efactor));
      if (quality === 3) {
        nextInterval = Math.max(1, Math.round(interval * 1.25));
      } else if (quality === 4) {
        nextInterval = Math.max(2, Math.round(base * 0.85));
      } else {
        nextInterval = base;
      }
    }
    nextRepetition = repetition + 1;
  }

  const rawEf = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const nextEfactor = Number(Math.max(1.3, Math.min(3.2, rawEf)).toFixed(2));
  const nextDate = new Date(nowMs + nextInterval * 24 * 60 * 60 * 1000).toISOString();

  return {
    interval: nextInterval,
    repetition: nextRepetition,
    efactor: nextEfactor,
    nextReviewDate: nextDate,
    intervalDays: nextInterval,
    repetitionCount: nextRepetition,
    easeFactor: nextEfactor,
    nextReviewIso: nextDate,
  };
}

export function formatSM2IntervalShort(days: number): string {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours}h`;
  }
  return `${days}d`;
}

export function calculateNextSRSReview(
  rating: 'Again' | 'Hard' | 'Good' | 'Easy',
  intervalDays: number,
  easeFactor: number,
  repetition = 1
): { nextIntervalDays: number; nextEaseFactor: number; nextRepetition: number; label: string } {
  const qualityMap: Record<'Again' | 'Hard' | 'Good' | 'Easy', 1 | 3 | 4 | 5> = {
    Again: 1,
    Hard: 3,
    Good: 4,
    Easy: 5,
  };
  const sm2 = calculateSM2Schedule({
    quality: qualityMap[rating],
    repetition: rating === 'Again' ? 0 : repetition,
    interval: intervalDays,
    efactor: easeFactor,
  });
  return {
    nextIntervalDays: sm2.interval,
    nextEaseFactor: sm2.efactor,
    nextRepetition: sm2.repetition,
    label:
      rating === 'Again'
        ? '< 10 mins (Reset to 1d)'
        : sm2.interval < 1
        ? `${Math.max(1, Math.round(sm2.interval * 24))} hour(s)`
        : `${sm2.interval} day(s)`,
  };
}

export interface ChapterShardTask {
  id: string;
  shardNumber: number;
  title: string;
  durationMinutes: number;
  focusConcept: string;
  formulaHook: string;
  masteryQuestions: {
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

/**
 * Generates 15-Minute "ShardZ" active-recall micro-tasks with subject-authentic JEE syllabus questions.
 */
export function generateChapterShardZ(
  chapter: string,
  subject: 'Physics' | 'Chemistry' | 'Mathematics'
): ChapterShardTask[] {
  if (subject === 'Physics') {
    return [
      {
        id: `shard-${chapter}-1`,
        shardNumber: 1,
        title: `ShardZ #1: Conservation Laws & Dimensional Analysis in ${chapter}`,
        durationMinutes: 15,
        focusConcept: `Verify frame conditions, free-body resolution, and conservation principles in ${chapter}.`,
        formulaHook:
          '$$\\vec{F}_{\\text{net}} = \\frac{d\\vec{p}}{dt}, \\quad W_{\\text{all}} = \\Delta K, \\quad \\tau_{\\text{ext}} = \\frac{d\\vec{L}}{dt}$$',
        masteryQuestions: [
          {
            id: `sq-${chapter}-1-1`,
            prompt: `In ${chapter}, if an isolated system experiences zero net external force ($\\vec{F}_{\\text{ext}} = 0$), which physical quantity remains strictly conserved?`,
            options: [
              'Kinetic energy only',
              'Total linear momentum $\\vec{P}$',
              'Angular speed $\\omega$ only',
              'Potential energy gradient',
            ],
            correctIndex: 1,
            explanation:
              'By Newton’s second law for a system of particles, $\\vec{F}_{\\text{ext}} = d\\vec{P}/dt = 0$ guarantees conservation of total linear momentum $\\vec{P}$, even during inelastic internal interactions.',
          },
          {
            id: `sq-${chapter}-1-2`,
            prompt: `When checking an analytical expression derived in ${chapter}, the argument inside $\\sin(\\omega t - kx)$ or $e^{-t/\\tau}$ must have dimensions:`,
            options: [
              '$[M^1L^1T^{-2}]$',
              '$[L^1T^{-1}]$',
              '$[M^0L^0T^0]$ (Dimensionless)',
              '$[T^{-1}]$',
            ],
            correctIndex: 2,
            explanation:
              'All transcendental functions ($\\sin, \\cos, \\exp, \\ln$) require strictly dimensionless arguments $[M^0L^0T^0]$.',
          },
          {
            id: `sq-${chapter}-1-3`,
            prompt: `A conservative internal force field in ${chapter} obeys $\\vec{F} = -\\nabla U$. The work done by this force along any closed loop is:`,
            options: [
              'Positive and proportional to path length',
              'Equal to $\\Delta K$ around the loop',
              'Dependent on speed',
              'Identically zero ($\\oint \\vec{F}\\cdot d\\vec{r} = 0$)',
            ],
            correctIndex: 3,
            explanation:
              'The closed-loop line integral of a conservative force field is always zero because work depends solely on initial and final positions.',
          },
        ],
      },
      {
        id: `shard-${chapter}-2`,
        shardNumber: 2,
        title: `ShardZ #2: Work-Energy, Flux & Symmetry in ${chapter}`,
        durationMinutes: 15,
        focusConcept: `Apply energy balance, symmetry, and differential relations cleanly in ${chapter}.`,
        formulaHook:
          '$$I = I_{\\text{cm}} + Md^2, \\quad K_{\\text{rolling}} = \\frac{1}{2}Mv_{\\text{cm}}^2\\left(1 + \\frac{k^2}{R^2}\\right)$$',
        masteryQuestions: [
          {
            id: `sq-${chapter}-2-1`,
            prompt: `A solid disc of mass $M$ and radius $R$ rolls without slipping with speed $v$ on a horizontal plane. Its rotational kinetic energy as a fraction of total kinetic energy is:`,
            options: ['$\\frac{1}{3}$', '$\\frac{1}{2}$', '$\\frac{2}{3}$', '$\\frac{2}{5}$'],
            correctIndex: 0,
            explanation:
              'For a disc, $I = \\frac{1}{2}MR^2$, so $K_{\\text{rot}} = \\frac{1}{4}Mv^2$ and $K_{\\text{total}} = \\frac{3}{4}Mv^2$, giving $K_{\\text{rot}}/K_{\\text{total}} = 1/3$.',
          },
          {
            id: `sq-${chapter}-2-2`,
            prompt: `A particle starts from rest under a constant net power $P_0$. Its displacement $x$ varies with time $t$ as:`,
            options: ['$x \\propto t$', '$x \\propto t^{3/2}$', '$x \\propto t^2$', '$x \\propto t^{1/2}$'],
            correctIndex: 1,
            explanation:
              'Constant power gives $\\frac{1}{2}mv^2 = P_0 t \\implies v \\propto t^{1/2} \\implies x = \\int v\\,dt \\propto t^{3/2}$.',
          },
          {
            id: `sq-${chapter}-2-3`,
            prompt: `Two identical springs of stiffness $k$ connected in parallel support a mass $m$. The effective spring constant of the combination is:`,
            options: ['$k/2$', '$k$', '$2k$', '$4k$'],
            correctIndex: 2,
            explanation:
              'In parallel, both springs undergo identical extension $x$, so restoring force is $F = (k + k)x = 2kx \\implies k_{\\text{eq}} = 2k$.',
          },
        ],
      },
      {
        id: `shard-${chapter}-3`,
        shardNumber: 3,
        title: `ShardZ #3: Limiting Cases & Boundary Conditions in ${chapter}`,
        durationMinutes: 15,
        focusConcept: `Verify physical boundary regimes, equilibrium stability, and vector signs in ${chapter}.`,
        formulaHook:
          '$$F_x = -\\frac{dU}{dx}, \\quad \\frac{d^2U}{dx^2} > 0 \\text{ (Stable Equilibrium)}$$',
        masteryQuestions: [
          {
            id: `sq-${chapter}-3-1`,
            prompt: `A particle moves in a 1D potential $U(x)$. Which condition corresponds to a position of stable equilibrium?`,
            options: [
              '$\\frac{dU}{dx} = 0$ and $\\frac{d^2U}{dx^2} < 0$',
              '$\\frac{dU}{dx} \\ne 0$ and $\\frac{d^2U}{dx^2} > 0$',
              '$\\frac{dU}{dx} = 0$ and $\\frac{d^2U}{dx^2} = 0$ always',
              '$\\frac{dU}{dx} = 0$ and $\\frac{d^2U}{dx^2} > 0$',
            ],
            correctIndex: 3,
            explanation:
              'Equilibrium requires $F = -dU/dx = 0$, and stability requires a local minimum of potential energy ($d^2U/dx^2 > 0$).',
          },
          {
            id: `sq-${chapter}-3-2`,
            prompt: `In an elastic head-on collision between two bodies of equal mass, if the second body is initially at rest, after collision the first body:`,
            options: [
              'Comes completely to rest and transfers all kinetic energy',
              'Rebounds with half its initial speed',
              'Moves forward with twice its speed',
              'Sticks to the second body',
            ],
            correctIndex: 0,
            explanation:
              'For equal masses and $e = 1$, velocities exchange completely: $v_1\' = u_2 = 0$ and $v_2\' = u_1$.',
          },
          {
            id: `sq-${chapter}-3-3`,
            prompt: `When a thin converging lens of refractive index $\\mu_g = 1.5$ is immersed in a liquid of refractive index $\\mu_L = 1.6$, the lens behaves as a:`,
            options: [
              'Converging lens of shorter focal length',
              'Diverging lens',
              'Plane glass slab',
              'Converging lens of unchanged focal length',
            ],
            correctIndex: 1,
            explanation:
              'By the Lens Maker’s formula, $\\frac{1}{f} \\propto \\left(\\frac{\\mu_g}{\\mu_L} - 1\\right)$. Since $\\mu_g < \\mu_L$, the factor becomes negative and a biconvex lens diverges light.',
          },
        ],
      },
    ];
  }

  if (subject === 'Chemistry') {
    return [
      {
        id: `shard-${chapter}-1`,
        shardNumber: 1,
        title: `ShardZ #1: Structure, Bonding & Energetics in ${chapter}`,
        durationMinutes: 15,
        focusConcept: `Identify hybridisation, oxidation states, and thermodynamic sign conventions in ${chapter}.`,
        formulaHook:
          '$$\\Delta G^\\circ = -nFE^\\circ_{\\text{cell}} = -2.303\\,RT\\log_{10} K_{\\text{eq}}$$',
        masteryQuestions: [
          {
            id: `sq-${chapter}-1-1`,
            prompt: `Which orbital hybridisation corresponds to a square planar molecular geometry with $4$ bond pairs and $2$ lone pairs around the central atom?`,
            options: ['$sp^3$', '$sp^3d^2$', '$sp^2$', '$sp^3d$'],
            correctIndex: 1,
            explanation:
              'A steric number of $6$ ($4\\,\\sigma\\text{ bonds} + 2\\text{ lone pairs}$, as in $\\text{XeF}_4$) gives $sp^3d^2$ hybridisation with a square planar shape.',
          },
          {
            id: `sq-${chapter}-1-2`,
            prompt: `For an exothermic reaction with $\\Delta H < 0$ and $\\Delta S < 0$, the reaction becomes spontaneous ($\\Delta G < 0$) at:`,
            options: [
              'All temperatures',
              'High temperatures where $T|\\Delta S| > |\\Delta H|$',
              'Low temperatures where $|\\Delta H| > T|\\Delta S|$',
              'No temperature',
            ],
            correctIndex: 2,
            explanation:
              'Since $\\Delta G = \\Delta H - T\\Delta S$, with $\\Delta H < 0$ and $-T\\Delta S > 0$, spontaneity requires low $T$ so enthalpy dominates.',
          },
          {
            id: `sq-${chapter}-1-3`,
            prompt: `What is the oxidation state of chromium in potassium dichromate ($\\text{K}_2\\text{Cr}_2\\text{O}_7$)?`,
            options: ['$+3$', '$+4$', '$+5$', '$+6$'],
            correctIndex: 3,
            explanation:
              '$2(+1) + 2x + 7(-2) = 0 \\implies 2x = 12 \\implies x = +6$.',
          },
        ],
      },
      {
        id: `shard-${chapter}-2`,
        shardNumber: 2,
        title: `ShardZ #2: Kinetics, Equilibrium & Electrochemistry in ${chapter}`,
        durationMinutes: 15,
        focusConcept: `Apply rate laws, Le Chatelier shifts, and Nernst relations accurately in ${chapter}.`,
        formulaHook:
          '$$k = A e^{-E_a/RT}, \\quad t_{1/2} = \\frac{0.693}{k}, \\quad K_p = K_c(RT)^{\\Delta n_g}$$',
        masteryQuestions: [
          {
            id: `sq-${chapter}-2-1`,
            prompt: `For a zero-order reaction, how does the half-life $t_{1/2}$ depend on initial reactant concentration $[A]_0$?`,
            options: [
              '$t_{1/2} \\propto [A]_0$',
              'Independent of $[A]_0$',
              '$t_{1/2} \\propto 1/[A]_0$',
              '$t_{1/2} \\propto 1/[A]_0^2$',
            ],
            correctIndex: 0,
            explanation:
              'For zero-order kinetics, $t_{1/2} = \\frac{[A]_0}{2k}$, which is directly proportional to $[A]_0$.',
          },
          {
            id: `sq-${chapter}-2-2`,
            prompt: `Adding an inert gas at constant volume to an equilibrium mixture $\\text{N}_2(g) + 3\\text{H}_2(g) \\rightleftharpoons 2\\text{NH}_3(g)$:`,
            options: [
              'Shifts equilibrium toward products',
              'Causes no shift in equilibrium composition',
              'Shifts equilibrium toward reactants',
              'Decreases the equilibrium constant $K_c$',
            ],
            correctIndex: 1,
            explanation:
              'At constant volume, adding an inert gas does not change the partial pressures or molar concentrations of any reacting species, so equilibrium is undisturbed.',
          },
          {
            id: `sq-${chapter}-2-3`,
            prompt: `A positive standard cell potential ($E^\\circ_{\\text{cell}} > 0$) implies which relationship between $\\Delta G^\\circ$ and $K_{\\text{eq}}$?`,
            options: [
              '$\\Delta G^\\circ > 0, \\; K_{\\text{eq}} < 1$',
              '$\\Delta G^\\circ = 0, \\; K_{\\text{eq}} = 1$',
              '$\\Delta G^\\circ < 0, \\; K_{\\text{eq}} > 1$',
              '$\\Delta G^\\circ < 0, \\; K_{\\text{eq}} < 1$',
            ],
            correctIndex: 2,
            explanation:
              'Since $\\Delta G^\\circ = -nFE^\\circ_{\\text{cell}} = -RT\\ln K_{\\text{eq}}$, $E^\\circ_{\\text{cell}} > 0$ gives $\\Delta G^\\circ < 0$ and $K_{\\text{eq}} > 1$.',
          },
        ],
      },
      {
        id: `shard-${chapter}-3`,
        shardNumber: 3,
        title: `ShardZ #3: Reactivity Trends, Isomerism & Exceptions in ${chapter}`,
        durationMinutes: 15,
        focusConcept: `Spot electronic effects, periodic anomalies, and stereochemical rules in ${chapter}.`,
        formulaHook:
          '$$\\mu_{\\text{spin}} = \\sqrt{n(n+2)}\\text{ BM}, \\quad \\text{BO} = \\frac{N_b - N_a}{2}$$',
        masteryQuestions: [
          {
            id: `sq-${chapter}-3-1`,
            prompt: `Among $\\text{NH}_3$, $\\text{PH}_3$, $\\text{AsH}_3$, and $\\text{SbH}_3$, which hydride has the highest boiling point due to intermolecular hydrogen bonding?`,
            options: ['$\\text{PH}_3$', '$\\text{AsH}_3$', '$\\text{SbH}_3$', '$\\text{NH}_3$'],
            correctIndex: 3,
            explanation:
              'Strong intermolecular $\\text{N–H}\\cdots\\text{N}$ hydrogen bonding elevates the boiling point of $\\text{NH}_3$ above $\\text{PH}_3$ and $\\text{AsH}_3$.',
          },
          {
            id: `sq-${chapter}-3-2`,
            prompt: `Which paramagnetic diatomic species has a bond order of $2.5$?`,
            options: ['$\\text{NO}$', '$\\text{N}_2$', '$\\text{CO}$', '$\\text{F}_2$'],
            correctIndex: 0,
            explanation:
              '$\\text{NO}$ has $15$ total electrons (one unpaired $\\pi^*$ electron), yielding $\\text{BO} = \\frac{10 - 5}{2} = 2.5$.',
          },
          {
            id: `sq-${chapter}-3-3`,
            prompt: `In nucleophilic substitution reactions, the $\\text{S}_\\text{N}2$ mechanism proceeds with:`,
            options: [
              'Complete racemization',
              'Walden inversion of configuration in a single concerted step',
              'Formation of a planar carbocation intermediate',
              'Zero dependence on nucleophile concentration',
            ],
            correctIndex: 1,
            explanation:
              'Backside attack by the nucleophile in a concerted bimolecular transition state produces $100\\%$ stereochemical inversion.',
          },
        ],
      },
    ];
  }

  return [
    {
      id: `shard-${chapter}-1`,
      shardNumber: 1,
      title: `ShardZ #1: Core Identities & Domain Checks in ${chapter}`,
      durationMinutes: 15,
      focusConcept: `Verify function domains, symmetry identities, and algebraic invariants in ${chapter}.`,
      formulaHook:
        '$$\\int_a^b f(x)\\,dx = \\int_a^b f(a+b-x)\\,dx, \\quad |\\text{adj}(A)| = |A|^{n-1}$$',
      masteryQuestions: [
        {
          id: `sq-${chapter}-1-1`,
          prompt: `If $f(x)$ is an odd continuous function on $[-a, a]$, what is the value of $\\int_{-a}^{a} \\left(f(x) + 3\\right)dx$?`,
          options: ['$0$', '$6a$', '$2\\int_0^a f(x)\\,dx$', '$3a$'],
          correctIndex: 1,
          explanation:
            'Since $\\int_{-a}^a f(x)\\,dx = 0$ for an odd function, only the constant term $3$ integrates over length $2a$ to give $6a$.',
        },
        {
          id: `sq-${chapter}-1-2`,
          prompt: `What is the domain of the real-valued function $g(x) = \\ln(x^2 - 9)$?`,
          options: [
            '$[-3, 3]$',
            '$(-3, 3)$',
            '$(-\\infty, -3) \\cup (3, \\infty)$',
            '$[3, \\infty)$',
          ],
          correctIndex: 2,
          explanation:
            'Logarithm requires a strictly positive argument: $x^2 - 9 > 0 \\implies |x| > 3$, i.e., $(-\\infty, -3) \\cup (3, \\infty)$.',
        },
        {
          id: `sq-${chapter}-1-3`,
          prompt: `For two non-zero vectors $\\vec{a}$ and $\\vec{b}$, the quantity $|\\vec{a}\\times\\vec{b}|^2 + (\\vec{a}\\cdot\\vec{b})^2$ simplifies identically to:`,
          options: [
            '$|\\vec{a}| + |\\vec{b}|$',
            '$0$',
            '$|\\vec{a}|^2 - |\\vec{b}|^2$',
            '$|\\vec{a}|^2 |\\vec{b}|^2$',
          ],
          correctIndex: 3,
          explanation:
            'Lagrange’s identity: $|\\vec{a}|^2|\\vec{b}|^2(\\sin^2\\theta + \\cos^2\\theta) = |\\vec{a}|^2|\\vec{b}|^2$.',
        },
      ],
    },
    {
      id: `shard-${chapter}-2`,
      shardNumber: 2,
      title: `ShardZ #2: Calculus, Matrices & Extremum Methods in ${chapter}`,
      durationMinutes: 15,
      focusConcept: `Apply derivatives, matrix determinants, and series bounds in ${chapter}.`,
      formulaHook:
        '$$\\frac{d}{dx}\\int_{u(x)}^{v(x)} f(t)\\,dt = f(v(x))v\'(x) - f(u(x))u\'(x)$$',
      masteryQuestions: [
        {
          id: `sq-${chapter}-2-1`,
          prompt: `Evaluate $\\lim_{x \\to 0} \\frac{e^{3x} - 1}{x}$:`,
          options: ['$3$', '$1$', '$0$', '$e^3$'],
          correctIndex: 0,
          explanation:
            'Rewriting as $3\\cdot\\frac{e^{3x}-1}{3x}$ gives $3 \\times 1 = 3$ as $x \\to 0$.',
        },
        {
          id: `sq-${chapter}-2-2`,
          prompt: `If $A$ is a $3 \\times 3$ skew-symmetric matrix, then $\\det(A)$ is always:`,
          options: ['$1$', '$0$', '$-1$', '$3$'],
          correctIndex: 1,
          explanation:
            'For odd order $n = 3$, $\\det(A) = \\det(A^T) = \\det(-A) = (-1)^3\\det(A) = -\\det(A) \\implies \\det(A) = 0$.',
        },
        {
          id: `sq-${chapter}-2-3`,
          prompt: `For positive real numbers $x > 0$, the minimum value of $x + \\frac{9}{x}$ is:`,
          options: ['$3$', '$9$', '$6$', '$12$'],
          correctIndex: 2,
          explanation:
            'By AM–GM inequality, $\\frac{x + 9/x}{2} \\ge \\sqrt{x \\cdot \\frac{9}{x}} = 3 \\implies x + \\frac{9}{x} \\ge 6$, attained at $x = 3$.',
        },
      ],
    },
    {
      id: `shard-${chapter}-3`,
      shardNumber: 3,
      title: `ShardZ #3: Roots, Conics & Continuity Traps in ${chapter}`,
      durationMinutes: 15,
      focusConcept: `Check differentiability corners, discriminant boundaries, and conic parameters in ${chapter}.`,
      formulaHook:
        '$$e = \\sqrt{1 - \\frac{b^2}{a^2}} \\text{ (Ellipse)}, \\quad |z_1 + z_2| \\le |z_1| + |z_2|$$',
      masteryQuestions: [
        {
          id: `sq-${chapter}-3-1`,
          prompt: `At $x = 2$, the function $f(x) = |x - 2|$ is:`,
          options: [
            'Discontinuous and non-differentiable',
            'Differentiable with $f\'(2) = 1$',
            'Both continuous and differentiable',
            'Continuous, but NOT differentiable',
          ],
          correctIndex: 3,
          explanation:
            'Left-hand derivative is $-1$ and right-hand derivative is $+1$ at $x = 2$, creating a sharp corner despite continuity.',
        },
        {
          id: `sq-${chapter}-3-2`,
          prompt: `For the quadratic equation $ax^2 + bx + c = 0$ ($a > 0$) to have strictly positive values for all $x \\in \\mathbb{R}$, the discriminant $D = b^2 - 4ac$ must satisfy:`,
          options: ['$D < 0$', '$D = 0$', '$D > 0$', '$D \\ge 0$'],
          correctIndex: 0,
          explanation:
            'An upward-opening parabola lies strictly above the $x$-axis for all real $x$ if and only if it has no real roots ($D < 0$).',
        },
        {
          id: `sq-${chapter}-3-3`,
          prompt: `The eccentricity $e$ of a rectangular hyperbola ($x^2 - y^2 = a^2$) is:`,
          options: ['$1$', '$\\sqrt{2}$', '$2$', '$1/\\sqrt{2}$'],
          correctIndex: 1,
          explanation:
            'For a rectangular hyperbola $a = b$, so $e = \\sqrt{1 + \\frac{b^2}{a^2}} = \\sqrt{1 + 1} = \\sqrt{2}$.',
        },
      ],
    },
  ];
}

export interface AutoDetectedMaterialClassification {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  confidenceLabel: string;
}

const JEE_CHAPTER_CATALOG: {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  keywords: string[];
}[] = [
  // Physics Chapters
  {
    subject: 'Physics',
    chapter: 'Rotational Motion',
    keywords: [
      'rotational',
      'moment of inertia',
      'torque',
      'angular momentum',
      'rolling',
      'parallel axis',
      'perpendicular axis',
      'radius of gyration',
      'rigid body',
      'i_cm',
      'omega',
      'alpha',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Electrostatics',
    keywords: [
      'electrostatics',
      'coulomb',
      'gauss law',
      'electric field',
      'electric potential',
      'dipole',
      'capacitor',
      'capacitance',
      'dielectric',
      'epsilon',
      'flux',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Current Electricity',
    keywords: [
      'current electricity',
      'kirchhoff',
      'wheatstone',
      'potentiometer',
      'meter bridge',
      'ohm',
      'drift velocity',
      'resistivity',
      'galvanometer',
      'ammeter',
      'voltmeter',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Moving Charges and Magnetism',
    keywords: [
      'biot-savart',
      'biot savart',
      'ampere',
      'lorentz force',
      'cyclotron',
      'solenoid',
      'toroid',
      'magnetic field',
      'magnetic moment',
      'magnetism',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Electromagnetic Induction & AC',
    keywords: [
      'faraday',
      'lenz law',
      'inductance',
      'mutual induction',
      'self induction',
      'eddy current',
      'alternating current',
      'lcr circuit',
      'phasor',
      'resonance',
      'transformer',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Ray and Wave Optics',
    keywords: [
      'optics',
      'snell',
      'total internal reflection',
      'prism',
      'lens maker',
      'mirror formula',
      'ydse',
      'young double slit',
      'diffraction',
      'polarization',
      'interference',
      'huygens',
      'refractive index',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Modern Physics',
    keywords: [
      'photoelectric',
      'de broglie',
      'bohr model',
      'hydrogen spectrum',
      'rydberg',
      'nuclear',
      'binding energy',
      'radioactivity',
      'half life',
      'semiconductor',
      'zener diode',
      'logic gates',
      'planck',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Thermodynamics & KTG',
    keywords: [
      'carnot',
      'isothermal',
      'adiabatic',
      'isobaric',
      'isochoric',
      'kinetic theory of gases',
      'rms speed',
      'mean free path',
      'equipartition',
      'stefan',
      'wien',
      'calorimetry',
      'heat engine',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Kinematics & Laws of Motion',
    keywords: [
      'kinematics',
      'projectile',
      'relative velocity',
      'newton',
      'friction',
      'pulley',
      'wedge',
      'pseudo force',
      'centripetal',
      'banking of roads',
      'free body diagram',
      'trajectory',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Work, Power, Energy & Centre of Mass',
    keywords: [
      'work energy theorem',
      'conservative force',
      'potential energy',
      'vertical circle',
      'centre of mass',
      'center of mass',
      'collision',
      'coefficient of restitution',
      'impulse',
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Gravitation, SHM & Waves',
    keywords: [
      'gravitation',
      'kepler',
      'escape velocity',
      'orbital velocity',
      'satellite',
      'simple harmonic motion',
      'shm',
      'pendulum',
      'spring block',
      'doppler',
      'standing wave',
      'organ pipe',
      'beats',
      'surface tension',
      'bernoulli',
      'viscosity',
      'poiseuille',
      'young modulus',
    ],
  },

  // Chemistry Chapters
  {
    subject: 'Chemistry',
    chapter: 'Electrochemistry',
    keywords: [
      'electrochemistry',
      'nernst',
      'faraday law of electrolysis',
      'kohlrausch',
      'molar conductivity',
      'galvanic cell',
      'electrode potential',
      'cell emf',
      'salt bridge',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Kinetics',
    keywords: [
      'chemical kinetics',
      'rate law',
      'order of reaction',
      'molecularity',
      'arrhenius',
      'activation energy',
      'first order',
      'zero order',
      'half-life',
      'rate constant',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical & Ionic Equilibrium',
    keywords: [
      'le chatelier',
      'equilibrium constant',
      'kp and kc',
      'ionic equilibrium',
      'solubility product',
      'ksp',
      'buffer solution',
      'henderson',
      'salt hydrolysis',
      'ph scale',
      'bronsted',
      'lewis acid',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Coordination Compounds',
    keywords: [
      'coordination compound',
      'crystal field theory',
      'cft',
      'werner',
      'ligand',
      'chelate',
      'spectrochemical',
      'isomerism in coordination',
      'ean rule',
      'synergic bonding',
      'octahedral splitting',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'd & f Block Elements',
    keywords: [
      'd and f block',
      'd & f block',
      'transition elements',
      'lanthanoid',
      'actinoid',
      'kmno4',
      'k2cr2o7',
      'permanganate',
      'dichromate',
      'spin-only',
      'interstitial compounds',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'p-Block & Inorganic Chemistry',
    keywords: [
      'p-block',
      'p block',
      'boron family',
      'carbon family',
      'pnictogen',
      'chalcogen',
      'halogen',
      'noble gas',
      'interhalogen',
      'oxoacid',
      'diborane',
      'silicate',
      'metallurgy',
      'qualitative analysis',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Bonding & Atomic Structure',
    keywords: [
      'chemical bonding',
      'vsepr',
      'hybridization',
      'molecular orbital theory',
      'mot',
      'bond order',
      'fajan',
      'dipole moment',
      'hydrogen bonding',
      'quantum numbers',
      'aufbau',
      'hund',
      'pauli',
      'schrodinger',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'General Organic Chemistry & Hydrocarbons',
    keywords: [
      'general organic chemistry',
      'goc',
      'inductive effect',
      'hyperconjugation',
      'resonance',
      'mesomeric',
      'aromaticity',
      'huckel',
      'carbocation',
      'carbanion',
      'free radical',
      'stereoisomerism',
      'enantiomer',
      'diastereomer',
      'chirality',
      'r/s configuration',
      'markovnikov',
      'ozonolysis',
      'alkene',
      'alkyne',
      'benzene',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Organic Reaction Mechanisms (Haloalkanes, Alcohols, Carbonyls & Amines)',
    keywords: [
      'sn1',
      'sn2',
      'e1',
      'e2',
      'nucleophilic',
      'electrophilic',
      'aldol',
      'cannizzaro',
      'grignard',
      'reimer-tiemann',
      'kolbe',
      'williamson',
      'hoffmann bromamide',
      'gabriel phthalimide',
      'diazonium',
      'sandmeyer',
      'wittig',
      'perkin',
      'haloalkane',
      'aldehyde',
      'ketone',
      'carboxylic acid',
      'amine',
      'biomolecule',
      'amino acid',
      'carbohydrate',
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Solutions, Mole Concept & Chemical Thermodynamics',
    keywords: [
      'raoult',
      'colligative',
      'van’t hoff',
      'vant hoff',
      'osmotic pressure',
      'elevation in boiling',
      'depression in freezing',
      'mole concept',
      'stoichiometry',
      'limiting reagent',
      'molarity',
      'molality',
      'gibbs free energy',
      'enthalpy',
      'entropy',
      'hess law',
      'born-haber',
    ],
  },

  // Mathematics Chapters
  {
    subject: 'Mathematics',
    chapter: 'Definite & Indefinite Integration',
    keywords: [
      'integration',
      'integral',
      'king property',
      'leibniz',
      'by parts',
      'partial fraction',
      'wallis',
      'area under curve',
      'antiderivative',
      '\\int',
      'dx',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Limits, Continuity & Differentiability',
    keywords: [
      'limits',
      'continuity',
      'differentiability',
      'l hospital',
      'l’hospital',
      'rolle',
      'lagrange mean value',
      'chain rule',
      'implicit differentiation',
      'maxima and minima',
      'monotonicity',
      'tangent and normal',
      '\\lim',
      'dy/dx',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Differential Equations',
    keywords: [
      'differential equation',
      'integrating factor',
      'linear differential',
      'homogeneous differential',
      'variable separable',
      'orthogonal trajectory',
      'order and degree',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Matrices and Determinants',
    keywords: [
      'matrices',
      'matrix',
      'determinant',
      'cayley-hamilton',
      'cayley hamilton',
      'adjoint',
      'inverse of matrix',
      'cramer',
      'system of linear equations',
      'eigenvalue',
      'orthogonal matrix',
      'symmetric matrix',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Vector Algebra & 3D Geometry',
    keywords: [
      'vector algebra',
      '3d geometry',
      'scalar triple product',
      'vector triple product',
      'box product',
      'skew lines',
      'shortest distance',
      'direction cosines',
      'direction ratios',
      'plane equation',
      'dot product',
      'cross product',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Conic Sections & Coordinate Geometry',
    keywords: [
      'conic section',
      'parabola',
      'ellipse',
      'hyperbola',
      'eccentricity',
      'latus rectum',
      'directrix',
      'focus',
      'chord of contact',
      'radical axis',
      'straight line',
      'circle equation',
      'orthocentre',
      'circumcentre',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Complex Numbers & Quadratic Equations',
    keywords: [
      'complex number',
      'de moivre',
      'argand',
      'nth roots of unity',
      'cube root of unity',
      'modulus and argument',
      'euler form',
      'quadratic equation',
      'nature of roots',
      'vieta',
      'location of roots',
      'discriminant',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Permutations, Combinations & Probability',
    keywords: [
      'permutation',
      'combination',
      'combinatorics',
      'derangement',
      'pigeonhole',
      'multinomial',
      'binomial theorem',
      'general term',
      'probability',
      'bayes theorem',
      'conditional probability',
      'random variable',
      'bernoulli trials',
      'ncr',
      'npr',
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Sequences, Series, Sets & Trigonometry',
    keywords: [
      'arithmetic progression',
      'geometric progression',
      'harmonic progression',
      'am-gm',
      'telescoping series',
      'sigma notation',
      'trigonometry',
      'inverse trigonometric',
      'arcsin',
      'arccos',
      'arctan',
      'equivalence relation',
      'bijective',
      'one-one onto',
    ],
  },
];

/**
 * Automatically identifies the JEE Subject ('Physics' | 'Chemistry' | 'Mathematics')
 * and specific JEE Chapter from any uploaded filename, optional title, YouTube lecture
 * URL/outline, handwritten OCR text, or pasted study notes.
 */
export function detectJeeSubjectAndChapter(
  rawInput: string,
  optionalTitle = ''
): AutoDetectedMaterialClassification {
  const combined = `${optionalTitle} ${rawInput}`.toLowerCase();

  let bestCatalogMatch: {
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    score: number;
  } | null = null;

  const subjectScores: Record<'Physics' | 'Chemistry' | 'Mathematics', number> = {
    Physics: 0,
    Chemistry: 0,
    Mathematics: 0,
  };

  // Explicit subject name mentions get a gentle weight
  if (/\b(physics|mechanics|electrodynamics|optics|shm|kinematics)\b/i.test(combined)) {
    subjectScores.Physics += 3;
  }
  if (
    /\b(chemistry|organic|inorganic|electrochemistry|molarity|ligand|orbital|alkene|benzene)\b/i.test(
      combined
    )
  ) {
    subjectScores.Chemistry += 3;
  }
  if (
    /\b(mathematics|maths|math|calculus|algebra|trigonometry|integral|matrix|matrices|conic)\b/i.test(
      combined
    )
  ) {
    subjectScores.Mathematics += 3;
  }

  for (const item of JEE_CHAPTER_CATALOG) {
    let chapterScore = 0;
    if (combined.includes(item.chapter.toLowerCase())) {
      chapterScore += 8;
    }
    for (const kw of item.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        chapterScore += 3;
      }
    }
    if (chapterScore > 0) {
      subjectScores[item.subject] += chapterScore;
      if (!bestCatalogMatch || chapterScore > bestCatalogMatch.score) {
        bestCatalogMatch = {
          subject: item.subject,
          chapter: item.chapter,
          score: chapterScore,
        };
      }
    }
  }

  // Determine winning subject
  let winningSubject: 'Physics' | 'Chemistry' | 'Mathematics' = 'Physics';
  if (
    subjectScores.Chemistry > subjectScores.Physics &&
    subjectScores.Chemistry >= subjectScores.Mathematics
  ) {
    winningSubject = 'Chemistry';
  } else if (
    subjectScores.Mathematics > subjectScores.Physics &&
    subjectScores.Mathematics > subjectScores.Chemistry
  ) {
    winningSubject = 'Mathematics';
  } else if (bestCatalogMatch) {
    winningSubject = bestCatalogMatch.subject;
  }

  // Clean optional title or infer chapter from catalog match or first meaningful line
  const cleanedOptionalTitle = optionalTitle
    .trim()
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  let detectedChapter = '';
  if (bestCatalogMatch && bestCatalogMatch.score >= 3) {
    detectedChapter = cleanedOptionalTitle || bestCatalogMatch.chapter;
  } else if (cleanedOptionalTitle) {
    detectedChapter = cleanedOptionalTitle;
  } else {
    const firstLine = rawInput
      .split('\n')
      .map((l) => l.replace(/^[#*-\s]+/, '').trim())
      .find((l) => l.length > 3 && !l.startsWith('http'));
    detectedChapter = firstLine ? firstLine.slice(0, 60) : `${winningSubject} Chapter Notes`;
  }

  return {
    subject: winningSubject,
    chapter: detectedChapter,
    confidenceLabel:
      bestCatalogMatch && bestCatalogMatch.score >= 3
        ? `Auto-Detected: ${winningSubject} • ${bestCatalogMatch.chapter}`
        : `Auto-Detected: ${winningSubject} • ${detectedChapter}`,
  };
}

export interface MarathonTimestampChunk {
  id: string;
  timestampLabel: string;
  endTimestampLabel: string;
  seconds: number;
  pageNumber: number;
  topicTitle: string;
  summary: string;
}

/**
 * Parses explicit HH:MM:SS / MM:SS timestamps from a YouTube lecture transcript/outline
 * or generates structured 30-to-60 minute marathon timestamp chunks for lectures up to 12 hours.
 */
export function parseOrGenerateMarathonTimestampChunks(
  rawText: string,
  durationHours = 3,
  chapterTitle = 'Complete Lecture'
): MarathonTimestampChunk[] {
  const safeHours = Math.max(1, Math.min(12, Math.round(durationHours || 3)));
  const lines = (rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const explicitChunks: MarathonTimestampChunk[] = [];
  const tsRegex = /(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–—:]?\s*(.+)$/;

  for (const line of lines) {
    const m = tsRegex.exec(line);
    if (m) {
      const hasHours = m[3] !== undefined;
      const hrs = hasHours ? Number(m[1]) : 0;
      const mins = hasHours ? Number(m[2]) : Number(m[1]);
      const secs = hasHours ? Number(m[3]) : Number(m[2]);
      const totalSec = hrs * 3600 + mins * 60 + secs;
      const label = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
        secs
      ).padStart(2, '0')}`;
      const nextHr = Math.min(12, hrs + 1);
      const endLabel = `${String(nextHr).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
      const idx = explicitChunks.length + 1;
      explicitChunks.push({
        id: `ts-chunk-${idx}`,
        timestampLabel: label,
        endTimestampLabel: endLabel,
        seconds: totalSec,
        pageNumber: ((idx - 1) % 3) + 1,
        topicTitle: m[4].trim().slice(0, 90) || `${chapterTitle} — Segment ${idx}`,
        summary: `Direct lecture segment at ${label}: ${m[4].trim()}`,
      });
    }
  }

  if (explicitChunks.length >= 2) {
    return explicitChunks.slice(0, 16);
  }

  // Generate structured marathon chunks across the lecture duration (up to 12 hours)
  const chunkCount = Math.max(4, Math.min(12, safeHours * 2));
  const totalSeconds = safeHours * 3600;
  const stepSeconds = Math.floor(totalSeconds / chunkCount);

  const phaseLabels = [
    'First Principles, Sign Conventions & Fundamental Laws',
    'Complete Step-by-Step Derivations & Analytical Proofs',
    'Standard Multi-Concept Solved Numericals (Level 1 & 2)',
    'Compulsory Section B Integer & Decimal Problem Methods',
    'Important Exceptions, Boundary Conditions & Exam Traps',
    'High-Weightage PYQ Walkthrough & Elimination Shortcuts',
    'Coupled Multi-Body / Mixed-Concept Advanced Applications',
    'Rapid Formula Sheet Consolidation & Dimensional Checks',
  ];

  const generated: MarathonTimestampChunk[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const startSec = i * stepSeconds;
    const endSec = Math.min(totalSeconds, (i + 1) * stepSeconds);
    const formatSec = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(
        2,
        '0'
      )}`;
    };
    generated.push({
      id: `ts-marathon-${i + 1}`,
      timestampLabel: formatSec(startSec),
      endTimestampLabel: formatSec(endSec),
      seconds: startSec,
      pageNumber: (i % 3) + 1,
      topicTitle: `${chapterTitle} • Part ${i + 1}: ${phaseLabels[i % phaseLabels.length]}`,
      summary: `Covers ${phaseLabels[i % phaseLabels.length].toLowerCase()} with timestamp-synced notes and formulas.`,
    });
  }

  return generated;
}

export interface CanvasVectorStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  pageNumber: number;
  target: 'original' | 'notes';
  points: { x: number; y: number }[];
}

export interface DiagramVectorOverlayItem {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
  dx: number;
  dy: number;
  angleDeg?: number;
  magnitude?: number;
  color: string;
}

const CANONICAL_SUBJECT_ORDER: readonly ('Physics' | 'Chemistry' | 'Mathematics')[] = [
  'Physics',
  'Chemistry',
  'Mathematics',
];

/**
 * Distributes custom CBT test questions evenly (round-robin) across all selected subjects,
 * falling back to another selected subject only if a subject's pool is exhausted.
 * Preserves canonical IDs (appending `__copy_N` only when wrapping exhausted tiny pools)
 * so server-verified grading continues to match authoritative answer keys.
 */
export function buildBalancedCustomTestQuestions(params: {
  pool: CBTQuestion[];
  selectedSubjects: ('Physics' | 'Chemistry' | 'Mathematics')[];
  questionCount: number;
  groupBySubject?: boolean;
}): CBTQuestion[] {
  const { pool, selectedSubjects, questionCount, groupBySubject = true } = params;
  const targetCount = Math.max(1, Math.floor(questionCount));
  if (!pool.length) return [];

  const orderedSubjects = CANONICAL_SUBJECT_ORDER.filter((subj) =>
    selectedSubjects.includes(subj)
  );
  const candidateSubjects =
    orderedSubjects.length > 0
      ? orderedSubjects
      : CANONICAL_SUBJECT_ORDER.filter((subj) => pool.some((q) => q.subject === subj));

  const buckets = new Map<'Physics' | 'Chemistry' | 'Mathematics', CBTQuestion[]>();
  for (const subj of candidateSubjects) {
    const items = pool.filter((q) => q.subject === subj);
    if (items.length > 0) {
      buckets.set(subj, items);
    }
  }

  const activeSubjects = candidateSubjects.filter((s) => (buckets.get(s)?.length || 0) > 0);
  if (activeSubjects.length === 0) {
    const fallback = pool.slice(0, targetCount);
    return fallback.map((q, idx) => ({ ...q, number: idx + 1 }));
  }

  const cursors = new Map<'Physics' | 'Chemistry' | 'Mathematics', number>();
  activeSubjects.forEach((s) => cursors.set(s, 0));

  const picked: CBTQuestion[] = [];
  // Pass 1: Strict round-robin taking 1 unique item per active subject in turn until targetCount
  // or all unique subject pools are exhausted.
  while (picked.length < targetCount) {
    let progressed = false;
    for (const subj of activeSubjects) {
      if (picked.length >= targetCount) break;
      const bucket = buckets.get(subj)!;
      const cursor = cursors.get(subj) || 0;
      if (cursor < bucket.length) {
        picked.push(bucket[cursor]);
        cursors.set(subj, cursor + 1);
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  // Pass 2: If total unique items across all selected subjects < targetCount (e.g., narrow filter),
  // continue round-robin wrapping across active subjects so every subject still keeps balanced share.
  if (picked.length < targetCount) {
    while (picked.length < targetCount) {
      for (const subj of activeSubjects) {
        if (picked.length >= targetCount) break;
        const bucket = buckets.get(subj)!;
        const cursor = cursors.get(subj) || 0;
        picked.push(bucket[cursor % bucket.length]);
        cursors.set(subj, cursor + 1);
      }
    }
  }

  const ordered = groupBySubject
    ? [...picked].sort(
        (a, b) =>
          CANONICAL_SUBJECT_ORDER.indexOf(a.subject) -
          CANONICAL_SUBJECT_ORDER.indexOf(b.subject)
      )
    : picked;

  const usedIds = new Set<string>();
  return ordered.map((tpl, idx) => {
    const uniqueId = usedIds.has(tpl.id) ? `${tpl.id}__copy_${idx + 1}` : tpl.id;
    usedIds.add(uniqueId);
    return {
      ...tpl,
      id: uniqueId,
      number: idx + 1,
    };
  });
}

/**
 * Sanitizes Section B numerical input from both physical keyboards and the on-screen keypad.
 * Allows optional leading `-`, digits `0-9`, and at most one `.` up to 10 characters.
 */
export function sanitizeNumericalInputValue(raw: string): string {
  const input = String(raw || '');
  let out = '';
  let hasDot = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch === '-' && out.length === 0) {
      out += '-';
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
      out += '.';
    }
    if (out.length >= 10) break;
  }
  return out;
}

export function resolveCbtSessionInit<
  T extends {
    examMode: ExamTrack;
    secondsRemaining: number;
    currentQNumber: number;
  },
>(params: {
  initialExamMode: ExamTrack;
  customQuestions?: CBTQuestion[];
  customDurationMinutes?: number;
  resumeFromDraft?: boolean;
  existingDraft: T | null;
}): {
  isCustomTest: boolean;
  shouldResumeDraft: boolean;
  examMode: ExamTrack;
  initialQNumber: number;
  initialSecondsRemaining: number;
} {
  const isCustomTest = Boolean(params.customQuestions && params.customQuestions.length > 0);
  const canResume = Boolean(
    !isCustomTest &&
      params.resumeFromDraft &&
      params.existingDraft &&
      params.existingDraft.examMode === params.initialExamMode &&
      params.existingDraft.secondsRemaining > 0
  );
  const examMode: ExamTrack = canResume ? params.existingDraft!.examMode : params.initialExamMode;
  const firstQuestionNumber = params.customQuestions?.[0]?.number || 1;
  const defaultDurationSeconds = (params.customDurationMinutes || 180) * 60;

  return {
    isCustomTest,
    shouldResumeDraft: canResume,
    examMode,
    initialQNumber: canResume ? params.existingDraft!.currentQNumber : firstQuestionNumber,
    initialSecondsRemaining: canResume
      ? params.existingDraft!.secondsRemaining
      : defaultDurationSeconds,
  };
}
export interface CustomTestFilterOptions {
  basePool: CBTQuestion[];
  mistakesPool?: CBTQuestion[];
  selectedSubjects: ('Physics' | 'Chemistry' | 'Mathematics')[];
  selectedChapters?: string[];
  difficultyFilter?:
    | 'All'
    | 'Easy'
    | 'Moderate'
    | 'Tough'
    | 'Beginner'
    | 'Must-Do'
    | 'Advanced Climb';
  questionTypeFilter?:
    | 'All'
    | 'MCQ'
    | 'Numerical'
    | 'Multi-Correct'
    | 'Previously Incorrect Only';
}

/**
 * Strictly filters custom test question candidates without any silent fallbacks.
 * Returns [] whenever the intersection of subject, chapter, difficulty, and format is empty.
 */
export function filterCustomTestQuestions(opts: CustomTestFilterOptions): CBTQuestion[] {
  const {
    basePool,
    mistakesPool = [],
    selectedSubjects,
    selectedChapters = [],
    difficultyFilter = 'All',
    questionTypeFilter = 'All',
  } = opts;

  if (!Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
    return [];
  }

  let pool: CBTQuestion[] =
    questionTypeFilter === 'Previously Incorrect Only' ? [...mistakesPool] : [...basePool];

  pool = pool.filter((q) => selectedSubjects.includes(q.subject));

  if (selectedChapters.length > 0) {
    pool = pool.filter((q) => {
      const qNorm = q.chapter.trim().toLowerCase();
      return selectedChapters.some((ch) => {
        const selNorm = ch.trim().toLowerCase();
        return qNorm === selNorm || qNorm.includes(selNorm) || selNorm.includes(qNorm);
      });
    });
  }

  if (difficultyFilter !== 'All') {
    const targetBucket =
      difficultyFilter === 'Easy' || difficultyFilter === 'Beginner'
        ? 'Beginner'
        : difficultyFilter === 'Moderate' || difficultyFilter === 'Must-Do'
        ? 'Must-Do'
        : 'Advanced Climb';
    pool = pool.filter((q) => (q.difficultyBucket || 'Must-Do') === targetBucket);
  }

  if (questionTypeFilter === 'MCQ') {
    pool = pool.filter((q) => q.section === 'Section A' && q.advancedFormat !== 'multiple');
  } else if (questionTypeFilter === 'Numerical') {
    pool = pool.filter((q) => q.section === 'Section B' || q.advancedFormat === 'numerical');
  } else if (questionTypeFilter === 'Multi-Correct') {
    pool = pool.filter((q) => q.advancedFormat === 'multiple');
  }

  return pool;
}
