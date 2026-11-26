/**
 * Lifetime execution KPIs computed from the user's full task, habit and coach history.
 */
import type { CoachLog, Habit, Task } from '../types/empire';
import { addDays, getTodayKey, toDateKey } from './dateUtils';

export interface LifetimeKpis {
  // Volume
  totalTasks: number;
  done: number;
  missed: number;
  overdueOpen: number;
  // Rates (0-100)
  executionRate: number; // done / (done + missed + overdue open)
  successRate: number; // done / (done + missed) — of everything that got decided
  onTimeRate: number; // done on/before schedule or deadline / done
  delayRate: number; // (late completions + overdue open) / (done + overdue open)
  highPriorityRate: number; // high-priority done / high-priority due
  milestoneRate: number;
  habitConsistency: number; // habit check-ins / expected check-ins
  // Extra signals
  avgDelayDays: number; // average days late, for late completions
  reschedules: number;
  milestonesDone: number;
  habitCheckIns: number;
  bestHabitStreak: number;
  activeDays: number; // distinct days with ≥1 task done
  currentExecutionStreak: number; // consecutive days (up to today/yesterday) with ≥1 task done
  longestExecutionStreak: number;
  firstActivityDate: string;
  // Composite
  score: number; // 0-100 Executor Score
  level: { name: string; min: number; next: number | null };
  archetype: { name: string; description: string };
  hasEnoughData: boolean;
}

export interface Award {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  progress: number; // 0-1
  progressLabel: string;
}

const pct = (num: number, den: number) => (den <= 0 ? 0 : Math.round((num / den) * 100));

