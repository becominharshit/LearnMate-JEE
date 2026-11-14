import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Coins,
  Flame,
  Lightbulb,
  Play,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  StudyWorkspaceView,
  MaterialItem,
  CreationItem,
} from '../HomeAndStudyViews';
import { MaterialStudyBundle, NotePageData } from '../../data/jeeInitialContent';
import { CBTQuestion, generateChapterShardZ } from '../../utils/jeeEngine';
import { MathRichText } from '../MathRichText';
import { apiFetchWithAuth, StructuredUpstreamError } from '../../services/workspaceService';

export interface StudyWorkbenchViewProps {
  initialSubTab:
    | 'Syllabus'
    | 'Chapter Notes'
    | 'My Materials'
    | 'AI Tutor'
    | 'Create'
    | 'Resources';
  selectedMaterial: MaterialItem | null;
  activeBundle: MaterialStudyBundle | null;
  materials: MaterialItem[];
  creations: CreationItem[];
  onSelectMaterial: (mat: MaterialItem) => void;
  onDeleteMaterial: (matId: string) => void;
  onUpdateMaterialPage: (
    materialId: string,
    pageNumber: number,
    updatedPage: NotePageData
  ) => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onSaveCreation: (creation: Omit<CreationItem, 'id'>) => Promise<void>;
  onAddQuickSheetMaterial: (
    title: string,
    subject: 'Physics' | 'Chemistry' | 'Mathematics',
    summary: string
  ) => Promise<void>;
  onOpenVoiceTutor: () => void;
  onLaunchInstantPractice: (
    mode: 'chapter-quiz' | 'adaptive-drill' | 'paper-solver',
    title: string,
    chapterName: string,
    customQuestions?: CBTQuestion[]
  ) => void;
  onEarnXp?: (xp: number, reason?: string) => void;
}

