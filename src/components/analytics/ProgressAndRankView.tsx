import React, { useState, useMemo } from 'react';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Flame,
  Layers,
  Play,
  Sliders,
  Target,
  TrendingUp,
} from 'lucide-react';
import { predictNtaPercentileAndAir, ExamTrack } from '../../utils/jeeEngine';
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
  const [shiftDifficulty, setShiftDifficulty] = useState<'Easy' | 'Moderate' | 'Tough'>('Moderate');
  const [simulatedScore, setSimulatedScore] = useState<number>(lastMockScore ?? 185);
  const [heatmapSubject, setHeatmapSubject] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');

  const activeScore = lastMockScore !== null ? lastMockScore : simulatedScore;
  const prediction = useMemo(
    () =>
      predictNtaPercentileAndAir({
        score: activeScore,
        maxScore: 300,
        shiftDifficulty,
      }),
    [activeScore, shiftDifficulty]
  );

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
          <h1 className="font-semibold tracking-[-0.02em] text-2xl text-zinc-900 dark:text-zinc-50">
            Progress &amp; Rank
          </h1>
          <p className="text-xs font-mono tabular-nums text-zinc-500 mt-0.5">
            JEE Main 2027 · {masteryStats.daysToExam}d left · {masteryStats.weightedMasteryPct}% mastery
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {onOpenCustomTestGenerator && (
            <button
              type="button"
              onClick={onOpenCustomTestGenerator}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-[#111113] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-zinc-800 dark:text-zinc-200 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
            >
              <Sliders className="w-4 h-4" />
              Build Custom Test
            </button>
          )}
          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Main')}
            className="px-4 py-2 rounded-lg btn-terracotta text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
          >
            <Play className="w-4 h-4" />
            75-Q CBT Mock
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Percentile &amp; AIR Predictor
            </span>
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-[#18181b] p-1 rounded-lg">
              {(['Easy', 'Moderate', 'Tough'] as const).map((shift) => (
                <button
                  key={shift}
                  type="button"
                  onClick={() => setShiftDifficulty(shift)}
                  className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors duration-150 ${
                    shiftDifficulty === shift
                      ? 'bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500'
                  }`}
                >
                  {shift} Shift
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07]">
              <div className="text-[11px] font-medium text-zinc-500">NTA Percentile</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
                {prediction.percentile}%ile
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {shiftDifficulty} normalization
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07]">
              <div className="text-[11px] font-medium text-zinc-500">Predicted AIR</div>
              <div className="text-xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {prediction.predictedAirMin.toLocaleString()}–{prediction.predictedAirMax.toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                14.2L candidates
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07]">
              <div className="text-[11px] font-medium text-zinc-500">Score</div>
              <div className="text-2xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                {activeScore} / 300
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {lastMockScore !== null ? 'Latest CBT' : 'What-If Slider'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-zinc-600 dark:text-zinc-300">Simulate Target Score</span>
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{activeScore} / 300</span>
            </div>
            <input
              type="range"
              min={0}
              max={300}
              step={5}
              value={activeScore}
              onChange={(e) => setSimulatedScore(Number(e.target.value))}
              className="w-full accent-[#D4653B] cursor-pointer"
            />
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Projected Tier: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{prediction.targetInstituteTier}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Mastery &amp; Error Bleed
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Chapters, SM-2 recall, and mistake rechecks
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07]">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">Syllabus ({completedChapterIds.length}/{JEE_SYLLABUS_DATA.length})</span>
              <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{masteryStats.syllabusCoveragePct}% · {sm2CardsCount} cards</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07]">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">Rechecks Passed</span>
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {masteryStats.recheckedPassed}/{mistakesNotebook.length} ({masteryStats.recheckResolutionPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07]">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">Negative Bleed · {materialsCount} sets</span>
              <span className="font-mono font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {mistakesCount} logged · −{masteryStats.netNegativeBleed}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartCBTMock('JEE Advanced')}
            className="w-full py-2.5 rounded-lg btn-terracotta text-xs font-semibold cursor-pointer transition-colors duration-150"
          >
            JEE Advanced Paper 1 (+4/−2)
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
              58-Chapter Syllabus Heatmap
            </h2>
            <p className="text-xs text-zinc-500">
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
                    ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                    : 'bg-zinc-100 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-[#1f1f23]'
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
                    ? 'border-emerald-500/40 bg-zinc-50 dark:bg-[#18181b]'
                    : 'border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono uppercase text-zinc-500">
                    <span>{ch.subject} · {ch.classLevel}</span>
                    <span
                      className={
                        isDone
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ch.weightageTier === 'High'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-zinc-500'
                      }
                    >
                      {ch.weightageTier} ({ch.expectedQs})
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-1 line-clamp-1">
                    {ch.chapter}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-zinc-500">{ch.examScope}</span>
                  <span className="text-zinc-900 dark:text-zinc-200">Drill →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
