import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectJeeSubjectAndChapter,
  evaluateSingleQuestionMarks,
  calculateCBTSummary,
  calculateSM2Schedule,
  generateChapterShardZ,
  CBTQuestion,
} from './jeeEngine.ts';
import {
  generateMaterialStudyBundle,
  JEE_SYLLABUS_DATA,
  CBT_MOCK_QUESTIONS,
} from '../data/jeeInitialContent.ts';
import { validateAndIngestPYQPack } from '../services/pyqIngestionService.ts';

test('detectJeeSubjectAndChapter auto-identifies Physics, Chemistry, and Mathematics chapters', () => {
  const phys = detectJeeSubjectAndChapter(
    'Moment of inertia of a solid cylinder and parallel axis theorem I = I_cm + M d^2 with rolling torque',
    ''
  );
  assert.equal(phys.subject, 'Physics');
  assert.match(phys.chapter, /Rotational/i);

  const chem = detectJeeSubjectAndChapter(
    'Nernst equation E_cell, Kohlrausch law of molar conductivity and galvanic cell EMF',
    ''
  );
  assert.equal(chem.subject, 'Chemistry');
  assert.match(chem.chapter, /Electrochemistry/i);

  const math = detectJeeSubjectAndChapter(
    'Definite integration using King property and Leibniz rule for differentiation under integral sign',
    ''
  );
  assert.equal(math.subject, 'Mathematics');
  assert.match(math.chapter, /Integration/i);
});

test('JEE_SYLLABUS_DATA contains all 58 official NTA JEE Main & Advanced chapters (20 Physics, 20 Chemistry, 18 Mathematics)', () => {
  assert.equal(JEE_SYLLABUS_DATA.length, 58);
  const physCount = JEE_SYLLABUS_DATA.filter((c) => c.subject === 'Physics').length;
  const chemCount = JEE_SYLLABUS_DATA.filter((c) => c.subject === 'Chemistry').length;
  const mathCount = JEE_SYLLABUS_DATA.filter((c) => c.subject === 'Mathematics').length;
  assert.equal(physCount, 20);
  assert.equal(chemCount, 20);
  assert.equal(mathCount, 18);
  assert.ok(JEE_SYLLABUS_DATA.every((c) => c.weightageTier && c.examScope));
});

test('evaluateSingleQuestionMarks enforces +4/-1 for JEE Main Section A MCQ and +4/-1 for JEE Main Section B Numerical', () => {
  const mainMcq: CBTQuestion = {
    id: 'q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Laws of Motion',
    stem: 'Sample MCQ',
    options: ['10 N', '20 N', '30 N', '40 N'],
    correctIndex: 1,
    explanation: 'F = ma',
    examType: 'JEE Main',
  };

  // Correct Section A MCQ -> +4
  const mcqRight = evaluateSingleQuestionMarks(mainMcq, {
    status: 'answered',
    selectedOption: 1,
    timeSpentSec: 30,
  });
  assert.equal(mcqRight.marksAwarded, 4);
  assert.equal(mcqRight.isCorrect, true);

  // Wrong Section A MCQ -> -1
  const mcqWrong = evaluateSingleQuestionMarks(mainMcq, {
    status: 'answered',
    selectedOption: 2,
    timeSpentSec: 30,
  });
  assert.equal(mcqWrong.marksAwarded, -1);
  assert.equal(mcqWrong.isCorrect, false);

  // Compulsory Section B Numerical in JEE Main -> +4 for correct, -1 for wrong, 0 for unattempted
  const mainNum: CBTQuestion = {
    id: 'q21',
    number: 21,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Work, Energy and Power',
    stem: 'Sample Numerical',
    options: ['72'],
    correctIndex: 0,
    numericalAnswer: 72,
    explanation: 'W = 72 J',
    examType: 'JEE Main',
  };

  const numRight = evaluateSingleQuestionMarks(mainNum, {
    status: 'answered',
    selectedOption: null,
    numericalValue: '72',
    timeSpentSec: 45,
  });
  assert.equal(numRight.marksAwarded, 4);
  assert.equal(numRight.isCorrect, true);

  const numWrong = evaluateSingleQuestionMarks(mainNum, {
    status: 'answered',
    selectedOption: null,
    numericalValue: '55',
    timeSpentSec: 45,
  });
  assert.equal(numWrong.marksAwarded, -1);
  assert.equal(numWrong.isCorrect, false);

  const numSkipped = evaluateSingleQuestionMarks(mainNum, {
    status: 'not_answered',
    selectedOption: null,
    numericalValue: '',
    timeSpentSec: 10,
  });
  assert.equal(numSkipped.marksAwarded, 0);
  assert.equal(numSkipped.isAttempted, false);
});

