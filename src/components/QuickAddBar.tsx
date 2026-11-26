import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  CornerDownLeft,
  Diamond,
  Flame,
  Plus,
  Repeat,
  SlidersHorizontal,
} from 'lucide-react';
import type { Business, Project } from '../types/empire';
import { formatShortDate, formatTime12h, triggerHaptic } from '../utils/dateUtils';
import { parseQuickAddInput, type ParsedQuickAdd } from '../utils/nlParser';

interface QuickAddBarProps {
  businesses: Business[];
  projects: Project[];
  defaultDate?: string;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onCreateFromParsed: (parsed: ParsedQuickAdd) => Promise<void>;
  onOpenFullModal?: (initialTitle?: string) => void;
}

export function QuickAddBar({
  businesses,
  projects,
  defaultDate,
  placeholder = 'Quick add: e.g. "Review fuel margin #Sundaram !high *milestone tomorrow 5pm"',
  compact = false,
  autoFocus = false,
  onCreateFromParsed,
  onOpenFullModal,
}: QuickAddBarProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(
    () => parseQuickAddInput(input, businesses, projects, defaultDate),
    [input, businesses, projects, defaultDate]
  );

  const hasPreview =
    input.trim().length > 0 &&
    (parsed.business !== null ||
      parsed.project !== null ||
      parsed.priority === 'high' ||
      parsed.isMilestone ||
      parsed.hasExplicitDate ||
      Boolean(parsed.scheduledTime) ||
      parsed.recurrenceRule !== 'none');

  const appendToken = (token: string) => {
    const trimmed = input.trimEnd();
    const next = trimmed ? `${trimmed} ${token} ` : `${token} `;
    setInput(next);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.cleanTitle || submitting) return;
    setSubmitting(true);
    try {
      triggerHaptic(12);
      await onCreateFromParsed(parsed);
      setInput('');
    } finally {
      setSubmitting(false);
    }
  };

  const activeBusinesses = useMemo(
    () => businesses.filter((b) => b.isActive).slice(0, 6),
    [businesses]
  );

  return (
    <div
      className={`bg-white border transition-all rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        focused ? 'border-slate-900 ring-2 ring-slate-900/5' : 'border-slate-200'
      }`}
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <Plus className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          maxLength={240}
          aria-label="Natural language quick add task"
          className={`flex-1 min-w-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none ${
            compact ? 'text-xs sm:text-sm py-1.5' : 'text-sm py-2'
          }`}
        />
        {onOpenFullModal && (
          <button
            type="button"
            onClick={() => onOpenFullModal(parsed.cleanTitle || input.trim())}
            title="Open full task editor"
            className="min-w-[38px] min-h-[38px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!parsed.cleanTitle || submitting}
          className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{parsed.isHabit ? 'Add Habit' : 'Add'}</span>
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Live Parsed Preview Chips */}
      {hasPreview && (
        <div className="px-3.5 pb-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          {parsed.cleanTitle && (
            <span className="text-slate-700 font-medium truncate max-w-[260px]">
              “{parsed.cleanTitle}”
            </span>
          )}
          {parsed.business && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium"
              style={{ borderBottom: `2px solid ${parsed.business.colorHex}` }}
            >
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: parsed.business.colorHex }}
              />
              {parsed.business.name}
            </span>
          )}
          {parsed.project && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              @{parsed.project.name}
            </span>
          )}
          {parsed.priority === 'high' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-medium border border-red-200/70">
              <Flame className="w-3 h-3" />
              High Priority
            </span>
          )}
          {parsed.isMilestone && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-medium border border-amber-200/70">
              <Diamond className="w-3 h-3" />
              Milestone
            </span>
          )}
          {(parsed.hasExplicitDate || defaultDate) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono tabular-nums">
              <Calendar className="w-3 h-3 text-slate-500" />
              {formatShortDate(parsed.scheduledDate)}
            </span>
          )}
          {parsed.scheduledTime && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono tabular-nums">
              <Clock className="w-3 h-3 text-slate-500" />
              {formatTime12h(parsed.scheduledTime)}
            </span>
          )}
          {parsed.recurrenceRule !== 'none' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200/70">
              <Repeat className="w-3 h-3" />
              {parsed.recurrenceRule === 'daily'
                ? 'Every day (Habit)'
                : parsed.recurrenceRule === 'weekdays'
                  ? 'Weekdays (Habit)'
                  : 'Weekly (Habit)'}
            </span>
          )}
        </div>
      )}

      {/* Interactive Shorthand Helpers when focused */}
      {focused && !compact && (
        <div className="px-3.5 pb-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          {activeBusinesses.map((biz) => {
            const shortTag = `#${biz.name.split(/[\s&]+/)[0]}`;
            return (
              <button
                key={biz.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  appendToken(shortTag);
                }}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span
                  className="w-1.5 h-1.5 rounded-xs"
                  style={{ backgroundColor: biz.colorHex }}
                />
                {shortTag}
              </button>
            );
          })}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              appendToken('!high');
            }}
            className="px-2 py-1 rounded-md text-[11px] font-mono bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
          >
            !high
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              appendToken('*milestone');
            }}
            className="px-2 py-1 rounded-md text-[11px] font-mono bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors cursor-pointer"
          >
            *milestone
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              appendToken('tomorrow 9am');
            }}
            className="px-2 py-1 rounded-md text-[11px] font-mono bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          >
            tomorrow 9am
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              appendToken('every day 7am');
            }}
            className="px-2 py-1 rounded-md text-[11px] font-mono bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
          >
            every day 7am
          </button>
        </div>
      )}
    </div>
  );
}
