import React from 'react';
import { X, AlertTriangle, CheckCircle2, Target, RefreshCw } from 'lucide-react';
import { MistakeNotebookEntry } from './RevisePracticeProgressCBT';
import { CBTQuestion, ErrorRootCauseTag } from '../utils/jeeEngine';
import { MathRichText } from './MathRichText';

export interface MistakeBookAndImprovementModalProps {
  isOpen: boolean;
  mistakes: MistakeNotebookEntry[];
  onClose: () => void;
  onTagRootCause: (mistakeId: string, tag: ErrorRootCauseTag) => void;
  onVerifyMistakeRecheck?: (mistakeId: string, passed: boolean) => void;
  onPracticeMistake: (question: CBTQuestion) => void;
}

const ROOT_CAUSE_TAGS: ErrorRootCauseTag[] = [
  'Conceptual Gap',
  'Formula Forgotten',
  'Calculation/Silly Error',
  'Misread Question',
  'Time Pressure',
];

export const MistakeBookAndImprovementModal: React.FC<
  MistakeBookAndImprovementModalProps
> = ({ isOpen, mistakes, onClose, onTagRootCause, onVerifyMistakeRecheck, onPracticeMistake }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mistake DNA Notebook & Improvement Plan"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]">
        <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em]">
                Mistake DNA · Learning Loop
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                <span className="tabular-nums font-medium">{mistakes.length}</span> logged · Diagnose → Recheck → Verify
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Mistake DNA Modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 text-xs">
          {mistakes.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08]">
              <CheckCircle2 className="w-7 h-7 text-[#00A86B] mx-auto mb-2" />
              <div className="font-semibold text-sm">Zero mistakes logged</div>
              <div className="text-[#475569] dark:text-[#94A3B8] mt-1">
                Incorrect questions from CBT mocks or PYQs appear here automatically.
              </div>
            </div>
          ) : (
            mistakes.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#475569] dark:text-[#94A3B8]">
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {m.question.subject}
                    </span>
                    <span>·</span>
                    <span>{m.question.chapter}</span>
                    <span>·</span>
                    <span>{m.source}</span>
                    {typeof m.masteryDelta === 'number' && m.masteryDelta !== 0 && (
                      <>
                        <span>·</span>
                        <span
                          className={`tabular-nums font-semibold ${
                            m.masteryDelta > 0
                              ? 'text-[#00A86B] dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {m.masteryDelta > 0 ? `+${m.masteryDelta}%` : `${m.masteryDelta}%`}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onVerifyMistakeRecheck && (
                      <>
                        <button
                          type="button"
                          onClick={() => onVerifyMistakeRecheck(m.id, true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00A86B] hover:bg-emerald-600 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Pass (+8%)
                        </button>
                        <button
                          type="button"
                          onClick={() => onVerifyMistakeRecheck(m.id, false)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry 1d
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPracticeMistake(m.question);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-brand font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      <Target className="w-3 h-3" />
                      Re-Attempt
                    </button>
                  </div>
                </div>
                <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  <MathRichText content={m.question.stem} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] mr-1">Root Cause:</span>
                  {ROOT_CAUSE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onTagRootCause(m.id, tag)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                        m.rootCauseTag === tag
                          ? 'bg-blue-500/15 text-[#2563EB] dark:text-blue-300 border-blue-500/40 font-semibold'
                          : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border-[#E2E8F0] dark:border-white/[0.08] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
