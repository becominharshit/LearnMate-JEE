import React, { useState, useMemo } from 'react';
import {
  X,
  Sliders,
  CheckCircle2,
  Play,
  Layers,
  Clock,
  Hash,
  AlertCircle,
} from 'lucide-react';
import {
  CBTQuestion,
  buildBalancedCustomTestQuestions,
  filterCustomTestQuestions,
} from '../../utils/jeeEngine';
import {
  JEE_SYLLABUS_DATA,
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
} from '../../data/jeeInitialContent';
import { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';

export interface CustomTestConfig {
  title: string;
  examType: 'JEE Main' | 'JEE Advanced';
  questions: CBTQuestion[];
  durationMinutes: number;
}

interface CustomTestGeneratorModalProps {
  isOpen: boolean;
  mistakesNotebook?: MistakeNotebookEntry[];
  onClose: () => void;
  onLaunchCustomCBT: (
    questionsOrConfig: CBTQuestion[] | CustomTestConfig,
    durationMinutes?: number,
    paperTitle?: string
  ) => void;
}

export const CustomTestGeneratorModal: React.FC<CustomTestGeneratorModalProps> = ({
  isOpen,
  mistakesNotebook = [],
  onClose,
  onLaunchCustomCBT,
}) => {
  const [selectedSubjects, setSelectedSubjects] = useState<
    ('Physics' | 'Chemistry' | 'Mathematics')[]
  >(['Physics', 'Chemistry', 'Mathematics']);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<
    'All' | 'Easy' | 'Moderate' | 'Tough'
  >('All');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<
    'All' | 'MCQ' | 'Numerical' | 'Multi-Correct' | 'Previously Incorrect Only'
  >('All');
  const [questionCount, setQuestionCount] = useState<number>(30);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [subjectTab, setSubjectTab] = useState<'Physics' | 'Chemistry' | 'Mathematics'>('Physics');

  const availableChapters = useMemo(() => {
    return JEE_SYLLABUS_DATA.filter((ch) => ch.subject === subjectTab);
  }, [subjectTab]);

  const matchedPool = useMemo(() => {
    return filterCustomTestQuestions({
      basePool: [...CBT_MOCK_QUESTIONS, ...JEE_ADVANCED_PAPER_QUESTIONS],
      mistakesPool: mistakesNotebook.map((m) => m.question),
      selectedSubjects,
      selectedChapters,
      difficultyFilter,
      questionTypeFilter,
    });
  }, [
    mistakesNotebook,
    selectedSubjects,
    selectedChapters,
    difficultyFilter,
    questionTypeFilter,
  ]);

  if (!isOpen) return null;

  const toggleSubject = (subj: 'Physics' | 'Chemistry' | 'Mathematics') => {
    setSelectedSubjects((prev) =>
      prev.includes(subj)
        ? prev.length > 1
          ? prev.filter((s) => s !== subj)
          : prev
        : [...prev, subj]
    );
  };

  const toggleChapter = (chapterName: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapterName)
        ? prev.filter((c) => c !== chapterName)
        : [...prev, chapterName]
    );
  };

  const handleBuildAndLaunch = () => {
    if (matchedPool.length === 0) {
      return;
    }

    const finalQuestions = buildBalancedCustomTestQuestions({
      pool: matchedPool,
      selectedSubjects,
      questionCount,
      groupBySubject: true,
    });

    onLaunchCustomCBT(
      finalQuestions,
      durationMinutes,
      `Custom NTA Test (${finalQuestions.length} Qs • ${durationMinutes} Mins)`
    );
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Custom Test Builder"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-white/[0.08] flex items-center justify-between bg-[#F8FAFF] dark:bg-[#070B14]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em]">
                Custom Test Builder
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                Configure subjects, chapters, difficulty &amp; duration
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Custom Test Builder"
            onClick={onClose}
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Subject Multi-Select */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475569] dark:text-[#94A3B8] mb-2">
              1. Subjects · {selectedSubjects.length}/3 Active
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                const active = selectedSubjects.includes(subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => toggleSubject(subj)}
                    className={`p-3 rounded-xl border text-left text-xs transition-colors duration-150 cursor-pointer flex items-center justify-between ${
                      active
                        ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-[#2563EB]/15 text-[#0F172A] dark:text-white font-semibold'
                        : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] font-medium'
                    }`}
                  >
                    <span>{subj}</span>
                    {active && <CheckCircle2 className="w-4 h-4 text-[#00A86B]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Difficulty & Question Format Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475569] dark:text-[#94A3B8] mb-2">
                2. Difficulty
              </label>
              <div className="grid grid-cols-4 gap-1 bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] p-1 rounded-xl">
                {(['All', 'Easy', 'Moderate', 'Tough'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficultyFilter(diff)}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      difficultyFilter === diff
                        ? 'btn-brand text-white font-semibold'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475569] dark:text-[#94A3B8] mb-2">
                3. Format
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'All',
                    'MCQ',
                    'Numerical',
                    'Multi-Correct',
                    'Previously Incorrect Only',
                  ] as const
                ).map((qType) => (
                  <button
                    key={qType}
                    type="button"
                    onClick={() => setQuestionTypeFilter(qType)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 cursor-pointer ${
                      questionTypeFilter === qType
                        ? 'btn-brand border-transparent text-white font-semibold'
                        : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                    }`}
                  >
                    {qType}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Question Count (10 to 75) & Duration (15 to 180 mins) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08]">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC]">
                  <Hash className="w-3.5 h-3.5 text-[#2563EB]" />
                  Total Questions
                </span>
                <span className="tabular-nums text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                  {questionCount} Qs · {questionCount * 4} Marks
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={75}
                step={5}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-[#2563EB] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-medium text-[#475569] dark:text-[#94A3B8] mt-1 tabular-nums">
                <span>10 Qs</span>
                <span>30 Qs</span>
                <span>75 Qs</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC]">
                  <Clock className="w-3.5 h-3.5 text-[#00A86B]" />
                  Exam Duration
                </span>
                <span className="tabular-nums text-xs text-[#00A86B]">
                  {durationMinutes} Mins
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full accent-[#7C3AED] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-medium text-[#475569] dark:text-[#94A3B8] mt-1 tabular-nums">
                <span>15m</span>
                <span>90m</span>
                <span>180m</span>
              </div>
            </div>
          </div>

          {/* 5. 58-Chapter Selector */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475569] dark:text-[#94A3B8] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#7C3AED]" />
                4. Chapters · {selectedChapters.length === 0 ? 'All 58 Included' : `${selectedChapters.length} Selected`}
              </label>
              <div className="flex items-center gap-1.5">
                {(['Physics', 'Chemistry', 'Mathematics'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSubjectTab(tab)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      subjectTab === tab
                        ? 'btn-brand text-white font-semibold'
                        : 'bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                {selectedChapters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedChapters([])}
                    className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline ml-2 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14]/60">
              {availableChapters.map((ch) => {
                const isPicked = selectedChapters.includes(ch.chapter);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChapter(ch.chapter)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors duration-150 cursor-pointer flex items-start justify-between gap-2 ${
                      isPicked
                        ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-[#2563EB]/15 font-semibold text-[#0F172A] dark:text-white'
                        : 'border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]'
                    }`}
                  >
                    <div>
                      <div className="line-clamp-1">{ch.chapter}</div>
                      <div className="text-[10px] text-[#475569] dark:text-[#94A3B8] mt-0.5">
                        Class {ch.classLevel} · {ch.weightageTier}
                      </div>
                    </div>
                    {isPicked && <CheckCircle2 className="w-3.5 h-3.5 text-[#00A86B] shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {matchedPool.length === 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                No questions match these filters. Adjust your selected subjects, chapters, difficulty, or format.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-[#475569] dark:text-[#94A3B8]">
            <span>
              NTA Marking <span className="tabular-nums font-semibold text-[#0F172A] dark:text-[#F8FAFC]">+4 / -1</span>
            </span>
            <span className="text-[#CBD5E1] dark:text-white/15">·</span>
            <span
              className={`tabular-nums font-semibold ${
                matchedPool.length === 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[#00A86B]'
              }`}
            >
              {matchedPool.length} matching questions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={matchedPool.length === 0}
              onClick={handleBuildAndLaunch}
              className="px-4 py-2 rounded-lg btn-brand disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Launch Custom CBT Test ({questionCount} Qs)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
