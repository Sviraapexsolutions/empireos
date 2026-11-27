import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type { AiProvider, Business, Habit, Task } from '../types/empire';
import { addDays, formatShortDate, getTodayKey } from '../utils/dateUtils';
import { computeWeekStats, weekStartOf, type WeekStats } from '../utils/weekly';
import { generateWeeklyReview, type WeeklyAiReview } from '../services/aiCoach';

const REVIEW_PREFIX = 'empireos_weekly_review_';

function loadAi(start: string): WeeklyAiReview | null {
  try {
    const raw = localStorage.getItem(REVIEW_PREFIX + start);
    return raw ? (JSON.parse(raw) as WeeklyAiReview) : null;
  } catch {
    return null;
  }
}

function Delta({ now, prev, suffix = '', inverse = false }: { now: number; prev: number; suffix?: string; inverse?: boolean }) {
  const diff = now - prev;
  if (diff === 0) return <span className="text-[11px] text-slate-400">same as last week</span>;
  const good = inverse ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? 'text-emerald-700' : 'text-red-600'}`}>
      <Icon className="w-3 h-3" />
      {diff > 0 ? '+' : ''}
      {diff}
      {suffix} vs last week
    </span>
  );
}

function buildSummaryText(w: WeekStats, prev: WeekStats): string {
  const lines = [
    `Week ${formatShortDate(w.start)} – ${formatShortDate(w.end)}`,
    `Tasks done: ${w.done} (last week ${prev.done})`,
    `Scheduled this week: ${w.scheduled}, slipped: ${w.slipped} (missed ${w.missed})`,
    `Completion rate: ${w.completionRate}% (last week ${prev.completionRate}%)`,
    `On-time rate: ${w.onTimeRate}%`,
    `Habit consistency: ${w.habitRate}%`,
    `High-priority done: ${w.highPriorityDone}, milestones hit: ${w.milestonesDone}`,
    '',
    'By venture:',
    ...w.perVenture.map(
      (v) =>
        `- ${v.business.name}: ${v.done.length} done${v.done.length ? ` (${v.done.slice(0, 4).map((t) => t.title).join('; ')})` : ''}, ${v.slipped.length} slipped${v.slipped.length ? ` (${v.slipped.slice(0, 4).map((t) => t.title).join('; ')})` : ''}`
    ),
  ];
  return lines.join('\n');
}

interface WeeklyReviewModalProps {
  open: boolean;
  businesses: Business[];
  tasks: Task[];
  habits: Habit[];
  aiProvider: AiProvider;
  onClose: () => void;
}

export function WeeklyReviewModal({ open, businesses, tasks, habits, aiProvider, onClose }: WeeklyReviewModalProps) {
  const thisWeek = weekStartOf(getTodayKey());
  const [start, setStart] = useState(thisWeek);
  const week = useMemo(() => computeWeekStats(start, tasks, habits, businesses), [start, tasks, habits, businesses]);
  const prev = useMemo(
    () => computeWeekStats(addDays(start, -7), tasks, habits, businesses),
    [start, tasks, habits, businesses]
  );
  const [ai, setAi] = useState<WeeklyAiReview | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setStart(thisWeek);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setAi(loadAi(start));
    setAiError('');
  }, [start]);

  if (!open) return null;

  const maxDay = Math.max(1, ...week.days.map((d) => d.done));
  const isCurrent = start === thisWeek;

  const runAi = async () => {
    setAiBusy(true);
    setAiError('');
    try {
      const result = await generateWeeklyReview(aiProvider, buildSummaryText(week, prev));
      setAi(result);
      try {
        localStorage.setItem(REVIEW_PREFIX + start, JSON.stringify(result));
      } catch {
        // ignore
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not get the AI review.');
    } finally {
      setAiBusy(false);
    }
  };

  const copySummary = async () => {
    const text = [
      `*EmpireOS Weekly Review* (${formatShortDate(week.start)} – ${formatShortDate(week.end)})`,
      `✅ Done: ${week.done} | ⚠️ Slipped: ${week.slipped} | 🎯 Completion: ${week.completionRate}% | ⏱ On-time: ${week.onTimeRate}%`,
      ...week.perVenture.map((v) => `• ${v.business.name}: ${v.done.length} done, ${v.slipped.length} slipped`),
      ...(ai ? ['', `*Verdict:* ${ai.verdict}`, '', '*Next week:*', ai.plan] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  const stat = (label: string, value: string, delta?: React.ReactNode) => (
    <div className="rounded-xl border border-slate-200 p-3 space-y-0.5">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      {delta}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40 cursor-default" />
      <div className="relative w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto bg-[#F7F8FA] rounded-t-2xl sm:rounded-2xl shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900 leading-tight">Weekly Review</h2>
            <div className="text-xs text-slate-500">
              {formatShortDate(week.start)} – {formatShortDate(week.end)}
              {isCurrent && ' · this week so far'}
            </div>
          </div>
          <button type="button" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week" className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" disabled={isCurrent} onClick={() => setStart(addDays(start, 7))} aria-label="Next week" className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center disabled:opacity-30 cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white rounded-2xl p-3 border border-slate-200">
            {stat('Tasks done', String(week.done), <Delta now={week.done} prev={prev.done} />)}
            {stat('Completion', `${week.completionRate}%`, <Delta now={week.completionRate} prev={prev.completionRate} suffix="%" />)}
            {stat('Slipped', String(week.slipped), <Delta now={week.slipped} prev={prev.slipped} inverse />)}
            {stat('Habits kept', `${week.habitRate}%`, <Delta now={week.habitRate} prev={prev.habitRate} suffix="%" />)}
          </div>

          {/* Daily chart */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Tasks done per day</div>
            <div className="flex items-end gap-2 h-28">
              {week.days.map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">{d.done || ''}</span>
                  <div
                    className={`w-full rounded-t-md ${d.key === getTodayKey() ? 'bg-amber-500' : 'bg-slate-800'}`}
                    style={{ height: `${Math.max(4, (d.done / maxDay) * 80)}%`, opacity: d.done ? 1 : 0.15 }}
                  />
                  <span className="text-[10px] text-slate-500">{d.label}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-slate-500">
              On-time {week.onTimeRate}% · {week.highPriorityDone} high-priority done · {week.milestonesDone} milestones
            </div>
          </div>

          {/* Per venture */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="text-sm font-semibold text-slate-900">By venture</div>
            {week.perVenture.length === 0 ? (
              <p className="text-xs text-slate-500">No tasks were done or scheduled this week.</p>
            ) : (
              week.perVenture.map((v) => (
                <div key={v.business.id} className="space-y-1.5 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.business.colorHex }} />
                    <span className="text-sm font-semibold text-slate-900 flex-1 truncate">{v.business.name}</span>
                    <span className="text-xs font-mono text-emerald-700 tabular-nums">{v.done.length} done</span>
                    {v.slipped.length > 0 && (
                      <span className="text-xs font-mono text-red-600 tabular-nums">{v.slipped.length} slipped</span>
                    )}
                  </div>
                  {v.done.length > 0 && (
                    <ul className="text-xs text-slate-600 space-y-0.5 pl-4">
                      {v.done.slice(0, 5).map((t) => (
                        <li key={t.id} className="flex gap-1.5"><Check className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" /><span className="truncate">{t.title}</span></li>
                      ))}
                      {v.done.length > 5 && <li className="text-slate-400">+{v.done.length - 5} more</li>}
                    </ul>
                  )}
                  {v.slipped.length > 0 && (
                    <ul className="text-xs text-red-700/90 space-y-0.5 pl-4">
                      {v.slipped.slice(0, 5).map((t) => (
                        <li key={t.id} className="flex gap-1.5"><X className="w-3 h-3 mt-0.5 shrink-0" /><span className="truncate">{t.title}</span></li>
                      ))}
                      {v.slipped.length > 5 && <li className="text-red-400">+{v.slipped.length - 5} more</li>}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>

          {/* AI */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                AI Verdict & Next Week Plan
              </h3>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => void runAi()}
                className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiBusy ? 'Thinking…' : ai ? 'Refresh' : 'Generate'}
              </button>
            </div>
            {aiError && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{aiError}</div>}
            {ai ? (
              <div className="space-y-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900 leading-snug">{ai.verdict}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <div className="text-[11px] font-semibold text-emerald-700 mb-0.5">Wins</div>
                    <p className="text-xs leading-relaxed">{ai.wins}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <div className="text-[11px] font-semibold text-red-600 mb-0.5">Slips</div>
                    <p className="text-xs leading-relaxed">{ai.slips}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <div className="text-[11px] font-semibold text-slate-900 mb-1">Next week priorities</div>
                  <ul className="text-xs space-y-1">
                    {ai.plan
                      .split('\n')
                      .map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, '').trim())
                      .filter(Boolean)
                      .map((l, i) => (
                        <li key={i} className="flex gap-2"><span className="font-mono text-amber-700">{i + 1}.</span><span>{l}</span></li>
                      ))}
                  </ul>
                </div>
                {ai.focus && (
                  <div className="rounded-xl bg-slate-900 text-white p-3 text-xs leading-relaxed">
                    <span className="font-semibold text-amber-300">Protect this: </span>
                    {ai.focus}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Get an honest grade of the week, what went well, what slipped, and 3–5 priorities for next week.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void copySummary()}
            className="w-full min-h-[46px] rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-sm font-semibold text-slate-800 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied — paste in WhatsApp' : 'Copy summary for WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
