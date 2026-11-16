import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapChapterToNta58,
  normalizeConvertedCbtPaper,
  parseAttachedAnswerKeyText,
  parseModelJsonPayload,
} from './convertedPaperNormalizer';
import { EXPANDED_NTA_58_CHAPTERS } from '../data/expandedNta58Chapters';

test('parseAttachedAnswerKeyText parses MCQ, multi-correct, and numerical keys', () => {
  const keyText = `
    1. A
    Q2: (B)
    3) 4.5
    4 - A, C
    5: [B, D]
    6 -> -12
    7 C 8 24
  `;
  const parsed = parseAttachedAnswerKeyText(keyText);
  assert.deepEqual(parsed.get(1)?.letters, [0]);
  assert.deepEqual(parsed.get(2)?.letters, [1]);
  assert.equal(parsed.get(3)?.numericalAnswer, 4.5);
  assert.deepEqual(parsed.get(4)?.letters, [0, 2]);
  assert.deepEqual(parsed.get(5)?.letters, [1, 3]);
  assert.equal(parsed.get(6)?.numericalAnswer, -12);
  assert.deepEqual(parsed.get(7)?.letters, [2]);
  assert.equal(parsed.get(8)?.numericalAnswer, 24);
});

test('mapChapterToNta58 maps raw coaching chapter names to EXPANDED_NTA_58_CHAPTERS', () => {
  const mappedRotational = mapChapterToNta58('Rotational Motion & Moment of Inertia', 'Physics');
  assert.ok(
    EXPANDED_NTA_58_CHAPTERS.some((c) => c.chapterName === mappedRotational),
    `Expected canonical NTA chapter, got: ${mappedRotational}`
  );
  assert.match(mappedRotational, /Rotational/i);

  const mappedElectro = mapChapterToNta58('Gauss Law and Capacitors', 'Physics');
  assert.match(mappedElectro, /Electrostatics/i);

  const mappedBio = mapChapterToNta58('Molecular Basis of Inheritance', 'Chemistry', true);
  assert.equal(mappedBio, 'Biology — Molecular Basis of Inheritance');
});

