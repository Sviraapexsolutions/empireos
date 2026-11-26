import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Business, Project, Task, TaskFile, TriggerReason } from '../types/empire';
import { buildMonthGrid, formatReadableDate, getTodayKey } from '../utils/dateUtils';
import type { ParsedQuickAdd } from '../utils/nlParser';
import { QuickAddBar } from './QuickAddBar';
import { TaskCard } from './TaskCard';

interface CalendarTabProps {
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  filesMap: Map<string, TaskFile>;
  blockedTaskIds: Set<string>;
  onCreateFromParsed: (parsed: ParsedQuickAdd) => Promise<void>;
  onToggleDone: (task: Task) => void;
  onLockIn: (task: Task) => void;
  onRealityCheck: (task: Task, reason: TriggerReason) => void;
  onReschedule: (task: Task, newDate: string, newTime: string) => void;
  onMarkMissed: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onPreviewFile: (file: TaskFile) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarTab({
  businesses,
  projects,
  tasks,
  filesMap,
  blockedTaskIds,
  onCreateFromParsed,
  onToggleDone,
  onLockIn,
  onRealityCheck,
  onReschedule,
  onMarkMissed,
  onEditTask,
  onDeleteTask,
  onPreviewFile,
}: CalendarTabProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const bizMap = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const list = map.get(task.scheduledDate) || [];
      list.push(task);
      map.set(task.scheduledDate, list);
    }
    return map;
  }, [tasks]);

  const selectedDayTasks = useMemo(() => {
    const list = tasksByDate.get(selectedDate) || [];
    return [...list].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99');
    });
  }, [tasksByDate, selectedDate]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const jumpToToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(getTodayKey());
  };

  const handleSelectCell = (dateKey: string) => {
    setSelectedDate(dateKey);
    setMobileSheetOpen(true);
  };

  const renderDayAgenda = (isMobileSheet: boolean) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900">
            {formatReadableDate(selectedDate)}
          </h3>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {selectedDayTasks.filter((t) => t.status === 'done').length} completed ·{' '}
            {selectedDayTasks.filter((t) => t.status === 'pending').length} pending
          </p>
        </div>
        {isMobileSheet && (
          <button
            type="button"
            onClick={() => setMobileSheetOpen(false)}
            aria-label="Close day sheet"
            className="min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Inline "+ Add Task for [Date]" Bar */}
      <QuickAddBar
        businesses={businesses}
        projects={projects}
        defaultDate={selectedDate}
        compact
        placeholder={`+ Add task for ${formatReadableDate(selectedDate)}...`}
        onCreateFromParsed={onCreateFromParsed}
      />

      {selectedDayTasks.length === 0 ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-6 text-center text-xs text-slate-500">
          No tasks scheduled for this date yet. Add one above using #Business or @Project.
        </div>
      ) : (
        <div className="space-y-2.5">
          {selectedDayTasks.map((task) => {
            const isBlocked = blockedTaskIds.has(task.id);
            const blocker = task.blockedByTaskId ? taskMap.get(task.blockedByTaskId) : undefined;
            return (
              <TaskCard
                key={task.id}
                task={task}
                business={bizMap.get(task.businessId)}
                project={projMap.get(task.projectId)}
                filesMap={filesMap}
                isBlocked={isBlocked}
                blockerTaskTitle={blocker?.title}
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
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Master Month Grid */}
      <section className="xl:col-span-7 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {monthLabel}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={jumpToToday}
              className="min-h-[38px] px-3 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              aria-label="Previous month"
              className="min-w-[38px] min-h-[38px] rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              aria-label="Next month"
              className="min-w-[38px] min-h-[38px] rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Header */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-[11px] font-semibold text-slate-500 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* 42-Cell Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell) => {
            const dayTasks = tasksByDate.get(cell.dateKey) || [];
            const doneCount = dayTasks.filter((t) => t.status === 'done').length;
            const totalCount = dayTasks.length;
            const uniqueBizColors = Array.from(
              new Set(
                dayTasks
                  .map((t) => bizMap.get(t.businessId)?.colorHex)
                  .filter((c): c is string => Boolean(c))
              )
            ).slice(0, 5);
            const isSelected = cell.dateKey === selectedDate;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => handleSelectCell(cell.dateKey)}
                className={`min-h-[68px] sm:min-h-[80px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : cell.isToday
                      ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                      : cell.isCurrentMonth
                        ? 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
                        : 'bg-slate-50/60 border-slate-100 opacity-50 hover:opacity-80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-mono tabular-nums text-xs sm:text-sm font-semibold ${
                      isSelected
                        ? 'text-white'
                        : cell.isToday
                          ? 'text-amber-700'
                          : 'text-slate-800'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  {totalCount > 0 && (
                    <span
                      className={`font-mono tabular-nums text-[10px] ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {doneCount}/{totalCount}
                    </span>
                  )}
                </div>

                {/* Colored Dots for Scheduled Businesses */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {uniqueBizColors.map((hex) => (
                    <span
                      key={hex}
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Business Color Legend */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          {businesses
            .filter((b) => b.isActive)
            .map((biz) => (
              <span key={biz.id} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: biz.colorHex }}
                />
                <span className="truncate max-w-[160px]">{biz.name}</span>
              </span>
            ))}
        </div>
      </section>

      {/* Desktop Right-Hand Day Inspector */}
      <aside className="hidden xl:block xl:col-span-5 rounded-2xl bg-white border border-slate-200 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {renderDayAgenda(false)}
      </aside>

      {/* Mobile / Tablet Slide-Up Bottom Sheet */}
      {mobileSheetOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileSheetOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[82vh] overflow-y-auto rounded-t-3xl bg-white border-t border-slate-200 p-5 pb-8 shadow-2xl">
            <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto mb-4" />
            {renderDayAgenda(true)}
          </div>
        </div>
      )}
    </div>
  );
}
