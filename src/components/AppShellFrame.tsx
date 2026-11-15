import React from 'react';
import {
  Home,
  BookOpen,
  Target,
  Layers,
  BarChart3,
  Plus,
  Search,
  Grid,
  Clock,
  Sun,
  Moon,
  Bell,
  CheckCircle2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Sparkles,
  FolderOpen,
  Mic,
  Menu,
} from 'lucide-react';
import { MaterialItem } from './HomeAndStudyViews';
import { PrimaryTab, StudySubTabId } from '../hooks/useLearnMateAppState';
import { ExamTrack } from '../utils/jeeEngine';
import { BrandLogo } from './BrandLogo';

export interface AppShellFrameProps {
  children: React.ReactNode;
  activeTab: PrimaryTab;
  onSelectTab: (tab: PrimaryTab) => void;
  studySubTab: StudySubTabId;
  onSelectStudySubTab: (sub: StudySubTabId) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  subscriptionTier: 'free' | 'pro' | 'institute';
  onOpenProModal: () => void;
  materials: MaterialItem[];
  selectedMaterial: MaterialItem | null;
  onSelectMaterial: (mat: MaterialItem) => void;
  onOpenAddMaterial: () => void;
  searchModalOpen: boolean;
  onSetSearchModalOpen: (open: boolean) => void;
  globalSearchQuery: string;
  onSetGlobalSearchQuery: (q: string) => void;
  onOpenStudyTools: () => void;
  focusTimerOpen: boolean;
  focusRunning: boolean;
  focusClockLabel: string;
  onToggleFocusTimer: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onOpenVoiceTutor: () => void;
  onOpenProfileModal: () => void;
  avatarColor: string;
  userInitial: string;
  onStartCBTMock: (mode: ExamTrack) => void;
  toastMessage: string | null;
  companionSlot?: React.ReactNode;
  mobileCompanionSlot?: React.ReactNode;
}

