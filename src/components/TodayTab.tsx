import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Lock,
  Plus,
} from 'lucide-react';
import type { Business, Project, Task, TaskFile, TriggerReason } from '../types/empire';
import { getTodayKey } from '../utils/dateUtils';
import type { ParsedQuickAdd } from '../utils/nlParser';
import { BusinessIcon } from './BusinessIcon';
import { QuickAddBar } from './QuickAddBar';
import { TaskCard } from './TaskCard';

interface TodayTabProps {
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  filesMap: Map<string, TaskFile>;
  blockedTaskIds: Set<string>;
  todayStats: { completed: number; total: number; percent: number };
  onCreateFromParsed: (parsed: ParsedQuickAdd) => Promise<void>;
  onOpenNewTaskModal: (initialTitle?: string) => void;
  onToggleDone: (task: Task) => void;
  onLockIn: (task: Task) => void;
  onRealityCheck: (task: Task, reason: TriggerReason) => void;
  onReschedule: (task: Task, newDate: string, newTime: string) => void;
  onMarkMissed: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onPreviewFile: (file: TaskFile) => void;
}

type GroupMode = 'business' | 'chronological';

export function TodayTab({
  businesses,
  projects,
  tasks,
  filesMap,
  blockedTaskIds,
  todayStats,
  onCreateFromParsed,
  onOpenNewTaskModal,
  onToggleDone,
  onLockIn,
  onRealityCheck,
  onReschedule,
  onMarkMissed,
  onEditTask,
  onDeleteTask,
  onPreviewFile,
}: TodayTabProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>('business');
  const [collapsedBizIds, setCollapsedBizIds] = useState<Record<string, boolean>>({});
  const [showBlocked, setShowBlocked] = useState(false);

  const today = getTodayKey();
  const bizMap = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Rolled-over unfinished tasks from previous dates (excluding blocked)
  const rolledOverTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.scheduledDate < today && t.status === 'pending' && !blockedTaskIds.has(t.id))
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [tasks, today, blockedTaskIds]
  );

  // Today's unblocked tasks
  const todayTasks = useMemo(() => {
    const list = tasks.filter((t) => t.scheduledDate === today && !blockedTaskIds.has(t.id));
    return list.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      const aTime = a.scheduledTime || '99:99';
      const bTime = b.scheduledTime || '99:99';
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [tasks, today, blockedTaskIds]);

  // Blocked tasks scheduled for today or earlier
  const blockedTodayTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.scheduledDate <= today && t.status === 'pending' && blockedTaskIds.has(t.id)
      ),
    [tasks, today, blockedTaskIds]
  );

  // Grouped by Business
  const groupedByBusiness = useMemo(() => {
    const groups: Array<{ business: Business; items: Task[] }> = [];
    for (const biz of businesses) {
      const items = todayTasks.filter((t) => t.businessId === biz.id);
      if (items.length > 0) {
        groups.push({ business: biz, items });
      }
    }
    return groups;
  }, [businesses, todayTasks]);

  const toggleBizCollapse = (bizId: string) => {
    setCollapsedBizIds((prev) => ({ ...prev, [bizId]: !prev[bizId] }));
  };

  return (
    <div className="space-y-6">
      {/* Live "₹1,000 Cr Empire Execution" Progress Card */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              ₹1,000 Cr Empire Execution
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Unblocked actions scheduled for today plus rolled-over commitments.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold text-amber-600">
              {todayStats.percent}%
            </div>
            <div className="font-mono tabular-nums text-xs text-slate-500">
              {todayStats.completed}/{todayStats.total} tasks completed
            </div>
          </div>
        </div>

        {/* Progress Track */}
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${todayStats.percent}%` }}
          />
        </div>
      </section>

      {/* Persistent Natural Language Quick-Add Bar */}
      <QuickAddBar
        businesses={businesses}
        projects={projects}
        defaultDate={today}
        onCreateFromParsed={onCreateFromParsed}
        onOpenFullModal={onOpenNewTaskModal}
      />

      {/* Grouping Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
          <span>{todayTasks.filter((t) => t.status === 'pending').length} active today</span>
          {rolledOverTasks.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-red-600 font-medium">{rolledOverTasks.length} rolled over</span>
            </>
          )}
          {blockedTodayTasks.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{blockedTodayTasks.length} blocked</span>
            </>
          )}
        </div>

        <div
          className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80"
          role="tablist"
          aria-label="Task grouping mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={groupMode === 'business'}
            onClick={() => setGroupMode('business')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              groupMode === 'business'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            By Business
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={groupMode === 'chronological'}
            onClick={() => setGroupMode('chronological')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              groupMode === 'chronological'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Chronological
          </button>
        </div>
      </div>

      {/* Rolled Over Section (Pinned at Top) */}
      {rolledOverTasks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600">
              <AlertOctagon className="w-4 h-4" />
              <h3 className="font-display text-sm font-semibold text-red-700">
                Rolled Over From Previous Days
              </h3>
              <span className="font-mono tabular-nums text-xs text-red-500">
                ({rolledOverTasks.length})
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {rolledOverTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                business={bizMap.get(task.businessId)}
                project={projMap.get(task.projectId)}
                filesMap={filesMap}
                isRolledOver
                onToggleDone={onToggleDone}
                onLockIn={onLockIn}
                onRealityCheck={onRealityCheck}
                onReschedule={onReschedule}
                onMarkMissed={onMarkMissed}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onPreviewFile={onPreviewFile}
              />
            ))}
          </div>
        </section>
      )}

      {/* Today's Action Queue */}
      {todayTasks.length === 0 && rolledOverTasks.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="space-y-1.5">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              Today&apos;s execution slate is clear
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Use the Quick-Add bar above with{' '}
              <span className="font-mono text-amber-700 font-medium">#Business</span>,{' '}
              <span className="font-mono text-slate-800 font-medium">@Project</span>, and{' '}
              <span className="font-mono text-red-600 font-medium">!high</span> to add your first action.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenNewTaskModal('')}
            className="min-h-[44px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-sm inline-flex items-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Task
          </button>
        </div>
      ) : groupMode === 'business' ? (
        <div className="space-y-5">
          {groupedByBusiness.map(({ business, items }) => {
            const isCollapsed = Boolean(collapsedBizIds[business.id]);
            const doneCount = items.filter((t) => t.status === 'done').length;

            return (
              <section key={business.id} className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => toggleBizCollapse(business.id)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl hover:bg-slate-200/50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${business.colorHex}18` }}
                    >
                      <BusinessIcon icon={business.icon} color={business.colorHex} className="w-4 h-4" />
                    </span>
                    <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                      {business.name}
                    </h3>
                  </div>

                  <span className="font-mono tabular-nums text-xs text-slate-500 shrink-0">
                    {doneCount}/{items.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2.5 pl-1">
                    {items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        business={business}
                        project={projMap.get(task.projectId)}
                        filesMap={filesMap}
                        onToggleDone={onToggleDone}
                        onLockIn={onLockIn}
                        onRealityCheck={onRealityCheck}
                        onReschedule={onReschedule}
                        onMarkMissed={onMarkMissed}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onPreviewFile={onPreviewFile}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <section className="space-y-2.5">
          {todayTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              business={bizMap.get(task.businessId)}
              project={projMap.get(task.projectId)}
              filesMap={filesMap}
              onToggleDone={onToggleDone}
              onLockIn={onLockIn}
              onRealityCheck={onRealityCheck}
              onReschedule={onReschedule}
              onMarkMissed={onMarkMissed}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onPreviewFile={onPreviewFile}
            />
          ))}
        </section>
      )}

      {/* Blocked Tasks Collapsible Drawer */}
      {blockedTodayTasks.length > 0 && (
        <section className="pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowBlocked((v) => !v)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl hover:bg-slate-200/50 flex items-center justify-between text-xs text-slate-500 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Hidden Blocked Tasks ({blockedTodayTasks.length}) — waiting on prerequisites
            </span>
            {showBlocked ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showBlocked && (
            <div className="mt-2.5 space-y-2.5">
              {blockedTodayTasks.map((task) => {
                const blocker = taskMap.get(task.blockedByTaskId);
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    business={bizMap.get(task.businessId)}
                    project={projMap.get(task.projectId)}
                    filesMap={filesMap}
                    isBlocked
                    blockerTaskTitle={blocker?.title || 'Prerequisite task'}
                    onToggleDone={onToggleDone}
                    onLockIn={onLockIn}
                    onRealityCheck={onRealityCheck}
                    onReschedule={onReschedule}
                    onMarkMissed={onMarkMissed}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onPreviewFile={onPreviewFile}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
