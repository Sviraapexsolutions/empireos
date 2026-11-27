import { generateRealityCheck, type CoachTrigger } from './aiCoach';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  SCHEMA_LIMITS,
  type AiProvider,
  type Business,
  type BusinessIconKey,
  type Habit,
  type HabitRecurrenceRule,
  type Project,
  type RealityCheckPayload,
  type RecurrenceRule,
  type Task,
  type TaskFile,
  type TaskFileKind,
  type TaskPriority,
  type TaskStatus,
  type TriggerReason,
  type UserProfile,
} from '../types/empire';
import { calculateHabitStreak, getTodayKey } from '../utils/dateUtils';
import { removeFileFromVault, saveFileToVault } from '../utils/fileVault';

function sanitizeString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function makeDocId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, SCHEMA_LIMITS.ID_MAX);
}

export const DEFAULT_BUSINESS_SEED: Array<{
  id: string;
  name: string;
  colorHex: string;
  icon: BusinessIconKey;
  sortOrder: number;
}> = [
  {
    id: 'biz_sundaram_fuel',
    name: 'Sundaram Mahadeo Fuel',
    colorHex: '#F59E0B',
    icon: 'fuel',
    sortOrder: 0,
  },
  {
    id: 'biz_sm_marketing',
    name: 'SM Marketing',
    colorHex: '#3B82F6',
    icon: 'megaphone',
    sortOrder: 1,
  },
  {
    id: 'biz_svira_apex',
    name: 'Svira Apex Solutions',
    colorHex: '#8B5CF6',
    icon: 'cpu',
    sortOrder: 2,
  },
  {
    id: 'biz_buildsphere_agni',
    name: 'Buildsphere & Agni BrickTech',
    colorHex: '#10B981',
    icon: 'building',
    sortOrder: 3,
  },
  {
    id: 'biz_kirana_court',
    name: 'Kirana Court',
    colorHex: '#14B8A6',
    icon: 'store',
    sortOrder: 4,
  },
  {
    id: 'biz_personal',
    name: 'Personal',
    colorHex: '#EF4444',
    icon: 'user',
    sortOrder: 5,
  },
];

const LEGACY_SAMPLE_PROJECT_IDS = new Set([
  'proj_fuel_station_exp',
  'proj_sm_q4_retainers',
  'proj_svira_erp',
  'proj_agni_kiln',
  'proj_kirana_flagship',
]);

const LEGACY_SAMPLE_TASK_IDS = new Set([
  'task_fuel_audit',
  'task_agni_foundation',
  'task_agni_pour',
  'task_sm_deck',
  'task_svira_sprint',
  'task_kirana_vendor',
]);

const LEGACY_SAMPLE_HABIT_IDS = new Set([
  'habit_strength',
  'habit_cashflow',
  'habit_deepwork',
  'habit_night_audit',
]);

async function purgeLegacySampleData(uid: string): Promise<void> {
  const [projSnap, taskSnap, habitSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'projects'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'tasks'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'users', uid, 'habits'), where('uid', '==', uid))),
  ]);

  const batch = writeBatch(db);
  let hasDeletes = false;

  projSnap.docs.forEach((d) => {
    if (LEGACY_SAMPLE_PROJECT_IDS.has(d.id)) {
      batch.delete(d.ref);
      hasDeletes = true;
    }
  });

  taskSnap.docs.forEach((d) => {
    if (LEGACY_SAMPLE_TASK_IDS.has(d.id)) {
      batch.delete(d.ref);
      hasDeletes = true;
    }
  });

  habitSnap.docs.forEach((d) => {
    if (LEGACY_SAMPLE_HABIT_IDS.has(d.id)) {
      batch.delete(d.ref);
      hasDeletes = true;
    }
  });

  if (hasDeletes) {
    await batch.commit();
  }
}

/**
 * Ensures root profile doc exists and seeds ONLY the 6 default color-coded Businesses
 * on first sign-in (with zero sample projects, tasks, or habits). Also removes any
 * previously seeded sample projects/tasks/habits so the user starts with a clean slate.
 */