export const AppShellFrame: React.FC<AppShellFrameProps> = ({
  children,
  activeTab,
  onSelectTab,
  studySubTab,
  onSelectStudySubTab,
  sidebarCollapsed,
  onToggleSidebar,
  subscriptionTier,
  onOpenProModal,
  materials,
  selectedMaterial,
  onSelectMaterial,
  onOpenAddMaterial,
  searchModalOpen,
  onSetSearchModalOpen,
  globalSearchQuery,
  onSetGlobalSearchQuery,
  onOpenStudyTools,
  focusTimerOpen,
  focusRunning,
  focusClockLabel,
  onToggleFocusTimer,
  darkMode,
  onToggleDarkMode,
  notificationsOpen,
  onToggleNotifications,
  onCloseNotifications,
  onOpenVoiceTutor,
  onOpenProfileModal,
  avatarColor,
  userInitial,
  onStartCBTMock,
  toastMessage,
  companionSlot,
  mobileCompanionSlot,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div
      className={`min-h-screen transition-colors duration-150 ${
        darkMode ? 'bg-[#070B14] text-[#F8FAFC]' : 'bg-[#F8FAFF] text-[#0F172A]'
      }`}
    >
      {/* STREAMLINED TOP NAVBAR */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-white/[0.08] px-3 sm:px-4 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 w-full">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden lg:inline-flex p-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#0F172A] dark:text-[#F8FAFC] transition-colors duration-150 cursor-pointer shrink-0"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle Left Navigation Sidebar"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('Home')}
            className="flex items-center text-left cursor-pointer group min-w-0"
            aria-label="LearnMate JEE Home"
          >
            <BrandLogo
              className="w-7 h-6 sm:w-8 sm:h-7"
              showWordmark
              wordmarkClassName="font-display font-semibold text-sm sm:text-base tracking-[-0.02em]"
              badgeText="JEE"
            />
          </button>
        </div>

        {/* Right: Global Actions & Utilities */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenProModal}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-150 cursor-pointer ${
              subscriptionTier === 'pro' || subscriptionTier === 'institute'
                ? 'border-[#2563EB]/35 bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA]'
                : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
            title="Plans"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#7C3AED] shrink-0" />
            <span className="tabular-nums text-[11px] font-semibold">
              {subscriptionTier === 'institute'
                ? 'INSTITUTE'
                : subscriptionTier === 'pro'
                ? 'PRO'
                : `${Math.min(5, materials.length)}/5 Free`}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAddMaterial}
            aria-label="Add Material"
            className="btn-brand inline-flex items-center gap-1.5 p-1.5 sm:px-3 lg:px-3.5 sm:py-2 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden lg:inline">Add Material</span>
            <span className="hidden md:inline lg:hidden">Add</span>
          </button>

          <button
            type="button"
            onClick={() => onSetSearchModalOpen(true)}
            aria-label="Search"
            className="inline-flex items-center gap-1.5 p-1.5 sm:p-2 lg:px-3 lg:py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors duration-150 cursor-pointer shrink-0"
            title="Search (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
            <span className="hidden lg:inline">Search</span>
          </button>

          <button
            type="button"
            onClick={onOpenStudyTools}
            aria-label="Study Tools"
            className="hidden md:inline-flex items-center gap-1.5 p-2 lg:px-3 lg:py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors duration-150 cursor-pointer shrink-0"
          >
            <Grid className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8]" />
            <span className="hidden lg:inline">Tools</span>
          </button>

          <button
            type="button"
            onClick={onToggleFocusTimer}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs tabular-nums font-medium transition-colors duration-150 cursor-pointer ${
              focusTimerOpen || focusRunning
                ? 'border-[#2563EB]/40 bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA]'
                : 'border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#475569] dark:text-[#94A3B8]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{focusClockLabel}</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle Theme"
            className="p-1.5 sm:p-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#475569] dark:text-[#94A3B8] transition-colors duration-150 cursor-pointer shrink-0"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-[#00A86B]" /> : <Moon className="w-4 h-4 text-[#2563EB]" />}
          </button>

          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={onToggleNotifications}
              aria-label="Notifications"
              className="relative p-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-[#475569] dark:text-[#94A3B8] transition-colors duration-150 cursor-pointer"
              title="Alerts"
            >
              <Bell className="w-4 h-4" />
              {materials.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2563EB] text-white text-[9px] tabular-nums font-bold flex items-center justify-center">
                  {materials.length}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl p-4 z-50 text-[#0F172A] dark:text-[#F8FAFC]">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-200 dark:border-white/[0.07]">
                  <span className="text-xs font-semibold">Alerts</span>
                  <button
                    onClick={onCloseNotifications}
                    className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-[#fafafa] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  {materials.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseNotifications();
                        onOpenAddMaterial();
                      }}
                      className="w-full text-left p-3 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer transition-colors duration-150"
                    >
                      <div className="font-semibold">No materials uploaded</div>
                      <div className="text-[#475569] dark:text-[#94A3B8] mt-0.5">
                        Upload PDF, photo, or lecture link →
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseNotifications();
                        onSelectTab('Revise');
                      }}
                      className="w-full text-left p-3 rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] cursor-pointer transition-colors duration-150"
                    >
                      <div className="font-semibold">
                        {materials.length} {materials.length === 1 ? 'material' : 'materials'} ready
                      </div>
                      <div className="text-[#475569] dark:text-[#94A3B8] mt-0.5">
                        Open Revise →
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenVoiceTutor}
            aria-label="Voice Tutor"
            className="hidden md:inline-flex items-center gap-1.5 p-2 lg:px-3 lg:py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] transition-colors duration-150 cursor-pointer shrink-0"
            title="Voice Tutor"
          >
            <Mic className="w-3.5 h-3.5 text-[#00A86B]" />
            <span className="hidden lg:inline">Voice Tutor</span>
          </button>

          {mobileCompanionSlot}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Open Mobile Study Menu"
            aria-expanded={mobileMenuOpen}
            className="md:hidden inline-flex items-center justify-center p-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer shrink-0"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenProfileModal}
            style={{ backgroundColor: avatarColor || '#2563EB' }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-white font-semibold text-xs flex items-center justify-center transition-opacity cursor-pointer border border-white/15 hover:opacity-90 shrink-0"
            title="Profile & Settings"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* MOBILE (<768px) MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-40 bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl p-4 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenProModal();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F1F5F9] dark:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>
                {subscriptionTier === 'institute'
                  ? 'Institute Seat'
                  : subscriptionTier === 'pro'
                  ? 'Pro Aspirant'
                  : `${Math.min(5, materials.length)}/5 Free Scans`}
              </span>
            </span>
            <span>Plans →</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenStudyTools();
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
            >
              <Grid className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
              <span>Study Tools</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onToggleFocusTimer();
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
            >
              <Clock className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
              <span className="tabular-nums">{focusClockLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenVoiceTutor();
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
            >
              <Mic className="w-4 h-4 text-[#00A86B]" />
              <span>Voice Tutor</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onToggleNotifications();
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
              <span>Alerts ({materials.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* FULL-DESKTOP SHELL (>=1024px): SIDEBAR + FLUID STAGE */}
      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        <aside
          data-testid="desktop-sidebar"
          className={`hidden lg:flex shrink-0 bg-[#FFFFFF] dark:bg-[#111827] border-r border-[#E2E8F0] dark:border-white/[0.08] transition-all duration-150 flex-col justify-between sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto ${
            sidebarCollapsed ? 'w-[72px] px-2.5 py-4' : 'w-64 px-3.5 py-5'
          }`}
        >
          <div className="space-y-6">
            <div>
              {!sidebarCollapsed && (
                <div className="px-2.5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                  Workspace
                </div>
              )}
              <nav className="space-y-1">
                {(
                  [
                    { id: 'Home', label: 'Home', icon: Home },
                    { id: 'Study', label: 'Study', icon: BookOpen },
                    { id: 'Practice', label: 'Practice', icon: Target },
                    { id: 'Revise', label: 'Revise', icon: Layers },
                    { id: 'Progress', label: 'Progress', icon: BarChart3 },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onSelectTab(tab.id)}
                      title={sidebarCollapsed ? tab.label : undefined}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                      } rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA] font-semibold'
                          : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{tab.id}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>

            {!sidebarCollapsed && (
              <div>
                <div className="px-2.5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                  Study
                </div>
                <div className="space-y-0.5">
                  {(
                    [
                      { id: 'Chapter Notes', label: 'Chapter Notes', icon: FileText },
                      { id: 'My Materials', label: 'Materials', icon: FolderOpen },
                      { id: 'AI Tutor', label: 'Doubt Solver', icon: Sparkles },
                      { id: 'Syllabus', label: 'Syllabus', icon: BookOpen },
                      { id: 'Create', label: 'Visuals', icon: Grid },
                      { id: 'Resources', label: 'Reference Books', icon: Layers },
                    ] as const
                  ).map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeTab === 'Study' && studySubTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          onSelectStudySubTab(sub.id);
                          onSelectTab('Study');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                          isSubActive
                            ? 'bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA] font-semibold'
                            : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                        }`}
                      >
                        <SubIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!sidebarCollapsed && materials.length > 0 && (
              <div>
                <div className="px-2.5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                  Recent ({materials.length})
                </div>
                <div className="space-y-1">
                  {materials.slice(0, 5).map((mat) => {
                    const isSelected = selectedMaterial?.id === mat.id;
                    return (
                      <button
                        key={mat.id}
                        onClick={() => {
                          onSelectMaterial(mat);
                          onSelectStudySubTab('Chapter Notes');
                          onSelectTab('Study');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#0F172A] dark:text-[#F8FAFC] border border-[#2563EB]/25 font-semibold'
                            : 'text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] font-medium'
                        }`}
                      >
                        <div className="truncate">{mat.title}</div>
                        <div className="text-[10px] text-[#475569] dark:text-[#94A3B8] truncate">
                          {mat.subject} · {mat.chapter}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 pb-6 border-t border-[#E2E8F0] dark:border-white/[0.08] space-y-2">
            {companionSlot}
            <button
              onClick={onToggleSidebar}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'
              } rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#283548] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] text-xs font-medium transition-colors duration-150 cursor-pointer`}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {!sidebarCollapsed && <span>Collapse</span>}
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 w-full pb-20 lg:pb-10">{children}</main>
      </div>

      {/* MOBILE & TABLET (<1024px) 5-TAB BOTTOM BAR */}
      <nav
        aria-label="Primary Mobile Navigation"
        data-testid="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF] dark:bg-[#111827] border-t border-[#E2E8F0] dark:border-white/[0.08] px-1.5 py-1 flex items-center justify-around"
      >
        {(
          [
            { id: 'Home', label: 'Home', icon: Home },
            { id: 'Study', label: 'Study', icon: BookOpen },
            { id: 'Practice', label: 'Practice', icon: Target },
            { id: 'Revise', label: 'Revise', icon: Layers },
            { id: 'Progress', label: 'Progress', icon: BarChart3 },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[44px] min-w-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'text-[#2563EB] dark:text-[#60A5FA] bg-[#2563EB]/10 dark:bg-[#2563EB]/15 font-semibold'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Global Search Command Modal (Cmd+K) */}
      {searchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Global Search"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4"
        >
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] shadow-2xl w-full max-w-xl overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]">
            <div className="p-4 border-b border-zinc-200 dark:border-white/[0.07] flex items-center gap-3">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                autoFocus
                value={globalSearchQuery}
                onChange={(e) => onSetGlobalSearchQuery(e.target.value)}
                placeholder="Jump to materials, calculator, Voice Tutor, or CBT..."
                className="flex-1 text-sm font-medium focus:outline-none bg-transparent placeholder:text-zinc-400"
              />
              <button
                onClick={() => onSetSearchModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-[#fafafa] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2.5 max-h-80 overflow-y-auto space-y-1 text-xs">
              {[
                ...materials.map((m) => ({
                  label: `${m.title} · ${m.subject}`,
                  action: () => {
                    onSelectMaterial(m);
                    onSelectTab('Study');
                    onSelectStudySubTab('Chapter Notes');
                  },
                })),
                {
                  label: 'Upload Material (PDF, Photo, YouTube)',
                  action: () => onOpenAddMaterial(),
                },
                {
                  label: 'Live Voice Tutor',
                  action: () => onOpenVoiceTutor(),
                },
                {
                  label: 'Graphing & Scientific Calculator',
                  action: () => onOpenStudyTools(),
                },
                {
                  label: '75-Q JEE Main CBT Mock',
                  action: () => onStartCBTMock('JEE Main'),
                },
                {
                  label: 'JEE Advanced CBT Mock',
                  action: () => onStartCBTMock('JEE Advanced'),
                },
                {
                  label: 'Revise · Formula Book & Flashcards',
                  action: () => onSelectTab('Revise'),
                },
              ]
                .filter(
                  (item) =>
                    !globalSearchQuery.trim() ||
                    item.label.toLowerCase().includes(globalSearchQuery.toLowerCase())
                )
                .map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      item.action();
                      onSetSearchModalOpen(false);
                    }}
                    className="w-full p-2.5 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-left font-medium flex items-center justify-between cursor-pointer transition-colors duration-150"
                  >
                    <span>{item.label}</span>
                    <span className="text-[#475569] dark:text-[#94A3B8]">→</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-28 md:bottom-14 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] sm:w-auto max-w-md px-4 py-2.5 rounded-xl bg-[#0F172A] dark:bg-[#1E293B] text-[#F8FAFC] text-xs font-medium shadow-2xl flex items-center gap-2 border border-white/[0.1]">
          <CheckCircle2 className="w-4 h-4 text-[#00A86B] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
