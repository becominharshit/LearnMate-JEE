import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  User,
  Upload,
  Copy,
  Printer,
  Lock,
  Maximize2,
  Check,
  CornerDownRight,
  Delete,
} from 'lucide-react';
import {
  MindMapNodeItem,
  OFFICIAL_PAPERS_LIST,
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
  NEET_UG_PAPER_QUESTIONS,
  BITSAT_PAPER_QUESTIONS,
  MaterialStudyBundle,
  StickyNoteData,
  FormulaCardEntry,
} from '../data/jeeInitialContent';
import {
  CBTQuestion,
  CBTQuestionResponse,
  CBTMockSummary,
  QuestionAttemptDetail,
  ErrorRootCauseTag,
  SM2FlashcardItem,
  ExamTrack,
  formatCountdownTimer,
  calculateNextSRSReview,
  calculateSM2Schedule,
  formatSM2IntervalShort,
  sanitizeNumericalInputValue,
  resolveCbtSessionInit,
  filterCustomTestQuestions,
  buildBalancedCustomTestQuestions,
} from '../utils/jeeEngine';
import {
  saveCbtInProgressDraft,
  loadCbtInProgressDraft,
  clearCbtInProgressDraft,
  syncRevisionStateToFirestore,
  getUserScopedStorageKey,
  reportQuestionIssueOnServer,
  verifySinglePyqAnswerOnServer,
  gradeCbtAttemptOnServerApi,
  fetchLazyPyqPack,
  CbtInProgressDraft,
} from '../services/workspaceService';
import { MathRichText } from './MathRichText';
import { MaterialItem } from './HomeAndStudyViews';
import { SpacedRepetitionHub } from './revise/SpacedRepetitionHub';

export interface MistakeNotebookEntry {
  id: string;
  question: CBTQuestion;
  userAnswer: string;
  loggedAt: string;
  source: 'CBT Mock' | 'PYQ Bank' | 'Adaptive Drill';
  rootCauseTag?: ErrorRootCauseTag;
  recheckCount?: number;
  recheckPassed?: boolean;
  masteryDelta?: number;
  nextDueIso?: string;
  intervalDays?: number;
}

type HandwritingFontId = 'caveat' | 'kalam' | 'patrick' | 'indie';
type PaperBackgroundStyle = 'ruled' | 'grid' | 'plain';

const HANDWRITING_FONT_MAP: Record<
  HandwritingFontId,
  { label: string; cssClass: string; badge: string }
> = {
  caveat: {
    label: 'Caveat Neat Cursive',
    cssClass: 'font-hand-caveat',
    badge: 'Topper Cursive',
  },
  kalam: {
    label: 'Kalam Indian Notebook',
    cssClass: 'font-hand-kalam',
    badge: 'Kota Classroom',
  },
  patrick: {
    label: 'Patrick Hand Clean',
    cssClass: 'font-hand-patrick',
    badge: 'Ultra Legible',
  },
  indie: {
    label: 'Indie Flower Sketch',
    cssClass: 'font-hand-indie',
    badge: 'Quick Jottings',
  },
};

// ============================================================================
// 1. REVISE WORKSPACE VIEW (Zero-State Clean + Multi-Level Mind Map + Handwritten Studio)
// ============================================================================
interface ReviseViewProps {
  materials: MaterialItem[];
  selectedMaterial: MaterialItem | null;
  materialBundles: Record<string, MaterialStudyBundle>;
  mistakesNotebook: MistakeNotebookEntry[];
  sm2Cards?: SM2FlashcardItem[];
  sm2ReviewedCount?: number;
  onIncrementSm2Reviewed?: () => void;
  onUpdateSM2Card?: (card: SM2FlashcardItem) => void;
  onAddSM2Card?: (card: Omit<SM2FlashcardItem, 'id'>) => void;
  onTagMistakeRootCause?: (id: string, cause: ErrorRootCauseTag) => void;
  onVerifyMistakeRecheck?: (mistakeId: string, passed: boolean) => void;
  onSelectMaterial: (mat: MaterialItem) => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onAddFlashcard: (node: MindMapNodeItem) => void;
  onPracticeQuestion?: (q: CBTQuestion) => void;
  showToast: (msg: string) => void;
}