test('normalizeConvertedCbtPaper enforces attached key precedence, 5 formats, diagrams, and needs_review', () => {
  const rawPayload = parseModelJsonPayload(
    '```json\n' +
      JSON.stringify({
        questions: [
          {
            questionNumber: 1,
            subject: 'Physics',
            chapter: 'Rotational Dynamics',
            type: 'MCQ',
            stem: 'A solid sphere rolls without slipping. Find $a_{\\text{cm}}$.',
            options: ['$\\frac{5}{7}g\\sin\\theta$', '$\\frac{2}{5}g\\sin\\theta$', '$g\\sin\\theta$', '$\\frac{1}{2}g\\sin\\theta$'],
            correctIndex: 2, // AI guessed C, attached key says A (index 0)
            solution: 'AI solution',
            sourcePageNumber: 1,
            hasDiagramReference: true,
            needsReview: false,
          },
          {
            questionNumber: 2,
            subject: 'Chemistry',
            chapter: 'Thermodynamics & Equilibrium',
            type: 'NUMERICAL',
            stem: 'Calculate $\\Delta G^\\circ$ in kJ.',
            options: [],
            numericalAnswer: 99, // Attached key says -14.5
            solution: 'Using $\\Delta G^\\circ = -RT\\ln K$.',
            sourcePageNumber: 2,
            hasDiagramReference: false,
            needsReview: false,
          },
          {
            questionNumber: 3,
            subject: 'Mathematics',
            chapter: 'Definite Integration',
            type: 'MULTI_CORRECT',
            stem: 'Which properties hold for $I = \\int_0^\\pi f(\\sin x)\\,dx$?',
            options: ['Opt 1', 'Opt 2', 'Opt 3', 'Opt 4'],
            correctIndices: [0, 3],
            solution: 'King property applies.',
            sourcePageNumber: 2,
            hasDiagramReference: false,
            needsReview: false,
          },
          {
            questionNumber: 4,
            subject: 'Physics',
            chapter: 'Electrostatics',
            type: 'COMPREHENSION',
            paragraphContext: 'Two concentric conducting shells carry $+Q$ and $-2Q$.',
            stem: 'Find potential at outer shell.',
            options: ['$kQ/R$', '$-kQ/R$', '$0$', '$2kQ/R$'],
            correctIndex: 1,
            sourcePageNumber: 3,
            hasDiagramReference: false,
            needsReview: true,
          },
          {
            questionNumber: 5,
            subject: 'Mathematics',
            chapter: 'Matrices & Determinants',
            type: 'MATRIX_MATCH',
            matrixListI: ['P: $A^2 = I$', 'Q: $A^T = -A$'],
            matrixListII: ['1: Involutory', '2: Skew-symmetric'],
            stem: 'Match List-I with List-II.',
            options: ['P-1, Q-2', 'P-2, Q-1', 'P-1, Q-1', 'P-2, Q-2'],
            correctIndex: 0,
            sourcePageNumber: 3,
            hasDiagramReference: false,
            needsReview: false,
          },
        ],
      }) +
      '\n```'
  );

  const normalized = normalizeConvertedCbtPaper({
    rawPayload,
    pattern: 'JEE Advanced +4/-2 Partial',
    attachedAnswerKeyText: '1. A\n2. -14.5',
    pageImagesByNumber: {
      1: 'data:image/jpeg;base64,PAGE1IMG',
      2: 'data:image/jpeg;base64,PAGE2IMG',
    },
  });

  assert.equal(normalized.questions.length, 5);

  // Q1: attached key overrides AI correctIndex (0 instead of 2) and attaches diagram from page 1
  assert.equal(normalized.questions[0].correctIndex, 0);
  assert.equal(normalized.questions[0].keySource, 'official_key_attached');
  assert.equal(normalized.questions[0].diagramImageUrl, 'data:image/jpeg;base64,PAGE1IMG');
  assert.equal(normalized.questions[0].advancedFormat, 'single');

  // Q2: numerical overridden to -14.5, Section B, no diagram URL attached
  assert.equal(normalized.questions[1].section, 'Section B');
  assert.equal(normalized.questions[1].advancedFormat, 'numerical');
  assert.equal(normalized.questions[1].numericalAnswer, -14.5);
  assert.equal(normalized.questions[1].keySource, 'official_key_attached');
  assert.equal(normalized.questions[1].diagramImageUrl, undefined);

  // Q3: AI verified multi-correct
  assert.equal(normalized.questions[2].advancedFormat, 'multiple');
  assert.deepEqual(normalized.questions[2].correctIndices, [0, 3]);
  assert.equal(normalized.questions[2].keySource, 'ai_verified');

  // Q4: needs_review preserved, comprehension format
  assert.equal(normalized.questions[3].advancedFormat, 'paragraph');
  assert.equal(normalized.questions[3].keySource, 'needs_review');

  // Q5: matrix match format
  assert.equal(normalized.questions[4].advancedFormat, 'matrix');
  assert.equal(normalized.questions[4].keySource, 'ai_verified');

  // Summary checks (Adv: single=3, numerical=4, multiple=4, paragraph=3, matrix=3 => 17 marks)
  assert.equal(normalized.summary.physicsCount, 2);
  assert.equal(normalized.summary.chemistryCount, 1);
  assert.equal(normalized.summary.mathematicsCount, 2);
  assert.equal(normalized.summary.totalQuestions, 5);
  assert.equal(normalized.summary.maxMarks, 17);
  assert.equal(normalized.summary.needsReviewCount, 1);
  assert.equal(normalized.summary.diagramQuestionCount, 1);
});

test('normalizeConvertedCbtPaper handles NEET Biology track cleanly', () => {
  const normalized = normalizeConvertedCbtPaper({
    rawPayload: {
      questions: [
        {
          questionNumber: 1,
          subject: 'Biology',
          chapter: 'Cell Cycle and Division',
          type: 'MCQ',
          stem: 'DNA replication occurs in which phase?',
          options: ['G1 phase', 'S phase', 'G2 phase', 'M phase'],
          correctIndex: 1,
          sourcePageNumber: 1,
        },
      ],
    },
    pattern: 'NEET +4/-1',
  });

  assert.equal(normalized.questions[0].examType, 'NEET UG');
  assert.equal(normalized.questions[0].subTrackLabel, 'Biology (Botany & Zoology)');
  assert.equal(normalized.summary.biologyCount, 1);
  assert.equal(normalized.summary.maxMarks, 4);
});
