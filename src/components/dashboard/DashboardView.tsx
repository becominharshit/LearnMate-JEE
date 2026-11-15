import React from 'react';
import { Sliders, Brain, Zap } from 'lucide-react';
import {
  HomeDashboardView,
  MaterialItem,
  StudyTaskItem,
} from '../HomeAndStudyViews';

export interface DashboardViewProps {
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
  sm2DueCount?: number;
  mistakesCount?: number;
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, durationMin: number) => void;
  onDeleteTask: (taskId: string) => void;
  onSyncWorkspaceTasks: () => void;
  onOpenStudyWorkbench: (mat?: MaterialItem) => void;
  onOpenMyMaterials: () => void;
  onOpenSyllabus: () => void;
  onOpenRevise: () => void;
  onOpenPractice: () => void;
  onOpenProgress: () => void;
  onOpenAddMaterial: (tab: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive') => void;
  onOpenStudyTools: () => void;
  onOpenCustomTestGenerator?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  return (
    <div className="space-y-2">
      {/* Quick Action Bar */}
      <div className="w-full px-6 lg:px-10 xl:px-12 pt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={props.onOpenCustomTestGenerator}
            className="btn-brand px-3.5 py-2 rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            Custom Test Builder
          </button>
          <button
            type="button"
            onClick={props.onOpenRevise}
            className="px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Recall Queue</span>
            <span className="tabular-nums font-semibold text-[11px] px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]">
              {props.sm2DueCount ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={props.onOpenRevise}
            className="px-3.5 py-2 rounded-xl border border-rose-500/20 bg-[#FFFFFF] dark:bg-[#111827] hover:bg-rose-500/5 text-rose-700 dark:text-rose-400 font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Mistake Book</span>
            <span className="tabular-nums font-semibold text-[11px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300">
              {props.mistakesCount ?? 0}
            </span>
          </button>
        </div>
      </div>

      <HomeDashboardView {...props} />
    </div>
  );
};
