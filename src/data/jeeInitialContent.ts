import { CBTQuestion, QuestionResponseState } from '../utils/jeeEngine';
import { Preset3DId } from '../components/ThreeSceneCanvas';
import { EXPANDED_NTA_58_CHAPTERS } from './expandedNta58Chapters';
import {
  buildGroundedMaterialStudyBundle,
  ContentProvenance,
  ExtractionQuality,
} from '../services/studyBundleBuilder';

export type { ContentProvenance, ExtractionQuality };

export interface QuickNotesData {
  formulasAndConstants: string[];
  keyPrinciples: string[];
  specialCases: string[];
  topMistakes: string[];
}

export interface NotePageData {
  pageNumber: number;
  heading: string;
  timestampRange?: string; // For up to 12-hour YouTube marathon lectures
  sections: {
    numberTitle: string;
    tone?: 'concept' | 'formula' | 'derivation' | 'example' | 'trap';
    paragraphs?: string[];
    bullets?: string[];
    formulas?: string[];
  }[];
  quickNotes?: QuickNotesData;
  aiTutorSummary: {
    english: string;
    hinglish: string;
  };
}

export interface MindMapSubNode {
  id: string;
  label: string;
  formulaLatex?: string;
  microNote: string;
}

export interface MindMapNodeItem {
  id: string;
  title: string;
  subtitle: string;
  colorClass: string;
  borderClass: string;
  pageRef: string;
  definition: string;
  example: string;
  commonTrap: string;
  formulaLatex?: string;
  badgeType?: 'High Weightage' | 'Formula' | 'Exception Trap';
  subNodes?: MindMapSubNode[];
}

export interface StickyNoteData {
  id: string;
  title: string;
  body: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  color: 'amber' | 'emerald' | 'indigo' | 'rose';
}

export interface FormulaCardEntry {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  title: string;
  formula: string;
  variables?: string;
  units?: string;
  notes: string;
}

export interface MaterialStudyBundle {
  materialId: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  originalFileUrl?: string;
  originalMimeType?: string;
  rawText: string;
  provenance?: ContentProvenance;
  extractionQuality?: ExtractionQuality;
  contentHash?: string;
  pages: NotePageData[];
  mindMapNodes: MindMapNodeItem[];
  stickyNotes: StickyNoteData[];
  formulas: FormulaCardEntry[];
  quizQuestions: CBTQuestion[];
}

/**
 * Generates a grounded MaterialStudyBundle strictly from user-uploaded PDF,
 * Handwritten Photo, YouTube Transcript/SRT, Paste Text, or Google Drive material.
 * Never injects unrelated formula banks or fabricated lecture timestamps.
 */
export function generateMaterialStudyBundle(params: {
  materialId: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  rawText: string;
  durationHours?: number;
  originalFileUrl?: string;
  originalMimeType?: string;
}): MaterialStudyBundle {
  return buildGroundedMaterialStudyBundle({
    ...params,
    fallbackQuizPool: typeof CBT_MOCK_QUESTIONS !== 'undefined' ? CBT_MOCK_QUESTIONS : [],
  });
}

// Clean Zero-State Exports (Empty until user uploads material)
export const D_AND_F_BLOCK_PAGES: NotePageData[] = [];
export const D_AND_F_MIND_MAP_NODES: MindMapNodeItem[] = [];
export const MIND_MAP_CHAPTERS: Record<string, MindMapNodeItem[]> = {};
export const FORMULA_BOOK_ENTRIES: FormulaCardEntry[] = [];

export interface SyllabusChapterItem {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  subDiscipline?: 'Mechanics' | 'Electrodynamics' | 'Optics & Modern' | 'Thermal & Waves' | 'Physical' | 'Inorganic' | 'Organic' | 'Algebra' | 'Calculus' | 'Coordinate & Vectors';
  chapter: string;
  classLevel: '11' | '12' | '11th' | '12th';
  weightage: 'High' | 'Medium' | 'Low';
  weightageTier: 'High' | 'Medium' | 'Low';
  examScope: 'Main+Advanced' | 'Advanced-Only';
  expectedQs: string;
  unitSummary: string;
  defaultCompleted: boolean;
}

export const JEE_SYLLABUS_DATA: SyllabusChapterItem[] = EXPANDED_NTA_58_CHAPTERS.map(
  (ch) => ({
    id: ch.id,
    subject: ch.subject,
    subDiscipline:
      ch.branch === 'Thermodynamics'
        ? 'Thermal & Waves'
        : ch.branch === 'Optics' || ch.branch === 'Modern'
        ? 'Optics & Modern'
        : ch.branch === 'Coordinate Geometry' || ch.branch === 'Vectors & 3D'
        ? 'Coordinate & Vectors'
        : (ch.branch as SyllabusChapterItem['subDiscipline']) || 'Mechanics',
    chapter: ch.chapterName,
    classLevel: ch.classLevel,
    weightage: ch.weightageTier,
    weightageTier: ch.weightageTier,
    examScope: ch.syllabusScope,
    expectedQs: ch.expectedQs,
    unitSummary: `${ch.unitName} (NCERT Ch. ${ch.ncertChapterNumber}, Weightage: ${ch.ntaWeightagePct}%) — Key Formulas: ${ch.keyFormulasLatex
      .map((f) => `$${f}$`)
      .join(' , ')}`,
    defaultCompleted: false,
  })
);

