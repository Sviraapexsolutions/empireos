import { useState } from 'react';
import {
  AlertOctagon,
  CalendarClock,
  Check,
  Clock,
  Diamond,
  FileText,
  Flame,
  Image as ImageIcon,
  Lock,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  Target,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { Business, Project, Task, TaskFile } from '../types/empire';
import {
  addDays,
  formatShortDate,
  formatTime12h,
  getTodayKey,
  isTimePassedToday,
  triggerHaptic,
} from '../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  business?: Business;
  project?: Project;
  filesMap?: Map<string, TaskFile>;
  isRolledOver?: boolean;
  isBlocked?: boolean;
  blockerTaskTitle?: string;
  onToggleDone: (task: Task) => void;
  onLockIn: (task: Task) => void;
  onRealityCheck: (task: Task, reason: 'manual' | 'rescheduled' | 'missed' | 'overdue') => void;
  onReschedule: (task: Task, newDate: string, newTime: string) => void;
  onMarkMissed: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onPreviewFile?: (file: TaskFile) => void;
}

export function TaskCard({
  task,
  business,
  project,
  filesMap,
  isRolledOver = false,
  isBlocked = false,
  blockerTaskTitle,
  onToggleDone,
  onLockIn,
  onRealityCheck,
  onReschedule,
  onMarkMissed,
  onEdit,
  onDelete,
  onPreviewFile,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(addDays(getTodayKey(), 1));
  const [rescheduleTime, setRescheduleTime] = useState(task.scheduledTime || '');

  const isDone = task.status === 'done';
  const isMissed = task.status === 'missed';
  const isOverdueTime =
    !isDone && !isMissed && isTimePassedToday(task.scheduledDate, task.scheduledTime);
  const accentColor = business?.colorHex || '#D97706';

  const handleCheckboxClick = () => {
    if (isBlocked) return;
    triggerHaptic(isDone ? 8 : [14, 24, 14]);
    onToggleDone(task);
  };

  return (
    <div
      className={`group relative rounded-xl bg-white border transition-all shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
        isRolledOver && !isDone
          ? 'border-red-300 bg-red-50/25'
          : isOverdueTime
            ? 'border-amber-300'
            : 'border-slate-200 hover:border-slate-300'
      } ${isDone ? 'opacity-65 bg-slate-50/70' : ''}`}
    >
      <div className="p-3.5 sm:p-4 flex items-start gap-3">
        {/* 44px Tactile Haptic Checkbox */}
        <button
          type="button"
          disabled={isBlocked}
          onClick={handleCheckboxClick}
          aria-label={isDone ? `Mark "${task.title}" pending` : `Complete "${task.title}"`}
          className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          <span
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-150 ${
              isBlocked
                ? 'border-slate-300 bg-slate-100 text-slate-400'
                : isDone
                  ? 'border-emerald-600 bg-emerald-600 text-white scale-100'
                  : 'border-slate-300 bg-white hover:border-slate-900 active:scale-90'
            }`}
            style={
              !isDone && !isBlocked && task.priority === 'high'
                ? { borderColor: '#DC2626' }
                : undefined
            }
          >
            {isBlocked ? (
              <Lock className="w-3 h-3" />
            ) : isDone ? (
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            ) : null}
          </span>
        </button>

        {/* Main Task Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Top Title Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              {task.isMilestone && (
                <Diamond
                  className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 fill-amber-100"
                  aria-label="Milestone"
                />
              )}
              <h4
                className={`text-sm sm:text-[15px] font-medium leading-snug break-words ${
                  isDone
                    ? 'line-through text-slate-400'
                    : isMissed
                      ? 'text-red-500/80 line-through'
                      : 'text-slate-900'
                }`}
              >
                {task.title}
              </h4>
            </div>

            {/* Primary CTA: Lock In + Quick Edit + Quick Menu */}
            <div className="flex items-center gap-1 shrink-0">
              {!isDone && !isBlocked && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(12);
                    onLockIn(task);
                  }}
                  aria-label="Lock In"
                  title="Lock In"
                  className="min-h-[34px] px-2.5 rounded-lg bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 border border-slate-200/80 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lock In</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label={`Edit "${task.title}"`}
                title="Edit task"
                className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Task actions"
                  className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 z-30 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onRealityCheck(task, isOverdueTime ? 'overdue' : 'manual');
                        }}
                        className="w-full px-3 py-2 text-left text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Reality Check
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setRescheduleOpen(true);
                        }}
                        className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                        Reschedule
                      </button>
                      {!isDone && !isMissed && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onMarkMissed(task);
                          }}
                          className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Mark Missed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(task);
                        }}
                        className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        Edit Details
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(task);
                        }}
                        className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Task
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Unboxed Typographic Metadata Row */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
            {/* Business • Project Color Indicator */}
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <span>
                {business?.name || 'Venture'}
                {project ? ` · ${project.name}` : ''}
                {task.phaseHeading ? ` / ${task.phaseHeading}` : ''}
              </span>
            </span>

            {task.scheduledTime && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                    isOverdueTime ? 'text-amber-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {formatTime12h(task.scheduledTime)}
                  {isOverdueTime ? ' (Past due)' : ''}
                </span>
              </>
            )}

            {task.priority === 'high' && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                  <Flame className="w-3 h-3" />
                  High Priority
                </span>
              </>
            )}

            {isRolledOver && !isDone && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                  <AlertOctagon className="w-3 h-3" />
                  Rolled Over ({formatShortDate(task.scheduledDate)})
                </span>
              </>
            )}

            {task.hardDeadline && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  Due {formatShortDate(task.hardDeadline)}
                </span>
              </>
            )}

            {isMissed && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-red-600 font-medium">Missed</span>
              </>
            )}

            {isBlocked && blockerTaskTitle && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Blocked by: {blockerTaskTitle}
                </span>
              </>
            )}
          </div>

          {/* Attached PDFs & Photos */}
          {task.attachmentIds && task.attachmentIds.length > 0 && filesMap && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {task.attachmentIds
                .map((id) => filesMap.get(id))
                .filter((f): f is TaskFile => Boolean(f))
                .map((file) => {
                  const isPdf = file.kind === 'pdf';
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => onPreviewFile?.(file)}
                      className="inline-flex items-center gap-1.5 max-w-[200px] px-2 py-1 rounded-lg bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                    >
                      {isPdf ? (
                        <FileText className="w-3 h-3 text-red-600 shrink-0" />
                      ) : (
                        <ImageIcon className="w-3 h-3 text-blue-600 shrink-0" />
                      )}
                      <span className="truncate">{file.name}</span>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Inline Reality Check Quick Trigger for Overdue / Rolled Over Tasks */}
          {!isDone && !isBlocked && (isRolledOver || isOverdueTime) && (
            <div className="pt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onRealityCheck(task, 'overdue')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Trigger Reality Check
              </button>
              {isRolledOver && (
                <button
                  type="button"
                  onClick={() => onReschedule(task, getTodayKey(), task.scheduledTime)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Pull to Today
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline Reschedule Drawer */}
      {rescheduleOpen && (
        <div className="px-4 pb-3.5 pt-2.5 border-t border-slate-100 bg-slate-50 rounded-b-xl flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 font-mono"
          />
          <input
            type="time"
            value={rescheduleTime}
            onChange={(e) => setRescheduleTime(e.target.value)}
            className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 font-mono"
          />
          <button
            type="button"
            onClick={() => {
              setRescheduleOpen(false);
              onReschedule(task, rescheduleDate, rescheduleTime);
            }}
            className="min-h-[36px] px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Save &amp; Reality Check
          </button>
          <button
            type="button"
            onClick={() => setRescheduleOpen(false)}
            className="min-h-[36px] px-2.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
