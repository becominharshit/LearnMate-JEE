import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CBTQuestion,
  ConvertedPaperPattern,
  ConvertedTestRecord,
  ConvertedTestSummary,
  ExamTrack,
  evaluateSingleQuestionMarks,
} from '../../utils/jeeEngine';
import {
  convertOfflinePaperBatchApi,
  extractPdfPagesForCbtConversion,
} from '../../services/workspaceService';
import { MathRichText } from '../MathRichText';

export interface OfflineTestToCbtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveConvertedTest: (record: ConvertedTestRecord) => Promise<void> | void;
  onSaveAndStartCbt: (record: ConvertedTestRecord) => Promise<void> | void;
}

interface CapturedPageItem {
  id: string;
  fileName: string;
  previewDataUrl: string;
  imageBase64: string;
  mimeType: string;
  sizeBytes: number;
}

function patternToExamTrack(pattern: ConvertedPaperPattern): ExamTrack {
  if (pattern === 'JEE Advanced +4/-2 Partial') return 'JEE Advanced';
  if (pattern === 'NEET +4/-1') return 'NEET UG';
  return 'JEE Main';
}

function computeSummary(questions: CBTQuestion[]): ConvertedTestSummary {
  let physicsCount = 0;
  let chemistryCount = 0;
  let mathematicsCount = 0;
  let biologyCount = 0;
  let maxMarks = 0;
  let needsReviewCount = 0;
  let diagramQuestionCount = 0;

  for (const q of questions) {
    if (q.subTrackLabel === 'Biology (Botany & Zoology)') {
      biologyCount += 1;
    } else if (q.subject === 'Physics') {
      physicsCount += 1;
    } else if (q.subject === 'Chemistry') {
      chemistryCount += 1;
    } else {
      mathematicsCount += 1;
    }
    if (q.keySource === 'needs_review') needsReviewCount += 1;
    if (q.hasDiagramReference) diagramQuestionCount += 1;
    maxMarks += evaluateSingleQuestionMarks(q).maxMarks;
  }

  return {
    physicsCount,
    chemistryCount,
    mathematicsCount,
    ...(biologyCount > 0 ? { biologyCount } : {}),
    totalQuestions: questions.length,
    maxMarks,
    needsReviewCount,
    diagramQuestionCount,
  };
}

/**
 * Compresses any photo > 4 MB or > 2000px onto an offscreen canvas (max 2000px JPEG).
 */