export const DIAGRAM_SVG_PRESETS: Record<Preset3DId, string> = {
  Incline: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-black" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#111827"/>
      </marker>
      <marker id="arrow-emerald" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669"/>
      </marker>
      <marker id="arrow-rose" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#DC2626"/>
      </marker>
      <marker id="arrow-indigo" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4F46E5"/>
      </marker>
    </defs>
    <rect width="680" height="420" fill="#FFFFFF" />
    <polygon points="100,340 560,340 560,150" fill="#F1F5F9" stroke="#0F172A" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 190,340 A 90,90 0 0,0 182,306" fill="#DBEAFE" fill-opacity="0.7" stroke="#1E40AF" stroke-width="2.2"/>
    <text x="202" y="328" font-family="Georgia, serif" font-style="italic" font-size="24" fill="#1E40AF">θ</text>
    <g transform="translate(340, 241) rotate(-22.44)">
      <rect x="-58" y="-62" width="116" height="62" rx="4" fill="#E0E7FF" stroke="#1E1B4B" stroke-width="3"/>
      <text x="-10" y="-24" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="22" fill="#1E1B4B">m</text>
      <!-- Normal reaction N -->
      <line x1="0" y1="-62" x2="0" y2="-165" stroke="#059669" stroke-width="3.2" marker-end="url(#arrow-emerald)"/>
      <text x="-10" y="-176" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="23" fill="#059669">N</text>
      <!-- Friction f_s up the incline -->
      <line x1="58" y1="-31" x2="145" y2="-31" stroke="#4F46E5" stroke-width="3" marker-end="url(#arrow-indigo)"/>
      <text x="152" y="-25" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#4F46E5">f = μN</text>
      <!-- mg sin(theta) down the incline -->
      <line x1="-58" y1="-31" x2="-148" y2="-31" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="5,3" marker-end="url(#arrow-rose)"/>
      <text x="-235" y="-25" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#DC2626">mg sin θ</text>
      <!-- mg cos(theta) into the incline -->
      <line x1="0" y1="0" x2="0" y2="95" stroke="#64748B" stroke-width="2.2" stroke-dasharray="5,3" marker-end="url(#arrow-black)"/>
      <text x="12" y="92" font-family="Georgia, serif" font-style="italic" font-size="18" fill="#334155">mg cos θ</text>
    </g>
    <!-- True Vertical Gravity mg -->
    <line x1="328" y1="212" x2="328" y2="332" stroke="#DC2626" stroke-width="3.4" marker-end="url(#arrow-rose)"/>
    <text x="290" y="362" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="24" fill="#DC2626">mg</text>
    <text x="110" y="52" font-family="Plus Jakarta Sans, sans-serif" font-weight="bold" font-size="16" fill="#0F172A">Free-Body Resolution: N = mg cos θ,  a = g(sin θ − μ cos θ)</text>
  </svg>`,
  'Convex Lens': `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-opt" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="#1E293B"/>
      </marker>
    </defs>
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="40" y1="210" x2="640" y2="210" stroke="#64748B" stroke-width="2" stroke-dasharray="6,4"/>
    <path d="M 340,75 Q 388,210 340,345 Q 292,210 340,75 Z" fill="#DBEAFE" fill-opacity="0.65" stroke="#1E40AF" stroke-width="3"/>
    <line x1="340" y1="75" x2="340" y2="345" stroke="#93C5FD" stroke-width="1.5" stroke-dasharray="4,4"/>
    <line x1="160" y1="210" x2="160" y2="120" stroke="#059669" stroke-width="3.5" marker-end="url(#arrow-opt)"/>
    <line x1="160" y1="120" x2="340" y2="120" stroke="#4F46E5" stroke-width="2.5"/>
    <line x1="340" y1="120" x2="540" y2="290" stroke="#4F46E5" stroke-width="2.5" marker-end="url(#arrow-opt)"/>
    <line x1="160" y1="120" x2="540" y2="290" stroke="#D97706" stroke-width="2.5" marker-end="url(#arrow-opt)"/>
    <line x1="510" y1="210" x2="510" y2="276" stroke="#DC2626" stroke-width="3.5" marker-end="url(#arrow-opt)"/>
    <circle cx="240" cy="210" r="4" fill="#1E293B"/><text x="230" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">F₁</text>
    <circle cx="140" cy="210" r="4" fill="#1E293B"/><text x="126" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">2F₁</text>
    <circle cx="440" cy="210" r="4" fill="#1E293B"/><text x="432" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">F₂</text>
    <circle cx="540" cy="210" r="4" fill="#1E293B"/><text x="530" y="232" font-family="Georgia, serif" font-style="italic" font-size="18">2F₂</text>
    <text x="138" y="108" font-family="Georgia, serif" font-size="17" fill="#059669">Object (AB)</text>
    <text x="480" y="308" font-family="Georgia, serif" font-size="17" fill="#DC2626">Real Image (A'B')</text>
    <text x="195" y="48" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#0F172A">1/v − 1/u = 1/f ,   m = v/u</text>
  </svg>`,
  'RC Circuit': `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <path d="M 150,280 L 150,120 L 240,120 L 252,102 L 272,138 L 292,102 L 312,138 L 332,102 L 344,120 L 520,120 L 520,188" fill="none" stroke="#0F172A" stroke-width="3"/>
    <line x1="485" y1="188" x2="555" y2="188" stroke="#4F46E5" stroke-width="4"/>
    <line x1="485" y1="215" x2="555" y2="215" stroke="#4F46E5" stroke-width="4"/>
    <path d="M 520,215 L 520,310 L 360,310" fill="none" stroke="#0F172A" stroke-width="3"/>
    <line x1="330" y1="310" x2="150" y2="310" stroke="#0F172A" stroke-width="3"/>
    <line x1="330" y1="285" x2="330" y2="335" stroke="#059669" stroke-width="4"/>
    <line x1="350" y1="297" x2="350" y2="323" stroke="#059669" stroke-width="2.5"/>
    <text x="275" y="85" font-family="Georgia, serif" font-style="italic" font-size="24" fill="#0F172A">R</text>
    <text x="572" y="210" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#4F46E5">C (q(t) = CV(1 − e^(−t/RC)))</text>
    <text x="295" y="365" font-family="Georgia, serif" font-style="italic" font-size="21" fill="#059669">ε, Time Constant τ = RC</text>
  </svg>`,
  VSEPR: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <polygon points="340,80 490,185 450,260 340,340 190,235 230,160" fill="#EEF2FF" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="5,5"/>
    <line x1="340" y1="210" x2="340" y2="85" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="340" y2="335" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="480" y2="175" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="200" y2="245" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="445" y2="255" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="340" y1="210" x2="235" y2="165" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="340" cy="210" r="32" fill="#4F46E5" stroke="#1E1B4B" stroke-width="2.5"/>
    <text x="322" y="217" font-family="Plus Jakarta Sans, sans-serif" font-weight="bold" font-size="18" fill="#FFFFFF">M³⁺</text>
    <circle cx="340" cy="80" r="20" fill="#10B981"/><text x="331" y="85" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="340" cy="340" r="20" fill="#10B981"/><text x="331" y="345" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="485" cy="175" r="20" fill="#10B981"/><text x="476" y="180" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="195" cy="245" r="20" fill="#10B981"/><text x="186" y="250" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="450" cy="255" r="20" fill="#10B981"/><text x="441" y="260" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <circle cx="230" cy="165" r="20" fill="#10B981"/><text x="221" y="170" font-size="13" fill="#FFF" font-weight="bold">L</text>
    <text x="225" y="392" font-family="Georgia, serif" font-size="19" fill="#0F172A">Octahedral Geometry (sp³d² / d²sp³ · 90° &amp; 180° Bond Angles)</text>
  </svg>`,
  Parabola: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="80" y1="210" x2="600" y2="210" stroke="#475569" stroke-width="2"/>
    <line x1="260" y1="40" x2="260" y2="380" stroke="#475569" stroke-width="2"/>
    <line x1="170" y1="40" x2="170" y2="380" stroke="#EF4444" stroke-width="2.5" stroke-dasharray="6,4"/>
    <path d="M 520,50 Q 0,210 520,370" fill="none" stroke="#4F46E5" stroke-width="3.5"/>
    <circle cx="350" cy="210" r="6" fill="#059669"/>
    <text x="342" y="236" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#059669">Focus S(a, 0)</text>
    <text x="95" y="65" font-family="Georgia, serif" font-style="italic" font-size="17" fill="#EF4444">Directrix x = −a</text>
    <text x="455" y="105" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#4F46E5">y² = 4ax (L.R. = 4a)</text>
  </svg>`,
  Ellipse: `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="420" fill="#FFFFFF"/>
    <line x1="60" y1="210" x2="620" y2="210" stroke="#475569" stroke-width="2"/>
    <line x1="340" y1="40" x2="340" y2="380" stroke="#475569" stroke-width="2"/>
    <ellipse cx="340" cy="210" rx="200" ry="115" fill="#EEF2FF" fill-opacity="0.5" stroke="#4F46E5" stroke-width="3.5"/>
    <circle cx="220" cy="210" r="5" fill="#DC2626"/><text x="202" y="235" font-family="Georgia, serif" font-style="italic" font-size="18">F₁(−ae, 0)</text>
    <circle cx="460" cy="210" r="5" fill="#DC2626"/><text x="442" y="235" font-family="Georgia, serif" font-style="italic" font-size="18">F₂(ae, 0)</text>
    <text x="445" y="95" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#4F46E5">x²/a² + y²/b² = 1,  b² = a²(1 − e²)</text>
  </svg>`,
};

// Full 20 unique Physics Section A MCQs (Q1–Q20), balanced across correctIndex 0..3
const BASE_PHYSICS_MCQS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Laws of Motion',
    stem: 'A block of mass $m = 2\\text{ kg}$ rests on a smooth inclined plane of angle $\\theta = 30^\\circ$. The normal reaction $N$ exerted by the incline is (take $g = 10\\text{ m/s}^2$):',
    options: ['$10\\text{ N}$', '$10\\sqrt{3}\\text{ N}$', '$20\\text{ N}$', '$5\\text{ N}$'],
    correctIndex: 1,
    explanation: 'Perpendicular equilibrium: $N = mg\\cos(30^\\circ) = 2 \\times 10 \\times \\frac{\\sqrt{3}}{2} = 10\\sqrt{3}\\text{ N}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Shift 1',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Electrostatics & Capacitors',
    stem: 'A parallel plate capacitor of capacitance $C$ is charged to potential $V$. If the separation between plates is doubled after disconnecting the battery, the new electrostatic energy stored is:',
    options: ['$\\frac{1}{2}CV^2$', '$\\frac{1}{4}CV^2$', '$CV^2$', '$2CV^2$'],
    correctIndex: 2,
    explanation: 'Battery disconnected implies charge $Q = CV$ is constant. Since $C\' = C/2$, $U\' = \\frac{Q^2}{2C\'} = CV^2$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Shift 2',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion',
    stem: 'The moment of inertia of a uniform solid sphere of mass $M$ and radius $R$ about a tangent to its surface is:',
    options: ['$\\frac{2}{5}MR^2$', '$\\frac{5}{3}MR^2$', '$\\frac{3}{5}MR^2$', '$\\frac{7}{5}MR^2$'],
    correctIndex: 3,
    explanation: 'Parallel Axis Theorem: $I_{\\text{tangent}} = I_{\\text{CM}} + MR^2 = \\frac{2}{5}MR^2 + MR^2 = \\frac{7}{5}MR^2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Current Electricity',
    stem: 'Three identical resistors of $6\\,\\Omega$ each are connected in parallel across an ideal $12\\text{ V}$ cell. The total current drawn from the cell is:',
    options: ['$6\\text{ A}$', '$2\\text{ A}$', '$4\\text{ A}$', '$1.5\\text{ A}$'],
    correctIndex: 0,
    explanation: '$R_{\\text{eq}} = \\frac{6}{3} = 2\\,\\Omega \\implies I = \\frac{12}{2} = 6\\text{ A}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Ray & Wave Optics',
    stem: 'In Young’s double-slit experiment, if the slit separation $d$ is halved and screen distance $D$ is doubled, the fringe width $\\beta$ becomes:',
    options: ['$2\\beta$', '$4\\beta$', '$\\beta/2$', 'Unchanged'],
    correctIndex: 1,
    explanation: '$\\beta = \\frac{\\lambda D}{d} \\implies \\beta\' = \\frac{\\lambda(2D)}{d/2} = 4\\beta$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Units, Dimensions & Error Analysis',
    stem: 'If percentage errors in the measurement of mass $m$ and speed $v$ are $2\\%$ and $3\\%$ respectively, the maximum percentage error in kinetic energy $K = \\frac{1}{2}mv^2$ is:',
    options: ['$5\\%$', '$6\\%$', '$8\\%$', '$7\\%$'],
    correctIndex: 2,
    explanation: '$\\frac{\\Delta K}{K} = \\frac{\\Delta m}{m} + 2\\frac{\\Delta v}{v} = 2\\% + 2(3\\%) = 8\\%$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2025',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Kinematics (1D & 2D Projectile Motion)',
    stem: 'A projectile is fired at angle $\\theta$ with the horizontal such that its maximum height $H$ equals one-fourth of its horizontal range $R$. The value of $\\tan\\theta$ is:',
    options: ['$2$', '$1/2$', '$\\sqrt{3}$', '$1$'],
    correctIndex: 3,
    explanation: 'Using $H = \\frac{R}{4}\\tan\\theta$, setting $H = \\frac{R}{4}$ immediately gives $\\tan\\theta = 1$ ($\\theta = 45^\\circ$).',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Work, Power, Energy & Centre of Mass',
    stem: 'A $2\\text{ kg}$ body moving with velocity $6\\text{ m/s}$ collides head-on and sticks to an identical $2\\text{ kg}$ body at rest. The kinetic energy lost in this perfectly inelastic collision is:',
    options: ['$18\\text{ J}$', '$36\\text{ J}$', '$9\\text{ J}$', '$12\\text{ J}$'],
    correctIndex: 0,
    explanation: 'Common final velocity $v_f = \\frac{2\\times 6}{4} = 3\\text{ m/s}$. $\\Delta K = \\frac{1}{2}(2)(36) - \\frac{1}{2}(4)(9) = 36 - 18 = 18\\text{ J}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Gravitation',
    stem: 'At what height $h$ above Earth’s surface (radius $R$) does the acceleration due to gravity drop to $\\frac{g}{9}$?',
    options: ['$R$', '$2R$', '$3R$', '$8R$'],
    correctIndex: 1,
    explanation: '$g(h) = \\frac{g}{(1 + h/R)^2} = \\frac{g}{9} \\implies 1 + \\frac{h}{R} = 3 \\implies h = 2R$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Properties of Matter & Fluid Mechanics',
    stem: 'Two spherical soap bubbles of radii $r_1 = 3\\text{ cm}$ and $r_2 = 4\\text{ cm}$ coalesce isothermally in vacuum. The radius $r$ of the resulting single soap bubble is:',
    options: ['$7\\text{ cm}$', '$3.5\\text{ cm}$', '$5\\text{ cm}$', '$\\sqrt{7}\\text{ cm}$'],
    correctIndex: 2,
    explanation: 'For isothermal coalescence of soap bubbles in vacuum, surface energy conservation gives $r = \\sqrt{r_1^2 + r_2^2} = \\sqrt{9 + 16} = 5\\text{ cm}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Thermodynamics & KTG',
    stem: 'For an ideal gas undergoing a reversible adiabatic expansion ($PV^\\gamma = \\text{constant}$) from volume $V$ to $2V$, if $\\gamma = 1.5$, the ratio of final to initial temperature $T_2 / T_1$ is:',
    options: ['$2$', '$1/2$', '$\\sqrt{2}$', '$1/\\sqrt{2}$'],
    correctIndex: 3,
    explanation: '$T_1 V_1^{\\gamma - 1} = T_2 V_2^{\\gamma - 1} \\implies \\frac{T_2}{T_1} = \\left(\\frac{V}{2V}\\right)^{1.5 - 1} = \\frac{1}{\\sqrt{2}}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2025',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Simple Harmonic Motion',
    stem: 'A particle executes SHM with amplitude $A$. At what displacement $x$ from the mean position is its kinetic energy equal to three times its potential energy?',
    options: ['$A/2$', '$A/\\sqrt{2}$', '$A/4$', '$\\sqrt{3}A/2$'],
    correctIndex: 0,
    explanation: '$K = 3U \\implies \\frac{1}{2}k(A^2 - x^2) = 3\\left(\\frac{1}{2}kx^2\\right) \\implies A^2 = 4x^2 \\implies x = \\pm A/2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Waves & Sound',
    stem: 'A closed organ pipe (closed at one end) and an open organ pipe have the same length $L$. The ratio of their fundamental frequencies $\\frac{f_{\\text{closed}}}{f_{\\text{open}}}$ is:',
    options: ['$2:1$', '$1:2$', '$1:4$', '$3:2$'],
    correctIndex: 1,
    explanation: '$f_{\\text{closed}} = \\frac{v}{4L}$ and $f_{\\text{open}} = \\frac{v}{2L}$, so $f_{\\text{closed}} / f_{\\text{open}} = 1:2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Moving Charges and Magnetism',
    stem: 'A proton and an $\\alpha$-particle enter a uniform magnetic field perpendicularly with the same kinetic energy. The ratio of the radii of their circular paths $r_p : r_\\alpha$ is:',
    options: ['$1:2$', '$2:1$', '$1:1$', '$4:1$'],
    correctIndex: 2,
    explanation: '$r = \\frac{\\sqrt{2mK}}{qB}$. For $\\alpha$-particle, $m_\\alpha = 4m_p$ and $q_\\alpha = 2q_p$, so $\\frac{\\sqrt{4}}{2} = 1 \\implies r_p : r_\\alpha = 1:1$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Electromagnetic Induction & AC',
    stem: 'In a series LCR circuit at resonance ($\\omega L = \\frac{1}{\\omega C}$), the phase difference between the applied alternating voltage and the current is:',
    options: ['$\\pi/2$', '$\\pi/4$', '$\\pi$', '$0$'],
    correctIndex: 3,
    explanation: 'At resonance, inductive and capacitive reactances cancel ($X_L = X_C$), making the circuit purely resistive with phase angle $\\phi = 0$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Electromagnetic Induction & AC',
    stem: 'The magnetic flux linked with a coil varies with time $t$ as $\\Phi(t) = (5t^2 - 3t + 8)\\text{ Wb}$. The magnitude of induced EMF at $t = 2\\text{ s}$ is:',
    options: ['$17\\text{ V}$', '$20\\text{ V}$', '$14\\text{ V}$', '$22\\text{ V}$'],
    correctIndex: 0,
    explanation: '$|\\mathcal{E}| = \\left|\\frac{d\\Phi}{dt}\\right| = |10t - 3|$. At $t = 2\\text{ s}$, $|\\mathcal{E}| = |20 - 3| = 17\\text{ V}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Electromagnetic Waves',
    stem: 'In a plane electromagnetic wave propagating along $+\\hat{k}$, the electric field vector oscillates along $+\\hat{i}$ with amplitude $E_0 = 60\\text{ V/m}$. The amplitude of the magnetic field $B_0$ is ($c = 3\\times 10^8\\text{ m/s}$):',
    options: ['$1.8\\times 10^{10}\\text{ T}$', '$2\\times 10^{-7}\\text{ T}$', '$5\\times 10^{-7}\\text{ T}$', '$2\\times 10^{-8}\\text{ T}$'],
    correctIndex: 1,
    explanation: '$B_0 = \\frac{E_0}{c} = \\frac{60}{3\\times 10^8} = 2\\times 10^{-7}\\text{ T}$ directed along $+\\hat{j}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Modern Physics',
    stem: 'According to Bohr’s atomic model, the ratio of the radius of the $3^{\\text{rd}}$ orbit to that of the $1^{\\text{st}}$ orbit of a hydrogen atom is:',
    options: ['$3:1$', '$1:9$', '$9:1$', '$27:1$'],
    correctIndex: 2,
    explanation: 'Bohr orbit radius $r_n \\propto n^2$, hence $r_3 / r_1 = 3^2 / 1^2 = 9:1$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2025',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Modern Physics (Semiconductors)',
    stem: 'For an ideal $p$-$n$ junction silicon diode in forward bias at room temperature, the depletion layer width:',
    options: [
      'Increases and barrier potential increases',
      'Remains completely unchanged',
      'Becomes infinite',
      'Decreases as the applied voltage opposes the built-in potential',
    ],
    correctIndex: 3,
    explanation: 'Forward bias lowers the potential barrier and narrows the depletion region, allowing majority carrier diffusion.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Ray & Wave Optics',
    stem: 'An astronomical telescope in normal adjustment uses an objective of focal length $f_o = 100\\text{ cm}$ and an eyepiece of focal length $f_e = 5\\text{ cm}$. Its magnifying power is:',
    options: ['$20$', '$105$', '$95$', '$500$'],
    correctIndex: 0,
    explanation: 'In normal adjustment (final image at infinity), angular magnification $|m| = \\frac{f_o}{f_e} = \\frac{100}{5} = 20$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
];

const BASE_PHYSICS_NUMERICALS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Work, Energy and Power',
    stem: 'A particle moves along the $x$-axis from $x = 0$ to $x = 4\\text{ m}$ under a variable force $F(x) = (3x^2 + 2)\\text{ N}$. The work done (in Joules) is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 72,
    explanation: '$$W = \\int_{0}^{4} (3x^2 + 2)\\,dx = \\left[x^3 + 2x\\right]_0^4 = 64 + 8 = 72\\text{ J}$$',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Numerical',
  },
  {
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Rotational Motion',
    stem: 'A uniform solid sphere of mass $M = 2\\text{ kg}$ and radius $R = 0.5\\text{ m}$ rolls without slipping on a flat horizontal surface with center-of-mass speed $v = 5\\text{ m/s}$. Its total kinetic energy (in Joules) is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 35,
    explanation: 'Total rolling kinetic energy $K = \\frac{1}{2}Mv^2\\left(1 + \\frac{k^2}{R^2}\\right) = \\frac{1}{2}(2)(25)\\left(1 + \\frac{2}{5}\\right) = 35\\text{ J}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2025 Numerical',
  },
  {
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Current Electricity',
    stem: 'Two identical resistors of $12\\,\\Omega$ each are connected in parallel across an ideal $24\\text{ V}$ DC battery. The total electric current (in Amperes) drawn from the battery is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 4,
    explanation: 'Equivalent resistance $R_{\\text{eq}} = \\frac{12}{2} = 6\\,\\Omega$. By Ohm’s law, $I = \\frac{24}{6} = 4\\text{ A}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023 Numerical',
  },
  {
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Ray & Wave Optics',
    stem: 'A thin converging convex lens of focal length $f = 20\\text{ cm}$ in air forms a real, inverted image of the exact same size as a real object placed perpendicular to the principal axis. The distance (in cm) between the object and the image is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 80,
    explanation: 'Magnification $m = -1$ occurs at $u = -2f = -40\\text{ cm}$ and $v = +2f = +40\\text{ cm}$, so separation is $4f = 80\\text{ cm}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Numerical',
  },
  {
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Modern Physics',
    stem: 'A freshly prepared radioactive sample has initial activity $A_0 = 640\\text{ Bq}$ and a half-life $T_{1/2} = 10\\text{ min}$. The activity of the sample (in Bq) after $t = 30\\text{ min}$ is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 80,
    explanation: 'Number of half-lives $n = \\frac{30}{10} = 3$. Activity $A = \\frac{640}{2^3} = 80\\text{ Bq}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2025 Numerical',
  },
];

// Full 20 unique Chemistry Section A MCQs (Q26–Q45), balanced across correctIndex 0..3
const BASE_CHEM_MCQS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'd & f Block Elements',
    stem: 'Which of the following 3d-series ions has the maximum spin-only magnetic moment ($\\mu_{\\text{spin}} = \\sqrt{n(n+2)}\\text{ BM}$)?',
    options: ['$\\text{Sc}^{3+}$', '$\\text{Ti}^{3+}$', '$\\text{Mn}^{2+}$', '$\\text{Zn}^{2+}$'],
    correctIndex: 2,
    explanation: '$\\text{Mn}^{2+}$ ($[\\text{Ar}]\\,3d^5$) has $n = 5$ unpaired electrons $\\implies \\mu = \\sqrt{35} \\approx 5.92\\text{ BM}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Shift 1',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Electrochemistry',
    stem: 'For the cell reaction $\\text{Zn(s)} + \\text{Cu}^{2+}(0.01\\text{ M}) \\to \\text{Zn}^{2+}(1.0\\text{ M}) + \\text{Cu(s)}$ with $E^\\circ_{\\text{cell}} = 1.10\\text{ V}$ at $298\\text{ K}$, the EMF $E_{\\text{cell}}$ is approximately:',
    options: ['$1.16\\text{ V}$', '$1.10\\text{ V}$', '$0.98\\text{ V}$', '$1.04\\text{ V}$'],
    correctIndex: 3,
    explanation: '$E_{\\text{cell}} = 1.10 - \\frac{0.0591}{2}\\log_{10}(100) \\approx 1.04\\text{ V}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Shift 2',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Bonding & VSEPR',
    stem: 'Which of the following molecules has a T-shaped geometry according to VSEPR theory?',
    options: ['$\\text{ClF}_3$', '$\\text{BF}_3$', '$\\text{SF}_4$', '$\\text{XeF}_4$'],
    correctIndex: 0,
    explanation: '$\\text{ClF}_3$ has $3$ bond pairs and $2$ equatorial lone pairs ($sp^3d$), yielding a bent T-shaped molecular geometry.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Coordination Compounds',
    stem: 'The crystal field stabilization energy (CFSE) for a high-spin $d^4$ octahedral complex is:',
    options: ['$-1.6\\,\\Delta_o + P$', '$-0.6\\,\\Delta_o$', '$-1.2\\,\\Delta_o$', '$-0.4\\,\\Delta_o$'],
    correctIndex: 1,
    explanation: 'For high-spin $d^4$ ($t_{2g}^3 e_g^1$), $\\text{CFSE} = 3(-0.4\\,\\Delta_o) + 1(+0.6\\,\\Delta_o) = -0.6\\,\\Delta_o$.',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Thermodynamics',
    stem: 'For a spontaneous process at constant temperature and pressure, the Gibbs free energy change satisfies:',
    options: ['$\\Delta G_{T,P} > 0$', '$\\Delta G_{T,P} = 0$', '$\\Delta G_{T,P} < 0$', '$\\Delta H > 0$'],
    correctIndex: 2,
    explanation: 'At constant $T$ and $P$, thermodynamic spontaneity requires $\\Delta G = \\Delta H - T\\Delta S < 0$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Atomic Structure',
    stem: 'The total number of radial nodes present in a $4p$ atomic orbital is:',
    options: ['$1$', '$3$', '$4$', '$2$'],
    correctIndex: 3,
    explanation: 'Number of radial nodes $= n - l - 1 = 4 - 1 - 1 = 2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical & Ionic Equilibrium',
    stem: 'At $298\\text{ K}$, the conjugate base of the weak Brønsted acid $\\text{H}_2\\text{PO}_4^-$ is:',
    options: ['$\\text{HPO}_4^{2-}$', '$\\text{H}_3\\text{PO}_4$', '$\\text{PO}_4^{3-}$', '$\\text{OH}^-$'],
    correctIndex: 0,
    explanation: 'Removing one proton ($\\text{H}^+$) from $\\text{H}_2\\text{PO}_4^-$ yields its conjugate base $\\text{HPO}_4^{2-}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Kinetics',
    stem: 'The units of the rate constant $k$ for a second-order chemical reaction (concentration in $\\text{mol L}^{-1}$, time in $\\text{s}$) are:',
    options: [
      '$\\text{s}^{-1}$',
      '$\\text{L mol}^{-1}\\text{s}^{-1}$',
      '$\\text{mol L}^{-1}\\text{s}^{-1}$',
      '$\\text{L}^2\\text{mol}^{-2}\\text{s}^{-1}$',
    ],
    correctIndex: 1,
    explanation: 'For order $n$, units of $k$ are $(\\text{mol L}^{-1})^{1-n}\\text{s}^{-1}$. With $n = 2$, units are $\\text{L mol}^{-1}\\text{s}^{-1}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Solutions & Colligative Properties',
    stem: 'Which aqueous solution of $0.1\\text{ M}$ concentration has the lowest freezing point (assuming complete dissociation)?',
    options: [
      '$0.1\\text{ M Glucose}$',
      '$0.1\\text{ M NaCl}$',
      '$0.1\\text{ M Al}_2(\\text{SO}_4)_3$',
      '$0.1\\text{ M MgCl}_2$',
    ],
    correctIndex: 2,
    explanation: '$\\Delta T_f = i K_f m$. $\\text{Al}_2(\\text{SO}_4)_3$ provides the maximum van’t Hoff factor $i = 5$, causing the greatest freezing point depression.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2025',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Classification of Elements & Periodicity',
    stem: 'Which of the following Period-2 elements exhibits the highest negative electron gain enthalpy magnitude?',
    options: ['Carbon', 'Nitrogen', 'Oxygen', 'Fluorine'],
    correctIndex: 3,
    explanation: 'Across Period 2, non-metallic character peaks at Fluorine ($-328\\text{ kJ/mol}$), which releases the most energy on accepting an electron.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'p-Block Elements',
    stem: 'The correct order of thermal stability of Group-15 hydrides is:',
    options: [
      '$\\text{NH}_3 > \\text{PH}_3 > \\text{AsH}_3 > \\text{SbH}_3$',
      '$\\text{SbH}_3 > \\text{AsH}_3 > \\text{PH}_3 > \\text{NH}_3$',
      '$\\text{PH}_3 > \\text{NH}_3 > \\text{AsH}_3 > \\text{SbH}_3$',
      '$\\text{AsH}_3 > \\text{PH}_3 > \\text{NH}_3 > \\text{SbH}_3$',
    ],
    correctIndex: 0,
    explanation: 'Down Group 15, central atom size increases and $\\text{E–H}$ bond dissociation enthalpy decreases, lowering thermal stability.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Coordination Compounds',
    stem: 'How many geometrical isomers are possible for the square planar complex $[\\text{Pt(NH}_3)_2\\text{Cl}_2]$?',
    options: ['$1$', '$2$', '$3$', '$4$'],
    correctIndex: 1,
    explanation: 'Type $\\text{Ma}_2\\text{b}_2$ square planar complexes form exactly $2$ geometrical isomers: cis and trans.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'General Organic Chemistry (GOC)',
    stem: 'Which of the following carbocations is the most stable in gas phase / polar protic medium?',
    options: [
      '$\\text{CH}_3^+$',
      '$\\text{CH}_3\\text{CH}_2^+$',
      '$(\\text{CH}_3)_3\\text{C}^+$',
      '$(\\text{CH}_3)_2\\text{CH}^+$',
    ],
    correctIndex: 2,
    explanation: 'The tert-butyl carbocation $(\\text{CH}_3)_3\\text{C}^+$ is stabilised by $9$ $\\alpha$-C–H hyperconjugation structures plus $+I$ effect.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Hydrocarbons',
    stem: 'Ozonolysis of 2-butene ($\\text{CH}_3\\text{CH}=\\text{CHCH}_3$) followed by reductive workup with $\\text{Zn}/\\text{H}_2\\text{O}$ exclusively produces:',
    options: [
      'Formaldehyde only',
      'Acetone only',
      'Propionaldehyde',
      'Acetaldehyde ($\\text{CH}_3\\text{CHO}$)',
    ],
    correctIndex: 3,
    explanation: 'Cleaving the symmetric double bond in 2-butene gives two moles of ethanal (acetaldehyde).',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Haloalkanes & Haloarenes',
    stem: 'Heating chlorobenzene with aqueous $\\text{NaOH}$ at $623\\text{ K}$ and $300\\text{ atm}$ pressure followed by acidification (Dow’s process) yields:',
    options: ['Phenol', 'Benzene', 'Aniline', 'Benzyl alcohol'],
    correctIndex: 0,
    explanation: 'Aromatic nucleophilic substitution via benzyne/addition-elimination converts chlorobenzene into sodium phenoxide and then phenol.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Alcohols, Phenols and Ethers',
    stem: 'Which reagent distinguishes between primary ($1^\\circ$), secondary ($2^\\circ$), and tertiary ($3^\\circ$) alcohols at room temperature via turbidity rate?',
    options: [
      'Tollens’ reagent',
      'Lucas reagent ($\\text{conc. HCl} + \\text{anhyd. ZnCl}_2$)',
      'Fehling’s solution',
      'Bromine water',
    ],
    correctIndex: 1,
    explanation: 'In the Lucas test, $3^\\circ$ alcohols turn turbid immediately, $2^\\circ$ in ~5 min, and $1^\\circ$ show no turbidity at room temperature.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2025',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Aldehydes, Ketones & Carboxylic Acids',
    stem: 'Which of the following aldehydes undergoes Cannizzaro disproportionation reaction on heating with concentrated $\\text{NaOH}$?',
    options: [
      '$\\text{CH}_3\\text{CHO}$',
      '$\\text{CH}_3\\text{CH}_2\\text{CHO}$',
      '$\\text{HCHO}$ (Formaldehyde)',
      '$\\text{CH}_3\\text{COCH}_3$',
    ],
    correctIndex: 2,
    explanation: 'Cannizzaro reaction occurs exclusively with aldehydes lacking $\\alpha$-hydrogen atoms, such as $\\text{HCHO}$ and $\\text{C}_6\\text{H}_5\\text{CHO}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Amines',
    stem: 'In aqueous solution, which of the following ethylamines exhibits the highest basic strength ($K_b$)?',
    options: [
      '$\\text{NH}_3$',
      '$\\text{C}_2\\text{H}_5\\text{NH}_2$',
      '$(\\text{C}_2\\text{H}_5)_3\\text{N}$',
      '$(\\text{C}_2\\text{H}_5)_2\\text{NH}$',
    ],
    correctIndex: 3,
    explanation: 'For ethyl-substituted amines in water, combined $+I$, solvation, and steric effects give the order $2^\\circ > 3^\\circ > 1^\\circ > \\text{NH}_3$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Biomolecules',
    stem: 'Which nitrogenous base is found in RNA but is absent from DNA?',
    options: ['Uracil', 'Adenine', 'Guanine', 'Cytosine'],
    correctIndex: 0,
    explanation: 'DNA contains Thymine, whereas RNA replaces Thymine with Uracil paired with Adenine.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Principles Related to Practical Chemistry',
    stem: 'Adding ammonium hydroxide ($\text{NH}_4\\text{OH}$) in excess to an aqueous $\\text{CuSO}_4$ solution yields a deep blue solution due to formation of:',
    options: [
      '$\\text{Cu(OH)}_2$',
      '$[\\text{Cu(NH}_3)_4]^{2+}$',
      '$\\text{CuO}$',
      '$[\\text{CuCl}_4]^{2-}$',
    ],
    correctIndex: 1,
    explanation: 'The tetraamminecopper(II) complex ion $[\\text{Cu(NH}_3)_4]^{2+}$ imparts the characteristic deep azure-blue colour.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2025',
  },
];

const BASE_CHEM_NUMERICALS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'Chemical Bonding',
    stem: 'According to VSEPR theory, the number of lone pairs on the central $\\text{S}$ atom in an $\\text{SF}_6$ molecule is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 0,
    explanation: '$\\text{SF}_6$ has 6 bond pairs and $0$ lone pairs around the central $\\text{S}$ atom ($sp^3d^2$ octahedral).',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Numerical',
  },
  {
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'Solutions & Colligative Properties',
    stem: 'An aqueous solution is prepared by dissolving $58.5\\text{ g}$ of pure $\\text{NaCl}$ (molar mass $58.5\\text{ g/mol}$) in water to make a total volume of $500\\text{ mL}$. The molarity of the solution (in $\\text{mol L}^{-1}$) is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 2,
    explanation: 'Moles $n = \\frac{58.5}{58.5} = 1\\text{ mol}$, volume $V = 0.5\\text{ L} \\implies M = \\frac{1}{0.5} = 2\\text{ M}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2025 Numerical',
  },
  {
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'Chemical Kinetics',
    stem: 'For a first-order chemical reaction with half-life $t_{1/2} = 15\\text{ min}$, the time (in minutes) required for $87.5\\%$ completion of the reactant is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 45,
    explanation: '$87.5\\%$ completion leaves $12.5\\% = (\\frac{1}{2})^3$, requiring $3$ half-lives: $t = 3 \\times 15 = 45\\text{ min}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Numerical',
  },
  {
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'Coordination Compounds',
    stem: 'The number of unpaired electrons present in the central metal ion of the high-spin octahedral complex $[\\text{Mn}(\\text{H}_2\\text{O})_6]^{2+}$ (atomic number of $\\text{Mn} = 25$) is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 5,
    explanation: '$\\text{Mn}^{2+}$ is $[\\text{Ar}]\\,3d^5$ with weak-field $\\text{H}_2\\text{O}$ ligands, leaving all $5$ electrons unpaired.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023 Numerical',
  },
  {
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'Electrochemistry',
    stem: 'The total electric charge (in Faradays, $\\text{F}$) required to completely reduce $2\\text{ moles}$ of molten $\\text{Al}^{3+}$ ions to metallic aluminium via $\\text{Al}^{3+} + 3e^- \\to \\text{Al}$ is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 6,
    explanation: 'Reducing $1\\text{ mol}$ of $\\text{Al}^{3+}$ requires $3\\text{ F}$, so $2\\text{ mol}$ requires $2 \\times 3 = 6\\text{ F}$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2025 Numerical',
  },
];

// Full 20 unique Mathematics Section A MCQs (Q51–Q70), balanced across correctIndex 0..3
const BASE_MATH_MCQS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Matrices and Determinants',
    stem: 'If $A$ is a $3 \\times 3$ non-singular matrix such that $|A| = 5$, then $|\\text{adj}(A)|$ is equal to:',
    options: ['$5$', '$25$', '$125$', '$1/5$'],
    correctIndex: 1,
    explanation: 'For an $n \\times n$ matrix $A$, $|\\text{adj}(A)| = |A|^{n-1} = 5^{3-1} = 25$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Shift 1',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Limits, Continuity & Differentiability',
    stem: 'Evaluate the limit $\\lim_{x \\to 0} \\frac{\\sin(5x)}{x}$:',
    options: ['$0$', '$1$', '$5$', '$1/5$'],
    correctIndex: 2,
    explanation: '$$\\lim_{x \\to 0} 5 \\cdot \\frac{\\sin(5x)}{5x} = 5 \\times 1 = 5$$',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Definite Integration',
    stem: 'The value of the definite integral $I = \\int_{-\\pi/2}^{\\pi/2} \\sin^5(x)\\,dx$ is:',
    options: ['$1$', '$2/5$', '$\\pi/2$', '$0$'],
    correctIndex: 3,
    explanation: 'Since $\\sin^5(x)$ is an odd function integrated symmetrically on $[-\\pi/2, \\pi/2]$, $I = 0$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Shift 2',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Quadratic Equations & Maxima-Minima',
    stem: 'If $f(x) = x^2 - 4x + 5$ for $x \\in \\mathbb{R}$, then the minimum value of $f(x)$ is:',
    options: ['$1$', '$0$', '$2$', '$4$'],
    correctIndex: 0,
    explanation: 'Completing the square: $f(x) = (x - 2)^2 + 1 \\ge 1$, attained at $x = 2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Conic Sections',
    stem: 'The length of the latus rectum of the standard parabola $y^2 = 16x$ is:',
    options: ['$4$', '$16$', '$8$', '$32$'],
    correctIndex: 1,
    explanation: 'For $y^2 = 4ax$, the length of the latus rectum is $4a = 16$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Sets, Relations and Functions',
    stem: 'If a finite set $A$ has $4$ elements and set $B$ has $3$ elements, the total number of functions from $A$ into $B$ is:',
    options: ['$64$', '$12$', '$81$', '$24$'],
    correctIndex: 2,
    explanation: 'Each of the $4$ elements in $A$ can map independently to any of the $3$ elements in $B$: $3^4 = 81$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Complex Numbers & Quadratic Equations',
    stem: 'What is the principal argument $\\arg(z)$ of the complex number $z = -1 + i\\sqrt{3}$?',
    options: ['$\\frac{\\pi}{3}$', '$-\\frac{\\pi}{3}$', '$\\frac{5\\pi}{6}$', '$\\frac{2\\pi}{3}$'],
    correctIndex: 3,
    explanation: '$z$ lies in Quadrant II with $\\tan\\alpha = \\sqrt{3} \\implies \\alpha = \\pi/3$, so $\\arg(z) = \\pi - \\frac{\\pi}{3} = \\frac{2\\pi}{3}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Permutations and Combinations',
    stem: 'The number of ways in which $6$ distinct people can be seated around a circular table is:',
    options: ['$120$', '$720$', '$240$', '$60$'],
    correctIndex: 0,
    explanation: 'Circular permutations of $n$ distinct objects is $(n - 1)! = 5! = 120$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Binomial Theorem',
    stem: 'The term independent of $x$ in the expansion of $\\left(x^2 + \\frac{1}{x}\\right)^6$ is:',
    options: ['$20$', '$15$', '$6$', '$30$'],
    correctIndex: 1,
    explanation: '$T_{r+1} = \\binom{6}{r} x^{12-3r}$. Setting $12 - 3r = 0 \\implies r = 4$, giving $\\binom{6}{4} = 15$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Sequences and Series',
    stem: 'The sum to infinity of the geometric series $1 + \\frac{1}{3} + \\frac{1}{9} + \\frac{1}{27} + \\dots$ is:',
    options: ['$2$', '$4/3$', '$3/2$', '$5/4$'],
    correctIndex: 2,
    explanation: '$S_\\infty = \\frac{a}{1 - r} = \\frac{1}{1 - 1/3} = \\frac{3}{2}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Limits, Continuity & Differentiability',
    stem: 'If $y = x^x$ for $x > 0$, then the derivative $\\frac{dy}{dx}$ at $x = 1$ is:',
    options: ['$0$', '$e$', '$2$', '$1$'],
    correctIndex: 3,
    explanation: '$\\frac{d}{dx}(x^x) = x^x(1 + \\ln x)$. Evaluating at $x = 1$ yields $1^1(1 + 0) = 1$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Application of Derivatives',
    stem: 'The slope of the normal to the curve $y = x^3 - 2x + 1$ at the point $(1, 0)$ is:',
    options: ['$-1$', '$1$', '$2$', '$-1/2$'],
    correctIndex: 0,
    explanation: '$dy/dx = 3x^2 - 2 = 1$ at $x = 1$, so normal slope $= -1 / 1 = -1$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Indefinite Integration',
    stem: 'Evaluate the integral $\\int \\frac{e^x (1 + x)}{\\cos^2(x e^x)}\\,dx$:',
    options: [
      '$\\cot(x e^x) + C$',
      '$\\tan(x e^x) + C$',
      '$\\sec(x e^x) + C$',
      '$\\sin(x e^x) + C$',
    ],
    correctIndex: 1,
    explanation: 'Substitute $t = xe^x \\implies dt = e^x(1 + x)\\,dx$. Integral becomes $\\int \\sec^2 t\\,dt = \\tan(xe^x) + C$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Differential Equations',
    stem: 'The integrating factor of the linear differential equation $x\\frac{dy}{dx} + 2y = x^2$ ($x > 0$) is:',
    options: ['$e^{2x}$', '$x$', '$x^2$', '$2\\ln x$'],
    correctIndex: 2,
    explanation: 'Standard form: $\\frac{dy}{dx} + \\frac{2}{x}y = x$, so $\\text{IF} = e^{\\int \\frac{2}{x}dx} = e^{2\\ln x} = x^2$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2025',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Straight Lines & Circles',
    stem: 'The radius of the circle $x^2 + y^2 - 6x + 8y - 11 = 0$ is:',
    options: ['$4$', '$5$', '$\\sqrt{14}$', '$6$'],
    correctIndex: 3,
    explanation: '$g = -3, f = 4, c = -11 \\implies r = \\sqrt{g^2 + f^2 - c} = \\sqrt{9 + 16 + 11} = \\sqrt{36} = 6$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Conic Sections',
    stem: 'For the ellipse $\\frac{x^2}{25} + \\frac{y^2}{9} = 1$, the eccentricity $e$ is:',
    options: ['$4/5$', '$3/5$', '$5/4$', '$3/4$'],
    correctIndex: 0,
    explanation: '$a^2 = 25, b^2 = 9 \\implies e = \\sqrt{1 - \\frac{b^2}{a^2}} = \\sqrt{1 - \\frac{9}{25}} = \\frac{4}{5}$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Vector Algebra & 3D Geometry',
    stem: 'If the vectors $\\vec{a} = 2\\hat{i} + \\lambda\\hat{j} + \\hat{k}$ and $\\vec{b} = \\hat{i} - 2\\hat{j} + 3\\hat{k}$ are orthogonal, then $\\lambda$ equals:',
    options: ['$2$', '$5/2$', '$-5/2$', '$3$'],
    correctIndex: 1,
    explanation: 'Orthogonality gives $\\vec{a}\\cdot\\vec{b} = 2 - 2\\lambda + 3 = 0 \\implies 2\\lambda = 5 \\implies \\lambda = 5/2$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Probability',
    stem: 'Two fair six-sided dice are rolled simultaneously. The probability that the sum of the numbers on the top faces is $9$ is:',
    options: ['$1/12$', '$1/6$', '$1/9$', '$5/36$'],
    correctIndex: 2,
    explanation: 'Favourable pairs are $(3,6), (4,5), (5,4), (6,3)$ ($4$ out of $36$), so $P = 4/36 = 1/9$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Trigonometric Ratios & Inverse Trigonometry',
    stem: 'The principal value of $\\tan^{-1}\\left(\\tan \\frac{3\\pi}{4}\\right)$ is:',
    options: ['$\\frac{3\\pi}{4}$', '$\\frac{\\pi}{4}$', '$-\\frac{3\\pi}{4}$', '$-\\frac{\\pi}{4}$'],
    correctIndex: 3,
    explanation: 'Principal range of $\\tan^{-1}$ is $(-\\pi/2, \\pi/2)$. Since $\\tan(3\\pi/4) = \\tan(-\\pi/4) = -1$, the value is $-\\pi/4$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024',
  },
  {
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Statistics',
    stem: 'If each observation in a dataset of variance $\\sigma^2 = 9$ is multiplied by $3$ and then increased by $5$, the new variance of the dataset is:',
    options: ['$81$', '$27$', '$14$', '$86$'],
    correctIndex: 0,
    explanation: 'Variance is independent of change of origin ($+5$) and scales by $k^2 = 3^2 = 9$: new variance $= 9 \\times 9 = 81$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2025',
  },
];

const BASE_MATH_NUMERICALS: Omit<CBTQuestion, 'id' | 'number'>[] = [
  {
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Vector Algebra & 3D Geometry',
    stem: 'If $|\\vec{a}| = 3$, $|\\vec{b}| = 4$ and $|\\vec{a} + \\vec{b}| = 5$, then the numerical value of $|\\vec{a} - \\vec{b}|$ is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 5,
    explanation: '$$|\\vec{a} + \\vec{b}|^2 + |\\vec{a} - \\vec{b}|^2 = 2(|\\vec{a}|^2 + |\\vec{b}|^2) \\implies 25 + |\\vec{a} - \\vec{b}|^2 = 50 \\implies |\\vec{a} - \\vec{b}| = 5$$',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2024 Numerical',
  },
  {
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Sequences and Series',
    stem: 'The sum of the first $10$ terms of the arithmetic progression $2, 5, 8, 11, \\dots$ is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 155,
    explanation: 'Here $a = 2, d = 3, n = 10$. $S_{10} = \\frac{10}{2}\\left[4 + 9(3)\\right] = 5 \\times 31 = 155$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2025 Numerical',
  },
  {
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Matrices and Determinants',
    stem: 'If $A$ is a $3 \\times 3$ square matrix satisfying $\\det(A) = 3$, then the value of $\\det(2A)$ is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 24,
    explanation: 'For a $3 \\times 3$ matrix, $\\det(2A) = 2^3\\det(A) = 8 \\times 3 = 24$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2024 Numerical',
  },
  {
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Permutations and Combinations',
    stem: 'The total number of distinct $5$-letter arrangements (with or without meaning) that can be formed using all the letters of the word $\\text{APPLE}$ is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 60,
    explanation: 'The word $\\text{APPLE}$ has $5$ letters with $\\text{P}$ repeated twice: $\\frac{5!}{2!} = 60$.',
    difficultyBucket: 'Beginner',
    pyqTag: 'JEE Main 2023 Numerical',
  },
  {
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Application of Derivatives',
    stem: 'If $f(x) = x^3 - 6x^2 + 9x + 7$, then the value of the first derivative $f\'(4)$ is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 9,
    explanation: '$f\'(x) = 3x^2 - 12x + 9 \\implies f\'(4) = 48 - 48 + 9 = 9$.',
    difficultyBucket: 'Must-Do',
    pyqTag: 'JEE Main 2025 Numerical',
  },
];

/**
 * Generates a full 75-Question NTA JEE Main 2027 Blueprint Mock with 75 strictly unique questions:
 * - Q1–Q20: Physics Section A (20 unique MCQs, +4/-1)
 * - Q21–Q25: Physics Section B (5 unique Compulsory Numericals, +4/-1)
 * - Q26–Q45: Chemistry Section A (20 unique MCQs, +4/-1)
 * - Q46–Q50: Chemistry Section B (5 unique Compulsory Numericals, +4/-1)
 * - Q51–Q70: Mathematics Section A (20 unique MCQs, +4/-1)
 * - Q71–Q75: Mathematics Section B (5 unique Compulsory Numericals, +4/-1)
 */
export function buildFull75JeeMainQuestions(): CBTQuestion[] {
  const result: CBTQuestion[] = [];
  let qNum = 1;

  const appendSubjectQuestions = (
    mcqs: Omit<CBTQuestion, 'id' | 'number'>[],
    nums: Omit<CBTQuestion, 'id' | 'number'>[]
  ) => {
    for (let i = 0; i < 20; i++) {
      const tpl = mcqs[i];
      result.push({
        ...tpl,
        id: `q${qNum}`,
        number: qNum,
        examType: 'JEE Main',
        examVersion: 'jee-main-2027-paper1',
        provenanceType: 'RECONSTRUCTED_WITH_SOURCE',
        verificationStatus: 'reconstructed',
      });
      qNum++;
    }
    for (let i = 0; i < 5; i++) {
      const tpl = nums[i];
      const baseAns = tpl.numericalAnswer ?? 5;
      result.push({
        ...tpl,
        id: `q${qNum}`,
        number: qNum,
        examType: 'JEE Main',
        examVersion: 'jee-main-2027-paper1',
        section: 'Section B',
        advancedFormat: 'numerical',
        options: [],
        provenanceType: 'RECONSTRUCTED_WITH_SOURCE',
        verificationStatus: 'reconstructed',
        numericalAnswer: baseAns,
      });
      qNum++;
    }
  };

  appendSubjectQuestions(BASE_PHYSICS_MCQS, BASE_PHYSICS_NUMERICALS);
  appendSubjectQuestions(BASE_CHEM_MCQS, BASE_CHEM_NUMERICALS);
  appendSubjectQuestions(BASE_MATH_MCQS, BASE_MATH_NUMERICALS);

  return result;
}

export const CBT_MOCK_QUESTIONS: CBTQuestion[] = buildFull75JeeMainQuestions();

export const JEE_ADVANCED_PAPER_QUESTIONS: CBTQuestion[] = [
  {
    id: 'adv-q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Paper 1',
    stem: '[One or More Than One Correct (+4 / -2 / Partial)] A uniform disc of mass $M$ and radius $R$ rolls without slipping on a rough horizontal surface with center-of-mass velocity $v_0$. Which of the following statements are correct?',
    options: [
      'Speed of the topmost point is $2v_0$',
      'Speed of the point of contact with the ground is $0$',
      'Total kinetic energy of the rolling disc is $\\frac{3}{4}Mv_0^2$',
      'Angular momentum about the point of contact is $\\frac{1}{2}MRv_0$',
    ],
    correctIndex: 0,
    correctIndices: [0, 1, 2],
    explanation: '**Pure Rolling ($v_0 = \\omega R$)**: 1) Topmost speed $= v_0 + \\omega R = 2v_0$, 2) Contact point velocity $= v_0 - \\omega R = 0$, 3) $K_{\\text{total}} = \\frac{1}{2}Mv_0^2 + \\frac{1}{2}\\left(\\frac{1}{2}MR^2\\right)\\omega^2 = \\frac{3}{4}Mv_0^2$. *(Angular momentum about contact point is $L = I_{\\text{CM}}\\omega + Mv_0R = \\frac{3}{2}MRv_0$, so D is false).*',
  },
  {
    id: 'adv-q2',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Coordination Compounds',
    examType: 'JEE Advanced',
    advancedFormat: 'multiple',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Paper 1',
    stem: '[One or More Than One Correct (+4 / -2 / Partial)] Which of the following coordination entities are diamagnetic and exhibit $d^2sp^3$ or $dsp^2$ inner-orbital hybridisation?',
    options: [
      '$[\\text{Fe(CN)}_6]^{4-}$',
      '$[\\text{Co(NH}_3)_6]^{3+}$',
      '$[\\text{Ni(CN)}_4]^{2-}$',
      '$[\\text{NiCl}_4]^{2-}$',
    ],
    correctIndex: 0,
    correctIndices: [0, 1, 2],
    explanation: '$\\text{CN}^-$ and $\\text{NH}_3$ (with $\\text{Co}^{3+}$) act as strong-field ligands causing spin pairing ($n=0$, diamagnetic). $[\\text{NiCl}_4]^{2-}$ is tetrahedral $sp^3$ with $2$ unpaired electrons (paramagnetic).',
  },
  {
    id: 'adv-q3',
    number: 3,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Matrices and Determinants',
    examType: 'JEE Advanced',
    advancedFormat: 'matrix',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Paper 2',
    matrixListI: [
      'P: $|2A|$ for $3\\times 3$ matrix $A$ with $|A|=2$',
      'Q: $|\\text{adj}(A)|$ for $3\\times 3$ matrix $A$ with $|A|=2$',
      'R: $|A^{-1}|$ for $3\\times 3$ matrix $A$ with $|A|=2$',
    ],
    matrixListII: ['1: $16$', '2: $4$', '3: $0.5$'],
    stem: '[Matrix-Match (List-I / List-II) (+3 / -1)] Let $A$ be a $3 \\times 3$ non-singular matrix with $|A| = 2$. Match List-I with List-II:',
    options: [
      'P → 2, Q → 1, R → 3',
      'P → 1, Q → 2, R → 3',
      'P → 1, Q → 3, R → 2',
      'P → 3, Q → 2, R → 1',
    ],
    correctIndex: 1,
    explanation: 'For $n=3, |A|=2$: $|2A| = 2^3|A| = 16$ (P→1); $|\\text{adj } A| = |A|^{3-1} = 4$ (Q→2); $|A^{-1}| = 1/|A| = 0.5$ (R→3).',
  },
  {
    id: 'adv-q4',
    number: 4,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Capacitance & Dielectrics',
    examType: 'JEE Advanced',
    advancedFormat: 'numerical',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Numerical',
    stem: '[Non-Negative Integer (+4 / 0)] Six identical capacitors of capacitance $C = 2\\,\\mu\\text{F}$ each are arranged in a balanced Wheatstone bridge network. The equivalent capacitance (in $\\mu\\text{F}$) between the input terminals is:',
    options: [],
    correctIndex: 0,
    numericalAnswer: 2,
    explanation: 'In a balanced 5-capacitor Wheatstone bridge where each arm is $C = 2\\,\\mu\\text{F}$, the central bridge capacitor carries zero charge, so $C_{\\text{eq}} = C = 2\\,\\mu\\text{F}$.',
  },
  {
    id: 'adv-q5',
    number: 5,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Thermodynamics & Kinetic Theory of Gases',
    examType: 'JEE Advanced',
    advancedFormat: 'paragraph',
    difficultyBucket: 'Advanced Climb',
    pyqTag: 'JEE Advanced Comprehension Pair',
    paragraphContext:
      'PARAGRAPH FOR Q5: One mole of an ideal monatomic gas ($\\gamma = 5/3$) undergoes a reversible cyclic process $A \\to B \\to C \\to A$. Process $A \\to B$ is an isothermal expansion at temperature $T_0 = 300\\text{ K}$ from volume $V_0$ to $2V_0$. Process $B \\to C$ is an isochoric cooling, and $C \\to A$ is an adiabatic compression back to the initial state.',
    stem: '[Paragraph / Comprehension Linked (+3 / -1)] The work done by the gas during the isothermal expansion $A \\to B$ is:',
    options: [
      '$500R\\ln 2$',
      '$150R\\ln 2$',
      '$300R\\ln 2$',
      '$600R\\ln 2$',
    ],
    correctIndex: 2,
    explanation: 'For reversible isothermal expansion of $n = 1$ mole at $T_0 = 300\\text{ K}$: $W_{AB} = nRT_0\\ln\\left(\\frac{V_B}{V_A}\\right) = 300R\\ln 2$.',
  },
];

export const NEET_UG_PAPER_QUESTIONS: CBTQuestion[] = [
  {
    id: 'neet-q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Current Electricity & Electrical Measuring Instruments',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Pattern (+4 / -1)',
    stem: '[NEET UG Physics (+4 / -1)] Three resistors of $2\\,\\Omega, 3\\,\\Omega$, and $6\\,\\Omega$ are connected in parallel across a $6\\text{ V}$ ideal battery. The total current drawn from the battery is:',
    options: ['$3\\text{ A}$', '$6\\text{ A}$', '$1\\text{ A}$', '$9\\text{ A}$'],
    correctIndex: 1,
    explanation: '$$\\frac{1}{R_{\\text{eq}}} = \\frac{1}{2} + \\frac{1}{3} + \\frac{1}{6} = 1\\,\\Omega^{-1} \\implies R_{\\text{eq}} = 1\\,\\Omega, \\quad I = \\frac{V}{R_{\\text{eq}}} = \\frac{6}{1} = 6\\text{ A}$$',
  },
  {
    id: 'neet-q2',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Bonding & Molecular Structure (VSEPR & MOT)',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Pattern (+4 / -1)',
    stem: '[NEET UG Chemistry (+4 / -1)] Which of the following pairs of species have identical bond order according to Molecular Orbital Theory?',
    options: [
      '$\\text{O}_2^-$ and $\\text{NO}^+$',
      '$\\text{N}_2$ and $\\text{O}_2^{2-}$',
      '$\\text{CN}^-$ and $\\text{CO}$',
      '$\\text{B}_2$ and $\\text{C}_2$',
    ],
    correctIndex: 2,
    explanation: 'Both $\\text{CN}^-$ ($14\\,e^-$) and $\\text{CO}$ ($14\\,e^-$) are isoelectronic with $\\text{N}_2$ and have a bond order of $3.0$.',
  },
  {
    id: 'neet-q3',
    number: 3,
    subject: 'Chemistry',
    subTrackLabel: 'Biology (Botany & Zoology)',
    section: 'Section A',
    chapter: 'Amines, Diazonium Salts, Biomolecules & Practical Organic Chemistry',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Biology / Biomolecules (+4 / -1)',
    stem: '[NEET UG Biology — Genetics & Molecular Biology (+4 / -1)] In a double-stranded DNA molecule, if Cytosine ($C$) constitutes $30\\%$ of the total nitrogenous bases, what is the percentage of Thymine ($T$) according to Chargaff’s rule?',
    options: ['$20\\%$', '$30\\%$', '$40\\%$', '$60\\%$'],
    correctIndex: 0,
    explanation: 'By Chargaff’s equivalence rule, $G = C = 30\\%$, so $G + C = 60\\%$. The remaining $A + T = 40\\%$, and since $A = T$, Thymine $T = 20\\%$.',
  },
  {
    id: 'neet-q4',
    number: 4,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Modern Physics (Dual Nature, Atoms, Nuclei & Semiconductors)',
    examType: 'NEET UG',
    difficultyBucket: 'Beginner',
    pyqTag: 'NEET UG Pattern (+4 / -1)',
    stem: '[NEET UG Physics (+4 / -1)] The half-life of a radioactive isotope is $15\\text{ minutes}$. What fraction of the initial undecayed nuclei remains after $60\\text{ minutes}$?',
    options: ['$\\frac{1}{8}$', '$\\frac{1}{4}$', '$\\frac{1}{32}$', '$\\frac{1}{16}$'],
    correctIndex: 3,
    explanation: 'Number of half-lives $n = \\frac{t}{T_{1/2}} = \\frac{60}{15} = 4$. Remaining fraction $\\frac{N}{N_0} = \\left(\\frac{1}{2}\\right)^4 = \\frac{1}{16}$.',
  },
  {
    id: 'neet-q5',
    number: 5,
    subject: 'Chemistry',
    subTrackLabel: 'Biology (Botany & Zoology)',
    section: 'Section A',
    chapter: 'Chemical Kinetics & Nuclear Chemistry',
    examType: 'NEET UG',
    difficultyBucket: 'Must-Do',
    pyqTag: 'NEET UG Biology / Enzyme Kinetics (+4 / -1)',
    stem: '[NEET UG Biology — Enzyme Catalysis (+4 / -1)] In competitive inhibition of an enzyme-catalyzed reaction, the inhibitor binds to the active site and alters the kinetic parameters such that:',
    options: [
      'Both $K_m$ and $V_{\\max}$ decrease',
      'Apparent $K_m$ increases while $V_{\\max}$ remains unchanged',
      'Apparent $K_m$ remains unchanged while $V_{\\max}$ decreases',
      'Apparent $K_m$ decreases while $V_{\\max}$ increases',
    ],
    correctIndex: 1,
    explanation: 'A competitive inhibitor competes with the substrate for the active site, increasing apparent $K_m$, while high substrate concentration can still achieve the same $V_{\\max}$.',
  },
];

export const BITSAT_PAPER_QUESTIONS: CBTQuestion[] = [
  {
    id: 'bitsat-q1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Kinematics (1D & 2D Projectile Motion)',
    examType: 'BITSAT',
    difficultyBucket: 'Must-Do',
    pyqTag: 'BITSAT Speed CBT (+3 / -1)',
    stem: '[BITSAT Physics (+3 / -1)] A projectile has the same horizontal range $R$ for two angles of projection $\\theta_1$ and $\\theta_2$. If $t_1$ and $t_2$ are the respective times of flight, then $t_1 t_2$ is equal to:',
    options: ['$\\frac{R}{g}$', '$\\frac{4R}{g}$', '$\\frac{2R}{g}$', '$\\frac{R}{2g}$'],
    correctIndex: 2,
    explanation: 'For complementary angles $\\theta_2 = 90^\\circ - \\theta_1$: $t_1 t_2 = \\frac{2u\\sin\\theta_1}{g}\\cdot\\frac{2u\\cos\\theta_1}{g} = \\frac{2}{g}\\left(\\frac{u^2\\sin 2\\theta_1}{g}\\right) = \\frac{2R}{g}$.',
  },
  {
    id: 'bitsat-q2',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Solutions & Colligative Properties',
    examType: 'BITSAT',
    difficultyBucket: 'Must-Do',
    pyqTag: 'BITSAT Speed CBT (+3 / -1)',
    stem: '[BITSAT Chemistry (+3 / -1)] Assuming $100\\%$ ionization in dilute aqueous solution, which of the following $0.1\\text{ M}$ solutions exhibits the highest boiling point?',
    options: [
      '$\\text{Al}_2(\\text{SO}_4)_3$',
      '$\\text{BaCl}_2$',
      '$\\text{NaCl}$',
      '$\\text{C}_6\\text{H}_{12}\\text{O}_6$ (Glucose)',
    ],
    correctIndex: 0,
    explanation: '$\\text{Al}_2(\\text{SO}_4)_3$ dissociates into $5$ ions ($i = 5$), giving the maximum elevation in boiling point $\\Delta T_b = i K_b m$.',
  },
  {
    id: 'bitsat-q3',
    number: 3,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Limits, Continuity & Differentiability',
    examType: 'BITSAT',
    difficultyBucket: 'Must-Do',
    pyqTag: 'BITSAT Speed CBT (+3 / -1)',
    stem: '[BITSAT Mathematics (+3 / -1)] The value of $\\lim_{x \\to 0} \\frac{1 - \\cos(2x)}{x^2}$ is:',
    options: ['$1$', '$2$', '$4$', '$0$'],
    correctIndex: 1,
    explanation: '$$\\lim_{x \\to 0} \\frac{2\\sin^2 x}{x^2} = 2\\left(\\lim_{x \\to 0}\\frac{\\sin x}{x}\\right)^2 = 2$$',
  },
  {
    id: 'bitsat-q4',
    number: 4,
    subject: 'Mathematics',
    subTrackLabel: 'English & Logical Reasoning',
    section: 'Section A',
    chapter: 'Sequences, Series, Sets & Trigonometry',
    examType: 'BITSAT',
    difficultyBucket: 'Beginner',
    pyqTag: 'BITSAT Logical Reasoning (+3 / -1)',
    stem: '[BITSAT Logical Reasoning (+3 / -1)] Find the missing number in the series: $3, 10, 29, 66, 127, ?$',
    options: ['$216$', '$220$', '$198$', '$218$'],
    correctIndex: 3,
    explanation: 'Pattern is $n^3 + 2$ for $n = 1, 2, 3, 4, 5, 6$: $6^3 + 2 = 216 + 2 = 218$.',
  },
];

// Clean initial CBT responses: Q1 visited (not_answered), all others not_visited
export const INITIAL_CBT_RESPONSES: Record<string, QuestionResponseState> = {
  q1: { status: 'not_answered', selectedOption: null, timeSpentSec: 0 },
};

export const OFFICIAL_PAPERS_LIST = [
  {
    id: 'jee-2026-s1-sh1',
    paper: 'JEE Main 2026 Session 1 Shift 1 (Jan 22 Morning)',
    year: '2026',
    session: 'Session 1',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2026-s1-sh2',
    paper: 'JEE Main 2026 Session 1 Shift 2 (Jan 24 Evening)',
    year: '2026',
    session: 'Session 1',
    shift: 'Shift 2',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2026-s2-sh1',
    paper: 'JEE Main 2026 Session 2 Shift 1 (Apr 02 Morning)',
    year: '2026',
    session: 'Session 2',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-adv-2026-p1',
    paper: 'JEE Advanced 2026 Paper 1 (Multi-Choice & Integer)',
    year: '2026',
    session: 'Paper 1',
    shift: 'Morning',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2025-s1-sh1',
    paper: 'JEE Main 2025 Session 1 Shift 1 (75 Qs · New Pattern)',
    year: '2025',
    session: 'Session 1',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2025-s1-sh2',
    paper: 'JEE Main 2025 Session 1 Shift 2 (Jan 23 Evening)',
    year: '2025',
    session: 'Session 1',
    shift: 'Shift 2',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2025-s2-sh1',
    paper: 'JEE Main 2025 Session 2 Shift 1 (Apr 04 Morning)',
    year: '2025',
    session: 'Session 2',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-adv-2025-p1',
    paper: 'JEE Advanced 2025 Paper 1 (Multi-Correct & Numerical)',
    year: '2025',
    session: 'Paper 1',
    shift: 'Morning',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-adv-2025-p2',
    paper: 'JEE Advanced 2025 Paper 2 (Paragraph & Integer)',
    year: '2025',
    session: 'Paper 2',
    shift: 'Afternoon',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2024-s1-sh1',
    paper: 'JEE Main 2024 Session 1 Shift 1 (Jan 27 Morning)',
    year: '2024',
    session: 'Session 1',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2024-s2-sh1',
    paper: 'JEE Main 2024 Session 2 Shift 1 (Apr 05 Morning)',
    year: '2024',
    session: 'Session 2',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2024-s2-sh2',
    paper: 'JEE Main 2024 Session 2 Shift 2 (Apr 08 Evening)',
    year: '2024',
    session: 'Session 2',
    shift: 'Shift 2',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-adv-2024-p1',
    paper: 'JEE Advanced 2024 Paper 1 (Multi-Choice & Matrix)',
    year: '2024',
    session: 'Paper 1',
    shift: 'Morning',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2023-s1-sh1',
    paper: 'JEE Main 2023 Session 1 Shift 1 (Jan 24 Morning)',
    year: '2023',
    session: 'Session 1',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2023-s2-sh1',
    paper: 'JEE Main 2023 Session 2 Shift 1 (Apr 06 Morning)',
    year: '2023',
    session: 'Session 2',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-adv-2023-p1',
    paper: 'JEE Advanced 2023 Paper 1 (Calculus & Electrodynamics)',
    year: '2023',
    session: 'Paper 1',
    shift: 'Morning',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2022-s1-sh1',
    paper: 'JEE Main 2022 Session 1 Shift 1 (Jun 24 Morning)',
    year: '2022',
    session: 'Session 1',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2022-s2-sh2',
    paper: 'JEE Main 2022 Session 2 Shift 2 (Jul 27 Evening)',
    year: '2022',
    session: 'Session 2',
    shift: 'Shift 2',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-adv-2022-p1',
    paper: 'JEE Advanced 2022 Paper 1 (Mechanics & Optics)',
    year: '2022',
    session: 'Paper 1',
    shift: 'Morning',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2021-feb-sh1',
    paper: 'JEE Main 2021 Feb Session Shift 1 (Feb 24 Morning)',
    year: '2021',
    session: 'Feb Session',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2021-aug-sh2',
    paper: 'JEE Main 2021 Aug Session Shift 2 (Aug 26 Evening)',
    year: '2021',
    session: 'Aug Session',
    shift: 'Shift 2',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2020-jan-sh1',
    paper: 'JEE Main 2020 Jan Session Shift 1 (Jan 07 Morning)',
    year: '2020',
    session: 'Jan Session',
    shift: 'Shift 1',
    chapter: 'All Chapters',
  },
  {
    id: 'jee-2020-sep-sh2',
    paper: 'JEE Main 2020 Sep Session Shift 2 (Sep 03 Evening)',
    year: '2020',
    session: 'Sep Session',
    shift: 'Shift 2',
    chapter: 'All Chapters',
  },
  {
    id: 'neet-ug-2025-full',
    paper: 'NEET UG 2025 Full Mock (Physics, Chemistry & Biology • +4/-1)',
    year: '2025',
    session: 'Annual',
    shift: 'Afternoon',
    chapter: 'All Chapters',
  },
  {
    id: 'bitsat-2025-s1',
    paper: 'BITSAT 2025 Session 1 Speed CBT (PCM + English & LR • +3/-1)',
    year: '2025',
    session: 'Session 1',
    shift: 'Slot 1',
    chapter: 'All Chapters',
  },
];

export const CHAPTER_ANALYSIS_DEFAULT = [
  {
    chapter: 'Laws of Motion',
    subject: 'Physics' as const,
    marks: '28 / 30',
    time: '24 min',
    accuracy: 93.3,
  },
  {
    chapter: 'Work, Energy and Power',
    subject: 'Physics' as const,
    marks: '24 / 30',
    time: '27 min',
    accuracy: 80.0,
  },
  {
    chapter: 'Current Electricity',
    subject: 'Physics' as const,
    marks: '19 / 30',
    time: '29 min',
    accuracy: 63.3,
  },
  {
    chapter: 'd & f Block Elements',
    subject: 'Chemistry' as const,
    marks: '26 / 30',
    time: '21 min',
    accuracy: 86.7,
  },
  {
    chapter: 'Chemical Bonding',
    subject: 'Chemistry' as const,
    marks: '26 / 30',
    time: '25 min',
    accuracy: 86.7,
  },
  {
    chapter: 'Organic Chemistry – Basics',
    subject: 'Chemistry' as const,
    marks: '28 / 30',
    time: '22 min',
    accuracy: 93.3,
  },
  {
    chapter: 'Quadratic Equations & Maxima-Minima',
    subject: 'Mathematics' as const,
    marks: '27 / 30',
    time: '23 min',
    accuracy: 90.0,
  },
  {
    chapter: 'Matrices and Determinants',
    subject: 'Mathematics' as const,
    marks: '25 / 30',
    time: '26 min',
    accuracy: 83.3,
  },
  {
    chapter: 'Definite Integration',
    subject: 'Mathematics' as const,
    marks: '22 / 30',
    time: '28 min',
    accuracy: 73.3,
  },
];
