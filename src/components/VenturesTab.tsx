import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ListChecks,
  Square,
  X,
  ChevronDown,
  ChevronRight,
  Diamond,
  FolderPlus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { Business, Project, Task, TaskFile, TriggerReason } from '../types/empire';
import { formatShortDate } from '../utils/dateUtils';
import { BusinessIcon } from './BusinessIcon';
import { TaskCard } from './TaskCard';

interface VenturesTabProps {
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  filesMap: Map<string, TaskFile>;
  blockedTaskIds: Set<string>;
  focusedProject?: { businessId: string; projectId: string; nonce: number } | null;
  onAddBusiness: () => void;
  onEditBusiness: (business: Business) => void;
  onToggleBusinessActive: (business: Business) => void;
  onDeleteBusiness: (business: Business) => void;
  onAddProject: (businessId: string) => void;
  onEditProject: (project: Project) => void;
  onToggleProjectArchive: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onAddTaskInProject: (businessId: string, projectId: string, phaseHeading: string) => void;
  onToggleDone: (task: Task) => void;
  onLockIn: (task: Task) => void;
  onRealityCheck: (task: Task, reason: TriggerReason) => void;
  onReschedule: (task: Task, newDate: string, newTime: string) => void;
  onMarkMissed: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onPreviewFile: (file: TaskFile) => void;
  onCloseBusiness: (business: Business) => void;
  onCloseProject: (project: Project) => void;
  onBulkAction: (action: VentureBulkAction, selection: VentureSelection) => void;
}

export type VentureBulkAction = 'delete' | 'archive' | 'close';
export interface VentureSelection {
  businessIds: string[];
  projectIds: string[];
  taskIds: string[];
}

function SelectBox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={label}
      aria-pressed={checked}
      className="min-w-[36px] min-h-[36px] -ml-1.5 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
    >
      {checked ? (
        <CheckSquare className="w-5 h-5 text-slate-900" />
      ) : (
        <Square className="w-5 h-5" />
      )}
    </button>
  );
}

function CompletedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
      <CheckCircle2 className="w-3 h-3" />
      Completed
    </span>
  );
}

