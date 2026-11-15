diff --git a/src/components/GlobalOverlays.tsx b/src/components/GlobalOverlays.tsx
index 86ee85e..50c7dcf 100644
--- a/src/components/GlobalOverlays.tsx
+++ b/src/components/GlobalOverlays.tsx
@@ -62,15 +62,12 @@ import {
   listDriveStudyFiles,
   readGoogleDocContent,
   DriveFileItem,
-  saveDocumentToIndexedDb,
   extractPdfTextAndMetadataWithPdfJs,
   extractScannedPdfPagesViaOcr,
   apiFetchWithAuth,
   ingestYouTubeOnServer,
   reportQuestionIssueOnServer,
   verifySinglePyqAnswerOnServer,
-  requestSignedCloudStorageUrl,
-  confirmCloudUpload,
 } from '../services/workspaceService';
 import { wsUrl } from '../config/apiConfig';
 import {
@@ -104,6 +101,9 @@ interface AddMaterialModalProps {
     contentSummary: string;
     originalFileUrl?: string;
     originalMimeType?: string;
+    originalFile?: File;
+    pageCount?: number;
+    extractionQuality?: 'full' | 'partial' | 'needs_ocr' | 'unavailable';
   }) => Promise<void>;
 }
 
@@ -127,12 +127,18 @@ export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
   const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
   const [driveLoading, setDriveLoading] = useState(false);
   const [errorText, setErrorText] = useState<string | null>(null);
+  const cameraInput = useRef<HTMLInputElement>(null);
+  const importRequest = useRef<AbortController | null>(null);
 
   useEffect(() => {
     setActiveTab(initialTab);
     setErrorText(null);
     setAnalyzing(false);
     setStatusMessage('');
+    return () => {
+      importRequest.current?.abort();
+      importRequest.current = null;
+    };
   }, [initialTab, isOpen]);
 
   if (!isOpen) return null;
@@ -232,165 +238,132 @@ export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
     }
   };
 
