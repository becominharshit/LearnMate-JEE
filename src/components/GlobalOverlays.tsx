import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  Youtube,
  Type as TypeIcon,
  Link2,
  Clock,
  Calculator,
  Ruler,
  BarChart2,
  Sigma,
  TrendingUp,
  ZoomIn,
  ZoomOut,
  Hand,
  Music,
  Play,
  Pause,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FolderOpen,
  AlertTriangle,
  ShieldCheck,
  Download,
  LogOut,
  Flame,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Table,
  History,
  Square,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  evaluateMathFunction,
  evaluateMathDetailed,
  validateMathSyntax,
  AngleMode,
  evaluateDerivative,
  detectEquationParameters,
  findRootsAndExtrema,
  findCurveIntersections,
  computeCombination,
  computePermutation,
  computeFactorial,
  computeDeterminant3x3,
  computeVectorOps,
  calculateStatistics,
  detectJeeSubjectAndChapter,
  CBTQuestion,
  GraphSpecialPoint,
} from '../utils/jeeEngine';
import {
  listDriveStudyFiles,
  readGoogleDocContent,
  DriveFileItem,
  saveDocumentToIndexedDb,
  extractPdfTextAndMetadataWithPdfJs,
  extractScannedPdfPagesViaOcr,
  apiFetchWithAuth,
  ingestYouTubeOnServer,
  reportQuestionIssueOnServer,
  verifySinglePyqAnswerOnServer,
  requestSignedCloudStorageUrl,
  confirmCloudUpload,
} from '../services/workspaceService';
import { wsUrl } from '../config/apiConfig';
import {
  getDaysToJeeMain2027Session1,
  GLOBAL_PPP_PRICING,
  SupportedCurrency,
} from '../config/examSpecs';
import { CBT_MOCK_QUESTIONS } from '../data/jeeInitialContent';
import {
  googleSignIn,
  getWorkspaceAccessToken,
  registerActiveVoiceSocket,
  getFirebaseIdToken,
} from '../firebase';
import { LegalModalTabId } from './LandingAndAuth';
import { MathRichText } from './MathRichText';

