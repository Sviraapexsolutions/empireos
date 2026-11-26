import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ensureUserSeeded } from '../services/empireService';
import type {
  Business,
  CoachLog,
  ExecutiveAlert,
  Habit,
  Project,
  Task,
  TaskFile,
  UserProfile,
} from '../types/empire';
import { getCurrentHHmm, getTodayKey } from '../utils/dateUtils';

export interface EmpireDataState {
  profile: UserProfile | null;
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  habits: Habit[];
  coachLogs: CoachLog[];
  files: TaskFile[];
  loading: boolean;
  isOffline: boolean;
  todayStats: {
    completed: number;
    total: number;
    percent: number;
  };
  blockedTaskIds: Set<string>;
}

function fireBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `empireos-${title}` });
    } catch {
      // Ignore if blocked in iframe context
    }
  }
}

export function useEmpireData(
  user: User | null,
  options: {
    onExecutiveAlert: (alert: ExecutiveAlert) => void;
    onAutoOverdueTask: (task: Task) => void;
  }
): EmpireDataState {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [coachLogs, setCoachLogs] = useState<CoachLog[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const alertedKeysRef = useRef<Set<string>>(new Set());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track online/offline state for offline persistence feedback
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Seed & attach realtime Firestore listeners scoped strictly to /users/{uid}/...
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setProfile(null);
      setBusinesses([]);
      setProjects([]);
      setTasks([]);
      setHabits([]);
      setCoachLogs([]);
      setFiles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const uid = user.uid;
    setLoading(true);

    const unsubscribers: Array<() => void> = [];

    const init = async () => {
      try {
        await ensureUserSeeded(uid, user.displayName || user.email?.split('@')[0] || 'Founder');
      } catch (err) {
        console.error('Seeding check error:', err);
      }
      if (cancelled) return;

      const loadedFlags = {
        biz: false,
        proj: false,
        tasks: false,
        habits: false,
        logs: false,
        files: false,
      };
      const checkDone = () => {
        if (
          !cancelled &&
          loadedFlags.biz &&
          loadedFlags.proj &&
          loadedFlags.tasks &&
          loadedFlags.habits &&
          loadedFlags.logs &&
          loadedFlags.files
        ) {
          setLoading(false);
        }
      };

      // Profile doc
      unsubscribers.push(
        onSnapshot(
          doc(db, 'users', uid),
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
        )
      );

      // Businesses (strict where('uid', '==', uid) to satisfy Pillar 8 allow list)
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'businesses'), where('uid', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Business, 'id'>) }))
              .sort((a, b) => a.sortOrder - b.sortOrder);
            setBusinesses(list);
            loadedFlags.biz = true;
            checkDone();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/businesses`)
        )
      );

      // Projects
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'projects'), where('uid', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setProjects(list);
            loadedFlags.proj = true;
            checkDone();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/projects`)
        )
      );

      // Tasks
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'tasks'), where('uid', '==', uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }));
            setTasks(list);
            loadedFlags.tasks = true;
            checkDone();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/tasks`)
        )
      );

      // Habits
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'habits'), where('uid', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Habit, 'id'>) }))
              .sort((a, b) => (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99'));
            setHabits(list);
            loadedFlags.habits = true;
            checkDone();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/habits`)
        )
      );

      // Coach Logs
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'coachLogs'), where('uid', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<CoachLog, 'id'>) }))
              .sort((a, b) => {
                const aMs = a.createdAt?.toMillis?.() ?? Date.now();
                const bMs = b.createdAt?.toMillis?.() ?? Date.now();
                return bMs - aMs;
              });
            setCoachLogs(list);
            loadedFlags.logs = true;
            checkDone();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/coachLogs`)
        )
      );

      // Reusable Task Files (PDFs & Photos)
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'users', uid, 'files'), where('uid', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<TaskFile, 'id'>) }))
              .sort((a, b) => {
                const aMs = a.createdAt?.toMillis?.() ?? Date.now();
                const bMs = b.createdAt?.toMillis?.() ?? Date.now();
                return bMs - aMs;
              });
            setFiles(list);
            loadedFlags.files = true;
            checkDone();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/files`)
        )
      );
    };

    void init();

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
    };
  }, [user]);

  // Compute blocked task IDs (tasks whose prerequisite task is not done)
  const blockedTaskIds = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const blocked = new Set<string>();
    for (const task of tasks) {
      if (task.blockedByTaskId) {
        const prereq = taskById.get(task.blockedByTaskId);
        if (prereq && prereq.status !== 'done') {
          blocked.add(task.id);
        }
      }
    }
    return blocked;
  }, [tasks]);

  // Today execution stats (unblocked tasks scheduled today + rolled over pending)
  const todayStats = useMemo(() => {
    const today = getTodayKey();
    const relevant = tasks.filter((t) => {
      if (blockedTaskIds.has(t.id)) return false;
      if (t.scheduledDate === today) return true;
      if (t.scheduledDate < today && t.status === 'pending') return true;
      return false;
    });
    const completed = relevant.filter((t) => t.status === 'done').length;
    const total = relevant.length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { completed, total, percent };
  }, [tasks, blockedTaskIds]);

  // Reliable Cadence Scheduler (Exact task reminders, 08:00 Briefing, 14:00 Stall Alert, 21:30 Night Audit)
  useEffect(() => {
    if (!user || !user.emailVerified || loading) return;

    const evaluateCadence = () => {
      const today = getTodayKey();
      const nowHHmm = getCurrentHHmm();

      // 1. Exact task reminder times
      for (const task of tasks) {
        if (
          task.status === 'pending' &&
          !blockedTaskIds.has(task.id) &&
          task.scheduledDate === today &&
          task.scheduledTime === nowHHmm
        ) {
          const remKey = `rem_${today}_${task.id}_${nowHHmm}`;
          if (!alertedKeysRef.current.has(remKey)) {
            alertedKeysRef.current.add(remKey);
            const title = `Execution Reminder · ${task.scheduledTime}`;
            const body = task.title;
            fireBrowserNotification(title, body);
            optionsRef.current.onExecutiveAlert({
              id: remKey,
              kind: 'reminder',
              title,
              body,
              timestamp: nowHHmm,
            });
          }
        }

        // Auto-trigger Reality Check if a task's exact scheduled time just passed by 1 minute
        if (
          task.status === 'pending' &&
          !blockedTaskIds.has(task.id) &&
          task.scheduledDate === today &&
          task.scheduledTime
        ) {
          const [th, tm] = task.scheduledTime.split(':').map(Number);
          const [nh, nm] = nowHHmm.split(':').map(Number);
          const diffMin = nh * 60 + nm - (th * 60 + tm);
          if (diffMin === 1) {
            const overdueKey = `overdue_${today}_${task.id}`;
            if (!alertedKeysRef.current.has(overdueKey)) {
              alertedKeysRef.current.add(overdueKey);
              optionsRef.current.onAutoOverdueTask(task);
            }
          }
        }
      }

      // 2. 08:00 Morning Briefing (Top 3 priority tasks)
      if ((profile?.morningBriefingEnabled ?? true) && nowHHmm === '08:00') {
        const key = `briefing_${today}`;
        if (!alertedKeysRef.current.has(key)) {
          alertedKeysRef.current.add(key);
          const top3 = tasks
            .filter((t) => t.status === 'pending' && !blockedTaskIds.has(t.id) && t.scheduledDate <= today)
            .sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
            .slice(0, 3)
            .map((t, i) => `${i + 1}. ${t.title}`)
            .join(' · ');
          const body = top3 || 'No pending tasks scheduled yet. Set your Top 3 empire levers now.';
          fireBrowserNotification('08:00 Morning Briefing', body);
          optionsRef.current.onExecutiveAlert({
            id: key,
            kind: 'briefing',
            title: '08:00 Morning Briefing — Top 3 Priorities',
            body,
            timestamp: nowHHmm,
          });
        }
      }

      // 3. 14:00 Mid-Day Stall Alert (if completion < 30%)
      if ((profile?.middayStallAlertEnabled ?? true) && nowHHmm === '14:00' && todayStats.percent < 30 && todayStats.total > 0) {
        const key = `stall_${today}`;
        if (!alertedKeysRef.current.has(key)) {
          alertedKeysRef.current.add(key);
          const body = `Execution is at ${todayStats.percent}% (${todayStats.completed}/${todayStats.total}) past 2:00 PM. Lock in on your highest-leverage task now.`;
          fireBrowserNotification('14:00 Mid-Day Stall Alert', body);
          optionsRef.current.onExecutiveAlert({
            id: key,
            kind: 'stall',
            title: '14:00 Mid-Day Stall Alert',
            body,
            timestamp: nowHHmm,
          });
        }
      }

      // 4. 21:30 Night Audit
      if ((profile?.nightAuditEnabled ?? true) && nowHHmm === '21:30') {
        const key = `audit_${today}`;
        if (!alertedKeysRef.current.has(key)) {
          alertedKeysRef.current.add(key);
          const missedOrPending = todayStats.total - todayStats.completed;
          const body = `Night Audit: ${todayStats.completed} completed, ${missedOrPending} unfinished (${todayStats.percent}% execution rate).`;
          fireBrowserNotification('21:30 Night Execution Audit', body);
          optionsRef.current.onExecutiveAlert({
            id: key,
            kind: 'audit',
            title: '21:30 Night Execution Audit',
            body,
            timestamp: nowHHmm,
          });
        }
      }
    };

    evaluateCadence();
    const interval = window.setInterval(evaluateCadence, 30_000);
    return () => window.clearInterval(interval);
  }, [user, loading, tasks, blockedTaskIds, profile, todayStats]);

  return {
    profile,
    businesses,
    projects,
    tasks,
    habits,
    coachLogs,
    files,
    loading,
    isOffline,
    todayStats,
    blockedTaskIds,
  };
}
