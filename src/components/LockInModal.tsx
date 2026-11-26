import { useEffect, useState } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, ShieldAlert, X } from 'lucide-react';
import type { Business, Project, Task } from '../types/empire';
import { triggerHaptic } from '../utils/dateUtils';

interface LockInModalProps {
  task: Task | null;
  business?: Business;
  project?: Project;
  onClose: () => void;
  onCompleteTask: (task: Task) => void;
  onRealityCheck: (task: Task) => void;
}

const PRESETS = [25, 45, 60];

export function LockInModal({
  task,
  business,
  project,
  onClose,
  onCompleteTask,
  onRealityCheck,
}: LockInModalProps) {
  const [durationMin, setDurationMin] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!task) return;
    setSecondsLeft(durationMin * 60);
    setRunning(true);
  }, [task, durationMin]);

  useEffect(() => {
    if (!task || !running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          triggerHaptic([30, 50, 30]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [task, running]);

  useEffect(() => {
    if (!task) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [task, onClose]);

  if (!task) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const totalSecs = durationMin * 60;
  const elapsedPct = totalSecs > 0 ? Math.round(((totalSecs - secondsLeft) / totalSecs) * 100) : 0;
  const accent = business?.colorHex || '#D97706';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-in-title"
    >
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 space-y-7 text-center shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: accent }} />
            <span>
              {business?.name || 'Venture'}
              {project ? ` · ${project.name}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit Lock In mode"
            className="min-w-[38px] min-h-[38px] rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h2 id="lock-in-title" className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            {task.title}
          </h2>
          <p className="text-xs text-slate-500">
            Single-task execution sprint. Eliminate distractions until done.
          </p>
        </div>

        {/* Countdown Display */}
        <div className="space-y-4">
          <div className="font-mono tabular-nums text-6xl sm:text-7xl font-semibold tracking-tight text-slate-900">
            {formatted}
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${elapsedPct}%`, backgroundColor: accent }}
            />
          </div>
        </div>

        {/* Duration Presets */}
        <div className="flex items-center justify-center gap-2">
          {PRESETS.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => setDurationMin(min)}
              className={`min-h-[36px] px-3.5 rounded-lg font-mono text-xs font-medium transition-colors cursor-pointer ${
                durationMin === min
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {min}m
            </button>
          ))}
        </div>

        {/* Transport & Execution Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="min-h-[46px] px-5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 font-semibold text-sm flex items-center gap-2 hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? 'Pause' : 'Resume'}
          </button>

          <button
            type="button"
            onClick={() => {
              setSecondsLeft(durationMin * 60);
              setRunning(false);
            }}
            aria-label="Reset timer"
            className="min-w-[46px] min-h-[46px] rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic([16, 28, 16]);
              onCompleteTask(task);
              onClose();
            }}
            className="min-h-[46px] px-5 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark Done
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRealityCheck(task);
            }}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Stalling? Trigger Reality Check
          </button>
        </div>
      </div>
    </div>
  );
}