-  const handleFileChange = async (
-    e: React.ChangeEvent<HTMLInputElement>,
-    mode: 'pdf' | 'photo'
-  ) => {
-    const file = e.target.files?.[0];
-    if (!file) return;
+  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
+    const file = event.currentTarget.files?.[0];
+    event.currentTarget.value = '';
+    if (!file || importRequest.current || analyzing) return;
+
+    const controller = new AbortController();
+    importRequest.current = controller;
+    const { signal } = controller;
+    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
+    const mimeType = isPdf ? 'application/pdf' : file.type.startsWith('image/') ? file.type : 'image/jpeg';
+    const original = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
     setErrorText(null);
     setAnalyzing(true);
-    setStatusMessage(
-      mode === 'photo'
-        ? `Auto-detecting JEE subject & chapter and running Handwritten Notes Scan on ${file.name}...`
-        : `Parsing ${file.name} via local pdf.js worker & storing binary in IndexedDB...`
-    );
+    setStatusMessage(isPdf ? 'Reading the PDF…' : 'Reading your handwritten notes…');
 
+    let text = '';
+    let pageCount = 1;
+    let extractionQuality: 'partial' | 'needs_ocr' | undefined;
     try {
-      const reader = new FileReader();
-      const dataUrlPromise = new Promise<string>((resolve, reject) => {
-        reader.onload = () => {
-          resolve(String(reader.result || ''));
-        };
-        reader.onerror = reject;
-      });
-      reader.readAsDataURL(file);
-      const fullDataUrl = await dataUrlPromise;
-      const base64Data = fullDataUrl.split(',')[1] || '';
-
-      let clientPdfText = '';
-      let pdfPageCount = 1;
-      let ocrNotesSummary = '';
-
-      if (mode === 'pdf' && file.name.toLowerCase().endsWith('.pdf')) {
-        const extractedPdf = await extractPdfTextAndMetadataWithPdfJs(
+      if (isPdf) {
+        const extracted = await extractPdfTextAndMetadataWithPdfJs(
           file,
-          (pct, cur, total) =>
-            setStatusMessage(`Extracting PDF page ${cur}/${total} (${pct}%)...`)
+          (pct, current, total) => {
+            if (!signal.aborted) setStatusMessage(`Reading PDF page ${current}/${total} (${pct}%)…`);
+          },
+          signal,
         );
-        if (extractedPdf.extractionError) {
-          setErrorText(extractedPdf.extractionError);
-          setAnalyzing(false);
-          setStatusMessage('');
-          return;
-        }
-        clientPdfText = extractedPdf.extractedText;
-        pdfPageCount = extractedPdf.pageCount;
-
-        if (extractedPdf.scannedPageNumbers.length > 0) {
-          setStatusMessage(
-            `Running vision OCR on ${Math.min(60, extractedPdf.scannedPageNumbers.length)} scanned page(s)...`
-          );
+        if (extracted.extractionError) throw new Error(extracted.extractionError);
+        text = extracted.extractedText;
+        pageCount = extracted.pageCount;
+        if (extracted.scannedPageNumbers.length) {
           const { ocrTextByPage } = await extractScannedPdfPagesViaOcr(
             file,
-            extractedPdf.scannedPageNumbers,
-            (done, total) =>
-              setStatusMessage(`Running vision OCR on scanned PDF pages (${done}/${total})...`)
+            extracted.scannedPageNumbers,
+            (done, total) => {
+              if (!signal.aborted) setStatusMessage(`Reading scanned pages (${done}/${total})…`);
+            },
+            signal,
           );
-          if (ocrTextByPage.size > 0) {
-            const existingBlocks = new Map<number, string>();
-            for (const block of clientPdfText.split(/\n{2,}/)) {
-              const m = /^\[Page\s+(\d+)\]/i.exec(block.trim());
-              if (m) existingBlocks.set(Number(m[1]), block.trim());
-            }
-            for (const [pgNum, txt] of ocrTextByPage.entries()) {
-              existingBlocks.set(pgNum, txt);
-            }
-            clientPdfText = Array.from(existingBlocks.entries())
-              .sort((a, b) => a[0] - b[0])
-              .map((entry) => entry[1])
-              .join('\n\n');
-            ocrNotesSummary = `Vision OCR completed on ${ocrTextByPage.size} scanned page(s).`;
+          const pages = new Map<number, string>();
+          for (const block of text.split(/\n{2,}/)) {
+            const marker = /^\[Page\s+(\d+)\]/i.exec(block.trim());
+            if (marker) pages.set(Number(marker[1]), block.trim());
           }
+          for (const [number, contents] of ocrTextByPage) pages.set(number, contents);
+          text = Array.from(pages.entries())
+            .sort(([left], [right]) => left - right)
+            .map(([, contents]) => contents)
+            .join('\n\n');
+          if (ocrTextByPage.size < extracted.scannedPageNumbers.length) extractionQuality = 'partial';
         }
-      }
-
-      const detectedMime = file.type || (mode === 'pdf' ? 'application/pdf' : 'image/jpeg');
-      const docId = `idb-doc-${Date.now()}`;
-      await saveDocumentToIndexedDb({
-        id: docId,
-        userId: 'active_user',
-        file,
-        title: file.name,
-        mimeType: detectedMime,
-        dataUrl: fullDataUrl,
-        extractedText: clientPdfText,
-        pageCount: pdfPageCount,
-        sizeBytes: file.size,
-        createdAt: new Date().toISOString(),
-      });
-
-      // Best-effort owner-scoped Cloud Storage upload when bucket is configured
-      try {
-        const ticket = await requestSignedCloudStorageUrl({
-          fileName: file.name,
-          mimeType: detectedMime,
-          operation: 'upload',
-          sizeBytes: file.size,
-        });
-        if (ticket.ok && ticket.storageConfigured && ticket.signedUrl && ticket.assetId) {
-          const putRes = await fetch(ticket.signedUrl, {
-            method: 'PUT',
-            headers: { 'Content-Type': detectedMime },
-            body: file,
-          });
-          if (putRes.ok) {
-            await confirmCloudUpload(ticket.assetId);
+        if (pageCount > 250) extractionQuality = 'partial';
+      } else {
+        try {
+          let imageFile = original;
+          if (original.size > 8 * 1024 * 1024) {
+            const image = await createImageBitmap(original);
+            try {
+              const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
+              const canvas = document.createElement('canvas');
+              canvas.width = Math.max(1, Math.round(image.width * scale));
+              canvas.height = Math.max(1, Math.round(image.height * scale));
+              const context = canvas.getContext('2d');
+              if (!context) throw new Error('Image resizing is unavailable.');
+              context.fillStyle = '#fff';
+              context.fillRect(0, 0, canvas.width, canvas.height);
+              context.drawImage(image, 0, 0, canvas.width, canvas.height);
+              const resized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
+              if (!resized) throw new Error('Unable to resize this image.');
+              imageFile = new File([resized], file.name, { type: resized.type });
+            } finally {
+              image.close();
+            }
           }
+          const dataUrl = await new Promise<string>((resolve, reject) => {
+            const reader = new FileReader();
+            reader.onload = () => resolve(String(reader.result ?? ''));
+            reader.onerror = () => reject(new Error('Unable to read the selected image.'));
+            reader.readAsDataURL(imageFile);
+          });
+          signal.throwIfAborted();
+          const result = await apiFetchWithAuth<{ text?: string }>(
+            '/api/ai/analyze',
+            {
+              sourceType: 'photo',
+              mediaBase64: dataUrl.split(',')[1],
+              mimeType: imageFile.type,
+              prompt: 'Transcribe the visible handwritten text and equations verbatim. Mark unreadable words as [unreadable]. Do not add explanations, facts, or formulas.',
+            },
+            'POST',
+            { signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]) },
+          );
+          if (result.ok) text = result.data.text?.trim() || '';
+        } catch {
+          // A failed transcription can still leave a usable original in the workspace.
         }
-      } catch {
-        // Cloud Storage optional in local dev; IndexedDB holds full document safely
-      }
-
-      const fileStem = file.name.replace(/\.[^/.]+$/, '');
-      const initialDetection = detectJeeSubjectAndChapter(
-        `${fileStem} ${clientPdfText.slice(0, 2000)}`,
-        titleInput
-      );
-
-      let aiText = '';
-      if (mode === 'photo' || clientPdfText.trim().length < 80) {
-        const { ok, data } = await apiFetchWithAuth<{ text?: string }>(
-          '/api/ai/analyze',
-          {
-            mediaBase64: base64Data.slice(0, 600000),
-            mimeType: detectedMime,
-            sourceType: mode,
-            prompt: `Automatically identify whether this material belongs to JEE Physics, Chemistry, or Mathematics and which chapter it covers, then extract concise notes for "${initialDetection.chapter}" from ${file.name}.\n\nExtracted Text Context:\n${clientPdfText.slice(0, 4000)}`,
-          }
-        );
-        aiText = ok ? data.text || '' : '';
       }
-
-      const finalDetection = detectJeeSubjectAndChapter(
-        `${fileStem} ${clientPdfText.slice(0, 2000)} ${aiText}`,
-        titleInput
-      );
-
+      signal.throwIfAborted();
+      const detected = detectJeeSubjectAndChapter(`${file.name} ${text.slice(0, 3000)}`, titleInput);
+      setStatusMessage('Saving the source on this device…');
       await onAddMaterial({
-        title: titleInput.trim() || finalDetection.chapter || file.name,
-        subject: finalDetection.subject,
-        chapter: finalDetection.chapter,
-        sourceType: mode,
+        title: titleInput.trim() || detected.chapter || file.name,
+        subject: detected.subject,
+        chapter: detected.chapter,
+        sourceType: isPdf ? 'pdf' : 'photo',
         sourceRef: file.name,
-        originalFileUrl: fullDataUrl,
-        originalMimeType: detectedMime,
-        contentSummary: clientPdfText
-          ? aiText
-            ? `${clientPdfText}\n\n---\n### AI Extracted Notes\n${aiText}`
-            : ocrNotesSummary
-            ? `${clientPdfText}\n\n<!-- ${ocrNotesSummary} -->`
-            : clientPdfText
-          : aiText ||
-            `**${finalDetection.chapter}** (${finalDetection.subject}): IndexedDB-stored document (${pdfPageCount} pages) from ${file.name}. Needs OCR or text extraction.`,
+        originalFile: original,
+        originalMimeType: mimeType,
+        contentSummary: text,
+        pageCount,
+        extractionQuality: text ? extractionQuality : 'needs_ocr',
       });
+      if (signal.aborted) return;
       setTitleInput('');
       onClose();
-    } catch (err: any) {
-      setErrorText(err?.message || 'Could not analyze uploaded file.');
+
+    } catch (error) {
+      if (!signal.aborted) {
+        setErrorText(error instanceof Error ? error.message : 'Unable to save this file.');
+      }
     } finally {
-      setAnalyzing(false);
-      setStatusMessage('');
+      if (importRequest.current === controller) {
+        importRequest.current = null;
+        setAnalyzing(false);
+        setStatusMessage('');
+      }
     }
   };
 
@@ -399,10 +372,10 @@ export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
       setErrorText('Please paste your study text, handwritten transcription, or formulas first.');
       return;
     }
+    if (analyzing) return;
+    setErrorText(null);
     setAnalyzing(true);
-    setStatusMessage(
-      'Auto-identifying JEE subject & chapter and structuring your notes into full detailed pages, flashcards & mind map...'
-    );
+    setStatusMessage('Saving your notes on this device…');
     try {
       const detected = detectJeeSubjectAndChapter(pastedText, titleInput);
       await onAddMaterial({
@@ -416,6 +389,8 @@ export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
       setTitleInput('');
       setPastedText('');
       onClose();
+    } catch (error) {
+      setErrorText(error instanceof Error ? error.message : 'Unable to save your notes.');
     } finally {
       setAnalyzing(false);
       setStatusMessage('');
@@ -619,7 +594,8 @@ export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
               <input
                 type="file"
                 accept=".pdf,image/*"
-                onChange={(e) => handleFileChange(e, 'pdf')}
+                onChange={handleFileChange}
+                disabled={analyzing}
                 className="hidden"
               />
             </label>
@@ -639,10 +615,31 @@ export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
               <input
                 type="file"
                 accept="image/*"
-                onChange={(e) => handleFileChange(e, 'photo')}
+                onChange={handleFileChange}
+                disabled={analyzing}
                 className="hidden"
               />
             </label>
+            <button
+              type="button"
+              disabled={analyzing}
+              onClick={() => cameraInput.current?.click()}
+              className="min-h-11 px-4 py-2 rounded-lg border border-zinc-300 text-sm font-semibold dark:border-white/20"
+            >
+              Take Photo
+            </button>
+            <input
+              ref={cameraInput}
+              type="file"
+              accept="image/*"
+              capture="environment"
+              onChange={handleFileChange}
+              disabled={analyzing}
+              hidden
+            />
+            <p className="text-xs text-zinc-600 dark:text-zinc-300">
+              Review the transcription against the original photo.
+            </p>
           </div>
         )}
 
@@ -721,6 +718,8 @@ export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
             <button
               type="button"
               onClick={() => {
+                importRequest.current?.abort();
+                importRequest.current = null;
                 setAnalyzing(false);
                 setStatusMessage('');
               }}
@@ -3225,7 +3224,7 @@ export const ProfileModal: React.FC<ProfileModalProps> = ({
 
             <div>
               <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
-                Target AIR / Percentile Goal
+                Personal exam goal
               </label>
               <input
                 type="text"
@@ -3233,7 +3232,7 @@ export const ProfileModal: React.FC<ProfileModalProps> = ({
                 onChange={(e) =>
                   setFormState((s) => ({ ...s, targetRankOrPercentile: e.target.value }))
                 }
-                placeholder="e.g., 99.5+ Percentile / AIR < 1500"
+                placeholder="Enter your own goal (optional)"
                 className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100"
               />
             </div>
diff --git a/src/components/HomeAndStudyViews.tsx b/src/components/HomeAndStudyViews.tsx
index 8fc0f93..19a9e9f 100644
--- a/src/components/HomeAndStudyViews.tsx
+++ b/src/components/HomeAndStudyViews.tsx
@@ -109,6 +109,7 @@ interface TutorChatTurn {
   text: string;
   contextMode: 'strict_material' | 'open_jee';
   citations?: { pageNumber: number; excerpt: string }[];
+  failed?: boolean;
   embeddedVisual?: {
     type: '2D Diagram' | '3D Scene' | 'Concept Image' | 'Animated Video';
     preset?: Preset3DId;
@@ -1353,20 +1354,26 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
     try {
       const res = await apiFetchWithAuth<{
         text?: string;
-        citations?: { pageNumber: number; excerpt: string }[];
+        citations?: { pageNumber: number; snippet: string }[];
+        verificationStatus?: string;
       }>('/api/ai/tutor', {
         prompt: promptText,
         materialId: selectedMaterial?.id,
         language: tutorLang,
         contextMode: tutorContextMode,
-        difficulty: tutorDifficulty,
-        context: currentPageData
-          ? JSON.stringify(currentPageData)
-          : selectedMaterial?.contentSummary || '',
-      });
+        difficultyLevel: tutorDifficulty,
+        currentPage: currentPageData?.pageNumber,
+        context: selectedMaterial?.contentSummary.trim()
+          ? currentPageData?.sections[0]?.paragraphs?.join('\n\n') || ''
+          : '',
+      }, 'POST', { signal: AbortSignal.timeout(40_000) });
       const replyText = res.ok
-        ? res.data.text || 'Tutor did not return an explanation. Please try again.'
-        : `[${res.error.errorCode}] ${res.error.message}`;
+        ? res.data.text?.trim() || 'The tutor returned an empty answer. Please try again.'
+        : res.error.status === 401
+          ? 'Sign in to ask the tutor.'
+          : 'The tutor is temporarily unavailable. Your saved source is still accessible.';
+      const failed = !res.ok || !res.data.text?.trim() ||
+        res.data.verificationStatus === 'insufficient_material_context';
 
       setTutorChat((prev) => [
         ...prev,
@@ -1375,7 +1382,11 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
           role: 'tutor',
           text: replyText,
           contextMode: tutorContextMode,
-          citations: res.ok && Array.isArray(res.data.citations) ? res.data.citations : undefined,
+          failed,
+          citations: res.ok ? res.data.citations?.map(({ pageNumber, snippet }) => ({
+            pageNumber,
+            excerpt: snippet,
+          })) : undefined,
         },
       ]);
     } catch {
@@ -1386,6 +1397,7 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
           role: 'tutor',
           text: 'Could not reach AI Tutor. Please try again.',
           contextMode: tutorContextMode,
+          failed: true,
         },
       ]);
     } finally {
@@ -1561,7 +1573,7 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
     if (!currentPageData) return;
     setTtsPlaying(true);
     try {
-      const lastTutor = [...tutorChat].reverse().find((t) => t.role === 'tutor');
+      const lastTutor = [...tutorChat].reverse().find((t) => t.role === 'tutor' && !t.failed);
       const textToSpeak =
         lastTutor?.text ||
         currentPageData.aiTutorSummary[tutorLang === 'Hinglish' ? 'hinglish' : 'english'];
@@ -2678,6 +2690,7 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
                             <div className="space-y-3">
                               {selectedMaterial.originalFileUrl &&
                               (selectedMaterial.originalFileUrl.startsWith('data:image') ||
+                                selectedMaterial.originalFileUrl.startsWith('blob:') ||
                                 selectedMaterial.originalFileUrl.startsWith('http')) ? (
                                 <div className="p-3 bg-white dark:bg-[#111113] rounded-xl border border-zinc-200 dark:border-white/[0.07] flex justify-center">
                                   <img
@@ -2757,8 +2770,19 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
                       </div>
                     )}
 
-                    {/* FULL DETAILED NOTES OR QUICK NOTES VIEW */}
-                    {(notesDensity === 'Full' || notesDensity === 'Quick') && (
+                    {notesDensity === 'Quick' && (
+                      <section aria-label="Quick Notes" className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-white/10">
+                        <h2 className="text-lg font-semibold">Quick Notes</h2>
+                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
+                          Source excerpt · {currentPageData.timestampRange || `Page ${currentPageData.pageNumber}`}
+                        </p>
+                        <MathRichText content={currentPageData.aiTutorSummary.english} />
+                        {Array.from(new Set(currentPageData.sections.flatMap((section) => section.formulas || [])))
+                          .slice(0, 4)
+                          .map((formula) => <MathRichText key={formula} content={formula} />)}
+                      </section>
+                    )}
+                    {notesDensity === 'Full' && (
                       <>
                         <h2 className="font-semibold tracking-[-0.02em] text-xl sm:text-2xl text-zinc-900 dark:text-zinc-50">
                           <MathRichText content={currentPageData.heading} inline />
@@ -2801,8 +2825,7 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
                               <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                                 <MathRichText content={sec.numberTitle} inline />
                               </h3>
-                              {notesDensity === 'Full' &&
-                                sec.paragraphs?.map((p, pIdx) => (
+                              {sec.paragraphs?.map((p, pIdx) => (
                                   <div
                                     key={pIdx}
                                     className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
@@ -3102,7 +3125,10 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
                                 <button
                                   key={cIdx}
                                   type="button"
-                                  onClick={() => setPageIdx(Math.max(0, cit.pageNumber - 1))}
+                                  onClick={() => {
+                                    const index = pagesList.findIndex((page) => page.pageNumber === cit.pageNumber);
+                                    if (index >= 0) setPageIdx(index);
+                                  }}
                                   className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#18181b] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.07] text-[10px] font-medium hover:bg-zinc-200 dark:hover:bg-[#1f1f23] cursor-pointer"
                                   title={cit.excerpt}
                                 >
@@ -3112,7 +3138,7 @@ export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
                             </div>
                           )}
 
-                          {turn.role === 'tutor' && (
+                          {turn.role === 'tutor' && !turn.failed && (
                             <div className="pt-2 border-t border-zinc-200 dark:border-white/[0.07] space-y-2">
                               <button
                                 type="button"
diff --git a/src/components/RevisePracticeProgressCBT.tsx b/src/components/RevisePracticeProgressCBT.tsx
index 18a3993..07d5dd3 100644
--- a/src/components/RevisePracticeProgressCBT.tsx
+++ b/src/components/RevisePracticeProgressCBT.tsx
@@ -2338,7 +2338,7 @@ export const ProgressDashboardView: React.FC<ProgressViewProps> = ({
             {lastMockScore !== null ? `${lastMockScore} / 300` : 'Not Attempted'}
           </div>
           <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
-            {lastMockScore !== null ? 'Est. 98.4+ Percentile' : 'Take your first 75-Q CBT'}
+            {lastMockScore !== null ? 'Latest completed mock' : 'Take your first 75-Q CBT'}
           </div>
         </div>
 
diff --git a/src/components/analytics/ProgressAndRankView.tsx b/src/components/analytics/ProgressAndRankView.tsx
index a6292a5..cfad3ae 100644
--- a/src/components/analytics/ProgressAndRankView.tsx
+++ b/src/components/analytics/ProgressAndRankView.tsx
@@ -1,16 +1,6 @@
 import React, { useState, useMemo } from 'react';
-import {
-  Award,
-  BarChart3,
-  CheckCircle2,
-  Flame,
-  Layers,
-  Play,
-  Sliders,
-  Target,
-  TrendingUp,
-} from 'lucide-react';
-import { predictNtaPercentileAndAir, ExamTrack } from '../../utils/jeeEngine';
+import { Play, Sliders } from 'lucide-react';
+import type { ExamTrack } from '../../utils/jeeEngine';
 import { JEE_SYLLABUS_DATA } from '../../data/jeeInitialContent';
 import { getDaysToJeeMain2027Session1 } from '../../config/examSpecs';
 import type { MistakeNotebookEntry } from '../RevisePracticeProgressCBT';
@@ -38,23 +28,10 @@ export const ProgressAndRankView: React.FC<ProgressAndRankViewProps> = ({
   onOpenCustomTestGenerator,
   onPracticeWeakTopic,
 }) => {
-  const [shiftDifficulty, setShiftDifficulty] = useState<'Easy' | 'Moderate' | 'Tough'>('Moderate');
-  const [simulatedScore, setSimulatedScore] = useState<number>(lastMockScore ?? 185);
   const [heatmapSubject, setHeatmapSubject] = useState<
     'All' | 'Physics' | 'Chemistry' | 'Mathematics'
   >('All');
 
-  const activeScore = lastMockScore !== null ? lastMockScore : simulatedScore;
-  const prediction = useMemo(
-    () =>
-      predictNtaPercentileAndAir({
-        score: activeScore,
-        maxScore: 300,
-        shiftDifficulty,
-      }),
-    [activeScore, shiftDifficulty]
-  );
-
   const filteredSyllabus = useMemo(
     () =>
       JEE_SYLLABUS_DATA.filter(
@@ -95,7 +72,7 @@ export const ProgressAndRankView: React.FC<ProgressAndRankViewProps> = ({
       <div className="flex flex-wrap items-center justify-between gap-4">
         <div>
           <h1 className="font-semibold tracking-[-0.02em] text-2xl text-zinc-900 dark:text-zinc-50">
-            Progress &amp; Rank
+            Progress
           </h1>
           <p className="text-xs font-mono tabular-nums text-zinc-500 mt-0.5">
             JEE Main 2027 · {masteryStats.daysToExam}d left · {masteryStats.weightedMasteryPct}% mastery
@@ -124,82 +101,7 @@ export const ProgressAndRankView: React.FC<ProgressAndRankViewProps> = ({
       </div>
 
       <div className="p-6 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] grid grid-cols-1 lg:grid-cols-12 gap-6">
-        <div className="lg:col-span-7 space-y-4">
-          <div className="flex flex-wrap items-center justify-between gap-2">
-            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
-              Percentile &amp; AIR Predictor
-            </span>
-            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-[#18181b] p-1 rounded-lg">
-              {(['Easy', 'Moderate', 'Tough'] as const).map((shift) => (
-                <button
-                  key={shift}
-                  type="button"
-                  onClick={() => setShiftDifficulty(shift)}
-                  className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors duration-150 ${
-                    shiftDifficulty === shift
-                      ? 'bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100'
-                      : 'text-zinc-500'
-                  }`}
-                >
-                  {shift} Shift
-                </button>
-              ))}
-            </div>
-          </div>
-
-          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
-            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07]">
-              <div className="text-[11px] font-medium text-zinc-500">NTA Percentile</div>
-              <div className="text-2xl font-mono font-bold tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
-                {prediction.percentile}%ile
-              </div>
-              <div className="text-[11px] text-zinc-500 mt-0.5">
-                {shiftDifficulty} normalization
-              </div>
-            </div>
-
-            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07]">
-              <div className="text-[11px] font-medium text-zinc-500">Predicted AIR</div>
-              <div className="text-xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
-                {prediction.predictedAirMin.toLocaleString()}–{prediction.predictedAirMax.toLocaleString()}
-              </div>
-              <div className="text-[11px] text-zinc-500 mt-0.5">
-                14.2L candidates
-              </div>
-            </div>
-
-            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07]">
-              <div className="text-[11px] font-medium text-zinc-500">Score</div>
-              <div className="text-2xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
-                {activeScore} / 300
-              </div>
-              <div className="text-[11px] text-zinc-500 mt-0.5">
-                {lastMockScore !== null ? 'Latest CBT' : 'What-If Slider'}
-              </div>
-            </div>
-          </div>
-
-          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] space-y-2">
-            <div className="flex items-center justify-between text-xs font-medium">
-              <span className="text-zinc-600 dark:text-zinc-300">Simulate Target Score</span>
-              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{activeScore} / 300</span>
-            </div>
-            <input
-              type="range"
-              min={0}
-              max={300}
-              step={5}
-              value={activeScore}
-              onChange={(e) => setSimulatedScore(Number(e.target.value))}
-              className="w-full accent-[#D4653B] cursor-pointer"
-            />
-            <div className="text-xs text-zinc-600 dark:text-zinc-400">
-              Projected Tier: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{prediction.targetInstituteTier}</span>
-            </div>
-          </div>
-        </div>
-
-        <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] flex flex-col justify-between space-y-4">
+        <div className="lg:col-span-12 p-5 rounded-2xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.07] flex flex-col justify-between space-y-4">
           <div>
             <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
               Mastery &amp; Error Bleed
diff --git a/src/components/cbt/CustomTestGeneratorModal.tsx b/src/components/cbt/CustomTestGeneratorModal.tsx
index d7b77ee..08cb51c 100644
--- a/src/components/cbt/CustomTestGeneratorModal.tsx
+++ b/src/components/cbt/CustomTestGeneratorModal.tsx
@@ -390,7 +390,7 @@ export const CustomTestGeneratorModal: React.FC<CustomTestGeneratorModalProps> =
         {/* Footer */}
         <div className="px-6 py-4 border-t border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-[#141417] flex items-center justify-between gap-3">
           <div className="text-xs text-zinc-500 dark:text-zinc-400">
-            NTA Marking <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-200">+4 / -1</span> · Percentile Predictor Active
+            NTA Marking <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-200">+4 / -1</span>
           </div>
           <div className="flex items-center gap-2">
             <button
diff --git a/src/firebase.ts b/src/firebase.ts
index 97806e7..f901902 100644
--- a/src/firebase.ts
+++ b/src/firebase.ts
@@ -82,7 +82,6 @@ export function loadValidatedFirebaseConfig(): FirebaseEnvConfig | null {
 
 export function formatFirebaseAuthError(error: any): string {
   const code = String(error?.code || '').toLowerCase();
-  const msg = String(error?.message || '');
 
   if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) {
     return 'Firebase API key configuration is invalid or out of sync. Please refresh the page or verify your Firebase web config.';
@@ -118,7 +117,7 @@ export function formatFirebaseAuthError(error: any): string {
   if (code === 'auth/network-request-failed') {
     return 'Network error reaching Firebase Authentication. Check your internet connection and try again.';
   }
-  return msg || 'Authentication failed. Please try again or continue with Google.';
+  return 'Sign-in could not be completed. Please try again or use another sign-in method.';
 }
 
 const firebaseConfig = loadValidatedFirebaseConfig();
diff --git a/src/hooks/useLearnMateAppState.ts b/src/hooks/useLearnMateAppState.ts
index 57fd014..3a9adb9 100644
--- a/src/hooks/useLearnMateAppState.ts
+++ b/src/hooks/useLearnMateAppState.ts
@@ -1,4 +1,4 @@
-import { useState, useEffect } from 'react';
+import { useState, useEffect, useRef } from 'react';
 import {
   db,
   isFirebaseConfigured,
@@ -51,9 +51,13 @@ import {
   deleteAccountOnServer,
   fetchCommercialEntitlements,
   ingestDocumentOnServer,
+  listStudyMaterialsOnDevice,
+  removeStudyMaterialFromDevice,
+  saveStudyMaterialOnDevice,
   purgeUserFirestoreData,
   syncChunkedMaterialToFirestore,
   syncRevisionStateToFirestore,
+  syncStudyOriginalToCloud,
 } from '../services/workspaceService';
 import { runOneTimeTenantMigration } from '../services/migrationService';
 import {
@@ -142,6 +146,10 @@ export function useLearnMateAppState() {
 
   const [materials, setMaterials] = useState<MaterialItem[]>([]);
   const [materialBundles, setMaterialBundles] = useState<Record<string, MaterialStudyBundle>>({});
+  const workspaceUid = currentUser?.uid;
+  const materialOwner = useRef<string | undefined>(undefined);
+  const savedMaterialIds = useRef(new Set<string>());
+  const originalUrls = useRef(new Map<string, string>());
   const [tasks, setTasks] = useState<StudyTaskItem[]>([]);
   const [creations, setCreations] = useState<CreationItem[]>([]);
   const [mistakesNotebook, setMistakesNotebook] = useState<MistakeNotebookEntry[]>([]);
@@ -187,7 +195,7 @@ export function useLearnMateAppState() {
     dailyGoalHours: 6,
     batchStatus: 'Class 12',
     coachingName: 'Self-Study + LearnMate JEE',
-    targetRankOrPercentile: '99.5+ Percentile / AIR < 1500',
+    targetRankOrPercentile: '',
   });
 
   useEffect(() => {
@@ -632,21 +640,63 @@ export function useLearnMateAppState() {
     };
   }, []);
 
+  const withOriginalPreview = (material: MaterialItem, original?: File): MaterialItem => {
+    if (!original) return material;
+    const previous = originalUrls.current.get(material.id);
+    if (previous) return { ...material, originalFileUrl: previous };
+    const url = URL.createObjectURL(original);
+    originalUrls.current.set(material.id, url);
+    return { ...material, originalFileUrl: url };
+  };
+
   useEffect(() => {
-    if (!currentUser || isLocalOrDemoUid(currentUser.uid) || !isFirebaseConfigured || !db) {
-      return;
-    }
-    const materialsRef = collection(db, 'users', currentUser.uid, 'materials');
-    const q = query(materialsRef, orderBy('createdAt', 'desc'));
+    setMaterials([]);
+    setMaterialBundles({});
+    setSelectedMaterial(null);
+    materialOwner.current = workspaceUid;
+    if (!workspaceUid) return;
+
+    let active = true;
+    void listStudyMaterialsOnDevice(workspaceUid)
+      .then((records) => {
+        if (!active) return;
+        const restored = records
+          .filter(({ material }) => !savedMaterialIds.current.has(material.id))
+          .map(({ material, bundle, original }) => {
+            savedMaterialIds.current.add(material.id);
+            return { material: withOriginalPreview(material, original), bundle };
+          });
+        const restoredIds = new Set(restored.map(({ material }) => material.id));
+        setMaterials((previous) => [
+          ...restored.map(({ material }) => material),
+          ...previous.filter(({ id }) => !restoredIds.has(id)),
+        ]);
+        setMaterialBundles((previous) => ({
+          ...previous,
+          ...Object.fromEntries(restored.map(({ material, bundle }) => [material.id, bundle])),
+        }));
+        setSelectedMaterial((previous) =>
+          restored.find(({ material }) => material.id === previous?.id)?.material ??
+          previous ??
+          restored[0]?.material ??
+          null
+        );
+      })
+      .catch(() => {
+        if (active) showToast('Unable to open study materials saved on this device.');
+      });
 
-    const unsub = onSnapshot(
-      q,
-      (snapshot) => {
-        if (!snapshot.empty) {
-          const loaded: MaterialItem[] = snapshot.docs.map((d) => {
-            const data = d.data();
+    let unsubscribe: (() => void) | undefined;
+    if (!isLocalOrDemoUid(workspaceUid) && isFirebaseConfigured && db) {
+      const materialsRef = collection(db, 'users', workspaceUid, 'materials');
+      unsubscribe = onSnapshot(
+        query(materialsRef, orderBy('createdAt', 'desc')),
+        (snapshot) => {
+          if (!active) return;
+          const cloudMaterials: MaterialItem[] = snapshot.docs.map((document) => {
+            const data = document.data();
             return {
-              id: d.id,
+              id: document.id,
               title: data.title || 'Untitled Material',
               subject: (data.subject as MaterialItem['subject']) || 'Physics',
               chapter: data.chapter || 'General',
@@ -654,45 +704,51 @@ export function useLearnMateAppState() {
               sourceRef: data.sourceRef || '',
               pageCount: data.pageCount || 1,
               currentPage: data.currentPage || 1,
-              progressPct: 15,
+              progressPct: data.progressPct ?? 15,
               contentSummary: data.contentSummary || '',
               addedLabel: 'Uploaded',
             };
           });
-          setMaterials(loaded);
-          setMaterialBundles((prev) => {
-            const next = { ...prev };
-            loaded.forEach((m) => {
-              if (!next[m.id]) {
-                next[m.id] = generateMaterialStudyBundle({
-                  materialId: m.id,
-                  title: m.title,
-                  subject: m.subject,
-                  chapter: m.chapter,
-                  sourceType: m.sourceType,
-                  rawText: m.contentSummary,
-                });
-              }
-            });
+          const cloudOnly = cloudMaterials.filter(({ id }) => !savedMaterialIds.current.has(id));
+          setMaterials((previous) => [
+            ...previous.filter(({ id }) => savedMaterialIds.current.has(id)),
+            ...cloudOnly,
+          ]);
+          setMaterialBundles((previous) => {
+            const next = { ...previous };
+            for (const material of cloudOnly) {
+              if (next[material.id]) continue;
+              next[material.id] = generateMaterialStudyBundle({
+                materialId: material.id,
+                title: material.title,
+                subject: material.subject,
+                chapter: material.chapter,
+                sourceType: material.sourceType,
+                rawText: material.contentSummary,
+              });
+            }
             return next;
           });
-          setSelectedMaterial((cur) => cur || loaded[0] || null);
-        } else {
-          setMaterials([]);
-          setSelectedMaterial(null);
-        }
-      },
-      (err) => {
-        try {
-          handleFirestoreError(err, OperationType.LIST, `users/${currentUser.uid}/materials`);
-        } catch {
-          // Ignore snapshot error if offline
-        }
-      }
-    );
+          setSelectedMaterial((previous) => {
+            if (previous && savedMaterialIds.current.has(previous.id)) return previous;
+            return cloudOnly.find(({ id }) => id === previous?.id) ?? cloudOnly[0] ?? null;
+          });
+        },
+        () => {
+          if (active) showToast('Cloud materials are unavailable. Materials on this device are still accessible.');
+        },
+      );
+    }
 
-    return () => unsub();
-  }, [currentUser]);
+    return () => {
+      active = false;
+      unsubscribe?.();
+      materialOwner.current = undefined;
+      savedMaterialIds.current.clear();
+      for (const url of originalUrls.current.values()) URL.revokeObjectURL(url);
+      originalUrls.current.clear();
+    };
+  }, [workspaceUid]);
 
   const handleSaveStudentProfile = async (updated: StudentProfileData) => {
     setStudentProfile(updated);
@@ -778,8 +834,15 @@ export function useLearnMateAppState() {
     contentSummary: string;
     originalFileUrl?: string;
     originalMimeType?: string;
+    originalFile?: File;
+    pageCount?: number;
+    extractionQuality?: MaterialStudyBundle['extractionQuality'];
   }) => {
-    const newId = `mat-${Date.now()}`;
+    const owner = currentUser;
+    if (!owner || materialOwner.current !== owner.uid) {
+      throw new Error('Open a study workspace before saving material.');
+    }
+    const newId = `mat-${crypto.randomUUID()}`;
     const bundle = generateMaterialStudyBundle({
       materialId: newId,
       title: newMat.title,
@@ -791,6 +854,8 @@ export function useLearnMateAppState() {
       originalMimeType: newMat.originalMimeType,
     });
 
+    if (newMat.extractionQuality) bundle.extractionQuality = newMat.extractionQuality;
+
     const localItem: MaterialItem = {
       id: newId,
       title: newMat.title,
@@ -800,55 +865,77 @@ export function useLearnMateAppState() {
       sourceRef: newMat.sourceRef,
       originalFileUrl: newMat.originalFileUrl || newMat.sourceRef,
       originalMimeType: newMat.originalMimeType,
-      pageCount: bundle.pages.length,
+      pageCount: newMat.pageCount ?? bundle.pages.length,
       currentPage: 1,
       progressPct: 15,
       contentSummary: newMat.contentSummary,
       addedLabel: 'Just now',
     };
 
+    await saveStudyMaterialOnDevice(owner.uid, localItem, bundle, newMat.originalFile);
+    if (materialOwner.current !== owner.uid) return;
+
+    const renderedMaterial = withOriginalPreview(localItem, newMat.originalFile);
+    savedMaterialIds.current.add(newId);
     setMaterialBundles((prev) => ({ ...prev, [newId]: bundle }));
-    setMaterials((prev) => [localItem, ...prev]);
-    setSelectedMaterial(localItem);
-    setStudySubTab('Chapter Notes');
+    setMaterials((prev) => [renderedMaterial, ...prev]);
+    setSelectedMaterial(renderedMaterial);
+    setStudySubTab(bundle.extractionQuality === 'needs_ocr' ? 'My Materials' : 'Chapter Notes');
     setActiveTab('Study');
-    setXp((x) => x + 25);
-    if (streakDays === 0) setStreakDays(1);
+    if (newMat.contentSummary.trim()) {
+      setXp((x) => x + 25);
+      if (streakDays === 0) setStreakDays(1);
+    }
     showToast(
-      `Indexed "${newMat.title}" (${bundle.pages.length} page${
-        bundle.pages.length === 1 ? '' : 's'
-      }) with ${bundle.extractionQuality === 'full' ? 'full source text' : bundle.extractionQuality}!`
+      bundle.extractionQuality === 'needs_ocr'
+        ? 'Original saved on this device. No readable text was extracted.'
+        : bundle.extractionQuality === 'partial'
+          ? 'Saved on this device. Some source text may be incomplete.'
+          : `Saved "${newMat.title}" on this device.`
     );
 
-    if (newMat.contentSummary.trim().length > 0) {
-      ingestDocumentOnServer({
-        materialId: newId,
-        title: newMat.title,
-        subject: newMat.subject,
-        chapter: newMat.chapter,
-        sourceType: newMat.sourceType,
-        sourceRef: newMat.sourceRef,
-        rawText: newMat.contentSummary,
-      }).catch(() => {});
-    }
-
-    if (currentUser && !isLocalOrDemoUid(currentUser.uid) && isFirebaseConfigured && db) {
-      const syncRes = await syncChunkedMaterialToFirestore(currentUser.uid, newId, {
-        title: newMat.title,
-        subject: newMat.subject,
-        chapter: newMat.chapter,
-        sourceType: newMat.sourceType,
-        sourceRef: newMat.sourceRef || '',
-        pageCount: bundle.pages.length,
-        currentPage: 1,
-        progressPct: 15,
-        contentSummary: newMat.contentSummary || '',
-        extractionQuality: bundle.extractionQuality,
-      });
-      if (!syncRes.synced && syncRes.error) {
-        showToast(syncRes.error);
+    if (isLocalOrDemoUid(owner.uid) || !isFirebaseConfigured || !db) return;
+    void (async () => {
+      try {
+        const idToken = await owner.getIdToken();
+        if (materialOwner.current !== owner.uid) return;
+        const [sync, indexed, uploaded] = await Promise.all([
+          syncChunkedMaterialToFirestore(owner.uid, newId, {
+            title: newMat.title,
+            subject: newMat.subject,
+            chapter: newMat.chapter,
+            sourceType: newMat.sourceType,
+            sourceRef: newMat.sourceRef || '',
+            pageCount: localItem.pageCount,
+            currentPage: 1,
+            progressPct: 15,
+            contentSummary: newMat.contentSummary,
+            extractionQuality: bundle.extractionQuality,
+          }),
+          newMat.contentSummary.trim()
+            ? ingestDocumentOnServer({
+                materialId: newId,
+                title: newMat.title,
+                subject: newMat.subject,
+                chapter: newMat.chapter,
+                sourceType: newMat.sourceType,
+                sourceRef: newMat.sourceRef,
+                rawText: newMat.contentSummary,
+              }, idToken)
+            : Promise.resolve({ ok: true }),
+          newMat.originalFile
+            ? syncStudyOriginalToCloud(newMat.originalFile, idToken).catch(() => false)
+            : Promise.resolve(true),
+        ]);
+        if (materialOwner.current === owner.uid && (!sync.synced || !indexed.ok || !uploaded)) {
+          showToast('Saved on this device. Cloud sync or tutor indexing did not finish.');
+        }
+      } catch {
+        if (materialOwner.current === owner.uid) {
+          showToast('Saved on this device. Cloud sync is unavailable.');
+        }
       }
-    }
+    })();
   };
 
   const handleUpdateMaterialPage = (
@@ -870,7 +957,20 @@ export function useLearnMateAppState() {
     showToast(`Saved annotated Page ${pageNumber} back to your library!`);
   };
 
-  const handleDeleteMaterial = (matId: string) => {
+  const handleDeleteMaterial = async (matId: string) => {
+    const uid = materialOwner.current;
+    if (!uid) return;
+    try {
+      await removeStudyMaterialFromDevice(uid, matId);
+    } catch {
+      if (materialOwner.current === uid) showToast('Unable to remove material from this device.');
+      return;
+    }
+    if (materialOwner.current !== uid) return;
+    savedMaterialIds.current.delete(matId);
+    const originalUrl = originalUrls.current.get(matId);
+    if (originalUrl) URL.revokeObjectURL(originalUrl);
+    originalUrls.current.delete(matId);
     setMaterials((prev) => {
       const remaining = prev.filter((m) => m.id !== matId);
       if (selectedMaterial?.id === matId) {
diff --git a/src/server/coreStudyEngine.ts b/src/server/coreStudyEngine.ts
index f627bd2..fbfe227 100644
--- a/src/server/coreStudyEngine.ts
+++ b/src/server/coreStudyEngine.ts
@@ -4,7 +4,6 @@ import {
   CBTQuestion,
   CBTMockSummary,
   calculateCBTMockScore,
-  predictNtaPercentileAndAir,
   QuestionResponseState,
   ExamTrack,
 } from '../utils/jeeEngine';
@@ -206,7 +205,6 @@ export function sendStructuredUpstreamError(
 export interface ServerVerifiedCbtGradeResult {
   summary: CBTMockSummary;
   scaledScoreOutOf300: number;
-  percentilePrediction: ReturnType<typeof predictNtaPercentileAndAir>;
   verifiedAtIso: string;
   examMode: ExamTrack;
   keyVersion: string;
@@ -227,7 +225,6 @@ export function gradeCbtAttemptOnServer(params: {
   attemptType?: 'official_mock' | 'custom_drill';
   responses: Record<string, QuestionResponseState>;
   examMode?: ExamTrack;
-  shiftDifficulty?: 'Easy' | 'Moderate' | 'Tough';
 }): ServerVerifiedCbtGradeResult {
   const examMode: ExamTrack = params.examMode || 'JEE Main';
   const attemptType = params.attemptType || 'official_mock';
@@ -294,12 +291,6 @@ export function gradeCbtAttemptOnServer(params: {
     0,
     Math.min(300, Math.round((summary.totalScore / Math.max(1, summary.maxScore)) * 300))
   );
-  const percentilePrediction = predictNtaPercentileAndAir({
-    score: scaledScoreOutOf300,
-    maxScore: 300,
-    shiftDifficulty: params.shiftDifficulty || 'Moderate',
-  });
-
   const questionSolutions: ServerVerifiedCbtGradeResult['questionSolutions'] = {};
   for (const q of authoritativeQuestions) {
     questionSolutions[q.id] = {
@@ -313,7 +304,6 @@ export function gradeCbtAttemptOnServer(params: {
   return {
     summary,
     scaledScoreOutOf300,
-    percentilePrediction,
     verifiedAtIso: new Date().toISOString(),
     examMode,
     keyVersion: AUTHORITATIVE_KEY_VERSION,
diff --git a/src/server/routes/pyqAndCbtRoutes.ts b/src/server/routes/pyqAndCbtRoutes.ts
index 4471cd6..5c884a2 100644
--- a/src/server/routes/pyqAndCbtRoutes.ts
+++ b/src/server/routes/pyqAndCbtRoutes.ts
@@ -188,7 +188,7 @@ pyqAndCbtRouter.post('/pyq/verify-answer', (req: Request, res: Response) => {
   });
 });
 
-// 3. Server-Verified CBT Grading & Shift Percentile Calculation (/api/cbt/grade)
+// 3. Server-Verified CBT Grading (/api/cbt/grade)
 pyqAndCbtRouter.post('/cbt/grade', (req: Request, res: Response) => {
   const {
     questions,
@@ -196,7 +196,6 @@ pyqAndCbtRouter.post('/cbt/grade', (req: Request, res: Response) => {
     attemptType = 'official_mock',
     responses = {},
     examMode = 'JEE Main',
-    shiftDifficulty = 'Moderate',
   } = req.body || {};
 
   const hasQuestions = Array.isArray(questions) && questions.length > 0;
@@ -224,7 +223,6 @@ pyqAndCbtRouter.post('/cbt/grade', (req: Request, res: Response) => {
       attemptType: attemptType === 'custom_drill' ? 'custom_drill' : 'official_mock',
       responses,
       examMode,
-      shiftDifficulty,
     });
 
     res.json(graded);
diff --git a/src/server/storageAndCbtKeys.test.ts b/src/server/storageAndCbtKeys.test.ts
index d422f01..950caab 100644
--- a/src/server/storageAndCbtKeys.test.ts
+++ b/src/server/storageAndCbtKeys.test.ts
@@ -55,6 +55,7 @@ test('stripQuestionAnswerKeys removes all grading fields and server grading igno
   // Server must award +4 for the authoritative answer key, ignoring the forged client key
   assert.equal(gradedWithTrueAnswer.summary.totalScore, 4);
   assert.equal(gradedWithTrueAnswer.summary.correctCount, 1);
+  assert.equal('percentilePrediction' in gradedWithTrueAnswer, false);
 
   // Unknown question ID must fail closed for official_mock
   assert.throws(
diff --git a/src/services/studyBundleBuilder.ts b/src/services/studyBundleBuilder.ts
index a751650..6524148 100644
--- a/src/services/studyBundleBuilder.ts
+++ b/src/services/studyBundleBuilder.ts
@@ -84,7 +84,11 @@ export function splitSourceIntoPages(
             'No selectable text was detected in this file. If this is a scanned PDF or handwritten photo, run Gemini Vision OCR or paste key text excerpts.',
         },
       ],
-      extractionQuality: sourceType === 'youtube' ? 'unavailable' : 'needs_ocr',
+      extractionQuality: sourceType === 'youtube'
+        ? 'unavailable'
+        : clean && (sourceType === 'text' || sourceType === 'drive')
+          ? 'partial'
+          : 'needs_ocr',
     };
   }
 
diff --git a/src/services/workspaceService.ts b/src/services/workspaceService.ts
index a82f21a..72515ff 100644
--- a/src/services/workspaceService.ts
+++ b/src/services/workspaceService.ts
@@ -18,6 +18,8 @@ import {
 } from 'firebase/firestore';
 import { computeStableContentHash, splitSourceIntoPages } from './studyBundleBuilder';
 import { apiFetch, apiUrl } from '../config/apiConfig';
+import type { MaterialItem } from '../components/HomeAndStudyViews';
+import type { MaterialStudyBundle } from '../data/jeeInitialContent';
 
 export interface DriveFileItem {
   id: string;
@@ -71,6 +73,47 @@ function getIndexedDb(): Promise<IDBPDatabase> | null {
   return dbPromise;
 }
 
+interface StoredStudyMaterial {
+  id: string;
+  uid: string;
+  material: MaterialItem;
+  bundle: MaterialStudyBundle;
+  original?: File;
+  savedAt: number;
+}
+
+export async function saveStudyMaterialOnDevice(
+  uid: string,
+  material: MaterialItem,
+  bundle: MaterialStudyBundle,
+  original?: File,
+): Promise<void> {
+  const database = await getIndexedDb();
+  if (!database) {
+    throw new Error('This browser cannot save your study material on this device.');
+  }
+  await database.put(IDB_STORE_BUNDLES, {
+    id: `learnmate_${uid}_${material.id}`,
+    uid,
+    material,
+    bundle,
+    original,
+    savedAt: Date.now(),
+  } satisfies StoredStudyMaterial);
+}
+
+export async function listStudyMaterialsOnDevice(uid: string): Promise<StoredStudyMaterial[]> {
+  const database = await getIndexedDb();
+  if (!database) return [];
+  const materials = await database.getAllFromIndex(IDB_STORE_BUNDLES, 'by_uid', uid);
+  return (materials as StoredStudyMaterial[]).sort((a, b) => b.savedAt - a.savedAt);
+}
+
+export async function removeStudyMaterialFromDevice(uid: string, materialId: string): Promise<void> {
+  const database = await getIndexedDb();
+  await database?.delete(IDB_STORE_BUNDLES, `learnmate_${uid}_${materialId}`);
+}
+
 /**
  * Saves a binary PDF/photo file and its full extracted text in IndexedDB (bypassing the 5MB localStorage limit),
  * and returns a fresh Blob URL for immediate viewing in the Study Workbench.
@@ -302,10 +345,10 @@ export async function syncChunkedMaterialToFirestore(
  * Configures local Vite-bundled pdf.js worker (no external CDN dependency).
  */
 async function loadPdfJsConfigured() {
-  const pdfjsLib = await import('pdfjs-dist');
-  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
+  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
+  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
     try {
-      const workerMod: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
+      const workerMod: any = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
       if (workerMod?.default) {
         pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
       }
@@ -322,7 +365,8 @@ async function loadPdfJsConfigured() {
  */
 export async function extractPdfTextAndMetadataWithPdfJs(
   file: File,
-  onProgress?: (pct: number, currentPage: number, totalPages: number) => void
+  onProgress?: (pct: number, currentPage: number, totalPages: number) => void,
+  signal?: AbortSignal,
 ): Promise<{
   pageCount: number;
   extractedText: string;
@@ -341,6 +385,7 @@ export async function extractPdfTextAndMetadataWithPdfJs(
     const scannedPageNumbers: number[] = [];
 
     for (let i = 1; i <= maxPagesToScan; i++) {
+      signal?.throwIfAborted();
       const page = await pdf.getPage(i);
       const content = await page.getTextContent();
       const strings = (content.items as any[])
@@ -386,7 +431,8 @@ export async function extractPdfTextAndMetadataWithPdfJs(
 export async function extractScannedPdfPagesViaOcr(
   file: File,
   scannedPageNumbers: number[],
-  onProgress?: (completed: number, total: number) => void
+  onProgress?: (completed: number, total: number) => void,
+  signal?: AbortSignal,
 ): Promise<{ ocrTextByPage: Map<number, string>; errors: string[] }> {
   const ocrTextByPage = new Map<number, string>();
   const errors: string[] = [];
@@ -402,6 +448,7 @@ export async function extractScannedPdfPagesViaOcr(
     const batchSize = 3;
 
     for (let idx = 0; idx < maxOcrPages.length; idx += batchSize) {
+      signal?.throwIfAborted();
       const batch = maxOcrPages.slice(idx, idx + batchSize);
       const batchResults = await Promise.all(
         batch.map(async (pageNum) => {
@@ -420,7 +467,11 @@ export async function extractScannedPdfPagesViaOcr(
               mediaBase64: base64,
               mimeType: 'image/jpeg',
               sourceType: 'photo',
-              prompt: `Transcribe ALL printed/handwritten text and LaTeX equations ($...$ / $$...$$) from Page ${pageNum} verbatim. Output clean JEE study notes for Page ${pageNum} only.`,
+              prompt: `Transcribe the visible text and equations on page ${pageNum} verbatim. Mark unreadable content as [unreadable]. Do not add information.`,
+            }, 'POST', {
+              signal: signal
+                ? AbortSignal.any([signal, AbortSignal.timeout(25_000)])
+                : AbortSignal.timeout(25_000),
             });
             if (!res.ok) {
               return { pageNum, text: '', error: res.error.message };
@@ -495,18 +546,22 @@ export async function getAuthenticatedRequestHeaders(): Promise<Record<string, s
 export async function apiFetchWithAuth<T = any>(
   endpoint: string,
   body?: Record<string, any>,
-  method: 'POST' | 'GET' | 'DELETE' = 'POST'
+  method: 'POST' | 'GET' | 'DELETE' = 'POST',
+  options?: { signal?: AbortSignal; idToken?: string },
 ): Promise<
   | { ok: true; data: T; error?: undefined }
   | { ok: false; data: Partial<T>; error: StructuredUpstreamError }
 > {
   try {
-    const headers = await getAuthenticatedRequestHeaders();
+    const headers = options?.idToken
+      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${options.idToken}` }
+      : await getAuthenticatedRequestHeaders();
 
     const res = await apiFetch(endpoint, {
       method,
       headers,
       body: method === 'GET' || !body ? undefined : JSON.stringify(body),
+      signal: options?.signal,
     });
 
     const json = await res.json().catch(() => ({}));
@@ -1024,14 +1079,14 @@ export async function requestSignedCloudStorageUrl(params: {
   operation?: 'upload' | 'download';
   sizeBytes?: number;
   assetId?: string;
-}): Promise<SignedCloudStorageTicket> {
+}, idToken?: string): Promise<SignedCloudStorageTicket> {
   const res = await apiFetchWithAuth<SignedCloudStorageTicket>('/api/storage/signed-url', {
     fileName: params.fileName,
     mimeType: params.mimeType,
     operation: params.operation || 'upload',
     sizeBytes: params.sizeBytes || 0,
     ...(params.assetId ? { assetId: params.assetId } : {}),
-  });
+  }, 'POST', { idToken, signal: AbortSignal.timeout(45_000) });
 
   if (!res.ok) {
     return {
@@ -1045,10 +1100,28 @@ export async function requestSignedCloudStorageUrl(params: {
   return res.data as SignedCloudStorageTicket;
 }
 
-export async function confirmCloudUpload(assetId: string) {
-  return apiFetchWithAuth<{ ok: boolean; asset: any }>('/api/storage/confirm-upload', {
-    assetId,
+export async function confirmCloudUpload(assetId: string, idToken?: string) {
+  return apiFetchWithAuth<{ ok: boolean; asset: any }>('/api/storage/confirm-upload',
+    { assetId }, 'POST', { idToken, signal: AbortSignal.timeout(45_000) });
+}
+
+export async function syncStudyOriginalToCloud(original: File, idToken: string): Promise<boolean> {
+  const ticket = await requestSignedCloudStorageUrl({
+    fileName: original.name,
+    mimeType: original.type,
+    operation: 'upload',
+    sizeBytes: original.size,
+  }, idToken);
+  if (!ticket.ok || !ticket.storageConfigured || !ticket.signedUrl || !ticket.assetId) return false;
+
+  const response = await fetch(ticket.signedUrl, {
+    method: 'PUT',
+    headers: { 'Content-Type': original.type },
+    body: original,
+    signal: AbortSignal.timeout(45_000),
   });
+  if (!response.ok) return false;
+  return (await confirmCloudUpload(ticket.assetId, idToken)).ok;
 }
 
 export async function deleteCloudAsset(assetId: string) {
@@ -1091,12 +1164,10 @@ export async function gradeCbtAttemptOnServerApi(params: {
   attemptType?: 'official_mock' | 'custom_drill';
   responses: Record<string, any>;
   examMode: string;
-  shiftDifficulty?: 'Easy' | 'Moderate' | 'Tough';
 }) {
   return apiFetchWithAuth<{
     summary: any;
     scaledScoreOutOf300: number;
-    percentilePrediction: any;
     verifiedAtIso: string;
     examMode: string;
     keyVersion: string;
@@ -1120,8 +1191,11 @@ export async function ingestDocumentOnServer(params: {
   sourceType?: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
   sourceRef?: string;
   rawText: string;
-}) {
-  return apiFetchWithAuth('/api/ingest/document', params);
+}, idToken?: string) {
+  return apiFetchWithAuth('/api/ingest/document', params, 'POST', {
+    idToken,
+    signal: AbortSignal.timeout(45_000),
+  });
 }
 
 export async function ingestYouTubeOnServer(params: {
diff --git a/src/utils/jeeEngine.test.ts b/src/utils/jeeEngine.test.ts
index fcd707a..6fe797d 100644
--- a/src/utils/jeeEngine.test.ts
+++ b/src/utils/jeeEngine.test.ts
@@ -5,7 +5,6 @@ import {
   evaluateSingleQuestionMarks,
   calculateCBTSummary,
   calculateSM2Schedule,
-  predictNtaPercentileAndAir,
   generateChapterShardZ,
   CBTQuestion,
 } from './jeeEngine.ts';
@@ -226,7 +225,7 @@ test('evaluateSingleQuestionMarks enforces JEE Advanced partial marking (+4/-2/+
   );
 });
 
-test('SuperMemo SM-2 algorithm and Shift Percentile Predictor compute accurate intervals and ranks', () => {
+test('SM-2 review intervals and chapter sprint generation', () => {
   // First review with Good (quality=4) -> interval 1, repetition 1
   const r1 = calculateSM2Schedule({
     quality: 4,
@@ -267,15 +266,6 @@ test('SuperMemo SM-2 algorithm and Shift Percentile Predictor compute accurate i
   assert.equal(lapsed.interval, 1);
   assert.equal(lapsed.repetition, 0);
 
-  // Shift Percentile Predictor
-  const predHigh = predictNtaPercentileAndAir({
-    score: 245,
-    maxScore: 300,
-    shiftDifficulty: 'Tough',
-  });
-  assert.ok(predHigh.percentile >= 99.8);
-  assert.equal(predHigh.cutoffCleared, true);
-
   // ShardZ generator
   const shards = generateChapterShardZ('Electrostatics', 'Physics');
   assert.equal(shards.length, 3);
diff --git a/src/utils/jeeEngine.ts b/src/utils/jeeEngine.ts
index 7a5c333..56b85e6 100644
--- a/src/utils/jeeEngine.ts
+++ b/src/utils/jeeEngine.ts
@@ -881,84 +881,6 @@ export function calculateNextSRSReview(
   };
 }
 
-export interface ShiftPercentilePrediction {
-  percentile: number;
-  predictedAirMin: number;
-  predictedAirMax: number;
-  cutoffCleared: boolean;
-  targetInstituteTier: string;
-  normalizedMarksOutOf300: number;
-}
-
-/**
- * Quizrr / MathonGo-style Shift-Difficulty Normalization & NTA Percentile / AIR Predictor.
- */
-export function predictNtaPercentileAndAir(params: {
-  score: number;
-  maxScore: number;
-  shiftDifficulty?: 'Easy' | 'Moderate' | 'Tough';
-  totalCandidates?: number;
-}): ShiftPercentilePrediction {
-  const {
-    score,
-    maxScore,
-    shiftDifficulty = 'Moderate',
-    totalCandidates = 1420000,
-  } = params;
-
-  const safeMax = Math.max(1, maxScore);
-  const rawNormalized300 = Math.max(-75, Math.min(300, Math.round((score / safeMax) * 300)));
-
-  // Shift difficulty adjustment (+14 marks equivalent for Tough shift, -12 for Easy shift)
-  const shiftBonus = shiftDifficulty === 'Tough' ? 14 : shiftDifficulty === 'Easy' ? -12 : 0;
-  const effectiveScore = Math.max(0, Math.min(300, rawNormalized300 + shiftBonus));
-
-  let percentile = 50;
-  if (effectiveScore >= 280) {
-    percentile = 99.98 + ((effectiveScore - 280) / 20) * 0.019;
-  } else if (effectiveScore >= 240) {
-    percentile = 99.8 + ((effectiveScore - 240) / 40) * 0.18;
-  } else if (effectiveScore >= 200) {
-    percentile = 99.2 + ((effectiveScore - 200) / 40) * 0.6;
-  } else if (effectiveScore >= 170) {
-    percentile = 98.0 + ((effectiveScore - 170) / 30) * 1.2;
-  } else if (effectiveScore >= 140) {
-    percentile = 95.5 + ((effectiveScore - 140) / 30) * 2.5;
-  } else if (effectiveScore >= 110) {
-    percentile = 91.0 + ((effectiveScore - 110) / 30) * 4.5;
-  } else if (effectiveScore >= 80) {
-    percentile = 82.0 + ((effectiveScore - 80) / 30) * 9.0;
-  } else {
-    percentile = Math.max(12.0, (effectiveScore / 80) * 82.0);
-  }
-
-  const roundedPercentile = Number(Math.min(99.999, percentile).toFixed(4));
-  const rawRank = Math.max(1, Math.round(((100 - roundedPercentile) / 100) * totalCandidates));
-  const predictedAirMin = Math.max(1, Math.round(rawRank * 0.88));
-  const predictedAirMax = Math.max(predictedAirMin + 15, Math.round(rawRank * 1.12));
-  const cutoffCleared = roundedPercentile >= 93.2;
-
-  const targetInstituteTier =
-    roundedPercentile >= 99.6
-      ? 'Top 5 NITs (Trichy, Surathkal, Warangal) CSE & IIIT-H'
-      : roundedPercentile >= 98.5
-      ? 'Top 10 NITs & IIITs Core / Circuital Branches'
-      : roundedPercentile >= 95.0
-      ? 'NITs / IIITs / GFTIs & Qualified for JEE Advanced'
-      : roundedPercentile >= 93.2
-      ? 'JEE Advanced Cutoff Cleared — Push +35 Marks for NIT Seat'
-      : 'Below General Cutoff — Focus on High-Weightage Chapters & Mistake Book';
-
-  return {
-    percentile: roundedPercentile,
-    predictedAirMin,
-    predictedAirMax,
-    cutoffCleared,
-    targetInstituteTier,
-    normalizedMarksOutOf300: rawNormalized300,
-  };
-}
-
 export interface ChapterShardTask {
   id: string;
   shardNumber: number;
