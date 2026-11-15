import React, { useMemo, useState } from 'react';
import { X, Database, BookOpen, CheckCircle2, AlertTriangle, Flag } from 'lucide-react';
import { EXPANDED_NTA_58_CHAPTERS } from '../data/expandedNta58Chapters';
import { CBT_MOCK_QUESTIONS, JEE_ADVANCED_PAPER_QUESTIONS } from '../data/jeeInitialContent';
import { reportQuestionIssueOnServer } from '../services/workspaceService';

const CORE_PYQ_POOL = [...CBT_MOCK_QUESTIONS, ...JEE_ADVANCED_PAPER_QUESTIONS];

export interface AdminQuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminQuestionBankModal: React.FC<AdminQuestionBankModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Mathematics'>('All');
  const [reportQId, setReportQId] = useState(CORE_PYQ_POOL[0]?.id || 'q-1');
  const [reportType, setReportType] = useState<
    'wrong_answer_key' | 'typo_or_latex' | 'missing_diagram' | 'provenance_mismatch' | 'other'
  >('wrong_answer_key');
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const provenanceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of CORE_PYQ_POOL) {
      const p = q.provenanceType || 'RECONSTRUCTED_WITH_SOURCE';
      counts[p] = (counts[p] || 0) + 1;
    }
    return counts;
  }, []);

  if (!isOpen) return null;

  const filteredChapters =
    subjectFilter === 'All'
      ? EXPANDED_NTA_58_CHAPTERS
      : EXPANDED_NTA_58_CHAPTERS.filter((c) => c.subject === subjectFilter);

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reportDetails.trim().length < 5) {
      setReportStatus('Please enter at least 5 characters describing the issue.');
      return;
    }
    const res = await reportQuestionIssueOnServer({
      questionId: reportQId,
      issueType: reportType,
      details: reportDetails.trim(),
    });
    if (!res.ok) {
      setReportStatus(`[${res.error.errorCode}] ${res.error.message}`);
    } else {
      setReportStatus(`Issue logged for review (${res.data?.issueId || 'recorded'}).`);
      setReportDetails('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NTA 58-Chapter and PYQ Bank Inspector"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]">
        <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em]">
                NTA Syllabus &amp; PYQ Bank Inspector
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                <span className="tabular-nums font-medium">{EXPANDED_NTA_58_CHAPTERS.length}</span> Chapters · <span className="tabular-nums font-medium">{CORE_PYQ_POOL.length}</span> Curated Items · 2027 Paper 1 Spec
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Question Bank Inspector"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provenance & Partial Archive Honest Banner */}
        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs space-y-2">
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong>Partial Archive:</strong> Sample shift packs include verified curated items only (`isPartialArchive: true`).
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {Object.entries(provenanceCounts).map(([tag, count]) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] tabular-nums font-medium"
              >
                {tag}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 bg-[#F8FAFF] dark:bg-[#070B14] border-b border-[#E2E8F0] dark:border-white/[0.08] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubjectFilter(sub)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  subjectFilter === sub
                    ? 'btn-brand font-semibold'
                    : 'bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-400 border border-[#E2E8F0] dark:border-white/[0.08] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          <span className="text-xs font-medium text-[#00A86B] dark:text-emerald-400 inline-flex items-center gap-1 tabular-nums">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {filteredChapters.length} chapters
          </span>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredChapters.map((ch) => (
              <div
                key={ch.id}
                className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400 shrink-0" />
                    {ch.chapterName}
                  </span>
                  <span className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] tabular-nums shrink-0">
                    {ch.subject} · {ch.ntaWeightagePct}%
                  </span>
                </div>
                <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  {ch.keyFormulasLatex.join(' | ')}
                </div>
              </div>
            ))}
          </div>

          {/* Authenticated Academic Issue Reporter */}
          <form
            onSubmit={handleSubmitIssue}
            className="p-4 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] space-y-3"
          >
            <div className="font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
              <Flag className="w-4 h-4 text-rose-500" />
              <span>Report Question Key or Provenance Issue</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <select
                value={reportQId}
                onChange={(e) => setReportQId(e.target.value)}
                aria-label="Select question ID"
                className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]"
              >
                {CORE_PYQ_POOL.slice(0, 25).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.id} — {q.subject}: {q.chapter}
                  </option>
                ))}
              </select>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                aria-label="Issue type"
                className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value="wrong_answer_key">Wrong Answer Key</option>
                <option value="typo_or_latex">Typo or LaTeX Rendering</option>
                <option value="missing_diagram">Missing Diagram</option>
                <option value="provenance_mismatch">Provenance Mismatch</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Describe exact option or numerical discrepancy..."
                className="flex-1 px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg btn-brand font-semibold transition-colors cursor-pointer"
              >
                Submit Report
              </button>
            </div>
            {reportStatus && <div className="font-medium text-[#00A86B] dark:text-emerald-400">{reportStatus}</div>}
          </form>
        </div>
      </div>
    </div>
  );
};
