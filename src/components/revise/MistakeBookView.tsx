import React, { useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Play,
  RefreshCw,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react';
import { CBTQuestion, ErrorRootCauseTag } from '../../utils/jeeEngine';
import { MathRichText } from '../MathRichText';
import { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';
import { generateConceptMisconceptionDiagnostic } from '../../services/learningLoopService';

const ROOT_CAUSE_TAGS: {
  id: ErrorRootCauseTag;
  label: string;
  colorClass: string;
  remedyHint: string;
}[] = [
  {
    id: 'Conceptual Gap',
    label: 'Conceptual Gap',
    colorClass: 'bg-zinc-50 text-rose-600 border-rose-500/30 dark:bg-[#18181b] dark:text-rose-400',
    remedyHint: 'Re-read Section 1 and test with Socratic Hints.',
  },
  {
    id: 'Formula Forgotten',
    label: 'Formula Forgotten',
    colorClass: 'bg-zinc-50 text-amber-600 border-amber-500/30 dark:bg-[#18181b] dark:text-amber-400',
    remedyHint: 'Scheduled into SM-2 queue (1d → 6d → 15d).',
  },
  {
    id: 'Calculation/Silly Error',
    label: 'Calculation/Silly Error',
    colorClass: 'bg-zinc-50 text-blue-600 border-blue-500/30 dark:bg-[#18181b] dark:text-blue-400',
    remedyHint: 'Simplify symbolically before substituting decimals.',
  },
  {
    id: 'Misread Question',
    label: 'Misread Question',
    colorClass: 'bg-zinc-50 text-amber-600 border-amber-500/30 dark:bg-[#18181b] dark:text-amber-400',
    remedyHint: 'Check "NOT", "incorrect", and non-SI units.',
  },
  {
    id: 'Time Pressure',
    label: 'Time Pressure',
    colorClass: 'bg-zinc-50 text-emerald-600 border-emerald-500/30 dark:bg-[#18181b] dark:text-emerald-400',
    remedyHint: 'Use Round-1 / Round-2 strategy and unit checks.',
  },
];

interface MistakeBookViewProps {
  mistakesNotebook?: MistakeNotebookEntry[];
  mistakes?: MistakeNotebookEntry[];
  onTagMistakeRootCause?: (mistakeId: string, rootCause: ErrorRootCauseTag) => void;
  onTagRootCause?: (mistakeId: string, rootCause: ErrorRootCauseTag) => void;
  onPracticeQuestion?: (question: CBTQuestion) => void;
  onPracticeMistake?: (question: CBTQuestion) => void;
  onVerifyMistakeRecheck?: (mistakeId: string, passed: boolean) => void;
  onConvertMistakeToSM2Card?: (entry: MistakeNotebookEntry, rootCause: ErrorRootCauseTag) => void;
}

export const MistakeBookView: React.FC<MistakeBookViewProps> = ({
  mistakesNotebook,
  mistakes,
  onTagMistakeRootCause,
  onTagRootCause,
  onPracticeQuestion,
  onPracticeMistake,
  onVerifyMistakeRecheck,
  onConvertMistakeToSM2Card,
}) => {
  const allMistakes = mistakesNotebook || mistakes || [];
  const handleTagCause = onTagMistakeRootCause || onTagRootCause || (() => {});
  const handlePracticeQ = onPracticeQuestion || onPracticeMistake || (() => {});

  const [filterRootCause, setFilterRootCause] = useState<'All' | ErrorRootCauseTag>('All');
  const [filterSubject, setFilterSubject] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');
  const [activeReteachId, setActiveReteachId] = useState<string | null>(null);
  const [recheckSelectionById, setRecheckSelectionById] = useState<Record<string, number>>({});
  const [recheckFeedbackById, setRecheckFeedbackById] = useState<Record<string, 'passed' | 'failed'>>({});

  const filtered = allMistakes.filter((m) => {
    const matchesSubj = filterSubject === 'All' || m.question.subject === filterSubject;
    const matchesCause =
      filterRootCause === 'All' || (m.rootCauseTag || 'Conceptual Gap') === filterRootCause;
    return matchesSubj && matchesCause;
  });

  const untaggedCount = allMistakes.filter((m) => !m.rootCauseTag).length;

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
              Mistake Book ({allMistakes.length})
            </h3>
            {untaggedCount > 0 && (
              <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                · {untaggedCount} untagged
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Tag root causes, reteach concepts, and verify rechecks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setFilterSubject(subj)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ${
                filterSubject === subj
                  ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                  : 'bg-zinc-100 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-[#1f1f23]'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilterRootCause('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors duration-150 ${
            filterRootCause === 'All'
              ? 'border-[#1C1917] dark:border-[#F5F0E6] bg-[#1C1917] dark:bg-[#F5F0E6] text-[#FAF8F5] dark:text-[#09090B]'
              : 'border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-[#111113] text-zinc-600 dark:text-zinc-400'
          }`}
        >
          All ({allMistakes.length})
        </button>
        {ROOT_CAUSE_TAGS.map((tag) => {
          const count = allMistakes.filter((m) => m.rootCauseTag === tag.id).length;
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => setFilterRootCause(tag.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors duration-150 ${
                filterRootCause === tag.id
                  ? 'border-[#1C1917] dark:border-[#F5F0E6] bg-[#1C1917] dark:bg-[#F5F0E6] text-[#FAF8F5] dark:text-[#09090B]'
                  : 'border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-[#111113] text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {tag.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] text-center space-y-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No mistakes in this filter
          </div>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Attempt mocks or PYQs to log mistakes for reteaching.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => {
            const activeCause = entry.rootCauseTag;
            const causeMeta = ROOT_CAUSE_TAGS.find((t) => t.id === activeCause);
            const diagnosis = generateConceptMisconceptionDiagnostic({
              subject: entry.question.subject,
              chapter: entry.question.chapter,
              rootCause: activeCause,
              stem: entry.question.stem,
              userAnswer: entry.userAnswer,
            });
            const isReteachOpen = activeReteachId === entry.id;
            const chosenCheck = recheckSelectionById[entry.id];
            const checkFeedback = recheckFeedbackById[entry.id];
            return (
              <div
                key={entry.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {entry.question.subject} · {entry.question.chapter}
                    </span>
                    <span className="text-zinc-400">·</span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {entry.source} · {entry.loggedAt}
                    </span>
                    {activeCause ? (
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                          causeMeta?.colorClass || ''
                        }`}
                      >
                        {activeCause}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Untagged
                      </span>
                    )}
                    {typeof entry.masteryDelta === 'number' && entry.masteryDelta !== 0 && (
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          entry.masteryDelta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {entry.masteryDelta > 0 ? `+${entry.masteryDelta}%` : `${entry.masteryDelta}%`}
                      </span>
                    )}
                    {entry.nextDueIso && (
                      <span className="font-mono text-[10px] text-zinc-500">
                        Due {new Date(entry.nextDueIso).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveReteachId(isReteachOpen ? null : entry.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer border transition-colors duration-150 ${
                        isReteachOpen
                          ? 'border-[#1C1917] dark:border-[#F5F0E6] bg-[#1C1917] dark:bg-[#F5F0E6] text-[#FAF8F5] dark:text-[#09090B]'
                          : 'border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isReteachOpen ? 'Hide Reteach' : 'Reteach & Recheck'}
                    </button>
                    {onVerifyMistakeRecheck && (
                      <>
                        <button
                          type="button"
                          onClick={() => onVerifyMistakeRecheck(entry.id, true)}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pass (+8%)
                        </button>
                        <button
                          type="button"
                          onClick={() => onVerifyMistakeRecheck(entry.id, false)}
                          className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-amber-600 dark:text-amber-400 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry 1d
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePracticeQ(entry.question)}
                      className="px-3.5 py-1.5 rounded-lg btn-terracotta text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Re-Attempt
                    </button>
                  </div>
                </div>

                {isReteachOpen && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span>{diagnosis.headline}</span>
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        Trap: {diagnosis.likelyTrap}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {diagnosis.reteachSteps.map((step, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-2.5 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07]"
                        >
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-0.5">
                            Step {sIdx + 1}
                          </span>
                          <MathRichText content={step} />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-zinc-200 dark:border-white/[0.07] space-y-2">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        Recheck: {diagnosis.recheckPrompt}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {diagnosis.recheckChoices.map((choice, cIdx) => {
                          const picked = chosenCheck === cIdx;
                          const isCorrectChoice = cIdx === diagnosis.correctChoiceIndex;
                          return (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => {
                                setRecheckSelectionById((prev) => ({ ...prev, [entry.id]: cIdx }));
                                const passed = cIdx === diagnosis.correctChoiceIndex;
                                setRecheckFeedbackById((prev) => ({
                                  ...prev,
                                  [entry.id]: passed ? 'passed' : 'failed',
                                }));
                                if (onVerifyMistakeRecheck) {
                                  onVerifyMistakeRecheck(entry.id, passed);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg border text-left font-medium cursor-pointer transition-colors duration-150 ${
                                picked
                                  ? isCorrectChoice
                                    ? 'border-emerald-500/40 bg-emerald-600 text-white'
                                    : 'border-rose-500/40 bg-rose-600 text-white'
                                  : 'border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-[#111113] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                              }`}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                      {checkFeedback && (
                        <div
                          className={`font-semibold ${
                            checkFeedback === 'passed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {checkFeedback === 'passed'
                            ? 'Passed (+8% mastery, SM-2 updated).'
                            : 'Review steps above; reset to 1d.'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
                  <MathRichText content={entry.question.stem} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-rose-500/30">
                    <span className="font-semibold text-rose-600 dark:text-rose-400 block mb-0.5">
                      Your Response
                    </span>
                    <MathRichText content={entry.userAnswer || 'Unattempted'} />
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-emerald-500/30">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                      Solution
                    </span>
                    <MathRichText content={entry.question.explanation} />
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-zinc-500 flex items-center gap-1 mr-1">
                      <Tag className="w-3.5 h-3.5" />
                      Root Cause:
                    </span>
                    {ROOT_CAUSE_TAGS.map((tag) => {
                      const selected = activeCause === tag.id;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            handleTagCause(entry.id, tag.id);
                            if (onConvertMistakeToSM2Card) {
                              onConvertMistakeToSM2Card(entry, tag.id);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors duration-150 cursor-pointer ${
                            selected
                              ? 'border-[#1C1917] dark:border-[#F5F0E6] bg-[#1C1917] dark:bg-[#F5F0E6] text-[#FAF8F5] dark:text-[#09090B]'
                              : 'border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>

                  {causeMeta && (
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5 shrink-0" />
                      <span>{causeMeta.remedyHint}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
