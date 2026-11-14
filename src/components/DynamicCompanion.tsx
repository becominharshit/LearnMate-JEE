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
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E7E2DA] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1A1A1D] hover:bg-[#F3EFEA] dark:hover:bg-[#222226] text-xs font-medium text-[#1C1917] dark:text-[#F5F0E6] transition-colors duration-150 cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D4653B] dark:text-[#E07348] shrink-0" />
          <span className="font-mono tabular-nums text-[11px]">{clueCoins}</span>
        </button>
      ) : (
        <button
          type="button"
          data-testid="companion-sidebar-trigger"
          onClick={() => setIsOpen((v) => !v)}
          title={`Companion · ${clueCoins} Clue Coins`}
          className={`w-full flex items-center ${
            sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'
          } rounded-lg border border-[#E7E2DA] dark:border-white/[0.08] bg-[#F3EFEA] dark:bg-[#1A1A1D] hover:bg-[#EAE4DC] dark:hover:bg-[#222226] text-[#1C1917] dark:text-[#F5F0E6] text-xs font-medium transition-colors duration-150 cursor-pointer`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-[#D4653B] dark:text-[#E07348] shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Companion</span>}
          </span>
          {!sidebarCollapsed && (
            <span className="font-mono tabular-nums text-[11px] text-[#57534E] dark:text-[#A1A1AA] shrink-0">
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
          } z-50 w-96 max-w-[calc(100vw-2rem)] bg-[#FFFFFF] dark:bg-[#121214] rounded-2xl border border-[#E7E2DA] dark:border-white/[0.08] shadow-2xl overflow-hidden text-[#1C1917] dark:text-[#F5F0E6]`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E7E2DA] dark:border-white/[0.08] bg-[#F3EFEA] dark:bg-[#1A1A1D] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-[#D4653B] dark:text-[#E07348] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">Study Companion</div>
                <div className="text-[11px] text-[#57534E] dark:text-[#A1A1AA] truncate">
                  {matchedChapter.subject} · {matchedChapter.chapterName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] text-[#D4653B] dark:text-[#E07348]">
                <Coins className="w-3 h-3" />
                {clueCoins}/3
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-[#57534E] hover:text-[#1C1917] dark:text-[#A1A1AA] dark:hover:text-[#F5F0E6] cursor-pointer transition-colors duration-150"
                aria-label="Close Companion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Language Selector & Mode Tabs */}
          <div className="px-3 py-2 border-b border-[#E7E2DA] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#121214] flex items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-[#F3EFEA] dark:bg-[#1A1A1D] p-0.5 text-[11px] font-medium">
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
                      ? 'bg-[#D4653B]/10 dark:bg-[#D4653B]/[0.15] text-[#D4653B] dark:text-[#E07348] font-semibold'
                      : 'text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F5F0E6]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 text-[11px] font-medium">
              <Globe className="w-3 h-3 text-zinc-400" />
              <select
                aria-label="Select AI Tutor Language"
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as 'English' | 'Hinglish' | 'Hindi')
                }
                className="bg-transparent text-zinc-700 dark:text-zinc-200 font-medium focus:outline-none cursor-pointer"
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
                <label className="flex items-center justify-between bg-zinc-50 dark:bg-[#18181b] px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.07] cursor-pointer">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 text-[11px]">
                    Guide with hints first
                  </span>
                  <input
                    type="checkbox"
                    checked={socraticMode}
                    onChange={(e) => setSocraticMode(e.target.checked)}
                    className="accent-zinc-900 dark:accent-[#fafafa] cursor-pointer"
                  />
                </label>

                <textarea
                  rows={2}
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={`Ask about ${matchedChapter.chapterName}...`}
                  className="w-full rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-[#18181b] p-2.5 text-xs text-zinc-900 dark:text-[#fafafa] placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={loading || clueCoins < 1}
                    onClick={() => handleAskSocratic(1)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-100 dark:bg-[#18181b] hover:bg-zinc-200 dark:hover:bg-[#1f1f23] text-amber-600 dark:text-amber-400 border border-zinc-200 dark:border-white/[0.07] font-medium text-[11px] cursor-pointer disabled:opacity-50 transition-colors duration-150"
                  >
                    Hint 1
                  </button>
                  <button
                    type="button"
                    disabled={loading || clueCoins < 1}
                    onClick={() => handleAskSocratic(2)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-100 dark:bg-[#18181b] hover:bg-zinc-200 dark:hover:bg-[#1f1f23] text-amber-600 dark:text-amber-400 border border-zinc-200 dark:border-white/[0.07] font-medium text-[11px] cursor-pointer disabled:opacity-50 transition-colors duration-150"
                  >
                    Hint 2
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleAskSocratic(undefined)}
                    className="btn-terracotta py-1.5 px-3 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    Ask
                  </button>
                </div>

                {aiReply && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] text-[11px] leading-relaxed space-y-2">
                    <MathRichText content={aiReply} />
                    {aiCitations.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1.5 border-t border-zinc-200 dark:border-white/[0.07] text-[10px] font-mono text-zinc-500">
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
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  15m Sprints · {matchedChapter.chapterName}
                </div>
                {shards.map((shard) => {
                  const done = !!completedShards[shard.id];
                  return (
                    <div
                      key={shard.id}
                      className="p-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#18181b] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-[#fafafa] flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {shard.title}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                          {shard.durationMinutes}m
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        {shard.activeRecallPrompt}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 truncate max-w-[180px]">
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
                              ? 'bg-emerald-600 text-white'
                              : 'btn-terracotta'
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
                  className="w-full py-3 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.14] bg-zinc-50 dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-zinc-800 dark:text-[#fafafa] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150"
                >
                  <Camera className="w-4 h-4 text-zinc-400" />
                  <span>Upload Question Image</span>
                </button>
                {ocrPreviewDataUrl && (
                  <div className="space-y-2">
                    <img
                      src={ocrPreviewDataUrl}
                      alt="Uploaded Doubt OCR Preview"
                      className="max-h-32 rounded-lg border border-zinc-200 dark:border-white/[0.07] mx-auto object-contain"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAskSocratic(undefined)}
                      className="w-full py-2 rounded-lg btn-terracotta font-semibold cursor-pointer transition-colors duration-150"
                    >
                      {loading ? 'Scanning...' : `Solve in ${language}`}
                    </button>
                  </div>
                )}
                {aiReply && (
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] text-[11px]">
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
