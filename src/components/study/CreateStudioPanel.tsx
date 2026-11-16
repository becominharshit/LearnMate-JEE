import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Play,
  RotateCw,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import {
  DIAGRAM_SVG_PRESETS,
} from '../../data/jeeInitialContent';
import {
  ThreeSceneCanvas,
  ThreeSceneCanvasHandle,
  Preset3DId,
  ThreeSceneSnapshot,
} from '../ThreeSceneCanvas';
import { DiagramVectorOverlayItem } from '../../utils/jeeEngine';
import {
  injectVectorsIntoSvg,
  synthesizeTopicAccurateSvg,
} from '../../utils/opticsAndGeometrySolver';
import { sanitizeSvgMarkup } from '../../utils/svgSanitizer';
import { apiFetchWithAuth } from '../../services/workspaceService';
import type { CreationItem, MaterialItem } from '../HomeAndStudyViews';

export type CreateStudioTabId = 'Diagram Maker' | 'Visual' | 'Animated Lesson' | 'Saved Library';

interface CreateStudioPanelProps {
  materials: MaterialItem[];
  selectedMaterial: MaterialItem | null;
  creations: CreationItem[];
  onSaveCreation: (creation: Omit<CreationItem, 'id'>) => Promise<void>;
  requestedCreateTab?: CreateStudioTabId;
}

const PRESET_LIST: Preset3DId[] = [
  'Incline',
  'Convex Lens',
  'RC Circuit',
  'VSEPR',
  'Parabola',
  'Ellipse',
];

interface AnimatedLessonKeyframe {
  timeSec: number;
  title: string;
  formula: string;
  visualCue: string;
  caption: string;
}

interface AnimatedLessonData {
  kind: 'animated_lesson';
  lessonTitle: string;
  durationSec: number;
  summary: string;
  keyframes: AnimatedLessonKeyframe[];
  animatedSvg?: string;
  videoUrl?: string;
}

function parse3DSavedSnapshot(assetData?: string): ThreeSceneSnapshot | null {
  if (!assetData || !assetData.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(assetData);
    if (parsed && parsed.kind === '3d') {
      return parsed as ThreeSceneSnapshot;
    }
  } catch {
    // ignore malformed JSON
  }
  return null;
}

function parseAnimatedLessonData(assetData?: string): AnimatedLessonData | null {
  if (!assetData || !assetData.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(assetData);
    if (parsed && parsed.kind === 'animated_lesson') {
      return parsed as AnimatedLessonData;
    }
  } catch {
    // ignore malformed JSON
  }
  return null;
}

