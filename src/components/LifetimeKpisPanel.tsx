import { useMemo, useState } from 'react';
import {
  Award as AwardIcon,
  CheckCircle2,
  Flame,
  Hourglass,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import type { AiProvider, CoachLog, Habit, Task } from '../types/empire';
import { computeAwards, computeLifetimeKpis } from '../utils/kpis';
import { formatShortDate } from '../utils/dateUtils';
import { generatePerformanceReview, type PerformanceReview } from '../services/aiCoach';

const REVIEW_STORAGE = 'empireos_performance_review';

function loadReview(): PerformanceReview | null {
  try {
    const raw = localStorage.getItem(REVIEW_STORAGE);
    return raw ? (JSON.parse(raw) as PerformanceReview) : null;
  } catch {
    return null;
  }
}

function rateTone(value: number, inverse = false): string {
  const v = inverse ? 100 - value : value;
  if (v >= 80) return 'text-emerald-700';
  if (v >= 60) return 'text-amber-700';
  return 'text-red-600';
}

function barTone(value: number, inverse = false): string {
  const v = inverse ? 100 - value : value;
  if (v >= 80) return 'bg-emerald-500';
  if (v >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

interface LifetimeKpisPanelProps {
  tasks: Task[];
  habits: Habit[];
  coachLogs: CoachLog[];
  aiProvider: AiProvider;
}

export function LifetimeKpisPanel({ tasks, habits, coachLogs, aiProvider }: LifetimeKpisPanelProps) {
  const k = useMemo(() => computeLifetimeKpis(tasks, habits, coachLogs), [tasks, habits, coachLogs]);
  const awards = useMemo(() => computeAwards(k), [k]);
  const earnedCount = awards.filter((a) => a.earned).length;

  const [review, setReview] = useState<PerformanceReview | null>(() => loadReview());
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [showAllAwards, setShowAllAwards] = useState(false);

  const rates: Array<{
    label: string;
    value: number;
    hint: string;
    icon: typeof Target;
    inverse?: boolean;
  }> = [
    { label: 'Execution Rate', value: k.executionRate, hint: 'Done vs everything that came due', icon: Target },
    { label: 'Success Rate', value: k.successRate, hint: 'Done vs done + missed', icon: CheckCircle2 },
    { label: 'On-Time Rate', value: k.onTimeRate, hint: 'Finished by schedule/deadline', icon: Timer },
    { label: 'Delay Rate', value: k.delayRate, hint: 'Late or still overdue (lower is better)', icon: Hourglass, inverse: true },
    { label: 'Habit Consistency', value: k.habitConsistency, hint: 'Check-ins vs expected days', icon: Flame },
    { label: 'High-Priority Hit', value: k.highPriorityRate, hint: 'High-priority tasks closed', icon: Zap },
  ];

  const handleReview = async () => {
    setReviewBusy(true);
    setReviewError('');
    try {
      const result = await generatePerformanceReview(aiProvider, {
        'Executor Score (0-100)': k.score,
        Level: k.level.name,
        'Executor type': k.archetype.name,
        'Tasks completed (lifetime)': k.done,
        'Tasks missed': k.missed,
        'Tasks overdue & still open': k.overdueOpen,
        'Execution rate %': k.executionRate,
        'Success rate %': k.successRate,
        'On-time rate %': k.onTimeRate,
        'Delay rate %': k.delayRate,
        'Average days late (late tasks)': k.avgDelayDays,
        'High-priority hit rate %': k.highPriorityRate,
        'Milestones completed': k.milestonesDone,
        'Habit consistency %': k.habitConsistency,
        'Best habit streak (days)': k.bestHabitStreak,
        'Current execution streak (days)': k.currentExecutionStreak,
        'Longest execution streak (days)': k.longestExecutionStreak,
        'Times rescheduled': k.reschedules,
        'Awards earned': `${earnedCount}/${awards.length}`,
      });
      setReview(result);
      try {
        localStorage.setItem(REVIEW_STORAGE, JSON.stringify(result));
      } catch {
        // ignore
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not get the AI review.');
    } finally {
      setReviewBusy(false);
    }
  };

  const circumference = 2 * Math.PI * 42;
  const dash = (k.score / 100) * circumference;
  const visibleAwards = showAllAwards ? awards : awards.slice(0, 6);

  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Lifetime Execution Profile
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {k.firstActivityDate
              ? `Every task and habit since ${formatShortDate(k.firstActivityDate)}`
              : 'Your all-time performance will build up here'}
          </p>
        </div>
      </div>

      {/* Score + Archetype */}
      <div className="rounded-2xl bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#E0A93B"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold tabular-nums">{k.score}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/60">Score</span>
            </div>
          </div>
          <div className="min-w-0 sm:hidden">
            <div className="text-[11px] uppercase tracking-wider text-amber-300/90 font-semibold">
              {k.level.name}
            </div>
            <div className="font-display text-lg font-bold leading-tight">{k.archetype.name}</div>
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="hidden sm:block text-[11px] uppercase tracking-wider text-amber-300/90 font-semibold">
            Level · {k.level.name}
          </div>
          <div className="hidden sm:block font-display text-xl font-bold leading-tight">{k.archetype.name}</div>
          <p className="text-sm text-white/75 leading-relaxed">{k.archetype.description}</p>
          {k.level.next !== null && (
            <p className="text-xs text-white/50">
              {k.level.next - k.score} points to the next level
            </p>
          )}
        </div>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {rates.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-slate-600">
                <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{r.label}</span>
              </div>
              <div className={`font-display text-2xl font-bold tabular-nums ${rateTone(r.value, r.inverse)}`}>
                {r.value}%
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full rounded-full ${barTone(r.value, r.inverse)}`} style={{ width: `${r.value}%` }} />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug">{r.hint}</p>
            </div>
          );
        })}
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        {[
          { label: 'Tasks done', value: k.done.toLocaleString('en-IN'), icon: CheckCircle2 },
          { label: 'Day streak', value: `${k.currentExecutionStreak}d`, sub: `best ${k.longestExecutionStreak}d`, icon: TrendingUp },
          { label: 'Avg delay', value: `${k.avgDelayDays}d`, sub: 'when late', icon: Hourglass },
          { label: 'Rescheduled', value: String(k.reschedules), sub: `${k.missed} missed`, icon: RotateCcw },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-slate-200 p-2.5">
              <Icon className="w-3.5 h-3.5 mx-auto text-slate-400" />
              <div className="font-display text-lg font-bold text-slate-900 tabular-nums mt-1">{c.value}</div>
              <div className="text-[11px] text-slate-500">{c.label}</div>
              {c.sub && <div className="text-[10px] text-slate-400">{c.sub}</div>}
            </div>
          );
        })}
      </div>

      {/* Awards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-600" />
            Awards
          </h3>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {earnedCount}/{awards.length} earned
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          {visibleAwards.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3 space-y-1.5 ${
                a.earned ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {a.earned ? (
                  <AwardIcon className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={`text-xs sm:text-sm font-semibold truncate ${a.earned ? 'text-amber-900' : 'text-slate-700'}`}>
                  {a.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">{a.description}</p>
              {!a.earned && (
                <div className="space-y-1">
                  <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-slate-500 rounded-full" style={{ width: `${Math.round(a.progress * 100)}%` }} />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums">{a.progressLabel}</div>
                </div>
              )}
            </div>
          ))}
        </div>
        {awards.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAllAwards((v) => !v)}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            {showAllAwards ? 'Show fewer' : `Show all ${awards.length} awards`}
          </button>
        )}
      </div>

      {/* AI Review */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600" />
            AI Coach Review
          </h3>
          <button
            type="button"
            disabled={reviewBusy}
            onClick={() => void handleReview()}
            className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {reviewBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {reviewBusy ? 'Reviewing…' : review ? 'Refresh Review' : 'Get My Review'}
          </button>
        </div>

        {reviewError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{reviewError}</div>
        )}

        {review ? (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">{review.title}</div>
              <p className="font-display text-base sm:text-lg font-bold text-slate-900 leading-snug">{review.headline}</p>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{review.motivation}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-[11px] font-semibold text-emerald-700 mb-0.5">Strength</div>
                <p className="text-xs text-slate-700 leading-relaxed">{review.strength}</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-[11px] font-semibold text-red-600 mb-0.5">Next 7 days</div>
                <p className="text-xs text-slate-700 leading-relaxed">{review.focus}</p>
              </div>
            </div>
            {review.awardName && (
              <div className="rounded-xl bg-slate-900 text-white p-3 flex items-start gap-2.5">
                <Trophy className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold">{review.awardName}</div>
                  <p className="text-xs text-white/70 leading-relaxed">{review.awardReason}</p>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-400">
              Reviewed {new Date(review.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed">
            Your coach reads your lifetime numbers and gives you an honest verdict, motivation, one focus for
            the week, and a custom award you have actually earned.
          </p>
        )}
      </div>
    </section>
  );
}
