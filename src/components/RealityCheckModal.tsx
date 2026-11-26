import { useEffect } from 'react';
import { AlertTriangle, Loader2, Quote, ShieldAlert, Target, X } from 'lucide-react';
import type { AiProvider, RealityCheckPayload, Task, TriggerReason } from '../types/empire';

interface RealityCheckModalProps {
  open: boolean;
  loading: boolean;
  error: string;
  task: Task | null;
  businessName: string;
  completionPercent: number;
  triggerReason: TriggerReason;
  payload: RealityCheckPayload | null;
  aiProvider?: AiProvider;
  onClose: () => void;
  onLockInTask: (task: Task) => void;
  onRetry: () => void;
}

const REASON_TITLE: Record<TriggerReason, string> = {
  overdue: 'Scheduled Execution Time Elapsed',
  rescheduled: 'Task Pushed Back — Momentum Check',
  missed: 'Commitment Marked Missed',
  manual: 'Executive Reality Check',
};

export function RealityCheckModal({
  open,
  loading,
  error,
  task,
  businessName,
  completionPercent,
  triggerReason,
  payload,
  aiProvider = 'gemini',
  onClose,
  onLockInTask,
  onRetry,
}: RealityCheckModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const providerLabel = aiProvider === 'claude' ? 'Claude Sonnet 4' : 'Gemini 4 Hydrogen';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reality-check-heading"
    >
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        {/* High-Contrast Executive Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="reality-check-heading"
                className="font-display text-base sm:text-lg font-bold text-slate-900 truncate"
              >
                Empire Reality Check
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {REASON_TITLE[triggerReason]} ·{' '}
                <span className="font-mono tabular-nums text-amber-700 font-semibold">
                  {completionPercent}% today
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reality Check"
            className="min-w-[38px] min-h-[38px] rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {task && (
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-amber-700">{businessName}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-900 font-medium">{task.title}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-7 h-7 text-amber-600 animate-spin" />
              <p className="text-sm font-medium text-slate-800">
                Summoning ₹1,000 Cr Accountability Directive…
              </p>
              <p className="text-xs text-slate-500">Analyzing task stall via {providerLabel}</p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-5 space-y-3">
              <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Accountability Coach Unavailable
              </div>
              <p className="text-xs text-red-700/80 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="min-h-[38px] px-4 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer"
              >
                Retry Reality Check
              </button>
            </div>
          ) : payload ? (
            <div className="space-y-5">
              {/* Wake-Up Call */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-red-600">Wake-Up Call</div>
                <p className="text-base sm:text-lg font-display font-semibold text-slate-900 leading-snug">
                  {payload.wakeUpCall}
                </p>
              </div>

              {/* Verified Quote */}
              <blockquote className="rounded-xl bg-slate-50 border border-slate-200 p-5 space-y-2.5">
                <div className="flex items-start gap-3">
                  <Quote className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm sm:text-base italic text-slate-800 leading-relaxed">
                    “{payload.quote}”
                  </p>
                </div>
                <footer className="pl-8 text-xs font-semibold text-amber-700">
                  — {payload.quoteAuthor}
                </footer>
              </blockquote>

              {/* Tactical Breakdown */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-emerald-700">
                  Tactical Application Right Now
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {payload.tacticalBreakdown}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        {!loading && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
            >
              Acknowledge
            </button>
            {task && task.status !== 'done' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockInTask(task);
                }}
                className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Target className="w-4 h-4" />
                Lock In Now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