export async function ensureUserSeeded(uid: string, displayName: string): Promise<void> {
  const profilePath = `users/${uid}`;
  try {
    const profileRef = doc(db, 'users', uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists() && (profileSnap.data() as UserProfile).seeded === true) {
      await purgeLegacySampleData(uid);
      return;
    }

    const existingBizSnap = await getDocs(
      query(collection(db, 'users', uid, 'businesses'), where('uid', '==', uid))
    );

    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid,
        displayName: sanitizeString(displayName || 'Founder', SCHEMA_LIMITS.DISPLAY_NAME_MAX),
        seeded: existingBizSnap.size > 0,
        morningBriefingEnabled: true,
        middayStallAlertEnabled: true,
        nightAuditEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (existingBizSnap.size > 0) {
      if (profileSnap.exists() && !(profileSnap.data() as UserProfile).seeded) {
        await updateDoc(profileRef, { seeded: true, updatedAt: serverTimestamp() });
      }
      await purgeLegacySampleData(uid);
      return;
    }

    // Seed ONLY the 6 core color-coded Businesses (zero sample projects, tasks, or habits)
    const bizBatch = writeBatch(db);
    for (const biz of DEFAULT_BUSINESS_SEED) {
      bizBatch.set(doc(db, 'users', uid, 'businesses', biz.id), {
        uid,
        name: biz.name,
        colorHex: biz.colorHex,
        icon: biz.icon,
        isActive: true,
        sortOrder: biz.sortOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    bizBatch.update(profileRef, { seeded: true, updatedAt: serverTimestamp() });
    await bizBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function updateNotificationPrefs(
  uid: string,
  prefs: {
    displayName: string;
    morningBriefingEnabled: boolean;
    middayStallAlertEnabled: boolean;
    nightAuditEnabled: boolean;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: sanitizeString(prefs.displayName || 'Founder', SCHEMA_LIMITS.DISPLAY_NAME_MAX),
      morningBriefingEnabled: prefs.morningBriefingEnabled,
      middayStallAlertEnabled: prefs.middayStallAlertEnabled,
      nightAuditEnabled: prefs.nightAuditEnabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserProfileSettings(
  uid: string,
  input: {
    displayName: string;
    username: string;
    bio: string;
    avatarFileId: string;
    aiProvider: AiProvider;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const cleanUsername = input.username
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, SCHEMA_LIMITS.USERNAME_MAX);
  const cleanAvatarId =
    input.avatarFileId && SCHEMA_LIMITS.ID_REGEX.test(input.avatarFileId)
      ? input.avatarFileId.slice(0, SCHEMA_LIMITS.ID_MAX)
      : '';
  const provider: AiProvider = input.aiProvider === 'claude' ? 'claude' : 'gemini';

  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: sanitizeString(input.displayName || 'Founder', SCHEMA_LIMITS.DISPLAY_NAME_MAX),
      username: cleanUsername,
      bio: sanitizeString(input.bio || '', SCHEMA_LIMITS.BIO_MAX),
      avatarFileId: cleanAvatarId,
      aiProvider: provider,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- BUSINESSES CRUD ---
export async function createBusiness(
  uid: string,
  input: { name: string; colorHex: string; icon: BusinessIconKey; sortOrder: number }
): Promise<string> {
  const id = makeDocId('biz');
  const path = `users/${uid}/businesses/${id}`;
  const color = SCHEMA_LIMITS.COLOR_HEX_REGEX.test(input.colorHex) ? input.colorHex : '#F59E0B';
  try {
    await setDoc(doc(db, 'users', uid, 'businesses', id), {
      uid,
      name: sanitizeString(input.name, SCHEMA_LIMITS.BUSINESS_NAME_MAX) || 'New Venture',
      colorHex: color,
      icon: input.icon,
      isActive: true,
      sortOrder: Math.max(0, Math.min(10000, Math.round(input.sortOrder))),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBusiness(
  uid: string,
  businessId: string,
  input: { name: string; colorHex: string; icon: BusinessIconKey; sortOrder: number }
): Promise<void> {
  const path = `users/${uid}/businesses/${businessId}`;
  const color = SCHEMA_LIMITS.COLOR_HEX_REGEX.test(input.colorHex) ? input.colorHex : '#F59E0B';
  try {
    await updateDoc(doc(db, 'users', uid, 'businesses', businessId), {
      name: sanitizeString(input.name, SCHEMA_LIMITS.BUSINESS_NAME_MAX) || 'Venture',
      colorHex: color,
      icon: input.icon,
      sortOrder: Math.max(0, Math.min(10000, Math.round(input.sortOrder))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleBusinessActive(
  uid: string,
  businessId: string,
  isActive: boolean
): Promise<void> {
  const path = `users/${uid}/businesses/${businessId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'businesses', businessId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBusinessCascade(uid: string, businessId: string): Promise<void> {
  const path = `users/${uid}/businesses/${businessId}`;
  try {
    const [projSnap, taskSnap, habitSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', uid, 'projects'), where('uid', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'tasks'), where('uid', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'habits'), where('uid', '==', uid))),
    ]);

    const refsToDelete = [
      ...projSnap.docs.filter((d) => (d.data() as Project).businessId === businessId).map((d) => d.ref),
      ...taskSnap.docs.filter((d) => (d.data() as Task).businessId === businessId).map((d) => d.ref),
      ...habitSnap.docs.filter((d) => (d.data() as Habit).businessId === businessId).map((d) => d.ref),
      doc(db, 'users', uid, 'businesses', businessId),
    ];

    for (let i = 0; i < refsToDelete.length; i += 400) {
      const batch = writeBatch(db);
      refsToDelete.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- PROJECTS CRUD ---
export async function createProject(
  uid: string,
  input: { businessId: string; name: string; phaseHeadings: string[]; targetDate: string }
): Promise<string> {
  const id = makeDocId('proj');
  const path = `users/${uid}/projects/${id}`;
  const cleanPhases = input.phaseHeadings
    .map((p) => sanitizeString(p, SCHEMA_LIMITS.PHASE_HEADING_LENGTH_MAX))
    .filter(Boolean)
    .slice(0, SCHEMA_LIMITS.PHASE_HEADINGS_MAX);
  const targetDate = SCHEMA_LIMITS.DATE_REGEX.test(input.targetDate) ? input.targetDate : '';
  try {
    await setDoc(doc(db, 'users', uid, 'projects', id), {
      uid,
      businessId: input.businessId,
      name: sanitizeString(input.name, SCHEMA_LIMITS.PROJECT_NAME_MAX) || 'New Project',
      phaseHeadings: cleanPhases,
      targetDate,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProject(
  uid: string,
  projectId: string,
  input: { name: string; phaseHeadings: string[]; targetDate: string }
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  const cleanPhases = input.phaseHeadings
    .map((p) => sanitizeString(p, SCHEMA_LIMITS.PHASE_HEADING_LENGTH_MAX))
    .filter(Boolean)
    .slice(0, SCHEMA_LIMITS.PHASE_HEADINGS_MAX);
  const targetDate = SCHEMA_LIMITS.DATE_REGEX.test(input.targetDate) ? input.targetDate : '';
  try {
    await updateDoc(doc(db, 'users', uid, 'projects', projectId), {
      name: sanitizeString(input.name, SCHEMA_LIMITS.PROJECT_NAME_MAX) || 'Project',
      phaseHeadings: cleanPhases,
      targetDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleProjectArchived(
  uid: string,
  projectId: string,
  isArchived: boolean
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'projects', projectId), {
      isArchived,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProjectCascade(
  uid: string,
  projectId: string,
  mode: 'unlink' | 'delete-tasks' = 'unlink'
): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    const taskSnap = await getDocs(
      query(collection(db, 'users', uid, 'tasks'), where('uid', '==', uid))
    );
    const childTasks = taskSnap.docs.filter((d) => (d.data() as Task).projectId === projectId);

    for (let i = 0; i < childTasks.length; i += 400) {
      const batch = writeBatch(db);
      childTasks.slice(i, i + 400).forEach((d) => {
        if (mode === 'delete-tasks') {
          batch.delete(d.ref);
        } else {
          batch.update(d.ref, {
            projectId: '',
            phaseHeading: '',
            updatedAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
    }

    await deleteDoc(doc(db, 'users', uid, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- TASKS CRUD ---
function sanitizeAttachmentIds(ids?: string[]): string[] {
  if (!ids || ids.length === 0) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of ids) {
    if (
      typeof raw === 'string' &&
      raw.length >= 1 &&
      raw.length <= SCHEMA_LIMITS.ID_MAX &&
      SCHEMA_LIMITS.ID_REGEX.test(raw) &&
      !seen.has(raw)
    ) {
      seen.add(raw);
      clean.push(raw);
      if (clean.length >= SCHEMA_LIMITS.ATTACHMENTS_MAX) break;
    }
  }
  return clean;
}

export interface TaskInput {
  title: string;
  businessId: string;
  projectId?: string;
  phaseHeading?: string;
  scheduledDate: string;
  scheduledTime?: string;
  hardDeadline?: string;
  priority?: TaskPriority;
  isMilestone?: boolean;
  blockedByTaskId?: string;
  isHabit?: boolean;
  recurrenceRule?: RecurrenceRule;
  attachmentIds?: string[];
}

export async function createTask(uid: string, input: TaskInput): Promise<string> {
  const id = makeDocId('task');
  const path = `users/${uid}/tasks/${id}`;
  const scheduledDate = SCHEMA_LIMITS.DATE_REGEX.test(input.scheduledDate)
    ? input.scheduledDate
    : getTodayKey();
  const scheduledTime =
    input.scheduledTime && SCHEMA_LIMITS.TIME_REGEX.test(input.scheduledTime)
      ? input.scheduledTime
      : '';
  const hardDeadline =
    input.hardDeadline && SCHEMA_LIMITS.DATE_REGEX.test(input.hardDeadline)
      ? input.hardDeadline
      : '';
  const attachmentIds = sanitizeAttachmentIds(input.attachmentIds);

  try {
    await setDoc(doc(db, 'users', uid, 'tasks', id), {
      uid,
      title: sanitizeString(input.title, SCHEMA_LIMITS.TASK_TITLE_MAX) || 'Untitled Action',
      businessId: input.businessId,
      projectId: input.projectId || '',
      phaseHeading: sanitizeString(input.phaseHeading || '', SCHEMA_LIMITS.PHASE_HEADING_LENGTH_MAX),
      scheduledDate,
      scheduledTime,
      hardDeadline,
      priority: input.priority === 'high' ? 'high' : 'standard',
      isMilestone: Boolean(input.isMilestone),
      blockedByTaskId: input.blockedByTaskId || '',
      isHabit: Boolean(input.isHabit),
      recurrenceRule: input.recurrenceRule || 'none',
      streakCount: 0,
      status: 'pending',
      completedAt: '',
      attachmentIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTaskDetails(
  uid: string,
  taskId: string,
  input: TaskInput
): Promise<void> {
  const path = `users/${uid}/tasks/${taskId}`;
  const scheduledDate = SCHEMA_LIMITS.DATE_REGEX.test(input.scheduledDate)
    ? input.scheduledDate
    : getTodayKey();
  const scheduledTime =
    input.scheduledTime && SCHEMA_LIMITS.TIME_REGEX.test(input.scheduledTime)
      ? input.scheduledTime
      : '';
  const hardDeadline =
    input.hardDeadline && SCHEMA_LIMITS.DATE_REGEX.test(input.hardDeadline)
      ? input.hardDeadline
      : '';
  const attachmentIds = sanitizeAttachmentIds(input.attachmentIds);

  try {
    await updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
      title: sanitizeString(input.title, SCHEMA_LIMITS.TASK_TITLE_MAX) || 'Untitled Action',
      businessId: input.businessId,
      projectId: input.projectId || '',
      phaseHeading: sanitizeString(input.phaseHeading || '', SCHEMA_LIMITS.PHASE_HEADING_LENGTH_MAX),
      scheduledDate,
      scheduledTime,
      hardDeadline,
      priority: input.priority === 'high' ? 'high' : 'standard',
      isMilestone: Boolean(input.isMilestone),
      blockedByTaskId: input.blockedByTaskId === taskId ? '' : input.blockedByTaskId || '',
      isHabit: Boolean(input.isHabit),
      recurrenceRule: input.recurrenceRule || 'none',
      attachmentIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskStatus(
  uid: string,
  task: Task,
  nextStatus: TaskStatus
): Promise<void> {
  const path = `users/${uid}/tasks/${task.id}`;
  const nextStreak =
    nextStatus === 'done'
      ? task.isHabit
        ? task.streakCount + 1
        : task.streakCount
      : Math.max(0, task.isHabit && task.status === 'done' ? task.streakCount - 1 : task.streakCount);

  try {
    await updateDoc(doc(db, 'users', uid, 'tasks', task.id), {
      status: nextStatus,
      completedAt: nextStatus === 'done' ? new Date().toISOString() : '',
      streakCount: nextStreak,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function rescheduleTask(
  uid: string,
  taskId: string,
  scheduledDate: string,
  scheduledTime: string
): Promise<void> {
  const path = `users/${uid}/tasks/${taskId}`;
  const cleanDate = SCHEMA_LIMITS.DATE_REGEX.test(scheduledDate) ? scheduledDate : getTodayKey();
  const cleanTime = SCHEMA_LIMITS.TIME_REGEX.test(scheduledTime) ? scheduledTime : '';
  try {
    await updateDoc(doc(db, 'users', uid, 'tasks', taskId), {
      scheduledDate: cleanDate,
      scheduledTime: cleanTime,
      status: 'pending',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTask(uid: string, taskId: string): Promise<void> {
  const path = `users/${uid}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- HABITS CRUD ---
export async function createHabit(
  uid: string,
  input: {
    title: string;
    businessId: string;
    scheduledTime?: string;
    recurrenceRule: HabitRecurrenceRule;
  }
): Promise<string> {
  const id = makeDocId('habit');
  const path = `users/${uid}/habits/${id}`;
  const scheduledTime =
    input.scheduledTime && SCHEMA_LIMITS.TIME_REGEX.test(input.scheduledTime)
      ? input.scheduledTime
      : '';
  try {
    await setDoc(doc(db, 'users', uid, 'habits', id), {
      uid,
      title: sanitizeString(input.title, SCHEMA_LIMITS.HABIT_TITLE_MAX) || 'Daily Habit',
      businessId: input.businessId,
      scheduledTime,
      recurrenceRule: input.recurrenceRule,
      streakCount: 0,
      completedDates: [],
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateHabit(
  uid: string,
  habitId: string,
  input: {
    title: string;
    businessId: string;
    scheduledTime?: string;
    recurrenceRule: HabitRecurrenceRule;
    isActive: boolean;
  }
): Promise<void> {
  const path = `users/${uid}/habits/${habitId}`;
  const scheduledTime =
    input.scheduledTime && SCHEMA_LIMITS.TIME_REGEX.test(input.scheduledTime)
      ? input.scheduledTime
      : '';
  try {
    await updateDoc(doc(db, 'users', uid, 'habits', habitId), {
      title: sanitizeString(input.title, SCHEMA_LIMITS.HABIT_TITLE_MAX) || 'Daily Habit',
      businessId: input.businessId,
      scheduledTime,
      recurrenceRule: input.recurrenceRule,
      isActive: input.isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleHabitDate(
  uid: string,
  habit: Habit,
  dateKey: string
): Promise<void> {
  const path = `users/${uid}/habits/${habit.id}`;
  const exists = habit.completedDates.includes(dateKey);
  const updatedDates = exists
    ? habit.completedDates.filter((d) => d !== dateKey)
    : [...habit.completedDates, dateKey].sort().slice(-SCHEMA_LIMITS.HABIT_DATES_MAX);
  const nextStreak = calculateHabitStreak(updatedDates);

  try {
    await updateDoc(doc(db, 'users', uid, 'habits', habit.id), {
      completedDates: updatedDates,
      streakCount: nextStreak,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHabit(uid: string, habitId: string): Promise<void> {
  const path = `users/${uid}/habits/${habitId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'habits', habitId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- REUSABLE TASK FILE LIBRARY (PDFs & PHOTOS) ---
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export async function uploadTaskFile(uid: string, file: File): Promise<TaskFile> {
  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    throw new Error('Only PDF documents and images (PNG, JPG, WebP, GIF) are supported.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds the 12 MB maximum upload limit.');
  }

  const fileId = makeDocId('file');
  const cleanName = sanitizeString(file.name || 'Attachment', SCHEMA_LIMITS.FILE_NAME_MAX) || 'Attachment';
  const kind: TaskFileKind =
    mimeType === 'application/pdf' ? 'pdf' : mimeType.startsWith('image/') ? 'image' : 'file';

  await saveFileToVault(fileId, file, cleanName, mimeType);

  const path = `users/${uid}/files/${fileId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'files', fileId), {
      uid,
      name: cleanName,
      mimeType,
      kind,
      sizeBytes: Math.max(0, Math.round(file.size)),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    id: fileId,
    uid,
    name: cleanName,
    mimeType,
    kind,
    sizeBytes: Math.max(0, Math.round(file.size)),
  };
}

export async function deleteTaskFile(uid: string, fileId: string): Promise<void> {
  const path = `users/${uid}/files/${fileId}`;
  try {
    const taskSnap = await getDocs(
      query(collection(db, 'users', uid, 'tasks'), where('uid', '==', uid))
    );
    const affectedTasks = taskSnap.docs.filter((d) => {
      const ids = (d.data() as Task).attachmentIds;
      return Array.isArray(ids) && ids.includes(fileId);
    });

    for (let i = 0; i < affectedTasks.length; i += 400) {
      const batch = writeBatch(db);
      affectedTasks.slice(i, i + 400).forEach((d) => {
        const currentIds = (d.data() as Task).attachmentIds || [];
        batch.update(d.ref, {
          attachmentIds: currentIds.filter((id) => id !== fileId),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    await deleteDoc(doc(db, 'users', uid, 'files', fileId));
    await removeFileFromVault(fileId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- ACCOUNTABILITY COACH ENGINE ---
export async function requestRealityCheckAndSave(params: {
  uid: string;
  taskId: string;
  taskTitle: string;
  businessName: string;
  projectName?: string;
  completionPercent: number;
  triggerReason: TriggerReason;
  provider?: AiProvider;
}): Promise<RealityCheckPayload & { id: string }> {
  const payload: RealityCheckPayload = await generateRealityCheck({
    taskTitle: params.taskTitle,
    businessName: params.businessName,
    projectName: params.projectName || '',
    completionPercent: params.completionPercent,
    triggerReason: params.triggerReason as CoachTrigger,
    provider: params.provider || 'gemini',
  });
  const logId = makeDocId('coach');
  const path = `users/${params.uid}/coachLogs/${logId}`;

  try {
    await setDoc(doc(db, 'users', params.uid, 'coachLogs', logId), {
      uid: params.uid,
      taskId: params.taskId || '',
      taskTitle: sanitizeString(params.taskTitle, SCHEMA_LIMITS.TASK_TITLE_MAX),
      businessName: sanitizeString(params.businessName, SCHEMA_LIMITS.BUSINESS_NAME_MAX),
      triggerReason: params.triggerReason,
      completionPercent: Math.max(0, Math.min(100, Math.round(params.completionPercent))),
      wakeUpCall: sanitizeString(payload.wakeUpCall, SCHEMA_LIMITS.WAKE_UP_CALL_MAX),
      quote: sanitizeString(payload.quote, SCHEMA_LIMITS.QUOTE_MAX),
      quoteAuthor: sanitizeString(payload.quoteAuthor, SCHEMA_LIMITS.QUOTE_AUTHOR_MAX),
      tacticalBreakdown: sanitizeString(
        payload.tacticalBreakdown,
        SCHEMA_LIMITS.TACTICAL_BREAKDOWN_MAX
      ),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return { ...payload, id: logId };
}

export async function deleteCoachLog(uid: string, logId: string): Promise<void> {
  const path = `users/${uid}/coachLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'coachLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearWorkspaceItems(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    const [projSnap, taskSnap, habitSnap, logSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', uid, 'projects'), where('uid', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'tasks'), where('uid', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'habits'), where('uid', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'coachLogs'), where('uid', '==', uid))),
    ]);

    const refs = [
      ...projSnap.docs.map((d) => d.ref),
      ...taskSnap.docs.map((d) => d.ref),
      ...habitSnap.docs.map((d) => d.ref),
      ...logSnap.docs.map((d) => d.ref),
    ];

    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function getBusinessMap(businesses: Business[]): Map<string, Business> {
  return new Map(businesses.map((b) => [b.id, b]));
}

export function getProjectMap(projects: Project[]): Map<string, Project> {
  return new Map(projects.map((p) => [p.id, p]));
}

// --- BULK ACTIONS & CLOSING FINISHED WORK ---

/** Marks every pending task in the list as done (batched). */
export async function completeTasks(uid: string, list: Task[]): Promise<void> {
  const pending = list.filter((t) => t.status !== 'done');
  const nowIso = new Date().toISOString();
  for (let i = 0; i < pending.length; i += 400) {
    const batch = writeBatch(db);
    pending.slice(i, i + 400).forEach((t) => {
      batch.update(doc(db, 'users', uid, 'tasks', t.id), {
        status: 'done',
        completedAt: nowIso,
        streakCount: t.isHabit ? t.streakCount + 1 : t.streakCount,
        updatedAt: serverTimestamp(),
      });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/tasks`);
    }
  }
}

/** Closes a finished project: optionally completes remaining tasks, then archives it. */
export async function closeProject(
  uid: string,
  project: Project,
  allTasks: Task[],
  completeRemaining: boolean
): Promise<void> {
  if (completeRemaining) {
    await completeTasks(uid, allTasks.filter((t) => t.projectId === project.id));
  }
  if (!project.isArchived) await toggleProjectArchived(uid, project.id, true);
}

/** Closes a finished business: optionally completes remaining tasks, archives its projects, deactivates it. */
export async function closeBusiness(
  uid: string,
  business: Business,
  allProjects: Project[],
  allTasks: Task[],
  completeRemaining: boolean
): Promise<void> {
  if (completeRemaining) {
    await completeTasks(uid, allTasks.filter((t) => t.businessId === business.id && !t.isHabit));
  }
  for (const p of allProjects.filter((p) => p.businessId === business.id && !p.isArchived)) {
    await toggleProjectArchived(uid, p.id, true);
  }
  if (business.isActive) await toggleBusinessActive(uid, business.id, false);
}

export interface BulkSelection {
  businessIds: string[];
  projectIds: string[];
  taskIds: string[];
}

/** Deletes everything selected. Projects inside a deleted business and tasks inside a deleted project are handled by the cascades. */
export async function bulkDelete(
  uid: string,
  sel: BulkSelection,
  allProjects: Project[],
  allTasks: Task[],
  projectTaskMode: 'unlink' | 'delete-tasks'
): Promise<void> {
  const bizSet = new Set(sel.businessIds);
  for (const id of sel.businessIds) await deleteBusinessCascade(uid, id);

  const projects = sel.projectIds
    .map((id) => allProjects.find((p) => p.id === id))
    .filter((p): p is Project => Boolean(p) && !bizSet.has(p!.businessId));
  const projSet = new Set(projects.map((p) => p.id));
  for (const p of projects) await deleteProjectCascade(uid, p.id, projectTaskMode);

  const taskIds = sel.taskIds.filter((id) => {
    const t = allTasks.find((x) => x.id === id);
    if (!t) return false;
    if (bizSet.has(t.businessId)) return false;
    if (projectTaskMode === 'delete-tasks' && projSet.has(t.projectId)) return false;
    return true;
  });
  for (let i = 0; i < taskIds.length; i += 400) {
    const batch = writeBatch(db);
    taskIds.slice(i, i + 400).forEach((id) => batch.delete(doc(db, 'users', uid, 'tasks', id)));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/tasks`);
    }
  }
}
