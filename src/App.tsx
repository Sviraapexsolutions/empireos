import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Bell,
  Briefcase,
  CalendarDays,
  CheckSquare,
  Flame,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  Settings,
  WifiOff,
  X,
} from 'lucide-react';
import { auth } from './firebase';
import { AuthScreen } from './components/AuthScreen';
import { CalendarTab } from './components/CalendarTab';
import { ConfirmDialog, type ConfirmOption } from './components/ConfirmDialog';
import {
  BusinessModal,
  HabitModal,
  NotificationsModal,
  ProjectModal,
  TaskModal,
} from './components/CrudModals';
import { DashboardTab } from './components/DashboardTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FilePreviewModal } from './components/FilePreviewModal';
import { GlobalSearchBar } from './components/GlobalSearchBar';
import { HabitsCoachTab } from './components/HabitsCoachTab';
import { InstallReleasePage } from './components/InstallReleasePage';
import { LockInModal } from './components/LockInModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RealityCheckModal } from './components/RealityCheckModal';
import { SettingsTab } from './components/SettingsTab';
import { TodayTab } from './components/TodayTab';
import { VenturesTab, type VentureBulkAction, type VentureSelection } from './components/VenturesTab';
import { useEmpireData } from './hooks/useEmpireData';
import {
  clearWorkspaceItems,
  createBusiness,
  createHabit,
  createProject,
  createTask,
  deleteBusinessCascade,
  deleteCoachLog,
  deleteHabit,
  deleteProjectCascade,
  bulkDelete,
  closeBusiness,
  closeProject,
  completeTasks,
  deleteTask,
  deleteTaskFile,
  requestRealityCheckAndSave,
  rescheduleTask,
  toggleBusinessActive,
  toggleHabitDate,
  toggleProjectArchived,
  updateBusiness,
  updateHabit,
  updateNotificationPrefs,
  updateProject,
  updateTaskDetails,
  updateTaskStatus,
  updateUserProfileSettings,
  uploadTaskFile,
} from './services/empireService';
import type {
  Business,
  ExecutiveAlert,
  Habit,
  Project,
  RealityCheckPayload,
  TabId,
  Task,
  TaskFile,
  TriggerReason,
} from './types/empire';
import { formatReadableDate, getCurrentHHmm, getTodayKey, triggerHaptic } from './utils/dateUtils';
import { loadFileObjectUrl } from './utils/fileVault';
import type { ParsedQuickAdd } from './utils/nlParser';
import { appPath, isInstallPath } from './config/appConfig';
import { showNotificationNow } from './services/notifications';
import { AuthActionPage, getAuthActionParams } from './components/AuthActionPage';

const SIDEBAR_TABS: Array<{
  id: TabId;
  label: string;
  shortLabel: string;
  icon: typeof CheckSquare;
}> = [
  { id: 'dashboard', label: 'Executive Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { id: 'today', label: 'Today Command', shortLabel: 'Today', icon: CheckSquare },
  { id: 'calendar', label: 'Master Calendar', shortLabel: 'Calendar', icon: CalendarDays },
  { id: 'ventures', label: 'Ventures & Projects', shortLabel: 'Ventures', icon: Briefcase },
  { id: 'habits', label: 'Habits & Coach', shortLabel: 'Habits', icon: Flame },
  { id: 'settings', label: 'Settings & Profile', shortLabel: 'Settings', icon: Settings },
];

const MOBILE_BOTTOM_TABS = SIDEBAR_TABS.filter((t) => t.id !== 'settings');

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'neutral';
  options?: ConfirmOption[];
  defaultOption?: string;
  onConfirm: (selectedOption?: string) => Promise<void>;
}

