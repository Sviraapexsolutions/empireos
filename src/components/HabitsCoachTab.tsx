import { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Flame,
  Pencil,
  Plus,
  Quote,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { AiProvider, Business, CoachLog, Habit, Task } from '../types/empire';
import { LifetimeKpisPanel } from './LifetimeKpisPanel';
import { getCoachModel } from '../services/aiCoach';
import {
  formatTime12h,
  getLast7DateKeys,
  getTodayKey,
  triggerHaptic,
} from '../utils/dateUtils';

interface HabitsCoachTabProps {
  businesses: Business[];
  habits: Habit[];
  tasks: Task[];
  coachLogs: CoachLog[];
  aiProvider?: AiProvider;
  onToggleHabitToday: (habit: Habit, dateKey: string) => void;
  onAddHabit: () => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (habit: Habit) => void;
  onTriggerRealityCheckForTask: (task: Task) => void;
  onDeleteCoachLog: (logId: string) => void;
}

const TRIGGER_LABELS: Record<CoachLog['triggerReason'], string> = {
  overdue: 'Time Elapsed',
  rescheduled: 'Rescheduled',
  missed: 'Marked Missed',
  manual: 'Reality Check',
};

export function HabitsCoachTab({
  businesses,
  habits,
  tasks,
  coachLogs,
  aiProvider = 'gemini',
  onToggleHabitToday,
  onAddHabit,
  onEditHabit,
  onDeleteHabit,
  onTriggerRealityCheckForTask,
  onDeleteCoachLog,
}: HabitsCoachTabProps) {
  const providerLabel = `${aiProvider === 'claude' ? 'Claude' : 'Gemini'} · ${getCoachModel(aiProvider)}`;
  const today = getTodayKey();
  const last7 = useMemo(() => getLast7DateKeys(), []);
  const bizMap = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);
  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === 'pending'),
    [tasks]
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  const activeHabits = useMemo(() => habits.filter((h) => h.isActive), [habits]);
  const completedTodayCount = useMemo(
    () => activeHabits.filter((h) => h.completedDates.includes(today)).length,
    [activeHabits, today]
  );

  const handleManualCoach = () => {
    const target =
      pendingTasks.find((t) => t.id === selectedTaskId) || pendingTasks[0];
    if (target) {
      onTriggerRealityCheckForTask(target);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-12">
        <LifetimeKpisPanel tasks={tasks} habits={habits} coachLogs={coachLogs} aiProvider={aiProvider} />
      </div>

      {/* Left Column: Daily Recurring Habit Checklist + 7-Day Dot Matrix */}
      <section className="xl:col-span-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Daily Discipline Habits
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-mono tabular-nums">
              {completedTodayCount}/{activeHabits.length} locked in today
            </p>
          </div>
          <button
            type="button"
            onClick={onAddHabit}
            className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Habit
          </button>
        </div>

        {/* 7-Day Header Legend */}
        {activeHabits.length > 0 && (
          <div className="px-4 flex items-center justify-end gap-2">
            {last7.map((d) => (
              <div
                key={d.dateKey}
                className={`w-6 text-center text-[10px] font-mono ${
                  d.dateKey === today ? 'text-amber-700 font-semibold' : 'text-slate-400'
                }`}
              >
                {d.dayLabel}
              </div>
            ))}
          </div>
        )}

        {activeHabits.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-sm text-slate-500">
              No daily habits configured yet. Build compounding execution routines.
            </p>
            <button
              type="button"
              onClick={onAddHabit}
              className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Add First Habit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeHabits.map((habit) => {
              const doneToday = habit.completedDates.includes(today);
              const biz = bizMap.get(habit.businessId);
              const accent = biz?.colorHex || '#D97706';

              return (
                <div
                  key={habit.id}
                  className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(doneToday ? 8 : [12, 20, 12]);
                          onToggleHabitToday(habit, today);
                        }}
                        aria-label={`Toggle ${habit.title} for today`}
                        className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            doneToday
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white hover:border-slate-900'
                          }`}
                        >
                          {doneToday && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </span>
                      </button>

                      <div className="min-w-0 space-y-1">
                        <h3
                          className={`text-sm font-semibold leading-snug ${
                            doneToday ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {habit.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <span
                              className="w-2 h-2 rounded-xs"
                              style={{ backgroundColor: accent }}
                            />
                            {biz?.name || 'Personal'}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="capitalize">{habit.recurrenceRule}</span>
                          {habit.scheduledTime && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                <Clock className="w-3 h-3" />
                                {formatTime12h(habit.scheduledTime)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Flame Streak Counter + Edit/Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div
                        className={`px-2 py-1 rounded-lg font-mono tabular-nums text-xs font-semibold flex items-center gap-1 ${
                          habit.streakCount > 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                        title="Current streak"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        {habit.streakCount}d
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditHabit(habit)}
                        aria-label={`Edit ${habit.title}`}
                        className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteHabit(habit)}
                        aria-label={`Delete ${habit.title}`}
                        className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 7-Day Completion Dot Matrix */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">7-day consistency</span>
                    <div className="flex items-center gap-2">
                      {last7.map((d) => {
                        const checked = habit.completedDates.includes(d.dateKey);
                        const isTodayCell = d.dateKey === today;
                        return (
                          <button
                            key={d.dateKey}
                            type="button"
                            onClick={() => {
                              triggerHaptic(10);
                              onToggleHabitToday(habit, d.dateKey);
                            }}
                            title={`${d.dateKey} (${checked ? 'Done' : 'Missed'})`}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                              checked
                                ? 'text-white'
                                : isTodayCell
                                  ? 'bg-amber-50 border border-amber-400 text-amber-800'
                                  : 'bg-slate-100 border border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                            style={checked ? { backgroundColor: accent } : undefined}
                          >
                            {checked ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <span className="text-[9px] font-mono">{d.dayNum}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Right Column: ₹1,000 Cr Empire AI Reality Check Feed */}
      <section className="xl:col-span-6 space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            ₹1,000 Cr Accountability Coach
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            High-standards Reality Checks powered by {providerLabel} and archived permanently.
          </p>
        </div>

        {/* Manual Reality Check Launcher */}
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <select
            value={selectedTaskId || pendingTasks[0]?.id || ''}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            aria-label="Select stalled task for Reality Check"
            className="flex-1 min-w-0 min-h-[42px] px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-slate-900"
          >
            {pendingTasks.length === 0 ? (
              <option value="">No pending tasks yet — add a task first</option>
            ) : (
              pendingTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            disabled={pendingTasks.length === 0}
            onClick={handleManualCoach}
            className="min-h-[42px] px-4 rounded-xl bg-red-600 text-white hover:bg-red-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            Trigger Reality Check
          </button>
        </div>

        {/* History Feed of Coach Logs */}
        {coachLogs.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="font-display text-base font-semibold text-slate-900">
              No Reality Checks logged yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              When a task slips past its scheduled time, gets rescheduled, or you tap Reality Check,
              your personalized accountability directive and tactical quote breakdown will be logged here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {coachLogs.map((log) => (
              <article
                key={log.id}
                className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">{log.businessName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-red-600 font-medium">
                        {TRIGGER_LABELS[log.triggerReason]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {log.completionPercent}% execution
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 break-words">
                      {log.taskTitle}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteCoachLog(log.id)}
                    aria-label="Delete coach log"
                    className="min-w-[32px] min-h-[32px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Wake-Up Call */}
                <p className="text-sm text-slate-900 leading-relaxed font-medium">
                  {log.wakeUpCall}
                </p>

                {/* Verified Iconic Quote */}
                <blockquote className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Quote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm italic text-slate-800 leading-relaxed">
                      “{log.quote}”
                    </p>
                  </div>
                  <footer className="pl-6 text-xs font-semibold text-amber-700">
                    — {log.quoteAuthor}
                  </footer>
                </blockquote>

                {/* Tactical Breakdown */}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-emerald-700">Tactical Execution Now</div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {log.tacticalBreakdown}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