test('evaluateSingleQuestionMarks enforces JEE Advanced partial marking (+4/-2/+3/+2/+1) and Non-Negative Integer (+4/0)', () => {
  const advMulti: CBTQuestion = {
    id: 'adv-1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion',
    stem: 'Multi-choice',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    correctIndices: [0, 1, 2, 3],
    explanation: 'All 4 correct',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
  };

  // All 4 correct -> +4
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1, 2, 3],
      timeSpentSec: 60,
    }).marksAwarded,
    4
  );

  // 3 of 4 correct, zero wrong -> +3 partial
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1, 2],
      timeSpentSec: 60,
    }).marksAwarded,
    3
  );

  // 2 of 4 correct, zero wrong -> +2 partial
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1],
      timeSpentSec: 60,
    }).marksAwarded,
    2
  );

  // 1 of 4 correct, zero wrong -> +1 partial
  assert.equal(
    evaluateSingleQuestionMarks(advMulti, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0],
      timeSpentSec: 60,
    }).marksAwarded,
    1
  );

  // Any wrong option chosen -> -2
  const advThreeCorrect: CBTQuestion = {
    ...advMulti,
    correctIndices: [0, 1, 2],
  };
  assert.equal(
    evaluateSingleQuestionMarks(advThreeCorrect, {
      status: 'answered',
      selectedOption: null,
      selectedOptions: [0, 1, 3], // 3 is wrong
      timeSpentSec: 60,
    }).marksAwarded,
    -2
  );

  // JEE Advanced Numerical -> +4 correct, 0 wrong
  const advNum: CBTQuestion = {
    id: 'adv-num',
    number: 4,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Capacitance',
    stem: 'Adv Numerical',
    options: ['2'],
    correctIndex: 0,
    numericalAnswer: 2,
    explanation: '2 uF',
    examType: 'JEE Advanced',
    advancedFormat: 'numerical',
  };
  assert.equal(
    evaluateSingleQuestionMarks(advNum, {
      status: 'answered',
      selectedOption: null,
      numericalValue: '99',
      timeSpentSec: 40,
    }).marksAwarded,
    0
  );
});

test('SM-2 review intervals and chapter sprint generation', () => {
  // First review with Good (quality=4) -> interval 1, repetition 1
  const r1 = calculateSM2Schedule({
    quality: 4,
    repetition: 0,
    interval: 1,
    efactor: 2.5,
  });
  assert.equal(r1.interval, 1);
  assert.equal(r1.repetition, 1);

  // Second review with Good (quality=4) -> interval 6, repetition 2
  const r2 = calculateSM2Schedule({
    quality: 4,
    repetition: r1.repetition,
    interval: r1.interval,
    efactor: r1.efactor,
  });
  assert.equal(r2.interval, 6);
  assert.equal(r2.repetition, 2);

  // Third review with Easy (quality=5) -> interval = round(6 * 2.5) = 15, efactor increases
  const r3 = calculateSM2Schedule({
    quality: 5,
    repetition: r2.repetition,
    interval: r2.interval,
    efactor: r2.efactor,
  });
  assert.equal(r3.interval, 15);
  assert.ok(r3.efactor > r2.efactor);

  // Lapse (quality=1) -> resets interval to 1 and repetition to 0
  const lapsed = calculateSM2Schedule({
    quality: 1,
    repetition: r3.repetition,
    interval: r3.interval,
    efactor: r3.efactor,
  });
  assert.equal(lapsed.interval, 1);
  assert.equal(lapsed.repetition, 0);

  // ShardZ generator (syllabus-only questions, varied answer positions)
  const shards = generateChapterShardZ('Electrostatics', 'Physics');
  assert.equal(shards.length, 3);
  assert.equal(shards[0].durationMinutes, 15);
  assert.equal(shards[0].masteryQuestions.length, 3);
  const allShardQuestions = shards.flatMap((s) => s.masteryQuestions);
  for (const sq of allShardQuestions) {
    assert.equal(/how many marks|negative mark|marking scheme|meta|exam rule/i.test(sq.prompt), false);
    assert.equal(sq.options.length, 4);
  }
  const shardIndices = new Set(allShardQuestions.map((sq) => sq.correctIndex));
  assert.ok(shardIndices.size >= 2, 'ShardZ questions should not all share the same option index');
});

