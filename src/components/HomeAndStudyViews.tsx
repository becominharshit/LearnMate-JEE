import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Plus,
  Play,
  FileText,
  Video,
  Upload,
  Image as ImageIcon,
  Youtube,
  Type as TypeIcon,
  Flame,
  Zap,
  Award,
  Mic,
  Camera,
  Send,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Sparkles,
  Volume2,
  Download,
  Bookmark,
  ExternalLink,
  Search,
  Calendar,
  Layers,
  Headphones,
  FolderOpen,
  Trash2,
  Filter,
  PenTool,
  Highlighter,
  Eraser,
  StickyNote,
  Save,
  Eye,
  Atom,
  FlaskConical,
  Sigma,
  X,
} from 'lucide-react';
import {
  DIAGRAM_SVG_PRESETS,
  JEE_SYLLABUS_DATA,
  MaterialStudyBundle,
  NotePageData,
} from '../data/jeeInitialContent';
import { ThreeSceneCanvas, Preset3DId } from './ThreeSceneCanvas';
import { MathRichText } from './MathRichText';
import {
  CBTQuestion,
  CanvasVectorStroke,
  DiagramVectorOverlayItem,
  parseOrGenerateMarathonTimestampChunks,
} from '../utils/jeeEngine';
import {
  apiFetchWithAuth,
  loadCanvasAnnotationsForMaterial,
  saveCanvasAnnotationsForMaterial,
} from '../services/workspaceService';
import {
  sanitizeSvgMarkup,
} from '../utils/svgSanitizer';
import { buildQuickNotesForPage } from '../services/studyBundleBuilder';
import { speakWithLocaleVoice } from '../utils/speechVoice';
import { synthesizeTopicAccurateSvg } from '../utils/opticsAndGeometrySolver';
import { CreateStudioPanel, CreateStudioTabId } from './study/CreateStudioPanel';
import { ResourcesAndGuidePanel } from './study/ResourcesAndGuidePanel';


export interface MaterialItem {
  id: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  sourceRef?: string;
  originalFileUrl?: string;
  originalMimeType?: string;
  pageCount: number;
  currentPage: number;
  progressPct: number;
  contentSummary: string;
  addedLabel?: string;
}

export interface StudyTaskItem {
  id: string;
  title: string;
  durationMin: number;
  completed: boolean;
  dueDate: string;
}

export interface CreationItem {
  id: string;
  type: 'diagram' | '3d' | 'visual' | 'video';
  title: string;
  prompt: string;
  subject: string;
  preset?: string;
  assetData: string;
  resolutionOrRatio?: string;
}

interface TutorChatTurn {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  contextMode: 'strict_material' | 'open_jee';
  citations?: { pageNumber: number; excerpt: string }[];
  failed?: boolean;
  embeddedVisual?: {
    type: '2D Diagram' | '3D Scene' | 'Concept Image' | 'Animated Video';
    preset?: Preset3DId;
    svgHtml?: string;
    animatedSvg?: string;
    imageUrl?: string;
    videoUrl?: string;
    promptUsed: string;
  };
}

interface HomeDashboardProps {
  userName: string;
  targetExam: 'JEE Main 2027' | 'JEE Advanced 2027' | 'NEET UG 2027' | 'BITSAT 2027' | 'JEE Main 2028';
  onChangeTargetExam: (
    exam: 'JEE Main 2027' | 'JEE Advanced 2027' | 'NEET UG 2027' | 'BITSAT 2027' | 'JEE Main 2028'
  ) => void;
  materials: MaterialItem[];
  tasks: StudyTaskItem[];
  streakDays: number;
  xp: number;
  level: number;
  lastMockScore: number | null;
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, durationMin: number) => void;
  onDeleteTask?: (taskId: string) => void;
  onSyncWorkspaceTasks: () => void;
  onOpenStudyWorkbench: (material?: MaterialItem) => void;
  onOpenMyMaterials: () => void;
  onOpenSyllabus: () => void;
  onOpenRevise: () => void;
  onOpenPractice: () => void;
  onOpenProgress: () => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onOpenStudyTools: () => void;
}

