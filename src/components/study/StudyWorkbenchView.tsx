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
        <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider">
                15-Min Sprints
              </span>
              <span className="text-[#475569] dark:text-[#94A3B8]">·</span>
              <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                {activeChapter} ({completedShardIds.length}/{shards.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#2563EB] dark:text-[#60A5FA] text-xs font-semibold tabular-nums inline-flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {clueCoins} Coins
              </span>
              <button
                type="button"
                onClick={() => setSocraticOpen((o) => !o)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 ${
                  socraticOpen
                    ? 'btn-brand'
                    : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#E2E8F0] dark:hover:bg-[#283548]'
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
                      ? 'border-[#2563EB]/40 bg-[#EFF6FF] dark:bg-[#2563EB]/15'
                      : isDone
                      ? 'border-[#00A86B]/30 bg-[#F8FAFF] dark:bg-[#1E293B]'
                      : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {shard.title}
                    </div>
                    <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] truncate mt-0.5">
                      15m sprint · 3 checks
                    </div>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-[#00A86B] shrink-0" />
                  ) : (
                    <Play className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {activeShard && (
            <div className="p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {activeShard.title} · {activeShard.durationMinutes}m
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
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
                      className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2 text-xs"
                    >
                      <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
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
                                ? 'border-[#00A86B]/40 bg-[#00A86B]/10 text-[#00A86B] font-semibold'
                                : isAnswered && chosen === oIdx && !isRight
                                ? 'border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : 'border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                            }`}
                          >
                            <MathRichText content={opt} />
                          </button>
                        ))}
                      </div>
                      {isAnswered && (
                        <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] pt-1 border-t border-[#E2E8F0] dark:border-white/[0.08]">
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
                  className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors duration-150"
                >
                  Complete Sprint (+30 XP · +2 Coins)
                </button>
              </div>
            </div>
          )}

          {socraticOpen && (
            <div className="p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
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
                          ? 'bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA] border border-[#2563EB]/35'
                          : 'bg-[#FFFFFF] dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#E2E8F0] dark:hover:bg-[#283548]'
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
                  <span className="font-medium text-slate-500">Depth:</span>
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
                          ? 'btn-brand'
                          : 'bg-white dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-white/[0.08]'
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
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#94A3B8] font-medium cursor-pointer"
                  >
                    Mode: {tutorContextMode === 'strict_material' ? 'Strict Material' : 'Open JEE'}
                  </button>
                  <button
                    type="button"
                    disabled={socraticLoading}
                    onClick={() => handleRequestSocraticHint('full', 'unit_check')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-[#00A86B] font-medium cursor-pointer"
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
                  className="flex-1 px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                />
                <button
                  type="button"
                  onClick={() => handleRequestSocraticHint(1)}
                  disabled={socraticLoading}
                  className="btn-brand px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {socraticLoading ? 'Thinking...' : 'Get Hint 1'}
                </button>
              </div>

              {upstreamError && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-[#111827] border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-semibold">[{upstreamError.errorCode}]</span>{' '}
                      {upstreamError.message}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequestSocraticHint(hintStep)}
                    className="px-3 py-1.5 rounded-lg btn-brand font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              )}

              {socraticOutput && !upstreamError && (
                <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-xs leading-relaxed space-y-2.5 text-[#0F172A] dark:text-[#F8FAFC]">
                  <MathRichText content={socraticOutput} />
                  {socraticCitations.length > 0 && (
                    <div className="pt-2 border-t border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase">
                        Citations
                      </span>
                      {socraticCitations.map((c, ci) => (
                        <span
                          key={ci}
                          title={c.excerpt}
                          className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] text-[10px] font-medium"
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