test('generateMaterialStudyBundle builds source-grounded pages without boilerplate formula injection and validates PYQ provenance', () => {
  const multiPageSource = [
    '[Page 1] Parallel axis theorem states $$I = I_{cm} + M d^2$$ for rigid bodies.',
    '[Page 2] Rotational kinetic energy is $K = \\frac{1}{2} I \\omega^2$.',
    '[Page 3] Rolling without slipping requires $v_{cm} = \\omega R$.',
  ].join('\n\n');

  const bundle = generateMaterialStudyBundle({
    materialId: 'test-mat-1',
    title: 'Rotational Dynamics Lecture Notes',
    subject: 'Physics',
    chapter: 'Rotational Motion',
    sourceType: 'pdf',
    rawText: multiPageSource,
    originalFileUrl: 'blob:https://example.com/sample.pdf',
    originalMimeType: 'application/pdf',
  });

  assert.equal(bundle.pages.length, 3);
  assert.equal(bundle.pages[0].sections.length, 4);
  assert.ok(bundle.formulas.some((f) => f.formula.includes('I_{cm}')));
  assert.equal(bundle.formulas.some((f) => f.formula.includes('varepsilon_0')), false);
  assert.equal(/katex/i.test(JSON.stringify(bundle)), false);
  assert.equal(CBT_MOCK_QUESTIONS.length, 75);
  assert.ok(
    CBT_MOCK_QUESTIONS.every(
      (q) => q.provenanceType === 'RECONSTRUCTED_WITH_SOURCE' || q.provenanceType === 'LEARNMATE_ORIGINAL'
    )
  );

  const packRes = validateAndIngestPYQPack([
    {
      id: 'pyq-2025-1',
      year: 2025,
      shift: 'Jan 22 Shift 1',
      examType: 'JEE Main',
      subject: 'Physics',
      chapterId: 'syl-phys-6',
      chapterName: 'Rotational Motion',
      difficulty: 'Moderate',
      questionType: 'Numerical',
      stemLatex: 'Find moment of inertia in $\\text{kg}\\cdot\\text{m}^2$:',
      numericalAnswer: 12,
      solutionLatex: '$$I = 12\\text{ kg}\\cdot\\text{m}^2$$',
      conceptTags: ['Moment of Inertia', 'Parallel Axis Theorem'],
    },
  ]);
  assert.equal(packRes.valid, true);
  assert.equal(packRes.questions.length, 1);
  assert.equal(packRes.questions[0].section, 'Section B');
  assert.equal(packRes.questions[0].provenanceType, 'RECONSTRUCTED_WITH_SOURCE');
});

test('Multi-exam evaluation supports BITSAT (+3/-1) and NEET UG (+4/-1) plus 12-hour marathon timestamp chunking', async () => {
  const { parseOrGenerateMarathonTimestampChunks } = await import('./jeeEngine.ts');

  const bitsatQ: CBTQuestion = {
    id: 'b-1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Kinematics',
    stem: 'BITSAT sample',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Ans A',
    examType: 'BITSAT',
  };

  assert.equal(
    evaluateSingleQuestionMarks(bitsatQ, {
      status: 'answered',
      selectedOption: 0,
      timeSpentSec: 25,
    }).marksAwarded,
    3
  );
  assert.equal(
    evaluateSingleQuestionMarks(bitsatQ, {
      status: 'answered',
      selectedOption: 2,
      timeSpentSec: 25,
    }).marksAwarded,
    -1
  );

  const neetQ: CBTQuestion = {
    ...bitsatQ,
    id: 'n-1',
    examType: 'NEET UG',
  };
  assert.equal(
    evaluateSingleQuestionMarks(neetQ, {
      status: 'answered',
      selectedOption: 0,
      timeSpentSec: 25,
    }).marksAwarded,
    4
  );

  const chunks = parseOrGenerateMarathonTimestampChunks(
    '00:00:00 Coulomb Law & Vector Form\n01:30:00 Gauss Law & Applications\n03:15:00 Electric Dipole Torque',
    6,
    'Electrostatics'
  );
  assert.equal(chunks.length, 3);
  assert.equal(chunks[1].seconds, 5400);
  assert.match(chunks[1].topicTitle, /Gauss Law/);

  const autoChunks = parseOrGenerateMarathonTimestampChunks('General marathon notes', 6, 'Optics');
  assert.ok(autoChunks.length >= 4);
  assert.equal(autoChunks[0].seconds, 0);
});

