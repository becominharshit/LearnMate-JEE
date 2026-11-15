import React, { useState, useMemo } from 'react';
import { Play, Sliders } from 'lucide-react';
import type { ExamTrack } from '../../utils/jeeEngine';
import { JEE_SYLLABUS_DATA } from '../../data/jeeInitialContent';
import { getDaysToJeeMain2027Session1 } from '../../config/examSpecs';
import type { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';

interface ProgressAndRankViewProps {
  lastMockScore: number | null;
  materialsCount: number;
  mistakesCount: number;
  mistakesNotebook?: MistakeNotebookEntry[];
  sm2CardsCount?: number;
  completedChapterIds?: string[];
  onStartCBTMock: (mode?: ExamTrack) => void;
  onOpenCustomTestGenerator?: () => void;
  onPracticeWeakTopic: (topic: string) => void;
}

export const ProgressAndRankView: React.FC<ProgressAndRankViewProps> = ({
  lastMockScore,
  materialsCount,
  mistakesCount,
  mistakesNotebook = [],
  sm2CardsCount = 0,
  completedChapterIds = [],
  onStartCBTMock,
  onOpenCustomTestGenerator,
  onPracticeWeakTopic,
}) => {
  const [heatmapSubject, setHeatmapSubject] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');

  const filteredSyllabus = useMemo(
    () =>
      JEE_SYLLABUS_DATA.filter(
        (ch) => heatmapSubject === 'All' || ch.subject === heatmapSubject
      ),
    [heatmapSubject]
  );

  const masteryStats = useMemo(() => {
    const totalChapters = Math.max(1, JEE_SYLLABUS_DATA.length);
    const syllabusCoveragePct = Number(((completedChapterIds.length / totalChapters) * 100).toFixed(1));
    const recheckedPassed = mistakesNotebook.filter((m) => m.recheckPassed).length;
    const recheckResolutionPct =
      mistakesNotebook.length > 0
        ? Math.round((recheckedPassed / mistakesNotebook.length) * 100)
        : 100;
    const netNegativeBleed = Math.max(0, mistakesCount - recheckedPassed);
    const weightedMasteryPct = Math.min(
      100,
      Math.round(
        syllabusCoveragePct * 0.45 +
          (lastMockScore !== null ? Math.max(0, Math.min(100, (lastMockScore / 300) * 100)) * 0.35 : 0) +
          (mistakesNotebook.length > 0 ? recheckResolutionPct * 0.2 : 0)
      )
    );
    return {
      syllabusCoveragePct,
      recheckedPassed,
      recheckResolutionPct,
      netNegativeBleed,
      weightedMasteryPct,
      daysToExam: getDaysToJeeMain2027Session1(),
    };
  }, [completedChapterIds.length, lastMockScore, mistakesCount, mistakesNotebook]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold tracking-[-0.02em] text-2xl text-[#0F172A] dark:text-[#F8FAFC]">
            Progress
          </h1>
          <p className="text-xs tabular-nums text-[#475569] dark:text-[#94A3B8] mt-0.5">
            JEE Main 2027 · {masteryStats.daysToExam}d left · {masteryStats.weightedMasteryPct}% mastery
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {onOpenCustomTestGenerator && (
            <button
              type="button"
              onClick={onOpenCustomTestGenerator}
              className="px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-slate-800 dark:text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
            >
              <Sliders className="w-4 h-4" />
              Build Custom Test
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Main')}
            className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
          >
            <Play className="w-4 h-4" />
            75-Q CBT Mock
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 p-5 rounded-2xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Mastery &amp; Error Bleed
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
              Chapters, SM-2 recall, and mistake rechecks
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08]">
              <span className="font-medium text-slate-600 dark:text-slate-300">Syllabus ({completedChapterIds.length}/{JEE_SYLLABUS_DATA.length})</span>
              <span className="font-semibold tabular-nums text-[#00A86B] dark:text-emerald-400">{masteryStats.syllabusCoveragePct}% · {sm2CardsCount} cards</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08]">
              <span className="font-medium text-slate-600 dark:text-slate-300">Rechecks Passed</span>
              <span className="font-semibold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                {masteryStats.recheckedPassed}/{mistakesNotebook.length} ({masteryStats.recheckResolutionPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08]">
              <span className="font-medium text-slate-600 dark:text-slate-300">Negative Bleed · {materialsCount} sets</span>
              <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {mistakesCount} logged · −{masteryStats.netNegativeBleed}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Advanced')}
            className="w-full py-2.5 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors duration-150"
          >
            JEE Advanced Paper 1 (+4/−2)
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
              58-Chapter Syllabus Heatmap
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              Select a chapter to start a targeted drill
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setHeatmapSubject(subj)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ${
                  heatmapSubject === subj
                    ? 'btn-brand font-semibold'
                    : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {filteredSyllabus.map((ch) => {
            const isDone = completedChapterIds.includes(ch.id);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onPracticeWeakTopic(ch.chapter)}
                className={`p-3 rounded-xl border text-left transition-colors duration-150 cursor-pointer flex flex-col justify-between gap-2 ${
                  isDone
                    ? 'border-emerald-500/40 bg-[#F8FAFF] dark:bg-[#1E293B]'
                    : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-slate-700/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 text-[10px] font-medium uppercase text-[#475569] dark:text-[#94A3B8]">
                    <span>{ch.subject} · {ch.classLevel}</span>
                    <span
                      className={
                        isDone
                          ? 'text-[#00A86B] dark:text-emerald-400 tabular-nums'
                          : ch.weightageTier === 'High'
                          ? 'text-amber-600 dark:text-amber-400 tabular-nums'
                          : 'text-[#475569] dark:text-[#94A3B8] tabular-nums'
                      }
                    >
                      {ch.weightageTier} ({ch.expectedQs})
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mt-1 line-clamp-1">
                    {ch.chapter}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-[#475569] dark:text-[#94A3B8]">{ch.examScope}</span>
                  <span className="text-[#2563EB] dark:text-blue-400 font-semibold">Drill →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
