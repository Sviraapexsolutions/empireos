import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Diamond,
  FolderKanban,
  Pencil,
  Search,
  Target,
  X,
} from 'lucide-react';
import type { Business, Project, Task } from '../types/empire';
import { formatShortDate } from '../utils/dateUtils';

interface GlobalSearchBarProps {
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  onSelectProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
  onLockInTask: (task: Task) => void;
}

export function GlobalSearchBar({
  businesses,
  projects,
  tasks,
  onSelectProject,
  onEditTask,
  onLockInTask,
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const bizMap = useMemo(() => new Map(businesses.map((b) => [b.id, b])), [businesses]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Keyboard shortcut: Cmd/Ctrl + K focuses global search; Escape closes
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Close popover on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const normalized = query.trim().toLowerCase();

  const matchedProjects = useMemo(() => {
    if (!normalized) return [];
    return projects
      .filter((proj) => {
        const bizName = bizMap.get(proj.businessId)?.name.toLowerCase() || '';
        const phases = proj.phaseHeadings.join(' ').toLowerCase();
        return (
          proj.name.toLowerCase().includes(normalized) ||
          bizName.includes(normalized) ||
          phases.includes(normalized)
        );
      })
      .slice(0, 6);
  }, [projects, bizMap, normalized]);

  const matchedTasks = useMemo(() => {
    if (!normalized) return [];
    return tasks
      .filter((task) => {
        const bizName = bizMap.get(task.businessId)?.name.toLowerCase() || '';
        const projName = task.projectId ? projMap.get(task.projectId)?.name.toLowerCase() || '' : '';
        const phase = (task.phaseHeading || '').toLowerCase();
        return (
          task.title.toLowerCase().includes(normalized) ||
          bizName.includes(normalized) ||
          projName.includes(normalized) ||
          phase.includes(normalized)
        );
      })
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        return a.scheduledDate.localeCompare(b.scheduledDate);
      })
      .slice(0, 10);
  }, [tasks, bizMap, projMap, normalized]);

  const totalMatches = matchedProjects.length + matchedTasks.length;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search tasks, projects, businesses, or phases..."
          aria-label="Global search across tasks and projects"
          className="w-full h-9 pl-9 pr-14 rounded-xl bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200/80 focus:border-slate-900 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 w-6 h-6 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px] text-slate-400 absolute right-2.5 pointer-events-none">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Results Popover */}
      {open && normalized.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {totalMatches === 0 ? (
            <div className="p-6 text-center space-y-1">
              <p className="text-sm font-medium text-slate-800">No matches for &ldquo;{query.trim()}&rdquo;</p>
              <p className="text-xs text-slate-500">
                Try searching by task title, project name, business venture, or phase heading.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Matched Projects */}
              {matchedProjects.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Projects ({matchedProjects.length})
                  </div>
                  <div className="space-y-0.5">
                    {matchedProjects.map((proj) => {
                      const biz = bizMap.get(proj.businessId);
                      const projTasks = tasks.filter((t) => t.projectId === proj.id);
                      const projDone = projTasks.filter((t) => t.status === 'done').length;
                      return (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            onSelectProject(proj);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ backgroundColor: `${biz?.colorHex || '#64748B'}18` }}
                            >
                              <FolderKanban
                                className="w-3.5 h-3.5"
                                style={{ color: biz?.colorHex || '#64748B' }}
                              />
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                                {proj.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {biz?.name || 'Venture'}
                                {proj.phaseHeadings.length > 0
                                  ? ` · ${proj.phaseHeadings.join(' / ')}`
                                  : ''}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                            {projDone}/{projTasks.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Matched Tasks */}
              {matchedTasks.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Tasks ({matchedTasks.length})
                  </div>
                  <div className="space-y-0.5">
                    {matchedTasks.map((task) => {
                      const biz = bizMap.get(task.businessId);
                      const proj = task.projectId ? projMap.get(task.projectId) : undefined;
                      const isDone = task.status === 'done';
                      return (
                        <div
                          key={task.id}
                          className="px-2.5 py-2 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onEditTask(task);
                            }}
                            className="flex items-start gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {task.isMilestone && (
                                  <Diamond className="w-3 h-3 text-amber-600 shrink-0" />
                                )}
                                <span
                                  className={`text-xs sm:text-sm font-medium truncate ${
                                    isDone ? 'line-through text-slate-400' : 'text-slate-900'
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                                <span
                                  className="w-2 h-2 rounded-xs shrink-0"
                                  style={{ backgroundColor: biz?.colorHex || '#64748B' }}
                                />
                                <span className="truncate">
                                  {biz?.name || 'Venture'}
                                  {proj ? ` · ${proj.name}` : ''}
                                  {task.phaseHeading ? ` / ${task.phaseHeading}` : ''}
                                </span>
                                <span>·</span>
                                <span className="font-mono shrink-0">
                                  {formatShortDate(task.scheduledDate)}
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {!isDone && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpen(false);
                                  onLockInTask(task);
                                }}
                                title="Lock In on this task"
                                className="min-w-[30px] min-h-[30px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center cursor-pointer"
                              >
                                <Target className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                onEditTask(task);
                              }}
                              title="Edit task"
                              className="min-w-[30px] min-h-[30px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
