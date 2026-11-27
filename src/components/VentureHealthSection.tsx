import { useMemo } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import type { Business, Project, Task } from '../types/empire';
import { computeVentureHealth, type HealthStatus } from '../utils/weekly';
import { BusinessIcon } from './BusinessIcon';

const STATUS_STYLE: Record<HealthStatus, { label: string; pill: string; bar: string }> = {
  red: { label: 'Needs you', pill: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  amber: { label: 'Watch', pill: 'bg-amber-50 text-amber-800 border-amber-200', bar: 'bg-amber-500' },
  green: { label: 'On track', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  idle: { label: 'Quiet', pill: 'bg-slate-50 text-slate-500 border-slate-200', bar: 'bg-slate-300' },
};

const ORDER: Record<HealthStatus, number> = { red: 0, amber: 1, green: 2, idle: 3 };

interface VentureHealthSectionProps {
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  onOpenVenture: (businessId: string) => void;
}

export function VentureHealthSection({ businesses, projects, tasks, onOpenVenture }: VentureHealthSectionProps) {
  const health = useMemo(
    () =>
      businesses
        .filter((b) => b.isActive)
        .map((b) => computeVentureHealth(b, projects, tasks))
        .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.overdue - a.overdue),
    [businesses, projects, tasks]
  );

  if (health.length === 0) return null;

  const counts = health.reduce(
    (acc, h) => ({ ...acc, [h.status]: (acc[h.status] || 0) + 1 }),
    {} as Partial<Record<HealthStatus, number>>
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-600" />
            Venture Health
          </h3>
          <p className="text-xs text-slate-500">Which business needs you today.</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          {(['red', 'amber', 'green'] as const).map((s) =>
            counts[s] ? (
              <span key={s} className={`px-2 py-0.5 rounded-full border ${STATUS_STYLE[s].pill}`}>
                {counts[s]} {STATUS_STYLE[s].label}
              </span>
            ) : null
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {health.map((h) => {
          const st = STATUS_STYLE[h.status];
          return (
            <button
              key={h.business.id}
              type="button"
              onClick={() => onOpenVenture(h.business.id)}
              className="relative text-left rounded-2xl bg-white border border-slate-200 hover:border-slate-300 p-4 pl-5 space-y-3 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] cursor-pointer"
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${st.bar}`} aria-hidden="true" />
              <div className="flex items-center gap-2.5">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${h.business.colorHex}18` }}
                >
                  <BusinessIcon icon={h.business.icon} color={h.business.colorHex} className="w-4 h-4" />
                </span>
                <span className="font-semibold text-sm text-slate-900 truncate flex-1">{h.business.name}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${st.pill}`}>
                  {st.label}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { v: h.open, l: 'open' },
                  { v: h.overdue, l: 'overdue', warn: h.overdue > 0 },
                  { v: h.dueToday, l: 'today' },
                  { v: h.done7d, l: 'done 7d' },
                ].map((m) => (
                  <div key={m.l}>
                    <div className={`font-mono tabular-nums text-base font-bold ${m.warn ? 'text-red-600' : 'text-slate-900'}`}>
                      {m.v}
                    </div>
                    <div className="text-[10px] text-slate-500">{m.l}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 leading-snug">{h.reasons.slice(0, 2).join(' · ')}</p>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
