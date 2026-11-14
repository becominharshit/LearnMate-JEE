import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  calculateSM2Schedule,
  CBTQuestion,
  ErrorRootCauseTag,
  SM2FlashcardItem,
} from '../../utils/jeeEngine';
import { MathRichText } from '../MathRichText';
import { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';
import { MistakeBookView } from './MistakeBookView';

export type { SM2FlashcardItem };

interface SpacedRepetitionHubProps {
  sm2Cards?: SM2FlashcardItem[];
  cards?: SM2FlashcardItem[];
  mistakes?: MistakeNotebookEntry[];
  mistakesNotebook?: MistakeNotebookEntry[];
  onUpdateSM2Card?: (updatedCard: SM2FlashcardItem) => void;
  onUpdateCardSchedule?: (updatedCard: SM2FlashcardItem) => void;
  onAddSM2Card?: (card: Omit<SM2FlashcardItem, 'id'>) => void;
  onAddCustomSM2Card?: (card: Omit<SM2FlashcardItem, 'id'>) => void;
  onTagMistakeRootCause?: (mistakeId: string, rootCause: ErrorRootCauseTag) => void;
  onPracticeMistake?: (question: CBTQuestion) => void;
  onPracticeQuestion?: (question: CBTQuestion) => void;
  onVerifyMistakeRecheck?: (mistakeId: string, passed: boolean) => void;
  showToast?: (msg: string) => void;
}

export const SpacedRepetitionHub: React.FC<SpacedRepetitionHubProps> = ({
  sm2Cards,
  cards,
  mistakes,
  mistakesNotebook,
  onUpdateSM2Card,
  onUpdateCardSchedule,
  onAddSM2Card,
  onAddCustomSM2Card,
  onTagMistakeRootCause,
  onPracticeMistake,
  onPracticeQuestion,
  onVerifyMistakeRecheck,
  showToast,
}) => {
  const dueCards = sm2Cards || cards || [];
  const allMistakes = mistakes || mistakesNotebook || [];
  const [subMode, setSubMode] = useState<'neuronz_queue' | 'mistake_book'>(
    allMistakes.length > 0 && dueCards.length === 0 ? 'mistake_book' : 'neuronz_queue'
  );
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [reviewedTodayCount, setReviewedTodayCount] = useState<number>(0);
  const activeCard = dueCards[activeIndex % Math.max(1, dueCards.length)] || null;

  const handleUpdateCard = onUpdateSM2Card || onUpdateCardSchedule;
  const handleAddCard = onAddSM2Card || onAddCustomSM2Card;
  const handlePractice = onPracticeMistake || onPracticeQuestion;

  const handleRateCard = (quality: 1 | 3 | 4 | 5) => {
    if (!activeCard) return;
    const nextSchedule = calculateSM2Schedule(
      {
        intervalDays: activeCard.intervalDays ?? 1,
        repetitionCount: activeCard.repetitionCount ?? 0,
        easeFactor: activeCard.easeFactor ?? 2.5,
      },
      quality
    );
    const updated: SM2FlashcardItem = {
      ...activeCard,
      intervalDays: nextSchedule.intervalDays,
      repetitionCount: nextSchedule.repetitionCount,
      easeFactor: nextSchedule.easeFactor,
      nextReviewIso: nextSchedule.nextReviewIso,
    };
    if (handleUpdateCard) handleUpdateCard(updated);
    if (showToast) {
      showToast(
        `SM-2 Scheduled: Next review in ${nextSchedule.intervalDays} day(s) (EF ${nextSchedule.easeFactor})`
      );
    }
    setIsFlipped(false);
    setReviewedTodayCount((c) => c + 1);
    setActiveIndex((idx) => (idx + 1) % Math.max(1, dueCards.length));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubMode('neuronz_queue')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors duration-150 ${
              subMode === 'neuronz_queue'
                ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                : 'bg-zinc-100 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#1f1f23]'
            }`}
          >
            <Brain className="w-4 h-4" />
            Recall Queue ({dueCards.length})
          </button>
          <button
            type="button"
            onClick={() => setSubMode('mistake_book')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors duration-150 ${
              subMode === 'mistake_book'
                ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                : 'bg-zinc-100 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#1f1f23]'
            }`}
          >
            <Zap className="w-4 h-4" />
            Mistake Book ({allMistakes.length})
          </button>
        </div>

        <div className="text-xs font-mono tabular-nums text-zinc-500 flex items-center gap-3">
          <span>
            Reviewed: <strong className="text-zinc-900 dark:text-zinc-100">{reviewedTodayCount}</strong>
          </span>
          <span>·</span>
          <span>SM-2</span>
        </div>
      </div>

      {subMode === 'mistake_book' ? (
        <MistakeBookView
          mistakes={allMistakes}
          onTagRootCause={(id, cause) => {
            if (onTagMistakeRootCause) onTagMistakeRootCause(id, cause);
          }}
          onVerifyMistakeRecheck={onVerifyMistakeRecheck}
          onPracticeMistake={handlePractice}
          onConvertMistakeToSM2Card={(entry, rootCause) => {
            if (handleAddCard) {
              handleAddCard({
                subject: entry.question.subject,
                chapter: entry.question.chapter,
                frontPrompt: `**[Mistake Remediation · ${rootCause}]** ${entry.question.stem}`,
                backAnswer: `${entry.question.explanation}\n\n*Root Cause Logged: ${rootCause}*`,
                intervalDays: 1,
                repetitionCount: 0,
                easeFactor: 2.5,
                nextReviewIso: new Date().toISOString(),
                rootCauseTag: rootCause,
              });
            }
            if (showToast) {
              showToast(`Added "${entry.question.chapter}" to SM-2 queue`);
            }
          }}
        />
      ) : activeCard ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-mono text-zinc-500">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {activeCard.subject} · {activeCard.chapter}
              </span>
              <span>·</span>
              <span className="tabular-nums">
                {activeCard.intervalDays}d · Rep {activeCard.repetitionCount} · EF {activeCard.easeFactor}
              </span>
            </div>
            <span className="font-mono tabular-nums text-zinc-500">
              {(activeIndex % dueCards.length) + 1} / {dueCards.length}
            </span>
          </div>

          <div
            onClick={() => setIsFlipped((f) => !f)}
            className="min-h-60 p-8 rounded-2xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] flex flex-col justify-between cursor-pointer transition-colors duration-150"
          >
            <div className="text-[11px] font-mono uppercase text-zinc-500">
              {isFlipped ? 'Back · Answer & Trap' : 'Front · Tap to Flip'}
            </div>

            <div className="my-4 text-base font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
              {isFlipped ? (
                <MathRichText content={activeCard.backAnswer} />
              ) : (
                <MathRichText content={activeCard.frontPrompt} />
              )}
            </div>

            <div className="text-xs font-mono tabular-nums text-zinc-500 flex items-center justify-between">
              <span>{isFlipped ? 'Show prompt' : 'Reveal solution'}</span>
              <span>Due {new Date(activeCard.nextReviewIso).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handleRateCard(1)}
              className="p-3 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer text-center transition-colors duration-150"
            >
              <div>Again</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">1d · EF −0.2</div>
            </button>
            <button
              type="button"
              onClick={() => handleRateCard(3)}
              className="p-3 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-amber-600 dark:text-amber-400 text-xs font-semibold cursor-pointer text-center transition-colors duration-150"
            >
              <div>Hard</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Quality 3</div>
            </button>
            <button
              type="button"
              onClick={() => handleRateCard(4)}
              className="p-3 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-zinc-900 dark:text-zinc-100 text-xs font-semibold cursor-pointer text-center transition-colors duration-150"
            >
              <div>Good</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Quality 4</div>
            </button>
            <button
              type="button"
              onClick={() => handleRateCard(5)}
              className="p-3 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-emerald-600 dark:text-emerald-400 text-xs font-semibold cursor-pointer text-center transition-colors duration-150"
            >
              <div>Easy</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Quality 5 · EF +0.1</div>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] text-center space-y-2">
          <Sparkles className="w-6 h-6 text-zinc-400 mx-auto" />
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No cards due today
          </div>
          <button
            type="button"
            onClick={() => setSubMode('mistake_book')}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
          >
            Start Practice →
          </button>
        </div>
      )}
    </div>
  );
};
