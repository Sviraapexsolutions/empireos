/**
 * Cross-platform notifications for EmpireOS.
 *
 * - Android APK (Capacitor): reminders are scheduled on the phone with the LocalNotifications
 *   plugin, so they fire even when the app is closed.
 * - Web / iPhone home-screen app: notifications are shown through the service worker
 *   (the only method iOS and Android browsers support) while the app is running.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from '../config/appConfig';
import type { Task } from '../types/empire';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationsSupported(): boolean {
  if (isNativeApp()) return true;
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function getNotificationPermission(): Promise<NotifPermission> {
  if (isNativeApp()) {
    try {
      const res = await LocalNotifications.checkPermissions();
      return res.display === 'granted' ? 'granted' : res.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifPermission;
}

export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (isNativeApp()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifPermission;
  } catch {
    return 'denied';
  }
}

/** Show a notification right now (used for in-app reminders and test alerts). */
export async function showNotificationNow(title: string, body: string, tag?: string): Promise<void> {
  if (isNativeApp()) {
    try {
      await LocalNotifications.schedule({
        notifications: [{ id: Math.floor(Math.random() * 1_000_000) + 1_000_000, title, body }],
      });
    } catch {
      // ignore
    }
    return;
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const options: NotificationOptions = {
    body,
    tag: tag || `empireos-${title}`,
    icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
    badge: `${import.meta.env.BASE_URL}pwa-192x192.png`,
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch {
    // Some browsers block the Notification constructor; nothing else to do.
  }
}

// ---------------------------------------------------------------------------
// Android: schedule reminders on the device so they fire while the app is closed
// ---------------------------------------------------------------------------

const DAILY_IDS = { briefing: 900001, stall: 900002, audit: 900003 } as const;
const MAX_TASK_REMINDERS = 60;

function taskNotifId(taskId: string, date: string): number {
  let h = 0;
  const s = `${taskId}_${date}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 800000) + 1; // 1..800000, never clashes with daily ids
}

export interface CadencePrefs {
  morningBriefingEnabled: boolean;
  middayStallAlertEnabled: boolean;
  nightAuditEnabled: boolean;
}

let lastSignature = '';

/**
 * Re-schedules all upcoming reminders on Android. Safe to call often; it only
 * touches the OS when something actually changed.
 */
export async function syncScheduledNotifications(
  tasks: Task[],
  blockedTaskIds: Set<string>,
  prefs: CadencePrefs
): Promise<void> {
  if (!isNativeApp()) return;

  const now = Date.now();
  const upcoming = tasks
    .filter((t) => t.status === 'pending' && !blockedTaskIds.has(t.id) && t.scheduledDate && t.scheduledTime)
    .map((t) => {
      const [y, m, d] = t.scheduledDate.split('-').map(Number);
      const [hh, mm] = t.scheduledTime.split(':').map(Number);
      return { task: t, at: new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0) };
    })
    .filter((x) => !Number.isNaN(x.at.getTime()) && x.at.getTime() > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_TASK_REMINDERS);

  const signature = JSON.stringify({
    t: upcoming.map((x) => [x.task.id, x.at.getTime(), x.task.title]),
    p: prefs,
  });
  if (signature === lastSignature) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] =
      upcoming.map(({ task, at }) => ({
        id: taskNotifId(task.id, task.scheduledDate),
        title: `Execution Reminder · ${task.scheduledTime}`,
        body: task.title,
        schedule: { at, allowWhileIdle: true },
      }));

    if (prefs.morningBriefingEnabled) {
      notifications.push({
        id: DAILY_IDS.briefing,
        title: '08:00 Morning Briefing',
        body: 'Open EmpireOS and lock in your Top 3 priorities for today.',
        schedule: { on: { hour: 8, minute: 0 }, allowWhileIdle: true },
      });
    }
    if (prefs.middayStallAlertEnabled) {
      notifications.push({
        id: DAILY_IDS.stall,
        title: '14:00 Mid-Day Check',
        body: 'Half the day is gone. Check your execution rate and finish the next task.',
        schedule: { on: { hour: 14, minute: 0 }, allowWhileIdle: true },
      });
    }
    if (prefs.nightAuditEnabled) {
      notifications.push({
        id: DAILY_IDS.audit,
        title: '21:30 Night Execution Audit',
        body: 'Review what got done today and set up tomorrow.',
        schedule: { on: { hour: 21, minute: 30 }, allowWhileIdle: true },
      });
    }

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
    lastSignature = signature;
  } catch (err) {
    console.warn('[EmpireOS] Could not schedule notifications', err);
  }
}
