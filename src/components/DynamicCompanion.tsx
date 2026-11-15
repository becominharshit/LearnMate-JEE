import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Coins,
  Camera,
  Zap,
  Send,
  X,
  CheckCircle2,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { EXPANDED_NTA_58_CHAPTERS, MicroShardTask } from '../data/expandedNta58Chapters';
import { apiFetchWithAuth } from '../services/workspaceService';
import { MathRichText } from './MathRichText';

export interface DynamicCompanionProps {
  activeChapterName?: string;
  activeMaterialId?: string;
  onEarnXp?: (xp: number, reason?: string) => void;
  sidebarCollapsed?: boolean;
  variant?: 'sidebar' | 'mobile-icon';
}

export const DynamicCompanion: React.FC<DynamicCompanionProps> = ({
  activeChapterName = 'Rotational Motion',
  activeMaterialId,
  onEarnXp,
  sidebarCollapsed = false,
  variant = 'sidebar',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [modeTab, setModeTab] = useState<'socratic' | 'shardz' | 'ocr'>('socratic');
  const [language, setLanguage] = useState<'English' | 'Hinglish' | 'Hindi'>('Hinglish');
  const [clueCoins, setClueCoins] = useState<number>(3);
  const [socraticMode, setSocraticMode] = useState<boolean>(true);
  const [questionInput, setQuestionInput] = useState<string>('');
  const [aiReply, setAiReply] = useState<string>('');
  const [aiCitations, setAiCitations] = useState<
    { chunkId: string; pageNumber: number; timestampLabel?: string | null; snippet: string }[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [completedShards, setCompletedShards] = useState<Record<string, boolean>>({});
  const [ocrPreviewDataUrl, setOcrPreviewDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const matchedChapter =
    EXPANDED_NTA_58_CHAPTERS.find((c) =>
      c.chapterName.toLowerCase().includes(activeChapterName.toLowerCase())
    ) || EXPANDED_NTA_58_CHAPTERS[5];

  const shards: MicroShardTask[] = matchedChapter.microShards;

  const handleAskSocratic = async (hintLevel?: 1 | 2 | 3) => {
    const promptText =
      questionInput.trim() ||
      `Give me a step-by-step ${hintLevel ? `Hint #${hintLevel}` : 'concept breakdown'} on ${matchedChapter.chapterName}.`;
    if (hintLevel && clueCoins <= 0) return;
    setLoading(true);
    setAiCitations([]);
    try {
      const res = await apiFetchWithAuth<{
        answer?: string;
        text?: string;
        citations?: { chunkId: string; pageNumber: number; timestampLabel?: string | null; snippet: string }[];
      }>('/api/ai/tutor', {
        question: promptText,
        chapter: matchedChapter.chapterName,
        subject: matchedChapter.subject,
        materialId: activeMaterialId,
        language,
        socraticMode,
        hintLevel: hintLevel || (socraticMode ? 1 : undefined),
        imageBase64: ocrPreviewDataUrl || undefined,
        imageMimeType: ocrPreviewDataUrl ? 'image/png' : undefined,
      });
      if (!res.ok) {
        setAiReply(`[${res.error.errorCode}] ${res.error.message}`);
      } else {
        if (hintLevel) {
          setClueCoins((c) => Math.max(0, c - 1));
        }
        setAiReply(res.data.answer || res.data.text || 'Done.');
        if (Array.isArray(res.data.citations)) {
          setAiCitations(res.data.citations);
        }
        onEarnXp?.(15, '+15 XP');
      }
    } catch (err: any) {
      setAiReply(err?.message || 'Unable to reach AI Tutor endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOcrPreviewDataUrl(reader.result);
        setModeTab('ocr');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {variant === 'mobile-icon' ? (
        <button
          type="button"
          data-testid="companion-mobile-trigger"
          onClick={() => setIsOpen((v) => !v)}
          title="Study Companion"
          aria-label="Open Companion"
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] transition-colors duration-150 cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400 shrink-0" />
          <span className="tabular-nums text-[11px]">{clueCoins}</span>
        </button>
      ) : (
        <button
          type="button"
          data-testid="companion-sidebar-trigger"
          onClick={() => setIsOpen((v) => !v)}
          title={`Companion · ${clueCoins} Clue Coins`}
          className={`w-full flex items-center ${
            sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'
          } rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-white/[0.1] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium transition-colors duration-150 cursor-pointer`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Companion</span>}
          </span>
          {!sidebarCollapsed && (
            <span className="tabular-nums text-[11px] text-[#475569] dark:text-[#94A3B8] shrink-0">
              {clueCoins} coins
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          data-testid="companion-popover"
          className={`fixed bottom-16 left-4 lg:bottom-12 ${
            sidebarCollapsed ? 'lg:left-20' : 'lg:left-[16.75rem]'
          } z-50 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">Study Companion</div>
                <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] truncate">
                  {matchedChapter.subject} · {matchedChapter.chapterName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 tabular-nums text-[11px] font-semibold text-[#7C3AED] dark:text-violet-400">
                <Coins className="w-3 h-3" />
                {clueCoins}/3
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer transition-colors duration-150"
                aria-label="Close Companion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Language Selector & Mode Tabs */}
          <div className="px-3 py-2 border-b border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] flex items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-0.5 text-[11px] font-medium">
              {(
                [
                  { id: 'socratic', label: '3-Hint' },
                  { id: 'shardz', label: '15m Sprints' },
                  { id: 'ocr', label: 'Scan' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setModeTab(t.id)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors duration-150 ${
                    modeTab === t.id
                      ? 'btn-brand font-semibold'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 text-[11px] font-medium">
              <Globe className="w-3 h-3 text-[#475569] dark:text-[#94A3B8]" />
              <select
                aria-label="Select AI Tutor Language"
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as 'English' | 'Hinglish' | 'Hindi')
                }
                className="bg-transparent text-[#0F172A] dark:text-[#F8FAFC] font-medium focus:outline-none cursor-pointer"
              >
                <option value="English">English</option>
                <option value="Hinglish">Hinglish</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>
          </div>

          {/* Body */}
          <div className="p-3.5 max-h-80 overflow-y-auto space-y-3 text-xs">
            {modeTab === 'socratic' && (
              <div className="space-y-2.5">
                <label className="flex items-center justify-between bg-[#F8FAFF] dark:bg-[#1E293B] px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] cursor-pointer">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC] text-[11px]">
                    Guide with hints first
                  </span>
                  <input
                    type="checkbox"
                    checked={socraticMode}
                    onChange={(e) => setSocraticMode(e.target.checked)}
                    className="accent-[#2563EB] cursor-pointer"
                  />
                </label>

                <textarea
                  rows={2}
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={`Ask about ${matchedChapter.chapterName}...`}
                  className="w-full rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#1E293B] p-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#475569] dark:placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
                />

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={loading || clueCoins < 1}
                    onClick={() => handleAskSocratic(1)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-white/[0.1] text-[#2563EB] dark:text-blue-400 border border-[#E2E8F0] dark:border-white/[0.07] font-medium text-[11px] cursor-pointer disabled:opacity-50 transition-colors duration-150"
                  >
                    Hint 1
                  </button>
                  <button
                    type="button"
                    disabled={loading || clueCoins < 1}
                    onClick={() => handleAskSocratic(2)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-white/[0.1] text-[#7C3AED] dark:text-violet-400 border border-[#E2E8F0] dark:border-white/[0.07] font-medium text-[11px] cursor-pointer disabled:opacity-50 transition-colors duration-150"
                  >
                    Hint 2
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleAskSocratic(undefined)}
                    className="btn-brand py-1.5 px-3 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    Ask
                  </button>
                </div>

                {aiReply && (
                  <div className="p-3 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.07] text-[11px] leading-relaxed space-y-2">
                    <MathRichText content={aiReply} />
                    {aiCitations.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1.5 border-t border-[#E2E8F0] dark:border-white/[0.07] text-[10px] tabular-nums text-[#475569] dark:text-[#94A3B8]">
                        {aiCitations.map((cit) => (
                          <span key={cit.chunkId} title={cit.snippet}>
                            p.{cit.pageNumber}
                            {cit.timestampLabel ? ` · ${cit.timestampLabel}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {modeTab === 'shardz' && (
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8]">
                  15m Sprints · {matchedChapter.chapterName}
                </div>
                {shards.map((shard) => {
                  const done = !!completedShards[shard.id];
                  return (
                    <div
                      key={shard.id}
                      className="p-2.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-[#F8FAFF] dark:bg-[#1E293B] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                          {shard.title}
                        </span>
                        <span className="tabular-nums text-[10px] text-[#475569] dark:text-[#94A3B8]">
                          {shard.durationMinutes}m
                        </span>
                      </div>
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                        {shard.activeRecallPrompt}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-[#2563EB] dark:text-blue-400 truncate max-w-[180px]">
                          {matchedChapter.keyFormulasLatex[0] || matchedChapter.unitName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCompletedShards((prev) => ({ ...prev, [shard.id]: !done }));
                            if (!done) onEarnXp?.(20, `+20 XP`);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors duration-150 ${
                            done
                              ? 'btn-brand-secondary'
                              : 'btn-brand'
                          }`}
                        >
                          {done ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </>
                          ) : (
                            <>
                              Done <ChevronRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {modeTab === 'ocr' && (
              <div className="space-y-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-3 rounded-xl border border-dashed border-[#E2E8F0] dark:border-white/[0.14] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150"
                >
                  <Camera className="w-4 h-4 text-[#2563EB]" />
                  <span>Upload Question Image</span>
                </button>
                {ocrPreviewDataUrl && (
                  <div className="space-y-2">
                    <img
                      src={ocrPreviewDataUrl}
                      alt="Uploaded Doubt OCR Preview"
                      className="max-h-32 rounded-lg border border-[#E2E8F0] dark:border-white/[0.07] mx-auto object-contain"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAskSocratic(undefined)}
                      className="w-full py-2 rounded-lg btn-brand font-semibold cursor-pointer transition-colors duration-150"
                    >
                      {loading ? 'Scanning...' : `Solve in ${language}`}
                    </button>
                  </div>
                )}
                {aiReply && (
                  <div className="p-2.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.07] text-[11px]">
                    <MathRichText content={aiReply} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