async function compressImageFileForPaper(
  file: File,
  maxDimensionPx = 2000
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Unable to read image "${file.name}".`));
      el.src = objectUrl;
    });

    const width = img.naturalWidth || img.width || 1200;
    const height = img.naturalHeight || img.height || 1600;
    const longest = Math.max(width, height, 1);
    const needsResize = longest > maxDimensionPx || file.size > 4 * 1024 * 1024;
    const scale = needsResize ? Math.min(1, maxDimensionPx / longest) : 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable in this browser.');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const quality = file.size > 4 * 1024 * 1024 ? 0.8 : 0.86;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1] || '';
    return { dataUrl, base64, mimeType: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const OfflineTestToCbtModal: React.FC<OfflineTestToCbtModalProps> = ({
  isOpen,
  onClose,
  onSaveConvertedTest,
  onSaveAndStartCbt,
}) => {
  const [inputMode, setInputMode] = useState<'pdf' | 'photos'>('pdf');
  const [testTitle, setTestTitle] = useState<string>('');
  const [pattern, setPattern] = useState<ConvertedPaperPattern>('JEE Main +4/-1');
  const [durationMinutes, setDurationMinutes] = useState<number>(180);

  // PDF input state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewInfo, setPdfPreviewInfo] = useState<{
    totalPages: number;
    scannedPagesCount: number;
  } | null>(null);

  // Multi-photo queue state
  const [capturedPages, setCapturedPages] = useState<CapturedPageItem[]>([]);
  const [compressingPhotos, setCompressingPhotos] = useState<boolean>(false);

  // Optional answer key state
  const [showKeySection, setShowKeySection] = useState<boolean>(false);
  const [keyMode, setKeyMode] = useState<'text' | 'file'>('text');
  const [answerKeyText, setAnswerKeyText] = useState<string>('');
  const [answerKeyFileName, setAnswerKeyFileName] = useState<string>('');
  const [answerKeyImages, setAnswerKeyImages] = useState<
    Array<{ imageBase64: string; mimeType: string }>
  >([]);

  // Conversion progress & abort controller
  const [converting, setConverting] = useState<boolean>(false);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pre-launch review state
  const [convertedRecord, setConvertedRecord] = useState<ConvertedTestRecord | null>(null);
  const [savingAction, setSavingAction] = useState<boolean>(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const keyFileInputRef = useRef<HTMLInputElement | null>(null);

  const canConvert = useMemo(() => {
    if (converting || compressingPhotos) return false;
    if (inputMode === 'pdf') return Boolean(pdfFile);
    return capturedPages.length > 0;
  }, [converting, compressingPhotos, inputMode, pdfFile, capturedPages.length]);

  if (!isOpen) return null;

  const resetAll = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConvertedRecord(null);
    setConverting(false);
    setProgressLabel('');
    setProgressPct(0);
    setErrorMsg(null);
  };

  const handleClose = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConverting(false);
    onClose();
  };

  const handleSelectPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    setPdfFile(file);
    setPdfPreviewInfo(null);
    if (!testTitle.trim()) {
      setTestTitle(file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 120));
    }
  };

  const handleAddPhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setCompressingPhotos(true);
    try {
      const additions: CapturedPageItem[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImageFileForPaper(file, 2000);
        additions.push({
          id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          previewDataUrl: compressed.dataUrl,
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          sizeBytes: file.size,
        });
      }
      if (additions.length === 0) {
        setErrorMsg('Select valid image files (JPG, PNG, WEBP).');
      } else {
        setCapturedPages((prev) => [...prev, ...additions].slice(0, 40));
        if (!testTitle.trim()) {
          setTestTitle('Photo Paper Mock');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to process selected photo(s).');
    } finally {
      setCompressingPhotos(false);
    }
  };

  const handleMovePage = (idx: number, delta: -1 | 1) => {
    setCapturedPages((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  };

  const handleRemovePage = (id: string) => {
    setCapturedPages((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSelectAnswerKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    setAnswerKeyFileName(file.name);

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const extracted = await extractPdfPagesForCbtConversion(file, {
          maxPages: 4,
          maxDimensionPx: 1600,
        });
        const combinedText = extracted.pages
          .map((p) => p.text)
          .filter(Boolean)
          .join('\n');
        if (combinedText.trim().length >= 15) {
          setAnswerKeyText(combinedText);
        }
        const scannedImgs = extracted.pages
          .filter((p) => p.isScanned && p.imageBase64)
          .map((p) => ({ imageBase64: p.imageBase64!, mimeType: p.mimeType }));
        setAnswerKeyImages(scannedImgs);
      } else if (file.type.startsWith('image/')) {
        const compressed = await compressImageFileForPaper(file, 1800);
        setAnswerKeyImages([{ imageBase64: compressed.base64, mimeType: compressed.mimeType }]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to parse attached answer key file.');
    }
  };

  const handleRunConversion = async () => {
    if (!canConvert) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setConverting(true);
    setErrorMsg(null);
    setConvertedRecord(null);
    setProgressPct(5);
    setProgressLabel('Preparing question paper pages...');

    try {
      const pageImagesByNumber: Record<number, string> = {};
      let preparedPages: Array<{
        pageNumber: number;
        text?: string;
        imageBase64?: string;
        mimeType?: string;
      }> = [];

      if (inputMode === 'pdf' && pdfFile) {
        const extracted = await extractPdfPagesForCbtConversion(pdfFile, {
          maxPages: 40,
          maxDimensionPx: 1800,
          signal: controller.signal,
          onProgress: (cur, total) => {
            setProgressLabel(`Reading PDF page ${cur} of ${total}...`);
            setProgressPct(Math.round(5 + (cur / Math.max(1, total)) * 25));
          },
        });
        setPdfPreviewInfo({
          totalPages: extracted.totalPages,
          scannedPagesCount: extracted.pages.filter((p) => p.isScanned).length,
        });
        preparedPages = extracted.pages.map((p) => {
          if (p.imageDataUrl) {
            pageImagesByNumber[p.pageNumber] = p.imageDataUrl;
          }
          return {
            pageNumber: p.pageNumber,
            ...(p.text ? { text: p.text } : {}),
            ...(p.isScanned && p.imageBase64
              ? { imageBase64: p.imageBase64, mimeType: p.mimeType }
              : {}),
          };
        });
      } else {
        preparedPages = capturedPages.map((p, idx) => {
          const pageNum = idx + 1;
          pageImagesByNumber[pageNum] = p.previewDataUrl;
          return {
            pageNumber: pageNum,
            imageBase64: p.imageBase64,
            mimeType: p.mimeType,
          };
        });
      }

      if (preparedPages.length === 0) {
        throw new Error('No pages found to convert.');
      }

      const totalPages = preparedPages.length;
      const batchSize = 3;
      const allQuestions: CBTQuestion[] = [];

      for (let i = 0; i < totalPages; i += batchSize) {
        controller.signal.throwIfAborted();
        const batch = preparedPages.slice(i, i + batchSize);
        const currentEndPage = Math.min(totalPages, i + batch.length);
        setProgressLabel(`Processing page ${currentEndPage} of ${totalPages}...`);
        setProgressPct(Math.round(30 + (i / totalPages) * 65));

        const res = await convertOfflinePaperBatchApi(
          {
            pages: batch,
            pattern,
            answerKeyText: answerKeyText.trim() || undefined,
            answerKeyImages: answerKeyImages.length > 0 ? answerKeyImages : undefined,
            questionNumberOffset: allQuestions.length,
          },
          controller.signal
        );

        if (!res.ok) {
          if (res.error.status === 401 || res.error.errorCode === 'AUTH_REQUIRED') {
            throw new Error(
              'Sign in with Google or Email (exit Demo Guest mode) to run Gemini AI paper conversion.'
            );
          }
          throw new Error(res.error.message || `Batch conversion failed at page ${currentEndPage}.`);
        }

        const batchQuestions = (res.data.questions || []).map((q) => {
          const srcPage = q.sourcePageNumber || batch[0].pageNumber;
          const diagramUrl =
            q.hasDiagramReference && pageImagesByNumber[srcPage]
              ? pageImagesByNumber[srcPage]
              : q.diagramImageUrl;
          return {
            ...q,
            ...(diagramUrl ? { diagramImageUrl: diagramUrl } : {}),
          };
        });

        allQuestions.push(...batchQuestions);
        setProgressPct(Math.round(30 + (currentEndPage / totalPages) * 65));
      }

      if (allQuestions.length === 0) {
        throw new Error(
          'No structured questions could be extracted from these pages. Check image clarity or try attaching higher-resolution pages.'
        );
      }

      // Normalize strictly sequential numbers across merged batches
      const renumberedQuestions: CBTQuestion[] = allQuestions.map((q, idx) => ({
        ...q,
        id: `conv-${Date.now().toString(36)}-q${idx + 1}`,
        number: idx + 1,
      }));

      const summary = computeSummary(renumberedQuestions);
      const nowIso = new Date().toISOString();
      const record: ConvertedTestRecord = {
        id: `converted-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: testTitle.trim() || `${pattern.split(' ')[0]} Offline Paper (${renumberedQuestions.length} Qs)`,
        pattern,
        examMode: patternToExamTrack(pattern),
        durationMinutes: Math.max(10, Math.min(360, Number(durationMinutes) || 180)),
        questions: renumberedQuestions,
        summary,
        sourceMode: inputMode,
        pageCount: totalPages,
        hasAttachedAnswerKey: Boolean(answerKeyText.trim() || answerKeyImages.length > 0),
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };

      setProgressPct(100);
      setProgressLabel(`Converted ${renumberedQuestions.length} questions!`);
      setConvertedRecord(record);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setErrorMsg('Conversion cancelled. You can adjust pages and retry anytime.');
      } else {
        setErrorMsg(err?.message || 'Unable to convert offline paper.');
      }
    } finally {
      setConverting(false);
      abortControllerRef.current = null;
    }
  };

  const handleSaveOnly = async () => {
    if (!convertedRecord || savingAction) return;
    setSavingAction(true);
    try {
      await onSaveConvertedTest(convertedRecord);
      resetAll();
      onClose();
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveAndStart = async () => {
    if (!convertedRecord || savingAction) return;
    setSavingAction(true);
    try {
      await onSaveAndStartCbt(convertedRecord);
      resetAll();
      onClose();
    } finally {
      setSavingAction(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-cbt-modal-title"
    >
      <div className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.1] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-white/[0.08] flex items-center justify-between gap-3 bg-[#F8FAFF] dark:bg-[#0D1322]">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
              Offline Paper → Proctored CBT
            </span>
            <h2
              id="offline-cbt-modal-title"
              className="text-base sm:text-lg font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]"
            >
              Convert PDF or Multi-Photo Paper into Mock Test
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close offline test converter"
            onClick={handleClose}
            className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#EEF2FF] dark:hover:bg-[#1E293B] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {convertedRecord ? (
            /* PRE-LAUNCH REVIEW SUMMARY */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#00A86B]/10 border border-[#00A86B]/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00A86B] shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      Converted Paper Summary — {convertedRecord.title}
                    </div>
                    <div className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-0.5 tabular-nums">
                      Physics {convertedRecord.summary.physicsCount} Qs · Chemistry{' '}
                      {convertedRecord.summary.chemistryCount} Qs · Mathematics{' '}
                      {convertedRecord.summary.mathematicsCount} Qs
                      {convertedRecord.summary.biologyCount
                        ? ` · Biology ${convertedRecord.summary.biologyCount} Qs`
                        : ''}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.1] text-[#0F172A] dark:text-[#F8FAFC]">
                    {convertedRecord.summary.totalQuestions} Qs · {convertedRecord.summary.maxMarks} Marks
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-[#2563EB]/10 border border-[#2563EB]/25 text-[#2563EB] dark:text-[#60A5FA]">
                    {convertedRecord.durationMinutes} mins
                  </span>
                </div>
              </div>

              {convertedRecord.summary.needsReviewCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-semibold">
                      {convertedRecord.summary.needsReviewCount} question(s) flagged{' '}
                      <code>needs_review</code>
                    </strong>{' '}
                    due to blurry/partial scan or missing answer key. You can still take the CBT mock; flagged questions are marked cleanly during review.
                  </span>
                </div>
              )}

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {convertedRecord.questions.map((q) => (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/60 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                      <span className="text-[#2563EB] dark:text-[#60A5FA] tabular-nums">
                        Q{q.number} · {q.subTrackLabel || q.subject} · {q.chapter}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {q.hasDiagramReference && (
                          <span className="px-2 py-0.5 rounded bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] border border-[#7C3AED]/25">
                            Diagram Attached (p.{q.sourcePageNumber})
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            q.keySource === 'official_key_attached'
                              ? 'bg-[#00A86B]/10 border-[#00A86B]/25 text-[#00A86B]'
                              : q.keySource === 'needs_review'
                              ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
                              : 'bg-[#2563EB]/10 border-[#2563EB]/25 text-[#2563EB] dark:text-[#60A5FA]'
                          }`}
                        >
                          {q.keySource === 'official_key_attached'
                            ? 'Official Key'
                            : q.keySource === 'needs_review'
                            ? 'needs_review'
                            : 'AI Verified'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-[#0F172A] dark:text-[#F8FAFC] line-clamp-3">
                      <MathRichText content={q.stem} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* INPUT & SETTINGS FORM */
            <>
              {/* Input Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.06]">
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => setInputMode('pdf')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    inputMode === 'pdf'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Upload Question Paper PDF</span>
                </button>
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => setInputMode('photos')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    inputMode === 'photos'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Click / Upload Multi-Page Photos</span>
                </button>
              </div>

              {/* Mode 1: PDF Upload */}
              {inputMode === 'pdf' && (
                <div className="p-4 rounded-xl border border-dashed border-[#CBD5E1] dark:border-white/[0.15] bg-[#F8FAFF] dark:bg-[#1E293B]/40 space-y-3">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleSelectPdf}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                        {pdfFile ? pdfFile.name : 'Select an Allen / Resonance / Coaching / NTA PDF'}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Supports both text-layer PDFs and scanned image PDFs (up to 40 pages).
                        {pdfPreviewInfo
                          ? ` • ${pdfPreviewInfo.totalPages} pages (${pdfPreviewInfo.scannedPagesCount} scanned)`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={converting}
                      onClick={() => pdfInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{pdfFile ? 'Change PDF' : 'Choose PDF File'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2: Multi-Shot Camera Queue */}
              {inputMode === 'photos' && (
                <div className="space-y-3">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      void handleAddPhotoFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      void handleAddPhotoFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={converting || compressingPhotos}
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>
                        {capturedPages.length > 0 ? 'Add Another Page (Camera)' : 'Take Photo (Add Page)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={converting || compressingPhotos}
                      onClick={() => galleryInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-white/[0.14] bg-white dark:bg-[#1E293B] hover:bg-[#EEF2FF] dark:hover:bg-[#283548] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload Photos</span>
                    </button>
                    {compressingPhotos && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Compressing photos...
                      </span>
                    )}
                  </div>

                  {capturedPages.length === 0 ? (
                    <div className="p-5 rounded-xl border border-dashed border-[#CBD5E1] dark:border-white/[0.15] text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                      No pages captured yet. Click multiple photos in sequence or upload multiple page images (&gt;4MB auto-compressed to JPEG).
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                        Captured Pages Queue ({capturedPages.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                        {capturedPages.map((page, idx) => (
                          <div
                            key={page.id}
                            className="p-2.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]/60 flex items-center gap-3"
                          >
                            <img
                              src={page.previewDataUrl}
                              alt={`Captured page ${idx + 1}`}
                              className="w-12 h-14 object-cover rounded-lg border border-[#E2E8F0] dark:border-white/[0.1] shrink-0 bg-white"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                                Page {idx + 1}
                              </div>
                              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                                {page.fileName}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                aria-label={`Move Page ${idx + 1} up`}
                                disabled={idx === 0 || converting}
                                onClick={() => handleMovePage(idx, -1)}
                                className="p-1.5 rounded-md border border-[#E2E8F0] dark:border-white/[0.1] text-[#475569] dark:text-[#CBD5E1] disabled:opacity-35 hover:bg-white dark:hover:bg-[#111827] cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Move Page ${idx + 1} down`}
                                disabled={idx === capturedPages.length - 1 || converting}
                                onClick={() => handleMovePage(idx, 1)}
                                className="p-1.5 rounded-md border border-[#E2E8F0] dark:border-white/[0.1] text-[#475569] dark:text-[#CBD5E1] disabled:opacity-35 hover:bg-white dark:hover:bg-[#111827] cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove Page ${idx + 1}`}
                                disabled={converting}
                                onClick={() => handleRemovePage(page.id)}
                                className="p-1.5 rounded-md border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Exam Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="converted-test-title"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                  >
                    Test Title
                  </label>
                  <input
                    id="converted-test-title"
                    type="text"
                    disabled={converting}
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="e.g. Allen Major Test #4"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.12] bg-white dark:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label
                    htmlFor="converted-exam-pattern"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                  >
                    Exam Pattern
                  </label>
                  <select
                    id="converted-exam-pattern"
                    disabled={converting}
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value as ConvertedPaperPattern)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.12] bg-white dark:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="JEE Main +4/-1">JEE Main +4/-1</option>
                    <option value="JEE Advanced +4/-2 Partial">JEE Advanced +4/-2 Partial</option>
                    <option value="NEET +4/-1">NEET +4/-1</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label
                    htmlFor="converted-test-duration"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                  >
                    Duration (mins)
                  </label>
                  <input
                    id="converted-test-duration"
                    type="number"
                    min={10}
                    max={360}
                    disabled={converting}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value || 180))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.12] bg-white dark:bg-[#1E293B] text-xs font-medium tabular-nums text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              {/* Optional Answer Key Attachment */}
              <div className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowKeySection((v) => !v)}
                  className="w-full px-4 py-2.5 bg-[#F8FAFF] dark:bg-[#1E293B]/60 flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-[#00A86B]" />
                    <span>Attach Answer Key (Optional — takes strict precedence over AI)</span>
                  </span>
                  <span className="text-[11px] text-[#2563EB] dark:text-[#60A5FA]">
                    {answerKeyText.trim() || answerKeyImages.length > 0
                      ? 'Attached ✓'
                      : showKeySection
                      ? 'Hide'
                      : 'Add Key'}
                  </span>
                </button>

                {showKeySection && (
                  <div className="p-4 space-y-3 border-t border-[#E2E8F0] dark:border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setKeyMode('text')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          keyMode === 'text'
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                        }`}
                      >
                        Paste Key Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeyMode('file')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          keyMode === 'file'
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                        }`}
                      >
                        Upload Key PDF / Photo
                      </button>
                    </div>

                    {keyMode === 'text' ? (
                      <textarea
                        rows={3}
                        disabled={converting}
                        value={answerKeyText}
                        onChange={(e) => setAnswerKeyText(e.target.value)}
                        placeholder="Example: 1. A  2. C  3. 4.5  4. B,D  5. (D)"
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.12] bg-white dark:bg-[#1E293B] text-xs font-mono text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                      />
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08]">
                        <input
                          ref={keyFileInputRef}
                          type="file"
                          accept="application/pdf,.pdf,image/*"
                          onChange={handleSelectAnswerKeyFile}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#CBD5E1]">
                          <ImageIcon className="w-4 h-4 text-[#7C3AED]" />
                          <span>
                            {answerKeyFileName
                              ? `Attached: ${answerKeyFileName}`
                              : 'Upload answer key PDF or photo'}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={converting}
                          onClick={() => keyFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-white/[0.14] bg-white dark:bg-[#111827] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
                        >
                          Choose File
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {converting && (
                <div className="p-4 rounded-xl bg-[#2563EB]/[0.07] border border-[#2563EB]/25 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                      {progressLabel}
                    </span>
                    <span className="tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-[#1E293B] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#00A86B] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#0D1322] flex flex-wrap items-center justify-between gap-3">
          {convertedRecord ? (
            <>
              <button
                type="button"
                disabled={savingAction}
                onClick={resetAll}
                className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-white/[0.14] text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#1E293B] cursor-pointer"
              >
                ← Convert Another Paper
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={() => void handleSaveOnly()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-white/[0.14] bg-white dark:bg-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Only</span>
                </button>
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={() => void handleSaveAndStart()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Save &amp; Start CBT Mock →</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (converting) {
                    abortControllerRef.current?.abort();
                  } else {
                    handleClose();
                  }
                }}
                className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-white/[0.14] text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#1E293B] cursor-pointer"
              >
                {converting ? 'Cancel Conversion' : 'Close'}
              </button>
              <button
                type="button"
                disabled={!canConvert}
                onClick={() => void handleRunConversion()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-brand disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
              >
                {converting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Converting Paper...</span>
                  </>
                ) : (
                  <span>Convert to Proctored CBT →</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
