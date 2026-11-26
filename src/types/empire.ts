import type { Timestamp } from 'firebase/firestore';

export type BusinessIconKey =
  | 'fuel'
  | 'megaphone'
  | 'cpu'
  | 'building'
  | 'store'
  | 'user'
  | 'briefcase'
  | 'shield'
  | 'globe'
  | 'zap';

export type TaskPriority = 'high' | 'standard';
export type RecurrenceRule = 'none' | 'daily' | 'weekdays' | 'weekly';
export type HabitRecurrenceRule = 'daily' | 'weekdays' | 'weekly';
export type TaskStatus = 'pending' | 'done' | 'missed';
export type TriggerReason = 'overdue' | 'rescheduled' | 'missed' | 'manual';
export type TabId = 'dashboard' | 'today' | 'calendar' | 'ventures' | 'habits' | 'settings';
export type AiProvider = 'gemini' | 'claude';
export type TaskFileKind = 'pdf' | 'image' | 'file';

/**
 * Verbatim schema limits synchronized with firebase-blueprint.json & firestore.rules.
 */
export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MAX: 100,
  USERNAME_MAX: 40,
  USERNAME_REGEX: /^[a-zA-Z0-9_.-]+$/,
  BIO_MAX: 240,
  BUSINESS_NAME_MAX: 80,
  COLOR_HEX_REGEX: /^#[0-9A-Fa-f]{6}$/,
  PROJECT_NAME_MAX: 100,
  PHASE_HEADINGS_MAX: 20,
  PHASE_HEADING_LENGTH_MAX: 80,
  TASK_TITLE_MAX: 200,
  ATTACHMENTS_MAX: 10,
  FILE_NAME_MAX: 160,
  HABIT_TITLE_MAX: 160,
  HABIT_DATES_MAX: 366,
  DATE_REGEX: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  TIME_REGEX: /^([0-2][0-9]:[0-5][0-9])$/,
  WAKE_UP_CALL_MAX: 1000,
  QUOTE_MAX: 600,
  QUOTE_AUTHOR_MAX: 120,
  TACTICAL_BREAKDOWN_MAX: 1200,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  bio?: string;
  avatarFileId?: string;
  aiProvider?: AiProvider;
  seeded: boolean;
  morningBriefingEnabled: boolean;
  middayStallAlertEnabled: boolean;
  nightAuditEnabled: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Business {
  id: string;
  uid: string;
  name: string;
  colorHex: string;
  icon: BusinessIconKey;
  isActive: boolean;
  sortOrder: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Project {
  id: string;
  uid: string;
  businessId: string;
  name: string;
  phaseHeadings: string[];
  targetDate: string; // "" or YYYY-MM-DD
  isArchived: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Task {
  id: string;
  uid: string;
  title: string;
  businessId: string;
  projectId: string; // "" if unassigned
  phaseHeading: string; // "" if unassigned
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // "" or HH:mm
  hardDeadline: string; // "" or YYYY-MM-DD
  priority: TaskPriority;
  isMilestone: boolean;
  blockedByTaskId: string; // "" if unblocked
  isHabit: boolean;
  recurrenceRule: RecurrenceRule;
  streakCount: number;
  status: TaskStatus;
  completedAt: string; // "" or ISO timestamp
  attachmentIds?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TaskFile {
  id: string;
  uid: string;
  name: string;
  mimeType: string;
  kind: TaskFileKind;
  sizeBytes: number;
  createdAt?: Timestamp;
}

export interface Habit {
  id: string;
  uid: string;
  title: string;
  businessId: string;
  scheduledTime: string; // "" or HH:mm
  recurrenceRule: HabitRecurrenceRule;
  streakCount: number;
  completedDates: string[]; // YYYY-MM-DD[]
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CoachLog {
  id: string;
  uid: string;
  taskId: string;
  taskTitle: string;
  businessName: string;
  triggerReason: TriggerReason;
  completionPercent: number;
  wakeUpCall: string;
  quote: string;
  quoteAuthor: string;
  tacticalBreakdown: string;
  createdAt?: Timestamp;
}

export interface RealityCheckPayload {
  wakeUpCall: string;
  quote: string;
  quoteAuthor: string;
  tacticalBreakdown: string;
}

export interface ExecutiveAlert {
  id: string;
  kind: 'briefing' | 'stall' | 'audit' | 'reminder';
  title: string;
  body: string;
  timestamp: string;
}