export const HomeDashboardView: React.FC<HomeDashboardProps> = ({
  userName,
  targetExam,
  onChangeTargetExam,
  materials,
  tasks,
  streakDays,
  xp,
  level,
  lastMockScore,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onSyncWorkspaceTasks,
  onOpenStudyWorkbench,
  onOpenMyMaterials,
  onOpenSyllabus,
  onOpenRevise,
  onOpenPractice,
  onOpenProgress,
  onOpenAddMaterial,
  onOpenStudyTools,
}) => {
  const [workspaceMode, setWorkspaceMode] = useState<'daily' | 'subjects'>('daily');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(30);
  const [showNewTaskInput, setShowNewTaskInput] = useState(false);

  // Ask a Doubt state
  const [doubtLang, setDoubtLang] = useState<'English' | 'Hinglish'>('English');
  const [doubtInput, setDoubtInput] = useState('');
  const [doubtResponse, setDoubtResponse] = useState<string | null>(null);
  const [doubtError, setDoubtError] = useState<string | null>(null);
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [recordingMic, setRecordingMic] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleAskDoubt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!doubtInput.trim() || doubtLoading) return;
    setDoubtLoading(true);
    setDoubtError(null);
    setDoubtResponse(null);
    try {
      const res = await apiFetchWithAuth<{ text?: string }>(
        '/api/ai/tutor',
        {
          prompt: doubtInput.trim(),
          language: doubtLang,
          contextMode: 'open_jee',
          context:
            materials.length > 0
              ? `Uploaded materials: ${materials.map((m) => m.title).join(', ')}`
              : 'JEE Main & Advanced Physics, Chemistry, and Mathematics.',
        },
        'POST',
        { signal: AbortSignal.timeout(30_000) }
      );
      if (!res.ok) {
        setDoubtError(res.error.message || 'Unable to contact AI Tutor right now.');
      } else if (!res.data.text?.trim()) {
        setDoubtError('Empty response received from AI Tutor. Please retry.');
      } else {
        setDoubtResponse(res.data.text.trim());
      }
    } catch (err: any) {
      setDoubtError(
        err?.name === 'AbortError' || err?.name === 'TimeoutError'
          ? 'Request timed out after 30s. Please retry.'
          : err?.message || 'Error contacting AI Tutor.'
      );
    } finally {
      setDoubtLoading(false);
    }
  };

  const handleToggleMic = async () => {
    if (recordingMic && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingMic(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = String(reader.result || '').split(',')[1] || '';
          if (!base64) return;
          setDoubtLoading(true);
          setDoubtError(null);
          try {
            const res = await apiFetchWithAuth<{ transcript?: string; text?: string }>(
              '/api/ai/transcribe',
              { audioBase64: base64, mimeType: 'audio/webm' },
              'POST',
              { signal: AbortSignal.timeout(30_000) }
            );
            if (res.ok && (res.data.transcript || res.data.text)) {
              setDoubtInput(res.data.transcript || res.data.text || '');
            } else if (!res.ok) {
              setDoubtError(res.error.message || 'Voice transcription failed.');
            }
          } catch (err: any) {
            setDoubtError(err?.message || 'Voice transcription timed out.');
          } finally {
            setDoubtLoading(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingMic(true);
    } catch {
      setDoubtError('Microphone permission is required for voice doubt transcription.');
    }
  };

  const handleDoubtPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDoubtLoading(true);
    setDoubtError(null);
    setDoubtResponse(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = String(reader.result || '').split(',')[1] || '';
          const res = await apiFetchWithAuth<{ text?: string }>(
            '/api/ai/analyze',
            {
              mediaBase64: base64,
              mimeType: file.type || 'image/jpeg',
              sourceType: 'photo',
              prompt: `Solve this JEE problem or handwritten note step-by-step in ${doubtLang} using mathematical notation ($...$ and $$...$$), **bold** key laws, and *italic* exam traps.`,
            },
            'POST',
            { signal: AbortSignal.timeout(30_000) }
          );
          if (!res.ok) {
            setDoubtError(res.error.message || 'Photo OCR failed. Please retry.');
          } else {
            setDoubtResponse(res.data.text || 'Analyzed photo successfully.');
          }
        } catch (err: any) {
          setDoubtError(err?.message || 'Photo OCR timed out. Please retry.');
        } finally {
          setDoubtLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setDoubtError('Unable to read selected image.');
      setDoubtLoading(false);
    }
  };

  const physCount = materials.filter((m) => m.subject === 'Physics').length;
  const chemCount = materials.filter((m) => m.subject === 'Chemistry').length;
  const mathCount = materials.filter((m) => m.subject === 'Mathematics').length;

  return (
    <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6">
      {/* Top Greeting & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {workspaceMode === 'daily' ? (
            <>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-zinc-900 dark:text-[#fafafa] tracking-[-0.02em]">
                Welcome, {userName}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                <span>Target:</span>
                <select
                  aria-label="Target Exam"
                  value={targetExam}
                  onChange={(e) =>
                    onChangeTargetExam(
                      e.target.value as
                        | 'JEE Main 2027'
                        | 'JEE Advanced 2027'
                        | 'NEET UG 2027'
                        | 'BITSAT 2027'
                        | 'JEE Main 2028'
                    )
                  }
                  className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="JEE Main 2027">JEE Main 2027</option>
                  <option value="JEE Advanced 2027">JEE Advanced 2027</option>
                  <option value="NEET UG 2027">NEET UG 2027</option>
                  <option value="BITSAT 2027">BITSAT 2027</option>
                  <option value="JEE Main 2028">JEE Main 2028</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Home</div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                JEE Study Workspace
              </h1>
            </div>
          )}
        </div>

        <div className="inline-flex items-center rounded-xl bg-[#F1F5F9] dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setWorkspaceMode('daily')}
            className={`px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
              workspaceMode === 'daily'
                ? 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] shadow-2xs'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            Daily Dashboard
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceMode('subjects')}
            className={`px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
              workspaceMode === 'subjects'
                ? 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] shadow-2xs'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            JEE Study Workspace
          </button>
        </div>
      </div>

      {workspaceMode === 'subjects' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                subject: 'Physics',
                count: physCount,
                pct: Math.min(100, physCount * 25),
                color: 'text-[#2563EB] bg-[#F8FAFF] dark:bg-[#1E293B]',
                barColor: 'bg-[#2563EB]',
                Icon: Atom,
              },
              {
                subject: 'Chemistry',
                count: chemCount,
                pct: Math.min(100, chemCount * 25),
                color: 'text-[#00A86B] bg-[#F8FAFF] dark:bg-[#1E293B]',
                barColor: 'bg-[#00A86B]',
                Icon: FlaskConical,
              },
              {
                subject: 'Mathematics',
                count: mathCount,
                pct: Math.min(100, mathCount * 25),
                color: 'text-[#7C3AED] bg-[#F8FAFF] dark:bg-[#1E293B]',
                barColor: 'bg-[#7C3AED]',
                Icon: Sigma,
              },
            ].map((card) => {
              const SubjectIcon = card.Icon;
              return (
              <div
                key={card.subject}
                onClick={() => onOpenStudyWorkbench()}
                className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F8FAFF] dark:hover:bg-[#1E293B] transition-colors duration-150 cursor-pointer space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm border border-zinc-200/70 dark:border-white/[0.07] ${card.color}`}
                    >
                      <SubjectIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-display font-semibold text-base text-zinc-900 dark:text-[#fafafa] block">
                        {card.subject}
                      </span>
                      <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] tabular-nums">
                        {card.count} {card.count === 1 ? 'material' : 'materials'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] overflow-hidden">
                    <div
                      className={`h-full ${card.barColor} rounded-full`}
                      style={{ width: `${card.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8] tabular-nums">
                    {card.pct}%
                  </span>
                </div>
              </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <h2 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={onOpenStudyTools}
                className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] flex items-center gap-3 transition-colors duration-150 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                  Graphing &amp; Study Tools
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAddMaterial('pdf')}
                className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] flex items-center gap-3 transition-colors duration-150 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                  Upload Material
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenSyllabus}
                className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] flex items-center gap-3 transition-colors duration-150 text-left cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                  Syllabus Tracker
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                Materials ({materials.length})
              </h2>
              {materials.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenMyMaterials}
                  className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                >
                  View all →
                </button>
              )}
            </div>
            {materials.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-dashed border-[#E2E8F0] dark:border-white/[0.1] p-8 text-center space-y-3">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                  No materials yet
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Upload a chapter PDF, handwritten scan, or YouTube lecture to start.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('pdf')}
                  className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold transition-colors duration-150 cursor-pointer"
                >
                  Upload Material
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-white/[0.08] text-xs text-slate-500">
                      <th className="py-3.5 px-5 font-medium">Material</th>
                      <th className="py-3.5 px-5 font-medium">Subject</th>
                      <th className="py-3.5 px-5 font-medium text-right">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/[0.08]">
                    {materials.map((m) => (
                      <tr
                        key={m.id}
                        onClick={() => onOpenStudyWorkbench(m)}
                        className="hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-5 flex items-center gap-3 font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                          <span className="text-[11px] font-semibold uppercase text-slate-500">
                            {m.sourceType} ·
                          </span>
                          <span>{m.title}</span>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#475569] dark:text-[#94A3B8]">
                          {m.subject}
                        </td>
                        <td className="py-3.5 px-5 text-right text-xs text-slate-500">
                          {m.addedLabel || 'Just now'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Main 2-Column Daily Study Dashboard */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7-Column Stack */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. My Tasks Card */}
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                  Study Tasks ({tasks.length})
                </h2>
                <div className="flex items-center gap-3">
                  {tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={onSyncWorkspaceTasks}
                      className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Sync Calendar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNewTaskInput((v) => !v)}
                    className="text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>
              </div>

              {showNewTaskInput && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g., Solve 20 Rotational Motion PYQs"
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                  />
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                    className="w-20 px-2.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs tabular-nums text-center text-[#0F172A] dark:text-[#F8FAFC]"
                    title="Duration (minutes)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTaskTitle.trim()) {
                        onAddTask(newTaskTitle.trim(), newTaskDuration || 25);
                        setNewTaskTitle('');
                        setShowNewTaskInput(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              )}

              {tasks.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-dashed border-[#E2E8F0] dark:border-white/[0.08] text-center space-y-2.5">
                  <p className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                    No tasks yet
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNewTaskInput(true)}
                    className="px-3.5 py-1.5 rounded-lg btn-brand text-xs font-semibold transition-colors duration-150 cursor-pointer"
                  >
                    + Add Task
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0] dark:divide-white/[0.08]">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => onToggleTask(task.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 accent-[#2563EB]"
                        />
                        <span
                          className={`text-sm font-medium ${
                            task.completed
                              ? 'line-through text-slate-400'
                              : 'text-[#0F172A] dark:text-[#F8FAFC]'
                          }`}
                        >
                          {task.title}
                        </span>
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] text-xs tabular-nums">
                          {task.durationMin}m
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            task.title.toLowerCase().includes('pyq')
                              ? onOpenPractice()
                              : onOpenStudyWorkbench()
                          }
                          className="px-3 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Start
                        </button>
                        {onDeleteTask && (
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            aria-label="Delete task"
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Continue Study OR Single Consolidated Upload Card */}
            {materials.length > 0 ? (
              <>
                <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-4">
                  <div>
                    <h2 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                      Continue: {materials[0].title}
                    </h2>
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                      {materials[0].subject} · {materials[0].chapter}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenStudyWorkbench(materials[0])}
                      className="px-4 py-2 rounded-lg btn-brand font-semibold text-xs flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume Study</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenRevise}
                      className="px-3.5 py-2 rounded-lg bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] font-semibold text-xs hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors duration-150 cursor-pointer"
                    >
                      Quick Revise
                    </button>
                    <button
                      type="button"
                      onClick={onOpenPractice}
                      className="px-3.5 py-2 rounded-lg bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] font-semibold text-xs hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors duration-150 cursor-pointer"
                    >
                      Practice PYQs
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                      Materials ({materials.length})
                    </h2>
                    <button
                      type="button"
                      onClick={onOpenMyMaterials}
                      className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    >
                      View all
                    </button>
                  </div>

                  <div className="divide-y divide-[#E2E8F0] dark:divide-white/[0.08]">
                    {materials.map((mat) => (
                      <div
                        key={mat.id}
                        className="py-3 first:pt-0 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] flex items-center justify-center shrink-0">
                            {mat.sourceType === 'youtube' ? (
                              <Video className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                              {mat.title}
                            </div>
                            <div className="text-xs text-[#475569] dark:text-[#94A3B8]">
                              {mat.subject} · {mat.chapter}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenStudyWorkbench(mat)}
                          className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors cursor-pointer"
                        >
                          Open
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAddMaterial('pdf')}
                      className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAddMaterial('photo')}
                      className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                      <span>Photo OCR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAddMaterial('youtube')}
                      className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                      <span>YouTube (12h)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAddMaterial('text')}
                      className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                      <span>Paste Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAddMaterial('drive')}
                      className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                      <span>Google Drive</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-4">
                <div>
                  <h2 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                    No materials yet
                  </h2>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
                    Import a PDF, handwritten scan, or YouTube lecture to generate notes and flashcards.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('pdf')}
                    className="px-4 py-2 rounded-lg btn-brand font-semibold text-xs inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Material</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('photo')}
                    className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-medium text-[#475569] dark:text-[#94A3B8] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                    <span>Photo OCR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('youtube')}
                    className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-medium text-[#475569] dark:text-[#94A3B8] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Youtube className="w-3.5 h-3.5 text-rose-500" />
                    <span>YouTube (12h)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('text')}
                    className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-medium text-[#475569] dark:text-[#94A3B8] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                    <span>Paste Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('drive')}
                    className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-medium text-[#475569] dark:text-[#94A3B8] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
                    <span>Google Drive</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right 5-Column Stack */}
          <div className="lg:col-span-5 space-y-6">
            {/* Compact Stats & Daily Challenge */}
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold border-b border-[#E2E8F0] dark:border-white/[0.08] pb-3.5 tabular-nums">
                <div className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC]">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>{streakDays}d Streak</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <div className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC]">
                  <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>{xp} XP</span>
                </div>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <div className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC]">
                  <Award className="w-3.5 h-3.5 text-[#00A86B]" />
                  <span>Lv {level}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    PYQ &amp; CBT Mocks
                  </span>
                  <span className="text-[11px] font-semibold text-[#00A86B]">
                    +50 XP
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenPractice}
                  className="w-full py-2 rounded-lg btn-brand font-semibold text-xs transition-colors duration-150 cursor-pointer"
                >
                  Open Practice &amp; CBT Mocks →
                </button>
              </div>
            </div>

            {/* Ask a Doubt Card */}
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                  Quick Doubt Solver
                </h2>
                <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-0.5 text-xs font-medium">
                  {(['English', 'Hinglish'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setDoubtLang(lang)}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        doubtLang === lang
                          ? 'bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC] shadow-2xs'
                          : 'text-[#475569] dark:text-[#94A3B8]'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAskDoubt}>
                <textarea
                  rows={2}
                  value={doubtInput}
                  onChange={(e) => {
                    setDoubtInput(e.target.value);
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${Math.min(160, e.currentTarget.scrollHeight)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleAskDoubt(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Ask a JEE concept, derivation, or numerical..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB] resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        recordingMic
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                          : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{recordingMic ? 'Stop' : 'Mic'}</span>
                    </button>
                    <label className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Photo OCR</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDoubtPhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={doubtLoading}
                    className="px-4 py-1.5 rounded-lg btn-brand disabled:opacity-60 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{doubtLoading ? 'Thinking...' : 'Ask'}</span>
                  </button>
                </div>
              </form>

              {doubtError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <span className="leading-snug">{doubtError}</span>
                  <button
                    type="button"
                    onClick={() => void handleAskDoubt()}
                    className="px-3 py-1 rounded-lg btn-brand text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {doubtResponse && (
                <div className="p-3.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-xs text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed max-h-64 overflow-y-auto">
                  <MathRichText content={doubtResponse} />
                </div>
              )}
            </div>

            {/* Last Mock Card */}
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                  CBT Mock Status
                </h2>
                <div className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums mt-1">
                  {lastMockScore !== null
                    ? `${lastMockScore} / 300`
                    : 'No mock yet'}
                </div>
              </div>
              <button
                type="button"
                onClick={lastMockScore !== null ? onOpenProgress : onOpenPractice}
                className="px-3.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors cursor-pointer"
              >
                {lastMockScore !== null ? 'View Analysis' : 'Start Mock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Study View Container: Study Workbench, Handwritten View, Full Annotation Editor, AI Tutor Create Visual, Create Studio, Resources
// ============================================================================
interface StudyViewProps {
  initialSubTab?: 'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources';
  selectedMaterial?: MaterialItem | null;
  activeBundle?: MaterialStudyBundle | null;
  materials: MaterialItem[];
  creations: CreationItem[];
  onSelectMaterial: (mat: MaterialItem) => void;
  onDeleteMaterial: (matId: string) => void;
  onUpdateMaterialPage?: (materialId: string, pageNumber: number, updatedPage: NotePageData) => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onSaveCreation: (creation: Omit<CreationItem, 'id'>) => Promise<void>;
  onAddQuickSheetMaterial: (
    title: string,
    subject: 'Physics' | 'Chemistry' | 'Mathematics',
    summary: string
  ) => Promise<void>;
  onOpenVoiceTutor: () => void;
  onLaunchInstantPractice: (
    mode: 'chapter-quiz' | 'adaptive-drill',
    title: string,
    chapterName: string,
    customQuestions?: CBTQuestion[]
  ) => void;
}

export const StudyWorkspaceView: React.FC<StudyViewProps> = ({
  initialSubTab = 'Chapter Notes',
  selectedMaterial,
  activeBundle,
  materials,
  creations,
  onSelectMaterial,
  onDeleteMaterial,
  onUpdateMaterialPage,
  onOpenAddMaterial,
  onSaveCreation,
  onAddQuickSheetMaterial,
  onOpenVoiceTutor,
  onLaunchInstantPractice,
}) => {
  const [subTab, setSubTab] = useState<
    'Syllabus' | 'Chapter Notes' | 'My Materials' | 'AI Tutor' | 'Create' | 'Resources'
  >(initialSubTab);
  const [createTab, setCreateTab] = useState<CreateStudioTabId>('Diagram Maker');
  const [syllabusExam, setSyllabusExam] = useState<'Main' | 'Advanced'>('Main');
  const [notesDensity, setNotesDensity] = useState<'Full' | 'Quick' | 'Original' | 'Split'>('Full');
  const [showAnnotateChoiceModal, setShowAnnotateChoiceModal] = useState(false);
  const [annotateTarget, setAnnotateTarget] = useState<'original' | 'notes'>('notes');

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // 3-in-1 Syllabus Hub state
  const [syllabusSubject, setSyllabusSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>(
    'Physics'
  );
  const [syllabusFilter, setSyllabusFilter] = useState<
    'All' | 'High Weightage' | 'Completed' | 'Pending'
  >('All');
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    JEE_SYLLABUS_DATA.forEach((item) => {
      map[item.id] = item.defaultCompleted;
    });
    return map;
  });
  const [showAiPlannerDrawer, setShowAiPlannerDrawer] = useState(false);

  // My Materials sub-tab search & filter state
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialSubjFilter, setMaterialSubjFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');

  // Study Workbench state
  const [pageIdx, setPageIdx] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Handwritten Notebook View Converter inside Study Workbench
  const [handwrittenView, setHandwrittenView] = useState(false);
  const [handwritingFont, setHandwritingFont] = useState<
    'font-hand-caveat' | 'font-hand-kalam' | 'font-hand-patrick' | 'font-hand-indie'
  >('font-hand-caveat');
  const [paperStyle, setPaperStyle] = useState<'paper-ruled' | 'paper-grid' | 'paper-plain'>(
    'paper-ruled'
  );

  // Dual-Mode PDF & Extracted Notes Full Annotation Editor state (Persisted Across Sessions)
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<
    'pen' | 'highlighter' | 'eraser' | 'callout' | 'edit-text'
  >('pen');
  const [penColor, setPenColor] = useState('#2563EB');
  const [callouts, setCallouts] = useState<{ id: string; text: string; color: string }[]>([]);
  const [newCalloutText, setNewCalloutText] = useState('');
  const [editingPageText, setEditingPageText] = useState('');
  const [editingFormulasText, setEditingFormulasText] = useState('');
  const [savedStrokes, setSavedStrokes] = useState<CanvasVectorStroke[]>([]);
  const activeStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [youtubeSeekSeconds, setYoutubeSeekSeconds] = useState<number>(0);

  // AI Tutor 2-Way Context Toggle & Chat Thread with One-Click "Create Visual"
  const [tutorContextMode, setTutorContextMode] = useState<'strict_material' | 'open_jee'>(
    'strict_material'
  );
  const [tutorDifficulty, setTutorDifficulty] = useState<'board' | 'jee_main' | 'jee_advanced'>(
    'jee_main'
  );
  const [tutorLang, setTutorLang] = useState<'English' | 'Hinglish'>('English');
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorChat, setTutorChat] = useState<TutorChatTurn[]>([]);
  const [visualPickerTurnId, setVisualPickerTurnId] = useState<string | null>(null);
  const [generatingInlineVisual, setGeneratingInlineVisual] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const pagesList: NotePageData[] = activeBundle?.pages || [];
  const currentPageData: NotePageData | null =
    pagesList[pageIdx] || pagesList[0] || null;

  useEffect(() => {
    setPageIdx(0);
    setYoutubeSeekSeconds(0);
    if (selectedMaterial?.id) {
      const loaded = loadCanvasAnnotationsForMaterial(selectedMaterial.id);
      setSavedStrokes(Array.isArray(loaded) ? loaded : []);
    } else {
      setSavedStrokes([]);
    }
  }, [selectedMaterial?.id]);

  // Replay persisted freehand strokes onto the annotation canvas whenever page, mode, or strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activePageNum = currentPageData?.pageNumber || pageIdx + 1;
    const pageStrokes = savedStrokes.filter(
      (s) => s.pageNumber === activePageNum && s.target === annotateTarget
    );

    for (const stroke of pageStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.save();
      if (stroke.tool === 'eraser') {
        for (const pt of stroke.points) {
          ctx.clearRect(pt.x - 12, pt.y - 12, 24, 24);
        }
      } else {
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.tool === 'highlighter' ? 14 : 2.5;
        ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.3 : 1.0;
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [savedStrokes, currentPageData?.pageNumber, pageIdx, annotateTarget, annotateMode, notesDensity]);

  useEffect(() => {
    if (currentPageData) {
      const joinedParagraphs = currentPageData.sections
        .flatMap((s) => s.paragraphs || [])
        .join('\n\n');
      const joinedFormulas = currentPageData.sections
        .flatMap((s) => s.formulas || [])
        .join('\n');
      setEditingPageText(joinedParagraphs);
      setEditingFormulasText(joinedFormulas);
    }
  }, [currentPageData?.pageNumber, selectedMaterial?.id]);

  // Canvas drawing handlers for PDF/Notes Annotation Overlay (Persisted Across Sessions)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annotateMode || (annotationTool !== 'pen' && annotationTool !== 'highlighter' && annotationTool !== 'eraser'))
      return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const pt = {
      x: Number(((e.clientX - rect.left) * scaleX).toFixed(1)),
      y: Number(((e.clientY - rect.top) * scaleY).toFixed(1)),
    };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    activeStrokePointsRef.current = [pt];
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !annotateMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const pt = {
      x: Number(((e.clientX - rect.left) * scaleX).toFixed(1)),
      y: Number(((e.clientY - rect.top) * scaleY).toFixed(1)),
    };
    activeStrokePointsRef.current.push(pt);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (annotationTool === 'eraser') {
      ctx.clearRect(pt.x - 12, pt.y - 12, 24, 24);
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = annotationTool === 'highlighter' ? 14 : 2.5;
    ctx.globalAlpha = annotationTool === 'highlighter' ? 0.3 : 1.0;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = activeStrokePointsRef.current;
    if (pts.length > 0 && selectedMaterial?.id && (annotationTool === 'pen' || annotationTool === 'highlighter' || annotationTool === 'eraser')) {
      const newStroke: CanvasVectorStroke = {
        id: `stroke-${Date.now()}`,
        tool: annotationTool,
        color: penColor,
        pageNumber: currentPageData?.pageNumber || pageIdx + 1,
        target: annotateTarget,
        points: pts,
      };
      const updated = [...savedStrokes, newStroke];
      setSavedStrokes(updated);
      void saveCanvasAnnotationsForMaterial(selectedMaterial.id, updated);
    }
    activeStrokePointsRef.current = [];
  };

  const handleUndoLastStroke = () => {
    if (!selectedMaterial?.id || savedStrokes.length === 0) return;
    const activePageNum = currentPageData?.pageNumber || pageIdx + 1;
    const reversedIdx = [...savedStrokes]
      .reverse()
      .findIndex((s) => s.pageNumber === activePageNum && s.target === annotateTarget);
    if (reversedIdx === -1) return;
    const removeIdx = savedStrokes.length - 1 - reversedIdx;
    const updated = savedStrokes.filter((_, idx) => idx !== removeIdx);
    setSavedStrokes(updated);
    void saveCanvasAnnotationsForMaterial(selectedMaterial.id, updated);
  };

  const clearAnnotationCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (selectedMaterial?.id) {
      const activePageNum = currentPageData?.pageNumber || pageIdx + 1;
      const remaining = savedStrokes.filter(
        (s) => !(s.pageNumber === activePageNum && s.target === annotateTarget)
      );
      setSavedStrokes(remaining);
      void saveCanvasAnnotationsForMaterial(selectedMaterial.id, remaining);
    }
    setCallouts([]);
  };

  const handleSaveEditedPageNotes = () => {
    if (!selectedMaterial || !currentPageData || !onUpdateMaterialPage) return;
    const updatedPage: NotePageData = {
      ...currentPageData,
      sections: [
        {
          numberTitle: `${currentPageData.pageNumber}.1 Annotated & Edited Notes`,
          paragraphs: editingPageText
            .split('\n\n')
            .map((p) => p.trim())
            .filter(Boolean),
          formulas: editingFormulasText
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean),
        },
      ],
    };
    onUpdateMaterialPage(selectedMaterial.id, currentPageData.pageNumber, updatedPage);
  };

  const handleTutorExplain = async (style: 'Simpler' | 'Deeper' | 'UnitCheck' | 'Custom') => {
    if (!currentPageData && tutorContextMode === 'strict_material' && style !== 'Custom') return;
    setTutorLoading(true);
    const promptText =
      style === 'Simpler'
        ? `Explain Page ${currentPageData?.pageNumber || 1} (${currentPageData?.heading || selectedMaterial?.title || 'this concept'}) in simpler intuitive terms with an everyday analogy and formula.`
        : style === 'Deeper'
        ? `Provide a rigorous JEE Advanced level derivation of ${currentPageData?.heading || selectedMaterial?.title || 'this concept'}, highlighting **fundamental laws** in bold, *exceptions/traps* in italics, and mathematical equations.`
        : style === 'UnitCheck'
        ? `Verify dimensional consistency and SI units for the formulas on Page ${currentPageData?.pageNumber || 1} (${currentPageData?.heading || selectedMaterial?.title || 'this topic'}): ${currentPageData?.sections?.flatMap((sec) => sec.formulas || []).join('; ') || selectedMaterial?.contentSummary?.slice(0, 300) || ''}`
        : tutorQuestion.trim();

    if (!promptText) {
      setTutorLoading(false);
      return;
    }

    const userTurn: TutorChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: promptText,
      contextMode: tutorContextMode,
    };
    setTutorChat((prev) => [...prev, userTurn]);
    if (style === 'Custom') setTutorQuestion('');

    try {
      const res = await apiFetchWithAuth<{
        text?: string;
        citations?: { pageNumber: number; snippet: string }[];
        verificationStatus?: string;
      }>('/api/ai/tutor', {
        prompt: promptText,
        materialId: selectedMaterial?.id,
        language: tutorLang,
        contextMode: tutorContextMode,
        difficultyLevel: tutorDifficulty,
        currentPage: currentPageData?.pageNumber,
        context: selectedMaterial?.contentSummary.trim()
          ? currentPageData?.sections[0]?.paragraphs?.join('\n\n') || ''
          : '',
      }, 'POST', { signal: AbortSignal.timeout(40_000) });
      const replyText = res.ok
        ? res.data.text?.trim() || 'The tutor returned an empty answer. Please try again.'
        : res.error.status === 401
          ? 'Sign in to ask the tutor.'
          : 'The tutor is temporarily unavailable. Your saved source is still accessible.';
      const failed = !res.ok || !res.data.text?.trim() ||
        res.data.verificationStatus === 'insufficient_material_context';

      setTutorChat((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}`,
          role: 'tutor',
          text: replyText,
          contextMode: tutorContextMode,
          failed,
          citations: res.ok ? res.data.citations?.map(({ pageNumber, snippet }) => ({
            pageNumber,
            excerpt: snippet,
          })) : undefined,
        },
      ]);
    } catch {
      setTutorChat((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}`,
          role: 'tutor',
          text: 'Could not reach AI Tutor. Please try again.',
          contextMode: tutorContextMode,
          failed: true,
        },
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  // One-Click "Create Visual" from any AI Tutor reply
  const handleCreateVisualFromTutorReply = async (
    turn: TutorChatTurn,
    targetType: '2D Diagram' | '3D Scene' | 'Concept Image' | 'Animated Video'
  ) => {
    setVisualPickerTurnId(null);
    setGeneratingInlineVisual(turn.id);

    const autoPrompt = `Visual representation for JEE concept: ${
      selectedMaterial?.chapter || 'Physics/Chemistry'
    } — ${turn.text.replace(/[*$#]/g, '').slice(0, 160)}`;

    const lower = `${selectedMaterial?.chapter || ''} ${turn.text}`.toLowerCase();
    let inferredPreset: Preset3DId = 'Incline';
    if (lower.includes('lens') || lower.includes('optic')) inferredPreset = 'Convex Lens';
    else if (lower.includes('circuit') || lower.includes('rc') || lower.includes('current'))
      inferredPreset = 'RC Circuit';
    else if (lower.includes('orbital') || lower.includes('vsepr') || lower.includes('bond'))
      inferredPreset = 'VSEPR';
    else if (lower.includes('parabola') || lower.includes('projectile'))
      inferredPreset = 'Parabola';
    else if (lower.includes('ellipse') || lower.includes('gravitation'))
      inferredPreset = 'Ellipse';

    try {
      if (targetType === '2D Diagram') {
        const solved = synthesizeTopicAccurateSvg({
          prompt: autoPrompt,
          preset: inferredPreset,
        });
        const svgHtml = solved.svg || DIAGRAM_SVG_PRESETS[inferredPreset];
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: '2D Diagram',
                    preset: inferredPreset,
                    svgHtml,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        await onSaveCreation({
          type: 'diagram',
          title: `2D Diagram · ${inferredPreset}`,
          prompt: autoPrompt,
          subject: selectedMaterial?.subject || 'Physics',
          preset: inferredPreset,
          assetData: svgHtml,
          resolutionOrRatio: '2D SVG',
        });
      } else if (targetType === '3D Scene') {
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: '3D Scene',
                    preset: inferredPreset,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        await onSaveCreation({
          type: '3d',
          title: `3D Scene · ${inferredPreset}`,
          prompt: autoPrompt,
          subject: selectedMaterial?.subject || 'Physics',
          preset: inferredPreset,
          assetData: JSON.stringify({
            kind: '3d',
            preset: inferredPreset,
            angleDeg: 30,
            paramSecondary: 1.5,
            cameraPreset: 'iso',
            previewPngDataUrl: '',
          }),
          resolutionOrRatio: '3D Interactive',
        });
      } else if (targetType === 'Concept Image') {
        const res = await apiFetchWithAuth<{ imageUrl?: string }>('/api/ai/image-pro', {
          prompt: autoPrompt,
          imageSize: '1K',
        });
        const imgUrl = res.ok && res.data.imageUrl ? res.data.imageUrl : '';
        const fallbackSvg = synthesizeTopicAccurateSvg({
          prompt: autoPrompt,
          preset: inferredPreset,
        }).svg;
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: 'Concept Image',
                    preset: inferredPreset,
                    imageUrl: imgUrl,
                    svgHtml: !imgUrl ? fallbackSvg : undefined,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        await onSaveCreation({
          type: 'visual',
          title: `Concept Visual · ${selectedMaterial?.chapter || inferredPreset}`,
          prompt: autoPrompt,
          subject: selectedMaterial?.subject || 'Physics',
          preset: inferredPreset,
          assetData: imgUrl || fallbackSvg,
          resolutionOrRatio: '1K',
        });
      } else if (targetType === 'Animated Video') {
        const res = await apiFetchWithAuth<{
          animatedSvg?: string;
          videoUrl?: string;
        }>(
          '/api/ai/video',
          {
            prompt: autoPrompt,
            subject: selectedMaterial?.subject || 'Physics',
            preset: inferredPreset,
            aspectRatio: '16:9',
          },
          'POST',
          { signal: AbortSignal.timeout(30_000) }
        );
        const animSvg = res.ok && res.data.animatedSvg ? res.data.animatedSvg : '';
        const vidUrl = res.ok && res.data.videoUrl ? res.data.videoUrl : '';
        const fallbackSvg = synthesizeTopicAccurateSvg({
          prompt: autoPrompt,
          preset: inferredPreset,
        }).svg;
        setTutorChat((prev) =>
          prev.map((t) =>
            t.id === turn.id
              ? {
                  ...t,
                  embeddedVisual: {
                    type: 'Animated Video',
                    preset: inferredPreset,
                    animatedSvg: animSvg || undefined,
                    videoUrl: vidUrl || undefined,
                    svgHtml: !animSvg && !vidUrl ? fallbackSvg : undefined,
                    promptUsed: autoPrompt,
                  },
                }
              : t
          )
        );
        if (animSvg || vidUrl) {
          await onSaveCreation({
            type: 'video',
            title: `Animated Lesson · ${selectedMaterial?.chapter || inferredPreset}`,
            prompt: autoPrompt,
            subject: selectedMaterial?.subject || 'Physics',
            preset: inferredPreset,
            assetData: animSvg
              ? JSON.stringify({
                  kind: 'animated_lesson',
                  animatedSvg: animSvg,
                  videoUrl: vidUrl,
                })
              : vidUrl,
            resolutionOrRatio: '16:9',
          });
        }
      }
    } finally {
      setGeneratingInlineVisual(null);
    }
  };

  const handlePlayTTS = async () => {
    if (!currentPageData) return;
    setTtsPlaying(true);
    try {
      const lastTutor = [...tutorChat].reverse().find((t) => t.role === 'tutor' && !t.failed);
      const textToSpeak =
        lastTutor?.text ||
        currentPageData.aiTutorSummary[tutorLang === 'Hinglish' ? 'hinglish' : 'english'];
      speakWithLocaleVoice({
        text: textToSpeak,
        target: tutorLang === 'Hinglish' ? 'hinglish_faculty' : 'pure_english',
        onEnd: () => setTtsPlaying(false),
      });
    } catch {
      setTtsPlaying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {/* Permanent Horizontal Sub-Navigation Bar (horizontally scrollable <1024px) */}
      <nav
        aria-label="Study workspace sections"
        data-testid="study-subnav"
        className="bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-white/[0.08] px-3 sm:px-6 py-2 flex items-center lg:flex-wrap gap-2.5 text-xs overflow-x-auto whitespace-nowrap"
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('Syllabus')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              subTab === 'Syllabus'
                ? 'btn-brand'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            Syllabus
          </button>
          <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-0.5 text-[11px]">
            {(['Main', 'Advanced'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSyllabusExam(m)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                  syllabusExam === m
                    ? 'bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]'
                    : 'text-slate-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <span className="text-[#E2E8F0] dark:text-white/[0.08]">|</span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('Chapter Notes')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              subTab === 'Chapter Notes'
                ? 'btn-brand'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            Chapter Notes
          </button>
          <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-0.5 text-[11px]">
            {(
              [
                { id: 'Full', label: 'Full' },
                { id: 'Quick', label: 'Quick' },
                { id: 'Original', label: 'Original' },
                { id: 'Split', label: 'Split' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setNotesDensity(d.id);
                  setSubTab('Chapter Notes');
                }}
                className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                  notesDensity === d.id
                    ? 'bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]'
                    : 'text-slate-500'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {(['My Materials', 'AI Tutor', 'Create', 'Resources'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              subTab === tab
                ? 'btn-brand'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* 1. 3-in-1 Syllabus Hub */}
      {subTab === 'Syllabus' && (
        <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6 flex-1">
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium tracking-wider uppercase text-slate-500">
                  NTA JEE {syllabusExam} 2027
                </div>
                <h1 className="font-display font-bold text-xl sm:text-2xl text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em] mt-0.5">
                  Syllabus Tracker
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAiPlannerDrawer((v) => !v)}
                  className="px-3.5 py-2 rounded-lg bg-[#F8FAFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-white/[0.08] font-semibold inline-flex items-center gap-1.5 hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>{showAiPlannerDrawer ? 'Hide 69d Plan' : '69-Day Study Plan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const txt = JEE_SYLLABUS_DATA.map(
                      (c) =>
                        `[${c.subject} · Class ${c.classLevel} · ${c.weightage} (${c.expectedQs})] ${c.chapter}\n  Topics: ${c.unitSummary}`
                    ).join('\n\n');
                    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Official_NTA_JEE_${syllabusExam}_2027_Syllabus.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 rounded-lg btn-brand font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Syllabus</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => {
                const subjRows = JEE_SYLLABUS_DATA.filter((s) => s.subject === subj);
                const doneCount = subjRows.filter((s) => completedChapters[s.id]).length;
                const pct = Math.round((doneCount / Math.max(1, subjRows.length)) * 100);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setSyllabusSubject(subj)}
                    className={`p-4 rounded-xl border text-left transition-colors duration-150 cursor-pointer ${
                      syllabusSubject === subj
                        ? 'border-[#2563EB] bg-[#2563EB]/5 dark:bg-[#2563EB]/10'
                        : 'border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
                      <span>{subj}</span>
                      <span className="text-slate-500 tabular-nums">
                        {doneCount}/{subjRows.length} · {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-[#27272a] overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {showAiPlannerDrawer && (
              <div className="p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                    69-Day JEE {syllabusExam} Roadmap
                  </span>
                  <span className="text-[#475569] dark:text-[#94A3B8] font-medium">High-weightage first</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-1">
                    <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      Days 1–25 · Core High-Weightage
                    </div>
                    <p className="text-[#475569] dark:text-[#94A3B8]">
                      Rotational Motion, Electrostatics, Current Electricity, Coordination Compounds &amp; Definite Integration.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-1">
                    <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      Days 26–50 · Consolidation
                    </div>
                    <p className="text-[#475569] dark:text-[#94A3B8]">
                      Ray &amp; Wave Optics, Thermodynamics, Vector &amp; 3D + 2024 Shift 1 &amp; 2 PYQs.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-1">
                    <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      Days 51–69 · Mocks &amp; Mistake DNA
                    </div>
                    <p className="text-[#475569] dark:text-[#94A3B8]">
                      Alternate-day 75-Q CBT Mocks + daily SM-2 recall and formula drills.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-3">
                <h2 className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
                  <span>Filter Chapters</span>
                </h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(['All', 'High Weightage', 'Completed', 'Pending'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSyllabusFilter(f)}
                      className={`px-3 py-2 rounded-lg font-medium border text-left transition-colors cursor-pointer ${
                        syllabusFilter === f
                          ? 'btn-brand border-transparent'
                          : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] dark:border-white/[0.08] text-slate-500 bg-[#F8FAFF] dark:bg-[#1E293B]">
                    <th className="py-3.5 px-4 font-medium">Done</th>
                    <th className="py-3.5 px-4 font-medium">Chapter &amp; Topics</th>
                    <th className="py-3.5 px-4 font-medium">Class</th>
                    <th className="py-3.5 px-4 font-medium">Weightage</th>
                    <th className="py-3.5 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/[0.08]">
                  {JEE_SYLLABUS_DATA.filter((item) => {
                    if (item.subject !== syllabusSubject) return false;
                    if (syllabusFilter === 'High Weightage' && item.weightage !== 'High')
                      return false;
                    if (syllabusFilter === 'Completed' && !completedChapters[item.id]) return false;
                    if (syllabusFilter === 'Pending' && completedChapters[item.id]) return false;
                    return true;
                  }).map((item) => {
                    const isDone = Boolean(completedChapters[item.id]);
                    return (
                      <tr key={item.id} className="hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors">
                        <td className="py-3.5 px-4 align-top">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() =>
                              setCompletedChapters((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            aria-label={`Mark ${item.chapter} completed`}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 accent-[#2563EB] cursor-pointer mt-0.5"
                          />
                        </td>
                        <td className="py-3.5 px-4 space-y-1">
                          <div
                            className={`font-display font-semibold text-sm ${
                              isDone
                                ? 'line-through text-slate-400'
                                : 'text-[#0F172A] dark:text-[#F8FAFC]'
                            }`}
                          >
                            {item.chapter}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {item.unitSummary}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 align-top tabular-nums text-[#475569] dark:text-[#94A3B8]">
                          {item.classLevel}
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`inline-block font-semibold text-[11px] whitespace-nowrap tabular-nums ${
                              item.weightage === 'High'
                                ? 'text-[#2563EB] dark:text-[#60A5FA]'
                                : 'text-slate-500'
                            }`}
                          >
                            {item.weightage} · {item.expectedQs}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 align-top text-right">
                          <button
                            type="button"
                            onClick={() => onOpenAddMaterial('pdf')}
                            className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#283548] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            + Add Notes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Searchable Student Material Library (Sub-Tab: My Materials) */}
      {subTab === 'My Materials' && (
        <div className="w-full px-6 lg:px-10 xl:px-12 py-6 space-y-6 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium tracking-wider uppercase text-slate-500">
                Study / Library
              </div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                My Materials ({materials.length})
              </h1>
            </div>

            <button
              type="button"
              onClick={() => onOpenAddMaterial('pdf')}
              className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Material</span>
            </button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                placeholder="Search PDFs, handwritten notes, lectures..."
                className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setMaterialSubjFilter(subj)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    materialSubjFilter === subj
                      ? 'btn-brand'
                      : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          </div>

          {materials.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-dashed border-[#E2E8F0] dark:border-white/[0.1] p-12 text-center space-y-3">
              <Upload className="w-7 h-7 text-slate-400 mx-auto" />
              <h3 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC]">
                No materials yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload a PDF, handwritten photo (OCR), or YouTube lecture to build your library.
              </p>
              <button
                type="button"
                onClick={() => onOpenAddMaterial('pdf')}
                className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold transition-colors cursor-pointer"
              >
                Upload Material
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials
                .filter((mat) => {
                  if (materialSubjFilter !== 'All' && mat.subject !== materialSubjFilter)
                    return false;
                  if (
                    materialSearchQuery.trim() &&
                    !`${mat.title} ${mat.chapter} ${mat.contentSummary}`
                      .toLowerCase()
                      .includes(materialSearchQuery.toLowerCase())
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((mat) => (
                  <div
                    key={mat.id}
                    className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-6 flex flex-col justify-between space-y-4 hover:border-[#2563EB]/40 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                        <span className="uppercase">
                          {mat.sourceType} · {mat.subject}
                        </span>
                        <span className="tabular-nums">
                          {mat.addedLabel || `${mat.pageCount}p`}
                        </span>
                      </div>
                      <h3 className="font-display font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC]">
                        {mat.title}
                      </h3>
                      <div className="text-xs text-[#475569] dark:text-[#94A3B8] line-clamp-3 leading-relaxed">
                        <MathRichText content={mat.contentSummary} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMaterial(mat);
                          setSubTab('Chapter Notes');
                        }}
                        className="flex-1 py-2 px-3 rounded-lg btn-brand font-semibold text-center transition-colors cursor-pointer"
                      >
                        Open Workbench
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMaterial(mat.id)}
                        title="Remove Material"
                        aria-label={`Delete ${mat.title}`}
                        className="p-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Full-Desktop Study Workbench (Sub-Tabs: Chapter Notes & AI Tutor) */}
      {(subTab === 'Chapter Notes' || subTab === 'AI Tutor') && (
        <div className="w-full px-6 lg:px-10 xl:px-12 py-5 flex-1 flex flex-col gap-4">
          {!selectedMaterial || !currentPageData ? (
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-dashed border-[#E2E8F0] dark:border-white/[0.1] p-10 my-4 text-center space-y-4">
              <div className="w-11 h-11 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="font-display font-bold text-lg text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                  No material selected
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload a chapter PDF, handwritten scan, or YouTube lecture to generate structured notes and flashcards.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('pdf')}
                  className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Upload PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('photo')}
                  className="px-3.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
                  <span>Handwritten Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('youtube')}
                  className="px-3.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Youtube className="w-4 h-4 text-rose-500" />
                  <span>YouTube (12h)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddMaterial('text')}
                  className="px-3.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <TypeIcon className="w-4 h-4 text-[#00A86B]" />
                  <span>Paste Text</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dual-Target "Annotate and Edit" Choice Modal */}
              {showAnnotateChoiceModal && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Choose What to Annotate and Edit"
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                >
                  <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] w-full max-w-xl p-6 space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                          Annotate &amp; Edit
                        </span>
                        <h3 className="font-display font-bold text-lg text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 tracking-[-0.02em]">
                          Select annotation target
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAnnotateChoiceModal(false)}
                        aria-label="Close annotation target modal"
                        className="p-1.5 rounded-lg text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setAnnotateTarget('original');
                          setNotesDensity('Original');
                          setAnnotationTool('pen');
                          setAnnotateMode(true);
                          setShowAnnotateChoiceModal(false);
                        }}
                        className="p-4 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] bg-[#F8FAFF] dark:bg-[#1E293B] text-left space-y-2 transition-colors cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                          1. Original Uploaded File
                        </div>
                        <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                          Draw or pin callouts over {selectedMaterial.sourceType.toUpperCase()} ({selectedMaterial.title}).
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAnnotateTarget('notes');
                          if (notesDensity === 'Original') setNotesDensity('Full');
                          setAnnotateMode(true);
                          setShowAnnotateChoiceModal(false);
                        }}
                        className="p-4 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] bg-[#F8FAFF] dark:bg-[#1E293B] text-left space-y-2 transition-colors cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg btn-brand flex items-center justify-center">
                          <Edit3 className="w-4 h-4" />
                        </div>
                        <div className="font-display font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                          2. Detailed Chapter Notes
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Highlight, annotate, or edit equations and theory text.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Breadcrumb & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-slate-500">Study</span>
                  <span className="text-slate-400">/</span>
                  <h1 className="font-display font-semibold text-lg text-[#0F172A] dark:text-[#F8FAFC] tracking-[-0.02em]">
                    {selectedMaterial.chapter || selectedMaterial.title}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#00A86B]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Notes Ready
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-1 text-xs font-semibold">
                    {(
                      [
                        { id: 'Full', label: 'Full Notes' },
                        { id: 'Quick', label: 'Quick Notes' },
                        { id: 'Original', label: 'Original File' },
                        { id: 'Split', label: 'Split Screen' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setNotesDensity(mode.id)}
                        className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                          notesDensity === mode.id
                            ? 'btn-brand'
                            : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onLaunchInstantPractice(
                        'chapter-quiz',
                        'Chapter Quiz',
                        selectedMaterial.chapter || selectedMaterial.title,
                        activeBundle?.quizQuestions
                      )
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                  >
                    Chapter Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchInstantPractice(
                        'adaptive-drill',
                        'Live Adaptive Difficulty Drill',
                        selectedMaterial.chapter || selectedMaterial.title,
                        activeBundle?.quizQuestions
                      )
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                  >
                    Adaptive Drill
                  </button>
                  <button
                    type="button"
                    onClick={onOpenVoiceTutor}
                    className="px-3.5 py-1.5 rounded-lg btn-brand text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Live Voice Tutor</span>
                  </button>
                </div>
              </div>

              {/* Split-Screen Workbench */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Left Document Viewer */}
                <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] flex flex-col justify-between overflow-hidden">
                  {/* Viewer Top Toolbar */}
                  <div className="px-4 py-2.5 border-b border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]">
                        <button
                          type="button"
                          onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                          aria-label="Previous page"
                          className="p-1.5 hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 py-1 font-semibold border-x border-[#E2E8F0] dark:border-white/[0.08] tabular-nums">
                          {currentPageData.pageNumber} / {pagesList.length}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPageIdx((p) => Math.min(pagesList.length - 1, p + 1))
                          }
                          aria-label="Next page"
                          className="p-1.5 hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="inline-flex items-center rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B]">
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
                          aria-label="Zoom out notes"
                          className="px-2 py-1 hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                        >
                          −
                        </button>
                        <span className="px-2.5 py-1 border-x border-[#E2E8F0] dark:border-white/[0.08] tabular-nums">
                          {zoomLevel}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
                          aria-label="Zoom in notes"
                          className="px-2 py-1 hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHandwrittenView((v) => !v)}
                        className={`px-3 py-1 rounded-lg border font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          handwrittenView
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>{handwrittenView ? 'Handwritten ON' : 'Handwritten View'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (annotateMode) {
                            setAnnotateMode(false);
                          } else {
                            setShowAnnotateChoiceModal(true);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg border font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          annotateMode
                            ? 'btn-brand border-transparent'
                            : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>
                          {annotateMode
                            ? `Annotating: ${annotateTarget === 'original' ? 'Original' : 'Notes'}`
                            : 'Annotate & Edit'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Handwritten 4-Font & Paper Switcher Bar */}
                  {handwrittenView && (
                    <div className="px-4 py-2 bg-amber-50/70 dark:bg-[#1E293B] border-b border-amber-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-amber-900 dark:text-amber-300">
                          Handwriting:
                        </span>
                        {(
                          [
                            { id: 'font-hand-caveat', label: 'Caveat' },
                            { id: 'font-hand-kalam', label: 'Kalam' },
                            { id: 'font-hand-patrick', label: 'Patrick Hand' },
                            { id: 'font-hand-indie', label: 'Indie Flower' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setHandwritingFont(f.id)}
                            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                              handwritingFont === f.id
                                ? 'btn-brand'
                                : 'bg-white dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-white/[0.08]'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        {(
                          [
                            { id: 'paper-ruled', label: 'Ruled' },
                            { id: 'paper-grid', label: 'Grid' },
                            { id: 'paper-plain', label: 'Plain' },
                          ] as const
                        ).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPaperStyle(p.id)}
                            className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                              paperStyle === p.id
                                ? 'btn-brand'
                                : 'bg-white dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-white/[0.08]'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Dual-Mode Annotation & Rich-Text Equation Editor Toolbar */}
                  {annotateMode && (
                    <div className="px-4 py-2.5 bg-[#F8FAFF] dark:bg-[#1E293B] border-b border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="inline-flex rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-0.5 mr-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAnnotateTarget('original');
                              setNotesDensity('Original');
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                              annotateTarget === 'original'
                                ? 'btn-brand'
                                : 'text-[#475569] dark:text-[#94A3B8]'
                            }`}
                          >
                            Original File
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAnnotateTarget('notes');
                              if (notesDensity === 'Original') setNotesDensity('Full');
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                              annotateTarget === 'notes'
                                ? 'btn-brand'
                                : 'text-[#475569] dark:text-[#94A3B8]'
                            }`}
                          >
                            Detailed Notes
                          </button>
                        </div>

                        {[
                          { id: 'pen', label: 'Pen', icon: PenTool },
                          { id: 'highlighter', label: 'Highlight', icon: Highlighter },
                          { id: 'eraser', label: 'Eraser', icon: Eraser },
                          { id: 'callout', label: 'Callout', icon: StickyNote },
                          { id: 'edit-text', label: 'Edit Notes', icon: Edit3 },
                        ].map((t) => {
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setAnnotationTool(t.id as any)}
                              className={`px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1 cursor-pointer ${
                                annotationTool === t.id
                                  ? 'btn-brand'
                                  : 'bg-white dark:bg-[#111827] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-white/[0.08]'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{t.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        {['#2563EB', '#7C3AED', '#00A86B', '#F59E0B'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setPenColor(c)}
                            aria-label={`Select annotation color ${c}`}
                            className={`w-4 h-4 rounded-full cursor-pointer ${
                              penColor === c ? 'ring-2 ring-offset-1 ring-[#0F172A] dark:ring-white' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={handleUndoLastStroke}
                          className="px-2 py-1 rounded bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] cursor-pointer"
                        >
                          Undo
                        </button>
                        <button
                          type="button"
                          onClick={clearAnnotationCanvas}
                          className="px-2 py-1 rounded bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] hover:text-rose-500 cursor-pointer"
                        >
                          Clear ({savedStrokes.filter((s) => s.pageNumber === (currentPageData?.pageNumber || pageIdx + 1) && s.target === annotateTarget).length})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Document Sheet Content */}
                  <div
                    className={`relative p-6 sm:p-8 space-y-5 flex-1 overflow-y-auto ${
                      handwrittenView ? `${handwritingFont} ${paperStyle}` : ''
                    }`}
                    style={{ fontSize: `${zoomLevel}%` }}
                  >
                    {(annotateMode ||
                      savedStrokes.some(
                        (s) =>
                          s.pageNumber === (currentPageData?.pageNumber || pageIdx + 1) &&
                          s.target === annotateTarget
                      )) && (
                      <canvas
                        ref={canvasRef}
                        width={960}
                        height={680}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        className={`absolute inset-0 w-full h-full z-10 ${
                          annotateMode &&
                          (annotationTool === 'pen' ||
                            annotationTool === 'highlighter' ||
                            annotationTool === 'eraser')
                            ? 'cursor-crosshair'
                            : 'pointer-events-none'
                        }`}
                      />
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-medium uppercase">
                        {selectedMaterial.subject} · {selectedMaterial.sourceType} · {notesDensity}
                      </span>
                      <span>
                        Bold law · Italic trap
                      </span>
                    </div>

                    {/* ORIGINAL UPLOADED MATERIAL VIEWER */}
                    {(notesDensity === 'Original' || notesDensity === 'Split') && (
                      <div
                        className={
                          notesDensity === 'Split'
                            ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 items-start'
                            : 'space-y-4'
                        }
                      >
                        <div className="rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-white/[0.08] pb-2.5">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
                              <span className="font-semibold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                                {selectedMaterial.sourceType.toUpperCase()} · {selectedMaterial.title}
                              </span>
                            </div>
                            {selectedMaterial.sourceRef && (
                              <span className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                {selectedMaterial.sourceRef}
                              </span>
                            )}
                          </div>

                          {selectedMaterial.sourceType === 'youtube' && (() => {
                            const rawUrl =
                              selectedMaterial.originalFileUrl ||
                              selectedMaterial.sourceRef ||
                              '';
                            const ytMatch = rawUrl.match(
                              /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,15})/
                            );
                            const videoId = ytMatch ? ytMatch[1] : null;
                            const marathonChunks = parseOrGenerateMarathonTimestampChunks(
                              selectedMaterial.contentSummary,
                              6,
                              selectedMaterial.chapter
                            );
                            const embedSrc = videoId
                              ? `https://www.youtube.com/embed/${videoId}${
                                  youtubeSeekSeconds > 0
                                    ? `?start=${youtubeSeekSeconds}&autoplay=1`
                                    : ''
                                }`
                              : '';
                            return (
                              <div className="space-y-3">
                                {videoId ? (
                                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#E2E8F0] dark:border-white/[0.08]">
                                    <iframe
                                      key={`${videoId}-${youtubeSeekSeconds}`}
                                      src={embedSrc}
                                      title={selectedMaterial.title}
                                      className="w-full h-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  </div>
                                ) : (
                                  <div className="aspect-video w-full rounded-xl bg-black text-white p-6 flex flex-col items-center justify-center text-center space-y-2 border border-white/[0.08]">
                                    <Youtube className="w-8 h-8 text-rose-500" />
                                    <div className="font-semibold text-sm">{selectedMaterial.title}</div>
                                    <p className="text-xs text-slate-400 max-w-md">
                                      {rawUrl || 'YouTube Lecture'}
                                    </p>
                                  </div>
                                )}

                                <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                                      Timestamp Chapters
                                    </span>
                                    <span className="text-[11px] tabular-nums text-slate-500">
                                      {marathonChunks.length} segments
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {marathonChunks.map((chunk) => (
                                      <button
                                        key={chunk.id}
                                        type="button"
                                        onClick={() => {
                                          setYoutubeSeekSeconds(chunk.seconds);
                                          const targetIdx = Math.max(
                                            0,
                                            Math.min(pagesList.length - 1, chunk.pageNumber - 1)
                                          );
                                          setPageIdx(targetIdx);
                                        }}
                                        className={`p-2 rounded-lg border text-left transition-colors duration-150 cursor-pointer flex items-start gap-2 ${
                                          youtubeSeekSeconds === chunk.seconds
                                            ? 'btn-brand border-transparent'
                                            : 'bg-[#F8FAFF] dark:bg-[#1E293B] border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#283548]'
                                        }`}
                                      >
                                        <span
                                          className={`px-1.5 py-0.5 rounded tabular-nums text-[10px] font-semibold shrink-0 ${
                                            youtubeSeekSeconds === chunk.seconds
                                              ? 'bg-white/20 text-white'
                                              : 'bg-[#E2E8F0] dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]'
                                          }`}
                                        >
                                          {chunk.timestampLabel}
                                        </span>
                                        <span className="text-[11px] font-medium line-clamp-1">
                                          {chunk.topicTitle}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-xs space-y-1.5 max-h-56 overflow-y-auto">
                                  <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                                    Transcript
                                  </div>
                                  <MathRichText content={selectedMaterial.contentSummary} />
                                </div>
                              </div>
                            );
                          })()}

                          {selectedMaterial.sourceType === 'pdf' && (
                            <div className="space-y-3">
                              {selectedMaterial.originalFileUrl &&
                              (selectedMaterial.originalFileUrl.startsWith('data:application/pdf') ||
                                selectedMaterial.originalFileUrl.startsWith('http') ||
                                selectedMaterial.originalFileUrl.startsWith('blob:')) ? (
                                <iframe
                                  src={selectedMaterial.originalFileUrl}
                                  title={`Original PDF: ${selectedMaterial.title}`}
                                  className="w-full h-[460px] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white"
                                />
                              ) : null}
                              <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2 max-h-[420px] overflow-y-auto">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-2">
                                  <span>{selectedMaterial.sourceRef || selectedMaterial.title}</span>
                                  <span className="tabular-nums">Page {currentPageData.pageNumber}</span>
                                </div>
                                <div className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                                  <MathRichText content={selectedMaterial.contentSummary} />
                                </div>
                              </div>
                            </div>
                          )}

                          {selectedMaterial.sourceType === 'photo' && (
                            <div className="space-y-3">
                              {selectedMaterial.originalFileUrl &&
                              (selectedMaterial.originalFileUrl.startsWith('data:image') ||
                                selectedMaterial.originalFileUrl.startsWith('blob:') ||
                                selectedMaterial.originalFileUrl.startsWith('http')) ? (
                                <div className="p-3 bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] flex justify-center">
                                  <img
                                    src={selectedMaterial.originalFileUrl}
                                    alt={selectedMaterial.title}
                                    className="max-h-[440px] w-auto object-contain rounded-lg"
                                  />
                                </div>
                              ) : null}
                              <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2">
                                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                  Scan OCR · {selectedMaterial.sourceRef || selectedMaterial.title}
                                </div>
                                <div className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                                  <MathRichText content={selectedMaterial.contentSummary} />
                                </div>
                              </div>
                            </div>
                          )}

                          {(selectedMaterial.sourceType === 'text' ||
                            selectedMaterial.sourceType === 'drive') && (
                            <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2 max-h-[460px] overflow-y-auto">
                              <div className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8]">
                                {selectedMaterial.sourceRef || selectedMaterial.title}
                              </div>
                              <div className="text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed">
                                <MathRichText content={selectedMaterial.contentSummary} />
                              </div>
                            </div>
                          )}
                        </div>

                        {notesDensity === 'Split' && (
                          <div className="space-y-4">
                            <h2 className="font-semibold tracking-[-0.02em] text-lg sm:text-xl text-[#0F172A] dark:text-[#F8FAFC]">
                              <MathRichText content={currentPageData.heading} inline />
                            </h2>
                            {currentPageData.sections.map((sec, idx) => {
                              const isFormulaBox =
                                sec.tone === 'formula' ||
                                /Governing Laws|Formula/i.test(sec.numberTitle);
                              const isTrapBox =
                                sec.tone === 'trap' ||
                                /Trap|Edge Case/i.test(sec.numberTitle);
                              const isExampleBox =
                                sec.tone === 'example' ||
                                /Solved Example/i.test(sec.numberTitle);
                              const boxCls = isFormulaBox
                                ? 'bg-[#EFF6FF]/75 dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-blue-500/30 border-l-4 border-l-[#2563EB]'
                                : isTrapBox
                                ? 'bg-[#F5F3FF]/80 dark:bg-[#2E1065]/25 border border-[#DDD6FE] dark:border-violet-500/30 border-l-4 border-l-[#7C3AED]'
                                : isExampleBox
                                ? 'bg-[#ECFDF5]/70 dark:bg-[#064E3B]/20 border border-[#A7F3D0] dark:border-emerald-500/30 border-l-4 border-l-[#00A86B]'
                                : 'bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08]';
                              return (
                                <div
                                  key={idx}
                                  className={`p-4 rounded-xl space-y-2.5 ${boxCls}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                                      <MathRichText content={sec.numberTitle} inline />
                                    </h3>
                                    {isFormulaBox && (
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-300">
                                        Key Formulas
                                      </span>
                                    )}
                                    {isTrapBox && (
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#7C3AED]/10 text-[#7C3AED] dark:text-violet-300">
                                        Exam Trap
                                      </span>
                                    )}
                                  </div>
                                  {sec.paragraphs?.map((p, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed"
                                    >
                                      <MathRichText content={p} />
                                    </div>
                                  ))}
                                  {sec.bullets && (
                                    <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1]">
                                      {sec.bullets.map((b, bIdx) => (
                                        <li key={bIdx}>
                                          <MathRichText content={b} inline />
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {sec.formulas && sec.formulas.length > 0 && (
                                    <div className="p-3.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#BFDBFE]/70 dark:border-blue-500/25 border-l-4 border-l-[#00A86B] space-y-2 text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                                      {sec.formulas.map((f, fIdx) => (
                                        <div key={fIdx}>
                                          <MathRichText content={f} />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {notesDensity === 'Quick' && (() => {
                      const fallbackQuick = buildQuickNotesForPage({
                        pageNumber: currentPageData.pageNumber,
                        chapter: selectedMaterial.chapter,
                        subject: selectedMaterial.subject,
                        rawPageText: currentPageData.sections
                          .flatMap((s) => [...(s.paragraphs || []), ...(s.bullets || [])])
                          .join(' '),
                        formulas: currentPageData.sections.flatMap((s) => s.formulas || []),
                        summaryEnglish: currentPageData.aiTutorSummary.english,
                      });
                      const quick = currentPageData.quickNotes || fallbackQuick;
                      return (
                        <section
                          aria-label="Quick Notes"
                          data-testid="quick-notes-sheet"
                          className="space-y-4 rounded-2xl border border-[#E2E8F0] dark:border-white/[0.1] bg-white dark:bg-[#0F172A] p-4 sm:p-6"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-white/[0.08]">
                            <div>
                              <h2 className="text-lg sm:text-xl font-bold tracking-[-0.02em] text-[#0F172A] dark:text-[#F8FAFC]">
                                Quick Notes · High-Yield Revision Sheet
                              </h2>
                              <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                                {selectedMaterial.chapter} ·{' '}
                                {currentPageData.timestampRange || `Page ${currentPageData.pageNumber}`}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-300 border border-[#2563EB]/20">
                              1-Page Sprint
                            </span>
                          </div>

                          {/* 1. Core Formulas & Constants */}
                          <div className="p-4 rounded-xl bg-[#EFF6FF]/75 dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-blue-500/30 border-l-4 border-l-[#2563EB] space-y-2.5">
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#1E40AF] dark:text-blue-300">
                              1. Core Formulas &amp; Constants
                            </h3>
                            <div className="space-y-2 text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                              {quick.formulasAndConstants.map((formula, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-lg bg-white/90 dark:bg-[#0F172A]/80 border border-[#E2E8F0] dark:border-white/[0.08]"
                                >
                                  <MathRichText content={formula} />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 2. 5-7 Bold Key Principles */}
                          <div className="p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2.5">
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                              2. Key Principles ({quick.keyPrinciples.length})
                            </h3>
                            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                              {quick.keyPrinciples.map((kp, idx) => (
                                <li key={idx}>
                                  <MathRichText content={kp} inline />
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* 3. Special Cases & Limiting Conditions */}
                          <div className="p-4 rounded-xl bg-[#ECFDF5]/65 dark:bg-[#064E3B]/20 border border-[#A7F3D0] dark:border-emerald-500/30 border-l-4 border-l-[#00A86B] space-y-2">
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#065F46] dark:text-emerald-300">
                              3. Special Cases &amp; Limiting Conditions
                            </h3>
                            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                              {quick.specialCases.map((sc, idx) => (
                                <li key={idx}>
                                  <MathRichText content={sc} inline />
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* 4. Top 3 JEE Mistakes to Avoid */}
                          <div className="p-4 rounded-xl bg-[#F5F3FF]/80 dark:bg-[#2E1065]/25 border border-[#DDD6FE] dark:border-violet-500/30 border-l-4 border-l-[#7C3AED] space-y-2">
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#5B21B6] dark:text-violet-300">
                              4. Top 3 JEE Mistakes to Avoid
                            </h3>
                            <div className="space-y-1.5 text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                              {quick.topMistakes.map((mistake, idx) => (
                                <div key={idx}>
                                  <MathRichText content={mistake} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      );
                    })()}
                    {notesDensity === 'Full' && (
                      <>
                        <h2 className="font-bold tracking-[-0.02em] text-xl sm:text-2xl text-[#0F172A] dark:text-[#F8FAFC]">
                          <MathRichText content={currentPageData.heading} inline />
                        </h2>

                        {annotateMode && annotationTool === 'edit-text' ? (
                          <div className="p-4 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-3 relative z-20">
                            <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                              Edit Notes &amp; Equations
                            </div>
                            <textarea
                              rows={6}
                              value={editingPageText}
                              onChange={(e) => setEditingPageText(e.target.value)}
                              placeholder="Edit extracted paragraphs and derivations..."
                              className="w-full p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-xs leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]"
                            />
                            <textarea
                              rows={3}
                              value={editingFormulasText}
                              onChange={(e) => setEditingFormulasText(e.target.value)}
                              placeholder="One equation block per line (e.g. $$E = mc^2$$)..."
                              className="w-full p-3 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                            />
                            <button
                              type="button"
                              onClick={handleSaveEditedPageNotes}
                              className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save Changes</span>
                            </button>
                          </div>
                        ) : (
                          currentPageData.sections.map((sec, idx) => {
                            const isFormulaBox =
                              sec.tone === 'formula' ||
                              /Governing Laws|Formula/i.test(sec.numberTitle);
                            const isTrapBox =
                              sec.tone === 'trap' ||
                              /Trap|Edge Case/i.test(sec.numberTitle);
                            const isExampleBox =
                              sec.tone === 'example' ||
                              /Solved Example/i.test(sec.numberTitle);
                            const boxCls = isFormulaBox
                              ? 'bg-[#EFF6FF]/75 dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-blue-500/30 border-l-4 border-l-[#2563EB]'
                              : isTrapBox
                              ? 'bg-[#F5F3FF]/80 dark:bg-[#2E1065]/25 border border-[#DDD6FE] dark:border-violet-500/30 border-l-4 border-l-[#7C3AED]'
                              : isExampleBox
                              ? 'bg-[#ECFDF5]/70 dark:bg-[#064E3B]/20 border border-[#A7F3D0] dark:border-emerald-500/30 border-l-4 border-l-[#00A86B]'
                              : 'bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08]';
                            return (
                              <div
                                key={idx}
                                className={`p-4 sm:p-5 rounded-xl space-y-3 ${boxCls}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h3 className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC]">
                                    <MathRichText content={sec.numberTitle} inline />
                                  </h3>
                                  {isFormulaBox && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-300">
                                      Key Formulas &amp; Laws
                                    </span>
                                  )}
                                  {isTrapBox && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#7C3AED]/10 text-[#7C3AED] dark:text-violet-300">
                                      Exam Traps &amp; Edge Cases
                                    </span>
                                  )}
                                </div>
                                {sec.paragraphs?.map((p, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed"
                                  >
                                    <MathRichText content={p} />
                                  </div>
                                ))}
                                {sec.bullets && (
                                  <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1]">
                                    {sec.bullets.map((b, bIdx) => (
                                      <li key={bIdx}>
                                        <MathRichText content={b} inline />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {sec.formulas && sec.formulas.length > 0 && (
                                  <div className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-[#BFDBFE]/70 dark:border-blue-500/25 border-l-4 border-l-[#00A86B] space-y-2 text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                                    {sec.formulas.map((f, fIdx) => (
                                      <div key={fIdx}>
                                        <MathRichText content={f} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </>
                    )}

                    {/* Sticky Callout Notes */}
                    {callouts.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 relative z-20">
                        {callouts.map((c) => (
                          <div
                            key={c.id}
                            className="p-3 rounded-xl bg-amber-50 dark:bg-[#1E293B] border border-amber-500/30 text-xs text-[#0F172A] dark:text-[#F8FAFC] flex items-start justify-between gap-2"
                          >
                            <MathRichText content={c.text} />
                            <button
                              type="button"
                              onClick={() =>
                                setCallouts((prev) => prev.filter((item) => item.id !== c.id))
                              }
                              className="text-amber-600 dark:text-amber-400 hover:text-rose-500 font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {annotateMode && annotationTool === 'callout' && (
                      <div className="p-3.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-amber-500/30 flex items-center gap-2 relative z-20">
                        <input
                          type="text"
                          value={newCalloutText}
                          onChange={(e) => setNewCalloutText(e.target.value)}
                          placeholder="Add callout or equation ($...$)..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newCalloutText.trim()) {
                              setCallouts((prev) => [
                                ...prev,
                                {
                                  id: `cal-${Date.now()}`,
                                  text: newCalloutText.trim(),
                                  color: penColor,
                                },
                              ]);
                              setNewCalloutText('');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg btn-brand text-xs font-semibold cursor-pointer"
                        >
                          Pin
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Page Progress Bar */}
                  <div className="px-6 py-3 border-t border-[#E2E8F0] dark:border-white/[0.08] flex items-center justify-between gap-4 text-xs text-slate-500">
                    <span>Progress</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] rounded-full transition-all"
                        style={{
                          width: `${Math.round(((pageIdx + 1) / Math.max(1, pagesList.length)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-medium tabular-nums">
                      {currentPageData.pageNumber} / {pagesList.length}
                    </span>
                  </div>
                </div>

                {/* Right AI Tutor Panel */}
                <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold tracking-[-0.02em] text-base text-[#0F172A] dark:text-[#F8FAFC]">
                        AI Tutor
                      </h2>
                      <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-0.5 text-[11px] font-medium">
                        {(['English', 'Hinglish'] as const).map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setTutorLang(l)}
                            className={`px-2 py-0.5 rounded cursor-pointer transition-colors duration-150 ${
                              tutorLang === l
                                ? 'bg-white dark:bg-[#111827] text-[#0F172A] dark:text-[#F8FAFC]'
                                : 'text-slate-500'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-white/[0.08] text-xs">
                      <div className="inline-flex rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setTutorContextMode('strict_material')}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors duration-150 cursor-pointer ${
                            tutorContextMode === 'strict_material'
                              ? 'btn-brand'
                              : 'text-[#475569] dark:text-[#94A3B8]'
                          }`}
                        >
                          Strict Material
                        </button>
                        <button
                          type="button"
                          onClick={() => setTutorContextMode('open_jee')}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors duration-150 cursor-pointer ${
                            tutorContextMode === 'open_jee'
                              ? 'btn-brand'
                              : 'text-[#475569] dark:text-[#94A3B8]'
                          }`}
                        >
                          Open JEE
                        </button>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCreateDropdown((v) => !v)}
                          className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create ▾</span>
                        </button>

                        {showCreateDropdown && (
                          <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] py-1.5 z-20 text-xs">
                            {(
                              [
                                { label: '2D / 3D Diagram', tab: 'Diagram Maker' },
                                { label: 'Concept Image', tab: 'Visual' },
                                { label: 'Animated Video', tab: 'Animated Lesson' },
                              ] as const
                            ).map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                  setShowCreateDropdown(false);
                                  setCreateTab(item.tab);
                                  setSubTab('Create');
                                }}
                                className="w-full px-3.5 py-2 text-left hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] font-medium text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 cursor-pointer transition-colors duration-150"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                                <span>{item.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      {(
                        [
                          { id: 'board', label: 'Board Level' },
                          { id: 'jee_main', label: 'JEE Main' },
                          { id: 'jee_advanced', label: 'JEE Advanced' },
                        ] as const
                      ).map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setTutorDifficulty(lvl.id)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-pointer transition-colors duration-150 ${
                            tutorDifficulty === lvl.id
                              ? 'btn-brand border-transparent'
                              : 'border-[#E2E8F0] dark:border-white/[0.08] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1 flex-1">
                      <div className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] p-4 space-y-3 bg-[#F8FAFF] dark:bg-[#1E293B]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            Page {currentPageData.pageNumber} Summary
                          </span>
                          <button
                            type="button"
                            onClick={handlePlayTTS}
                            disabled={ttsPlaying}
                            className="text-xs font-medium text-[#2563EB] dark:text-[#60A5FA] inline-flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>{ttsPlaying ? 'Speaking...' : 'Read Aloud'}</span>
                          </button>
                        </div>

                        <div className="text-xs sm:text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                          <MathRichText
                            content={
                              currentPageData.aiTutorSummary[
                                tutorLang === 'Hinglish' ? 'hinglish' : 'english'
                              ]
                            }
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={tutorLoading}
                            onClick={() => handleTutorExplain('Simpler')}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer transition-colors duration-150"
                          >
                            Explain Simpler
                          </button>
                          <button
                            type="button"
                            disabled={tutorLoading}
                            onClick={() => handleTutorExplain('Deeper')}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer transition-colors duration-150"
                          >
                            Explain Deeper
                          </button>
                          <button
                            type="button"
                            disabled={tutorLoading}
                            onClick={() => handleTutorExplain('UnitCheck')}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#00A86B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer transition-colors duration-150"
                          >
                            Unit Check
                          </button>
                        </div>
                      </div>

                      {tutorChat.map((turn) => (
                        <div
                          key={turn.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                            turn.role === 'user'
                              ? 'bg-[#F8FAFF] dark:bg-[#1E293B] border-[#E2E8F0] dark:border-white/[0.08] ml-6'
                              : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[11px] uppercase text-slate-500">
                              {turn.role === 'user'
                                ? 'You'
                                : `Tutor · ${
                                    turn.contextMode === 'strict_material'
                                      ? 'Strict'
                                      : 'Open JEE'
                                  }`}
                            </span>
                          </div>

                          <MathRichText content={turn.text} className="leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]" />

                          {turn.citations && turn.citations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {turn.citations.map((cit, cIdx) => (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => {
                                    const index = pagesList.findIndex((page) => page.pageNumber === cit.pageNumber);
                                    if (index >= 0) setPageIdx(index);
                                  }}
                                  className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-white/[0.08] text-[10px] font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#283548] cursor-pointer"
                                  title={cit.excerpt}
                                >
                                  Page {cit.pageNumber}
                                </button>
                              ))}
                            </div>
                          )}

                          {turn.role === 'tutor' && !turn.failed && (
                            <div className="pt-2 border-t border-[#E2E8F0] dark:border-white/[0.08] space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setVisualPickerTurnId(
                                    visualPickerTurnId === turn.id ? null : turn.id
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                                <span>
                                  {generatingInlineVisual === turn.id
                                    ? 'Synthesizing...'
                                    : 'Create Visual'}
                                </span>
                              </button>

                              {visualPickerTurnId === turn.id && (
                                <div className="p-2.5 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] grid grid-cols-2 gap-1.5">
                                  {(
                                    [
                                      '2D Diagram',
                                      '3D Scene',
                                      'Concept Image',
                                      'Animated Video',
                                    ] as const
                                  ).map((vType) => (
                                    <button
                                      key={vType}
                                      type="button"
                                      onClick={() =>
                                        handleCreateVisualFromTutorReply(turn, vType)
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-left font-medium text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer transition-colors duration-150"
                                    >
                                      + {vType}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {turn.embeddedVisual && (
                                <div className="p-3 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2">
                                  <div className="text-[11px] font-medium text-slate-500">
                                    {turn.embeddedVisual.type} · Saved to Library
                                  </div>
                                  {turn.embeddedVisual.type === '2D Diagram' &&
                                    turn.embeddedVisual.svgHtml && (
                                      <div
                                        className="w-full h-48 bg-white rounded-lg p-2 flex items-center justify-center overflow-hidden"
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeSvgMarkup(turn.embeddedVisual.svgHtml),
                                        }}
                                      />
                                    )}
                                  {turn.embeddedVisual.type === '3D Scene' &&
                                    turn.embeddedVisual.preset && (
                                      <div className="w-full h-56 rounded-lg overflow-hidden">
                                        <ThreeSceneCanvas
                                          preset={turn.embeddedVisual.preset}
                                          animateMotion={true}
                                        />
                                      </div>
                                    )}
                                  {turn.embeddedVisual.type === 'Concept Image' && (
                                    <div className="w-full bg-white rounded-lg p-2 flex items-center justify-center">
                                      {turn.embeddedVisual.imageUrl ? (
                                        <img
                                          src={turn.embeddedVisual.imageUrl}
                                          alt="Tutor Concept Visual"
                                          className="max-h-48 object-contain rounded"
                                        />
                                      ) : turn.embeddedVisual.svgHtml ? (
                                        <div
                                          className="w-full h-44 flex items-center justify-center"
                                          dangerouslySetInnerHTML={{
                                            __html: sanitizeSvgMarkup(turn.embeddedVisual.svgHtml),
                                          }}
                                        />
                                      ) : null}
                                    </div>
                                  )}
                                  {turn.embeddedVisual.type === 'Animated Video' && (
                                    turn.embeddedVisual.animatedSvg ? (
                                      <div
                                        className="w-full bg-white rounded-lg p-2 flex items-center justify-center overflow-hidden"
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeSvgMarkup(turn.embeddedVisual.animatedSvg),
                                        }}
                                      />
                                    ) : turn.embeddedVisual.videoUrl?.startsWith('data:image/svg+xml') ? (
                                      <img
                                        src={turn.embeddedVisual.videoUrl}
                                        alt={turn.embeddedVisual.promptUsed}
                                        className="w-full max-h-48 object-contain rounded-lg bg-white"
                                      />
                                    ) : turn.embeddedVisual.videoUrl ? (
                                      <video
                                        controls
                                        src={turn.embeddedVisual.videoUrl}
                                        className="w-full max-h-48 rounded-lg"
                                      />
                                    ) : turn.embeddedVisual.svgHtml ? (
                                      <div
                                        className="w-full h-44 bg-white rounded-lg p-2 flex items-center justify-center"
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeSvgMarkup(turn.embeddedVisual.svgHtml),
                                        }}
                                      />
                                    ) : null
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (tutorQuestion.trim()) handleTutorExplain('Custom');
                    }}
                    className="flex items-center gap-2 pt-3 border-t border-[#E2E8F0] dark:border-white/[0.08]"
                  >
                    <input
                      type="text"
                      value={tutorQuestion}
                      onChange={(e) => setTutorQuestion(e.target.value)}
                      placeholder={
                        tutorContextMode === 'strict_material'
                          ? `Ask from ${selectedMaterial.title}...`
                          : 'Ask a JEE doubt...'
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8FAFF] dark:bg-[#1E293B] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                    />
                    <button
                      type="submit"
                      disabled={tutorLoading}
                      aria-label="Send question to AI Tutor"
                      className="p-2.5 rounded-lg btn-brand cursor-pointer transition-colors duration-150"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {subTab === 'Create' && (
        <CreateStudioPanel
          materials={materials}
          selectedMaterial={selectedMaterial ?? null}
          creations={creations}
          onSaveCreation={onSaveCreation}
          requestedCreateTab={createTab}
        />
      )}

      {subTab === 'Resources' && (
        <ResourcesAndGuidePanel onAddQuickSheetMaterial={onAddQuickSheetMaterial} />
      )}
    </div>
  );
};