function EmpireWorkspace({
  user,
  initialTab = 'dashboard',
  onOpenInstallPage,
}: {
  user: User;
  initialTab?: TabId;
  onOpenInstallPage: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [executiveAlert, setExecutiveAlert] = useState<ExecutiveAlert | null>(null);
  const [focusedProject, setFocusedProject] = useState<{
    businessId: string;
    projectId: string;
    nonce: number;
  } | null>(null);

  // Custom avatar ObjectURL loaded from hybrid IndexedDB / server vault
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

  // File preview lightbox
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null);

  // Reusable in-app ConfirmDialog state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // Reality Check Modal state
  const [rcOpen, setRcOpen] = useState(false);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcError, setRcError] = useState('');
  const [rcTask, setRcTask] = useState<Task | null>(null);
  const [rcReason, setRcReason] = useState<TriggerReason>('manual');
  const [rcPayload, setRcPayload] = useState<RealityCheckPayload | null>(null);

  // Lock In Modal state
  const [lockInTask, setLockInTask] = useState<Task | null>(null);

  // CRUD Modal states
  const [bizModalOpen, setBizModalOpen] = useState(false);
  const [editingBiz, setEditingBiz] = useState<Business | null>(null);

  const [projModalOpen, setProjModalOpen] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [defaultProjBizId, setDefaultProjBizId] = useState('');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDefaults, setTaskDefaults] = useState<{
    title?: string;
    businessId?: string;
    projectId?: string;
    phaseHeading?: string;
    scheduledDate?: string;
  }>({});

  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const [notifModalOpen, setNotifModalOpen] = useState(false);

  const autoOverdueRef = useRef<(task: Task) => void>(() => {});

  const {
    profile,
    businesses,
    projects,
    tasks,
    habits,
    coachLogs,
    files,
    loading,
    isOffline,
    todayStats,
    blockedTaskIds,
  } = useEmpireData(user, {
    onExecutiveAlert: (alert) => setExecutiveAlert(alert),
    onAutoOverdueTask: (task) => autoOverdueRef.current(task),
  });

  // Load user's custom uploaded profile avatar whenever avatarFileId changes
  useEffect(() => {
    const fileId = profile?.avatarFileId;
    if (!fileId) {
      setAvatarUrl(null);
      return;
    }
    let active = true;
    let createdUrl: string | null = null;

    loadFileObjectUrl(fileId).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      createdUrl = url;
      setAvatarUrl(url);
    });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [profile?.avatarFileId, avatarRefreshKey]);

  const bizMap = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const filesMap = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);

  const triggerRealityCheckInternal = async (task: Task, reason: TriggerReason) => {
    const bizName = bizMap.get(task.businessId)?.name || 'Empire Portfolio';
    const projName = task.projectId ? projMap.get(task.projectId)?.name : undefined;

    setRcTask(task);
    setRcReason(reason);
    setRcPayload(null);
    setRcError('');
    setRcLoading(true);
    setRcOpen(true);

    try {
      const result = await requestRealityCheckAndSave({
        uid: user.uid,
        taskId: task.id,
        taskTitle: task.title,
        businessName: bizName,
        projectName: projName,
        completionPercent: todayStats.percent,
        triggerReason: reason,
        provider: profile?.aiProvider || 'gemini',
      });
      setRcPayload(result);
    } catch (err) {
      setRcError(err instanceof Error ? err.message : 'Unable to reach Accountability Coach.');
    } finally {
      setRcLoading(false);
    }
  };

  autoOverdueRef.current = (task: Task) => {
    void triggerRealityCheckInternal(task, 'overdue');
  };

  // --- Handlers ---
  const handleCreateFromParsed = async (parsed: ParsedQuickAdd) => {
    const fallbackBiz =
      parsed.business || businesses.find((b) => b.isActive) || businesses[0];
    if (!fallbackBiz) return;

    if (parsed.isHabit && parsed.recurrenceRule !== 'none') {
      await createHabit(user.uid, {
        title: parsed.cleanTitle,
        businessId: fallbackBiz.id,
        scheduledTime: parsed.scheduledTime,
        recurrenceRule: parsed.recurrenceRule,
      });
      return;
    }

    await createTask(user.uid, {
      title: parsed.cleanTitle,
      businessId: fallbackBiz.id,
      projectId: parsed.project?.id || '',
      phaseHeading: parsed.project?.phaseHeadings[0] || '',
      scheduledDate: parsed.scheduledDate,
      scheduledTime: parsed.scheduledTime,
      hardDeadline: '',
      priority: parsed.priority,
      isMilestone: parsed.isMilestone,
      blockedByTaskId: '',
      isHabit: false,
      recurrenceRule: 'none',
      attachmentIds: [],
    });
  };

  const handleToggleDone = async (task: Task) => {
    const nextStatus = task.status === 'done' ? 'pending' : 'done';
    await updateTaskStatus(user.uid, task, nextStatus);
  };

  const handleReschedule = async (task: Task, newDate: string, newTime: string) => {
    await rescheduleTask(user.uid, task.id, newDate, newTime);
    if (newDate > task.scheduledDate || task.scheduledDate < getTodayKey()) {
      void triggerRealityCheckInternal(task, 'rescheduled');
    }
  };

  const handleMarkMissed = async (task: Task) => {
    await updateTaskStatus(user.uid, task, 'missed');
    void triggerRealityCheckInternal(task, 'missed');
  };

  const handleRequestDeleteTask = (task: Task) => {
    setPendingConfirm({
      title: 'Delete Task',
      description: `Permanently delete "${task.title}"? This action cannot be undone.`,
      confirmLabel: 'Delete Task',
      onConfirm: async () => {
        await deleteTask(user.uid, task.id);
      },
    });
  };

  const handleRequestDeleteBusiness = (biz: Business) => {
    const childProjects = projects.filter((p) => p.businessId === biz.id).length;
    const childTasks = tasks.filter((t) => t.businessId === biz.id).length;
    const childHabits = habits.filter((h) => h.businessId === biz.id).length;

    setPendingConfirm({
      title: `Delete "${biz.name}"`,
      description: `Deleting this venture will permanently remove ${childProjects} project(s), ${childTasks} task(s), and ${childHabits} habit(s) belonging to ${biz.name}. This cannot be undone.`,
      confirmLabel: 'Delete Venture',
      onConfirm: async () => {
        await deleteBusinessCascade(user.uid, biz.id);
      },
    });
  };

  const handleRequestDeleteProject = (proj: Project) => {
    const childTasks = tasks.filter((t) => t.projectId === proj.id).length;
    setPendingConfirm({
      title: `Delete "${proj.name}"`,
      description:
        childTasks > 0
          ? `This project currently has ${childTasks} task(s). Choose what should happen to them when the project is deleted:`
          : `Permanently delete project "${proj.name}"? This cannot be undone.`,
      confirmLabel: 'Delete Project',
      options:
        childTasks > 0
          ? [
              {
                value: 'unlink',
                label: 'Keep tasks as unassigned under the Business',
                description: 'Tasks stay intact and remain visible in Today and Calendar.',
              },
              {
                value: 'delete-tasks',
                label: `Also delete all ${childTasks} task(s) inside this project`,
                description: 'Removes the project and every task linked to it permanently.',
              },
            ]
          : undefined,
      defaultOption: 'unlink',
      onConfirm: async (selected) => {
        const mode = selected === 'delete-tasks' ? 'delete-tasks' : 'unlink';
        await deleteProjectCascade(user.uid, proj.id, mode);
      },
    });
  };

  const closeOptions = (openCount: number): ConfirmOption[] | undefined =>
    openCount > 0
      ? [
          {
            value: 'complete',
            label: `Mark the ${openCount} open task(s) as done`,
            description: 'Use this when the work is actually finished.',
          },
          {
            value: 'leave',
            label: 'Leave open tasks as they are',
            description: 'Closes it without changing any task status.',
          },
        ]
      : undefined;

  const handleRequestCloseProject = (proj: Project) => {
    const open = tasks.filter((t) => t.projectId === proj.id && t.status !== 'done').length;
    setPendingConfirm({
      title: `Close "${proj.name}" as finished`,
      description:
        open > 0
          ? `This project still has ${open} open task(s). It will move to Archived and show as Completed once every task is done.`
          : 'All tasks are done. The project will move to Archived and show as Completed.',
      confirmLabel: 'Close Project',
      tone: 'neutral',
      options: closeOptions(open),
      defaultOption: 'complete',
      onConfirm: async (opt) => {
        await closeProject(user.uid, proj, tasks, opt !== 'leave');
      },
    });
  };

  const handleRequestCloseBusiness = (biz: Business) => {
    const open = tasks.filter((t) => t.businessId === biz.id && !t.isHabit && t.status !== 'done').length;
    setPendingConfirm({
      title: `Close "${biz.name}" as finished`,
      description:
        open > 0
          ? `${biz.name} still has ${open} open task(s). The venture and all its projects will move to Archived.`
          : `The venture and all its projects will move to Archived and show as Completed.`,
      confirmLabel: 'Close Venture',
      tone: 'neutral',
      options: closeOptions(open),
      defaultOption: 'complete',
      onConfirm: async (opt) => {
        await closeBusiness(user.uid, biz, projects, tasks, opt !== 'leave');
      },
    });
  };

  const handleVentureBulkAction = (action: VentureBulkAction, sel: VentureSelection) => {
    const parts = [
      sel.businessIds.length ? `${sel.businessIds.length} venture(s)` : '',
      sel.projectIds.length ? `${sel.projectIds.length} project(s)` : '',
      sel.taskIds.length ? `${sel.taskIds.length} task(s)` : '',
    ].filter(Boolean);
    const summary = parts.join(', ');
    const selBizProjects = projects.filter((p) => sel.businessIds.includes(p.businessId));

    if (action === 'delete') {
      const projTaskCount = tasks.filter((t) => sel.projectIds.includes(t.projectId)).length;
      setPendingConfirm({
        title: `Delete ${summary}`,
        description: `Permanently delete ${summary}? Deleting a venture also deletes all its projects, tasks and habits. This cannot be undone.`,
        confirmLabel: 'Delete All',
        options:
          sel.projectIds.length && projTaskCount
            ? [
                {
                  value: 'delete-tasks',
                  label: `Also delete the ${projTaskCount} task(s) inside the selected projects`,
                  description: 'Removes projects and every task in them.',
                },
                {
                  value: 'unlink',
                  label: 'Keep those tasks as unassigned',
                  description: 'Tasks stay under their venture without a project.',
                },
              ]
            : undefined,
        defaultOption: 'delete-tasks',
        onConfirm: async (opt) => {
          await bulkDelete(user.uid, sel, projects, tasks, opt === 'unlink' ? 'unlink' : 'delete-tasks');
        },
      });
      return;
    }

    if (action === 'archive') {
      if (!sel.businessIds.length && !sel.projectIds.length) {
        setPendingConfirm({
          title: 'Nothing to archive',
          description: 'Only ventures and projects can be archived. Use Close or Delete for tasks.',
          confirmLabel: 'OK',
          tone: 'neutral',
          onConfirm: async () => undefined,
        });
        return;
      }
      setPendingConfirm({
        title: `Archive ${summary}`,
        description: 'Selected ventures and projects move to Archived (tasks are not changed). You can restore them anytime from Show Archived.',
        confirmLabel: 'Archive',
        tone: 'neutral',
        onConfirm: async () => {
          for (const id of sel.businessIds) await toggleBusinessActive(user.uid, id, false);
          for (const id of sel.projectIds) await toggleProjectArchived(user.uid, id, true);
        },
      });
      return;
    }

    // close
    const affected = tasks.filter(
      (t) =>
        t.status !== 'done' &&
        !t.isHabit &&
        (sel.taskIds.includes(t.id) ||
          sel.projectIds.includes(t.projectId) ||
          sel.businessIds.includes(t.businessId))
    );
    setPendingConfirm({
      title: `Close ${summary} as finished`,
      description: `Selected tasks are marked done${
        sel.businessIds.length || sel.projectIds.length ? ' and selected ventures/projects move to Archived as Completed' : ''
      }.`,
      confirmLabel: 'Close',
      tone: 'neutral',
      options:
        (sel.businessIds.length || sel.projectIds.length) && affected.length
          ? closeOptions(affected.length)
          : undefined,
      defaultOption: 'complete',
      onConfirm: async (opt) => {
        const completeRemaining = opt !== 'leave';
        const taskList = completeRemaining
          ? affected
          : affected.filter((t) => sel.taskIds.includes(t.id));
        await completeTasks(user.uid, taskList);
        for (const p of [...new Set([...sel.projectIds, ...selBizProjects.map((x) => x.id)])]) {
          const proj = projects.find((x) => x.id === p);
          if (proj && !proj.isArchived) await toggleProjectArchived(user.uid, p, true);
        }
        for (const id of sel.businessIds) {
          const biz = businesses.find((b) => b.id === id);
          if (biz?.isActive) await toggleBusinessActive(user.uid, id, false);
        }
      },
    });
  };

  const handleRequestDeleteFile = (file: TaskFile) => {
    const refCount = tasks.filter((t) => t.attachmentIds?.includes(file.id)).length;
    setPendingConfirm({
      title: 'Delete File from Library',
      description:
        refCount > 0
          ? `Delete "${file.name}"? It will also be detached from ${refCount} task(s).`
          : `Permanently remove "${file.name}" from your file library?`,
      confirmLabel: 'Delete File',
      onConfirm: async () => {
        await deleteTaskFile(user.uid, file.id);
      },
    });
  };

  const handleRequestDeleteHabit = (habit: Habit) => {
    setPendingConfirm({
      title: 'Delete Habit',
      description: `Permanently delete "${habit.title}" and its ${habit.streakCount}-day streak history? This action cannot be undone.`,
      confirmLabel: 'Delete Habit',
      onConfirm: async () => {
        await deleteHabit(user.uid, habit.id);
      },
    });
  };

  const handleRequestClearWorkspace = () => {
    setPendingConfirm({
      title: 'Clear All Tasks & Projects',
      description:
        'This permanently deletes all projects, tasks, habits, and Reality Check logs while keeping your configured Ventures and profile intact.',
      confirmLabel: 'Clear Workspace Data',
      onConfirm: async () => {
        await clearWorkspaceItems(user.uid);
      },
    });
  };

  const handleJumpToProject = (project: Project) => {
    setActiveTab('ventures');
    setFocusedProject({
      businessId: project.businessId,
      projectId: project.id,
      nonce: Date.now(),
    });
  };

  const handleTestAlert = (kind: 'briefing' | 'stall' | 'audit') => {
    const today = getTodayKey();
    const nowHHmm = getCurrentHHmm();
    if (kind === 'briefing') {
      const top3 = tasks
        .filter((t) => t.status === 'pending' && !blockedTaskIds.has(t.id) && t.scheduledDate <= today)
        .sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
        .slice(0, 3)
        .map((t, i) => `${i + 1}. ${t.title}`)
        .join(' · ');
      setExecutiveAlert({
        id: `test_briefing_${Date.now()}`,
        kind: 'briefing',
        title: '08:00 Morning Briefing — Top 3 Priorities',
        body: top3 || 'No pending actions queued. Add your top 3 revenue levers now.',
        timestamp: nowHHmm,
      });
    } else if (kind === 'stall') {
      setExecutiveAlert({
        id: `test_stall_${Date.now()}`,
        kind: 'stall',
        title: '14:00 Mid-Day Stall Alert',
        body: `Execution sits at ${todayStats.percent}% (${todayStats.completed}/${todayStats.total}). Protect your afternoon block and ship a high-priority task now.`,
        timestamp: nowHHmm,
      });
    } else {
      const remaining = Math.max(0, todayStats.total - todayStats.completed);
      setExecutiveAlert({
        id: `test_audit_${Date.now()}`,
        kind: 'audit',
        title: '21:30 Night Execution Audit',
        body: `Completed ${todayStats.completed} of ${todayStats.total} tasks (${todayStats.percent}%). ${remaining} remaining will roll over to tomorrow morning.`,
        timestamp: nowHHmm,
      });
    }
    void showNotificationNow('EmpireOS test alert', 'Notifications are working on this device.');
    setNotifModalOpen(false);
  };

  const todayFormatted = formatReadableDate(getTodayKey());
  const effectiveDisplayName = profile?.displayName || user.displayName || 'Founder';
  const effectiveAvatar = avatarUrl || user.photoURL || null;
  const userInitial = (effectiveDisplayName || user.email || 'E').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Persistent Sidebar Rail */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col justify-between bg-white border-r border-slate-200 p-5 sticky top-0 h-screen">
        <div className="space-y-6 overflow-y-auto pr-0.5">
          <div className="px-2 pt-1">
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              EmpireOS
            </span>
          </div>

          <nav className="space-y-1" aria-label="Primary navigation">
            {SIDEBAR_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full min-h-[42px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Compact Portfolio Overview in Sidebar */}
          <div className="px-2 space-y-2 pt-3 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-400">Active Ventures</div>
            <div className="space-y-1">
              {businesses
                .filter((b) => b.isActive)
                .map((biz) => {
                  const openCount = tasks.filter(
                    (t) => t.businessId === biz.id && t.status === 'pending'
                  ).length;
                  return (
                    <button
                      key={biz.id}
                      type="button"
                      onClick={() => setActiveTab('ventures')}
                      className="w-full py-1.5 px-2 rounded-lg hover:bg-slate-100 flex items-center justify-between gap-2 text-xs text-slate-700 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: biz.colorHex }}
                        />
                        <span className="truncate font-medium">{biz.name}</span>
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-400">
                        {openCount}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Bottom Primary Quick Action + Profile */}
        <div className="space-y-3 pt-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingTask(null);
              setTaskDefaults({ scheduledDate: getTodayKey() });
              setTaskModalOpen(true);
            }}
            className="w-full min-h-[42px] px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>

          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition-opacity cursor-pointer"
            >
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt={effectiveDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center shrink-0">
                  {userInitial}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {effectiveDisplayName}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {profile?.username ? `@${profile.username}` : user.email}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              aria-label="Sign out"
              title="Sign out"
              className="min-w-[36px] min-h-[36px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Executive Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Sticky Top Header with Global Search */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <span className="lg:hidden font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              EmpireOS
            </span>
            <span className="hidden lg:inline text-sm font-medium text-slate-600 whitespace-nowrap">
              {todayFormatted}
            </span>
          </div>

          {/* Global Search across Tasks, Projects, Businesses & Phases */}
          <GlobalSearchBar
            businesses={businesses}
            projects={projects}
            tasks={tasks}
            onSelectProject={handleJumpToProject}
            onEditTask={(task) => {
              setEditingTask(task);
              setTaskModalOpen(true);
            }}
            onLockInTask={(task) => setLockInTask(task)}
          />

          <div className="flex items-center gap-1.5 shrink-0">
            {isOffline && (
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium items-center gap-1.5 mr-1">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
            <PWAInstallButton compact onOpenReleasePage={onOpenInstallPage} />
            <button
              type="button"
              onClick={() => setNotifModalOpen(true)}
              aria-label="Notification schedule & alerts"
              title="Executive Alerts & Cadence"
              className="min-w-[38px] min-h-[38px] rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              aria-label="Profile & Settings"
              title="Profile & Settings"
              className={`min-w-[38px] min-h-[38px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'ring-2 ring-slate-900 ring-offset-1 bg-slate-100'
                  : 'hover:bg-slate-100'
              }`}
            >
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt={effectiveDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
                  {userInitial}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Executive Alert Banner */}
        {executiveAlert && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-semibold text-amber-800">{executiveAlert.title}</div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                {executiveAlert.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExecutiveAlert(null)}
              aria-label="Dismiss alert"
              className="min-w-[32px] min-h-[32px] rounded-lg text-amber-700 hover:text-slate-900 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Tab Viewport */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-mobile-nav lg:pb-10">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 text-slate-900 animate-spin" />
              <span className="text-sm">Syncing your EmpireOS workspace…</span>
            </div>
          ) : activeTab === 'dashboard' ? (
            <DashboardTab
              businesses={businesses}
              projects={projects}
              tasks={tasks}
              filesMap={filesMap}
              blockedTaskIds={blockedTaskIds}
              onToggleDone={handleToggleDone}
              onLockIn={(task) => setLockInTask(task)}
              onEditTask={(task) => {
                setEditingTask(task);
                setTaskModalOpen(true);
              }}
              onRealityCheck={(task, reason) => void triggerRealityCheckInternal(task, reason)}
              onOpenNewTaskModal={() => {
                setEditingTask(null);
                setTaskDefaults({ scheduledDate: getTodayKey() });
                setTaskModalOpen(true);
              }}
              onOpenProject={handleJumpToProject}
              onPreviewFile={(file) => setPreviewFile(file)}
            />
          ) : activeTab === 'today' ? (
            <TodayTab
              businesses={businesses}
              projects={projects}
              tasks={tasks}
              filesMap={filesMap}
              blockedTaskIds={blockedTaskIds}
              todayStats={todayStats}
              onCreateFromParsed={handleCreateFromParsed}
              onOpenNewTaskModal={(initialTitle) => {
                setEditingTask(null);
                setTaskDefaults({ title: initialTitle || '', scheduledDate: getTodayKey() });
                setTaskModalOpen(true);
              }}
              onToggleDone={handleToggleDone}
              onLockIn={(task) => setLockInTask(task)}
              onRealityCheck={(task, reason) => void triggerRealityCheckInternal(task, reason)}
              onReschedule={handleReschedule}
              onMarkMissed={handleMarkMissed}
              onEditTask={(task) => {
                setEditingTask(task);
                setTaskModalOpen(true);
              }}
              onDeleteTask={handleRequestDeleteTask}
              onPreviewFile={(file) => setPreviewFile(file)}
            />
          ) : activeTab === 'calendar' ? (
            <CalendarTab
              businesses={businesses}
              projects={projects}
              tasks={tasks}
              filesMap={filesMap}
              blockedTaskIds={blockedTaskIds}
              onCreateFromParsed={handleCreateFromParsed}
              onToggleDone={handleToggleDone}
              onLockIn={(task) => setLockInTask(task)}
              onRealityCheck={(task, reason) => void triggerRealityCheckInternal(task, reason)}
              onReschedule={handleReschedule}
              onMarkMissed={handleMarkMissed}
              onEditTask={(task) => {
                setEditingTask(task);
                setTaskModalOpen(true);
              }}
              onDeleteTask={handleRequestDeleteTask}
              onPreviewFile={(file) => setPreviewFile(file)}
            />
          ) : activeTab === 'ventures' ? (
            <VenturesTab
              businesses={businesses}
              projects={projects}
              tasks={tasks}
              filesMap={filesMap}
              blockedTaskIds={blockedTaskIds}
              focusedProject={focusedProject}
              onAddBusiness={() => {
                setEditingBiz(null);
                setBizModalOpen(true);
              }}
              onEditBusiness={(biz) => {
                setEditingBiz(biz);
                setBizModalOpen(true);
              }}
              onToggleBusinessActive={(biz) =>
                void toggleBusinessActive(user.uid, biz.id, !biz.isActive)
              }
              onDeleteBusiness={handleRequestDeleteBusiness}
              onAddProject={(bizId) => {
                setEditingProj(null);
                setDefaultProjBizId(bizId);
                setProjModalOpen(true);
              }}
              onEditProject={(proj) => {
                setEditingProj(proj);
                setDefaultProjBizId(proj.businessId);
                setProjModalOpen(true);
              }}
              onToggleProjectArchive={(proj) =>
                void toggleProjectArchived(user.uid, proj.id, !proj.isArchived)
              }
              onDeleteProject={handleRequestDeleteProject}
              onCloseProject={handleRequestCloseProject}
              onCloseBusiness={handleRequestCloseBusiness}
              onBulkAction={handleVentureBulkAction}
              onAddTaskInProject={(bizId, projId, phaseHeading) => {
                setEditingTask(null);
                setTaskDefaults({
                  businessId: bizId,
                  projectId: projId,
                  phaseHeading,
                  scheduledDate: getTodayKey(),
                });
                setTaskModalOpen(true);
              }}
              onToggleDone={handleToggleDone}
              onLockIn={(task) => setLockInTask(task)}
              onRealityCheck={(task, reason) => void triggerRealityCheckInternal(task, reason)}
              onReschedule={handleReschedule}
              onMarkMissed={handleMarkMissed}
              onEditTask={(task) => {
                setEditingTask(task);
                setTaskModalOpen(true);
              }}
              onDeleteTask={handleRequestDeleteTask}
              onPreviewFile={(file) => setPreviewFile(file)}
            />
          ) : activeTab === 'habits' ? (
            <HabitsCoachTab
              businesses={businesses}
              habits={habits}
              tasks={tasks}
              coachLogs={coachLogs}
              aiProvider={profile?.aiProvider || 'gemini'}
              onToggleHabitToday={(habit, dateKey) =>
                void toggleHabitDate(user.uid, habit, dateKey)
              }
              onAddHabit={() => {
                setEditingHabit(null);
                setHabitModalOpen(true);
              }}
              onEditHabit={(habit) => {
                setEditingHabit(habit);
                setHabitModalOpen(true);
              }}
              onDeleteHabit={handleRequestDeleteHabit}
              onTriggerRealityCheckForTask={(task) =>
                void triggerRealityCheckInternal(task, 'manual')
              }
              onDeleteCoachLog={(logId) => void deleteCoachLog(user.uid, logId)}
            />
          ) : (
            <SettingsTab
              user={user}
              profile={profile}
              avatarUrl={avatarUrl}
              businesses={businesses}
              projects={projects}
              tasks={tasks}
              habits={habits}
              coachLogs={coachLogs}
              files={files}
              onSaveProfile={async (data) => {
                await updateUserProfileSettings(user.uid, data);
              }}
              onAvatarUpdated={() => setAvatarRefreshKey((k) => k + 1)}
              onUploadFile={(file) => uploadTaskFile(user.uid, file)}
              onDeleteFile={handleRequestDeleteFile}
              onPreviewFile={(file) => setPreviewFile(file)}
              onOpenNotifications={() => setNotifModalOpen(true)}
              onRequestClearWorkspace={handleRequestClearWorkspace}
              onOpenInstallPage={onOpenInstallPage}
            />
          )}
        </main>
      </div>

      {/* Floating "+" Action Button (Mobile / Tablet) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic(12);
          setEditingTask(null);
          setTaskDefaults({ scheduledDate: getTodayKey() });
          setTaskModalOpen(true);
        }}
        aria-label="Quick add new task"
        className="lg:hidden fixed right-4 fab-above-nav z-50 w-13 h-13 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Mobile 5-Tab Fixed Bottom Navigation */}
      <nav
        aria-label="Bottom tab navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {MOBILE_BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setActiveTab(tab.id);
                }}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium tracking-tight leading-none">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <RealityCheckModal
        open={rcOpen}
        loading={rcLoading}
        error={rcError}
        task={rcTask}
        businessName={rcTask ? bizMap.get(rcTask.businessId)?.name || 'Empire Portfolio' : ''}
        completionPercent={todayStats.percent}
        triggerReason={rcReason}
        payload={rcPayload}
        aiProvider={profile?.aiProvider || 'gemini'}
        onClose={() => setRcOpen(false)}
        onLockInTask={(task) => setLockInTask(task)}
        onRetry={() => {
          if (rcTask) void triggerRealityCheckInternal(rcTask, rcReason);
        }}
      />

      <LockInModal
        task={lockInTask}
        business={lockInTask ? bizMap.get(lockInTask.businessId) : undefined}
        project={lockInTask ? projMap.get(lockInTask.projectId) : undefined}
        onClose={() => setLockInTask(null)}
        onCompleteTask={handleToggleDone}
        onRealityCheck={(task) => void triggerRealityCheckInternal(task, 'manual')}
      />

      <BusinessModal
        open={bizModalOpen}
        editing={editingBiz}
        nextSortOrder={businesses.length}
        onClose={() => setBizModalOpen(false)}
        onSave={async (data) => {
          if (editingBiz) {
            await updateBusiness(user.uid, editingBiz.id, data);
          } else {
            await createBusiness(user.uid, data);
          }
        }}
      />

      <ProjectModal
        open={projModalOpen}
        businesses={businesses}
        defaultBusinessId={defaultProjBizId}
        editing={editingProj}
        onClose={() => setProjModalOpen(false)}
        onSave={async (data) => {
          if (editingProj) {
            await updateProject(user.uid, editingProj.id, {
              name: data.name,
              phaseHeadings: data.phaseHeadings,
              targetDate: data.targetDate,
            });
          } else {
            await createProject(user.uid, data);
          }
        }}
      />

      <TaskModal
        open={taskModalOpen}
        businesses={businesses}
        projects={projects}
        allTasks={tasks}
        libraryFiles={files}
        editing={editingTask}
        defaults={taskDefaults}
        onClose={() => setTaskModalOpen(false)}
        onSave={async (data) => {
          if (editingTask) {
            await updateTaskDetails(user.uid, editingTask.id, data);
          } else {
            await createTask(user.uid, data);
          }
        }}
        onUploadFile={(file) => uploadTaskFile(user.uid, file)}
        onPreviewFile={(file) => setPreviewFile(file)}
      />

      <HabitModal
        open={habitModalOpen}
        businesses={businesses}
        editing={editingHabit}
        onClose={() => setHabitModalOpen(false)}
        onSave={async (data) => {
          if (editingHabit) {
            await updateHabit(user.uid, editingHabit.id, data);
          } else {
            await createHabit(user.uid, data);
          }
        }}
      />

      <NotificationsModal
        open={notifModalOpen}
        profile={profile}
        onClose={() => setNotifModalOpen(false)}
        onSavePrefs={async (prefs) => {
          await updateNotificationPrefs(user.uid, {
            displayName: profile?.displayName || user.displayName || 'Founder',
            ...prefs,
          });
        }}
        onTestAlert={handleTestAlert}
      />

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        confirmLabel={pendingConfirm?.confirmLabel || 'Delete'}
        tone={pendingConfirm?.tone || 'danger'}
        options={pendingConfirm?.options}
        defaultOption={pendingConfirm?.defaultOption}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async (opt) => {
          if (pendingConfirm) {
            await pendingConfirm.onConfirm(opt);
          }
        }}
      />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [verifyTick, setVerifyTick] = useState(0);
  const [preferredTab, setPreferredTab] = useState<TabId>('dashboard');
  const [authAction, setAuthAction] = useState(() => getAuthActionParams());
  const [showInstallPage, setShowInstallPage] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isInstallPath(window.location.pathname);
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [verifyTick]);

  useEffect(() => {
    const onPopState = () => {
      setShowInstallPage(isInstallPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openInstallPage = () => {
    if (typeof window !== 'undefined' && !isInstallPath(window.location.pathname)) {
      window.history.pushState({}, '', appPath('install'));
    }
    setShowInstallPage(true);
  };

  const closeInstallPage = (targetTab?: TabId) => {
    if (targetTab) setPreferredTab(targetTab);
    if (typeof window !== 'undefined' && window.location.pathname !== appPath()) {
      window.history.pushState({}, '', appPath());
    }
    setShowInstallPage(false);
  };

  const isSignedInVerified = Boolean(user && user.emailVerified);

  return (
    <ErrorBoundary>
      {authAction ? (
        <AuthActionPage
          mode={authAction.mode}
          oobCode={authAction.oobCode}
          onDone={() => {
            setAuthAction(null);
            setVerifyTick((t) => t + 1);
          }}
        />
      ) : showInstallPage ? (
        <InstallReleasePage
          isSignedIn={isSignedInVerified}
          onBackToApp={() => closeInstallPage()}
          onOpenSettingsRelease={
            isSignedInVerified ? () => closeInstallPage('settings') : undefined
          }
        />
      ) : !authReady ? (
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-slate-900 animate-spin" />
        </div>
      ) : !user ? (
        <AuthScreen onOpenInstallPage={openInstallPage} />
      ) : !user.emailVerified ? (
        <AuthScreen
          unverifiedUser={user}
          onVerificationRefreshed={() => setVerifyTick((t) => t + 1)}
          onOpenInstallPage={openInstallPage}
        />
      ) : (
        <EmpireWorkspace
          key={preferredTab}
          user={user}
          initialTab={preferredTab}
          onOpenInstallPage={openInstallPage}
        />
      )}
    </ErrorBoundary>
  );
}
