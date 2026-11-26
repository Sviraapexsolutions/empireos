export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return toDateKey(dt);
}

export function formatReadableDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatShortDate(dateKey: string): string {
  const today = getTodayKey();
  if (dateKey === today) return 'Today';
  if (dateKey === addDays(today, 1)) return 'Tomorrow';
  if (dateKey === addDays(today, -1)) return 'Yesterday';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatTime12h(hhmm: string): string {
  if (!hhmm || !hhmm.includes(':')) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getCurrentHHmm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function isTimePassedToday(scheduledDate: string, scheduledTime: string): boolean {
  if (!scheduledTime) return false;
  const today = getTodayKey();
  if (scheduledDate < today) return true;
  if (scheduledDate > today) return false;
  return scheduledTime < getCurrentHHmm();
}

export function getLast7DateKeys(): { dateKey: string; dayLabel: string; dayNum: string }[] {
  const today = getTodayKey();
  const result: { dateKey: string; dayLabel: string; dayNum: string }[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const key = addDays(today, offset);
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    result.push({
      dateKey: key,
      dayLabel: dt.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
      dayNum: String(d),
    });
  }
  return result;
}

export function calculateHabitStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  const today = getTodayKey();
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;

  let streak = 0;
  while (set.has(cursor) && streak < 366) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface CalendarCell {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  // Start week on Monday (0 = Mon ... 6 = Sun)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const startDate = new Date(year, monthIndex, 1 - startOffset);
  const todayKey = getTodayKey();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const key = toDateKey(dt);
    cells.push({
      dateKey: key,
      dayNumber: dt.getDate(),
      isCurrentMonth: dt.getMonth() === monthIndex,
      isToday: key === todayKey,
    });
  }
  return cells;
}

export function triggerHaptic(pattern: number | number[] = 14): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore on unsupported browsers
  }
}
