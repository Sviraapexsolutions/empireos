/**
 * Recurring business routines built on recurring tasks (recurrenceRule !== 'none').
 * Each completed occurrence stays as history; the next occurrence is created automatically.
 */
import type { RecurrenceRule, Task } from '../types/empire';
import { addDays } from './dateUtils';

export type RoutineRule = Exclude<RecurrenceRule, 'none'>;

/** Weekday of a YYYY-MM-DD key (0 = Sunday). */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Next occurrence strictly after `fromKey`. */
export function nextOccurrence(fromKey: string, rule: RoutineRule): string {
  if (rule === 'weekly') return addDays(fromKey, 7);
  if (rule === 'weekdays') {
    let next = addDays(fromKey, 1);
    while ([0, 6].includes(weekdayOf(next))) next = addDays(next, 1);
    return next;
  }
  return addDays(fromKey, 1);
}

/** First occurrence on or after `fromKey` that keeps the series' weekday rhythm. */
export function occurrenceOnOrAfter(seriesDate: string, rule: RoutineRule, fromKey: string): string {
  let d = seriesDate;
  let guard = 0;
  while (d < fromKey && guard < 800) {
    d = nextOccurrence(d, rule);
    guard += 1;
  }
  if (rule === 'weekdays' && [0, 6].includes(weekdayOf(d))) d = nextOccurrence(d, rule);
  return d;
}

/** Stable identity of a routine series. */
export function seriesKey(t: Pick<Task, 'title' | 'businessId' | 'projectId' | 'recurrenceRule'>): string {
  return [t.businessId, t.projectId, t.recurrenceRule, t.title.trim().toLowerCase()].join('|');
}

export interface RoutineSeries {
  key: string;
  latest: Task; // most recent occurrence by date
  pending?: Task; // current open occurrence, if any
  doneCount: number;
  missedCount: number;
  occurrences: Task[];
}

export function groupRoutines(tasks: Task[]): RoutineSeries[] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.recurrenceRule === 'none') continue;
    const k = seriesKey(t);
    const list = map.get(k) || [];
    list.push(t);
    map.set(k, list);
  }
  return [...map.entries()].map(([key, occ]) => {
    const sorted = [...occ].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    const pendings = sorted.filter((t) => t.status === 'pending');
    return {
      key,
      latest: sorted[sorted.length - 1],
      pending: pendings[pendings.length - 1],
      doneCount: sorted.filter((t) => t.status === 'done').length,
      missedCount: sorted.filter((t) => t.status === 'missed').length,
      occurrences: sorted,
    };
  });
}

export const RULE_LABEL: Record<RoutineRule, string> = {
  daily: 'Every day',
  weekdays: 'Mon–Fri',
  weekly: 'Every week',
};

export interface RoutineTemplate {
  title: string;
  rule: RoutineRule;
  time: string; // HH:mm
  weekday?: number; // for weekly: 1 = Monday
  category: string;
}

/** Ready-made routines for a multi-venture Indian business owner. */
export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  { category: 'Fuel / Petrol Pump', title: 'Morning tank dip reading & stock entry', rule: 'daily', time: '07:00' },
  { category: 'Fuel / Petrol Pump', title: 'Daily cash & UPI reconciliation', rule: 'daily', time: '21:00' },
  { category: 'Fuel / Petrol Pump', title: 'Check nozzle totalizer vs sales report', rule: 'daily', time: '20:30' },
  { category: 'Fuel / Petrol Pump', title: 'Place fuel indent / plan next load', rule: 'weekdays', time: '11:00' },
  { category: 'Retail / Kirana', title: 'Review daily sales & close register', rule: 'daily', time: '21:30' },
  { category: 'Retail / Kirana', title: 'Reorder fast-moving stock', rule: 'weekly', time: '10:00', weekday: 1 },
  { category: 'Building Materials', title: 'Godown stock check (cement, TMT, AAC)', rule: 'weekly', time: '10:00', weekday: 6 },
  { category: 'Building Materials', title: 'Follow up on dealer & contractor payments', rule: 'weekly', time: '11:00', weekday: 1 },
  { category: 'Finance', title: 'Bank balance & receivables review', rule: 'weekly', time: '18:00', weekday: 5 },
  { category: 'Finance', title: 'Enter purchase & sales bills in Tally', rule: 'weekdays', time: '18:30' },
  { category: 'Team', title: 'Weekly staff meeting & targets', rule: 'weekly', time: '09:30', weekday: 1 },
  { category: 'Team', title: 'Daily sales update to partners (WhatsApp)', rule: 'daily', time: '21:45' },
  { category: 'Growth', title: 'Weekly review & plan next week', rule: 'weekly', time: '19:00', weekday: 0 },
];