export const StudyWorkbenchView: React.FC<StudyWorkbenchViewProps> = (props) => {
  const activeChapter = props.selectedMaterial?.chapter || 'Rotational Motion & Rigid Body Dynamics';
  const activeSubject = props.selectedMaterial?.subject || 'Physics';

  // 15-Minute ShardZ Micro-Tasks state
  const shards = useMemo(
    () => generateChapterShardZ(activeChapter, activeSubject),
    [activeChapter, activeSubject]
  );
  const [activeShardIdx, setActiveShardIdx] = useState<number | null>(null);
  const [shardAnswers, setShardAnswers] = useState<Record<string, number>>({});
  const [completedShardIds, setCompletedShardIds] = useState<string[]>([]);

  // Socratic "Clue Coins" 3-Step Progressive Hint state
  const [socraticOpen, setSocraticOpen] = useState<boolean>(false);
  const [socraticPrompt, setSocraticPrompt] = useState<string>('');
  const [clueCoins, setClueCoins] = useState<number>(6);
  const [hintStep, setHintStep] = useState<1 | 2 | 3 | 'full'>(1);
  const [tutorDifficulty, setTutorDifficulty] = useState<'board' | 'jee_main' | 'jee_advanced'>('jee_main');
  const [tutorContextMode, setTutorContextMode] = useState<'strict_material' | 'open_jee'>('strict_material');
  const [socraticOutput, setSocraticOutput] = useState<string>('');
  const [socraticCitations, setSocraticCitations] = useState<{ pageNumber: number; excerpt: string }[]>([]);
  const [socraticLoading, setSocraticLoading] = useState<boolean>(false);
  const [upstreamError, setUpstreamError] = useState<StructuredUpstreamError | null>(null);

  const activeShard = activeShardIdx !== null ? shards[activeShardIdx] : null;

  const handleRequestSocraticHint = async (
    targetStep: 1 | 2 | 3 | 'full',
    actionKind: 'socratic' | 'unit_check' = 'socratic'
  ) => {
    const queryText =
      actionKind === 'unit_check'
        ? `Perform a dimensional consistency and SI units check on formulas/problem: ${socraticPrompt.trim() || activeChapter}.`
        : socraticPrompt.trim() ||
          `Help me derive and solve a JEE problem on ${activeChapter} (${activeSubject}).`;
    setHintStep(targetStep);
    setSocraticLoading(true);
    setUpstreamError(null);

    const res = await apiFetchWithAuth<{
      text: string;
      citations?: { pageNumber: number; excerpt: string }[];
    }>('/api/ai/tutor', {
      prompt: queryText,
      materialId: props.selectedMaterial?.id,
      context: props.selectedMaterial?.contentSummary || activeChapter,
      contextMode: tutorContextMode,
      difficulty: tutorDifficulty,
      socraticHintStep: targetStep,
      teacherPersona: 'hinglish_faculty',
    });

    setSocraticLoading(false);
    if (!res.ok) {
      setUpstreamError(res.error);
      return;
    }
    if (targetStep !== 'full' && clueCoins > 0) {
      setClueCoins((c) => Math.max(0, c - 1));
    }
    setSocraticOutput(res.data.text || '');
    setSocraticCitations(Array.isArray(res.data.citations) ? res.data.citations : []);
  };

  return (
    <div className="space-y-4">
      <div className="w-full px-6 lg:px-10 xl:px-12 pt-4">
        <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#121214] border border-[#E7E2DA] dark:border-white/[0.08] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-[#57534E] dark:text-[#A1A1AA] uppercase">
                15-Min Sprints
              </span>
              <span className="text-[#57534E] dark:text-[#A1A1AA]">·</span>
              <span className="font-semibold text-[#1C1917] dark:text-[#F5F0E6]">
                {activeChapter} ({completedShardIds.length}/{shards.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#F3EFEA] dark:bg-[#1A1A1D] border border-[#E7E2DA] dark:border-white/[0.08] text-[#D4653B] dark:text-[#E07348] text-xs font-mono font-semibold tabular-nums inline-flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {clueCoins} Coins
              </span>
              <button
                type="button"
                onClick={() => setSocraticOpen((o) => !o)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 ${
                  socraticOpen
                    ? 'btn-terracotta'
                    : 'bg-[#F3EFEA] dark:bg-[#1A1A1D] text-[#1C1917] dark:text-[#F5F0E6] border border-[#E7E2DA] dark:border-white/[0.08] hover:bg-[#EAE4DC] dark:hover:bg-[#222226]'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                3-Step Hints
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {shards.map((shard, idx) => {
              const isDone = completedShardIds.includes(shard.id);
              const isOpen = activeShardIdx === idx;
              return (
                <button
                  key={shard.id}
                  type="button"
                  onClick={() => setActiveShardIdx(isOpen ? null : idx)}
                  className={`p-3 rounded-xl border text-left transition-colors duration-150 cursor-pointer flex items-center justify-between gap-2 ${
                    isOpen
                      ? 'border-zinc-900 dark:border-white/30 bg-zinc-100 dark:bg-[#1f1f23]'
                      : isDone
                      ? 'border-emerald-500/30 bg-zinc-50 dark:bg-[#18181b]'
                      : 'border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {shard.title}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      15m sprint · 3 checks
                    </div>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Play className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {activeShard && (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {activeShard.title} · {activeShard.durationMinutes}m
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {activeShard.focusConcept}
                  </p>
                </div>
                <div className="text-xs">
                  <MathRichText content={activeShard.formulaHook} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {activeShard.masteryQuestions.map((mq, qIdx) => {
                  const chosen = shardAnswers[mq.id];
                  const isAnswered = chosen !== undefined;
                  const isRight = chosen === mq.correctIndex;
                  return (
                    <div
                      key={mq.id}
                      className="p-3 rounded-xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] space-y-2 text-xs"
                    >
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        Q{qIdx + 1}. <MathRichText content={mq.prompt} />
                      </div>
                      <div className="space-y-1">
                        {mq.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() =>
                              setShardAnswers((prev) => ({ ...prev, [mq.id]: oIdx }))
                            }
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors duration-150 ${
                              isAnswered && oIdx === mq.correctIndex
                                ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                                : isAnswered && chosen === oIdx && !isRight
                                ? 'border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : 'border-zinc-200 dark:border-white/[0.07] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#1f1f23]'
                            }`}
                          >
                            <MathRichText content={opt} />
                          </button>
                        ))}
                      </div>
                      {isAnswered && (
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-white/[0.07]">
                          <MathRichText content={mq.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!completedShardIds.includes(activeShard.id)) {
                      setCompletedShardIds((prev) => [...prev, activeShard.id]);
                      setClueCoins((c) => c + 2);
                      if (props.onEarnXp) props.onEarnXp(30);
                    }
                    setActiveShardIdx(null);
                  }}
                  className="px-4 py-2 rounded-lg btn-terracotta text-xs font-semibold cursor-pointer transition-colors duration-150"
                >
                  Complete Sprint (+30 XP · +2 Coins)
                </button>
              </div>
            </div>
          )}

          {socraticOpen && (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span>Progressive Hint Coach</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([1, 2, 3, 'full'] as const).map((st) => (
                    <button
                      key={String(st)}
                      type="button"
                      onClick={() => handleRequestSocraticHint(st)}
                      disabled={socraticLoading}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors duration-150 ${
                        hintStep === st
                          ? 'bg-[#D4653B]/10 dark:bg-[#D4653B]/[0.14] text-[#D4653B] dark:text-[#E07348] border border-[#D4653B]/35'
                          : 'bg-[#FFFFFF] dark:bg-[#121214] text-[#57534E] dark:text-[#A1A1AA] border border-[#E7E2DA] dark:border-white/[0.08] hover:bg-[#EAE4DC] dark:hover:bg-[#222226]'
                      }`}
                    >
                      {st === 1
                        ? 'Hint 1: Law'
                        : st === 2
                        ? 'Hint 2: Setup'
                        : st === 3
                        ? 'Hint 3: Step'
                        : 'Full Solution'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-zinc-500">Depth:</span>
                  {(
                    [
                      { id: 'board', label: 'Board' },
                      { id: 'jee_main', label: 'JEE Main' },
                      { id: 'jee_advanced', label: 'JEE Advanced' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setTutorDifficulty(d.id)}
                      className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors duration-150 ${
                        tutorDifficulty === d.id
                          ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                          : 'bg-white dark:bg-[#111113] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.07]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setTutorContextMode((m) =>
                        m === 'strict_material' ? 'open_jee' : 'strict_material'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
                  >
                    Mode: {tutorContextMode === 'strict_material' ? 'Strict Material' : 'Open JEE'}
                  </button>
                  <button
                    type="button"
                    disabled={socraticLoading}
                    onClick={() => handleRequestSocraticHint('full', 'unit_check')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] text-emerald-600 dark:text-emerald-400 font-medium cursor-pointer"
                  >
                    Unit Check
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={socraticPrompt}
                  onChange={(e) => setSocraticPrompt(e.target.value)}
                  placeholder={`Ask a JEE doubt on ${activeChapter}...`}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-[#111113] text-xs text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => handleRequestSocraticHint(1)}
                  disabled={socraticLoading}
                  className="btn-terracotta px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {socraticLoading ? 'Thinking...' : 'Get Hint 1'}
                </button>
              </div>

              {upstreamError && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-[#111113] border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-mono font-semibold">[{upstreamError.errorCode}]</span>{' '}
                      {upstreamError.message}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequestSocraticHint(hintStep)}
                    className="px-3 py-1.5 rounded-lg btn-terracotta font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              )}

              {socraticOutput && !upstreamError && (
                <div className="p-4 rounded-xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] text-xs leading-relaxed space-y-2.5 text-zinc-700 dark:text-zinc-200">
                  <MathRichText content={socraticOutput} />
                  {socraticCitations.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-white/[0.07] flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        Citations
                      </span>
                      {socraticCitations.map((c, ci) => (
                        <span
                          key={ci}
                          title={c.excerpt}
                          className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300 text-[10px] font-medium"
                        >
                          Page {c.pageNumber}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <StudyWorkspaceView {...props} />
    </div>
  );
};