export const ReviseWorkspaceView: React.FC<ReviseViewProps> = ({
  materials,
  selectedMaterial,
  materialBundles,
  mistakesNotebook,
  sm2Cards = [],
  sm2ReviewedCount = 0,
  onIncrementSm2Reviewed,
  onUpdateSM2Card,
  onAddSM2Card,
  onTagMistakeRootCause,
  onVerifyMistakeRecheck,
  onSelectMaterial,
  onOpenAddMaterial,
  onAddFlashcard,
  onPracticeQuestion,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    | 'Mind Map'
    | 'Handwritten Notes'
    | 'Flashcards'
    | 'Sticky Notes'
    | 'Summary Sheet'
    | 'Formula Book'
    | 'Mistake DNA'
  >('Mind Map');

  const activeMaterial = selectedMaterial || materials[0] || null;
  const activeBundle = activeMaterial ? materialBundles[activeMaterial.id] : null;
  const mindMapNodes = activeBundle?.mindMapNodes || [];

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedSubNodeId, setSelectedSubNodeId] = useState<string | null>(null);
  const [mindMapZoom, setMindMapZoom] = useState<number>(100);

  // Handwriting converter state in Revise
  const [handFont, setHandFont] = useState<HandwritingFontId>('kalam');
  const [paperStyle, setPaperStyle] = useState<PaperBackgroundStyle>('ruled');
  const [inkColor, setInkColor] = useState<'#1E293B' | '#1D4ED8' | '#047857'>('#1D4ED8');
  const [handSourceType, setHandSourceType] = useState<
    'chapter_notes' | 'sticky_notes' | 'summary_sheet' | 'custom_text'
  >('chapter_notes');
  const [customHandText, setCustomHandText] = useState<string>('');
  const [useHandFontOnCards, setUseHandFontOnCards] = useState<boolean>(true);

  // Flashcard 3D flip & SRS state
  const [cardIndex, setCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [srsStats, setSrsStats] = useState<{
    intervalDays: number;
    easeFactor: number;
    repetition: number;
  }>({
    intervalDays: 1,
    easeFactor: 2.5,
    repetition: 0,
  });

  // Custom Sticky Notes added by student
  const [customStickyNotes, setCustomStickyNotes] = useState<StickyNoteData[]>([]);
  const [newStickyTitle, setNewStickyTitle] = useState('');
  const [newStickyBody, setNewStickyBody] = useState('');

  // Dynamic Formula Book state (All Uploaded Materials + Custom Student Formulas)
  const [customFormulas, setCustomFormulas] = useState<FormulaCardEntry[]>(() => {
    try {
      const raw = localStorage.getItem(getUserScopedStorageKey('custom_formulas'));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showAddFormulaForm, setShowAddFormulaForm] = useState(false);
  const [newFormulaTitle, setNewFormulaTitle] = useState('');
  const [newFormulaLatex, setNewFormulaLatex] = useState('');
  const [newFormulaVariables, setNewFormulaVariables] = useState('');
  const [newFormulaUnits, setNewFormulaUnits] = useState('');
  const [newFormulaNotes, setNewFormulaNotes] = useState('');
  const [formulaChapterFilter, setFormulaChapterFilter] = useState<string>('All');

  useEffect(() => {
    if (mindMapNodes.length > 0) {
      setSelectedNodeId(mindMapNodes[0].id);
      setSelectedSubNodeId(mindMapNodes[0].subNodes?.[0]?.id || null);
    } else {
      setSelectedNodeId('');
      setSelectedSubNodeId(null);
    }
    setCardIndex(0);
    setIsCardFlipped(false);
  }, [activeMaterial?.id, mindMapNodes.length]);

  const selectedNode =
    mindMapNodes.find((n) => n.id === selectedNodeId) || mindMapNodes[0] || null;
  const activeFlashcard = mindMapNodes[cardIndex % Math.max(1, mindMapNodes.length)] || null;
  const matchedSm2Card = useMemo(() => {
    if (!activeFlashcard) return undefined;
    return sm2Cards.find(
      (c) =>
        c.frontPrompt.includes(activeFlashcard.title) &&
        (!activeMaterial?.chapter || c.chapter === activeMaterial.chapter)
    );
  }, [sm2Cards, activeFlashcard, activeMaterial?.chapter]);

  const effectiveSrs = {
    intervalDays: matchedSm2Card?.intervalDays ?? srsStats.intervalDays,
    easeFactor: matchedSm2Card?.easeFactor ?? srsStats.easeFactor,
    repetition: matchedSm2Card?.repetitionCount ?? srsStats.repetition,
  };

  const handleRateFlashcard = (rating: 'Again' | 'Hard' | 'Good' | 'Easy') => {
    const qualityMap: Record<'Again' | 'Hard' | 'Good' | 'Easy', 1 | 3 | 4 | 5> = {
      Again: 1,
      Hard: 3,
      Good: 4,
      Easy: 5,
    };
    const next = calculateNextSRSReview(
      rating,
      effectiveSrs.intervalDays,
      effectiveSrs.easeFactor,
      effectiveSrs.repetition
    );
    const sm2Schedule = calculateSM2Schedule(
      {
        intervalDays: effectiveSrs.intervalDays,
        repetitionCount: effectiveSrs.repetition,
        easeFactor: effectiveSrs.easeFactor,
      },
      qualityMap[rating]
    );
    setSrsStats({
      intervalDays: next.nextIntervalDays,
      easeFactor: next.nextEaseFactor,
      repetition: next.nextRepetition,
    });
    if (matchedSm2Card && onUpdateSM2Card) {
      onUpdateSM2Card({
        ...matchedSm2Card,
        intervalDays: sm2Schedule.intervalDays,
        repetitionCount: sm2Schedule.repetitionCount,
        easeFactor: sm2Schedule.easeFactor,
        nextReviewIso: sm2Schedule.nextReviewIso,
      });
    } else if (activeFlashcard && activeMaterial && onAddSM2Card) {
      onAddSM2Card({
        chapter: activeMaterial.chapter,
        subject: activeMaterial.subject,
        frontPrompt: `Define & Explain: **${activeFlashcard.title}**`,
        backAnswer: `${activeFlashcard.definition}\n\n**Example:** ${activeFlashcard.example}\n\n**Exam Trap:** ${activeFlashcard.commonTrap}`,
        intervalDays: sm2Schedule.intervalDays,
        repetitionCount: sm2Schedule.repetitionCount,
        easeFactor: sm2Schedule.easeFactor,
        nextReviewIso: sm2Schedule.nextReviewIso,
      });
    }
    onIncrementSm2Reviewed?.();
    setIsCardFlipped(false);
    if (mindMapNodes.length > 0) {
      setCardIndex((prev) => (prev + 1) % mindMapNodes.length);
    }
    showToast(`Card scheduled in ${next.label} (Ease ${next.nextEaseFactor.toFixed(2)})`);
  };

  const handleAddCustomSticky = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStickyTitle.trim() || !newStickyBody.trim()) return;
    setCustomStickyNotes((prev) => [
      {
        id: `sticky-custom-${Date.now()}`,
        title: newStickyTitle.trim(),
        body: newStickyBody.trim(),
        subject: activeMaterial?.subject || 'Physics',
        color: 'amber',
      },
      ...prev,
    ]);
    setNewStickyTitle('');
    setNewStickyBody('');
    showToast('Converted & pinned new Sticky Note!');
  };

  const handleAddCustomFormula = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormulaTitle.trim() || !newFormulaLatex.trim()) return;
    const formattedFormula = newFormulaLatex.includes('$')
      ? newFormulaLatex.trim()
      : `$$${newFormulaLatex.trim()}$$`;
    const entry: FormulaCardEntry = {
      id: `custom-fc-${Date.now()}`,
      subject: activeMaterial?.subject || 'Physics',
      chapter: activeMaterial?.chapter || 'Custom JEE Formulas',
      title: newFormulaTitle.trim(),
      formula: formattedFormula,
      variables: newFormulaVariables.trim() || 'Standard SI variables and physical constants',
      units: newFormulaUnits.trim() || 'SI Units',
      notes:
        newFormulaNotes.trim() ||
        '**Custom Student Equation:** Apply with consistent SI units and sign conventions.',
    };
    const next = [entry, ...customFormulas];
    setCustomFormulas(next);
    try {
      localStorage.setItem(getUserScopedStorageKey('custom_formulas'), JSON.stringify(next));
    } catch {
      // ignore storage quota
    }
    void syncRevisionStateToFirestore('custom_formulas', next);
    setNewFormulaTitle('');
    setNewFormulaLatex('');
    setNewFormulaVariables('');
    setNewFormulaUnits('');
    setNewFormulaNotes('');
    setShowAddFormulaForm(false);
    showToast(`Added "${entry.title}" to your Chapter Formula Book & synced to Cloud!`);
  };

  const allExtractedFormulas: FormulaCardEntry[] = [
    ...customFormulas,
    ...Object.values(materialBundles).flatMap((b) => b.formulas || []),
  ];

  const availableFormulaChapters = Array.from(
    new Set(allExtractedFormulas.map((f) => f.chapter))
  );

  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      {/* Header & Material Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
              Revise
            </h1>
            {activeMaterial && (
              <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                · {activeMaterial.subject} · {activeMaterial.chapter}
              </span>
            )}
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {(
            [
              'Mind Map',
              'Handwritten Notes',
              'Flashcards',
              'Sticky Notes',
              'Summary Sheet',
              'Formula Book',
              'Mistake DNA',
            ] as const
          ).map((tab) => {
            const active = activeSubTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveSubTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#2563EB] text-white font-semibold'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                }`}
              >
                <span>{tab}</span>
                {tab === 'Mistake DNA' && mistakesNotebook.length > 0 && (
                  <span className={`tabular-nums text-[10px] font-semibold ${active ? 'text-white/90' : 'text-rose-500'}`}>
                    {mistakesNotebook.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Uploaded Material Switcher Bar */}
      {materials.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8] mr-1">
              Material:
            </span>
            {materials.map((mat) => {
              const isSelected = activeMaterial?.id === mat.id;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => onSelectMaterial(mat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#2563EB] text-white font-semibold'
                      : 'bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                  }`}
                >
                  {mat.title} ({mat.subject})
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onOpenAddMaterial('photo')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium transition-colors duration-150 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
            Upload Photo / PDF
          </button>
        </div>
      )}

      {/* CLEAN ZERO-STATE WHEN NO MATERIALS ARE UPLOADED */}
      {materials.length === 0 && activeSubTab !== 'Mistake DNA' ? (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-10 text-center max-w-2xl mx-auto my-6 space-y-5">
          <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
              No materials yet
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] max-w-md mx-auto">
              Upload a PDF, handwritten notes photo, or YouTube lecture to generate mind maps, formula books, and flashcards.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenAddMaterial('pdf')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-brand text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload Material
            </button>
            <button
              type="button"
              onClick={() => onOpenAddMaterial('youtube')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors cursor-pointer"
            >
              Extract YouTube
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ================================================================= */}
          {/* SUB-TAB 1: MULTI-LEVEL VISUAL MIND MAP WITH KATEX                 */}
          {/* ================================================================= */}
          {activeSubTab === 'Mind Map' && activeMaterial && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 8 Cols: Multi-Level Hierarchical Mind Map Canvas */}
              <div className="lg:col-span-8 min-w-0 bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFF] dark:bg-[#0D1322]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {activeMaterial.chapter}
                    </span>
                    <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                      · {mindMapNodes.length} branches ·{' '}
                      {mindMapNodes.reduce((acc, n) => acc + (n.subNodes?.length || 0), 0)} sub-nodes
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMindMapZoom((z) => Math.max(80, z - 10))}
                      className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                    >
                      −
                    </button>
                    <span className="text-xs tabular-nums font-medium text-[#475569] dark:text-[#94A3B8] px-1.5">
                      {mindMapZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setMindMapZoom((z) => Math.min(125, z + 10))}
                      className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setMindMapZoom(100)}
                      className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Hierarchical Tree Canvas */}
                <div
                  className="p-6 overflow-x-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:18px_18px]"
                  style={{
                    transform: `scale(${mindMapZoom / 100})`,
                    transformOrigin: 'top center',
                  }}
                >
                  {/* Level 0: Central Root Hub */}
                  <div className="flex flex-col items-center">
                    <div className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] text-white shadow-sm text-center max-w-md">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-100">
                        {activeMaterial.subject}
                      </div>
                      <div className="text-base font-semibold tracking-[-0.01em] mt-0.5">{activeMaterial.chapter}</div>
                    </div>

                    <div className="w-px h-6 bg-[#CBD5E1] dark:bg-[#334155]" />

                    {/* Level 1: Primary Concept Nodes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                      {mindMapNodes.map((node, idx) => {
                        const isSelected = selectedNode?.id === node.id;
                        return (
                          <div
                            key={node.id}
                            onClick={() => {
                              setSelectedNodeId(node.id);
                              setSelectedSubNodeId(node.subNodes?.[0]?.id || null);
                            }}
                            className={`min-w-0 overflow-hidden rounded-2xl border p-4 transition-colors duration-150 cursor-pointer flex flex-col justify-between [&_.katex]:whitespace-normal [&_.katex-display]:whitespace-nowrap ${
                              isSelected
                                ? 'border-[#2563EB] dark:border-[#3B82F6] bg-[#EFF6FF]/60 dark:bg-[#1E293B]'
                                : 'border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-[#F8FAFF] dark:hover:bg-[#1E293B]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                                  Branch {idx + 1} · {node.pageRef}
                                </span>
                                {node.badgeType && (
                                  <span
                                    className={`text-[11px] font-semibold shrink-0 ${
                                      node.badgeType === 'High Weightage'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : node.badgeType === 'Exception Trap'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-[#00A86B]'
                                    }`}
                                  >
                                    {node.badgeType}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] break-words">
                                {node.title}
                              </h3>

                              <div className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1.5 leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
                                <MathRichText content={node.definition} />
                              </div>

                              {node.formulaLatex && (
                                <div className="mt-2.5 p-2.5 rounded-xl bg-[#F8FAFF] dark:bg-[#0D1322] border border-[#E2E8F0] dark:border-white/[0.08] text-xs min-w-0 overflow-x-auto break-words [overflow-wrap:anywhere]">
                                  <MathRichText content={node.formulaLatex} />
                                </div>
                              )}
                            </div>

                            {/* Level 2: Secondary Sub-Nodes */}
                            {node.subNodes && node.subNodes.length > 0 && (
                              <div className="mt-3.5 pt-3 border-t border-[#E2E8F0] dark:border-white/[0.08] space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8]">
                                  Sub-Branches
                                </div>
                                <div className="space-y-1.5">
                                  {node.subNodes.map((sub) => {
                                    const subActive = selectedSubNodeId === sub.id && isSelected;
                                    return (
                                      <div
                                        key={sub.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedNodeId(node.id);
                                          setSelectedSubNodeId(sub.id);
                                        }}
                                        className={`min-w-0 overflow-hidden p-2.5 rounded-xl border text-xs transition-colors duration-150 ${
                                          subActive
                                            ? 'border-[#2563EB] dark:border-[#3B82F6] bg-white dark:bg-[#1E293B]'
                                            : 'border-[#E2E8F0] dark:border-white/[0.06] bg-[#F8FAFF] dark:bg-[#0D1322] hover:bg-white dark:hover:bg-[#1E293B]'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2 min-w-0">
                                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F172A] dark:text-[#F8FAFC] min-w-0 break-words">
                                            <CornerDownRight className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                                            <span className="break-words">{sub.label}</span>
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-1 min-w-0 break-words [overflow-wrap:anywhere]">
                                          <MathRichText content={sub.microNote} />
                                        </div>
                                        {sub.formulaLatex && (
                                          <div className="mt-1 text-[11px] font-medium text-[#0F172A] dark:text-[#E2E8F0] min-w-0 overflow-x-auto break-words [overflow-wrap:anywhere]">
                                            <MathRichText content={sub.formulaLatex} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 4 Cols: Selected Node Deep-Dive & Flashcard Action */}
              <div className="lg:col-span-4 min-w-0 overflow-hidden bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4 sticky top-20 [&_.katex]:whitespace-normal [&_.katex-display]:whitespace-nowrap">
                {selectedNode ? (
                  <>
                    <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-3 min-w-0">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                          NODE · {selectedNode.pageRef}
                        </span>
                        <h2 className="text-base font-semibold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 break-words">
                          {selectedNode.title}
                        </h2>
                      </div>
                      {selectedNode.badgeType && (
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                          {selectedNode.badgeType}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 text-xs min-w-0">
                      <div className="p-3.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-1 min-w-0 overflow-hidden">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8]">
                          Core Law
                        </div>
                        <div className="text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
                          <MathRichText content={selectedNode.definition} />
                        </div>
                      </div>

                      {selectedNode.formulaLatex && (
                        <div className="p-3.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-1 min-w-0 overflow-x-auto">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8]">
                            Expression
                          </div>
                          <div className="text-[#0F172A] dark:text-[#F8FAFC] min-w-0 break-words [overflow-wrap:anywhere]">
                            <MathRichText content={selectedNode.formulaLatex} />
                          </div>
                        </div>
                      )}

                      <div className="p-3.5 rounded-xl bg-[#00A86B]/5 border border-[#00A86B]/25 space-y-1 min-w-0 overflow-hidden">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#00A86B]">
                          Application
                        </div>
                        <div className="text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
                          <MathRichText content={selectedNode.example} />
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1 min-w-0 overflow-hidden">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Exam Trap
                        </div>
                        <div className="text-[#0F172A] dark:text-[#E2E8F0] leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
                          <MathRichText content={selectedNode.commonTrap} />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onAddFlashcard(selectedNode)}
                        className="w-full py-2.5 px-4 rounded-lg btn-brand text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Flashcards
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('Handwritten Notes')}
                        className="w-full py-2 px-4 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium transition-colors cursor-pointer"
                      >
                        Open Handwritten Notebook →
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 2: HANDWRITTEN NOTES STUDIO (4-FONT + 3 PAPER STYLES)     */}
          {/* ================================================================= */}
          {activeSubTab === 'Handwritten Notes' && activeMaterial && (
            <div className="space-y-5">
              {/* Top Controls Bar */}
              <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
                      Handwritten Notebook
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAddMaterial('photo')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      OCR Photo / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                        showToast('Opened print/PDF export for your Handwritten Notebook!');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg btn-brand text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Export PDF
                    </button>
                  </div>
                </div>

                {/* Font Switcher, Paper Background & Source Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#E2E8F0] dark:border-white/[0.08]">
                  {/* 4-Font Switcher */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8] mb-2">
                      1. Handwriting Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(HANDWRITING_FONT_MAP) as HandwritingFontId[]).map((fontKey) => {
                        const item = HANDWRITING_FONT_MAP[fontKey];
                        const active = handFont === fontKey;
                        return (
                          <button
                            key={fontKey}
                            type="button"
                            onClick={() => setHandFont(fontKey)}
                            className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                              active
                                ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]'
                                : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/60 hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                            }`}
                          >
                            <div className={`text-base font-bold ${item.cssClass}`}>
                              {item.label.split(' ')[0]}
                            </div>
                            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-medium">
                              {item.badge}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paper Style & Ink Color */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8] mb-2">
                        2. Paper Texture
                      </label>
                      <div className="flex items-center gap-2">
                        {(
                          [
                            { id: 'ruled', label: 'Ruled' },
                            { id: 'grid', label: 'Math Grid' },
                            { id: 'plain', label: 'Plain Ivory' },
                          ] as const
                        ).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPaperStyle(p.id)}
                            className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                              paperStyle === p.id
                                ? 'border-[#2563EB] bg-[#2563EB] text-white font-semibold'
                                : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1]'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                        Ink Color
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[
                          { color: '#1D4ED8', name: 'Royal Blue' },
                          { color: '#1E293B', name: 'Carbon' },
                          { color: '#047857', name: 'Emerald' },
                        ].map((ink) => (
                          <button
                            key={ink.color}
                            type="button"
                            onClick={() => setInkColor(ink.color as typeof inkColor)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                              inkColor === ink.color
                                ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]'
                                : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/60 text-[#475569] dark:text-[#CBD5E1]'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: ink.color }}
                            />
                            {ink.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Source Material to Convert */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8] mb-2">
                      3. Source Content
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'chapter_notes', label: 'Chapter Notes' },
                          { id: 'sticky_notes', label: 'Sticky Notes' },
                          { id: 'summary_sheet', label: 'Quick Summary' },
                          { id: 'custom_text', label: 'Custom Note' },
                        ] as const
                      ).map((src) => (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => setHandSourceType(src.id)}
                          className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-colors cursor-pointer ${
                            handSourceType === src.id
                              ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] font-semibold'
                              : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/60 text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                          }`}
                        >
                          {src.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {handSourceType === 'custom_text' && (
                  <div className="pt-2">
                    <textarea
                      rows={3}
                      value={customHandText}
                      onChange={(e) => setCustomHandText(e.target.value)}
                      placeholder="Paste any JEE derivation or formula ($E = mc^2$) to render in handwriting..."
                      className="w-full p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Realistic Handwritten Notebook Page Sheet */}
              <div
                className={`rounded-2xl border border-amber-300/80 shadow-md p-8 lg:p-12 min-h-[540px] relative transition-all ${
                  paperStyle === 'ruled'
                    ? 'paper-ruled'
                    : paperStyle === 'grid'
                    ? 'paper-grid'
                    : 'paper-plain'
                } ${HANDWRITING_FONT_MAP[handFont].cssClass}`}
                style={{ color: inkColor }}
              >
                {/* Notebook Red Margin Line */}
                <div className="hidden sm:block absolute top-0 bottom-0 left-14 w-0.5 bg-rose-400/50 pointer-events-none" />

                <div className="sm:pl-10 space-y-6">
                  {/* Top Notebook Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-amber-300/80 pb-3">
                    <div>
                      <div className="text-xs font-sans font-extrabold uppercase tracking-wider text-slate-500">
                        {activeMaterial.subject} • Handwritten Topper Notebook ({HANDWRITING_FONT_MAP[handFont].label})
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold mt-0.5">
                        {activeMaterial.chapter} —{' '}
                        {handSourceType === 'chapter_notes'
                          ? 'Complete Lecture Notes'
                          : handSourceType === 'sticky_notes'
                          ? 'High-Yield Sticky Callouts'
                          : handSourceType === 'summary_sheet'
                          ? '1-Page Exam Revision Sheet'
                          : 'Custom Handwritten Sheet'}
                      </h3>
                    </div>
                    <div className="px-3 py-1 rounded-xl border border-amber-400/80 bg-amber-50/90 text-xs font-sans font-bold text-amber-900">
                      Page 1 • Equations &amp; Derivations Verified
                    </div>
                  </div>

                  {/* Rendered Content by Source Type */}
                  {handSourceType === 'chapter_notes' && activeBundle && (
                    <div className="space-y-6 text-lg sm:text-xl leading-relaxed">
                      {activeBundle.pages.map((pg) => (
                        <div key={pg.pageNumber} className="space-y-3">
                          <div className="inline-block px-3 py-0.5 rounded-lg bg-yellow-200/70 text-slate-900 font-bold text-base">
                            § Page {pg.pageNumber}: {pg.heading}
                          </div>
                          {pg.sections.map((sec, sIdx) => (
                            <div key={sIdx} className="space-y-2">
                              <div className="font-bold text-[#0F172A]">{sec.numberTitle}</div>
                              {sec.paragraphs?.map((par, pIdx) => (
                                <div key={pIdx}>
                                  <MathRichText content={par} />
                                </div>
                              ))}
                              {sec.formulas?.map((form, fIdx) => (
                                <div
                                  key={fIdx}
                                  className="p-3.5 rounded-2xl bg-white/80 border border-amber-300/90 shadow-2xs"
                                >
                                  <MathRichText content={form} />
                                </div>
                              ))}
                              {sec.bullets && sec.bullets.length > 0 && (
                                <ul className="list-disc pl-6 space-y-1.5">
                                  {sec.bullets.map((bText, bIdx) => (
                                    <li key={bIdx}>
                                      <MathRichText content={bText} inline />
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {handSourceType === 'sticky_notes' && activeBundle && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-lg leading-relaxed">
                      {[...customStickyNotes, ...activeBundle.stickyNotes].map((st) => (
                        <div
                          key={st.id}
                          className="p-5 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-xs space-y-2"
                        >
                          <div className="text-xs font-sans font-semibold uppercase tracking-wider text-amber-800">
                            {st.subject}
                          </div>
                          <div className="text-xl font-bold text-[#0F172A]">{st.title}</div>
                          <div className="text-[#334155]">
                            <MathRichText content={st.body} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {handSourceType === 'summary_sheet' && activeBundle && (
                    <div className="space-y-5 text-lg sm:text-xl leading-relaxed">
                      <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300">
                        <div className="text-xs font-sans font-semibold uppercase text-emerald-800 mb-1">
                          Executive Chapter Summary
                        </div>
                        <MathRichText content={activeMaterial.contentSummary} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeBundle.formulas.map((fc) => (
                          <div
                            key={fc.id}
                            className="p-4 rounded-2xl bg-white/90 border border-[#E2E8F0] space-y-1.5"
                          >
                            <div className="font-bold text-[#0F172A]">{fc.title}</div>
                            <MathRichText content={fc.formula} />
                            <div className="text-base text-[#334155]">
                              <MathRichText content={fc.notes} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {handSourceType === 'custom_text' && (
                    <div className="text-xl leading-relaxed">
                      <MathRichText
                        content={
                          customHandText.trim() ||
                          `**Type above to convert any note!** Example: For a projectile launched at angle $\\theta$, maximum height is $$H = \\frac{u^2 \\sin^2\\theta}{2g}$$ and horizontal range is $$R = \\frac{u^2 \\sin(2\\theta)}{g}$$. *Remember that range is identical for complementary angles $\\theta$ and $90^\\circ - \\theta$.*`
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 3: 3D FLIP FLASHCARDS WITH KATEX & SRS                    */}
          {/* ================================================================= */}
          {activeSubTab === 'Flashcards' && activeMaterial && activeFlashcard && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                  Card <span className="tabular-nums">{(cardIndex % mindMapNodes.length) + 1}/{mindMapNodes.length}</span> ·{' '}
                  <span className="text-[#00A86B] font-semibold tabular-nums">
                    Interval {srsStats.intervalDays}d · Ease {srsStats.easeFactor.toFixed(2)}
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#334155] dark:text-[#CBD5E1] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useHandFontOnCards}
                    onChange={(e) => setUseHandFontOnCards(e.target.checked)}
                    className="rounded accent-[#2563EB]"
                  />
                  Handwriting ({HANDWRITING_FONT_MAP[handFont].label})
                </label>
              </div>

              <div
                onClick={() => setIsCardFlipped((f) => !f)}
                className={`rounded-2xl border p-8 sm:p-10 min-h-[320px] flex flex-col justify-between transition-colors duration-150 cursor-pointer ${
                  isCardFlipped
                    ? 'bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#312E81] text-white border-[#4F46E5]/40'
                    : 'bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC] border-[#E2E8F0] dark:border-white/[0.08] hover:border-[#2563EB]/40'
                } ${useHandFontOnCards ? HANDWRITING_FONT_MAP[handFont].cssClass : ''}`}
              >
                <div className="flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-[0.06em] opacity-70">
                  <span>
                    {isCardFlipped
                      ? 'Back · Formula & Trap'
                      : `Front · ${activeFlashcard.pageRef}`}
                  </span>
                  <span>Click to flip</span>
                </div>

                {!isCardFlipped ? (
                  <div className="my-auto py-6 text-center space-y-3">
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]">
                      {activeFlashcard.title}
                    </h3>
                    <p className="text-xs font-sans text-[#64748B] dark:text-[#94A3B8]">
                      Recall the law, formula, and common trap.
                    </p>
                  </div>
                ) : (
                  <div className="my-auto py-4 space-y-4 text-base sm:text-lg">
                    <div>
                      <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.06em] text-blue-200 block mb-1">
                        Core Definition
                      </span>
                      <MathRichText content={activeFlashcard.definition} />
                    </div>
                    {activeFlashcard.formulaLatex && (
                      <div className="p-3 rounded-xl bg-white/[0.08] border border-white/[0.14]">
                        <MathRichText content={activeFlashcard.formulaLatex} />
                      </div>
                    )}
                    <div className="text-amber-300 text-sm sm:text-base">
                      <strong className="font-sans uppercase text-[11px] tracking-[0.06em] mr-1">
                        Trap:
                      </strong>
                      <MathRichText content={activeFlashcard.commonTrap} inline />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-sans font-medium opacity-70 pt-3 border-t border-white/15">
                  <span>{activeMaterial.chapter}</span>
                  <span>SM-2 Active</span>
                </div>
              </div>

              {/* 4 SRS Rating Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    { label: 'Again', style: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20' },
                    { label: 'Hard', style: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20' },
                    { label: 'Good', style: 'border-[#00A86B]/30 bg-[#00A86B]/10 text-[#00A86B] hover:bg-[#00A86B]/20' },
                    { label: 'Easy', style: 'border-[#2563EB]/30 bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#2563EB]/20' },
                  ] as const
                ).map((btn) => {
                  const preview = calculateNextSRSReview(
                    btn.label,
                    effectiveSrs.intervalDays,
                    effectiveSrs.easeFactor,
                    effectiveSrs.repetition
                  );
                  const sub =
                    btn.label === 'Again'
                      ? '< 10m'
                      : formatSM2IntervalShort(preview.nextIntervalDays);
                  return (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleRateFlashcard(btn.label)}
                      className={`py-3 px-4 rounded-xl border font-semibold text-xs transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${btn.style}`}
                    >
                      <span>{btn.label}</span>
                      <span className="text-[10px] tabular-nums opacity-75">{sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 4: STICKY NOTES (KATEX + HANDWRITING TOGGLE)              */}
          {/* ================================================================= */}
          {activeSubTab === 'Sticky Notes' && activeMaterial && activeBundle && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddCustomSticky}
                className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-4 flex flex-wrap items-center gap-3"
              >
                <input
                  type="text"
                  value={newStickyTitle}
                  onChange={(e) => setNewStickyTitle(e.target.value)}
                  placeholder="Sticky title..."
                  className="px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium flex-1 min-w-[200px]"
                />
                <input
                  type="text"
                  value={newStickyBody}
                  onChange={(e) => setNewStickyBody(e.target.value)}
                  placeholder="Sticky note with formula ($W = -nC_V\Delta T$)..."
                  className="px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] text-xs flex-2 min-w-[260px]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold transition-colors cursor-pointer"
                >
                  + Pin Note
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[...customStickyNotes, ...activeBundle.stickyNotes].map((note, idx) => {
                  const bgColors = [
                    'bg-amber-50/95 border-amber-300/80 dark:bg-[#1E293B] dark:border-amber-500/30',
                    'bg-[#F8FAFF] border-[#E2E8F0] dark:bg-[#1E293B] dark:border-white/[0.08]',
                    'bg-emerald-50/80 border-emerald-200 dark:bg-[#1E293B] dark:border-[#00A86B]/30',
                  ];
                  return (
                    <div
                      key={note.id}
                      className={`p-5 rounded-2xl border space-y-2.5 ${
                        bgColors[idx % bgColors.length]
                      } ${useHandFontOnCards ? HANDWRITING_FONT_MAP[handFont].cssClass : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8]">
                          {note.subject}
                        </span>
                        <Bookmark className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{note.title}</h3>
                      <div className="text-sm sm:text-base text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                        <MathRichText content={note.body} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 5: SUMMARY SHEET                                          */}
          {/* ================================================================= */}
          {activeSubTab === 'Summary Sheet' && activeMaterial && activeBundle && (
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-6 lg:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8]">
                    Revision Summary
                  </span>
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
                    {activeMaterial.chapter} · {activeMaterial.subject}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHandSourceType('summary_sheet');
                    setActiveSubTab('Handwritten Notes');
                  }}
                  className="px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium transition-colors cursor-pointer"
                >
                  View Handwritten →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeBundle.pages.map((pg) => (
                  <div
                    key={pg.pageNumber}
                    className="p-5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[#2563EB] dark:text-[#60A5FA]">
                      Section {pg.pageNumber} · {pg.heading}
                    </div>
                    <div className="text-xs text-[#334155] dark:text-[#E2E8F0] leading-relaxed">
                      <MathRichText content={pg.aiTutorSummary.english} />
                    </div>
                    {pg.sections.map((sec, sIdx) => (
                      <ul
                        key={sIdx}
                        className="space-y-1.5 text-xs text-[#475569] dark:text-[#CBD5E1] list-disc pl-4"
                      >
                        {sec.bullets?.map((bText, bIdx) => (
                          <li key={bIdx}>
                            <MathRichText content={bText} inline />
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SUB-TAB 6: DYNAMIC FORMULA BOOK (ALL UPLOADED CHAPTERS & EQUATIONS) */}
          {/* ================================================================= */}
          {activeSubTab === 'Formula Book' && (
            <div className="space-y-6">
              {/* Formula Book Top Action & Chapter Filter Bar */}
              <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
                      Formula Book <span className="tabular-nums text-sm text-[#64748B] dark:text-[#94A3B8]">({allExtractedFormulas.length})</span>
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddFormulaForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg btn-brand text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddFormulaForm ? 'Close Form' : 'Add Formula'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                        showToast('Opened Print / Save as PDF for your Chapter Formula Book!');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                {/* Chapter Filter Tabs */}
                {availableFormulaChapters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[#E2E8F0] dark:border-white/[0.08]">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] dark:text-[#94A3B8] mr-1">
                      Chapter:
                    </span>
                    {['All', ...availableFormulaChapters].map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setFormulaChapterFilter(ch)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          formulaChapterFilter === ch
                            ? 'bg-[#2563EB] text-white font-semibold'
                            : 'bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#CBD5E1]'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                )}

                {/* Add Custom Formula Form */}
                {showAddFormulaForm && (
                  <form
                    onSubmit={handleAddCustomFormula}
                    className="p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"
                  >
                    <div>
                      <label className="block font-semibold text-[#334155] dark:text-[#E2E8F0] mb-1">
                        Formula Title
                      </label>
                      <input
                        type="text"
                        required
                        value={newFormulaTitle}
                        onChange={(e) => setNewFormulaTitle(e.target.value)}
                        placeholder="e.g., Parallel Axis Theorem"
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#334155] dark:text-[#E2E8F0] mb-1">
                        Equation
                      </label>
                      <input
                        type="text"
                        required
                        value={newFormulaLatex}
                        onChange={(e) => setNewFormulaLatex(e.target.value)}
                        placeholder="e.g., I = I_{cm} + M d^2"
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#334155] dark:text-[#E2E8F0] mb-1">
                        Variables
                      </label>
                      <input
                        type="text"
                        value={newFormulaVariables}
                        onChange={(e) => setNewFormulaVariables(e.target.value)}
                        placeholder="e.g., I_cm = COM inertia, M = mass"
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#334155] dark:text-[#E2E8F0] mb-1">
                        SI Units
                      </label>
                      <input
                        type="text"
                        value={newFormulaUnits}
                        onChange={(e) => setNewFormulaUnits(e.target.value)}
                        placeholder="e.g., kg·m²"
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]"
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                      <input
                        type="text"
                        value={newFormulaNotes}
                        onChange={(e) => setNewFormulaNotes(e.target.value)}
                        placeholder="Key condition or exam trap..."
                        className="flex-1 px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg btn-brand font-semibold transition-colors cursor-pointer"
                      >
                        Save Formula
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Grouped Formulas by Chapter */}
              {(formulaChapterFilter === 'All'
                ? availableFormulaChapters
                : [formulaChapterFilter]
              ).map((chapterName) => {
                const chapterFormulas = allExtractedFormulas.filter(
                  (f) => f.chapter === chapterName
                );
                if (chapterFormulas.length === 0) return null;
                return (
                  <div key={chapterName} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold tracking-[-0.01em] text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                        <span>{chapterName}</span>
                        <span className="text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          · {chapterFormulas.length}
                        </span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {chapterFormulas.map((fc) => (
                        <div
                          key={fc.id}
                          className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5 flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                                {fc.subject} · {fc.chapter}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(fc.formula);
                                  showToast(`Copied "${fc.title}" formula to clipboard!`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[11px] font-medium text-[#475569] dark:text-[#CBD5E1] cursor-pointer"
                                title="Copy Equation"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </div>

                            <h4 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                              {fc.title}
                            </h4>

                            <div className="p-3.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08]">
                              <MathRichText content={fc.formula} />
                            </div>

                            {(fc.variables || fc.units) && (
                              <div className="p-2.5 rounded-xl bg-[#F8FAFF] dark:bg-[#0D1322] border border-[#E2E8F0] dark:border-white/[0.06] text-[11px] space-y-1">
                                {fc.variables && (
                                  <div className="text-[#334155] dark:text-[#CBD5E1]">
                                    <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Variables: </strong>
                                    <MathRichText content={fc.variables} inline />
                                  </div>
                                )}
                                {fc.units && (
                                  <div className="text-[#64748B] dark:text-[#94A3B8] font-medium">
                                    <strong>SI Units: </strong>
                                    <MathRichText content={fc.units} inline />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-xs text-[#475569] dark:text-[#CBD5E1] pt-2 border-t border-[#E2E8F0] dark:border-white/[0.08]">
                            <MathRichText content={fc.notes} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 7: MISTAKE DNA & SUPERMEMO SM-2 NEURONZ QUEUE             */}
      {/* ================================================================= */}
      {activeSubTab === 'Mistake DNA' && (
        <SpacedRepetitionHub
          sm2Cards={sm2Cards}
          mistakes={mistakesNotebook}
          reviewedTodayCount={sm2ReviewedCount}
          onIncrementReviewed={onIncrementSm2Reviewed}
          onUpdateSM2Card={(updated) => {
            if (onUpdateSM2Card) onUpdateSM2Card(updated);
          }}
          onAddSM2Card={(newCard) => {
            if (onAddSM2Card) onAddSM2Card(newCard);
          }}
          onTagMistakeRootCause={(id, cause) => {
            if (onTagMistakeRootCause) onTagMistakeRootCause(id, cause);
          }}
          onVerifyMistakeRecheck={onVerifyMistakeRecheck}
          onPracticeMistake={onPracticeQuestion}
          showToast={showToast}
        />
      )}
    </div>
  );
};

// ============================================================================
// 2. PRACTICE DASHBOARD VIEW (Marks-Style Buckets + Custom Test Builder + Mistakes)
// ============================================================================
interface PracticeViewProps {
  onStartCBTMock: (examMode?: ExamTrack, options?: { resume?: boolean }) => void;
  onOpenInstantPractice: (paperTitle: string, customQuestions?: CBTQuestion[]) => void;
  onOpenCustomTestModal?: () => void;
  mistakesNotebook?: MistakeNotebookEntry[];
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const PracticeDashboardView: React.FC<PracticeViewProps> = ({
  onStartCBTMock,
  onOpenInstantPractice,
  onOpenCustomTestModal,
  mistakesNotebook = [],
  onRecordMistake,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'Official Papers' | 'PYQs' | 'Custom Set' | 'Analysis'
  >('Official Papers');
  const [paperFilter, setPaperFilter] = useState<
    | 'All'
    | 'JEE Main'
    | 'JEE Advanced'
    | 'NEET UG'
    | 'BITSAT'
    | '2026'
    | '2025'
    | '2024'
    | '2023'
    | '2022'
    | '2021'
    | '2020'
  >('All');
  const [packQuestions, setPackQuestions] = useState<
    Array<CBTQuestion & { paperId?: string; year?: number }>
  >([]);
  const [savedDraft, setSavedDraft] = useState<CbtInProgressDraft | null>(() =>
    loadCbtInProgressDraft()
  );

  useEffect(() => {
    setSavedDraft(loadCbtInProgressDraft());
    let active = true;
    Promise.allSettled([
      fetchLazyPyqPack('jee-main-shifts'),
      fetchLazyPyqPack('jee-advanced-papers'),
    ]).then(([mainRes, advRes]) => {
      if (!active) return;
      const normalizePack = (packData: any, examType: ExamTrack) => {
        const list = Array.isArray(packData?.questions) ? packData.questions : [];
        return list.map((q: any, idx: number) => ({
          id: String(q.id),
          number: Number(q.questionNumber || idx + 1),
          subject: q.subject || 'Physics',
          section: q.section || 'Section A',
          chapter: q.chapter || 'General',
          stem: q.stem || '',
          options: Array.isArray(q.options) ? q.options : [],
          correctIndex: -1,
          explanation: '',
          examType,
          examVersion: q.examVersion,
          advancedFormat:
            q.questionType === 'MULTI_MCQ'
              ? 'multiple'
              : q.questionType === 'MATRIX_MATCH'
              ? 'matrix'
              : q.questionType === 'PARAGRAPH'
              ? 'paragraph'
              : q.questionType === 'NUMERICAL'
              ? 'numerical'
              : undefined,
          matrixListI: q.matrixRows,
          matrixListII: q.matrixCols,
          paragraphContext: q.paragraphPassage,
          difficultyBucket:
            q.difficulty === 'Easy'
              ? 'Beginner'
              : q.difficulty === 'Tough'
              ? 'Advanced Climb'
              : 'Must-Do',
          pyqTag: q.shift || `${q.year || ''} ${examType}`.trim(),
          provenanceType: q.provenanceType,
          verificationStatus: q.verificationStatus,
          paperId: q.paperId,
          year: Number(q.year || 0),
        })) as Array<CBTQuestion & { paperId?: string; year?: number }>;
      };

      const mainQs =
        mainRes.status === 'fulfilled' ? normalizePack(mainRes.value, 'JEE Main') : [];
      const advQs =
        advRes.status === 'fulfilled' ? normalizePack(advRes.value, 'JEE Advanced') : [];
      setPackQuestions([...mainQs, ...advQs]);
    });
    return () => {
      active = false;
    };
  }, []);

  // PYQ Bank Filters (Including MathonGo Marks-style Buckets)
  const [pyqSubjectFilter, setPyqSubjectFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');
  const [pyqBucketFilter, setPyqBucketFilter] = useState<
    'All' | 'Beginner' | 'Must-Do' | 'Advanced Climb'
  >('All');
  const [selectedPyqOptions, setSelectedPyqOptions] = useState<Record<string, number>>({});
  const [pyqNumericalInputs, setPyqNumericalInputs] = useState<Record<string, string>>({});
  const [revealedPyqSolutions, setRevealedPyqSolutions] = useState<Record<string, boolean>>({});
  const [verifiedPyqSolutions, setVerifiedPyqSolutions] = useState<
    Record<
      string,
      {
        isCorrect: boolean;
        correctIndex: number;
        numericalAnswer?: number;
        explanation: string;
        keyVersion?: string;
      }
    >
  >({});
  const [verifyingPyqId, setVerifyingPyqId] = useState<string | null>(null);
  const [reportingQId, setReportingQId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportFeedback, setReportFeedback] = useState<Record<string, string>>({});

  // Custom Test Builder State
  const [customSubjects, setCustomSubjects] = useState<
    Array<'Physics' | 'Chemistry' | 'Mathematics'>
  >(['Physics', 'Chemistry', 'Mathematics']);
  const [customBucket, setCustomBucket] = useState<
    'All' | 'Beginner' | 'Must-Do' | 'Advanced Climb'
  >('Must-Do');
  const [customCount, setCustomCount] = useState<number>(10);

  const filteredPapers = OFFICIAL_PAPERS_LIST.filter((p) => {
    const isAdv = p.paper.includes('Advanced');
    const isNeet = p.paper.includes('NEET UG');
    const isBitsat = p.paper.includes('BITSAT');
    if (paperFilter === 'All') return true;
    if (paperFilter === 'JEE Main') return !isAdv && !isNeet && !isBitsat;
    if (paperFilter === 'JEE Advanced') return isAdv;
    if (paperFilter === 'NEET UG') return isNeet;
    if (paperFilter === 'BITSAT') return isBitsat;
    return String(p.year) === paperFilter;
  });

  const combinedPyqPool = useMemo(
    () => [
      ...packQuestions,
      ...CBT_MOCK_QUESTIONS.slice(0, 30),
      ...JEE_ADVANCED_PAPER_QUESTIONS,
      ...NEET_UG_PAPER_QUESTIONS,
      ...BITSAT_PAPER_QUESTIONS,
    ],
    [packQuestions]
  );

  const filteredPyqs = combinedPyqPool.filter((q) => {
    const subjMatch = pyqSubjectFilter === 'All' || q.subject === pyqSubjectFilter;
    const bucketMatch =
      pyqBucketFilter === 'All' || (q.difficultyBucket || 'Must-Do') === pyqBucketFilter;
    return subjMatch && bucketMatch;
  });

  const matchedCustomQuestions = useMemo(
    () =>
      filterCustomTestQuestions({
        basePool: combinedPyqPool,
        selectedSubjects: customSubjects,
        difficultyFilter: customBucket,
      }),
    [combinedPyqPool, customSubjects, customBucket]
  );

  const getQuestionsForOfficialPaper = (paperItem: (typeof OFFICIAL_PAPERS_LIST)[number]): CBTQuestion[] => {
    if (paperItem.paper.includes('NEET UG')) return NEET_UG_PAPER_QUESTIONS;
    if (paperItem.paper.includes('BITSAT')) return BITSAT_PAPER_QUESTIONS;
    const isAdv = paperItem.paper.includes('Advanced');
    const exactShift = packQuestions.filter((q) => q.paperId === paperItem.id);
    const sameYear = packQuestions.filter(
      (q) =>
        q.paperId !== paperItem.id &&
        String(q.year || '') === String(paperItem.year) &&
        (isAdv ? q.examType === 'JEE Advanced' : q.examType === 'JEE Main')
    );
    const fallbackPool = isAdv ? JEE_ADVANCED_PAPER_QUESTIONS : CBT_MOCK_QUESTIONS.slice(0, 12);
    const seen = new Set<string>();
    const combined: CBTQuestion[] = [];
    for (const q of [...exactShift, ...sameYear, ...fallbackPool]) {
      if (!seen.has(q.id)) {
        seen.add(q.id);
        combined.push(q);
      }
      if (combined.length >= 10 && exactShift.length === 0) break;
      if (exactShift.length > 0 && combined.length >= Math.max(exactShift.length, 6)) break;
    }
    return combined;
  };

  const handleToggleCustomSubject = (subj: 'Physics' | 'Chemistry' | 'Mathematics') => {
    setCustomSubjects((prev) =>
      prev.includes(subj)
        ? prev.length > 1
          ? prev.filter((s) => s !== subj)
          : prev
        : [...prev, subj]
    );
  };

  const handleLaunchCustomSet = () => {
    if (matchedCustomQuestions.length === 0) return;
    const finalQuestions = buildBalancedCustomTestQuestions({
      pool: matchedCustomQuestions,
      selectedSubjects: customSubjects,
      questionCount: customCount,
      groupBySubject: true,
    });
    onOpenInstantPractice(
      `Custom ${customBucket} Drill (${customSubjects.join(' + ')})`,
      finalQuestions
    );
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-10 xl:px-12 py-5 sm:py-6 space-y-6">
      {/* Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-3.5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
            Practice &amp; Mock Tests
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['Official Papers', 'PYQs', 'Custom Set', 'Analysis'] as const).map((tab) => {
            const active = activeSubTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveSubTab(tab)}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Crash-Recovery Auto-Saved CBT Mock Banner */}
      {savedDraft && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] dark:bg-amber-500/[0.08] p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Crash-Recovery Draft
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 text-[10px] tabular-nums font-semibold">
                  {savedDraft.examMode} • Q{savedDraft.currentQNumber}
                </span>
              </div>
              <p className="text-xs text-[#334155] dark:text-[#CBD5E1] mt-0.5">
                Saved with{' '}
                <strong className="tabular-nums">
                  {formatCountdownTimer(savedDraft.secondsRemaining)}
                </strong>{' '}
                remaining ({new Date(savedDraft.savedAt).toLocaleTimeString()}).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onStartCBTMock(savedDraft.examMode, { resume: true })}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer transition-colors"
            >
              Resume Interrupted Mock →
            </button>
            <button
              type="button"
              onClick={() => {
                void clearCbtInProgressDraft();
                setSavedDraft(null);
              }}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-white/[0.1] text-xs font-medium text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Hero Banner with Multi-Exam CBT Launchers */}
      <div className="bg-gradient-to-br from-[#0B1224] via-[#111827] to-[#1E1B4B] border border-[#2563EB]/25 rounded-2xl p-5 sm:p-6 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <h2 className="text-lg sm:text-xl font-bold tracking-[-0.02em] text-white">
            Proctored CBT Simulator
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            JEE Main (+4/-1), JEE Advanced (+4/-2 Partial), NEET UG, and BITSAT tracks with 15s auto-save and fullscreen proctoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Main')}
            className="px-3.5 py-2 rounded-lg btn-brand text-xs font-semibold transition-colors cursor-pointer"
          >
            JEE Main CBT →
          </button>
          {onOpenCustomTestModal && (
            <button
              type="button"
              onClick={onOpenCustomTestModal}
              className="px-3.5 py-2 rounded-lg btn-brand-secondary text-xs font-semibold transition-colors cursor-pointer"
            >
              Custom Test →
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Advanced')}
            className="px-3.5 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            JEE Advanced CBT →
          </button>
          <button
            type="button"
            onClick={() => onStartCBTMock('NEET UG')}
            className="px-3.5 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            NEET UG CBT →
          </button>
          <button
            type="button"
            onClick={() => onStartCBTMock('BITSAT')}
            className="px-3.5 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            BITSAT CBT →
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: OFFICIAL PAPERS */}
      {activeSubTab === 'Official Papers' && (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  'All',
                  'JEE Main',
                  'JEE Advanced',
                  'NEET UG',
                  'BITSAT',
                  '2026',
                  '2025',
                  '2024',
                  '2023',
                  '2022',
                  '2021',
                  '2020',
                ] as const
              ).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPaperFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    paperFilter === f
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#EEF2FF] dark:hover:bg-[#283548] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="text-xs tabular-nums font-medium text-[#64748B] dark:text-[#94A3B8]">
              {filteredPapers.length} Papers (2020–2026)
            </span>
          </div>

          <div className="divide-y divide-[#E2E8F0] dark:divide-white/[0.06]">
            {filteredPapers.map((paperItem) => {
              const isAdv = paperItem.paper.includes('Advanced');
              const isNeet = paperItem.paper.includes('NEET UG');
              const isBitsat = paperItem.paper.includes('BITSAT');
              const paperTrack: ExamTrack = isAdv
                ? 'JEE Advanced'
                : isNeet
                ? 'NEET UG'
                : isBitsat
                ? 'BITSAT'
                : 'JEE Main';
              return (
                <div
                  key={paperItem.id}
                  className="p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 hover:bg-[#F8FAFF] dark:hover:bg-[#1E293B]/60 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${
                          isAdv
                            ? 'bg-[#7C3AED]/10 border-[#7C3AED]/25 text-[#7C3AED] dark:text-[#A78BFA]'
                            : isNeet
                            ? 'bg-[#00A86B]/10 border-[#00A86B]/25 text-[#00A86B]'
                            : isBitsat
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                            : 'bg-[#2563EB]/10 border-[#2563EB]/25 text-[#2563EB] dark:text-[#60A5FA]'
                        }`}
                      >
                        {paperTrack}
                      </span>
                      <span className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                        {paperItem.paper}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] dark:text-[#94A3B8] flex flex-wrap items-center gap-2 sm:gap-3 tabular-nums">
                      <span>{paperItem.year}</span>
                      <span>·</span>
                      <span>{paperItem.session}</span>
                      <span>·</span>
                      <span>{paperItem.shift}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenInstantPractice(
                          paperItem.paper,
                          getQuestionsForOfficialPaper(paperItem)
                        )
                      }
                      className="px-3.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.1] bg-white dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer transition-colors"
                    >
                      Practice (Instant Solver)
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCBTMock(paperTrack)}
                      className="px-3.5 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors"
                    >
                      CBT Mode →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PYQs WITH MATHONGO MARKS-STYLE DIFFICULTY BUCKETS */}
      {activeSubTab === 'PYQs' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mr-1">
                Subject:
              </span>
              {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setPyqSubjectFilter(subj)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    pyqSubjectFilter === subj
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mr-1">
                Bucket:
              </span>
              {(['All', 'Beginner', 'Must-Do', 'Advanced Climb'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setPyqBucketFilter(b)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    pyqBucketFilter === b
                      ? 'bg-[#00A86B] text-white'
                      : 'bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredPyqs.slice(0, 15).map((q, idx) => {
              const chosen = selectedPyqOptions[q.id];
              const verified = verifiedPyqSolutions[q.id];
              const isRevealed = Boolean(revealedPyqSolutions[q.id] && verified);
              const isCorrect = verified ? verified.isCorrect : false;
              const resolvedCorrectIndex = verified ? verified.correctIndex : -1;
              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] text-xs tabular-nums font-semibold">
                        PYQ #{idx + 1} • {q.subject} ({q.chapter})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                          q.difficultyBucket === 'Advanced Climb'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                            : q.difficultyBucket === 'Beginner'
                            ? 'bg-[#00A86B]/10 border-[#00A86B]/25 text-[#00A86B]'
                            : 'bg-[#7C3AED]/10 border-[#7C3AED]/25 text-[#7C3AED] dark:text-[#A78BFA]'
                        }`}
                      >
                        {q.difficultyBucket || 'Must-Do'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#F8FAFF] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] text-[10px]">
                        {q.provenanceType || 'RECONSTRUCTED_WITH_SOURCE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs tabular-nums font-medium text-[#64748B] dark:text-[#94A3B8]">
                        {q.section === 'Section B'
                          ? q.examType === 'JEE Advanced'
                            ? '+4 / 0 (Numerical)'
                            : '+4 / -1 (Numerical)'
                          : '+4 / -1'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReportingQId((cur) => (cur === q.id ? null : q.id));
                          setReportText('');
                        }}
                        className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] underline cursor-pointer"
                      >
                        Report Issue
                      </button>
                    </div>
                  </div>

                  {reportingQId === q.id && (
                    <div className="p-3 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center gap-2 text-xs">
                      <input
                        type="text"
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Describe answer key discrepancy, LaTeX typo, or provenance issue..."
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.1] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!reportText.trim()) return;
                          const r = await reportQuestionIssueOnServer({
                            questionId: q.id,
                            issueType: 'wrong_answer_key',
                            details: reportText.trim(),
                          });
                          setReportFeedback((prev) => ({
                            ...prev,
                            [q.id]: r.ok
                              ? 'Reported to editorial review queue.'
                              : `[${r.error.errorCode}] ${r.error.message}`,
                          }));
                          setReportingQId(null);
                          setReportText('');
                        }}
                        className="px-3 py-1.5 rounded-lg btn-brand font-semibold cursor-pointer"
                      >
                        Submit
                      </button>
                    </div>
                  )}

                  {reportFeedback[q.id] && (
                    <div className="text-[11px] font-medium text-[#2563EB] dark:text-[#60A5FA]">
                      {reportFeedback[q.id]}
                    </div>
                  )}

                  <div className="text-sm sm:text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed">
                    <MathRichText content={q.stem} />
                  </div>

                  {(() => {
                    const isNumericalPyq =
                      q.options.length === 0 ||
                      q.section === 'Section B' ||
                      q.advancedFormat === 'numerical';
                    if (isNumericalPyq) {
                      const numVal = pyqNumericalInputs[q.id] || '';
                      const handleVerifyNumerical = async () => {
                        const cleanVal = sanitizeNumericalInputValue(numVal);
                        if (!cleanVal || cleanVal === '-' || cleanVal === '.') return;
                        setVerifyingPyqId(q.id);
                        try {
                          const srv = await verifySinglePyqAnswerOnServer({
                            questionId: q.id,
                            numericalValue: cleanVal,
                          });
                          if (srv.ok) {
                            setVerifiedPyqSolutions((prev) => ({
                              ...prev,
                              [q.id]: {
                                isCorrect: srv.data.isCorrect,
                                correctIndex: srv.data.correctIndex,
                                numericalAnswer: srv.data.numericalAnswer,
                                explanation: srv.data.explanation,
                                keyVersion: srv.data.keyVersion,
                              },
                            }));
                            setRevealedPyqSolutions((prev) => ({ ...prev, [q.id]: true }));
                            if (!srv.data.isCorrect && onRecordMistake) {
                              onRecordMistake(q, cleanVal);
                            }
                          } else {
                            setReportFeedback((prev) => ({
                              ...prev,
                              [q.id]: srv.error.message || 'Server answer verification failed.',
                            }));
                          }
                        } finally {
                          setVerifyingPyqId(null);
                        }
                      };
                      const appendKey = (token: string) => {
                        setPyqNumericalInputs((prev) => ({
                          ...prev,
                          [q.id]: sanitizeNumericalInputValue((prev[q.id] || '') + token),
                        }));
                      };
                      return (
                        <div className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/60 space-y-3 max-w-md">
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            <span>Numerical / Integer Answer</span>
                            {isRevealed && verified?.numericalAnswer !== undefined && (
                              <span className="px-2 py-0.5 rounded bg-[#00A86B]/10 text-[#00A86B] tabular-nums">
                                Key: {verified.numericalAnswer}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`Numerical answer for PYQ ${idx + 1}`}
                              value={numVal}
                              onChange={(e) =>
                                setPyqNumericalInputs((prev) => ({
                                  ...prev,
                                  [q.id]: sanitizeNumericalInputValue(e.target.value),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleVerifyNumerical();
                                }
                              }}
                              placeholder="Enter integer or decimal..."
                              className="flex-1 px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.1] bg-white dark:bg-[#111827] text-sm font-mono text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                            />
                            <button
                              type="button"
                              disabled={!numVal || verifyingPyqId === q.id}
                              onClick={() => void handleVerifyNumerical()}
                              className="px-4 py-2 rounded-lg btn-brand disabled:opacity-50 text-xs font-semibold cursor-pointer"
                            >
                              Check Answer
                            </button>
                          </div>
                          <div className="grid grid-cols-7 gap-1.5 text-xs font-mono">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '-'].map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => appendKey(k)}
                                className="py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-[#EEF2FF] dark:hover:bg-[#283548] font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
                              >
                                {k}
                              </button>
                            ))}
                            <button
                              type="button"
                              aria-label="Backspace"
                              onClick={() =>
                                setPyqNumericalInputs((prev) => ({
                                  ...prev,
                                  [q.id]: (prev[q.id] || '').slice(0, -1),
                                }))
                              }
                              className="py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[#475569] dark:text-[#94A3B8] flex items-center justify-center cursor-pointer"
                            >
                              <Delete className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPyqNumericalInputs((prev) => ({
                                  ...prev,
                                  [q.id]: '',
                                }))
                              }
                              className="col-span-2 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-slate-100 dark:hover:bg-[#283548] font-sans text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {q.options.map((opt, optIdx) => {
                          const selected = chosen === optIdx;
                          let cls =
                            'border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B]/60 text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFF] dark:hover:bg-[#283548]';
                          if (isRevealed) {
                            if (optIdx === resolvedCorrectIndex) {
                              cls =
                                'border-[#00A86B]/50 bg-[#00A86B]/10 text-[#065F46] dark:text-emerald-200';
                            } else if (selected) {
                              cls =
                                'border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200';
                            }
                          } else if (selected) {
                            cls =
                              'border-[#2563EB]/50 bg-[#2563EB]/10 text-[#1E40AF] dark:text-blue-200';
                          }
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              disabled={verifyingPyqId === q.id}
                              onClick={async () => {
                                setSelectedPyqOptions((prev) => ({ ...prev, [q.id]: optIdx }));
                                setVerifyingPyqId(q.id);
                                try {
                                  const srv = await verifySinglePyqAnswerOnServer({
                                    questionId: q.id,
                                    selectedOption: optIdx,
                                  });
                                  if (srv.ok) {
                                    setVerifiedPyqSolutions((prev) => ({
                                      ...prev,
                                      [q.id]: {
                                        isCorrect: srv.data.isCorrect,
                                        correctIndex: srv.data.correctIndex,
                                        explanation: srv.data.explanation,
                                        keyVersion: srv.data.keyVersion,
                                      },
                                    }));
                                    setRevealedPyqSolutions((prev) => ({ ...prev, [q.id]: true }));
                                    if (!srv.data.isCorrect && onRecordMistake) {
                                      onRecordMistake(q, opt);
                                    }
                                  } else {
                                    setReportFeedback((prev) => ({
                                      ...prev,
                                      [q.id]: srv.error.message || 'Server answer verification failed.',
                                    }));
                                  }
                                } finally {
                                  setVerifyingPyqId(null);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left text-xs sm:text-sm font-medium flex items-center justify-between cursor-pointer transition-colors ${cls}`}
                            >
                              <span className="flex items-center gap-2">
                                <strong className="tabular-nums">
                                  ({String.fromCharCode(65 + optIdx)})
                                </strong>
                                <MathRichText content={opt} inline />
                              </span>
                              {isRevealed && optIdx === resolvedCorrectIndex && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00A86B]">
                                  <Check className="w-3.5 h-3.5" />
                                  Correct
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {verifyingPyqId === q.id && (
                    <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                      Verifying answer...
                    </div>
                  )}

                  {isRevealed && verified && (
                    <div
                      className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                        isCorrect
                          ? 'bg-[#00A86B]/[0.07] border-[#00A86B]/25 text-emerald-950 dark:text-emerald-200'
                          : 'bg-amber-500/[0.07] border-amber-500/25 text-amber-950 dark:text-amber-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                        <span>
                          {isCorrect
                            ? 'Correct — Step-by-Step Derivation:'
                            : 'Logged to Mistakes Notebook — Derivation:'}
                        </span>
                        {verified.keyVersion && (
                          <span className="text-[10px] tabular-nums px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-white/[0.08]">
                            {verified.keyVersion}
                          </span>
                        )}
                      </div>
                      <MathRichText content={verified.explanation || q.explanation} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CUSTOM TEST BUILDER */}
      {activeSubTab === 'Custom Set' && (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-6 max-w-3xl mx-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                Custom JEE Practice Builder
              </span>
              <h2 className="text-xl font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">
                Targeted Subject &amp; Bucket Drill
              </h2>
            </div>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-semibold tabular-nums border ${
                matchedCustomQuestions.length > 0
                  ? 'bg-[#00A86B]/10 border-[#00A86B]/25 text-[#00A86B]'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400'
              }`}
            >
              {matchedCustomQuestions.length} matching questions
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                1. Subjects
              </label>
              <div className="flex flex-wrap gap-2.5">
                {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                  const active = customSubjects.includes(subj);
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => handleToggleCustomSubject(subj)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                        active
                          ? 'border-[#2563EB] bg-[#2563EB] text-white'
                          : 'border-[#E2E8F0] dark:border-white/[0.1] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      {subj}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                2. Difficulty Bucket
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(['All', 'Beginner', 'Must-Do', 'Advanced Climb'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setCustomBucket(b)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      customBucket === b
                        ? 'border-[#00A86B] bg-[#00A86B] text-white'
                        : 'border-[#E2E8F0] dark:border-white/[0.1] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                3. Question Count
              </label>
              <div className="flex flex-wrap gap-2.5">
                {[5, 10, 15, 25].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setCustomCount(cnt)}
                    className={`px-4 py-2 rounded-lg border text-xs tabular-nums font-semibold cursor-pointer transition-colors ${
                      customCount === cnt
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : 'border-[#E2E8F0] dark:border-white/[0.1] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                    }`}
                  >
                    {cnt} Questions
                  </button>
                ))}
              </div>
            </div>
          </div>

          {matchedCustomQuestions.length === 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                No questions match the selected subject and difficulty bucket filter. Try choosing &quot;All&quot; difficulty or adding another subject.
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={matchedCustomQuestions.length === 0}
            onClick={handleLaunchCustomSet}
            className="w-full py-2.5 rounded-lg btn-brand disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition-colors tabular-nums"
          >
            Generate &amp; Start Custom Practice Set ({Math.min(customCount, matchedCustomQuestions.length)} Qs) →
          </button>
        </div>
      )}

      {/* SUB-TAB 4: ANALYSIS & MY MISTAKES NOTEBOOK */}
      {activeSubTab === 'Analysis' && (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
              Mistakes Notebook &amp; Accuracy
            </h2>
            <span className="px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs tabular-nums font-semibold">
              {mistakesNotebook.length} Recorded
            </span>
          </div>

          {mistakesNotebook.length === 0 ? (
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              No mistakes recorded yet. Attempt any PYQ or CBT Mock to log errors automatically.
            </p>
          ) : (
            <div className="space-y-3">
              {mistakesNotebook.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/70 space-y-2"
                >
                  <div className="text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    {m.question.subject} • {m.question.chapter}
                  </div>
                  <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    <MathRichText content={m.question.stem} />
                  </div>
                  <div className="text-xs text-[#475569] dark:text-[#CBD5E1]">
                    <MathRichText content={m.question.explanation} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. PROGRESS DASHBOARD VIEW
// ============================================================================
interface ProgressViewProps {
  onStartCBTMock: (examMode?: 'JEE Main' | 'JEE Advanced') => void;
  onPracticeWeakTopic: (topic: string) => void;
  lastMockScore: number | null;
  materialsCount?: number;
  mistakesCount?: number;
}

export const ProgressDashboardView: React.FC<ProgressViewProps> = ({
  onStartCBTMock,
  onPracticeWeakTopic,
  lastMockScore,
  materialsCount = 0,
  mistakesCount = 0,
}) => {
  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
            JEE Readiness &amp; Analytics
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Study materials, CBT scores, and weak-chapter drills.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onStartCBTMock('JEE Main')}
          className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors"
        >
          Attempt Full 75-Q CBT Mock →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Latest CBT Score</div>
          <div className="text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC] mt-1">
            {lastMockScore !== null ? `${lastMockScore} / 300` : 'Not Attempted'}
          </div>
          <div className="text-[11px] text-[#00A86B] font-medium mt-1">
            {lastMockScore !== null ? 'Latest completed mock' : 'Take your first 75-Q CBT'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Study Materials</div>
          <div className="text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC] mt-1">
            {materialsCount}
          </div>
          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-1">
            User-owned library
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Mistake DNA</div>
          <div className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {mistakesCount}
          </div>
          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-1">
            From PYQs &amp; CBT
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Exam Countdown</div>
          <div className="text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC] mt-1">
            69 Days
          </div>
          <div className="text-[11px] text-[#7C3AED] dark:text-[#A78BFA] font-medium mt-1">
            High-weightage window
          </div>
        </div>
      </div>

      {/* Weak-Topic Remediation Drills */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-4">
        <h2 className="text-base font-bold tracking-[-0.01em] text-[#0F172A] dark:text-[#F8FAFC]">
          Recommended High-Weightage Drills
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              topic: 'Rotational Dynamics & Moment of Inertia',
              subject: 'Physics',
              note: 'Focus on Parallel Axis Theorem & Pure Rolling energy conservation.',
            },
            {
              topic: 'Electrochemistry & Nernst Equation',
              subject: 'Chemistry',
              note: 'Focus on cell EMF at non-standard concentrations and Faraday laws.',
            },
            {
              topic: 'Definite Integration & King’s Property',
              subject: 'Mathematics',
              note: 'Focus on $\\int_a^b f(x)dx = \\int_a^b f(a+b-x)dx$ and Leibniz rule.',
            },
          ].map((item) => (
            <div
              key={item.topic}
              className="p-4 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/70 space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                  {item.subject}
                </span>
                <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {item.topic}
                </div>
                <div className="text-xs text-[#475569] dark:text-[#94A3B8]">
                  <MathRichText content={item.note} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onPracticeWeakTopic(item.topic)}
                className="w-full py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors"
              >
                Start Adaptive Drill →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. FULL-SCREEN NTA CBT MOCK EXAM VIEW (75-Q JEE MAIN & JEE ADVANCED PAPER 1/2)
// ============================================================================
interface CBTMockExamProps {
  candidateName: string;
  initialExamMode?: ExamTrack;
  customQuestions?: CBTQuestion[];
  customDurationMinutes?: number;
  customPaperTitle?: string;
  sessionId?: string;
  resumeFromDraft?: boolean;
  onSubmitMock: (
    summary: CBTMockSummary,
    focusEvents: number,
    questions?: CBTQuestion[],
    responses?: Record<string, CBTQuestionResponse>
  ) => void;
  onExitMock: () => void;
  onRecordMistake?: (question: CBTQuestion, userAnswer: string) => void;
}

export const CBTMockExamView: React.FC<CBTMockExamProps> = ({
  candidateName,
  initialExamMode = 'JEE Main',
  customQuestions,
  customDurationMinutes,
  customPaperTitle,
  sessionId: _sessionId,
  resumeFromDraft = false,
  onSubmitMock,
  onExitMock,
  onRecordMistake,
}) => {
  const isCustomTest = Boolean(customQuestions && customQuestions.length > 0);
  const rawExistingDraft = !isCustomTest && resumeFromDraft ? loadCbtInProgressDraft() : null;
  const sessionInit = resolveCbtSessionInit({
    initialExamMode,
    customQuestions,
    customDurationMinutes,
    resumeFromDraft,
    existingDraft: rawExistingDraft,
  });
  const existingDraft = sessionInit.shouldResumeDraft ? rawExistingDraft : null;

  const [examMode, setExamMode] = useState<ExamTrack>(sessionInit.examMode);

  const getQuestionsForMode = (mode: ExamTrack): CBTQuestion[] => {
    if (customQuestions && customQuestions.length > 0) return customQuestions;
    if (mode === 'JEE Advanced') return JEE_ADVANCED_PAPER_QUESTIONS;
    if (mode === 'NEET UG') return NEET_UG_PAPER_QUESTIONS;
    if (mode === 'BITSAT') return BITSAT_PAPER_QUESTIONS;
    return CBT_MOCK_QUESTIONS;
  };

  const questionsList = getQuestionsForMode(examMode);
  const initialQuestion =
    questionsList.find((q) => q.number === sessionInit.initialQNumber) || questionsList[0];

  const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>(
    initialQuestion?.subject || questionsList[0]?.subject || 'Physics'
  );
  const [activeSection, setActiveSection] = useState<'Section A' | 'Section B'>(
    initialQuestion?.section || 'Section A'
  );
  const [currentQNumber, setCurrentQNumber] = useState<number>(sessionInit.initialQNumber);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    sessionInit.initialSecondsRemaining
  );
  const [focusEvents, setFocusEvents] = useState<number>(
    existingDraft?.focusSwitchCount || 0
  );
  const [proctorWarningLog, setProctorWarningLog] = useState<
    { timestamp: string; reason: string }[]
  >(existingDraft?.focusEvents || []);
  const [isFullscreenLocked, setIsFullscreenLocked] = useState<boolean>(false);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>(
    existingDraft?.savedAt
      ? new Date(existingDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : isCustomTest
      ? 'Isolated session'
      : 'Just now'
  );
  const [examLanguage, setExamLanguage] = useState<'English' | 'Hindi'>('English');
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  const [submittedSummary, setSubmittedSummary] = useState<CBTMockSummary | null>(null);
  const [submittingCbt, setSubmittingCbt] = useState<boolean>(false);
  const [submitCbtError, setSubmitCbtError] = useState<string | null>(null);
  const [serverSolutions, setServerSolutions] = useState<
    Record<
      string,
      {
        correctIndex: number;
        correctIndices?: number[];
        numericalAnswer?: number;
        explanation: string;
      }
    >
  >({});

  const buildInitialResponses = (list: CBTQuestion[]) => {
    const init: Record<string, CBTQuestionResponse> = {};
    list.forEach((q, idx) => {
      init[q.id] = {
        status: idx === 0 ? 'not_answered' : 'not_visited',
        selectedOption: null,
        selectedOptions: [],
        numericalValue: '',
        timeSpentSec: 0,
      };
    });
    return init;
  };

  const [responses, setResponses] = useState<Record<string, CBTQuestionResponse>>(() => {
    if (
      existingDraft &&
      existingDraft.examMode === examMode &&
      existingDraft.responses &&
      Object.keys(existingDraft.responses).length > 0
    ) {
      return existingDraft.responses;
    }
    return buildInitialResponses(questionsList);
  });

  // Reset responses when switching exam mode
  const handleSwitchExamMode = (mode: ExamTrack) => {
    const nextList = getQuestionsForMode(mode);
    setExamMode(mode);
    setActiveSubject(nextList[0]?.subject || 'Physics');
    setActiveSection('Section A');
    setCurrentQNumber(1);
    setSecondsRemaining(180 * 60);
    setResponses(buildInitialResponses(nextList));
  };

  const currentQuestion =
    questionsList.find((q) => q.number === currentQNumber) || questionsList[0];

  // 1-second exam timer + per-question time-spent tracker
  useEffect(() => {
    if (submittedSummary) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      if (currentQuestion) {
        setResponses((prev) => {
          const cur = prev[currentQuestion.id];
          if (!cur) return prev;
          return {
            ...prev,
            [currentQuestion.id]: {
              ...cur,
              timeSpentSec: (cur.timeSpentSec || 0) + 1,
            },
          };
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion?.id, submittedSummary]);

  // 15-Second Crash-Recovery Auto-Save Loop for official mocks (isolated away from Custom Tests)
  useEffect(() => {
    if (submittedSummary || isCustomTest) return;
    const performAutoSave = () => {
      const nowIso = new Date().toISOString();
      void saveCbtInProgressDraft({
        examMode,
        secondsRemaining,
        currentQNumber,
        responses,
        focusSwitchCount: focusEvents,
        focusEvents: proctorWarningLog,
        savedAt: nowIso,
      });
      setLastAutoSavedTime(
        new Date(nowIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    const interval = setInterval(performAutoSave, 15000);
    return () => clearInterval(interval);
  }, [
    isCustomTest,
    examMode,
    secondsRemaining,
    currentQNumber,
    responses,
    focusEvents,
    proctorWarningLog,
    submittedSummary,
  ]);

  // Fullscreen lock & Tab-Switch / Blur 3-Strike Proctoring Detector
  useEffect(() => {
    const recordFocusStrike = (reason: string) => {
      setFocusEvents((f) => f + 1);
      setProctorWarningLog((prev) => [
        { timestamp: new Date().toLocaleTimeString(), reason },
        ...prev.slice(0, 9),
      ]);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        recordFocusStrike('Tab switched or window minimized');
      }
    };
    const handleWindowBlur = () => {
      recordFocusStrike('Exam window lost active focus');
    };
    const handleFullscreenChange = () => {
      const activeFs = Boolean(document.fullscreenElement);
      setIsFullscreenLocked(activeFs);
      if (!activeFs) {
        recordFocusStrike('Exited full-screen lock during CBT session');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreenLock = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreenLocked(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreenLocked(false);
      }
    } catch {
      // Browser or iframe policy blocked fullscreen request
      setIsFullscreenLocked((v) => !v);
    }
  };

  const currentResponse: CBTQuestionResponse = responses[currentQuestion.id] || {
    status: 'not_answered',
    selectedOption: null,
    selectedOptions: [],
    numericalValue: '',
    timeSpentSec: 0,
  };

  const subjectQuestions = questionsList.filter((q) => {
    if (q.subject !== activeSubject) return false;
    if (examMode === 'JEE Main') {
      return (q.section || 'Section A') === activeSection;
    }
    return true;
  });

  const handleJumpToQuestion = (qNum: number) => {
    const targetQ = questionsList.find((q) => q.number === qNum);
    if (!targetQ) return;
    setActiveSubject(targetQ.subject);
    if (examMode === 'JEE Main' && targetQ.section) {
      setActiveSection(targetQ.section);
    }
    setCurrentQNumber(qNum);
    setResponses((prev) => {
      const existing = prev[targetQ.id];
      if (!existing || existing.status === 'not_visited') {
        return {
          ...prev,
          [targetQ.id]: {
            ...(existing || {
              selectedOption: null,
              selectedOptions: [],
              numericalValue: '',
              timeSpentSec: 0,
            }),
            status: 'not_answered',
          },
        };
      }
      return prev;
    });
  };

  const handleSelectSingleOption = (optIdx: number) => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        selectedOption: optIdx,
      },
    }));
  };

  const handleToggleMultipleOption = (optIdx: number) => {
    const currentMulti = currentResponse.selectedOptions || [];
    const nextMulti = currentMulti.includes(optIdx)
      ? currentMulti.filter((i: number) => i !== optIdx)
      : [...currentMulti, optIdx].sort((a, b) => a - b);
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        selectedOptions: nextMulti,
      },
    }));
  };

  const handleNumericalDirectChange = (rawValue: string) => {
    const sanitized = sanitizeNumericalInputValue(rawValue);
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        numericalValue: sanitized,
      },
    }));
  };

  const handleNumericalKeyPress = (key: string) => {
    const curVal = currentResponse.numericalValue || '';
    let nextVal = curVal;
    if (key === 'CLEAR') nextVal = '';
    else if (key === 'BACKSPACE') nextVal = curVal.slice(0, -1);
    else nextVal = sanitizeNumericalInputValue(curVal + key);

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        numericalValue: nextVal,
      },
    }));
  };

  const isNumericalQ =
    currentQuestion.section === 'Section B' || currentQuestion.advancedFormat === 'numerical';
  const isMultipleQ = currentQuestion.advancedFormat === 'multiple';

  const hasAnswerValue = () => {
    if (isNumericalQ) {
      return Boolean(currentResponse.numericalValue && currentResponse.numericalValue.trim() !== '');
    }
    if (isMultipleQ) {
      return Boolean(currentResponse.selectedOptions && currentResponse.selectedOptions.length > 0);
    }
    return currentResponse.selectedOption !== null;
  };

  const advanceToNextQuestion = () => {
    const nextNum = currentQNumber < questionsList.length ? currentQNumber + 1 : 1;
    handleJumpToQuestion(nextNum);
  };

  const handleSaveAndNext = () => {
    const answered = hasAnswerValue();
    const nextResponses: Record<string, CBTQuestionResponse> = {
      ...responses,
      [currentQuestion.id]: {
        ...currentResponse,
        status: answered ? 'answered' : 'not_answered',
      },
    };
    setResponses(nextResponses);
    if (!isCustomTest) {
      const nowIso = new Date().toISOString();
      void saveCbtInProgressDraft({
        examMode,
        secondsRemaining,
        currentQNumber,
        responses: nextResponses,
        focusSwitchCount: focusEvents,
        focusEvents: proctorWarningLog,
        savedAt: nowIso,
      });
      setLastAutoSavedTime(
        new Date(nowIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }
    advanceToNextQuestion();
  };

  const handleMarkForReviewAndNext = () => {
    const answered = hasAnswerValue();
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        status: answered ? 'answered_marked' : 'marked',
      },
    }));
    advanceToNextQuestion();
  };

  const handleClearResponse = () => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...currentResponse,
        status: 'not_answered',
        selectedOption: null,
        selectedOptions: [],
        numericalValue: '',
      },
    }));
  };

  const handleTriggerSubmit = async () => {
    setSubmittingCbt(true);
    setSubmitCbtError(null);
    try {
      const graded = await gradeCbtAttemptOnServerApi({
        attemptType: customQuestions && customQuestions.length > 0 ? 'custom_drill' : 'official_mock',
        questionIds:
          !customQuestions || customQuestions.length === 0
            ? questionsList.map((q) => q.id)
            : undefined,
        questions:
          customQuestions && customQuestions.length > 0 ? questionsList : undefined,
        responses,
        examMode,
      });

      if (!graded.ok) {
        setSubmitCbtError(
          graded.error.message || 'Server CBT grading unavailable. Your draft remains saved; please retry.'
        );
        return;
      }

      if (!isCustomTest) {
        void clearCbtInProgressDraft();
      }
      const summary = graded.data.summary as CBTMockSummary;
      setServerSolutions(graded.data.questionSolutions || {});
      setSubmittedSummary(summary);
      if (onRecordMistake && summary.questionDetails) {
        summary.questionDetails.forEach((detail: QuestionAttemptDetail) => {
          if (detail.isAttempted && !detail.isCorrect) {
            const qObj = questionsList.find((q) => q.id === detail.questionId);
            if (qObj) {
              const sol = graded.data.questionSolutions?.[qObj.id];
              onRecordMistake(
                sol
                  ? {
                      ...qObj,
                      correctIndex: sol.correctIndex,
                      correctIndices: sol.correctIndices,
                      numericalAnswer: sol.numericalAnswer,
                      explanation: sol.explanation,
                    }
                  : qObj,
                detail.userAnswerLabel || 'Incorrect CBT Response'
              );
            }
          }
        });
      }
    } finally {
      setSubmittingCbt(false);
    }
  };

  const livePaletteCounts = questionsList.reduce(
    (acc, q) => {
      const st = responses[q.id]?.status || 'not_visited';
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    {
      not_visited: 0,
      not_answered: 0,
      answered: 0,
      marked: 0,
      answered_marked: 0,
    }
  );

  return (
    <div className="min-h-screen bg-[#F8FAFF] dark:bg-[#070B14] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col">
      {/* Top Official Multi-Exam Proctored CBT Bar */}
      <header className="bg-[#0B1224] dark:bg-[#111827] border-b border-white/[0.08] text-white px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-[#2563EB]/25 to-[#7C3AED]/25 border border-white/[0.12] text-[11px] font-semibold uppercase tracking-wider text-blue-100">
            PROCTORED CBT CONSOLE
          </span>
          <div className="flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] p-1 rounded-lg flex-wrap">
            {(['JEE Main', 'JEE Advanced', 'NEET UG', 'BITSAT'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSwitchExamMode(m)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  examMode === m
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
          <div
            title="Auto-saves your responses and timer every 15 seconds"
            className="px-2.5 py-1.5 rounded-lg bg-[#00A86B]/15 border border-[#00A86B]/30 text-emerald-300 flex items-center gap-1.5 tabular-nums"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00A86B]" />
            <span>Auto-Saved ({lastAutoSavedTime})</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-white/[0.07] border border-white/[0.1] flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300">Time Left:</span>
            <span className="tabular-nums text-sm font-bold text-amber-300">
              {formatCountdownTimer(secondsRemaining)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleFullscreenLock}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              isFullscreenLocked
                ? 'bg-[#00A86B]/20 border-[#00A86B]/40 text-emerald-200'
                : 'bg-white/[0.07] border-white/[0.12] text-slate-200 hover:bg-white/[0.14]'
            }`}
          >
            {isFullscreenLocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Fullscreen Locked</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Lock Fullscreen</span>
              </>
            )}
          </button>

          <div
            className={`px-3 py-1.5 rounded-lg border tabular-nums ${
              focusEvents >= 3
                ? 'bg-rose-600/90 border-rose-400 text-white'
                : focusEvents > 0
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                : 'bg-white/[0.07] border-white/[0.1] text-slate-300'
            }`}
          >
            Proctor Warnings: <span className="font-bold">{focusEvents} / 3</span>
          </div>

          <select
            value={examLanguage}
            onChange={(e) => setExamLanguage(e.target.value as 'English' | 'Hindi')}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] text-white text-xs font-semibold border border-white/[0.14] cursor-pointer"
          >
            <option value="English" className="text-slate-900">
              English
            </option>
            <option value="Hindi" className="text-slate-900">
              हिन्दी (Hindi)
            </option>
          </select>

          <button
            type="button"
            onClick={() => setShowInstructionsModal(true)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] text-xs font-semibold cursor-pointer transition-colors"
          >
            Instructions
          </button>

          <button
            type="button"
            onClick={onExitMock}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Save &amp; Exit
          </button>
        </div>
      </header>

      {/* 3-Strike Proctoring Warning Banner */}
      {focusEvents > 0 && (
        <div
          className={`px-6 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
            focusEvents >= 3
              ? 'bg-rose-600 text-white'
              : 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-b border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Proctoring Alert (Strike {Math.min(3, focusEvents)} of 3):{' '}
              {proctorWarningLog[0]?.reason || 'Tab switch or window blur detected'}. Stay in
              full-screen mode to maintain official exam integrity.
            </span>
          </div>
          {!isFullscreenLocked && (
            <button
              type="button"
              onClick={handleToggleFullscreenLock}
              className="px-2.5 py-1 rounded-md btn-brand text-[11px] font-semibold cursor-pointer"
            >
              Re-enter Fullscreen
            </button>
          )}
        </div>
      )}

      {/* Main 12-Col Split Workspace */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 9 Cols: Subject Tabs, Section Tabs & Question Canvas */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          {/* Subject & Section Bar */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                const active = activeSubject === subj;
                const subjCount = questionsList.filter((q) => q.subject === subj).length;
                if (isCustomTest && subjCount === 0) return null;
                const firstQ = questionsList.find((q) => q.subject === subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => {
                      setActiveSubject(subj);
                      setActiveSection(firstQ?.section || 'Section A');
                      if (firstQ) handleJumpToQuestion(firstQ.number);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors tabular-nums ${
                      active
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-[#F8FAFF] dark:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                    }`}
                  >
                    {subj} ({subjCount} Qs)
                  </button>
                );
              })}
            </div>

            {examMode === 'JEE Main' && (
              <div className="flex flex-wrap items-center gap-2">
                {(['Section A', 'Section B'] as const).map((sec) => {
                  const secQs = questionsList.filter(
                    (q) => q.subject === activeSubject && (q.section || 'Section A') === sec
                  );
                  if (isCustomTest && secQs.length === 0) return null;
                  const active = activeSection === sec;
                  const firstSecQ = secQs[0];
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setActiveSection(sec);
                        if (firstSecQ) handleJumpToQuestion(firstSecQ.number);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-[#F8FAFF] dark:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EEF2FF] dark:hover:bg-[#283548]'
                      }`}
                    >
                      {isCustomTest
                        ? sec === 'Section A'
                          ? `Section A (${secQs.length} MCQs • +4 / -1)`
                          : `Section B (${secQs.length} Numericals • +4 / -1)`
                        : sec === 'Section A'
                        ? 'Section A (20 MCQs • +4 / -1)'
                        : 'Section B (5 Compulsory Numericals • +4 / -1)'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Question Stem & Options Card */}
          <div className="flex-1 bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                    Question {currentQuestion.number} of {questionsList.length}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-semibold">
                    {currentQuestion.subject} • {currentQuestion.chapter}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#F8FAFF] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] text-xs font-semibold uppercase">
                    {currentQuestion.advancedFormat ||
                      (currentQuestion.section === 'Section B' ? 'NUMERICAL' : 'SINGLE MCQ')}
                  </span>
                  {customPaperTitle && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#00A86B]/10 border border-[#00A86B]/25 text-[#00A86B] text-[10px] font-semibold">
                      {customPaperTitle}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums font-semibold">
                  <span className="text-[#00A86B] bg-[#00A86B]/10 border border-[#00A86B]/25 px-2.5 py-1 rounded-md">
                    +
                    {examMode === 'JEE Advanced' &&
                    (currentQuestion.advancedFormat === 'single' ||
                      currentQuestion.advancedFormat === 'matrix' ||
                      currentQuestion.advancedFormat === 'paragraph')
                      ? 3
                      : 4}{' '}
                    Correct
                  </span>
                  <span className="text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-md">
                    {isNumericalQ && examMode !== 'JEE Advanced'
                      ? '-1 Negative'
                      : isNumericalQ
                      ? '0 Negative (JEE Adv Numerical)'
                      : isMultipleQ
                      ? '-2 Negative'
                      : '-1 Negative'}
                  </span>
                  {isMultipleQ && (
                    <span className="text-[#2563EB] dark:text-[#60A5FA] bg-[#2563EB]/10 border border-[#2563EB]/25 px-2.5 py-1 rounded-md">
                      +3 / +2 / +1 Partial Marks
                    </span>
                  )}
                </div>
              </div>

              {/* JEE Advanced Paragraph / Comprehension Context Box */}
              {currentQuestion.paragraphContext && (
                <div className="p-4 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 text-xs sm:text-sm text-[#0F172A] dark:text-[#E2E8F0] space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    JEE Advanced Paragraph / Comprehension Stem
                  </div>
                  <MathRichText content={currentQuestion.paragraphContext} />
                </div>
              )}

              {/* JEE Advanced Matrix-Match List-I / List-II Table */}
              {currentQuestion.matrixListI && currentQuestion.matrixListII && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-2">
                      List-I
                    </div>
                    <div className="space-y-1.5">
                      {currentQuestion.matrixListI.map((item, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08]"
                        >
                          <MathRichText content={item} inline />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-2">
                      List-II
                    </div>
                    <div className="space-y-1.5">
                      {currentQuestion.matrixListII.map((item, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08]"
                        >
                          <MathRichText content={item} inline />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Rendered Question Stem */}
              <div className="text-base sm:text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed">
                <MathRichText
                  content={
                    examLanguage === 'Hindi' && currentQuestion.stemHindi
                      ? currentQuestion.stemHindi
                      : currentQuestion.stem
                  }
                />
              </div>

              {/* Options or Section B Numerical Keypad */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {!isNumericalQ && (
                  <div className="lg:col-span-12 space-y-3">
                    {isMultipleQ && (
                      <div className="text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-[#2563EB]/10 border border-[#2563EB]/25 px-3 py-1.5 rounded-lg inline-block">
                        JEE Advanced One-or-More-Than-One Correct: Select all correct options (+4 full, +1 partial per correct option)
                      </div>
                    )}
                    {currentQuestion.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isChecked = isMultipleQ
                        ? (currentResponse.selectedOptions || []).includes(idx)
                        : currentResponse.selectedOption === idx;

                      return (
                        <div
                          key={letter}
                          role={isMultipleQ ? 'checkbox' : 'radio'}
                          aria-checked={isChecked}
                          tabIndex={0}
                          onClick={() =>
                            isMultipleQ
                              ? handleToggleMultipleOption(idx)
                              : handleSelectSingleOption(idx)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (isMultipleQ) handleToggleMultipleOption(idx);
                              else handleSelectSingleOption(idx);
                            }
                          }}
                          className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-colors cursor-pointer max-w-2xl ${
                            isChecked
                              ? 'border-[#2563EB]/60 bg-[#2563EB]/10 text-[#0F172A] dark:text-[#F8FAFC]'
                              : 'border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B]/60 hover:bg-[#F8FAFF] dark:hover:bg-[#283548]'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 ${
                              isMultipleQ ? 'rounded-md' : 'rounded-full'
                            } border flex items-center justify-center shrink-0 ${
                              isChecked
                                ? 'border-[#2563EB] bg-[#2563EB] text-white'
                                : 'border-[#94A3B8] dark:border-[#475569]'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          <span className="text-sm tabular-nums font-bold text-[#334155] dark:text-[#CBD5E1]">
                            ({letter})
                          </span>
                          <div className="text-sm sm:text-base font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                            <MathRichText content={opt} inline />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isNumericalQ && (
                  <div className="lg:col-span-6 bg-[#F8FAFF] dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] p-5 max-w-sm">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-2">
                      Numerical Value Response (
                      {examMode === 'JEE Advanced' ? '0 Negative Marking' : '+4 / -1 NTA Marking'})
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="Numerical value response"
                      value={currentResponse.numericalValue || ''}
                      onChange={(e) => handleNumericalDirectChange(e.target.value)}
                      placeholder="Enter numerical value..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] dark:border-white/[0.15] focus:border-[#2563EB] focus:outline-none bg-white dark:bg-[#111827] tabular-nums text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-3"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-'].map(
                        (digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => handleNumericalKeyPress(digit)}
                            className="py-2.5 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#EEF2FF] dark:hover:bg-[#283548] tabular-nums text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer transition-colors"
                          >
                            {digit}
                          </button>
                        )
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleNumericalKeyPress('BACKSPACE')}
                        className="py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-semibold cursor-pointer hover:bg-amber-500/20 transition-colors"
                      >
                        Backspace
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumericalKeyPress('CLEAR')}
                        className="py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer hover:bg-rose-500/20 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 3 Cols: Candidate Info & 5-State NTA Palette */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {candidateName || 'Candidate'}
              </div>
              <div className="text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                {examMode} • {questionsList.length} Questions
              </div>
            </div>
          </div>

          {/* 5-State Legend (NTA Palette Preserved) */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] p-4 space-y-2 text-xs font-medium text-[#334155] dark:text-[#CBD5E1]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-slate-200 dark:bg-[#1E293B] border border-slate-300 dark:border-white/[0.15] inline-block" />
                Not Visited
              </span>
              <span className="tabular-nums font-bold">{livePaletteCounts.not_visited}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#DC2626] inline-block" />
                Not Answered
              </span>
              <span className="tabular-nums font-bold">{livePaletteCounts.not_answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#16A34A] inline-block" />
                Answered
              </span>
              <span className="tabular-nums font-bold">{livePaletteCounts.answered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#7C3AED] inline-block" />
                Marked for Review
              </span>
              <span className="tabular-nums font-bold">{livePaletteCounts.marked}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#7C3AED] text-white inline-flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                Answered &amp; Marked
              </span>
              <span className="tabular-nums font-bold">{livePaletteCounts.answered_marked}</span>
            </div>
          </div>

          {/* Question Palette Grid */}
          <div className="flex-1 bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] p-4 max-h-[380px] overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-3">
              {activeSubject} • {examMode === 'JEE Main' ? activeSection : 'Paper 1'} Palette
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {subjectQuestions.map((q) => {
                const st = responses[q.id]?.status || 'not_visited';
                const isCurrent = currentQNumber === q.number;

                let btnStyle =
                  'bg-slate-200 dark:bg-[#1E293B] text-slate-800 dark:text-[#E2E8F0] border-slate-300 dark:border-white/[0.1]';
                if (st === 'answered') {
                  btnStyle = 'bg-[#16A34A] text-white border-[#15803D]';
                } else if (st === 'not_answered') {
                  btnStyle = 'bg-[#DC2626] text-white border-[#B91C1C]';
                } else if (st === 'marked' || st === 'answered_marked') {
                  btnStyle = 'bg-[#7C3AED] text-white border-[#6D28D9]';
                }

                if (isCurrent) {
                  btnStyle =
                    'bg-[#2563EB]/15 text-[#2563EB] dark:text-blue-200 border-[#2563EB] ring-2 ring-[#2563EB]/30';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleJumpToQuestion(q.number)}
                    className={`relative h-9 rounded-lg tabular-nums font-bold text-xs border transition-colors flex items-center justify-center cursor-pointer ${btnStyle}`}
                  >
                    {q.number}
                    {st === 'answered_marked' && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#00A86B] text-white flex items-center justify-center">
                        <Check className="w-2 h-2 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <footer className="bg-white dark:bg-[#111827] border-t border-[#E2E8F0] dark:border-white/[0.08] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleMarkForReviewAndNext}
            className="px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-white/[0.1] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFF] dark:hover:bg-[#283548] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer transition-colors"
          >
            Mark for Review &amp; Next
          </button>
          <button
            type="button"
            onClick={handleClearResponse}
            className="px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-white/[0.1] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFF] dark:hover:bg-[#283548] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer transition-colors"
          >
            Clear Response
          </button>
        </div>

        <div className="flex items-center gap-3">
          {submitCbtError && (
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {submitCbtError}
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveAndNext}
            className="px-5 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors"
          >
            Save &amp; Next
          </button>
          <button
            type="button"
            disabled={submittingCbt}
            onClick={handleTriggerSubmit}
            className="px-5 py-2 rounded-lg bg-[#00A86B] hover:bg-[#059669] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            {submittingCbt ? 'Grading on Server...' : 'Submit Exam'}
          </button>
        </div>
      </footer>

      {/* Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full p-6 border border-[#E2E8F0] dark:border-white/[0.08] space-y-4">
            <h3 className="text-lg font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
              {examMode} Official Marking &amp; Evaluation Rules
            </h3>
            <ul className="space-y-2 text-xs text-[#475569] dark:text-[#94A3B8] list-disc pl-5 leading-relaxed">
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">JEE Main Section A (MCQs):</strong> +4 for correct, -1 negative marking.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">JEE Main Section B (5 Compulsory Numericals per subject):</strong> +4 for correct, <strong className="text-[#0F172A] dark:text-[#F8FAFC]">-1 negative marking</strong> per official NTA JEE Main 2027 Paper 1 rules.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">JEE Advanced Multiple-Choice:</strong> +4 if all correct options chosen, +1 partial mark per correct option if no wrong option is chosen, -2 if any wrong option is chosen.
              </li>
              <li>
                Questions Marked for Review WITH a saved answer are evaluated for marks per NTA rules.
              </li>
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer"
              >
                Resume Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Submit Question-by-Question Time-Spent & Marks Accuracy Report Modal */}
      {submittedSummary && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-[#0B1224] via-[#111827] to-[#1E1B4B] border-b border-white/[0.08] text-white flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">
                  {examMode} Question-by-Question Report
                </span>
                <h3 className="text-2xl font-bold tabular-nums text-white mt-0.5">
                  Score: {submittedSummary.totalScore} / {submittedSummary.maxScore}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums font-semibold">
                <span className="px-3 py-1.5 rounded-lg bg-[#00A86B]/15 border border-[#00A86B]/30 text-emerald-300">
                  Correct: {submittedSummary.correctCount}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
                  Incorrect: {submittedSummary.incorrectCount}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.12] text-slate-200">
                  Accuracy: {submittedSummary.accuracyPct}%
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {questionsList.map((q) => {
                const detail = submittedSummary.questionDetails?.find(
                  (d) => d.questionId === q.id
                );
                const isPartial =
                  detail && detail.isAttempted && !detail.isCorrect && detail.marksAwarded > 0;
                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/70 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs tabular-nums font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                        Q{q.number} • {q.subject} ({q.chapter}) • {detail?.timeSpentSec || 0}s
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums font-semibold border ${
                          detail?.isCorrect
                            ? 'bg-[#00A86B]/10 border-[#00A86B]/25 text-[#00A86B]'
                            : isPartial
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                            : detail?.isAttempted
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                            : 'bg-[#F1F5F9] dark:bg-[#1E293B] border-[#E2E8F0] dark:border-white/[0.08] text-[#64748B] dark:text-[#94A3B8]'
                        }`}
                      >
                        {detail && detail.isAttempted
                          ? `${detail.marksAwarded >= 0 ? `+${detail.marksAwarded}` : detail.marksAwarded} (${
                              detail.isCorrect ? 'CORRECT' : isPartial ? 'PARTIAL' : 'INCORRECT'
                            })`
                          : '0 Unattempted'}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      <MathRichText content={q.stem} />
                    </div>

                    <div className="text-xs text-[#334155] dark:text-[#CBD5E1] bg-white dark:bg-[#111827] p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08]">
                      <strong className="text-[#0F172A] dark:text-[#F8FAFC] block mb-1">
                        Server-Verified Step-by-Step Solution:
                      </strong>
                      <MathRichText
                        content={serverSolutions[q.id]?.explanation || q.explanation}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 bg-[#F8FAFF] dark:bg-[#0D1322] border-t border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Incorrect questions have been automatically logged to your Mistakes Notebook.
              </span>
              <button
                type="button"
                onClick={() => onSubmitMock(submittedSummary, focusEvents, questionsList, responses)}
                className="px-5 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors"
              >
                Finish &amp; Go to Progress Dashboard →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
