import React, { useState, useMemo } from 'react';
import {
  X,
  Sliders,
  CheckCircle2,
  Play,
  Layers,
  Clock,
  Hash,
  Sparkles,
  Filter,
} from 'lucide-react';
import { CBTQuestion, buildBalancedCustomTestQuestions } from '../../utils/jeeEngine';
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
    let pool: CBTQuestion[] = [];

    if (questionTypeFilter === 'Previously Incorrect Only' && mistakesNotebook.length > 0) {
      pool = mistakesNotebook.map((m) => m.question);
    } else if (questionTypeFilter === 'Multi-Correct') {
      pool = [...JEE_ADVANCED_PAPER_QUESTIONS, ...CBT_MOCK_QUESTIONS];
    } else {
      pool = [...CBT_MOCK_QUESTIONS, ...JEE_ADVANCED_PAPER_QUESTIONS];
    }

    // Filter by selected subjects
    pool = pool.filter((q) => selectedSubjects.includes(q.subject));

    // Filter by selected chapters if any explicitly chosen
    if (selectedChapters.length > 0) {
      const chapterMatched = pool.filter((q) =>
        selectedChapters.some(
          (ch) =>
            ch.toLowerCase().includes(q.chapter.toLowerCase()) ||
            q.chapter.toLowerCase().includes(ch.split(' ')[0].toLowerCase())
        )
      );
      if (chapterMatched.length > 0) {
        pool = chapterMatched;
      }
    }

    // Filter by difficulty
    if (difficultyFilter !== 'All') {
      const targetBucket =
        difficultyFilter === 'Easy'
          ? 'Beginner'
          : difficultyFilter === 'Moderate'
          ? 'Must-Do'
          : 'Advanced Climb';
      const diffMatched = pool.filter((q) => q.difficultyBucket === targetBucket);
      if (diffMatched.length > 0) pool = diffMatched;
    }

    // Filter by question type
    if (questionTypeFilter === 'MCQ') {
      pool = pool.filter((q) => q.section === 'Section A' && q.advancedFormat !== 'multiple');
    } else if (questionTypeFilter === 'Numerical') {
      pool = pool.filter((q) => q.section === 'Section B' || q.advancedFormat === 'numerical');
    } else if (questionTypeFilter === 'Multi-Correct') {
      const multi = pool.filter((q) => q.advancedFormat === 'multiple');
      if (multi.length > 0) pool = multi;
    }

    if (pool.length === 0) {
      pool = CBT_MOCK_QUESTIONS.filter((q) => selectedSubjects.includes(q.subject));
      if (pool.length === 0) {
        pool = CBT_MOCK_QUESTIONS.slice(0, questionCount);
      }
    }

    // Build exact requested questionCount distributed evenly (round-robin) across selected subjects
    const finalQuestions = buildBalancedCustomTestQuestions({
      pool,
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
      aria-label="MARKS Custom Test Generator"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-white/[0.07] flex items-center justify-between bg-zinc-50 dark:bg-[#141417]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#D4653B]/10 text-[#D4653B] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em]">
                Custom Test Builder
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Configure subjects, chapters, difficulty &amp; duration
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Custom Test Builder"
            onClick={onClose}
            className="p-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#18181b] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Subject Multi-Select */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400 mb-2">
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
                        ? 'border-zinc-900 dark:border-white/30 bg-zinc-100 dark:bg-[#1f1f23] text-zinc-900 dark:text-white font-semibold'
                        : 'border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1f1f23] font-medium'
                    }`}
                  >
                    <span>{subj}</span>
                    {active && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Difficulty & Question Format Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400 mb-2">
                2. Difficulty
              </label>
              <div className="grid grid-cols-4 gap-1 bg-zinc-100 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] p-1 rounded-xl">
                {(['All', 'Easy', 'Moderate', 'Tough'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficultyFilter(diff)}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                      difficultyFilter === diff
                        ? 'bg-white dark:bg-[#27272a] text-zinc-900 dark:text-white font-semibold'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400 mb-2">
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
                        ? 'border-[#1C1917] bg-[#1C1917] text-[#FAF8F5] dark:border-white/20 dark:bg-[#F5F0E6] dark:text-[#09090B] font-semibold'
                        : 'border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                    }`}
                  >
                    {qType}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Question Count (10 to 75) & Duration (15 to 180 mins) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07]">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                  <Hash className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  Total Questions
                </span>
                <span className="font-mono tabular-nums text-xs text-zinc-900 dark:text-zinc-100">
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
                className="w-full accent-[#D4653B] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1 font-mono tabular-nums">
                <span>10 Qs</span>
                <span>30 Qs</span>
                <span>75 Qs</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                  <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  Exam Duration
                </span>
                <span className="font-mono tabular-nums text-xs text-emerald-600 dark:text-emerald-400">
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
                className="w-full accent-[#D4653B] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1 font-mono tabular-nums">
                <span>15m</span>
                <span>90m</span>
                <span>180m</span>
              </div>
            </div>
          </div>

          {/* 5. 58-Chapter Selector */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
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
                        ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B] font-semibold'
                        : 'bg-zinc-100 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-2 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/50 dark:bg-[#09090b]/40">
              {availableChapters.map((ch) => {
                const isPicked = selectedChapters.includes(ch.chapter);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChapter(ch.chapter)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors duration-150 cursor-pointer flex items-start justify-between gap-2 ${
                      isPicked
                        ? 'border-zinc-900 dark:border-white/30 bg-zinc-100 dark:bg-[#1f1f23] font-semibold text-zinc-900 dark:text-white'
                        : 'border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="line-clamp-1">{ch.chapter}</div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        Class {ch.classLevel} · {ch.weightageTier}
                      </div>
                    </div>
                    {isPicked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#141417] flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            NTA Marking <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-200">+4 / -1</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#18181b] text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#1f1f23] transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBuildAndLaunch}
              className="px-4 py-2 rounded-lg btn-terracotta text-xs font-semibold inline-flex items-center gap-2 transition-colors duration-150 cursor-pointer"
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
