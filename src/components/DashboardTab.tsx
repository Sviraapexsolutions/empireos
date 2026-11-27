import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Diamond,
  FileText,
  Flame,
  Image as ImageIcon,
  Pencil,
  Plus,
  ShieldAlert,
  Target,
  CalendarRange,
} from 'lucide-react';
import { VentureHealthSection } from './VentureHealthSection';
import type { Business, Project, Task, TaskFile, TriggerReason } from '../types/empire';
import {
  formatReadableDate,
  formatShortDate,
  formatTime12h,
  getCurrentHHmm,
  getTodayKey,
  isTimePassedToday,
  triggerHaptic,
} from '../utils/dateUtils';
import { BusinessIcon } from './BusinessIcon';

interface DashboardTabProps {
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  filesMap: Map<string, TaskFile>;
  blockedTaskIds: Set<string>;
  onToggleDone: (task: Task) => void;
  onLockIn: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onRealityCheck: (task: Task, reason: TriggerReason) => void;
  onOpenNewTaskModal: () => void;
  onOpenProject: (project: Project) => void;
  onPreviewFile: (file: TaskFile) => void;
  onOpenWeeklyReview: () => void;
  onOpenVenture: (businessId: string) => void;
}

type SortKey = 'remaining' | 'completion' | 'name';

interface ProjectKpiRow {
  id: string;
  project: Project | null;
  business: Business | undefined;
  title: string;
  targetDate: string;
  total: number;
  done: number;
  notDone: number;
  overdue: number;
  milestonesDone: number;
  milestonesTotal: number;
  percent: number;
  doneTasks: Task[];
  notDoneTasks: Task[];
}

function getRelativeScheduleHint(dateKey: string, timeHHmm: string, todayKey: string): string {
  if (dateKey < todayKey) return `Rolled over from ${formatShortDate(dateKey)}`;
  if (dateKey === todayKey) {
    if (!timeHHmm) return 'Scheduled today';
    const nowHHmm = getCurrentHHmm();
    const [nh, nm] = nowHHmm.split(':').map(Number);
    const [th, tm] = timeHHmm.split(':').map(Number);
    const diff = th * 60 + tm - (nh * 60 + nm);
    if (diff < 0) return `Past due by ${Math.abs(diff)}m`;
    if (diff === 0) return 'Starting right now';
    if (diff < 60) return `In ${diff}m`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `In ${hrs}h ${mins}m` : `In ${hrs}h`;
  }
  const todayDate = new Date(`${todayKey}T00:00:00`);
  const targetDate = new Date(`${dateKey}T00:00:00`);
  const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / 86_400_000);
  if (diffDays === 1) return timeHHmm ? `Tomorrow · ${formatTime12h(timeHHmm)}` : 'Tomorrow';
  return timeHHmm
    ? `${formatShortDate(dateKey)} · ${formatTime12h(timeHHmm)}`
    : formatReadableDate(dateKey);
}