export function VenturesTab({
  businesses,
  projects,
  tasks,
  filesMap,
  blockedTaskIds,
  focusedProject,
  onAddBusiness,
  onEditBusiness,
  onToggleBusinessActive,
  onDeleteBusiness,
  onAddProject,
  onEditProject,
  onToggleProjectArchive,
  onDeleteProject,
  onAddTaskInProject,
  onToggleDone,
  onLockIn,
  onRealityCheck,
  onReschedule,
  onMarkMissed,
  onEditTask,
  onDeleteTask,
  onPreviewFile,
  onCloseBusiness,
  onCloseProject,
  onBulkAction,
}: VenturesTabProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selBiz, setSelBiz] = useState<Set<string>>(new Set());
  const [selProj, setSelProj] = useState<Set<string>>(new Set());
  const [selTask, setSelTask] = useState<Set<string>>(new Set());
  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => {
    setSelBiz(new Set());
    setSelProj(new Set());
    setSelTask(new Set());
  };
  const exitSelect = () => {
    clearSelection();
    setSelectMode(false);
  };
  const selectedCount = selBiz.size + selProj.size + selTask.size;
  const runBulk = (action: VentureBulkAction) => {
    if (selectedCount === 0) return;
    onBulkAction(action, {
      businessIds: [...selBiz],
      projectIds: [...selProj],
      taskIds: [...selTask],
    });
    exitSelect();
  };

  const [expandedBizIds, setExpandedBizIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    businesses.forEach((b) => {
      initial[b.id] = true;
    });
    return initial;
  });
  const [expandedProjIds, setExpandedProjIds] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!focusedProject) return;
    const proj = projects.find((p) => p.id === focusedProject.projectId);
    const biz = businesses.find((b) => b.id === focusedProject.businessId);
    if (proj?.isArchived || (biz && !biz.isActive)) {
      setShowArchived(true);
    }
    setExpandedBizIds((prev) => ({ ...prev, [focusedProject.businessId]: true }));
    setExpandedProjIds((prev) => ({ ...prev, [focusedProject.projectId]: true }));

    requestAnimationFrame(() => {
      const el = document.getElementById(`project-card-${focusedProject.projectId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusedProject, projects, businesses]);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const visibleBusinesses = useMemo(
    () => (showArchived ? businesses : businesses.filter((b) => b.isActive)),
    [businesses, showArchived]
  );

  const isBizExpanded = (id: string) => expandedBizIds[id] !== false;
  const toggleBiz = (id: string) =>
    setExpandedBizIds((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));
  const toggleProj = (id: string) =>
    setExpandedProjIds((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Ventures &amp; Projects
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            3-tier execution hierarchy across your businesses, projects, and phase headings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              selectMode
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            {selectMode ? 'Done Selecting' : 'Select'}
          </button>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showArchived
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {showArchived ? 'Showing Archived' : 'Show Archived'}
          </button>
          <button
            type="button"
            onClick={onAddBusiness}
            className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Business
          </button>
        </div>
      </div>

      {/* Expandable Businesses Directory */}
      <div className="space-y-4">
        {visibleBusinesses.map((biz) => {
          const bizProjects = projects.filter(
            (p) => p.businessId === biz.id && (showArchived || !p.isArchived)
          );
          const bizTasks = tasks.filter((t) => t.businessId === biz.id);
          const bizDone = bizTasks.filter((t) => t.status === 'done').length;
          const expanded = isBizExpanded(biz.id);
          const bizCompleted =
            !biz.isActive && bizTasks.length > 0 && bizTasks.every((t) => t.status === 'done');

          return (
            <section
              key={biz.id}
              className={`rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
                !biz.isActive ? 'opacity-65' : ''
              }`}
            >
              {/* Business Row Header */}
              <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 min-w-0 flex-1 basis-full sm:basis-0">
                {selectMode && (
                  <SelectBox
                    checked={selBiz.has(biz.id)}
                    onToggle={() => toggleIn(setSelBiz, biz.id)}
                    label={`Select ${biz.name}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => toggleBiz(biz.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${biz.colorHex}18` }}
                  >
                    <BusinessIcon icon={biz.icon} color={biz.colorHex} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
                        {biz.name}
                      </h3>
                      {bizCompleted ? (
                        <CompletedBadge />
                      ) : (
                        !biz.isActive && (
                          <span className="text-xs text-slate-400 font-medium">Archived</span>
                        )
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {bizProjects.length} projects · {bizDone}/{bizTasks.length} tasks done
                    </div>
                  </div>
                </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                  <button
                    type="button"
                    onClick={() => onAddProject(biz.id)}
                    className="min-h-[36px] px-3 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-xs font-medium text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
                    Project
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditBusiness(biz)}
                    aria-label={`Edit ${biz.name}`}
                    className="min-w-[36px] min-h-[36px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {biz.isActive && (
                    <button
                      type="button"
                      onClick={() => onCloseBusiness(biz)}
                      aria-label={`Close ${biz.name} as finished`}
                      title="Close as finished"
                      className="min-w-[36px] min-h-[36px] rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleBusinessActive(biz)}
                    aria-label={biz.isActive ? `Archive ${biz.name}` : `Restore ${biz.name}`}
                    title={biz.isActive ? 'Archive Business' : 'Restore Business'}
                    className="min-w-[36px] min-h-[36px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {biz.isActive ? (
                      <Archive className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBusiness(biz)}
                    aria-label={`Delete ${biz.name}`}
                    title="Delete Business"
                    className="min-w-[36px] min-h-[36px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Nested Projects */}
              {expanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/50">
                  {bizProjects.length === 0 ? (
                    <div className="p-4 sm:px-6 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>No projects under {biz.name} yet.</span>
                      <button
                        type="button"
                        onClick={() => onAddProject(biz.id)}
                        className="text-slate-900 hover:underline font-semibold cursor-pointer"
                      >
                        + Create Project
                      </button>
                    </div>
                  ) : (
                    bizProjects.map((proj) => {
                      const projTasks = tasks.filter((t) => t.projectId === proj.id);
                      const projDone = projTasks.filter((t) => t.status === 'done').length;
                      const pct =
                        projTasks.length === 0
                          ? 0
                          : Math.round((projDone / projTasks.length) * 100);
                      const milestones = projTasks.filter((t) => t.isMilestone);
                      const milestonesDone = milestones.filter((t) => t.status === 'done').length;
                      const projExpanded = Boolean(expandedProjIds[proj.id]);
                      const projCompleted =
                        proj.isArchived &&
                        projTasks.length > 0 &&
                        projTasks.every((t) => t.status === 'done');

                      const phases = [...proj.phaseHeadings];
                      const unphasedTasks = projTasks.filter(
                        (t) => !t.phaseHeading || !phases.includes(t.phaseHeading)
                      );

                      return (
                        <div
                          key={proj.id}
                          id={`project-card-${proj.id}`}
                          className="p-4 sm:px-6 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-1 flex-1 basis-full sm:basis-0 min-w-0">
                            {selectMode && (
                              <SelectBox
                                checked={selProj.has(proj.id)}
                                onToggle={() => toggleIn(setSelProj, proj.id)}
                                label={`Select ${proj.name}`}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => toggleProj(proj.id)}
                              className="flex-1 min-w-0 text-left space-y-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                {projExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <h4 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                                  {proj.name}
                                </h4>
                                {projCompleted ? (
                                  <CompletedBadge />
                                ) : (
                                  proj.isArchived && (
                                    <span className="text-xs text-slate-400">Archived</span>
                                  )
                                )}
                              </div>

                              {/* Live Project Progress Bar */}
                              <div className="flex items-center gap-3 pl-6">
                                <div className="flex-1 max-w-xs h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: biz.colorHex,
                                    }}
                                  />
                                </div>
                                <span className="font-mono tabular-nums text-xs font-medium text-slate-700">
                                  {pct}%
                                </span>
                                <span className="text-xs text-slate-500 font-mono tabular-nums">
                                  ({projDone}/{projTasks.length})
                                </span>
                              </div>

                              {/* Unboxed Metadata */}
                              <div className="pl-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                {proj.targetDate && (
                                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    Target {formatShortDate(proj.targetDate)}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                  <Diamond className="w-3 h-3 text-amber-600" />
                                  {milestonesDone}/{milestones.length} milestones
                                </span>
                                {proj.phaseHeadings.length > 0 && (
                                  <span>
                                    {proj.phaseHeadings.length} phases:{' '}
                                    {proj.phaseHeadings.join(' · ')}
                                  </span>
                                )}
                              </div>
                            </button>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                              <button
                                type="button"
                                onClick={() =>
                                  onAddTaskInProject(
                                    biz.id,
                                    proj.id,
                                    proj.phaseHeadings[0] || ''
                                  )
                                }
                                className="min-h-[34px] px-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-800 flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Task
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditProject(proj)}
                                aria-label={`Edit ${proj.name}`}
                                className="min-w-[34px] min-h-[34px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {!proj.isArchived && (
                                <button
                                  type="button"
                                  onClick={() => onCloseProject(proj)}
                                  aria-label={`Close ${proj.name} as finished`}
                                  title="Close as finished"
                                  className="min-w-[34px] min-h-[34px] rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 flex items-center justify-center cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onToggleProjectArchive(proj)}
                                aria-label={
                                  proj.isArchived
                                    ? `Unarchive ${proj.name}`
                                    : `Archive ${proj.name}`
                                }
                                title={proj.isArchived ? 'Restore Project' : 'Archive Project'}
                                className="min-w-[34px] min-h-[34px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer"
                              >
                                {proj.isArchived ? (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                ) : (
                                  <Archive className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProject(proj)}
                                aria-label={`Delete ${proj.name}`}
                                title="Delete Project"
                                className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Phase Headings & Tasks */}
                          {projExpanded && (
                            <div className="pl-2 sm:pl-6 pt-2 space-y-4">
                              {phases.map((phase) => {
                                const phaseTasks = projTasks.filter(
                                  (t) => t.phaseHeading === phase
                                );
                                return (
                                  <div key={phase} className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                      <h5 className="text-xs font-semibold text-slate-700">
                                        {phase}
                                        <span className="ml-2 font-mono text-slate-400">
                                          ({phaseTasks.length})
                                        </span>
                                      </h5>
                                      <button
                                        type="button"
                                        onClick={() => onAddTaskInProject(biz.id, proj.id, phase)}
                                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                                      >
                                        + Add to {phase}
                                      </button>
                                    </div>
                                    {phaseTasks.length === 0 ? (
                                      <p className="text-xs text-slate-400 py-1">
                                        No tasks in this phase yet.
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {phaseTasks.map((task) => {
                                          const isBlocked = blockedTaskIds.has(task.id);
                                          const blocker = task.blockedByTaskId
                                            ? taskMap.get(task.blockedByTaskId)
                                            : undefined;
                                          return (
                                            <div key={task.id} className="flex items-start gap-1">
                                              {selectMode && (
                                                <SelectBox
                                                  checked={selTask.has(task.id)}
                                                  onToggle={() => toggleIn(setSelTask, task.id)}
                                                  label={`Select ${task.title}`}
                                                />
                                              )}
                                              <div className="flex-1 min-w-0">
                                            <TaskCard
                                                                                            task={task}
                                              business={biz}
                                              project={proj}
                                              filesMap={filesMap}
                                              isBlocked={isBlocked}
                                              blockerTaskTitle={blocker?.title}
                                              onToggleDone={onToggleDone}
                                              onLockIn={onLockIn}
                                              onRealityCheck={onRealityCheck}
                                              onReschedule={onReschedule}
                                              onMarkMissed={onMarkMissed}
                                              onEdit={onEditTask}
                                              onDelete={onDeleteTask}
                                              onPreviewFile={onPreviewFile}
                                            />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {unphasedTasks.length > 0 && (
                                <div className="space-y-2">
                                  <h5 className="text-xs font-semibold text-slate-500 border-b border-slate-200 pb-1.5">
                                    General Tasks ({unphasedTasks.length})
                                  </h5>
                                  <div className="space-y-2">
                                    {unphasedTasks.map((task) => {
                                      const isBlocked = blockedTaskIds.has(task.id);
                                      const blocker = task.blockedByTaskId
                                        ? taskMap.get(task.blockedByTaskId)
                                        : undefined;
                                      return (
                                        <div key={task.id} className="flex items-start gap-1">
                                          {selectMode && (
                                            <SelectBox
                                              checked={selTask.has(task.id)}
                                              onToggle={() => toggleIn(setSelTask, task.id)}
                                              label={`Select ${task.title}`}
                                            />
                                          )}
                                          <div className="flex-1 min-w-0">
                                        <TaskCard
                                                                                    task={task}
                                          business={biz}
                                          project={proj}
                                          filesMap={filesMap}
                                          isBlocked={isBlocked}
                                          blockerTaskTitle={blocker?.title}
                                          onToggleDone={onToggleDone}
                                          onLockIn={onLockIn}
                                          onRealityCheck={onRealityCheck}
                                          onReschedule={onReschedule}
                                          onMarkMissed={onMarkMissed}
                                          onEdit={onEditTask}
                                          onDelete={onDeleteTask}
                                          onPreviewFile={onPreviewFile}
                                        />
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
                      );
                    })
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {selectMode && (
        <div className="fixed left-3 right-3 lg:left-auto lg:right-8 lg:w-[560px] fab-above-nav lg:bottom-8 z-50 rounded-2xl bg-slate-900 text-white shadow-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold px-1 mr-auto tabular-nums">
            {selectedCount} selected
          </span>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => runBulk('close')}
            className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Close
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => runBulk('archive')}
            className="min-h-[36px] px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => runBulk('delete')}
            className="min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <button
            type="button"
            onClick={exitSelect}
            aria-label="Cancel selection"
            className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