export const CreateStudioPanel: React.FC<CreateStudioPanelProps> = ({
  materials,
  selectedMaterial,
  creations,
  onSaveCreation,
  requestedCreateTab,
}) => {
  const [createTab, setCreateTab] = useState<CreateStudioTabId>(
    requestedCreateTab || 'Diagram Maker'
  );
  useEffect(() => {
    if (requestedCreateTab) setCreateTab(requestedCreateTab);
  }, [requestedCreateTab]);
  const [selectedMaterialTitle, setSelectedMaterialTitle] = useState(
    selectedMaterial?.title || 'Uploaded Material'
  );
  const [sourcePageLabel] = useState('Page 1');
  const [diagramPrompt, setDiagramPrompt] = useState(
    'Free-body diagram of a block on an inclined plane, show gravity mg, normal N, and friction f.'
  );
  const [diagramCategory, setDiagramCategory] = useState('Auto-detect');
  const [subjectFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Maths'>('All');
  const [activePreset, setActivePreset] = useState<Preset3DId>('Incline');
  const [aiSvgOverride, setAiSvgOverride] = useState<string | null>(null);
  const [solverNotice, setSolverNotice] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState<boolean>(false);
  const [renderMode, setRenderMode] = useState<'2D SVG' | '3D Interactive'>('2D SVG');
  const [inclineAngleDeg, setInclineAngleDeg] = useState<30 | 60 | 90>(30);
  const [animateDiagramMotion, setAnimateDiagramMotion] = useState(false);
  const [animTimeSec, setAnimTimeSec] = useState<number>(0);
  const [diagramZoom, setDiagramZoom] = useState(100);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Restored 3D configuration
  const [restored3DConfig, setRestored3DConfig] = useState<{
    angleDeg?: number;
    paramSecondary?: number;
    cameraPreset?: 'front' | 'iso' | 'top';
  }>({});
  const threeCanvasRef = useRef<ThreeSceneCanvasHandle | null>(null);

  // Interactive Draggable & Rotatable Custom Vectors on 2D SVG Stage (starts empty so base diagrams stay uncluttered)
  const [diagramVectors, setDiagramVectors] = useState<DiagramVectorOverlayItem[]>([]);
  const [draggingVectorId, setDraggingVectorId] = useState<string | null>(null);
  const [selectedVectorId, setSelectedVectorId] = useState<string | null>(null);
  const [newVectorLabel, setNewVectorLabel] = useState('');
  const [newVectorAngle, setNewVectorAngle] = useState<number>(45);
  const [newVectorColor, setNewVectorColor] = useState('#2563EB');
  const svgStageRef = useRef<HTMLDivElement | null>(null);

  // Visual state
  const [visualEngine, setVisualEngine] = useState<'pro' | 'nano'>('pro');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [visualAspectRatio, setVisualAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '9:16'>('16:9');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [editBase64, setEditBase64] = useState<string | null>(null);

  // Animated Lesson state
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoPhotoBase64, setVideoPhotoBase64] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedLesson, setGeneratedLesson] = useState<AnimatedLessonData | null>(null);
  const [activeKeyframeIdx, setActiveKeyframeIdx] = useState<number>(0);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showFallback3DPreview, setShowFallback3DPreview] = useState(false);

  // Real requestAnimationFrame loop for 2D SVG motion (never switches tab to 3D!)
  useEffect(() => {
    if (!animateDiagramMotion || renderMode !== '2D SVG' || createTab !== 'Diagram Maker') {
      return;
    }
    let rafId = 0;
    const startMs = performance.now();
    const tick = (now: number) => {
      setAnimTimeSec((now - startMs) / 1000);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animateDiagramMotion, renderMode, createTab]);

  // Compute current 2D SVG diagram live
  const computedDiagram = (() => {
    if (aiSvgOverride) {
      return { svg: sanitizeSvgMarkup(aiSvgOverride), matched: true };
    }
    const solved = synthesizeTopicAccurateSvg({
      prompt: diagramPrompt,
      category: diagramCategory,
      preset: activePreset,
      timeSec: animTimeSec,
      animateMotion: animateDiagramMotion,
      thetaDeg: inclineAngleDeg,
    });
    return { svg: solved.svg, matched: solved.matched };
  })();

  const displayedSvgWithVectors = injectVectorsIntoSvg(
    computedDiagram.svg || DIAGRAM_SVG_PRESETS[activePreset],
    diagramVectors
  );

  const handleGenerateDiagramSvg = async () => {
    const lower = diagramPrompt.toLowerCase();
    let matchedPreset: Preset3DId = activePreset;
    if (lower.includes('lens') || lower.includes('optic')) matchedPreset = 'Convex Lens';
    else if (lower.includes('circuit') || lower.includes('rc') || lower.includes('capacitor'))
      matchedPreset = 'RC Circuit';
    else if (lower.includes('vsepr') || lower.includes('octahedral') || lower.includes('orbital'))
      matchedPreset = 'VSEPR';
    else if (lower.includes('parabola')) matchedPreset = 'Parabola';
    else if (lower.includes('ellipse')) matchedPreset = 'Ellipse';
    else if (lower.includes('incline') || lower.includes('block') || lower.includes('friction'))
      matchedPreset = 'Incline';
    setActivePreset(matchedPreset);

    // Check deterministic physics/math solver first
    const localSolved = synthesizeTopicAccurateSvg({
      prompt: diagramPrompt,
      category: diagramCategory,
      preset: matchedPreset,
      timeSec: 0,
      animateMotion: false,
      thetaDeg: inclineAngleDeg,
    });

    if (localSolved.matched) {
      setAiSvgOverride(null);
      setSolverNotice(null);
      return;
    }

    setDiagramLoading(true);
    setSolverNotice(null);
    try {
      const res = await apiFetchWithAuth<{ svg?: string }>('/api/ai/search', {
        prompt: `${diagramPrompt} (${diagramCategory})`,
        mode: 'svg_diagram',
        useSearch: false,
      });
      if (res.ok && res.data.svg && res.data.svg.includes('<svg')) {
        const clean = sanitizeSvgMarkup(res.data.svg);
        if (clean) {
          setAiSvgOverride(clean);
          return;
        }
      }
      setAiSvgOverride(null);
      setSolverNotice(
        'Topic did not match a built-in parametric solver; opened clean Concept Canvas with vector editor.'
      );
    } catch {
      setAiSvgOverride(null);
      setSolverNotice(
        'Custom AI SVG endpoint unavailable; opened clean Concept Canvas with vector editor.'
      );
    } finally {
      setDiagramLoading(false);
    }
  };

  const triggerDownloadUrl = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleExportSvg = () => {
    const blob = new Blob([displayedSvgWithVectors], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownloadUrl(url, `LearnMate_${activePreset.replace(/\s+/g, '_')}.svg`);
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    if (renderMode === '3D Interactive') {
      const snap = threeCanvasRef.current?.getSnapshot();
      if (snap?.previewPngDataUrl) {
        triggerDownloadUrl(snap.previewPngDataUrl, `LearnMate_${activePreset.replace(/\s+/g, '_')}_3D.png`);
        return;
      }
    }
    const svgBlob = new Blob([displayedSvgWithVectors], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1360;
      canvas.height = 840;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            triggerDownloadUrl(pngUrl, `LearnMate_${activePreset.replace(/\s+/g, '_')}_2D.png`);
            URL.revokeObjectURL(pngUrl);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  const handleExport3DJson = () => {
    const snap = threeCanvasRef.current?.getSnapshot();
    if (!snap) return;
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownloadUrl(url, `LearnMate_${activePreset.replace(/\s+/g, '_')}_Scene.json`);
    URL.revokeObjectURL(url);
  };

  const handleSaveDiagramOr3D = async () => {
    if (renderMode === '3D Interactive') {
      const snap = threeCanvasRef.current?.getSnapshot() || {
        kind: '3d',
        preset: activePreset,
        angleDeg: 30,
        paramSecondary: 1.5,
        cameraPreset: 'iso',
        previewPngDataUrl: '',
      };
      await onSaveCreation({
        type: '3d',
        title: `${activePreset} 3D (θ=${snap.angleDeg}°)`,
        prompt: diagramPrompt,
        subject: subjectFilter === 'All' ? 'Physics' : subjectFilter,
        preset: activePreset,
        assetData: JSON.stringify(snap),
        resolutionOrRatio: `3D · ${snap.cameraPreset}`,
      });
    } else {
      await onSaveCreation({
        type: 'diagram',
        title: `${diagramPrompt.slice(0, 34)} (2D SVG)`,
        prompt: diagramPrompt,
        subject: subjectFilter === 'All' ? 'Physics' : subjectFilter,
        preset: activePreset,
        assetData: displayedSvgWithVectors,
        resolutionOrRatio: '2D SVG',
      });
    }
    setSaveBanner('Saved to Saved Library!');
    setTimeout(() => setSaveBanner(null), 3000);
  };

  const handleGenerateVisual = async () => {
    setVisualLoading(true);
    setVisualError(null);
    try {
      const endpoint = visualEngine === 'pro' ? '/api/ai/image-pro' : '/api/ai/image-edit';
      const body =
        visualEngine === 'pro'
          ? { prompt: diagramPrompt, imageSize, aspectRatio: visualAspectRatio }
          : {
              prompt: diagramPrompt,
              imageBase64: editBase64,
              mimeType: 'image/png',
              aspectRatio: visualAspectRatio,
            };
      const res = await apiFetchWithAuth<{ imageUrl?: string }>(endpoint, body);
      if (!res.ok || !res.data.imageUrl) {
        const solved = synthesizeTopicAccurateSvg({
          prompt: diagramPrompt,
          category: diagramCategory,
          preset: activePreset,
          thetaDeg: inclineAngleDeg,
        });
        const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(solved.svg)}`;
        setGeneratedImageUrl(svgDataUrl);
        await onSaveCreation({
          type: 'visual',
          title: `${diagramPrompt.slice(0, 30)} (${imageSize} · ${visualAspectRatio})`,
          prompt: diagramPrompt,
          subject: subjectFilter,
          preset: activePreset,
          assetData: svgDataUrl,
          resolutionOrRatio: `${imageSize} · ${visualAspectRatio}`,
        });
        if (!res.ok) {
          setVisualError(
            `Upstream Image API Notice (${res.error.errorCode}): ${res.error.message} — Rendered verified vector schematic instead.`
          );
        }
        return;
      }
      setGeneratedImageUrl(res.data.imageUrl);
      await onSaveCreation({
        type: 'visual',
        title: `${activePreset} Visual (${visualEngine === 'pro' ? `${imageSize} · ${visualAspectRatio}` : 'Edited'})`,
        prompt: diagramPrompt,
        subject: subjectFilter,
        preset: activePreset,
        assetData: res.data.imageUrl,
        resolutionOrRatio: visualEngine === 'pro' ? `${imageSize} · ${visualAspectRatio}` : 'Edited',
      });
    } catch (err: any) {
      setVisualError(err?.message || 'Visual generation failed.');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleGenerateAnimatedVideo = async () => {
    setVideoLoading(true);
    setVideoError(null);
    setShowFallback3DPreview(false);
    setActiveKeyframeIdx(0);
    try {
      const res = await apiFetchWithAuth<{
        lessonTitle?: string;
        durationSec?: number;
        summary?: string;
        keyframes?: AnimatedLessonKeyframe[];
        animatedSvg?: string;
        videoUrl?: string;
      }>(
        '/api/ai/video',
        {
          prompt: `Educational JEE physics/chemistry/math animated concept lesson: ${diagramPrompt}`,
          aspectRatio: videoAspectRatio,
          imageBase64: videoPhotoBase64 || undefined,
          imageMimeType: 'image/png',
        },
        'POST',
        { signal: AbortSignal.timeout(30_000) }
      );
      if (!res.ok || (!res.data.animatedSvg && !res.data.videoUrl)) {
        setVideoError(
          !res.ok
            ? `[${res.error.errorCode}] ${res.error.message}`
            : 'Animated lesson endpoint returned no playable visual.'
        );
        return;
      }
      const lessonData: AnimatedLessonData = {
        kind: 'animated_lesson',
        lessonTitle: res.data.lessonTitle || `${activePreset} Animated Lesson`,
        durationSec: res.data.durationSec || 12,
        summary: res.data.summary || `Interactive step-by-step concept animation for ${diagramPrompt}`,
        keyframes: Array.isArray(res.data.keyframes) ? res.data.keyframes : [],
        animatedSvg: res.data.animatedSvg ? sanitizeSvgMarkup(res.data.animatedSvg) : undefined,
        videoUrl: res.data.videoUrl,
      };
      setGeneratedLesson(lessonData);
      setGeneratedVideoUrl(res.data.videoUrl || null);
      await onSaveCreation({
        type: 'video',
        title: `${lessonData.lessonTitle.slice(0, 40)} (${videoAspectRatio})`,
        prompt: diagramPrompt,
        subject: subjectFilter,
        preset: activePreset,
        assetData: JSON.stringify(lessonData),
        resolutionOrRatio: `${videoAspectRatio} · ${lessonData.durationSec}s`,
      });
    } catch (err: any) {
      setVideoError(err?.message || 'Animated lesson generation failed.');
    } finally {
      setVideoLoading(false);
    }
  };

  const selectedVector = diagramVectors.find((v) => v.id === selectedVectorId) || null;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-5 space-y-5">
      <div>
        <h1 className="font-semibold tracking-[-0.02em] text-2xl text-[#0F172A] dark:text-[#F8FAFC]">
          Create Studio
        </h1>
      </div>

      <div className="flex items-center gap-2 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-1 overflow-x-auto">
        {(['Diagram Maker', 'Visual', 'Animated Lesson', 'Saved Library'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setCreateTab(tab)}
            className={`px-4 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-colors duration-150 whitespace-nowrap cursor-pointer ${
              createTab === tab
                ? 'text-[#2563EB] dark:text-[#60A5FA] border-[#2563EB] dark:border-[#60A5FA]'
                : 'text-[#475569] dark:text-[#94A3B8] border-transparent hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            {tab} {tab === 'Saved Library' ? `(${creations.length})` : ''}
          </button>
        ))}
      </div>

      {saveBanner && (
        <div className="p-3 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#00A86B]/35 text-xs font-medium text-[#00A86B] dark:text-emerald-400">
          {saveBanner}
        </div>
      )}

      {createTab === 'Saved Library' ? (
        creations.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white dark:bg-[#111827] border border-dashed border-[#CBD5E1] dark:border-white/[0.12] text-center text-xs text-[#475569] dark:text-[#94A3B8]">
            No saved visuals yet. Generate a diagram, visual, or animated lesson to save it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {creations.map((item) => {
              const snap3d = item.type === '3d' ? parse3DSavedSnapshot(item.assetData) : null;
              const savedLesson = item.type === 'video' ? parseAnimatedLessonData(item.assetData) : null;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs tabular-nums text-[#475569] dark:text-[#94A3B8]">
                      <span className="uppercase font-semibold">{item.type}</span>
                      <span>{item.resolutionOrRatio}</span>
                    </div>

                    <div className="h-44 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14] flex items-center justify-center overflow-hidden p-2">
                      {item.type === 'video' && savedLesson?.animatedSvg ? (
                        <div
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(savedLesson.animatedSvg) }}
                        />
                      ) : item.type === 'video' && item.assetData?.startsWith('data:video') ? (
                        <video
                          controls
                          src={item.assetData}
                          className="max-h-full max-w-full rounded-lg"
                        />
                      ) : item.type === 'video' && item.assetData?.startsWith('data:image/svg+xml') ? (
                        <img
                          src={item.assetData}
                          alt={item.title}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : snap3d?.previewPngDataUrl ? (
                        <img
                          src={snap3d.previewPngDataUrl}
                          alt={item.title}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : item.type === 'visual' &&
                        (item.assetData?.startsWith('data:image') ||
                          item.assetData?.startsWith('http')) ? (
                        <img
                          src={item.assetData}
                          alt={item.title}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      ) : item.assetData?.includes('<svg') ? (
                        <div
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(item.assetData) }}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeSvgMarkup(
                              DIAGRAM_SVG_PRESETS[(item.preset as Preset3DId) || 'Incline'] ||
                                DIAGRAM_SVG_PRESETS.Incline
                            ),
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8] line-clamp-2 mt-0.5">{item.prompt}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E2E8F0] dark:border-white/[0.08] flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.preset) {
                          setActivePreset(item.preset as Preset3DId);
                        }
                        setDiagramPrompt(item.prompt);
                        if (item.type === '3d') {
                          if (snap3d) {
                            setActivePreset(snap3d.preset);
                            setRestored3DConfig({
                              angleDeg: snap3d.angleDeg,
                              paramSecondary: snap3d.paramSecondary,
                              cameraPreset: snap3d.cameraPreset,
                            });
                          }
                          setRenderMode('3D Interactive');
                          setCreateTab('Diagram Maker');
                        } else if (item.type === 'visual') {
                          if (item.assetData?.startsWith('data:image') || item.assetData?.startsWith('http')) {
                            setGeneratedImageUrl(item.assetData);
                          }
                          setCreateTab('Visual');
                        } else if (item.type === 'video') {
                          if (savedLesson) {
                            setGeneratedLesson(savedLesson);
                            setGeneratedVideoUrl(savedLesson.videoUrl || null);
                          } else if (item.assetData?.startsWith('data:video') || item.assetData?.startsWith('data:image/svg+xml')) {
                            setGeneratedVideoUrl(item.assetData);
                          }
                          setCreateTab('Animated Lesson');
                        } else {
                          if (item.assetData?.includes('<svg')) {
                            setAiSvgOverride(item.assetData);
                          }
                          setRenderMode('2D SVG');
                          setCreateTab('Diagram Maker');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg btn-brand font-semibold cursor-pointer transition-all duration-150"
                    >
                      Open in Studio
                    </button>

                    {(item.assetData?.includes('<svg') || savedLesson?.animatedSvg) && (
                      <button
                        type="button"
                        onClick={() => {
                          const rawSvg = savedLesson?.animatedSvg || item.assetData;
                          const blob = new Blob([sanitizeSvgMarkup(rawSvg)], {
                            type: 'image/svg+xml;charset=utf-8',
                          });
                          const url = URL.createObjectURL(blob);
                          triggerDownloadUrl(url, `${item.title.replace(/\s+/g, '_')}.svg`);
                          URL.revokeObjectURL(url);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#94A3B8] font-medium hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer inline-flex items-center gap-1 transition-colors duration-150"
                      >
                        <Download className="w-3.5 h-3.5" />
                        SVG
                      </button>
                    )}
                    {snap3d?.previewPngDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownloadUrl(
                            snap3d.previewPngDataUrl,
                            `${item.title.replace(/\s+/g, '_')}.png`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#94A3B8] font-medium hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer inline-flex items-center gap-1 transition-colors duration-150"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PNG
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Prompt & Presets Column (3 Cols) */}
          <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Source Material
              </label>
              <select
                value={selectedMaterialTitle}
                onChange={(e) => setSelectedMaterialTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]"
              >
                {materials.length === 0 ? (
                  <option value="Uploaded Material">General JEE Concept</option>
                ) : (
                  materials.map((m) => (
                    <option key={m.id} value={m.title}>
                      {m.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Prompt
              </label>
              <textarea
                rows={3}
                value={diagramPrompt}
                onChange={(e) => {
                  setDiagramPrompt(e.target.value);
                  setAiSvgOverride(null);
                }}
                placeholder="Describe diagram, ray optics, Wheatstone bridge, or conic..."
                className="w-full p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Category
              </label>
              <select
                value={diagramCategory}
                onChange={(e) => setDiagramCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] text-xs bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value="Auto-detect">Auto-detect</option>
                <option value="Free-Body Diagram">Free-Body Diagram</option>
                <option value="Ray Optics">Ray Optics</option>
                <option value="Circuit Schematic">Circuit Schematic</option>
                <option value="VSEPR 3D Geometry">VSEPR 3D Geometry</option>
                <option value="Conic Section">Conic Section</option>
              </select>
            </div>

            <button
              type="button"
              disabled={diagramLoading || visualLoading || videoLoading}
              onClick={() => {
                if (createTab === 'Visual') {
                  void handleGenerateVisual();
                } else if (createTab === 'Animated Lesson') {
                  void handleGenerateAnimatedVideo();
                } else {
                  void handleGenerateDiagramSvg();
                }
              }}
              className="w-full py-2.5 rounded-lg btn-brand disabled:opacity-60 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {diagramLoading || visualLoading || videoLoading ? 'Generating...' : 'Generate'}
              </span>
            </button>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_LIST.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setActivePreset(preset);
                      setAiSvgOverride(null);
                      setSolverNotice(null);
                      setDiagramVectors([]);
                      setSelectedVectorId(null);
                      setDiagramPrompt(
                        preset === 'Incline'
                          ? 'Free-body diagram of a block on an inclined plane, show gravity mg, normal N, and friction.'
                          : `JEE ${preset} diagram with labeled vectors and parameters.`
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      activePreset === preset && !aiSvgOverride
                        ? 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white border-transparent font-semibold'
                        : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#243247]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center Canvas Area (6 Cols) */}
          <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-4 space-y-4">
            {createTab === 'Diagram Maker' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-0.5">
                      {(['2D SVG', '3D Interactive'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setRenderMode(m)}
                          className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors duration-150 ${
                            renderMode === m
                              ? 'bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC] shadow-2xs'
                              : 'text-[#475569] dark:text-[#94A3B8]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {renderMode === '2D SVG' && (
                      <>
                        <div className="inline-flex items-center rounded-lg border border-[#E2E8F0] dark:border-white/[0.08]">
                          <button
                            type="button"
                            onClick={() => setDiagramZoom((z) => Math.max(60, z - 20))}
                            aria-label="Zoom out diagram"
                            className="px-2.5 py-1 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer"
                          >
                            −
                          </button>
                          <span className="px-2.5 py-1 border-x border-[#E2E8F0] dark:border-white/[0.08] tabular-nums font-medium">
                            {diagramZoom}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setDiagramZoom((z) => Math.min(150, z + 20))}
                            aria-label="Zoom in diagram"
                            className="px-2.5 py-1 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <div
                          className="inline-flex items-center rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] p-0.5 gap-0.5"
                          role="group"
                          aria-label="Incline angle presets"
                        >
                          {([30, 60, 90] as const).map((deg) => (
                            <button
                              key={deg}
                              type="button"
                              onClick={() => {
                                setInclineAngleDeg(deg);
                                setActivePreset('Incline');
                                setAiSvgOverride(null);
                                if (!diagramPrompt.toLowerCase().includes('incline')) {
                                  setDiagramPrompt(
                                    'Free-body diagram of a block on an inclined plane, show gravity mg, normal N, and friction.'
                                  );
                                }
                              }}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold tabular-nums cursor-pointer transition-colors ${
                                inclineAngleDeg === deg && activePreset === 'Incline'
                                  ? 'bg-[#2563EB] text-white'
                                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                              }`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderMode === '2D SVG' ? (
                      <button
                        type="button"
                        onClick={handleExportSvg}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] font-medium text-[#0F172A] dark:text-[#F8FAFC] inline-flex items-center gap-1 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer transition-colors duration-150"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>SVG</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleExport3DJson}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] font-medium text-[#0F172A] dark:text-[#F8FAFC] inline-flex items-center gap-1 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer transition-colors duration-150"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleExportPng}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] font-medium text-[#0F172A] dark:text-[#F8FAFC] inline-flex items-center gap-1 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer transition-colors duration-150"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PNG</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveDiagramOr3D()}
                      className="px-3.5 py-1.5 rounded-lg btn-brand font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all duration-150"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>

                {solverNotice && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-[#1E293B] border border-amber-500/30 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    {solverNotice}
                  </div>
                )}

                {renderMode === '2D SVG' ? (
                  <div className="space-y-2.5">
                    <div
                      ref={svgStageRef}
                      onMouseMove={(e) => {
                        if (!draggingVectorId || !svgStageRef.current) return;
                        const rect = svgStageRef.current.getBoundingClientRect();
                        const xPct = Math.max(
                          6,
                          Math.min(92, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1)))
                        );
                        const yPct = Math.max(
                          8,
                          Math.min(90, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1)))
                        );
                        setDiagramVectors((prev) =>
                          prev.map((v) =>
                            v.id === draggingVectorId ? { ...v, xPct, yPct } : v
                          )
                        );
                      }}
                      onMouseUp={() => setDraggingVectorId(null)}
                      onMouseLeave={() => setDraggingVectorId(null)}
                      className="w-full h-[420px] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white flex items-center justify-center overflow-hidden p-4 relative select-none"
                    >
                      {diagramLoading && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-[#0F172A] text-white text-[11px] font-semibold z-20">
                          Synthesizing SVG...
                        </span>
                      )}
                      {diagramVectors.length > 0 && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#0F172A]/90 text-white text-[10px] font-medium z-20">
                          Drag added vectors
                        </span>
                      )}
                      <div
                        className="w-full h-full flex items-center justify-center transition-transform"
                        style={{ transform: `scale(${diagramZoom / 100})` }}
                        dangerouslySetInnerHTML={{ __html: displayedSvgWithVectors }}
                      />

                      {diagramVectors.map((vec) => (
                        <div
                          key={vec.id}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedVectorId(vec.id);
                            setDraggingVectorId(vec.id);
                          }}
                          style={{
                            left: `${vec.xPct}%`,
                            top: `${vec.yPct}%`,
                            borderColor: vec.color,
                            color: vec.color,
                          }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 px-2.5 py-1 rounded-lg bg-white/95 border text-[11px] font-semibold flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                            selectedVectorId === vec.id ? 'ring-2 ring-[#2563EB]/40' : ''
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: vec.color }}
                          />
                          <span>{vec.label}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDiagramVectors((prev) =>
                                prev.filter((item) => item.id !== vec.id)
                              );
                            }}
                            className="ml-1 text-slate-400 hover:text-rose-500 cursor-pointer inline-flex items-center"
                            aria-label={`Remove ${vec.label}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={newVectorLabel}
                          onChange={(e) => setNewVectorLabel(e.target.value)}
                          placeholder="Vector label (e.g. T_1, E_net, v_cm)..."
                          className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]"
                        />
                        <label className="flex items-center gap-1.5 text-[11px] tabular-nums text-[#475569] dark:text-[#94A3B8]">
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>{newVectorAngle}°</span>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={newVectorAngle}
                            onChange={(e) => setNewVectorAngle(Number(e.target.value))}
                            aria-label="New vector angle"
                            className="w-16 accent-[#2563EB]"
                          />
                        </label>
                        <input
                          type="color"
                          value={newVectorColor}
                          onChange={(e) => setNewVectorColor(e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border border-[#E2E8F0] dark:border-white/[0.08]"
                          aria-label="Vector color"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newVectorLabel.trim()) return;
                            const rad = (newVectorAngle * Math.PI) / 180;
                            const id = `vec-${Date.now()}`;
                            setDiagramVectors((prev) => [
                              ...prev,
                              {
                                id,
                                label: newVectorLabel.trim(),
                                xPct: 50,
                                yPct: 50,
                                dx: Math.round(48 * Math.cos(rad)),
                                dy: Math.round(-48 * Math.sin(rad)),
                                angleDeg: newVectorAngle,
                                magnitude: 48,
                                color: newVectorColor,
                              },
                            ]);
                            setSelectedVectorId(id);
                            setNewVectorLabel('');
                          }}
                          className="px-3 py-1.5 rounded-lg btn-brand font-semibold text-xs cursor-pointer transition-all duration-150"
                        >
                          + Add Vector
                        </button>
                      </div>
                      {selectedVector && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#E2E8F0] dark:border-white/[0.08] text-[11px]">
                          <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            Selected: {selectedVector.label}
                          </span>
                          <label className="flex items-center gap-2 tabular-nums text-[#475569] dark:text-[#94A3B8]">
                            <span>Angle ({selectedVector.angleDeg ?? 0}°):</span>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={selectedVector.angleDeg ?? 0}
                              onChange={(e) => {
                                const deg = Number(e.target.value);
                                setDiagramVectors((prev) =>
                                  prev.map((v) =>
                                    v.id === selectedVector.id ? { ...v, angleDeg: deg } : v
                                  )
                                );
                              }}
                              aria-label="Rotate selected vector"
                              className="w-28 accent-[#2563EB]"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ThreeSceneCanvas
                    ref={threeCanvasRef}
                    preset={activePreset}
                    animateMotion={animateDiagramMotion}
                    initialAngleDeg={restored3DConfig.angleDeg}
                    initialParamSecondary={restored3DConfig.paramSecondary}
                    initialCameraPreset={restored3DConfig.cameraPreset}
                  />
                )}

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setAnimateDiagramMotion((prev) => !prev)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                      animateDiagramMotion
                        ? 'bg-[#00A86B]/15 text-[#00A86B] dark:text-emerald-400 border border-[#00A86B]/30'
                        : 'text-[#0F172A] dark:text-[#F8FAFC] bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#243247]'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {animateDiagramMotion
                        ? `Stop ${renderMode === '2D SVG' ? '2D' : '3D'} Motion`
                        : `Animate ${renderMode === '2D SVG' ? '2D SVG' : '3D'} Motion`}
                    </span>
                  </button>
                </div>
              </>
            )}

            {createTab === 'Visual' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisualEngine('pro')}
                      className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors duration-150 ${
                        visualEngine === 'pro'
                          ? 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white font-semibold'
                          : 'text-[#475569] dark:text-[#94A3B8]'
                      }`}
                    >
                      Pro Image (1K / 2K / 4K)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisualEngine('nano')}
                      className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors duration-150 ${
                        visualEngine === 'nano'
                          ? 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white font-semibold'
                          : 'text-[#475569] dark:text-[#94A3B8]'
                      }`}
                    >
                      Image Edit
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      {(['1:1', '16:9', '4:3', '9:16'] as const).map((ar) => (
                        <button
                          key={ar}
                          type="button"
                          onClick={() => setVisualAspectRatio(ar)}
                          className={`px-2 py-1 rounded-md tabular-nums font-semibold cursor-pointer ${
                            visualAspectRatio === ar
                              ? 'bg-[#2563EB] text-white'
                              : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                          }`}
                        >
                          {ar}
                        </button>
                      ))}
                    </div>
                    {visualEngine === 'pro' && (
                      <div className="flex items-center gap-1">
                        {(['1K', '2K', '4K'] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setImageSize(sz)}
                            className={`px-2.5 py-1 rounded-md tabular-nums font-semibold cursor-pointer ${
                              imageSize === sz
                                ? 'bg-[#7C3AED] text-white'
                                : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {visualEngine === 'nano' && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                    <span className="text-[#475569] dark:text-[#94A3B8]">Reference image (optional)</span>
                    <label className="px-3 py-1 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] font-medium cursor-pointer">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const r = new FileReader();
                          r.onloadend = () =>
                            setEditBase64(String(r.result || '').split(',')[1] || null);
                          r.readAsDataURL(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className="h-[360px] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14] flex flex-col items-center justify-center p-4 overflow-hidden">
                  {visualLoading ? (
                    <p className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      Generating {imageSize} ({visualAspectRatio})...
                    </p>
                  ) : generatedImageUrl ? (
                    <img
                      src={generatedImageUrl}
                      alt="Generated JEE Visual"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center space-y-2 max-w-sm">
                      <ImageIcon className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                        Click Generate for a {imageSize} ({visualAspectRatio}) diagram.
                      </p>
                    </div>
                  )}
                </div>
                {visualError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-[#F8FAFF] dark:bg-[#1E293B] border border-amber-500/30 rounded-lg p-2.5">
                    {visualError}
                  </p>
                )}
              </div>
            )}

            {createTab === 'Animated Lesson' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                  <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    Animated Concept Lesson
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(['16:9', '9:16'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setVideoAspectRatio(ratio)}
                        className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                          videoAspectRatio === ratio
                            ? 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white font-semibold'
                            : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                        }`}
                      >
                        {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                  <span className="text-[#475569] dark:text-[#94A3B8]">
                    Reference diagram photo (optional)
                  </span>
                  <label className="px-3 py-1 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] font-medium cursor-pointer">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const r = new FileReader();
                        r.onloadend = () =>
                          setVideoPhotoBase64(String(r.result || '').split(',')[1] || null);
                        r.readAsDataURL(f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="min-h-[340px] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#070B14] flex flex-col items-center justify-center p-4 overflow-hidden space-y-3">
                  {videoLoading ? (
                    <p className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      Synthesizing {videoAspectRatio} interactive animated lesson...
                    </p>
                  ) : generatedLesson?.animatedSvg ? (
                    <div className="w-full space-y-3">
                      <div
                        className="w-full h-[270px] flex items-center justify-center overflow-hidden rounded-lg"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeSvgMarkup(generatedLesson.animatedSvg),
                        }}
                      />
                      {generatedLesson.keyframes.length > 0 && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-left">
                            {generatedLesson.keyframes.map((kf, idx) => (
                              <button
                                key={`${kf.timeSec}-${idx}`}
                                type="button"
                                onClick={() => setActiveKeyframeIdx(idx)}
                                className={`p-2 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                                  activeKeyframeIdx === idx
                                    ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#0F172A] dark:text-[#F8FAFC]'
                                    : 'border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8]'
                                }`}
                              >
                                <div className="font-semibold text-[#2563EB] dark:text-[#60A5FA] tabular-nums">
                                  t = {kf.timeSec}s
                                </div>
                                <div className="font-semibold truncate">{kf.title}</div>
                              </button>
                            ))}
                          </div>
                          {generatedLesson.keyframes[activeKeyframeIdx] && (
                            <div className="p-3 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                                  {generatedLesson.keyframes[activeKeyframeIdx].title}
                                </span>
                                <span className="font-semibold text-[#00A86B]">
                                  {generatedLesson.keyframes[activeKeyframeIdx].formula}
                                </span>
                              </div>
                              <p className="text-[#475569] dark:text-[#94A3B8]">
                                {generatedLesson.keyframes[activeKeyframeIdx].caption}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : generatedVideoUrl?.startsWith('data:video') ? (
                    <video
                      controls
                      src={generatedVideoUrl}
                      className="max-h-full max-w-full rounded-lg"
                    />
                  ) : generatedVideoUrl ? (
                    <img
                      src={generatedVideoUrl}
                      alt="Animated JEE Concept Lesson"
                      className="max-h-[300px] max-w-full object-contain rounded-lg"
                    />
                  ) : showFallback3DPreview ? (
                    <div className="w-full h-[310px]">
                      <ThreeSceneCanvas preset={activePreset} animateMotion={true} />
                    </div>
                  ) : (
                    <div className="text-center space-y-2 max-w-sm">
                      <Video className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                        Click Generate to build an interactive 4-step animated concept lesson.
                      </p>
                    </div>
                  )}
                </div>
                {videoError && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 bg-[#F8FAFF] dark:bg-[#1E293B] border border-amber-500/30 rounded-lg p-3 space-y-2">
                    <p>{videoError}</p>
                    {!showFallback3DPreview && (
                      <button
                        type="button"
                        onClick={() => setShowFallback3DPreview(true)}
                        className="px-3 py-1.5 rounded-lg btn-brand font-semibold cursor-pointer"
                      >
                        Preview 3D Simulation
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Cited Source Column (3 Cols) */}
          <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4">
            <h2 className="font-semibold tracking-[-0.02em] text-base text-[#0F172A] dark:text-[#F8FAFC]">
              Cited Source
            </h2>
            <div className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] divide-y divide-[#E2E8F0] dark:divide-white/[0.08] text-xs">
              <div className="p-3 flex items-center gap-2.5 font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedMaterial?.title || selectedMaterialTitle}</span>
              </div>
              <div className="p-3 flex items-center gap-2.5 font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{sourcePageLabel}</span>
              </div>
              <div className="p-3 flex items-center gap-2.5 font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Preset: {activePreset}{activePreset === 'Incline' ? ` (${inclineAngleDeg}°)` : ''}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCreateTab('Animated Lesson')}
              className="w-full py-2 px-4 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] font-medium text-xs flex items-center justify-center gap-2 hover:bg-[#F1F5F9] dark:hover:bg-[#243247] transition-colors duration-150 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Animated Lesson</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