test('buildBalancedCustomTestQuestions allocates evenly across Physics, Chemistry, and Mathematics with fallback only when exhausted', async () => {
  const { buildBalancedCustomTestQuestions } = await import('./jeeEngine.ts');

  const even30 = buildBalancedCustomTestQuestions({
    pool: CBT_MOCK_QUESTIONS,
    selectedSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    questionCount: 30,
    groupBySubject: true,
  });
  assert.equal(even30.length, 30);
  assert.equal(even30.filter((q) => q.subject === 'Physics').length, 10);
  assert.equal(even30.filter((q) => q.subject === 'Chemistry').length, 10);
  assert.equal(even30.filter((q) => q.subject === 'Mathematics').length, 10);
  assert.deepEqual(
    even30.map((q) => q.number),
    Array.from({ length: 30 }, (_, i) => i + 1)
  );

  // Remainder distribution for non-divisible total (10 -> 4/3/3)
  const remainder10 = buildBalancedCustomTestQuestions({
    pool: CBT_MOCK_QUESTIONS,
    selectedSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    questionCount: 10,
    groupBySubject: true,
  });
  assert.equal(remainder10.filter((q) => q.subject === 'Physics').length, 4);
  assert.equal(remainder10.filter((q) => q.subject === 'Chemistry').length, 3);
  assert.equal(remainder10.filter((q) => q.subject === 'Mathematics').length, 3);

  // Narrow pool where Chemistry only has 2 unique questions out of 12 requested across 3 subjects
  const narrowPool: CBTQuestion[] = [
    ...CBT_MOCK_QUESTIONS.filter((q) => q.subject === 'Physics').slice(0, 8),
    ...CBT_MOCK_QUESTIONS.filter((q) => q.subject === 'Chemistry').slice(0, 2),
    ...CBT_MOCK_QUESTIONS.filter((q) => q.subject === 'Mathematics').slice(0, 8),
  ];
  const balanced12 = buildBalancedCustomTestQuestions({
    pool: narrowPool,
    selectedSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    questionCount: 12,
    groupBySubject: true,
  });
  assert.equal(balanced12.length, 12);
  assert.equal(balanced12.filter((q) => q.subject === 'Chemistry').length, 2);
  assert.equal(balanced12.filter((q) => q.subject === 'Physics').length, 5);
  assert.equal(balanced12.filter((q) => q.subject === 'Mathematics').length, 5);
});

test('CBT_MOCK_QUESTIONS has 75 unique stems, balanced correctIndex distribution, and empty options on numericals', () => {
  assert.equal(CBT_MOCK_QUESTIONS.length, 75);
  const allStems = CBT_MOCK_QUESTIONS.map((q) => q.stem.trim());
  assert.equal(new Set(allStems).size, 75);

  const sectionA = CBT_MOCK_QUESTIONS.filter((q) => q.section === 'Section A');
  assert.equal(sectionA.length, 60);
  const dist = [0, 1, 2, 3].map((idx) => sectionA.filter((q) => q.correctIndex === idx).length);
  for (const count of dist) {
    assert.ok(count >= 10 && count <= 20, `Expected balanced option distribution, got ${dist.join('/')}`);
  }

  const sectionB = CBT_MOCK_QUESTIONS.filter((q) => q.section === 'Section B');
  assert.equal(sectionB.length, 15);
  for (const q of sectionB) {
    assert.equal(/Compulsory Numerical Drill|Practice Variant/i.test(q.stem), false);
    assert.equal(q.numericalAnswer !== undefined, true);
    assert.deepEqual(q.options, []);
  }
});

test('sanitizeNumericalInputValue handles physical keyboard digits, decimals, leading minus, and invalid characters', async () => {
  const { sanitizeNumericalInputValue } = await import('./jeeEngine.ts');

  assert.equal(sanitizeNumericalInputValue('-42.5'), '-42.5');
  assert.equal(sanitizeNumericalInputValue('72abc'), '72');
  assert.equal(sanitizeNumericalInputValue('1.2.34'), '1.234');
  assert.equal(sanitizeNumericalInputValue('1-2-3'), '123');
  assert.equal(sanitizeNumericalInputValue('--0.75'), '-0.75');
  assert.equal(sanitizeNumericalInputValue(''), '');
});

