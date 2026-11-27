/**
 * Weekly review & venture health calculations.
 */
import type { Business, Habit, Project, Task } from '../types/empire';
import { addDays, getTodayKey, toDateKey } from './dateUtils';

function isoToKey(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toDateKey(d);
}

function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Monday of the week containing `key`. */
export function weekStartOf(key: string): string {
  const wd = weekdayOf(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export interface WeekStats {
  start: string;
  end: string;
  days: Array<{ key: string; label: string; done: number }>;
  done: number;
  missed: number;
  slipped: number; // scheduled in week, not done (missed or still open)
  scheduled: number;
  completionRate: number;
  onTimeRate: number;
  habitRate: number;
  highPriorityDone: number;
  milestonesDone: number;
  doneTasks: Task[];
  slippedTasks: Task[];
  perVenture: Array<{
    business: Business;
    done: Task[];
    slipped: Task[];
  }>;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function computeWeekStats(start: string, tasks: Task[], habits: Habit[], businesses: Business[]): WeekStats {
  const end = addDays(start, 6);
  const today = getTodayKey();
  const inWeek = (k: string) => k >= start && k <= end;

  const doneTasks = tasks.filter((t) => t.status === 'done' && inWeek(isoToKey(t.completedAt) || t.scheduledDate));
  const scheduledInWeek = tasks.filter((t) => inWeek(t.scheduledDate));
  const slippedTasks = scheduledInWeek.filter(
    (t) => t.status === 'missed' || (t.status === 'pending' && t.scheduledDate < today)
  );
  const missed = scheduledInWeek.filter((t) => t.status === 'missed').length;
  const decided = scheduledInWeek.filter((t) => t.status === 'done').length + slippedTasks.length;

  let onTime = 0;
  for (const t of doneTasks) {
    const doneKey = isoToKey(t.completedAt) || t.scheduledDate;
    const due = t.hardDeadline && t.hardDeadline > t.scheduledDate ? t.hardDeadline : t.scheduledDate;
    if (!due || doneKey <= due) onTime += 1;
  }

  // Habits: check-ins in week vs expected
  const lastCountable = end < today ? end : today;
  let expected = 0;
  let got = 0;
  for (const h of habits.filter((x) => x.isActive)) {
    let d = start;
    while (d <= lastCountable) {
      const wd = weekdayOf(d);
      const due = h.recurrenceRule === 'daily' || (h.recurrenceRule === 'weekdays' && wd !== 0 && wd !== 6);
      if (due) expected += 1;
      d = addDays(d, 1);
    }
    if (h.recurrenceRule === 'weekly' && start <= today) expected += 1;
    got += h.completedDates.filter(inWeek).length;
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    return {
      key,
      label: DAY_LABELS[i],
      done: doneTasks.filter((t) => (isoToKey(t.completedAt) || t.scheduledDate) === key).length,
    };
  });

  const perVenture = businesses
    .map((b) => ({
      business: b,
      done: doneTasks.filter((t) => t.businessId === b.id),
      slipped: slippedTasks.filter((t) => t.businessId === b.id),
    }))
    .filter((v) => v.done.length || v.slipped.length)
    .sort((a, b) => b.done.length - a.done.length);

  const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.round((n / d) * 100));

  return {
    start,
    end,
    days,
    done: doneTasks.length,
    missed,
    slipped: slippedTasks.length,
    scheduled: scheduledInWeek.length,
    completionRate: pct(scheduledInWeek.filter((t) => t.status === 'done').length, decided),
    onTimeRate: pct(onTime, doneTasks.length),
    habitRate: Math.min(100, pct(got, expected)),
    highPriorityDone: doneTasks.filter((t) => t.priority === 'high').length,
    milestonesDone: doneTasks.filter((t) => t.isMilestone).length,
    doneTasks,
    slippedTasks,
    perVenture,
  };
}

// ---------------------------------------------------------------------------
// Venture health
// ---------------------------------------------------------------------------

export type HealthStatus = 'green' | 'amber' | 'red' | 'idle';

export interface VentureHealth {
  business: Business;
  status: HealthStatus;
  reasons: string[];
  open: number;
  overdue: number;
  dueToday: number;
  done7d: number;
  activeProjects: number;
  projectsAtRisk: number;
  daysSinceActivity: number | null;
  milestonePct: number | null;
}

export function computeVentureHealth(business: Business, projects: Project[], tasks: Task[]): VentureHealth {
  const today = getTodayKey();
  const weekAgo = addDays(today, -6);
  const bizTasks = tasks.filter((t) => t.businessId === business.id);
  const open = bizTasks.filter((t) => t.status === 'pending');
  const overdue = open.filter((t) => t.scheduledDate < today);
  const dueToday = open.filter((t) => t.scheduledDate === today);
  const done7d = bizTasks.filter((t) => t.status === 'done' && (isoToKey(t.completedAt) || t.scheduledDate) >= weekAgo);
  const missed7d = bizTasks.filter((t) => t.status === 'missed' && t.scheduledDate >= weekAgo);

  const activeProjects = projects.filter((p) => p.businessId === business.id && !p.isArchived);
  let pastTarget = 0;
  let atRisk = 0;
  for (const p of activeProjects) {
    const pt = bizTasks.filter((t) => t.projectId === p.id);
    const openP = pt.filter((t) => t.status !== 'done').length;
    const pctDone = pt.length ? (pt.length - openP) / pt.length : 0;
    if (!p.targetDate || openP === 0) continue;
    if (p.targetDate < today) pastTarget += 1;
    else if (p.targetDate <= addDays(today, 7) && pctDone < 0.8) atRisk += 1;
  }

  const lastDone = bizTasks
    .map((t) => (t.status === 'done' ? isoToKey(t.completedAt) || t.scheduledDate : ''))
    .filter(Boolean)
    .sort()
    .pop();
  const daysSinceActivity = lastDone
    ? Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${lastDone}T00:00:00`)) / 86_400_000)
    : null;

  const milestones = bizTasks.filter((t) => t.isMilestone);
  const milestonePct = milestones.length
    ? Math.round((milestones.filter((t) => t.status === 'done').length / milestones.length) * 100)
    : null;

  const reasons: string[] = [];
  let score = 0; // higher = worse
  if (overdue.length >= 3) {
    score += 3;
    reasons.push(`${overdue.length} tasks overdue`);
  } else if (overdue.length > 0) {
    score += 1;
    reasons.push(`${overdue.length} task${overdue.length > 1 ? 's' : ''} overdue`);
  }
  if (pastTarget > 0) {
    score += 3;
    reasons.push(`${pastTarget} project${pastTarget > 1 ? 's' : ''} past target date`);
  }
  if (atRisk > 0) {
    score += 1;
    reasons.push(`${atRisk} project${atRisk > 1 ? 's' : ''} due within 7 days`);
  }
  if (open.length > 0 && (daysSinceActivity === null || daysSinceActivity >= 14)) {
    score += 3;
    reasons.push(daysSinceActivity === null ? 'No task completed yet' : `Nothing done in ${daysSinceActivity} days`);
  } else if (open.length > 0 && daysSinceActivity !== null && daysSinceActivity >= 7) {
    score += 1;
    reasons.push(`Nothing done in ${daysSinceActivity} days`);
  }
  if (missed7d.length >= 2) {
    score += 1;
    reasons.push(`${missed7d.length} missed this week`);
  }

  let status: HealthStatus;
  if (bizTasks.length === 0 || (open.length === 0 && done7d.length === 0)) status = 'idle';
  else if (score >= 3) status = 'red';
  else if (score >= 1) status = 'amber';
  else status = 'green';

  if (status === 'green') {
    reasons.push(done7d.length ? `${done7d.length} done this week, nothing overdue` : 'On track');
  }
  if (status === 'idle') reasons.push(bizTasks.length ? 'No open work right now' : 'No tasks yet');

  return {
    business,
    status,
    reasons,
    open: open.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
    done7d: done7d.length,
    activeProjects: activeProjects.length,
    projectsAtRisk: pastTarget + atRisk,
    daysSinceActivity,
    milestonePct,
  };
}