function isoToDateKey(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toDateKey(d);
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

function longestRun(sortedKeys: string[]): number {
  let best = 0;
  let run = 0;
  let prev = '';
  for (const k of sortedKeys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

function expectedHabitDays(habit: Habit, today: string): number {
  const created = habit.createdAt?.toDate ? toDateKey(habit.createdAt.toDate()) : '';
  const firstCheck = [...habit.completedDates].sort()[0] || '';
  const start = [created, firstCheck].filter(Boolean).sort()[0] || today;
  const span = Math.max(1, daysBetween(start, today) + 1);
  if (habit.recurrenceRule === 'weekly') return Math.max(1, Math.ceil(span / 7));
  if (habit.recurrenceRule === 'weekdays') return Math.max(1, Math.round((span * 5) / 7));
  return span;
}

const LEVELS = [
  { name: 'Starter', min: 0 },
  { name: 'Operator', min: 40 },
  { name: 'Executor', min: 55 },
  { name: 'Closer', min: 70 },
  { name: 'Empire Builder', min: 82 },
  { name: 'Titan', min: 92 },
];

export function computeLifetimeKpis(tasks: Task[], habits: Habit[], coachLogs: CoachLog[]): LifetimeKpis {
  const today = getTodayKey();
  const realTasks = tasks.filter((t) => !t.isHabit);

  const doneTasks = realTasks.filter((t) => t.status === 'done');
  const missedTasks = realTasks.filter((t) => t.status === 'missed');
  const overdueOpen = realTasks.filter(
    (t) => t.status === 'pending' && t.scheduledDate && t.scheduledDate < today
  );

  // On-time vs late
  let onTime = 0;
  let lateCount = 0;
  let lateDaysSum = 0;
  for (const t of doneTasks) {
    const doneKey = isoToDateKey(t.completedAt) || t.scheduledDate;
    const due = t.hardDeadline && t.hardDeadline > t.scheduledDate ? t.hardDeadline : t.scheduledDate;
    if (!due || doneKey <= due) {
      onTime += 1;
    } else {
      lateCount += 1;
      lateDaysSum += Math.max(1, daysBetween(due, doneKey));
    }
  }

  const due = (list: Task[]) =>
    list.filter((t) => t.status !== 'pending' || (t.scheduledDate && t.scheduledDate < today));
  const highDue = due(realTasks.filter((t) => t.priority === 'high'));
  const mileDue = due(realTasks.filter((t) => t.isMilestone));
  const milestonesDone = realTasks.filter((t) => t.isMilestone && t.status === 'done').length;

  // Habits
  let habitCheckIns = 0;
  let expected = 0;
  let bestHabitStreak = 0;
  for (const h of habits) {
    const dates = [...new Set(h.completedDates)].sort();
    habitCheckIns += dates.length;
    if (h.isActive || dates.length) expected += expectedHabitDays(h, today);
    bestHabitStreak = Math.max(bestHabitStreak, longestRun(dates), h.streakCount || 0);
  }

  // Execution streaks (days with ≥1 task done)
  const doneDays = [...new Set(doneTasks.map((t) => isoToDateKey(t.completedAt) || t.scheduledDate).filter(Boolean))].sort();
  const doneSet = new Set(doneDays);
  let current = 0;
  let cursor = doneSet.has(today) ? today : addDays(today, -1);
  while (doneSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const reschedules = coachLogs.filter((l) => l.triggerReason === 'rescheduled').length;

  const executionRate = pct(doneTasks.length, doneTasks.length + missedTasks.length + overdueOpen.length);
  const successRate = pct(doneTasks.length, doneTasks.length + missedTasks.length);
  const onTimeRate = pct(onTime, doneTasks.length);
  const delayRate = pct(lateCount + overdueOpen.length, doneTasks.length + overdueOpen.length);
  const highPriorityRate = pct(highDue.filter((t) => t.status === 'done').length, highDue.length);
  const milestoneRate = pct(milestonesDone, mileDue.length);
  const habitConsistency = Math.min(100, pct(habitCheckIns, expected));

  const resolved = doneTasks.length + missedTasks.length + overdueOpen.length;
  const hasEnoughData = resolved >= 5 || habitCheckIns >= 7;

  // Executor Score — weighted blend; categories without data fall back to neutral weight redistribution
  const parts: Array<[number, number, boolean]> = [
    [executionRate, 0.35, resolved > 0],
    [onTimeRate, 0.25, doneTasks.length > 0],
    [habitConsistency, 0.2, expected > 0],
    [highPriorityRate, 0.1, highDue.length > 0],
    [milestoneRate, 0.1, mileDue.length > 0],
  ];
  const usable = parts.filter((p) => p[2]);
  const wSum = usable.reduce((s, p) => s + p[1], 0);
  let score = wSum > 0 ? Math.round(usable.reduce((s, p) => s + p[0] * p[1], 0) / wSum) : 0;
  // Penalise heavy rescheduling a little (max −8)
  score = Math.max(0, score - Math.min(8, Math.round((reschedules / Math.max(1, resolved)) * 20)));

  const levelIdx = LEVELS.reduce((idx, l, i) => (score >= l.min ? i : idx), 0);
  const level = {
    name: LEVELS[levelIdx].name,
    min: LEVELS[levelIdx].min,
    next: LEVELS[levelIdx + 1]?.min ?? null,
  };

  const archetype = pickArchetype({
    hasEnoughData,
    score,
    executionRate,
    onTimeRate,
    delayRate,
    habitConsistency,
    done: doneTasks.length,
    reschedules,
    overdue: overdueOpen.length,
  });

  const allDates = [
    ...doneDays,
    ...habits.flatMap((h) => h.completedDates),
    ...realTasks.map((t) => t.scheduledDate).filter((d) => d && d <= today),
  ].sort();

  return {
    totalTasks: realTasks.length,
    done: doneTasks.length,
    missed: missedTasks.length,
    overdueOpen: overdueOpen.length,
    executionRate,
    successRate,
    onTimeRate,
    delayRate,
    highPriorityRate,
    milestoneRate,
    habitConsistency,
    avgDelayDays: lateCount ? Math.round((lateDaysSum / lateCount) * 10) / 10 : 0,
    reschedules,
    milestonesDone,
    habitCheckIns,
    bestHabitStreak,
    activeDays: doneDays.length,
    currentExecutionStreak: current,
    longestExecutionStreak: longestRun(doneDays),
    firstActivityDate: allDates[0] || '',
    score,
    level,
    archetype,
    hasEnoughData,
  };
}

function pickArchetype(k: {
  hasEnoughData: boolean;
  score: number;
  executionRate: number;
  onTimeRate: number;
  delayRate: number;
  habitConsistency: number;
  done: number;
  reschedules: number;
  overdue: number;
}): { name: string; description: string } {
  if (!k.hasEnoughData) {
    return {
      name: 'Rising Executor',
      description: 'Still building a track record. Close 5 tasks or log 7 habit check-ins to reveal your true type.',
    };
  }
  if (k.executionRate >= 85 && k.onTimeRate >= 80) {
    return { name: 'Relentless Closer', description: 'You finish what you start, and you finish on time. Rare and lethal.' };
  }
  if (k.executionRate >= 75 && k.onTimeRate < 60) {
    return { name: 'Late Finisher', description: 'You always get it done — just after the deadline. Tighten the clock and you are elite.' };
  }
  if (k.habitConsistency >= 75 && k.executionRate < 65) {
    return { name: 'Discipline Builder', description: 'Your daily habits are strong; now turn that discipline onto business tasks.' };
  }
  if (k.reschedules >= 5 && k.reschedules > k.done / 3) {
    return { name: 'Serial Rescheduler', description: 'Tasks keep getting pushed. Commit smaller, then execute without moving the date.' };
  }
  if (k.overdue >= 5 && k.executionRate < 55) {
    return { name: 'Ambitious Planner', description: 'You plan more than you execute. Cut the list in half and close every item on it.' };
  }
  if (k.onTimeRate >= 85 && k.executionRate >= 60) {
    return { name: 'Precision Operator', description: 'When you commit, you deliver on time. Increase your volume to dominate.' };
  }
  if (k.score >= 60) {
    return { name: 'Steady Executor', description: 'Consistent and reliable. Push your on-time rate to break into the top tier.' };
  }
  return { name: 'Restart Mode', description: 'Execution has slipped. Win today: pick one task and close it before noon.' };
}

export function computeAwards(k: LifetimeKpis): Award[] {
  const mk = (
    id: string,
    name: string,
    description: string,
    value: number,
    target: number,
    unit = ''
  ): Award => ({
    id,
    name,
    description,
    earned: value >= target,
    progress: Math.min(1, target ? value / target : 0),
    progressLabel: `${Math.min(value, target)}/${target}${unit}`,
  });
  return [
    mk('first-blood', 'First Blood', 'Complete your first 10 tasks', k.done, 10),
    mk('centurion', 'Centurion', 'Complete 100 tasks', k.done, 100),
    mk('thousand', 'Empire Engine', 'Complete 1,000 tasks', k.done, 1000),
    mk('streak-7', 'Week of Fire', '7-day execution streak', k.longestExecutionStreak, 7, ' days'),
    mk('streak-30', 'Unbreakable', '30-day execution streak', k.longestExecutionStreak, 30, ' days'),
    mk('habit-21', 'Habit Forged', '21-day habit streak', k.bestHabitStreak, 21, ' days'),
    mk('habit-66', 'Identity Shift', '66-day habit streak', k.bestHabitStreak, 66, ' days'),
    mk('milestones', 'Milestone Maker', 'Hit 5 project milestones', k.milestonesDone, 5),
    {
      id: 'on-time',
      name: 'On-Time Pro',
      description: '80%+ on-time rate with 20+ tasks done',
      earned: k.onTimeRate >= 80 && k.done >= 20,
      progress: Math.min(1, (Math.min(k.done, 20) / 20) * (Math.min(k.onTimeRate, 80) / 80)),
      progressLabel: `${k.onTimeRate}% · ${Math.min(k.done, 20)}/20`,
    },
    {
      id: 'closer',
      name: 'The Closer',
      description: '90%+ execution rate with 30+ tasks done',
      earned: k.executionRate >= 90 && k.done >= 30,
      progress: Math.min(1, (Math.min(k.done, 30) / 30) * (Math.min(k.executionRate, 90) / 90)),
      progressLabel: `${k.executionRate}% · ${Math.min(k.done, 30)}/30`,
    },
  ];
}