test('resolveCbtSessionInit prevents custom tests from inheriting interrupted mock timer or responses', async () => {
  const { resolveCbtSessionInit, buildBalancedCustomTestQuestions } = await import('./jeeEngine.ts');

  const customQs = buildBalancedCustomTestQuestions({
    pool: CBT_MOCK_QUESTIONS,
    selectedSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    questionCount: 30,
  });

  const existingDraft = {
    examMode: 'JEE Main' as const,
    secondsRemaining: 10789,
    currentQNumber: 1,
  };

  // Custom test must start completely fresh at durationMinutes * 60
  const customInit = resolveCbtSessionInit({
    initialExamMode: 'JEE Main',
    customQuestions: customQs,
    customDurationMinutes: 60,
    resumeFromDraft: true,
    existingDraft,
  });
  assert.equal(customInit.isCustomTest, true);
  assert.equal(customInit.shouldResumeDraft, false);
  assert.equal(customInit.initialQNumber, 1);
  assert.equal(customInit.initialSecondsRemaining, 3600);

  // Fresh standard CBT launch ignores interrupted draft unless resumeFromDraft === true
  const freshMockInit = resolveCbtSessionInit({
    initialExamMode: 'JEE Main',
    resumeFromDraft: false,
    existingDraft,
  });
  assert.equal(freshMockInit.isCustomTest, false);
  assert.equal(freshMockInit.shouldResumeDraft, false);
  assert.equal(freshMockInit.initialSecondsRemaining, 10800);

  // Explicit Resume Interrupted Mock restores draft state
  const resumedInit = resolveCbtSessionInit({
    initialExamMode: 'JEE Main',
    resumeFromDraft: true,
    existingDraft,
  });
  assert.equal(resumedInit.shouldResumeDraft, true);
  assert.equal(resumedInit.initialQNumber, 1);
  assert.equal(resumedInit.initialSecondsRemaining, 10789);

  // NEET UG official duration is 180 minutes (10800s), not 200 minutes
  const neetInit = resolveCbtSessionInit({
    initialExamMode: 'NEET UG',
    resumeFromDraft: false,
    existingDraft: null,
  });
  assert.equal(neetInit.initialSecondsRemaining, 180 * 60);
});

test('filterCustomTestQuestions enforces strict intersection with zero silent fallbacks', async () => {
  const { filterCustomTestQuestions } = await import('./jeeEngine.ts');
  const { JEE_ADVANCED_PAPER_QUESTIONS } = await import('../data/jeeInitialContent.ts');
  const combinedPool = [...CBT_MOCK_QUESTIONS, ...JEE_ADVANCED_PAPER_QUESTIONS];

  // Impossible combination: Physics chapter selected while only Chemistry subject is selected
  const emptyCrossSubject = filterCustomTestQuestions({
    basePool: combinedPool,
    selectedSubjects: ['Chemistry'],
    selectedChapters: ['Rotational Motion'],
  });
  assert.equal(emptyCrossSubject.length, 0);

  // Empty mistake notebook with Previously Incorrect Only -> strictly returns []
  const emptyMistakes = filterCustomTestQuestions({
    basePool: combinedPool,
    mistakesPool: [],
    selectedSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    questionTypeFilter: 'Previously Incorrect Only',
  });
  assert.equal(emptyMistakes.length, 0);

  // Strict multi-correct filter returns only JEE Advanced multiple-correct questions
  const multiOnly = filterCustomTestQuestions({
    basePool: combinedPool,
    selectedSubjects: ['Physics'],
    questionTypeFilter: 'Multi-Correct',
  });
  assert.ok(multiOnly.every((q) => q.subject === 'Physics' && q.advancedFormat === 'multiple'));

  // Chapter filter respects partial chapter inclusion without cross-chapter motion leakage
  const electroMatches = filterCustomTestQuestions({
    basePool: combinedPool,
    selectedSubjects: ['Physics'],
    selectedChapters: ['Electrostatics'],
  });
  assert.ok(electroMatches.length > 0);
  assert.ok(electroMatches.every((q) => q.chapter.toLowerCase().includes('electrostatics')));

  const motionPlaneMatches = filterCustomTestQuestions({
    basePool: combinedPool,
    selectedSubjects: ['Physics'],
    selectedChapters: ['Motion in a Plane'],
  });
  assert.equal(
    motionPlaneMatches.some((q) => q.chapter === 'Laws of Motion' || q.chapter === 'Rotational Motion'),
    false
  );
});