export function DashboardTab({
  businesses,
  projects,
  tasks,
  filesMap,
  blockedTaskIds,
  onToggleDone,
  onLockIn,
  onEditTask,
  onRealityCheck,
  onOpenNewTaskModal,
  onOpenProject,
  onPreviewFile,
  onOpenWeeklyReview,
  onOpenVenture,
}: DashboardTabProps) {
  const [selectedBizFilter, setSelectedBizFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('remaining');
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  const todayKey = getTodayKey();
  const nowHHmm = getCurrentHHmm();
  const bizMap = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // 1. Determine the single "Current Task at Hand" and the single "Next Upcoming Scheduled Task"
  const { currentTask, nextUpcomingTask } = useMemo(() => {
    const actionable = tasks.filter(
      (t) => t.status === 'pending' && !blockedTaskIds.has(t.id)
    );

    if (actionable.length === 0) {
      return { currentTask: null, nextUpcomingTask: null };
    }

    // Score tasks for "Current Task at Hand":
    // Priority: 1) Due right now / overdue today, 2) Rolled over from earlier days,
    // 3) Today's tasks (high priority & earliest time first), 4) Earliest upcoming task if today is clear.
    const todayAndRolled = actionable.filter((t) => t.scheduledDate <= todayKey);
    const currentPool = todayAndRolled.length > 0 ? todayAndRolled : actionable;

    const sortedForCurrent = [...currentPool].sort((a, b) => {
      const aOverdueToday = a.scheduledDate === todayKey && Boolean(a.scheduledTime) && a.scheduledTime <= nowHHmm;
      const bOverdueToday = b.scheduledDate === todayKey && Boolean(b.scheduledTime) && b.scheduledTime <= nowHHmm;
      if (aOverdueToday !== bOverdueToday) return aOverdueToday ? -1 : 1;

      const aRolled = a.scheduledDate < todayKey;
      const bRolled = b.scheduledDate < todayKey;
      if (aRolled !== bRolled) return aRolled ? -1 : 1;

      if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate.localeCompare(b.scheduledDate);

      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      if (a.isMilestone !== b.isMilestone) return a.isMilestone ? -1 : 1;

      const aTime = a.scheduledTime || '23:59';
      const bTime = b.scheduledTime || '23:59';
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return a.title.localeCompare(b.title);
    });

    const current = sortedForCurrent[0] || null;

    // Next Upcoming Scheduled Task: strictly the single next chronological scheduled task after current
    const upcomingPool = actionable.filter((t) => {
      if (current && t.id === current.id) return false;
      // Prefer tasks scheduled at/after now today, or future dates
      if (t.scheduledDate > todayKey) return true;
      if (t.scheduledDate === todayKey) {
        if (!t.scheduledTime) return true;
        return t.scheduledTime >= nowHHmm;
      }
      return false;
    });

    const fallbackPool = upcomingPool.length > 0
      ? upcomingPool
      : actionable.filter((t) => !current || t.id !== current.id);

    const sortedUpcoming = [...fallbackPool].sort((a, b) => {
      if (a.scheduledDate !== b.scheduledDate) {
        return a.scheduledDate.localeCompare(b.scheduledDate);
      }
      const aTime = a.scheduledTime || '23:59';
      const bTime = b.scheduledTime || '23:59';
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return {
      currentTask: current,
      nextUpcomingTask: sortedUpcoming[0] || null,
    };
  }, [tasks, blockedTaskIds, todayKey, nowHHmm]);

  // 2. Portfolio-wide KPI totals
  const portfolioStats = useMemo(() => {
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'done').length;
    const notDoneTasks = totalTasks - doneTasks;
    const overdueTasks = tasks.filter(
      (t) =>
        t.status === 'pending' &&
        (t.scheduledDate < todayKey || isTimePassedToday(t.scheduledDate, t.scheduledTime))
    ).length;
    const completionPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
    const activeProjects = projects.filter((p) => !p.isArchived);
    const milestones = tasks.filter((t) => t.isMilestone);
    const milestonesDone = milestones.filter((t) => t.status === 'done').length;
    return {
      totalTasks,
      doneTasks,
      notDoneTasks,
      overdueTasks,
      completionPct,
      activeProjectsCount: activeProjects.length,
      milestonesDone,
      milestonesTotal: milestones.length,
    };
  }, [tasks, projects, todayKey]);

  // 3. Project-wise KPI rows (including standalone unassigned tasks grouped by business so nothing hides)
  const projectKpiRows = useMemo(() => {
    const rows: ProjectKpiRow[] = [];

    for (const proj of projects) {
      if (proj.isArchived) continue;
      if (selectedBizFilter !== 'all' && proj.businessId !== selectedBizFilter) continue;

      const projTasks = tasks.filter((t) => t.projectId === proj.id);
      const doneList = projTasks.filter((t) => t.status === 'done');
      const notDoneList = projTasks.filter((t) => t.status !== 'done');
      const overdueCount = notDoneList.filter(
        (t) => t.scheduledDate < todayKey || isTimePassedToday(t.scheduledDate, t.scheduledTime)
      ).length;
      const milestones = projTasks.filter((t) => t.isMilestone);

      rows.push({
        id: proj.id,
        project: proj,
        business: bizMap.get(proj.businessId),
        title: proj.name,
        targetDate: proj.targetDate,
        total: projTasks.length,
        done: doneList.length,
        notDone: notDoneList.length,
        overdue: overdueCount,
        milestonesDone: milestones.filter((m) => m.status === 'done').length,
        milestonesTotal: milestones.length,
        percent: projTasks.length === 0 ? 0 : Math.round((doneList.length / projTasks.length) * 100),
        doneTasks: doneList,
        notDoneTasks: notDoneList,
      });
    }

    // Add standalone business tasks (no project assigned) so KPIs cover 100% of execution
    for (const biz of businesses) {
      if (!biz.isActive) continue;
      if (selectedBizFilter !== 'all' && biz.id !== selectedBizFilter) continue;
      const standalone = tasks.filter((t) => t.businessId === biz.id && !t.projectId);
      if (standalone.length === 0) continue;

      const doneList = standalone.filter((t) => t.status === 'done');
      const notDoneList = standalone.filter((t) => t.status !== 'done');
      const overdueCount = notDoneList.filter(
        (t) => t.scheduledDate < todayKey || isTimePassedToday(t.scheduledDate, t.scheduledTime)
      ).length;
      const milestones = standalone.filter((t) => t.isMilestone);

      rows.push({
        id: `standalone_${biz.id}`,
        project: null,
        business: biz,
        title: `${biz.name} — Direct Actions`,
        targetDate: '',
        total: standalone.length,
        done: doneList.length,
        notDone: notDoneList.length,
        overdue: overdueCount,
        milestonesDone: milestones.filter((m) => m.status === 'done').length,
        milestonesTotal: milestones.length,
        percent: Math.round((doneList.length / standalone.length) * 100),
        doneTasks: doneList,
        notDoneTasks: notDoneList,
      });
    }

    return rows.sort((a, b) => {
      if (sortKey === 'remaining') {
        if (b.notDone !== a.notDone) return b.notDone - a.notDone;
        return a.percent - b.percent;
      }
      if (sortKey === 'completion') {
        if (b.percent !== a.percent) return b.percent - a.percent;
        return b.total - a.total;
      }
      return a.title.localeCompare(b.title);
    });
  }, [projects, businesses, tasks, bizMap, selectedBizFilter, sortKey, todayKey]);

  const toggleRow = (id: string) => {
    setExpandedRowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderAttachmentChips = (task: Task) => {
    if (!task.attachmentIds || task.attachmentIds.length === 0) return null;
    const attached = task.attachmentIds
      .map((id) => filesMap.get(id))
      .filter((f): f is TaskFile => Boolean(f));
    if (attached.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {attached.map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => onPreviewFile(file)}
            className="inline-flex items-center gap-1.5 max-w-[190px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer"
          >
            {file.kind === 'pdf' ? (
              <FileText className="w-3 h-3 text-red-600 shrink-0" />
            ) : (
              <ImageIcon className="w-3 h-3 text-blue-600 shrink-0" />
            )}
            <span className="truncate">{file.name}</span>
          </button>
        ))}
      </div>
    );
  };

  const currentBiz = currentTask ? bizMap.get(currentTask.businessId) : undefined;
  const currentProj = currentTask?.projectId ? projMap.get(currentTask.projectId) : undefined;
  const currentIsRolledOver = Boolean(currentTask && currentTask.scheduledDate < todayKey);
  const currentIsOverdue = Boolean(
    currentTask && isTimePassedToday(currentTask.scheduledDate, currentTask.scheduledTime)
  );

  const upcomingBiz = nextUpcomingTask ? bizMap.get(nextUpcomingTask.businessId) : undefined;
  const upcomingProj = nextUpcomingTask?.projectId
    ? projMap.get(nextUpcomingTask.projectId)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Executive Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Your active focus, next scheduled commitment, and project-wise task completion KPIs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenWeeklyReview}
            className="min-h-[40px] px-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarRange className="w-4 h-4 text-amber-600" />
            Weekly Review
          </button>
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* HERO 2-COLUMN EXECUTION SPLIT: Current Task at Hand + Next Upcoming Scheduled Task */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* PRIMARY FOCAL ANCHOR: Current Task at Hand */}
        <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-900" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Current Task at Hand
                </h3>
              </div>
              {currentTask && (
                <span
                  className={`font-mono tabular-nums text-xs font-medium ${
                    currentIsRolledOver || currentIsOverdue ? 'text-red-600' : 'text-amber-700'
                  }`}
                >
                  {getRelativeScheduleHint(
                    currentTask.scheduledDate,
                    currentTask.scheduledTime,
                    todayKey
                  )}
                </span>
              )}
            </div>

            {currentTask ? (
              <div className="space-y-3">
                {/* Unboxed Business • Project / Phase Metadata */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: currentBiz?.colorHex || '#D97706' }}
                    />
                    {currentBiz?.name || 'Venture'}
                  </span>
                  {currentProj && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{currentProj.name}</span>
                    </>
                  )}
                  {currentTask.phaseHeading && (
                    <>
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-500">{currentTask.phaseHeading}</span>
                    </>
                  )}
                  {currentTask.priority === 'high' && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                        <Flame className="w-3 h-3" />
                        High Priority
                      </span>
                    </>
                  )}
                  {currentTask.isMilestone && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <Diamond className="w-3 h-3" />
                        Milestone
                      </span>
                    </>
                  )}
                </div>

                {/* Task Headline */}
                <h4 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug text-balance">
                  {currentTask.title}
                </h4>

                {/* Schedule Details */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatReadableDate(currentTask.scheduledDate)}
                  </span>
                  {currentTask.scheduledTime && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatTime12h(currentTask.scheduledTime)}
                    </span>
                  )}
                  {currentTask.hardDeadline && (
                    <span className="text-amber-700">
                      Hard deadline {formatShortDate(currentTask.hardDeadline)}
                    </span>
                  )}
                </div>

                {renderAttachmentChips(currentTask)}
              </div>
            ) : (
              <div className="py-6 space-y-2">
                <p className="font-display text-lg font-semibold text-slate-900">
                  No pending tasks queued
                </p>
                <p className="text-xs sm:text-sm text-slate-500">
                  Every unblocked action is finished. Schedule your next high-leverage move to keep
                  compounding.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {currentTask ? (
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(14);
                  onLockIn(currentTask);
                }}
                className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Target className="w-4 h-4" />
                Lock In Now
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic([14, 24, 14]);
                  onToggleDone(currentTask);
                }}
                className="min-h-[42px] px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                Mark Done
              </button>
              <button
                type="button"
                onClick={() => onEditTask(currentTask)}
                className="min-h-[42px] px-3.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() =>
                  onRealityCheck(
                    currentTask,
                    currentIsOverdue || currentIsRolledOver ? 'overdue' : 'manual'
                  )
                }
                className="min-h-[42px] px-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-amber-100 transition-colors ml-auto cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Reality Check
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenNewTaskModal}
                className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Schedule Next Task
              </button>
            </div>
          )}
        </section>

        {/* SECONDARY CARD: Next Upcoming Scheduled Task ONLY */}
        <section className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Next Upcoming Scheduled
                </h3>
              </div>
              {nextUpcomingTask && (
                <span className="font-mono tabular-nums text-xs text-slate-500">
                  {getRelativeScheduleHint(
                    nextUpcomingTask.scheduledDate,
                    nextUpcomingTask.scheduledTime,
                    todayKey
                  )}
                </span>
              )}
            </div>

            {nextUpcomingTask ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: upcomingBiz?.colorHex || '#64748B' }}
                    />
                    {upcomingBiz?.name || 'Venture'}
                  </span>
                  {upcomingProj && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{upcomingProj.name}</span>
                    </>
                  )}
                  {nextUpcomingTask.phaseHeading && (
                    <>
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-500">{nextUpcomingTask.phaseHeading}</span>
                    </>
                  )}
                </div>

                <h4 className="font-display text-lg font-bold text-slate-900 leading-snug">
                  {nextUpcomingTask.title}
                </h4>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                  <span>{formatReadableDate(nextUpcomingTask.scheduledDate)}</span>
                  {nextUpcomingTask.scheduledTime && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{formatTime12h(nextUpcomingTask.scheduledTime)}</span>
                    </>
                  )}
                  {nextUpcomingTask.priority === 'high' && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-red-600 font-sans font-semibold">High Priority</span>
                    </>
                  )}
                </div>

                {renderAttachmentChips(nextUpcomingTask)}
              </div>
            ) : (
              <div className="py-6 space-y-1.5">
                <p className="text-sm font-semibold text-slate-800">
                  No next task scheduled yet
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Only your single next chronologically scheduled task appears here so you stay
                  locked in without queue clutter.
                </p>
              </div>
            )}
          </div>

          {nextUpcomingTask && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onEditTask(nextUpcomingTask)}
                className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Schedule
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onLockIn(nextUpcomingTask);
                }}
                className="min-h-[38px] px-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Start Early
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* 4-COLUMN PORTFOLIO KPI STRIP (Full-width single elevation with hairline dividers) */}
      <section className="rounded-2xl bg-white border border-slate-200 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="p-4 sm:p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Tasks Completed</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-emerald-700">
              {portfolioStats.doneTasks}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              / {portfolioStats.totalTasks} ({portfolioStats.completionPct}%)
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Tasks Not Done</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-slate-900">
              {portfolioStats.notDoneTasks}
            </span>
            {portfolioStats.overdueTasks > 0 && (
              <span className="font-mono tabular-nums text-xs font-semibold text-red-600">
                {portfolioStats.overdueTasks} overdue
              </span>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Active Projects</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-slate-900">
              {portfolioStats.activeProjectsCount}
            </span>
            <span className="text-xs text-slate-500">
              across {businesses.filter((b) => b.isActive).length} ventures
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500">Milestones Completed</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-amber-600">
              {portfolioStats.milestonesDone}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              / {portfolioStats.milestonesTotal} diamond gates
            </span>
          </div>
        </div>
      </section>

      <VentureHealthSection
        businesses={businesses}
        projects={projects}
        tasks={tasks}
        onOpenVenture={onOpenVenture}
      />

      {/* PROJECT-WISE KPIs TABLE (Done vs Not Done Breakdown) */}
      <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
              Project-Wise Execution KPIs
            </h3>
            <p className="text-xs text-slate-500">
              Click any project row to inspect its remaining unfinished tasks alongside completed
              work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBizFilter}
              onChange={(e) => setSelectedBizFilter(e.target.value)}
              aria-label="Filter by venture"
              className="min-h-[36px] px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
            >
              <option value="all">All Ventures</option>
              {businesses
                .filter((b) => b.isActive)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>

            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
              {(
                [
                  { id: 'remaining', label: 'Most Open' },
                  { id: 'completion', label: 'Highest %' },
                  { id: 'name', label: 'A–Z' },
                ] as Array<{ id: SortKey; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortKey(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sortKey === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        {projectKpiRows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">No projects or tasks tracked yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Create a project inside Ventures &amp; Projects or add your first task to see live
              project-wise done vs. not-done metrics here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Desktop Table Column Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
              <div className="col-span-4">Project &amp; Venture</div>
              <div className="col-span-3">Completion Progress</div>
              <div className="col-span-1 text-right">Done</div>
              <div className="col-span-2 text-right">Not Done</div>
              <div className="col-span-2 text-right">Target / Action</div>
            </div>

            {projectKpiRows.map((row) => {
              const expanded = Boolean(expandedRowIds[row.id]);
              const accent = row.business?.colorHex || '#64748B';

              return (
                <div key={row.id} className="bg-white">
                  <div className="px-4 sm:px-5 py-3.5 hover:bg-slate-50/70 transition-colors grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Project & Business */}
                    <button
                      type="button"
                      onClick={() => toggleRow(row.id)}
                      className="md:col-span-4 flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      {row.business && (
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${accent}18` }}
                        >
                          <BusinessIcon
                            icon={row.business.icon}
                            color={accent}
                            className="w-4 h-4"
                          />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {row.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {row.business?.name || 'Venture'}
                          {row.milestonesTotal > 0
                            ? ` · ${row.milestonesDone}/${row.milestonesTotal} milestones`
                            : ''}
                        </div>
                      </div>
                    </button>

                    {/* Progress Bar */}
                    <div className="md:col-span-3 flex items-center gap-3 pl-6 md:pl-0">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${row.percent}%`, backgroundColor: accent }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-xs font-semibold text-slate-800 w-10 text-right">
                        {row.percent}%
                      </span>
                    </div>

                    {/* Done Count */}
                    <div className="md:col-span-1 flex md:block items-center justify-between pl-6 md:pl-0 md:text-right">
                      <span className="md:hidden text-xs text-slate-500">Done</span>
                      <span className="font-mono tabular-nums text-sm font-semibold text-emerald-700">
                        {row.done}
                      </span>
                    </div>

                    {/* Not Done Count */}
                    <div className="md:col-span-2 flex md:block items-center justify-between pl-6 md:pl-0 md:text-right">
                      <span className="md:hidden text-xs text-slate-500">Not Done</span>
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <span
                          className={`font-mono tabular-nums text-sm font-semibold ${
                            row.notDone > 0 ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {row.notDone}
                        </span>
                        {row.overdue > 0 && (
                          <span className="font-mono tabular-nums text-[11px] font-semibold text-red-600 inline-flex items-center gap-0.5">
                            <AlertOctagon className="w-3 h-3" />
                            {row.overdue}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Target / Open Project */}
                    <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-2 pl-6 md:pl-0">
                      {row.targetDate ? (
                        <span className="font-mono tabular-nums text-[11px] text-slate-500">
                          {formatShortDate(row.targetDate)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                      {row.project && (
                        <button
                          type="button"
                          onClick={() => onOpenProject(row.project!)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Inline Breakdown: Not Done vs Done Tasks */}
                  {expanded && (
                    <div className="px-4 sm:px-6 pb-5 pt-2 bg-slate-50/70 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Not Done Column */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1 border-b border-slate-200/80">
                          <span>Not Done ({row.notDoneTasks.length})</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            Action Required
                          </span>
                        </div>
                        {row.notDoneTasks.length === 0 ? (
                          <p className="text-xs text-emerald-700 py-2">
                            All tasks in this project are completed.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {row.notDoneTasks.map((t) => (
                              <div
                                key={t.id}
                                className="px-3 py-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic([12, 20, 12]);
                                      onToggleDone(t);
                                    }}
                                    aria-label={`Complete ${t.title}`}
                                    className="w-4 h-4 rounded border border-slate-300 hover:border-slate-900 shrink-0 cursor-pointer"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-slate-900 truncate">
                                      {t.title}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-500">
                                      {formatShortDate(t.scheduledDate)}
                                      {t.scheduledTime ? ` · ${formatTime12h(t.scheduledTime)}` : ''}
                                      {t.phaseHeading ? ` · ${t.phaseHeading}` : ''}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => onLockIn(t)}
                                    title="Lock In"
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                  >
                                    <Target className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onEditTask(t)}
                                    title="Edit task"
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Done Column */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 pb-1 border-b border-slate-200/80">
                          <span>Done ({row.doneTasks.length})</span>
                          <span className="font-mono text-[11px] text-emerald-600">Shipped</span>
                        </div>
                        {row.doneTasks.length === 0 ? (
                          <p className="text-xs text-slate-400 py-2">
                            No completed tasks in this project yet.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {row.doneTasks.map((t) => (
                              <div
                                key={t.id}
                                className="px-3 py-2 rounded-xl bg-white/80 border border-slate-200/60 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => onToggleDone(t)}
                                    aria-label={`Reopen ${t.title}`}
                                    className="text-emerald-600 shrink-0 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-slate-400 line-through truncate">
                                      {t.title}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-400">
                                      {formatShortDate(t.scheduledDate)}
                                      {t.phaseHeading ? ` · ${t.phaseHeading}` : ''}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onEditTask(t)}
                                  title="Edit task"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
