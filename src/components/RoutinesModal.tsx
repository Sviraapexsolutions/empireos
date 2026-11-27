import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Plus, Repeat, StopCircle, X } from 'lucide-react';
import type { Business, Task } from '../types/empire';
import { formatShortDate, formatTime12h, getTodayKey } from '../utils/dateUtils';
import {
  groupRoutines,
  occurrenceOnOrAfter,
  ROUTINE_TEMPLATES,
  RULE_LABEL,
  weekdayOf,
  type RoutineRule,
  type RoutineSeries,
} from '../utils/routines';
import { addDays } from '../utils/dateUtils';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface NewRoutineInput {
  title: string;
  businessId: string;
  rule: RoutineRule;
  time: string;
  startDate: string;
}

interface RoutinesModalProps {
  open: boolean;
  businesses: Business[];
  tasks: Task[];
  onClose: () => void;
  onCreate: (input: NewRoutineInput) => Promise<void>;
  onStop: (series: RoutineSeries) => void;
}

function firstDateFor(rule: RoutineRule, weekday: number): string {
  const today = getTodayKey();
  if (rule === 'weekly') {
    let d = today;
    while (weekdayOf(d) !== weekday) d = addDays(d, 1);
    return d;
  }
  return occurrenceOnOrAfter(today, rule, today);
}

export function RoutinesModal({ open, businesses, tasks, onClose, onCreate, onStop }: RoutinesModalProps) {
  const activeBiz = useMemo(() => businesses.filter((b) => b.isActive), [businesses]);
  const bizMap = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);
  const series = useMemo(
    () =>
      groupRoutines(tasks)
        .filter((s) => s.pending || s.latest.status !== 'pending')
        .sort((a, b) => (a.latest.scheduledTime || '99').localeCompare(b.latest.scheduledTime || '99')),
    [tasks]
  );

  const [title, setTitle] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [rule, setRule] = useState<RoutineRule>('daily');
  const [time, setTime] = useState('09:00');
  const [weekday, setWeekday] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setBusinessId((prev) => prev || activeBiz[0]?.id || '');
  }, [open, activeBiz]);

  if (!open) return null;

  const categories = [...new Set(ROUTINE_TEMPLATES.map((t) => t.category))];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Give the routine a name.');
    if (!businessId) return setError('Pick a venture for this routine.');
    setBusy(true);
    try {
      await onCreate({ title: title.trim(), businessId, rule, time, startDate: firstDateFor(rule, weekday) });
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the routine.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40 cursor-default" />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-amber-600" />
              Business Routines
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Recurring work that creates itself. Finish today's — the next one appears automatically.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active routines */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Active routines ({series.length})</h3>
          {series.length === 0 ? (
            <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-300 p-4 text-center">
              No routines yet. Add one below or pick from templates.
            </p>
          ) : (
            <div className="space-y-2">
              {series.map((s) => {
                const biz = bizMap.get(s.latest.businessId);
                const next = s.pending || s.latest;
                const rate = s.doneCount + s.missedCount > 0 ? Math.round((s.doneCount / (s.doneCount + s.missedCount)) * 100) : null;
                return (
                  <div key={s.key} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: biz?.colorHex || '#94a3b8' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">{s.latest.title}</div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
                        <span>{biz?.name || 'Venture'}</span>
                        <span>· {RULE_LABEL[s.latest.recurrenceRule as RoutineRule]}</span>
                        {s.latest.scheduledTime && <span>· {formatTime12h(s.latest.scheduledTime)}</span>}
                        {s.pending && <span>· next {formatShortDate(next.scheduledDate)}</span>}
                        {rate !== null && <span className="font-mono">· {rate}% kept ({s.doneCount}✓ {s.missedCount}✗)</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStop(s)}
                      title="Stop routine"
                      aria-label={`Stop ${s.latest.title}`}
                      className="min-h-[34px] px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      Stop
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* New routine */}
        <form onSubmit={handleCreate} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">New routine</h3>
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
            >
              {showTemplates ? 'Hide templates' : 'Use a template'}
            </button>
          </div>

          {showTemplates && (
            <div className="space-y-3 rounded-xl bg-white border border-slate-200 p-3 max-h-64 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat} className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{cat}</div>
                  {ROUTINE_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                    <button
                      key={t.title}
                      type="button"
                      onClick={() => {
                        setTitle(t.title);
                        setRule(t.rule);
                        setTime(t.time);
                        if (t.weekday !== undefined) setWeekday(t.weekday);
                        setShowTemplates(false);
                      }}
                      className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer"
                    >
                      <div className="text-xs font-medium text-slate-900">{t.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {RULE_LABEL[t.rule]}
                        {t.weekday !== undefined && t.rule === 'weekly' ? ` (${WEEKDAYS[t.weekday]})` : ''} · {formatTime12h(t.time)}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Daily cash & UPI reconciliation" maxLength={200} className={inputCls} />
          <div className="grid grid-cols-2 gap-2.5">
            <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className={inputCls} aria-label="Venture">
              {activeBiz.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={rule} onChange={(e) => setRule(e.target.value as RoutineRule)} className={inputCls} aria-label="Repeat">
              <option value="daily">Every day</option>
              <option value="weekdays">Mon–Fri</option>
              <option value="weekly">Every week</option>
            </select>
            {rule === 'weekly' && (
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={inputCls} aria-label="Day of week">
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} aria-label="Time" />
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5" />
            First one on {formatShortDate(firstDateFor(rule, weekday))}. Monthly routines (GST, salaries) are coming soon.
          </p>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {busy ? 'Creating…' : 'Create Routine'}
          </button>
        </form>
      </div>
    </div>
  );
}