// ============================================================================
// 1. Add Material Modal (Clean Zero-State + Auto Subject/Chapter Detection + Up to 12-Hour YouTube Marathon + Handwritten OCR)
// ============================================================================
interface AddMaterialModalProps {
  isOpen: boolean;
  initialTab?: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  onClose: () => void;
  onAddMaterial: (item: {
    title: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
    sourceRef: string;
    contentSummary: string;
    originalFileUrl?: string;
    originalMimeType?: string;
  }) => Promise<void>;
}

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  initialTab = 'youtube',
  onClose,
  onAddMaterial,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'photo' | 'youtube' | 'text' | 'drive'>(
    initialTab
  );
  // Strictly empty by default — no preloaded link or fake spinner
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [lectureDurationHours, setLectureDurationHours] = useState<number>(3);
  const [transcriptOrOutline, setTranscriptOrOutline] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorText(null);
    setAnalyzing(false);
    setStatusMessage('');
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const hasTypedContext = Boolean(
    titleInput.trim() || youtubeUrl.trim() || transcriptOrOutline.trim() || pastedText.trim()
  );
  const liveDetected = detectJeeSubjectAndChapter(
    `${youtubeUrl} ${transcriptOrOutline} ${pastedText}`,
    titleInput
  );

  const handleAnalyzeYouTube = async () => {
    if (!youtubeUrl.trim() && !transcriptOrOutline.trim()) {
      setErrorText('Please enter a YouTube lecture URL or paste a lecture transcript/outline.');
      return;
    }
    setErrorText(null);
    setAnalyzing(true);
    setStatusMessage(
      'Validating YouTube video ID and verifying authorized captions or pasted transcript...'
    );
    try {
      const ingestRes = await ingestYouTubeOnServer({
        url: youtubeUrl.trim(),
        transcriptText: transcriptOrOutline.trim(),
        title: titleInput.trim() || undefined,
      });

      if (!ingestRes.ok) {
        const metaTitle = (ingestRes.data as any)?.metadata?.title
          ? ` (${(ingestRes.data as any).metadata.title})`
          : '';
        setErrorText(
          `[${ingestRes.error.errorCode}] ${ingestRes.error.message}${metaTitle}`
        );
        return;
      }

      const verifiedTranscript = String(
        (ingestRes.data as any).transcriptText || transcriptOrOutline.trim()
      );
      const ytTitle =
        titleInput.trim() ||
        String((ingestRes.data as any).metadata?.title || '').trim() ||
        detectJeeSubjectAndChapter(verifiedTranscript, titleInput).chapter;

      setStatusMessage(
        `Structuring verified transcript into chapter notes, formulas & mind map (${lectureDurationHours}h lecture)...`
      );

      const initialDetection = detectJeeSubjectAndChapter(
        `${youtubeUrl} ${verifiedTranscript}`,
        ytTitle
      );

      let extractedAiText = '';
      if (verifiedTranscript.length >= 20) {
        const aiRes = await apiFetchWithAuth<{ text?: string }>('/api/ai/analyze', {
          youtubeUrl: youtubeUrl.trim() || undefined,
          lectureDurationHours,
          transcriptOrOutline: verifiedTranscript.slice(0, 12000),
          sourceType: 'youtube',
          prompt: `Structure these verified lecture transcript segments for "${initialDetection.chapter}" into chapter notes, derivations, and equations without inventing external facts.`,
        });
        if (aiRes.ok && aiRes.data.text) {
          extractedAiText = aiRes.data.text;
        }
      }

      const finalDetection = detectJeeSubjectAndChapter(
        `${youtubeUrl} ${verifiedTranscript} ${extractedAiText}`,
        ytTitle
      );

      await onAddMaterial({
        title: ytTitle,
        subject: finalDetection.subject,
        chapter: finalDetection.chapter,
        sourceType: 'youtube',
        sourceRef: youtubeUrl.trim() || `YouTube Transcript`,
        originalFileUrl: youtubeUrl.trim() || undefined,
        originalMimeType: 'video/youtube',
        contentSummary: extractedAiText
          ? `${verifiedTranscript}\n\n---\n### Structured Lecture Synthesis\n${extractedAiText}`
          : verifiedTranscript,
      });
      setYoutubeUrl('');
      setTranscriptOrOutline('');
      setTitleInput('');
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to ingest YouTube lecture.');
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'pdf' | 'photo'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorText(null);
    setAnalyzing(true);
    setStatusMessage(
      mode === 'photo'
        ? `Auto-detecting JEE subject & chapter and running Handwritten Notes Scan on ${file.name}...`
        : `Parsing ${file.name} via local pdf.js worker & storing binary in IndexedDB...`
    );

    try {
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          resolve(String(reader.result || ''));
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const fullDataUrl = await dataUrlPromise;
      const base64Data = fullDataUrl.split(',')[1] || '';

      let clientPdfText = '';
      let pdfPageCount = 1;
      let ocrNotesSummary = '';

      if (mode === 'pdf' && file.name.toLowerCase().endsWith('.pdf')) {
        const extractedPdf = await extractPdfTextAndMetadataWithPdfJs(
          file,
          (pct, cur, total) =>
            setStatusMessage(`Extracting PDF page ${cur}/${total} (${pct}%)...`)
        );
        if (extractedPdf.extractionError) {
          setErrorText(extractedPdf.extractionError);
          setAnalyzing(false);
          setStatusMessage('');
          return;
        }
        clientPdfText = extractedPdf.extractedText;
        pdfPageCount = extractedPdf.pageCount;

        if (extractedPdf.scannedPageNumbers.length > 0) {
          setStatusMessage(
            `Running vision OCR on ${Math.min(60, extractedPdf.scannedPageNumbers.length)} scanned page(s)...`
          );
          const { ocrTextByPage } = await extractScannedPdfPagesViaOcr(
            file,
            extractedPdf.scannedPageNumbers,
            (done, total) =>
              setStatusMessage(`Running vision OCR on scanned PDF pages (${done}/${total})...`)
          );
          if (ocrTextByPage.size > 0) {
            const existingBlocks = new Map<number, string>();
            for (const block of clientPdfText.split(/\n{2,}/)) {
              const m = /^\[Page\s+(\d+)\]/i.exec(block.trim());
              if (m) existingBlocks.set(Number(m[1]), block.trim());
            }
            for (const [pgNum, txt] of ocrTextByPage.entries()) {
              existingBlocks.set(pgNum, txt);
            }
            clientPdfText = Array.from(existingBlocks.entries())
              .sort((a, b) => a[0] - b[0])
              .map((entry) => entry[1])
              .join('\n\n');
            ocrNotesSummary = `Vision OCR completed on ${ocrTextByPage.size} scanned page(s).`;
          }
        }
      }

      const detectedMime = file.type || (mode === 'pdf' ? 'application/pdf' : 'image/jpeg');
      const docId = `idb-doc-${Date.now()}`;
      await saveDocumentToIndexedDb({
        id: docId,
        userId: 'active_user',
        file,
        title: file.name,
        mimeType: detectedMime,
        dataUrl: fullDataUrl,
        extractedText: clientPdfText,
        pageCount: pdfPageCount,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      });

      // Best-effort owner-scoped Cloud Storage upload when bucket is configured
      try {
        const ticket = await requestSignedCloudStorageUrl({
          fileName: file.name,
          mimeType: detectedMime,
          operation: 'upload',
          sizeBytes: file.size,
        });
        if (ticket.ok && ticket.storageConfigured && ticket.signedUrl && ticket.assetId) {
          const putRes = await fetch(ticket.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': detectedMime },
            body: file,
          });
          if (putRes.ok) {
            await confirmCloudUpload(ticket.assetId);
          }
        }
      } catch {
        // Cloud Storage optional in local dev; IndexedDB holds full document safely
      }

      const fileStem = file.name.replace(/\.[^/.]+$/, '');
      const initialDetection = detectJeeSubjectAndChapter(
        `${fileStem} ${clientPdfText.slice(0, 2000)}`,
        titleInput
      );

      let aiText = '';
      if (mode === 'photo' || clientPdfText.trim().length < 80) {
        const { ok, data } = await apiFetchWithAuth<{ text?: string }>(
          '/api/ai/analyze',
          {
            mediaBase64: base64Data.slice(0, 600000),
            mimeType: detectedMime,
            sourceType: mode,
            prompt: `Automatically identify whether this material belongs to JEE Physics, Chemistry, or Mathematics and which chapter it covers, then extract concise notes for "${initialDetection.chapter}" from ${file.name}.\n\nExtracted Text Context:\n${clientPdfText.slice(0, 4000)}`,
          }
        );
        aiText = ok ? data.text || '' : '';
      }

      const finalDetection = detectJeeSubjectAndChapter(
        `${fileStem} ${clientPdfText.slice(0, 2000)} ${aiText}`,
        titleInput
      );

      await onAddMaterial({
        title: titleInput.trim() || finalDetection.chapter || file.name,
        subject: finalDetection.subject,
        chapter: finalDetection.chapter,
        sourceType: mode,
        sourceRef: file.name,
        originalFileUrl: fullDataUrl,
        originalMimeType: detectedMime,
        contentSummary: clientPdfText
          ? aiText
            ? `${clientPdfText}\n\n---\n### AI Extracted Notes\n${aiText}`
            : ocrNotesSummary
            ? `${clientPdfText}\n\n<!-- ${ocrNotesSummary} -->`
            : clientPdfText
          : aiText ||
            `**${finalDetection.chapter}** (${finalDetection.subject}): IndexedDB-stored document (${pdfPageCount} pages) from ${file.name}. Needs OCR or text extraction.`,
      });
      setTitleInput('');
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Could not analyze uploaded file.');
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) {
      setErrorText('Please paste your study text, handwritten transcription, or formulas first.');
      return;
    }
    setAnalyzing(true);
    setStatusMessage(
      'Auto-identifying JEE subject & chapter and structuring your notes into full detailed pages, flashcards & mind map...'
    );
    try {
      const detected = detectJeeSubjectAndChapter(pastedText, titleInput);
      await onAddMaterial({
        title: titleInput.trim() || detected.chapter,
        subject: detected.subject,
        chapter: detected.chapter,
        sourceType: 'text',
        sourceRef: 'Uploaded Notes',
        contentSummary: pastedText.trim(),
      });
      setTitleInput('');
      setPastedText('');
      onClose();
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
    }
  };

  const handleLoadDriveFiles = async () => {
    setDriveLoading(true);
    setErrorText(null);
    try {
      const files = await listDriveStudyFiles();
      setDriveFiles(files);
    } catch (err: any) {
      setErrorText(err?.message || 'Could not fetch Google Drive files.');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleImportDriveFile = async (file: DriveFileItem) => {
    setAnalyzing(true);
    setStatusMessage(`Auto-detecting subject & importing "${file.name}" from Google Workspace...`);
    try {
      let summary = `**${file.name}** imported from Google Drive.`;
      if (file.mimeType.includes('document')) {
        const docContent = await readGoogleDocContent(file.id);
        summary = docContent.text;
      }
      const detected = detectJeeSubjectAndChapter(`${file.name} ${summary}`, titleInput);
      await onAddMaterial({
        title: titleInput.trim() || file.name,
        subject: detected.subject,
        chapter: detected.chapter,
        sourceType: 'drive',
        sourceRef: file.id,
        contentSummary: summary,
      });
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to import file from Google Drive/Docs.');
    } finally {
      setAnalyzing(false);
      setStatusMessage('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Material"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold tracking-[-0.02em] text-xl text-zinc-900 dark:text-zinc-50">
              Add Study Material
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              PDFs, note photos (OCR), or YouTube lectures — subject &amp; chapter auto-detected.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add Material modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#18181b] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-Subject & Chapter Identification Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-zinc-50 dark:bg-[#18181b] p-3 rounded-xl border border-zinc-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {hasTypedContext
                ? liveDetected.confidenceLabel
                : 'AI Auto-Identifies Subject & JEE Chapter'}
            </span>
          </div>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Optional: Custom title or topic hint"
            className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#111113] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
          />
        </div>

        {/* Top Source Tabs */}
        <div
          role="tablist"
          aria-label="Material upload sources"
          className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 dark:border-white/[0.07] pb-2"
        >
          {[
            { id: 'pdf', label: 'PDF Document', icon: FileText },
            { id: 'photo', label: 'Photo OCR', icon: ImageIcon },
            { id: 'youtube', label: 'YouTube (≤12h)', icon: Youtube },
            { id: 'text', label: 'Paste Notes', icon: TypeIcon },
            { id: 'drive', label: 'Google Drive', icon: FolderOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] dark:bg-[#F5F0E6] dark:text-[#09090B] dark:border-[#F5F0E6]'
                    : 'text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-100 dark:hover:bg-[#18181b] hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        {activeTab === 'youtube' && (
          <div className="space-y-3.5">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Link2 className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Paste YouTube lecture or marathon URL"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAnalyzeYouTube}
                disabled={analyzing}
                className="px-5 py-2.5 rounded-xl btn-terracotta disabled:opacity-50 font-semibold text-sm transition-colors cursor-pointer shrink-0"
              >
                {analyzing ? 'Extracting...' : 'Extract Lecture'}
              </button>
            </div>

            {/* Lecture Duration Selector up to 12 Hours */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                Lecture Length:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { hrs: 1, label: '1h Lecture' },
                  { hrs: 3, label: '3h One-Shot' },
                  { hrs: 6, label: '6h Revision' },
                  { hrs: 12, label: '12h Full Marathon' },
                ].map((d) => (
                  <button
                    key={d.hrs}
                    type="button"
                    onClick={() => setLectureDurationHours(d.hrs)}
                    className={`px-2.5 py-1 rounded-lg font-semibold border cursor-pointer transition-colors ${
                      lectureDurationHours === d.hrs
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#18181b]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={transcriptOrOutline}
              onChange={(e) => setTranscriptOrOutline(e.target.value)}
              placeholder="Optional: Paste lecture chapters, timestamps, or key topics covered..."
              className="w-full p-3 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-zinc-50/60 dark:bg-[#18181b] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
            />
          </div>
        )}

        {activeTab === 'pdf' && (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-300 dark:border-white/[0.15] rounded-xl hover:border-zinc-500 dark:hover:border-white/[0.3] transition-colors cursor-pointer bg-zinc-50/60 dark:bg-[#18181b]/60">
              <FileText className="w-8 h-8 text-zinc-700 dark:text-zinc-300 mb-2" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Upload JEE Chapter PDF or Scan (up to 60 pages)
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-center">
                Generates Detailed Notes, Original PDF Viewer, Mind Map, Flashcards, Formula Book &amp; Quiz
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileChange(e, 'pdf')}
                className="hidden"
              />
            </label>
          </div>
        )}

        {activeTab === 'photo' && (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-300 dark:border-white/[0.15] rounded-xl hover:border-zinc-500 dark:hover:border-white/[0.3] transition-colors cursor-pointer bg-zinc-50/60 dark:bg-[#18181b]/60">
              <ImageIcon className="w-8 h-8 text-zinc-700 dark:text-zinc-300 mb-2" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Upload Handwritten Notes Photo for OCR
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-center">
                Extracts handwriting, formats LaTeX equations, and enables 4 handwriting styles
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'photo')}
                className="hidden"
              />
            </label>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your JEE notes, reactions, or derivations ($...$ equations supported)..."
              className="w-full p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-zinc-50/60 dark:bg-[#18181b] text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed focus:outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={handlePasteSubmit}
              disabled={analyzing}
              className="px-5 py-2.5 rounded-lg btn-terracotta text-xs font-semibold cursor-pointer transition-colors"
            >
              Generate Study Bundle (Notes, Mind Map &amp; Flashcards)
            </button>
          </div>
        )}

        {activeTab === 'drive' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                Import PDFs and Google Docs directly from Google Drive:
              </span>
              <button
                type="button"
                onClick={handleLoadDriveFiles}
                disabled={driveLoading}
                className="px-3.5 py-1.5 rounded-lg btn-terracotta text-xs font-semibold cursor-pointer transition-colors"
              >
                {driveLoading ? 'Loading Drive...' : 'Browse Google Drive'}
              </button>
            </div>
            {driveFiles.length > 0 ? (
              <div className="max-h-44 overflow-y-auto divide-y divide-zinc-200 dark:divide-white/[0.06] border border-zinc-200 dark:border-white/[0.08] rounded-xl">
                {driveFiles.map((df) => (
                  <div
                    key={df.id}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-zinc-50 dark:hover:bg-[#18181b]"
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[320px]">
                      {df.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleImportDriveFile(df)}
                      className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-[#1f1f23] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 font-semibold hover:bg-zinc-200 dark:hover:bg-[#27272a] cursor-pointer"
                    >
                      Import
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4 text-center">
                Click “Browse Google Drive” to list your study PDFs and Google Docs.
              </p>
            )}
          </div>
        )}

        {/* ONLY show progress bar when analyzing === true */}
        {analyzing && (
          <div className="px-4 py-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-[#D4653B] border-t-transparent animate-spin shrink-0" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {statusMessage || 'Analyzing material...'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnalyzing(false);
                setStatusMessage('');
              }}
              className="px-3 py-1 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.1] text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {errorText && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300">
            {errorText}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. Study Tools Slide-Over Drawer (Desmos Graphing Calculator + Offline Scientific Calculator)
// ============================================================================
interface StudyToolsDrawerProps {
  isOpen: boolean;
  initialTab?: 'Calculator' | 'Units' | 'Statistics' | 'Formulas' | 'Graph';
  onClose: () => void;
}

interface GraphEquationItem {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
  showDerivative: boolean;
}

const GRAPH_COLORS = ['#D4653B', '#3B82F6', '#10B981', '#EF4444', '#F59E0B'];

export const StudyToolsDrawer: React.FC<StudyToolsDrawerProps> = ({
  isOpen,
  initialTab = 'Graph',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'Calculator' | 'Units' | 'Statistics' | 'Formulas' | 'Graph'
  >(initialTab);

  // Desmos-Inspired Multi-Equation State
  const [equations, setEquations] = useState<GraphEquationItem[]>([
    {
      id: 'eq-1',
      expr: 'y = a * x^2 - 4',
      color: '#3B82F6',
      visible: true,
      showDerivative: false,
    },
    {
      id: 'eq-2',
      expr: 'y = m * x + c',
      color: '#10B981',
      visible: true,
      showDerivative: false,
    },
  ]);
  const [sliderParams, setSliderParams] = useState<Record<string, number>>({
    a: 1,
    b: 1,
    c: -1,
    m: 1.5,
    k: 1,
  });
  const [animatingParam, setAnimatingParam] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<GraphSpecialPoint | null>(null);
  const [showTableOfValues, setShowTableOfValues] = useState<boolean>(false);
  const [tableXValues, setTableXValues] = useState<number[]>([-2, -1, 0, 1, 2]);

  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-10);
  const [yMax, setYMax] = useState(10);
  const [zoomPct, setZoomPct] = useState(100);
  const [panMode, setPanMode] = useState(true);

  // Offline Scientific Calculator State
  const [calcExpr, setCalcExpr] = useState('2 * sin(pi / 6) + sqrt(16)');
  const [calcResult, setCalcResult] = useState<string>('5');
  const [angleMode, setAngleMode] = useState<'RAD' | 'DEG'>('RAD');
  const [calcSubMode, setCalcSubMode] = useState<'standard' | 'combinatorics' | 'matrix' | 'vectors'>('standard');

  // Combinatorics state
  const [combN, setCombN] = useState(10);
  const [combR, setCombR] = useState(3);

  // 3x3 Matrix state
  const [matrix3x3, setMatrix3x3] = useState<number[][]>([
    [2, -1, 3],
    [1, 4, -2],
    [0, 5, 1],
  ]);

  // 3D Vectors state
  const [vecA, setVecA] = useState<[number, number, number]>([2, 3, -1]);
  const [vecB, setVecB] = useState<[number, number, number]>([1, -2, 4]);

  // Units Converter State
  const [unitCategory, setUnitCategory] = useState<'Energy' | 'Pressure' | 'Angle'>('Energy');
  const [unitInputVal, setUnitInputVal] = useState<number>(1);

  // Statistics State
  const [statsRaw, setStatsRaw] = useState('12, 15, 18, 22, 25, 28');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Animate parameter slider if playing
  useEffect(() => {
    if (!animatingParam) return;
    const interval = setInterval(() => {
      setSliderParams((prev) => {
        const curr = prev[animatingParam] ?? 1;
        const next = curr >= 4 ? -4 : Number((curr + 0.2).toFixed(2));
        return { ...prev, [animatingParam]: next };
      });
    }, 120);
    return () => clearInterval(interval);
  }, [animatingParam]);

  if (!isOpen) return null;

  // Detect all active parameters across equations
  const activeParamNames = Array.from(
    new Set(equations.flatMap((eq) => detectEquationParameters(eq.expr)))
  );

  // Build SVG polyline points for graphing calculator
  const scaleFactor = zoomPct / 100;
  const effXMin = xMin / scaleFactor;
  const effXMax = xMax / scaleFactor;
  const effYMin = yMin / scaleFactor;
  const effYMax = yMax / scaleFactor;

  const svgWidth = 560;
  const svgHeight = 350;
  const pad = 32;
  const plotW = svgWidth - pad * 2;
  const plotH = svgHeight - pad * 2;

  const toScreenX = (x: number) =>
    pad + ((x - effXMin) / Math.max(0.001, effXMax - effXMin)) * plotW;
  const toScreenY = (y: number) =>
    pad + plotH - ((y - effYMin) / Math.max(0.001, effYMax - effYMin)) * plotH;

  const parsedAngleMode: AngleMode = angleMode === 'DEG' ? 'deg' : 'rad';

  const buildCurvePath = (expr: string, isDerivative = false) => {
    const pts: string[] = [];
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const x = effXMin + (i / steps) * (effXMax - effXMin);
      const y = isDerivative
        ? evaluateDerivative(expr, x, sliderParams, parsedAngleMode)
        : evaluateMathFunction(expr, x, sliderParams, parsedAngleMode);
      if (y !== null && y >= effYMin * 1.4 && y <= effYMax * 1.4) {
        const sx = toScreenX(x).toFixed(1);
        const sy = toScreenY(y).toFixed(1);
        pts.push(`${pts.length === 0 ? 'M' : 'L'} ${sx} ${sy}`);
      }
    }
    return pts.join(' ');
  };

  // Compute Desmos-style Roots, Extrema & Intersections
  const specialPoints: GraphSpecialPoint[] = [];
  const visibleEqs = equations.filter((e) => e.visible && e.expr.trim());
  visibleEqs.forEach((eq) => {
    const pts = findRootsAndExtrema(eq.expr, effXMin, effXMax, sliderParams, parsedAngleMode);
    pts.forEach((p) => {
      if (p.y >= effYMin && p.y <= effYMax) {
        specialPoints.push(p);
      }
    });
  });
  if (visibleEqs.length >= 2) {
    const inters = findCurveIntersections(
      visibleEqs[0].expr,
      visibleEqs[1].expr,
      effXMin,
      effXMax,
      sliderParams,
      parsedAngleMode
    );
    inters.forEach((p) => {
      if (p.y >= effYMin && p.y <= effYMax) {
        specialPoints.push(p);
      }
    });
  }

  const evaluateScientificExpr = (raw: string) => {
    const res = evaluateMathDetailed(raw, 1, {}, parsedAngleMode);
    setCalcResult(
      res.value !== null ? String(Number(res.value.toFixed(6))) : res.error || 'Syntax Error'
    );
  };

  const statsNumbers = statsRaw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const statsSummary = calculateStatistics(statsNumbers);
  const vecOps = computeVectorOps(vecA, vecB);
  const detValue = computeDeterminant3x3(matrix3x3);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Study Tools"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
    >
      <div className="w-full max-w-[700px] bg-white dark:bg-[#111113] h-full border-l border-zinc-200 dark:border-white/[0.08] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 shrink-0 flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.07]">
          <div>
            <h2 className="font-display font-bold tracking-[-0.02em] text-xl text-zinc-900 dark:text-zinc-50">
              Study Tools &amp; Graphing Lab
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sliders, roots/extrema, and offline scientific calculator.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Study Tools"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181b] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Tabs */}
        <div className="px-6 pt-2.5 shrink-0 border-b border-zinc-200 dark:border-white/[0.07] flex items-center justify-between gap-2 overflow-x-auto">
          {[
            { id: 'Graph', icon: TrendingUp },
            { id: 'Calculator', icon: Calculator },
            { id: 'Units', icon: Ruler },
            { id: 'Statistics', icon: BarChart2 },
            { id: 'Formulas', icon: Sigma },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-t-lg text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-zinc-100 dark:bg-[#18181b] text-zinc-900 dark:text-zinc-50 border-zinc-900 dark:border-zinc-100'
                    : 'text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.id}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'Graph' && (
            <div className="space-y-4">
              {/* Desmos Presets & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">Presets:</span>
                  {[
                    {
                      label: 'Parabola + Line',
                      eqs: [
                        { id: 'eq-1', expr: 'y = a * x^2 - 4', color: '#3B82F6', visible: true, showDerivative: false },
                        { id: 'eq-2', expr: 'y = m * x + c', color: '#10B981', visible: true, showDerivative: false },
                      ],
                    },
                    {
                      label: 'SHM Wave y = a·sin(k·x)',
                      eqs: [
                        { id: 'eq-1', expr: 'y = a * sin(k * x)', color: '#3B82F6', visible: true, showDerivative: true },
                      ],
                    },
                    {
                      label: 'Cubic Extrema',
                      eqs: [
                        { id: 'eq-1', expr: 'y = x^3 - 3 * x', color: '#EF4444', visible: true, showDerivative: true },
                      ],
                    },
                  ].map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setEquations(p.eqs);
                        setSelectedPoint(null);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#18181b] font-semibold cursor-pointer transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowTableOfValues((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer transition-colors ${
                      showTableOfValues
                        ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] dark:bg-[#F5F0E6] dark:text-[#09090B] dark:border-[#F5F0E6]'
                        : 'border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#18181b]'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>x vs f(x) Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextColor = GRAPH_COLORS[equations.length % GRAPH_COLORS.length];
                      setEquations((prev) => [
                        ...prev,
                        {
                          id: `eq-${Date.now()}`,
                          expr: 'y = cos(x)',
                          color: nextColor,
                          visible: true,
                          showDerivative: false,
                        },
                      ]);
                    }}
                    className="px-3 py-1.5 rounded-lg btn-terracotta text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Equation</span>
                  </button>
                </div>
              </div>

              {/* Multi-Equation List */}
              <div className="space-y-2">
                {equations.map((eq, idx) => {
                  const syntax = eq.expr.trim() ? validateMathSyntax(eq.expr) : { valid: true };
                  return (
                    <div
                      key={eq.id}
                      className={`p-2 rounded-xl border bg-zinc-50/70 dark:bg-[#18181b] space-y-1 ${
                        syntax.valid
                          ? 'border-zinc-200 dark:border-white/[0.08]'
                          : 'border-rose-500/40 bg-rose-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEquations((prev) =>
                              prev.map((item) =>
                                item.id === eq.id ? { ...item, visible: !item.visible } : item
                              )
                            )
                          }
                          aria-label={`Toggle visibility for equation ${idx + 1}`}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold cursor-pointer shrink-0"
                          style={{ backgroundColor: eq.visible ? eq.color : '#71717a' }}
                        >
                          {eq.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        <input
                          type="text"
                          value={eq.expr}
                          onChange={(e) =>
                            setEquations((prev) =>
                              prev.map((item) =>
                                item.id === eq.id ? { ...item, expr: e.target.value } : item
                              )
                            )
                          }
                          placeholder="e.g., y = a * x^2 - 4"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#111113] text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setEquations((prev) =>
                              prev.map((item) =>
                                item.id === eq.id
                                  ? { ...item, showDerivative: !item.showDerivative }
                                  : item
                              )
                            )
                          }
                          title="Toggle d/dx Derivative Curve Overlay"
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border cursor-pointer transition-colors ${
                            eq.showDerivative
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                          }`}
                        >
                          d/dx
                        </button>

                        {equations.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEquations((prev) => prev.filter((item) => item.id !== eq.id))
                            }
                            aria-label="Remove equation"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {!syntax.valid && syntax.error && (
                        <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 pl-8">
                          Syntax error: {syntax.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Interactive Parameter Sliders */}
              {activeParamNames.length > 0 && (
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Parameter Sliders ({activeParamNames.join(', ')})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeParamNames.map((param) => {
                      const val = sliderParams[param] ?? 1;
                      const isPlaying = animatingParam === param;
                      return (
                        <div
                          key={param}
                          className="p-2.5 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.08] flex items-center gap-2.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => setAnimatingParam(isPlaying ? null : param)}
                            aria-label={`Animate parameter ${param}`}
                            className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-[#1f1f23] text-zinc-800 dark:text-zinc-200 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            {isPlaying ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </button>
                          <span className="font-mono tabular-nums font-semibold text-zinc-800 dark:text-zinc-200 w-16">
                            {param} = {val}
                          </span>
                          <input
                            type="range"
                            min={-5}
                            max={5}
                            step={0.25}
                            value={val}
                            onChange={(e) =>
                              setSliderParams((prev) => ({
                                ...prev,
                                [param]: Number(e.target.value),
                              }))
                            }
                            className="flex-1 accent-[#D4653B]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic x vs f(x) Table of Values */}
              {showTableOfValues && (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-[#18181b] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      Table: x vs f(x) &amp; f&apos;(x)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setTableXValues((prev) => [
                          ...prev,
                          (prev[prev.length - 1] ?? 2) + 1,
                        ])
                      }
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + Add x Row
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono tabular-nums border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-white/[0.08] text-left text-zinc-500 dark:text-zinc-400">
                          <th className="py-1.5 px-2">x</th>
                          <th className="py-1.5 px-2">f₁(x)</th>
                          <th className="py-1.5 px-2">f₁&apos;(x)</th>
                          {equations[1] && <th className="py-1.5 px-2">f₂(x)</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/70 dark:divide-white/[0.06]">
                        {tableXValues.map((xv, rIdx) => {
                          const y1 = evaluateMathFunction(
                            equations[0]?.expr || 'x',
                            xv,
                            sliderParams,
                            parsedAngleMode
                          );
                          const dy1 = evaluateDerivative(
                            equations[0]?.expr || 'x',
                            xv,
                            sliderParams,
                            parsedAngleMode
                          );
                          const y2 = equations[1]
                            ? evaluateMathFunction(
                                equations[1].expr,
                                xv,
                                sliderParams,
                                parsedAngleMode
                              )
                            : null;
                          return (
                            <tr key={rIdx}>
                              <td className="py-1 px-2">
                                <input
                                  type="number"
                                  value={xv}
                                  onChange={(e) => {
                                    const next = [...tableXValues];
                                    next[rIdx] = Number(e.target.value);
                                    setTableXValues(next);
                                  }}
                                  className="w-14 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#111113] text-center text-zinc-900 dark:text-zinc-100"
                                />
                              </td>
                              <td className="py-1 px-2 font-semibold text-blue-600 dark:text-blue-400">
                                {y1 !== null ? Number(y1.toFixed(4)) : 'undef'}
                              </td>
                              <td className="py-1 px-2 text-amber-600 dark:text-amber-400">
                                {dy1 !== null ? Number(dy1.toFixed(4)) : 'undef'}
                              </td>
                              {equations[1] && (
                                <td className="py-1 px-2 font-semibold text-emerald-600 dark:text-emerald-400">
                                  {y2 !== null ? Number(y2.toFixed(4)) : 'undef'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Range Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">x:</span>
                  <input
                    type="number"
                    value={xMin}
                    onChange={(e) => setXMin(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 text-center font-mono tabular-nums"
                  />
                  <span className="text-zinc-400">to</span>
                  <input
                    type="number"
                    value={xMax}
                    onChange={(e) => setXMax(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 text-center font-mono tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">y:</span>
                  <input
                    type="number"
                    value={yMin}
                    onChange={(e) => setYMin(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 text-center font-mono tabular-nums"
                  />
                  <span className="text-zinc-400">to</span>
                  <input
                    type="number"
                    value={yMax}
                    onChange={(e) => setYMax(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 text-center font-mono tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setZoomPct(100);
                    setSelectedPoint(null);
                  }}
                  className="px-3 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#18181b] cursor-pointer"
                >
                  Reset View
                </button>
              </div>

              {/* Coordinate Graph Canvas */}
              <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#09090b] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Click any key-point dot to inspect <strong>Roots</strong>, <strong>Extrema</strong>, or <strong>Intersections</strong>:
                  </span>
                  {selectedPoint && (
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-mono tabular-nums font-semibold">
                      {selectedPoint.label}
                    </span>
                  )}
                </div>

                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-[330px] select-none"
                >
                  {/* Grid lines */}
                  {[-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10].map((tick) => {
                    const sx = toScreenX(tick);
                    const sy = toScreenY(tick);
                    return (
                      <g key={tick}>
                        <line
                          x1={sx}
                          y1={pad}
                          x2={sx}
                          y2={svgHeight - pad}
                          className="stroke-zinc-200 dark:stroke-white/[0.07]"
                          strokeWidth="1"
                        />
                        <line
                          x1={pad}
                          y1={sy}
                          x2={svgWidth - pad}
                          y2={sy}
                          className="stroke-zinc-200 dark:stroke-white/[0.07]"
                          strokeWidth="1"
                        />
                        {tick !== 0 && (
                          <>
                            <text
                              x={sx}
                              y={toScreenY(0) + 15}
                              textAnchor="middle"
                              fontSize="10"
                              className="fill-zinc-500 dark:fill-zinc-400"
                            >
                              {tick}
                            </text>
                            <text
                              x={toScreenX(0) - 8}
                              y={sy + 3}
                              textAnchor="end"
                              fontSize="10"
                              className="fill-zinc-500 dark:fill-zinc-400"
                            >
                              {tick}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* X and Y Axes */}
                  <line
                    x1={pad}
                    y1={toScreenY(0)}
                    x2={svgWidth - pad}
                    y2={toScreenY(0)}
                    className="stroke-zinc-800 dark:stroke-zinc-500"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={toScreenX(0)}
                    y1={pad}
                    x2={toScreenX(0)}
                    y2={svgHeight - pad}
                    className="stroke-zinc-800 dark:stroke-zinc-500"
                    strokeWidth="1.5"
                  />

                  {/* Plotted Function Curves & Optional d/dx Derivative Overlays */}
                  {visibleEqs.map((eq) => {
                    const pathD = buildCurvePath(eq.expr, false);
                    const derivPathD = eq.showDerivative ? buildCurvePath(eq.expr, true) : '';
                    return (
                      <g key={eq.id}>
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke={eq.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        )}
                        {derivPathD && (
                          <path
                            d={derivPathD}
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="1.75"
                            strokeDasharray="5,4"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Desmos-style Clickable Key Points */}
                  {specialPoints.slice(0, 18).map((pt, idx) => {
                    const cx = toScreenX(pt.x);
                    const cy = toScreenY(pt.y);
                    const isSelected =
                      selectedPoint &&
                      Math.abs(selectedPoint.x - pt.x) < 0.05 &&
                      Math.abs(selectedPoint.y - pt.y) < 0.05;
                    return (
                      <g
                        key={idx}
                        onClick={() => setSelectedPoint(pt)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 6 : 4.5}
                          fill={isSelected ? '#3B82F6' : '#71717A'}
                          stroke="#FAFAFA"
                          strokeWidth="1.8"
                        />
                        {isSelected && (
                          <g>
                            <rect
                              x={Math.min(svgWidth - 155, Math.max(8, cx - 70))}
                              y={Math.max(10, cy - 30)}
                              width="145"
                              height="20"
                              rx="5"
                              fill="#18181B"
                            />
                            <text
                              x={Math.min(svgWidth - 82, Math.max(80, cx))}
                              y={Math.max(24, cy - 16)}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="bold"
                              fill="#FAFAFA"
                            >
                              {pt.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Bottom Key Points Chips & Zoom Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {specialPoints.slice(0, 4).map((pt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedPoint(pt)}
                        className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-[#18181b] hover:bg-zinc-200 dark:hover:bg-[#1f1f23] text-[10px] font-mono tabular-nums font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.1] text-xs text-zinc-700 dark:text-zinc-300">
                      <button
                        type="button"
                        onClick={() => setZoomPct((z) => Math.max(50, z - 25))}
                        aria-label="Zoom out graph"
                        className="px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#18181b] cursor-pointer"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1.5 border-x border-zinc-200 dark:border-white/[0.1] font-mono tabular-nums font-medium">
                        {zoomPct}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomPct((z) => Math.min(200, z + 25))}
                        aria-label="Zoom in graph"
                        className="px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#18181b] cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPanMode((v) => !v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                        panMode
                          ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] dark:bg-[#F5F0E6] dark:text-[#09090B] dark:border-[#F5F0E6]'
                          : 'border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Hand className="w-3.5 h-3.5" />
                      <span>Pan</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Calculator' && (
            <div className="space-y-4">
              {/* Sub-mode switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {(
                    [
                      { id: 'standard', label: 'Trig & Log Keypad' },
                      { id: 'combinatorics', label: 'nCr · nPr · n!' },
                      { id: 'matrix', label: '3×3 Matrix Det' },
                      { id: 'vectors', label: '3D Vectors (A·B, A×B)' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCalcSubMode(m.id)}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                        calcSubMode === m.id
                          ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                          : 'bg-zinc-100 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-[#1f1f23]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-lg border border-zinc-200 dark:border-white/[0.1] p-0.5 text-xs">
                  {(['RAD', 'DEG'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAngleMode(mode)}
                      className={`px-2.5 py-1 rounded-md font-mono font-bold cursor-pointer transition-colors ${
                        angleMode === mode
                          ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {calcSubMode === 'standard' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calcExpr}
                      onChange={(e) => setCalcExpr(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono text-sm focus:outline-none focus:border-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={() => evaluateScientificExpr(calcExpr)}
                      className="px-4 py-2.5 rounded-xl btn-terracotta text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Evaluate
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Result ({angleMode}):
                    </span>
                    <span className="font-mono font-bold text-xl text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {calcResult}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    {[
                      'sin(pi/6)',
                      'cos(pi/3)',
                      'tan(pi/4)',
                      'asin(0.5)',
                      'acos(0.5)',
                      'atan(1)',
                      'ln(e)',
                      'log(100)',
                      'sqrt(2)',
                      '3^4',
                      'pi',
                      'abs(-9.8)',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setCalcExpr(preset);
                          evaluateScientificExpr(preset);
                        }}
                        className="p-2.5 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#18181b] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1f1f23] cursor-pointer transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {calcSubMode === 'combinatorics' && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        n (Total items)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={170}
                        value={combN}
                        onChange={(e) => setCombN(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        r (Selected items)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={170}
                        value={combR}
                        onChange={(e) => setCombR(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Combination (^nC_r)
                      </div>
                      <div className="font-mono tabular-nums font-bold text-base text-blue-600 dark:text-blue-400 mt-0.5">
                        {computeCombination(combN, combR)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Permutation (^nP_r)
                      </div>
                      <div className="font-mono tabular-nums font-bold text-base text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {computePermutation(combN, combR)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Factorial (n!)
                      </div>
                      <div className="font-mono tabular-nums font-bold text-base text-amber-700 dark:text-amber-300 mt-0.5">
                        {computeFactorial(Math.min(20, combN))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {calcSubMode === 'matrix' && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] space-y-4 text-xs">
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    3×3 Matrix Determinant (|A|)
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-w-xs">
                    {matrix3x3.map((row, r) =>
                      row.map((val, c) => (
                        <input
                          key={`${r}-${c}`}
                          type="number"
                          value={val}
                          onChange={(e) => {
                            const copy = matrix3x3.map((rw) => [...rw]);
                            copy[r][c] = Number(e.target.value);
                            setMatrix3x3(copy);
                          }}
                          className="px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono tabular-nums text-center font-semibold"
                        />
                      ))
                    )}
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-between">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      Determinant det(A):
                    </span>
                    <span className="font-mono tabular-nums font-bold text-lg text-blue-600 dark:text-blue-400">
                      {detValue}
                    </span>
                  </div>
                </div>
              )}

              {calcSubMode === 'vectors' && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Vector A (Aₓ, Aᵧ, A_z)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <input
                            key={i}
                            type="number"
                            value={vecA[i]}
                            onChange={(e) => {
                              const next: [number, number, number] = [...vecA] as any;
                              next[i] = Number(e.target.value);
                              setVecA(next);
                            }}
                            className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono tabular-nums text-center"
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Vector B (Bₓ, Bᵧ, B_z)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <input
                            key={i}
                            type="number"
                            value={vecB[i]}
                            onChange={(e) => {
                              const next: [number, number, number] = [...vecB] as any;
                              next[i] = Number(e.target.value);
                              setVecB(next);
                            }}
                            className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono tabular-nums text-center"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Dot Product (A · B)
                      </div>
                      <div className="font-bold text-base text-blue-600 dark:text-blue-400">
                        {vecOps.dot}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Cross Product (A × B)
                      </div>
                      <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                        ({vecOps.cross.join(', ')})
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Units' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['Energy', 'Pressure', 'Angle'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setUnitCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      unitCategory === cat
                        ? 'bg-[#1C1917] text-[#FAF8F5] dark:bg-[#F5F0E6] dark:text-[#09090B]'
                        : 'bg-zinc-100 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Input Value (
                  {unitCategory === 'Energy'
                    ? 'Electron-Volts (eV)'
                    : unitCategory === 'Pressure'
                    ? 'Atmospheres (atm)'
                    : 'Degrees (°)'}
                  )
                </label>
                <input
                  type="number"
                  value={unitInputVal}
                  onChange={(e) => setUnitInputVal(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono tabular-nums text-sm"
                />
              </div>
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] space-y-2 text-xs font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {unitCategory === 'Energy' && (
                  <>
                    <div>Joules (J): {(unitInputVal * 1.60218e-19).toExponential(4)} J</div>
                    <div>kJ / mol: {(unitInputVal * 96.485).toFixed(3)} kJ/mol</div>
                    <div>Calories: {(unitInputVal * 3.829e-20).toExponential(4)} cal</div>
                  </>
                )}
                {unitCategory === 'Pressure' && (
                  <>
                    <div>Pascals (Pa): {(unitInputVal * 101325).toFixed(1)} Pa</div>
                    <div>Bar: {(unitInputVal * 1.01325).toFixed(5)} bar</div>
                    <div>mmHg (Torr): {(unitInputVal * 760).toFixed(2)} Torr</div>
                  </>
                )}
                {unitCategory === 'Angle' && (
                  <>
                    <div>Radians (rad): {((unitInputVal * Math.PI) / 180).toFixed(6)} rad</div>
                    <div>Gradians: {(unitInputVal * (10 / 9)).toFixed(3)} grad</div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Statistics' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Dataset (comma-separated numbers)
              </label>
              <input
                type="text"
                value={statsRaw}
                onChange={(e) => setStatsRaw(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-mono text-sm"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Mean (x̄)</div>
                  <div className="font-mono font-bold text-base tabular-nums text-zinc-900 dark:text-zinc-100">
                    {statsSummary.mean}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Median</div>
                  <div className="font-mono font-bold text-base tabular-nums text-zinc-900 dark:text-zinc-100">
                    {statsSummary.median}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Variance (σ²)</div>
                  <div className="font-mono font-bold text-base tabular-nums text-zinc-900 dark:text-zinc-100">
                    {statsSummary.variance}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Std Dev (σ)</div>
                  <div className="font-mono font-bold text-base tabular-nums text-zinc-900 dark:text-zinc-100">
                    {statsSummary.stdDev}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Formulas' && (
            <div className="space-y-3">
              {[
                {
                  subj: 'Physics · Rotational Mechanics',
                  title: 'Rolling Without Slipping Acceleration',
                  eq: '$$a = \\frac{g\\sin\\theta}{1 + \\frac{I_{cm}}{mR^2}}$$',
                },
                {
                  subj: 'Chemistry · Electrochemistry',
                  title: 'Nernst Equation at 298 K',
                  eq: '$$E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n}\\log_{10} Q$$',
                },
                {
                  subj: 'Physics · Electrostatics',
                  title: 'Gauss Law & Electric Flux',
                  eq: '$$\\Phi_E = \\oint \\vec{E}\\cdot d\\vec{A} = \\frac{q_{\\text{enclosed}}}{\\varepsilon_0}$$',
                },
                {
                  subj: 'Mathematics · Calculus',
                  title: 'King’s Property of Definite Integrals',
                  eq: '$$\\int_a^b f(x)\\,dx = \\int_a^b f(a + b - x)\\,dx$$',
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] space-y-1"
                >
                  <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {f.subj}
                  </div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {f.title}
                  </div>
                  <div className="text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-[#18181b] px-3 py-2 rounded-lg">
                    <MathRichText content={f.eq} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. Focus 25:00 Timer + Lyria 3 Focus Music Generator Popover
// ============================================================================
interface FocusTimerModalProps {
  isOpen: boolean;
  secondsLeft: number;
  running: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const FocusTimerModal: React.FC<FocusTimerModalProps> = ({
  isOpen,
  secondsLeft,
  running,
  onToggleRun,
  onReset,
  onClose,
}) => {
  const [musicPrompt, setMusicPrompt] = useState(
    'Ambient lo-fi acoustic piano and warm synth pad for deep JEE math & physics focus'
  );
  const [durationType, setDurationType] = useState<'clip' | 'full'>('clip');
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);

  if (!isOpen) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const handleGenerateMusic = async () => {
    setGeneratingMusic(true);
    setMusicError(null);
    try {
      const res = await apiFetchWithAuth<{ audioUrl?: string }>('/api/ai/music', {
        prompt: musicPrompt,
        durationType,
      });
      if (!res.ok || !res.data.audioUrl) {
        throw new Error(
          !res.ok
            ? `[${res.error.errorCode}] ${res.error.message}`
            : 'Could not generate focus track'
        );
      }
      setAudioUrl(res.data.audioUrl);
    } catch (err: any) {
      setMusicError(err?.message || 'Failed to generate focus music');
    } finally {
      setGeneratingMusic(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Focus Timer and Study Music"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            <h3 className="font-display font-bold tracking-[-0.02em] text-lg text-zinc-900 dark:text-zinc-50">
              Pomodoro Focus Session
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Focus Timer"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-6 rounded-2xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] text-center space-y-3">
          <div className="font-mono font-bold text-5xl text-zinc-900 dark:text-zinc-50 tabular-nums">
            {mins}:{secs}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onToggleRun}
              className="px-5 py-2 rounded-lg btn-terracotta text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{running ? 'Pause Focus' : 'Start 25m Focus'}</span>
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#1f1f23] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Lyria 3 Focus Music Generator */}
        <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.07] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <Music className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Focus Music Generator (Lyria 3)</span>
            </div>
            <div className="flex gap-1 bg-zinc-100 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setDurationType('clip')}
                className={`px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                  durationType === 'clip'
                    ? 'bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                30s Clip
              </button>
              <button
                type="button"
                onClick={() => setDurationType('full')}
                className={`px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                  durationType === 'full'
                    ? 'bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                Full Track
              </button>
            </div>
          </div>

          <input
            type="text"
            value={musicPrompt}
            onChange={(e) => setMusicPrompt(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-xs text-zinc-900 dark:text-zinc-100"
            placeholder="Describe your study soundtrack..."
          />

          <button
            type="button"
            disabled={generatingMusic}
            onClick={handleGenerateMusic}
            className="w-full py-2.5 rounded-lg btn-terracotta text-xs font-semibold cursor-pointer transition-colors"
          >
            {generatingMusic
              ? 'Composing with Lyria 3...'
              : `Generate ${durationType === 'full' ? 'Full Track (Lyria Pro)' : '30s Focus Clip (Lyria Clip)'}`}
          </button>

          {audioUrl && <audio controls src={audioUrl} className="w-full h-9 mt-2" />}
          {musicError && <p className="text-[11px] text-rose-500">{musicError}</p>}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. Classroom Teacher Live Voice Tutor Modal
//    - 4 Teacher Personas: Hinglish IIT Faculty, Indian English Teacher, Pure Hindi, Pure English
//    - Step-by-step question solver that asks pedagogical check-in questions
//    - Word-by-word live paragraph streaming for Speaker (You) and Teacher
//    - Interruptible speech (Barge-In button or speaking stops AI output immediately)
//    - Persistent Voice Session History per chapter/material
// ============================================================================
export type VoiceTeacherPersonaId =
  | 'hinglish_faculty'
  | 'indian_english'
  | 'pure_hindi'
  | 'pure_english';

export interface VoiceTurnEntry {
  id: string;
  speaker: 'You' | 'Tutor';
  text: string;
  timestamp: string;
  streaming?: boolean;
  personaLabel?: string;
}

interface LiveVoiceTutorModalProps {
  isOpen: boolean;
  chapterTitle: string;
  materialContext?: string;
  onClose: () => void;
}

export const LiveVoiceTutorModal: React.FC<LiveVoiceTutorModalProps> = ({
  isOpen,
  chapterTitle,
  materialContext = '',
  onClose,
}) => {
  const storageKey = `learnmate_voice_history_${chapterTitle.replace(/\s+/g, '_').toLowerCase()}`;
  const [activeView, setActiveView] = useState<'live' | 'history'>('live');
  const [teacherPersona, setTeacherPersona] = useState<VoiceTeacherPersonaId>('hinglish_faculty');
  const [connected, setConnected] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [liveUserDraft, setLiveUserDraft] = useState('');
  const [turns, setTurns] = useState<VoiceTurnEntry[]>([]);
  const [voicePromptInput, setVoicePromptInput] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const userStreamTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const PERSONA_OPTIONS: {
    id: VoiceTeacherPersonaId;
    label: string;
    subtitle: string;
    langCode: string;
  }[] = [
    {
      id: 'hinglish_faculty',
      label: 'Hinglish IIT Faculty',
      subtitle: 'Warm Indian English + Hindi Coaching Style',
      langCode: 'en-IN',
    },
    {
      id: 'indian_english',
      label: 'Indian English Teacher',
      subtitle: 'Articulate Indian Professor Accent',
      langCode: 'en-IN',
    },
    {
      id: 'pure_hindi',
      label: 'Pure Hindi (हिंदी शिक्षक)',
      subtitle: 'Complete Classroom Explanation in Hindi',
      langCode: 'hi-IN',
    },
    {
      id: 'pure_english',
      label: 'Pure English',
      subtitle: 'Standard Academic English Professor',
      langCode: 'en-US',
    },
  ];

  const activePersonaObj =
    PERSONA_OPTIONS.find((p) => p.id === teacherPersona) || PERSONA_OPTIONS[0];

  // Load saved voice history for this chapter
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setTurns(JSON.parse(saved));
      } else {
        setTurns([]);
      }
    } catch {
      setTurns([]);
    }
  }, [isOpen, storageKey]);

  // Persist voice history whenever turns update
  useEffect(() => {
    if (!isOpen || turns.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(turns.slice(-40)));
    } catch {
      // ignore storage quota
    }
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isOpen, storageKey]);

  const [retryNonce, setRetryNonce] = useState(0);
  const reconnectTimerRef = useRef<number | null>(null);

  // Connect to /api/live authenticated WebSocket with exponential backoff
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let activeWs: WebSocket | null = null;
    let attempt = 0;

    const connectSocket = async () => {
      if (cancelled) return;
      const token = await getFirebaseIdToken();
      if (cancelled) return;
      if (!token) {
        setStatusError('Sign in required to connect authenticated Live Voice Tutor.');
        setConnected(false);
        return;
      }

      const ws = new WebSocket(wsUrl('/api/live'), [
        `learnmate-auth.${token}`,
      ]);
      activeWs = ws;
      wsRef.current = ws;
      registerActiveVoiceSocket(ws);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.status === 'connected') {
            attempt = 0;
            setConnected(true);
            setStatusError(null);
          }
          if (msg.inputTranscript) {
            appendWordChunkToTurn('You', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            appendWordChunkToTurn('Tutor', msg.outputTranscript);
          }
          if (msg.interrupted) {
            handleInterruptSpeech();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setStatusError('Authenticated Live Voice connection interrupted.');
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (cancelled) return;
        if (event.code !== 1000 && event.code !== 1005) {
          if (attempt < 3) {
            const delayMs = 1000 * Math.pow(2, attempt);
            attempt += 1;
            setStatusError(
              `Live Voice reconnecting in ${delayMs / 1000}s (attempt ${attempt}/3)...`
            );
            reconnectTimerRef.current = window.setTimeout(() => {
              void connectSocket();
            }, delayMs);
          } else {
            setStatusError(
              `Live Voice closed (${event.reason || `code ${event.code}`}). Click Retry Connection below.`
            );
          }
        }
      };
    };

    void connectSocket();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (activeWs) activeWs.close();
      stopAllTimersAndSpeech();
      setConnected(false);
      setMicActive(false);
    };
  }, [isOpen, retryNonce]);

  const stopAllTimersAndSpeech = () => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    if (userStreamTimerRef.current) {
      window.clearInterval(userStreamTimerRef.current);
      userStreamTimerRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setAiSpeaking(false);
  };

  // Barge-In / Interrupt handler
  const handleInterruptSpeech = () => {
    stopAllTimersAndSpeech();
    setTurns((prev) =>
      prev.map((t, i) => (i === prev.length - 1 ? { ...t, streaming: false } : t))
    );
  };

  const appendWordChunkToTurn = (speaker: 'You' | 'Tutor', chunk: string) => {
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.streaming) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${chunk}`.replace(/\s+/g, ' ').trim() },
        ];
      }
      return [
        ...prev,
        {
          id: `vt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text: chunk.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          streaming: true,
          personaLabel: speaker === 'Tutor' ? activePersonaObj.label : undefined,
        },
      ];
    });
  };

  // Stream a full paragraph word-by-word into the transcript & speak it like a real classroom teacher
  const streamUserAndTutorConversation = async (spokenUserText: string) => {
    if (!spokenUserText.trim()) return;
    handleInterruptSpeech();
    setStatusError(null);

    const userWords = spokenUserText.trim().split(/\s+/);
    const userTurnId = `vt-user-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Stream speaker's words word-by-word in a paragraph
    setTurns((prev) => [
      ...prev,
      { id: userTurnId, speaker: 'You', text: '', timestamp: nowTime, streaming: true },
    ]);

    await new Promise<void>((resolve) => {
      let idx = 0;
      userStreamTimerRef.current = window.setInterval(() => {
        if (idx < userWords.length) {
          const nextWord = userWords[idx];
          idx++;
          setLiveUserDraft(userWords.slice(0, idx).join(' '));
          setTurns((prev) =>
            prev.map((t) =>
              t.id === userTurnId
                ? { ...t, text: `${t.text} ${nextWord}`.trim() }
                : t
            )
          );
        } else {
          if (userStreamTimerRef.current) window.clearInterval(userStreamTimerRef.current);
          userStreamTimerRef.current = null;
          setLiveUserDraft('');
          setTurns((prev) =>
            prev.map((t) => (t.id === userTurnId ? { ...t, streaming: false } : t))
          );
          resolve();
        }
      }, 45);
    });

    // 2. Fetch Classroom Teacher response tailored to the active teacherPersona
    setAiSpeaking(true);
    let replyText = '';
    try {
      const res = await apiFetchWithAuth<{ text?: string }>(
        '/api/ai/think',
        {
          prompt: spokenUserText,
          teacherPersona,
          isVoiceTeacher: true,
          language:
            teacherPersona === 'pure_hindi'
              ? 'Pure Hindi'
              : teacherPersona === 'hinglish_faculty'
              ? 'Hinglish'
              : 'English',
          context: materialContext || `Active Chapter: ${chapterTitle}`,
          contextMode: materialContext ? 'strict_material' : 'open_jee',
        }
      );
      if (!res.ok || !res.data.text) {
        setStatusError(
          (!res.ok ? res.error.message : '') ||
            `[${(!res.ok ? res.error.errorCode : undefined) || 'AI_SERVICE_UNAVAILABLE'}] Live AI Teacher is temporarily unavailable. Please click Retry.`
        );
        setAiSpeaking(false);
        return;
      }
      replyText = res.data.text;
    } catch (err: any) {
      setStatusError(err?.message || 'Network error reaching AI Voice Teacher.');
      setAiSpeaking(false);
      return;
    }

    // Speak aloud using browser speechSynthesis with matching Indian English / Hindi teacher accent
    if (!voiceMuted && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const cleanSpoken = replyText
          .replace(/\$\$[^$]+\$\$/g, ' equation ')
          .replace(/\$[^$]+\$/g, ' formula ')
          .replace(/[*#_`]/g, '');
        const utter = new SpeechSynthesisUtterance(cleanSpoken);
        utter.lang = activePersonaObj.langCode;
        utter.rate = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find((v) =>
          v.lang.toLowerCase().includes(activePersonaObj.langCode.toLowerCase())
        );
        if (matchedVoice) utter.voice = matchedVoice;
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore speech synthesis error
      }
    }

    // 3. Stream Teacher response word-by-word in a cohesive paragraph
    const tutorWords = replyText.trim().split(/\s+/);
    const tutorTurnId = `vt-tutor-${Date.now()}`;
    const tutorTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setTurns((prev) => [
      ...prev,
      {
        id: tutorTurnId,
        speaker: 'Tutor',
        text: '',
        timestamp: tutorTime,
        streaming: true,
        personaLabel: activePersonaObj.label,
      },
    ]);

    let wIdx = 0;
    streamTimerRef.current = window.setInterval(() => {
      if (wIdx < tutorWords.length) {
        const w = tutorWords[wIdx];
        wIdx++;
        setTurns((prev) =>
          prev.map((t) =>
            t.id === tutorTurnId ? { ...t, text: `${t.text} ${w}`.trim() } : t
          )
        );
      } else {
        if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setAiSpeaking(false);
        setTurns((prev) =>
          prev.map((t) => (t.id === tutorTurnId ? { ...t, streaming: false } : t))
        );
      }
    }, 50);
  };

  const toggleMicrophone = async () => {
    if (micActive) {
      setMicActive(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      return;
    }

    handleInterruptSpeech();
    setStatusError(null);
    setMicActive(true);

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = activePersonaObj.langCode;
        recognitionRef.current = rec;

        rec.onresult = (event: any) => {
          let interim = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const txt = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += txt;
            } else {
              interim += txt;
            }
          }
          if (interim) {
            setLiveUserDraft(interim);
          }
          if (finalTranscript.trim()) {
            setLiveUserDraft('');
            setMicActive(false);
            streamUserAndTutorConversation(finalTranscript.trim());
          }
        };

        rec.onerror = () => {
          setMicActive(false);
        };
        rec.onend = () => {
          setMicActive(false);
        };
        rec.start();
        return;
      } catch {
        // Fallback below if browser blocks SpeechRecognition
      }
    }

    setMicActive(false);
    streamUserAndTutorConversation(
      teacherPersona === 'pure_hindi'
        ? `सर, कृपया ${chapterTitle} का मुख्य सूत्र और संख्यात्मक प्रश्न हल करने की चरण-दर-चरण विधि समझाइए।`
        : teacherPersona === 'hinglish_faculty'
        ? `Sir, ${chapterTitle} ka core derivation aur JEE Advanced numerical solve karne ka step-by-step method samjhaiye.`
        : `Professor, please explain the core derivation and step-by-step numerical method for ${chapterTitle}.`
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voicePromptInput.trim()) return;
    const q = voicePromptInput.trim();
    setVoicePromptInput('');
    streamUserAndTutorConversation(q);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live Voice Tutor"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] w-full max-w-3xl p-6 space-y-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-white/[0.07] pb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                aiSpeaking
                  ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse'
                  : micActive
                  ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                  : 'bg-zinc-900 dark:bg-[#18181b] border-zinc-800 dark:border-white/[0.1] text-white dark:text-zinc-100'
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold tracking-[-0.02em] text-base sm:text-lg text-zinc-900 dark:text-zinc-50">
                Live Voice Teacher · {chapterTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {aiSpeaking
                  ? `${activePersonaObj.label} is speaking (click Interrupt or Mic to barge in)`
                  : micActive
                  ? 'Listening to your question...'
                  : `${activePersonaObj.label} — ${activePersonaObj.subtitle}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveView('live')}
                className={`px-3 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  activeView === 'live'
                    ? 'bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Live Class
              </button>
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className={`px-3 py-1 rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors font-mono tabular-nums ${
                  activeView === 'history'
                    ? 'bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({turns.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setVoiceMuted((m) => !m);
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
              }}
              aria-label="Toggle voice audio"
              className="p-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#18181b] cursor-pointer transition-colors"
            >
              {voiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Voice Tutor"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4-Way Classroom Teacher Persona & Accent Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50 dark:bg-[#18181b] p-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] text-xs">
          <span className="font-semibold text-zinc-600 dark:text-zinc-300 px-1">
            Voice &amp; Language:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PERSONA_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTeacherPersona(p.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer ${
                  teacherPersona === p.id
                    ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] dark:bg-[#F5F0E6] dark:text-[#09090B] dark:border-[#F5F0E6]'
                    : 'bg-white dark:bg-[#111113] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-[#1f1f23]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Controls & Barge-In Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleMicrophone}
              className={`px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                micActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'btn-terracotta'
              }`}
            >
              {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{micActive ? 'Stop Listening' : 'Speak to Teacher (Start Talking)'}</span>
            </button>

            {aiSpeaking && (
              <button
                type="button"
                onClick={handleInterruptSpeech}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Interrupt / Ask Follow-Up</span>
              </button>
            )}
          </div>

          {/* Quick Classroom Doubt Starters */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {[
              `Walk me through ${chapterTitle} step by step`,
              'Solve a numerical example with me',
              'What exam trap should I avoid here?',
            ].map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => streamUserAndTutorConversation(q)}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-[#1f1f23] cursor-pointer transition-colors"
              >
                “{q}”
              </button>
            ))}
          </div>
        </div>

        {/* Live Word-by-Word Paragraph Transcript Stream */}
        <div className="flex-1 min-h-[260px] max-h-[360px] overflow-y-auto rounded-xl bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-white/[0.07] p-4 space-y-3.5 text-xs">
          {liveUserDraft && (
            <div className="p-3.5 rounded-xl bg-zinc-900 dark:bg-[#18181b] border border-zinc-800 dark:border-white/[0.1] text-white ml-8">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                You (Speaking Live...)
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">{liveUserDraft} ▍</p>
            </div>
          )}

          {turns.length === 0 && !liveUserDraft ? (
            <div className="text-center py-12 space-y-2 text-zinc-400">
              <Sparkles className="w-6 h-6 mx-auto text-zinc-500" />
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                Ask your teacher by voice or text
              </p>
              <p className="text-[11px] max-w-md mx-auto text-zinc-500 dark:text-zinc-400">
                Step-by-step explanations in Hindi, Hinglish, or Indian English.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`p-4 rounded-xl leading-relaxed ${
                  turn.speaker === 'You'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-zinc-900 dark:text-zinc-100 ml-8'
                    : 'bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] text-zinc-800 dark:text-zinc-100 mr-6'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      turn.speaker === 'You'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {turn.speaker === 'You'
                      ? 'You (Student)'
                      : `Classroom Teacher (${turn.personaLabel || activePersonaObj.label})`}
                    {turn.streaming ? ' · Explaining...' : ''}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                    {turn.timestamp}
                  </span>
                </div>
                <div className="text-xs sm:text-sm leading-relaxed">
                  <MathRichText content={turn.text} />
                  {turn.streaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-blue-500 ml-1 animate-pulse" />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Bottom Voice / Text Input + Clear History */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleFormSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              value={voicePromptInput}
              onChange={(e) => setVoicePromptInput(e.target.value)}
              placeholder="Speak via mic or type a question..."
              className="flex-1 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg btn-terracotta text-xs font-semibold cursor-pointer transition-colors"
            >
              Ask Voice Tutor
            </button>
          </form>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => {
                handleInterruptSpeech();
                setTurns([]);
                localStorage.removeItem(storageKey);
              }}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-rose-500 cursor-pointer transition-colors"
            >
              Clear History
            </button>
          )}
        </div>

        {statusError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <span>{statusError}</span>
            <button
              type="button"
              onClick={() => {
                setStatusError(null);
                setRetryNonce((n) => n + 1);
              }}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500 cursor-pointer transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 5. Mandatory User Confirmation Modal for Google Workspace Mutations
// ============================================================================
interface WorkspaceConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const WorkspaceConfirmModal: React.FC<WorkspaceConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold tracking-[-0.02em] text-base text-zinc-900 dark:text-zinc-50">
              {title}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#18181b] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg btn-terracotta text-xs font-semibold cursor-pointer transition-colors"
          >
            {busy ? 'Syncing with Google Workspace...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. Student Profile Modal (Opened by clicking top-right user avatar)
// ============================================================================
export interface StudentProfileData {
  displayName: string;
  email: string;
  avatarColor: string;
  targetExam: 'JEE Main 2027' | 'JEE Advanced 2027' | 'NEET UG 2027' | 'BITSAT 2027' | 'JEE Main 2028';
  preferredLanguage: 'English' | 'Hinglish' | 'Hindi';
  preferredCurrency?: SupportedCurrency;
  isMinor?: boolean;
  guardianEmail?: string;
  guardianConsentAccepted?: boolean;
  dailyGoalHours: number;
  batchStatus: 'Class 11' | 'Class 12' | 'Dropper';
  coachingName: string;
  targetRankOrPercentile: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  profile: StudentProfileData;
  streakDays: number;
  xp: number;
  level: number;
  onClose: () => void;
  onSaveProfile: (updated: StudentProfileData) => Promise<void>;
  onExportUserData: () => void;
  onOpenLegalModal: (tab: LegalModalTabId) => void;
  onSignOut: () => Promise<void>;
  onDeleteAccountData?: () => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  profile,
  streakDays,
  xp,
  level,
  onClose,
  onSaveProfile,
  onExportUserData,
  onOpenLegalModal,
  onSignOut,
  onDeleteAccountData,
}) => {
  const [formState, setFormState] = useState<StudentProfileData>(profile);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [workspaceConnected, setWorkspaceConnected] = useState<boolean>(
    Boolean(getWorkspaceAccessToken())
  );
  const [connectingWorkspace, setConnectingWorkspace] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  useEffect(() => {
    setFormState(profile);
    setWorkspaceConnected(Boolean(getWorkspaceAccessToken()));
    setConfirmDelete(false);
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const avatarInitials = (formState.displayName || 'Student')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveProfile(formState);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectWorkspace = async () => {
    setConnectingWorkspace(true);
    try {
      const res = await googleSignIn(true);
      if (res.token || getWorkspaceAccessToken()) {
        setWorkspaceConnected(true);
      }
    } finally {
      setConnectingWorkspace(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Student Profile & Settings"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] w-full max-w-2xl p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.07] pb-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-xl text-white font-display font-bold text-base flex items-center justify-center border border-white/[0.1]"
              style={{ backgroundColor: formState.avatarColor || '#18181b' }}
            >
              {avatarInitials}
            </div>
            <div>
              <h2 className="font-display font-bold tracking-[-0.02em] text-lg text-zinc-900 dark:text-zinc-50">
                Profile &amp; Settings
              </h2>
              <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                {formState.email || 'Signed-in Student Account'} · L{level} ({xp} XP · {streakDays}d)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile Modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#18181b] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Avatar Color Picker */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08]">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              Avatar Theme:
            </span>
            <div className="flex items-center gap-2">
              {['#D4653B', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#18181B'].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setFormState((s) => ({ ...s, avatarColor: col }))}
                  aria-label={`Select avatar color ${col}`}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                    formState.avatarColor === col
                      ? 'scale-115 ring-2 ring-offset-2 ring-zinc-400 dark:ring-zinc-500'
                      : ''
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formState.displayName}
                onChange={(e) => setFormState((s) => ({ ...s, displayName: e.target.value }))}
                placeholder="e.g., Aniket Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Target Exam &amp; Year
              </label>
              <select
                value={formState.targetExam}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    targetExam: e.target.value as StudentProfileData['targetExam'],
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-semibold"
              >
                <option value="JEE Main 2027">JEE Main 2027</option>
                <option value="JEE Advanced 2027">JEE Advanced 2027</option>
                <option value="NEET UG 2027">NEET UG 2027</option>
                <option value="BITSAT 2027">BITSAT 2027</option>
                <option value="JEE Main 2028">JEE Main 2028</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Batch / Class Status
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Class 11', 'Class 12', 'Dropper'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setFormState((s) => ({ ...s, batchStatus: b }))}
                    className={`py-2 rounded-lg font-semibold border cursor-pointer transition-colors ${
                      formState.batchStatus === b
                        ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] dark:bg-[#F5F0E6] dark:text-[#09090B] dark:border-[#F5F0E6]'
                        : 'border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#18181b]'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Preferred AI Tutor Language
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['English', 'Hinglish', 'Hindi'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setFormState((s) => ({ ...s, preferredLanguage: l }))}
                    className={`py-2 rounded-lg font-semibold border cursor-pointer transition-colors ${
                      formState.preferredLanguage === l
                        ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] dark:bg-[#F5F0E6] dark:text-[#09090B] dark:border-[#F5F0E6]'
                        : 'border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#18181b]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Billing Region &amp; Currency
              </label>
              <select
                value={formState.preferredCurrency || 'INR'}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    preferredCurrency: e.target.value as SupportedCurrency,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 font-semibold"
              >
                {Object.values(GLOBAL_PPP_PRICING).map((p) => (
                  <option key={p.currency} value={p.currency}>
                    {p.label} ({p.symbol}{p.proMonthly}/mo)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Coaching Institute / School (Optional)
              </label>
              <input
                type="text"
                value={formState.coachingName}
                onChange={(e) => setFormState((s) => ({ ...s, coachingName: e.target.value }))}
                placeholder="e.g., Allen / FIITJEE / PW / Self-Study"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Target AIR / Percentile Goal
              </label>
              <input
                type="text"
                value={formState.targetRankOrPercentile}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, targetRankOrPercentile: e.target.value }))
                }
                placeholder="e.g., 99.5+ Percentile / AIR < 1500"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Daily Study Goal Slider */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-[#18181b]/60 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono tabular-nums">
                Daily Self-Study Goal: {formState.dailyGoalHours} hrs / day
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Calibrates your {getDaysToJeeMain2027Session1()}-day JEE Main schedule
              </div>
            </div>
            <input
              type="range"
              min={2}
              max={14}
              step={1}
              value={formState.dailyGoalHours}
              onChange={(e) =>
                setFormState((s) => ({ ...s, dailyGoalHours: Number(e.target.value) }))
              }
              className="w-40 accent-[#D4653B]"
            />
          </div>

          {/* Google Workspace Connection Status */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Google Workspace</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                    workspaceConnected
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {workspaceConnected ? 'Connected' : 'Authorization Needed'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Drive, Docs, Slides, Calendar, Tasks &amp; Keep sync.
              </p>
            </div>
            <button
              type="button"
              disabled={connectingWorkspace}
              onClick={handleConnectWorkspace}
              className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.1] text-zinc-800 dark:text-zinc-200 font-semibold hover:bg-zinc-100 dark:hover:bg-[#1f1f23] cursor-pointer transition-colors"
            >
              {connectingWorkspace
                ? 'Connecting...'
                : workspaceConnected
                ? 'Reconnect Google Scopes'
                : 'Connect Google Workspace'}
            </button>
          </div>

          {savedNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold text-center">
              Profile preferences saved and synced to your account!
            </div>
          )}

          {/* Save & Data Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-white/[0.07]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onExportUserData}
                className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-zinc-200 font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-[#18181b] cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export My Data (JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLegalModal('privacy');
                }}
                className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-zinc-200 font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-[#18181b] cursor-pointer transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Legal, Privacy &amp; Policies</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await onSignOut();
                }}
                className="px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center gap-1.5 hover:bg-rose-500/20 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg btn-terracotta font-semibold cursor-pointer transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {onDeleteAccountData && (
            <div className="p-3.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-rose-800 dark:text-rose-200">
                  Right to Erasure (DPDP Act 2023 &amp; GDPR)
                </div>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                  Permanently delete Firestore data, IndexedDB PDFs, and local caches.
                </p>
              </div>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3.5 py-2 rounded-lg border border-rose-500/30 bg-white dark:bg-[#111113] text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                >
                  Delete Account &amp; Data
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={deletingData}
                    onClick={async () => {
                      setDeletingData(true);
                      try {
                        await onDeleteAccountData();
                        onClose();
                      } finally {
                        setDeletingData(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500 cursor-pointer transition-colors"
                  >
                    {deletingData ? 'Erasing...' : 'Confirm Permanent Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 7. Commercial Legal, Privacy & Compliance Center Modal
// ============================================================================
interface LegalComplianceModalProps {
  isOpen: boolean;
  initialTab: LegalModalTabId;
  onClose: () => void;
}

export const LegalComplianceModal: React.FC<LegalComplianceModalProps> = ({
  isOpen,
  initialTab,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalModalTabId>(initialTab);
  const [reportCategory, setReportCategory] = useState<
    | 'Wrong AI Answer / Hallucination'
    | 'Question Key Discrepancy'
    | 'Account & Privacy Request'
    | 'General Feedback'
  >('Wrong AI Answer / Hallucination');
  const [reportReference, setReportReference] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setReportSubmitted(false);
    setReportError(null);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim() || reportDescription.trim().length < 5) {
      setReportError('Please enter at least 5 characters describing the issue.');
      return;
    }
    setReportError(null);
    setReportSubmitting(true);
    try {
      const mappedType =
        reportCategory === 'Question Key Discrepancy'
          ? 'wrong_answer_key'
          : reportCategory === 'Wrong AI Answer / Hallucination'
          ? 'typo_or_latex'
          : 'other';
      const res = await reportQuestionIssueOnServer({
        questionId: reportReference.trim() || 'general-support',
        issueType: mappedType,
        details: `[${reportCategory}] ${reportDescription.trim()}`,
      });
      if (!res.ok) {
        setReportError(res.error.message || 'Unable to submit report to server.');
        return;
      }
      setReportSubmitted(true);
      setReportDescription('');
      setReportReference('');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Legal, Privacy and Compliance Center"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl w-full max-w-3xl p-6 space-y-5 my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.07] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold tracking-[-0.02em] text-lg text-zinc-900 dark:text-zinc-100">
                Legal, Privacy &amp; Academic Compliance Center
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Global Commercial Terms · India DPDP Act 2023 &amp; GDPR Compliant
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Legal Modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181b] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Tabs */}
        <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-white/[0.07] pb-1 overflow-x-auto text-xs">
          {(
            [
              { id: 'privacy', label: 'Privacy Policy' },
              { id: 'terms', label: 'Terms & Conditions' },
              { id: 'ai-safety', label: 'AI Safety & Integrity' },
              { id: 'google-api', label: 'Google API Data Policy' },
              { id: 'contact', label: 'Contact & Report Answer' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 rounded-t-lg font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-zinc-100 dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 border-zinc-900 dark:border-white'
                  : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pr-1">
          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold tracking-[-0.01em] text-sm text-zinc-900 dark:text-zinc-100">
                Privacy Policy (India DPDP Act 2023 &amp; EU GDPR Compliance)
              </h3>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">1. Per-User Data Isolation:</strong> Every study material, uploaded PDF,
                handwritten note photo, flashcard, and CBT mock attempt you create in LearnMate JEE
                is strictly isolated to your authenticated Firebase UID (
                <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-[#18181b]">request.auth.uid == userId</code>). Other students cannot view, query, or
                access your uploaded notes or test scores.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">2. Data Minimization &amp; Purpose Limitation:</strong> We collect only your
                name, email address, target examination preferences, and the study content you
                explicitly upload or generate. Your uploaded materials are never sold to third-party
                advertisers or coaching institutes.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">3. Student Data Rights (Right to Export &amp; Erasure):</strong> Under the
                Digital Personal Data Protection Act (DPDP Act 2023, India) and GDPR, you have the
                right to export a complete machine-readable JSON archive of your study data or trigger
                full erasure directly from your Profile Modal at any time.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">4. Minor &amp; Guardian Consent (DPDP Act 2023):</strong> Students under 18
                require parent/guardian consent; zero behavioral ad-tracking or third-party data brokerage is performed.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold tracking-[-0.01em] text-sm text-zinc-900 dark:text-zinc-100">
                Terms &amp; Conditions of Use
              </h3>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">1. Non-Affiliation Disclaimer:</strong> LearnMate JEE is an independent
                educational technology platform. It is{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">
                  not affiliated with, endorsed by, or connected to the National Testing Agency
                  (NTA), the Indian Institutes of Technology (IITs), JoSAA, NCERT
                </strong>
                , or any third-party coaching institute.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">2. Intellectual Property &amp; Uploaded Materials:</strong> You retain full
                ownership of the personal handwritten notes and study documents you upload. By
                uploading materials, you confirm that you have the right to use them for personal
                educational study and exam preparation.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">3. CBT Mock Simulation Accuracy:</strong> Our JEE Main &amp; Advanced CBT
                interfaces simulate official NTA examination rules (+4 / −1 Section A, +4 / 0
                Section B numericals, and JEE Advanced partial marking) for practice purposes only.
              </p>
            </div>
          )}

          {activeTab === 'ai-safety' && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold tracking-[-0.01em] text-sm text-zinc-900 dark:text-zinc-100">
                AI Safety, Hallucination Verification &amp; Exam Hall Rules
              </h3>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">1. AI Verification &amp; Page Citations:</strong> While LearnMate JEE
                grounds responses against your uploaded notes and official syllabus concepts,
                generative AI models can occasionally make mathematical, sign, or stoichiometric
                errors. Always verify critical derivations against NCERT textbooks and cited page
                numbers.
              </p>
              <p>
                <strong className="text-zinc-900 dark:text-zinc-100">2. Prohibition of Calculators in NTA Exam Halls:</strong> The graphing
                calculator, unit converter, and scientific evaluator in <em>Study Tools</em> are
                designed strictly for conceptual visualization during home study. The National
                Testing Agency (NTA) strictly bans physical calculators, smartwatches, and
                electronic devices inside JEE Main and JEE Advanced examination centers.
              </p>
            </div>
          )}

          {activeTab === 'google-api' && (
            <div className="space-y-3">
              <h3 className="font-display font-semibold tracking-[-0.01em] text-sm text-zinc-900 dark:text-zinc-100">
                Google API Services User Data Policy (Limited Use Disclosure)
              </h3>
              <p>
                LearnMate JEE’s use and transfer to any other app of information received from
                Google APIs adheres to the <strong className="text-zinc-900 dark:text-zinc-100">Google API Services User Data Policy</strong>,
                including the Limited Use requirements:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-100">Google Drive &amp; Google Docs (`drive.readonly`, `documents.readonly`):</strong>{' '}
                  Used only when you explicitly click “Browse Google Drive” to import your own study
                  PDFs or Docs into your workbench.
                </li>
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-100">Google Calendar &amp; Tasks (`calendar.events`, `tasks`):</strong> Used
                  only after your explicit confirmation to sync your daily JEE study schedule and
                  pending chapter tasks.
                </li>
                <li>
                  <strong className="text-zinc-900 dark:text-zinc-100">Google Slides &amp; Keep (`presentations`, `keep`, `drive.file`):</strong>{' '}
                  Used only when you explicitly click “Export to Slides” or “Save to Keep” in the
                  Revise workspace.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'contact' && (
            <form onSubmit={handleReportSubmit} className="space-y-3.5">
              <h3 className="font-display font-semibold tracking-[-0.01em] text-sm text-zinc-900 dark:text-zinc-100">
                Contact Support or Report a Wrong Answer
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Issue Category
                  </label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-white/25"
                  >
                    <option value="Wrong AI Answer / Hallucination">
                      Wrong AI Answer / Hallucination
                    </option>
                    <option value="Question Key Discrepancy">Question Key Discrepancy</option>
                    <option value="Account & Privacy Request">Account &amp; Privacy Request</option>
                    <option value="General Feedback">General Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Chapter / Question / Page Reference
                  </label>
                  <input
                    type="text"
                    value={reportReference}
                    onChange={(e) => setReportReference(e.target.value)}
                    placeholder="e.g., Rotational Motion Q4 or Mock Q12"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/25"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Details of the Discrepancy or Question
                </label>
                <textarea
                  rows={3}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the step, formula, or answer key issue so our academic review engine can verify it..."
                  className="w-full p-3 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/25"
                />
              </div>
              {reportError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 font-medium">
                  {reportError}
                </div>
              )}
              {reportSubmitted && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                  Thank you! Your report has been logged to Firestore academic review.
                </div>
              )}
              <button
                type="submit"
                disabled={reportSubmitting}
                className="px-5 py-2.5 rounded-xl btn-terracotta disabled:opacity-50 font-semibold transition-colors cursor-pointer"
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. Instant Practice & Adaptive Drill Modal (With KaTeX + Auto Mistakes Logging)
// ============================================================================
export interface InstantPracticeConfig {
  isOpen: boolean;
  mode: 'chapter-quiz' | 'adaptive-drill' | 'paper-solver';
  title: string;
  chapterOrPaper: string;
  customQuestions?: CBTQuestion[];
}

interface InstantPracticeModalProps {
  config: InstantPracticeConfig | null;
  onClose: () => void;
  onEarnXp: (earnedXp: number) => void;
  onLaunchFullCBT: () => void;
  onRecordMistake?: (question: CBTQuestion, userSelection: string) => void;
}

export const InstantPracticeModal: React.FC<InstantPracticeModalProps> = ({
  config,
  onClose,
  onEarnXp,
  onLaunchFullCBT,
  onRecordMistake,
}) => {
  const [qIndex, setQIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedKey, setVerifiedKey] = useState<{
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [difficultyLevel, setDifficultyLevel] = useState<'Easy' | 'Moderate' | 'JEE Advanced Hard'>(
    'Easy'
  );
  const [scoreCount, setScoreCount] = useState(0);

  useEffect(() => {
    setQIndex(0);
    setSelectedOpt(null);
    setChecked(false);
    setVerifiedKey(null);
    setVerifyError(null);
    setStreak(0);
    setDifficultyLevel('Easy');
    setScoreCount(0);
  }, [config]);

  if (!config || !config.isOpen) return null;

  const questionsPool: CBTQuestion[] =
    config.customQuestions && config.customQuestions.length > 0
      ? config.customQuestions
      : CBT_MOCK_QUESTIONS.slice(0, 10);
  const currentQ = questionsPool[qIndex] || questionsPool[0];
  const resolvedCorrectIndex =
    verifiedKey?.correctIndex ??
    (Number.isInteger(currentQ.correctIndex) ? currentQ.correctIndex : -1);
  const isCorrect = verifiedKey
    ? verifiedKey.isCorrect
    : selectedOpt !== null && selectedOpt === resolvedCorrectIndex;
  const resolvedExplanation = verifiedKey?.explanation || currentQ.explanation || '';

  const handleCheckAnswer = async () => {
    if (selectedOpt === null || checked || verifying) return;
    setVerifyError(null);

    let answerIsCorrect = false;
    let finalCorrectIndex = Number.isInteger(currentQ.correctIndex) ? currentQ.correctIndex : -1;
    let finalExplanation = currentQ.explanation || '';

    if (finalCorrectIndex < 0) {
      setVerifying(true);
      const res = await verifySinglePyqAnswerOnServer({
        questionId: currentQ.id,
        selectedOption: selectedOpt,
      });
      setVerifying(false);
      if (!res.ok) {
        setVerifyError(res.error.message || 'Unable to verify answer against server key.');
        return;
      }
      answerIsCorrect = res.data.isCorrect;
      finalCorrectIndex = res.data.correctIndex;
      finalExplanation = res.data.explanation || '';
      setVerifiedKey({
        isCorrect: answerIsCorrect,
        correctIndex: finalCorrectIndex,
        explanation: finalExplanation,
      });
    } else {
      answerIsCorrect = selectedOpt === finalCorrectIndex;
    }

    setChecked(true);
    if (answerIsCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setScoreCount((s) => s + 1);
      onEarnXp(config.mode === 'adaptive-drill' ? 15 : 10);
      if (config.mode === 'adaptive-drill') {
        if (nextStreak >= 3) setDifficultyLevel('JEE Advanced Hard');
        else if (nextStreak >= 1) setDifficultyLevel('Moderate');
      }
    } else {
      setStreak(0);
      if (config.mode === 'adaptive-drill') {
        setDifficultyLevel('Easy');
      }
      if (onRecordMistake) {
        onRecordMistake(
          {
            ...currentQ,
            correctIndex: finalCorrectIndex >= 0 ? finalCorrectIndex : 0,
            explanation: finalExplanation,
          },
          currentQ.options[selectedOpt] || `Option ${selectedOpt + 1}`
        );
      }
    }
  };

  const handleNext = () => {
    setSelectedOpt(null);
    setChecked(false);
    setVerifiedKey(null);
    setVerifyError(null);
    setQIndex((idx) => (idx + 1) % questionsPool.length);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={config.title}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-white/[0.07] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 text-[11px] font-semibold uppercase tracking-wider">
                {config.mode === 'adaptive-drill'
                  ? `Adaptive Drill · ${difficultyLevel}`
                  : config.mode === 'chapter-quiz'
                  ? `${questionsPool.length}-Question Chapter Quiz`
                  : 'Instant-Feedback Paper Solver'}
              </span>
              {config.mode === 'adaptive-drill' && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-semibold font-mono tabular-nums inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-current" />
                  Streak: {streak}
                </span>
              )}
            </div>
            <h3 className="font-display font-semibold tracking-[-0.02em] text-lg text-zinc-900 dark:text-zinc-100 mt-1.5">
              {config.title} · {config.chapterOrPaper}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              Score: {scoreCount} / {questionsPool.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Practice Modal"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#18181b] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            <span>
              Question {qIndex + 1} of {questionsPool.length} · {currentQ.subject} (
              {currentQ.chapter})
            </span>
            <span>+4 / −1 NTA Check</span>
          </div>

          <div className="text-sm sm:text-base font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
            <span className="mr-1.5 font-mono text-zinc-500 dark:text-zinc-400">Q{qIndex + 1}.</span>
            <MathRichText content={currentQ.stem} inline />
          </div>

          <div className="space-y-2.5">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOpt === idx;
              let borderStyle =
                'border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#18181b] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-[#1f1f23]';
              if (isSelected && !checked) {
                borderStyle =
                  'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-[#27272a] text-zinc-900 dark:text-white';
              } else if (checked) {
                if (idx === resolvedCorrectIndex) {
                  borderStyle =
                    'border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200';
                } else if (isSelected && idx !== resolvedCorrectIndex) {
                  borderStyle =
                    'border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-200';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={checked}
                  onClick={() => setSelectedOpt(idx)}
                  className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${borderStyle}`}
                >
                  <span className="flex items-center gap-2.5">
                    <strong className="font-mono text-xs opacity-75">({['A', 'B', 'C', 'D'][idx]})</strong>
                    <MathRichText content={opt} inline />
                  </span>
                  {checked && idx === resolvedCorrectIndex && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      Correct
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {verifyError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{verifyError}</p>
          )}

          {checked && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="font-semibold">
                {isCorrect
                  ? 'Spot On! Step-by-Step Verification:'
                  : 'Conceptual Trap Detected (Logged to My Mistakes Notebook) — Solution Breakdown:'}
              </div>
              <MathRichText content={resolvedExplanation} className="leading-relaxed" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-200 dark:border-white/[0.07]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLaunchFullCBT();
            }}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white underline-offset-4 hover:underline cursor-pointer"
          >
            Switch to Full 75-Q NTA CBT Mode →
          </button>

          <div className="flex items-center gap-2">
            {!checked ? (
              <button
                type="button"
                disabled={selectedOpt === null || verifying}
                onClick={handleCheckAnswer}
                className="px-5 py-2.5 rounded-xl btn-terracotta disabled:opacity-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                {verifying ? 'Verifying...' : 'Check Answer'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl btn-terracotta text-xs font-semibold transition-colors cursor-pointer"
              >
                Next Question →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
