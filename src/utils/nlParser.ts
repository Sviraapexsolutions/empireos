import type { Business, Project, RecurrenceRule, TaskPriority } from '../types/empire';
import { addDays, getTodayKey } from './dateUtils';

export interface ParsedQuickAdd {
  cleanTitle: string;
  business: Business | null;
  project: Project | null;
  priority: TaskPriority;
  isMilestone: boolean;
  scheduledDate: string;
  scheduledTime: string;
  recurrenceRule: RecurrenceRule;
  isHabit: boolean;
  hasExplicitDate: boolean;
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

function nextWeekdayDateKey(targetDay: number): string {
  const now = new Date();
  const currentDay = now.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  return addDays(getTodayKey(), diff);
}

function normalizeMatchText(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchBusiness(query: string, businesses: Business[]): Business | null {
  const q = normalizeMatchText(query);
  if (!q) return null;
  const active = businesses.filter((b) => b.isActive);
  // 1. Exact or prefix on normalized full name
  const exact = active.find((b) => normalizeMatchText(b.name) === q);
  if (exact) return exact;
  // 2. Any word starts with query
  const wordPrefix = active.find((b) =>
    b.name
      .toLowerCase()
      .split(/[\s&-]+/)
      .some((w) => w.startsWith(q))
  );
  if (wordPrefix) return wordPrefix;
  // 3. Substring match
  return active.find((b) => normalizeMatchText(b.name).includes(q)) ?? null;
}

function matchProject(
  query: string,
  projects: Project[],
  preferredBusinessId?: string
): Project | null {
  const q = normalizeMatchText(query);
  if (!q) return null;
  const active = projects.filter((p) => !p.isArchived);
  const scoped = preferredBusinessId
    ? [...active.filter((p) => p.businessId === preferredBusinessId), ...active.filter((p) => p.businessId !== preferredBusinessId)]
    : active;

  const exact = scoped.find((p) => normalizeMatchText(p.name) === q);
  if (exact) return exact;
  const wordPrefix = scoped.find((p) =>
    p.name
      .toLowerCase()
      .split(/[\s&-]+/)
      .some((w) => w.startsWith(q))
  );
  if (wordPrefix) return wordPrefix;
  return scoped.find((p) => normalizeMatchText(p.name).includes(q)) ?? null;
}

function parse12hOr24h(hourRaw: number, minuteRaw: number, meridiem?: string): string | null {
  let hour = hourRaw;
  if (meridiem) {
    const mer = meridiem.toLowerCase();
    if (hour < 1 || hour > 12) return null;
    if (mer === 'pm' && hour !== 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
  } else {
    if (hour < 0 || hour > 23) return null;
  }
  if (minuteRaw < 0 || minuteRaw > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minuteRaw).padStart(2, '0')}`;
}

export function parseQuickAddInput(
  rawInput: string,
  businesses: Business[],
  projects: Project[],
  defaultDate?: string
): ParsedQuickAdd {
  let working = rawInput;
  let business: Business | null = null;
  let project: Project | null = null;
  let priority: TaskPriority = 'standard';
  let isMilestone = false;
  let scheduledDate = defaultDate || getTodayKey();
  let scheduledTime = '';
  let recurrenceRule: RecurrenceRule = 'none';
  let isHabit = false;
  let hasExplicitDate = false;

  // 1. Parse #BusinessName (supports quoted #"Sundaram Fuel" or single-token #Fuel)
  working = working.replace(/#(?:"([^"]+)"|([a-zA-Z0-9_-]+))/g, (full, quoted, token) => {
    const matched = matchBusiness(quoted || token, businesses);
    if (matched) {
      business = matched;
      return '';
    }
    return full;
  });

  // 2. Parse @ProjectName
  working = working.replace(/@(?:"([^"]+)"|([a-zA-Z0-9_-]+))/g, (full, quoted, token) => {
    const matched = matchProject(quoted || token, projects, business?.id);
    if (matched) {
      project = matched;
      if (!business) {
        business = businesses.find((b) => b.id === matched.businessId) ?? null;
      }
      return '';
    }
    return full;
  });

  // 3. Priority flag !high
  if (/(^|\s)!high(?=\s|$)/i.test(working)) {
    priority = 'high';
    working = working.replace(/(^|\s)!high(?=\s|$)/gi, ' ');
  }

  // 4. Milestone flag *milestone
  if (/(^|\s)\*milestone(?=\s|$)/i.test(working)) {
    isMilestone = true;
    working = working.replace(/(^|\s)\*milestone(?=\s|$)/gi, ' ');
  }

  // 5. Recurrence phrases: "every day", "daily", "every weekday", "weekdays", "every week", "weekly"
  if (/\b(?:every\s+day|everyday|daily)\b/i.test(working)) {
    recurrenceRule = 'daily';
    isHabit = true;
    working = working.replace(/\b(?:every\s+day|everyday|daily)\b/gi, ' ');
  } else if (/\b(?:every\s+weekday|weekdays)\b/i.test(working)) {
    recurrenceRule = 'weekdays';
    isHabit = true;
    working = working.replace(/\b(?:every\s+weekday|weekdays)\b/gi, ' ');
  } else if (/\b(?:every\s+week|weekly)\b/i.test(working)) {
    recurrenceRule = 'weekly';
    isHabit = true;
    working = working.replace(/\b(?:every\s+week|weekly)\b/gi, ' ');
  }

  // 6. Explicit ISO date YYYY-MM-DD
  working = working.replace(/\b(\d{4}-\d{2}-\d{2})\b/, (_, iso) => {
    scheduledDate = iso;
    hasExplicitDate = true;
    return ' ';
  });

  // 7. Relative date words: today, tomorrow, tmrw, weekdays
  if (/\b(?:tomorrow|tmrw)\b/i.test(working)) {
    scheduledDate = addDays(getTodayKey(), 1);
    hasExplicitDate = true;
    working = working.replace(/\b(?:tomorrow|tmrw)\b/gi, ' ');
  } else if (/\btoday\b/i.test(working)) {
    scheduledDate = getTodayKey();
    hasExplicitDate = true;
    working = working.replace(/\btoday\b/gi, ' ');
  } else {
    const weekdayRegex =
      /\b(?:next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/i;
    const match = working.match(weekdayRegex);
    if (match) {
      const target = WEEKDAY_MAP[match[1].toLowerCase()];
      if (target !== undefined) {
        scheduledDate = nextWeekdayDateKey(target);
        hasExplicitDate = true;
        working = working.replace(weekdayRegex, ' ');
      }
    }
  }

  // 8. Time expressions: 5pm, 7:30am, 14:30, at 6pm
  const time12Regex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const time12Match = working.match(time12Regex);
  if (time12Match) {
    const parsed = parse12hOr24h(Number(time12Match[1]), Number(time12Match[2] || 0), time12Match[3]);
    if (parsed) {
      scheduledTime = parsed;
      working = working.replace(time12Regex, ' ');
    }
  } else {
    const time24Regex = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i;
    const time24Match = working.match(time24Regex);
    if (time24Match) {
      const parsed = parse12hOr24h(Number(time24Match[1]), Number(time24Match[2]));
      if (parsed) {
        scheduledTime = parsed;
        working = working.replace(time24Regex, ' ');
      }
    }
  }

  const cleanTitle = working.replace(/\s+/g, ' ').trim();

  return {
    cleanTitle,
    business,
    project,
    priority,
    isMilestone,
    scheduledDate,
    scheduledTime,
    recurrenceRule,
    isHabit,
    hasExplicitDate,
  };
}
