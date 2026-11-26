import React, { useEffect, useRef, useState } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showNotificationNow,
} from '../services/notifications';
import {
  Bell,
  BellRing,
  Camera,
  Check,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  Business,
  BusinessIconKey,
  Habit,
  HabitRecurrenceRule,
  Project,
  RecurrenceRule,
  Task,
  TaskFile,
  TaskPriority,
  UserProfile,
} from '../types/empire';
import { getTodayKey } from '../utils/dateUtils';
import { formatFileSize } from '../utils/fileVault';
import { BUSINESS_ICON_OPTIONS, BusinessIcon } from './BusinessIcon';

const COLOR_SWATCHES = [
  '#F59E0B',
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#14B8A6',
  '#EF4444',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#84CC16',
];

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="sticky top-0 z-10 px-5 py-4 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[36px] min-h-[36px] rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// --- 1. BUSINESS MODAL ---
export function BusinessModal({
  open,
  editing,
  nextSortOrder,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Business | null;
  nextSortOrder: number;
  onClose: () => void;
  onSave: (data: { name: string; colorHex: string; icon: BusinessIconKey; sortOrder: number }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#F59E0B');
  const [icon, setIcon] = useState<BusinessIconKey>('briefcase');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name || '');
    setColorHex(editing?.colorHex || '#F59E0B');
    setIcon(editing?.icon || 'briefcase');
  }, [open, editing]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        colorHex,
        icon,
        sortOrder: editing ? editing.sortOrder : nextSortOrder,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? 'Edit Business' : 'Add New Business'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Business / Venture Name</label>
          <input
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sundaram Logistics"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">Accent Color</label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColorHex(hex)}
                aria-label={`Select color ${hex}`}
                className={`w-8 h-8 rounded-lg transition-transform cursor-pointer ${
                  colorHex.toUpperCase() === hex.toUpperCase()
                    ? 'ring-2 ring-slate-900 ring-offset-2 scale-105'
                    : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">Icon</label>
          <div className="grid grid-cols-5 gap-2">
            {BUSINESS_ICON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setIcon(opt.key)}
                className={`min-h-[44px] rounded-xl border flex flex-col items-center justify-center gap-1 text-[10px] transition-colors cursor-pointer ${
                  icon === opt.key
                    ? 'bg-slate-100 border-slate-900 text-slate-900 font-medium'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                }`}
              >
                <BusinessIcon icon={opt.key} color={icon === opt.key ? colorHex : undefined} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Business'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// --- 2. PROJECT MODAL (WITH PHASE HEADINGS MANAGER) ---
export function ProjectModal({
  open,
  businesses,
  defaultBusinessId,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  businesses: Business[];
  defaultBusinessId: string;
  editing: Project | null;
  onClose: () => void;
  onSave: (data: {
    businessId: string;
    name: string;
    phaseHeadings: string[];
    targetDate: string;
  }) => Promise<void>;
}) {
  const [businessId, setBusinessId] = useState(defaultBusinessId);
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [phases, setPhases] = useState<string[]>(['Civil Work', 'Setup', 'Launch']);
  const [newPhase, setNewPhase] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusinessId(editing?.businessId || defaultBusinessId || businesses[0]?.id || '');
    setName(editing?.name || '');
    setTargetDate(editing?.targetDate || '');
    setPhases(editing ? [...editing.phaseHeadings] : ['Civil Work', 'Setup', 'Launch']);
    setNewPhase('');
  }, [open, editing, defaultBusinessId, businesses]);

  if (!open) return null;

  const addPhase = () => {
    const trimmed = newPhase.trim().slice(0, 80);
    if (!trimmed || phases.includes(trimmed) || phases.length >= 20) return;
    setPhases((prev) => [...prev, trimmed]);
    setNewPhase('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessId || saving) return;
    setSaving(true);
    try {
      await onSave({
        businessId,
        name: name.trim(),
        phaseHeadings: phases,
        targetDate,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? 'Edit Project & Phases' : 'Create New Project'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Parent Business</label>
          <select
            value={businessId}
            disabled={Boolean(editing)}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 disabled:opacity-60 disabled:bg-slate-50"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Project Name</label>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Forecourt Canopy & Tank Installation"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Target Completion Date (Optional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">Phase Headings</label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={80}
              value={newPhase}
              onChange={(e) => setNewPhase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPhase();
                }
              }}
              placeholder="Add phase (e.g. Permits, Civil Work, Launch)"
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
            />
            <button
              type="button"
              onClick={addPhase}
              className="min-h-[40px] px-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-200/70 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {phases.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {phases.map((ph, idx) => (
                <div
                  key={`${ph}-${idx}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-800"
                >
                  <span>
                    <span className="font-mono text-slate-400 mr-2">{idx + 1}.</span>
                    {ph}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhases((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={`Remove ${ph}`}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : editing ? 'Save Project' : 'Create Project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// --- 3. FULL TASK MODAL ---
export function TaskModal({
  open,
  businesses,
  projects,
  allTasks,
  libraryFiles,
  editing,
  defaults,
  onClose,
  onSave,
  onUploadFile,
  onPreviewFile,
}: {
  open: boolean;
  businesses: Business[];
  projects: Project[];
  allTasks: Task[];
  libraryFiles: TaskFile[];
  editing: Task | null;
  defaults?: {
    title?: string;
    businessId?: string;
    projectId?: string;
    phaseHeading?: string;
    scheduledDate?: string;
  };
  onClose: () => void;
  onSave: (data: {
    title: string;
    businessId: string;
    projectId: string;
    phaseHeading: string;
    scheduledDate: string;
    scheduledTime: string;
    hardDeadline: string;
    priority: TaskPriority;
    isMilestone: boolean;
    blockedByTaskId: string;
    isHabit: boolean;
    recurrenceRule: RecurrenceRule;
    attachmentIds: string[];
  }) => Promise<void>;
  onUploadFile: (file: File) => Promise<TaskFile>;
  onPreviewFile: (file: TaskFile) => void;
}) {
  const [title, setTitle] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [phaseHeading, setPhaseHeading] = useState('');
  const [scheduledDate, setScheduledDate] = useState(getTodayKey());
  const [scheduledTime, setScheduledTime] = useState('');
  const [hardDeadline, setHardDeadline] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('standard');
  const [isMilestone, setIsMilestone] = useState(false);
  const [blockedByTaskId, setBlockedByTaskId] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>('none');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setUploadError('');
    setPickerOpen(false);
    setDragOver(false);
    if (editing) {
      setTitle(editing.title);
      setBusinessId(editing.businessId);
      setProjectId(editing.projectId);
      setPhaseHeading(editing.phaseHeading);
      setScheduledDate(editing.scheduledDate);
      setScheduledTime(editing.scheduledTime);
      setHardDeadline(editing.hardDeadline);
      setPriority(editing.priority);
      setIsMilestone(editing.isMilestone);
      setBlockedByTaskId(editing.blockedByTaskId);
      setRecurrenceRule(editing.recurrenceRule);
      setAttachmentIds(editing.attachmentIds ? [...editing.attachmentIds] : []);
    } else {
      setTitle(defaults?.title || '');
      setBusinessId(defaults?.businessId || businesses[0]?.id || '');
      setProjectId(defaults?.projectId || '');
      setPhaseHeading(defaults?.phaseHeading || '');
      setScheduledDate(defaults?.scheduledDate || getTodayKey());
      setScheduledTime('');
      setHardDeadline('');
      setPriority('standard');
      setIsMilestone(false);
      setBlockedByTaskId('');
      setRecurrenceRule('none');
      setAttachmentIds([]);
    }
  }, [open, editing, defaults, businesses]);

  if (!open) return null;

  const matchingProjects = projects.filter((p) => p.businessId === businessId && !p.isArchived);
  const selectedProject = matchingProjects.find((p) => p.id === projectId);
  const blockerCandidates = allTasks.filter((t) => t.id !== editing?.id && t.status !== 'done');
  const fileMap = new Map(libraryFiles.map((f) => [f.id, f]));
  const attachedFiles = attachmentIds
    .map((id) => fileMap.get(id))
    .filter((f): f is TaskFile => Boolean(f));

  const toggleAttachment = (fileId: string) => {
    setAttachmentIds((prev) => {
      if (prev.includes(fileId)) return prev.filter((id) => id !== fileId);
      if (prev.length >= 10) {
        setUploadError('You can attach up to 10 files per task.');
        return prev;
      }
      setUploadError('');
      return [...prev, fileId];
    });
  };

  const processSelectedFiles = async (selected: File[]) => {
    if (selected.length === 0) return;
    setUploadError('');
    setUploading(true);
    try {
      const addedIds: string[] = [];
      for (const f of selected) {
        if (attachmentIds.length + addedIds.length >= 10) {
          setUploadError('Maximum of 10 files per task reached.');
          break;
        }
        const saved = await onUploadFile(f);
        addedIds.push(saved.id);
      }
      if (addedIds.length > 0) {
        setAttachmentIds((prev) => Array.from(new Set([...prev, ...addedIds])).slice(0, 10));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processSelectedFiles(Array.from(e.target.files || []));
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    await processSelectedFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !businessId || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        businessId,
        projectId,
        phaseHeading,
        scheduledDate,
        scheduledTime,
        hardDeadline,
        priority,
        isMilestone,
        blockedByTaskId,
        isHabit: recurrenceRule !== 'none',
        recurrenceRule,
        attachmentIds,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? 'Edit Task' : 'New Executive Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {businesses.length === 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-800 leading-relaxed">
            Create at least one Venture in the <strong>Ventures</strong> tab before adding tasks.
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Task Title</label>
          <input
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Concrete, verb-first outcome"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Business</label>
            <select
              value={businessId}
              onChange={(e) => {
                setBusinessId(e.target.value);
                setProjectId('');
                setPhaseHeading('');
              }}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Project (Optional)</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPhaseHeading('');
              }}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900"
            >
              <option value="">None</option>
              {matchingProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProject && selectedProject.phaseHeadings.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Phase Heading</label>
            <select
              value={phaseHeading}
              onChange={(e) => setPhaseHeading(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900"
            >
              <option value="">General</option>
              {selectedProject.phaseHeadings.map((ph) => (
                <option key={ph} value={ph}>
                  {ph}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Scheduled Date</label>
            <input
              type="date"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Reminder Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Hard Deadline</label>
            <input
              type="date"
              value={hardDeadline}
              onChange={(e) => setHardDeadline(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Priority</label>
            <div className="grid grid-cols-2 gap-2">
              {(['standard', 'high'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`min-h-[40px] rounded-xl border text-xs font-semibold capitalize cursor-pointer ${
                    priority === p
                      ? p === 'high'
                        ? 'bg-red-50 border-red-400 text-red-700'
                        : 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Recurrence</label>
            <select
              value={recurrenceRule}
              onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceRule)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900"
            >
              <option value="none">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">
            Blocked By Prerequisite Task (Optional)
          </label>
          <select
            value={blockedByTaskId}
            onChange={(e) => setBlockedByTaskId(e.target.value)}
            className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900"
          >
            <option value="">None (Unblocked)</option>
            {blockerCandidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            Tasks with an incomplete prerequisite stay hidden from Today until the blocker finishes.
          </p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={isMilestone}
            onChange={(e) => setIsMilestone(e.target.checked)}
            className="w-4 h-4 accent-slate-900 rounded"
          />
          <span className="text-xs font-medium text-slate-700">
            Mark as Diamond Milestone (high-impact project gate)
          </span>
        </label>

        {/* PDF & Photo Attachments Upload Area (Camera, Device Gallery, Files, Saved Library) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void handleDropFiles(e)}
          className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
            dragOver
              ? 'bg-amber-50/70 border-amber-400 border-dashed'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              <span>Attachments (PDFs &amp; Photos)</span>
              <span className="font-mono text-[11px] text-slate-400">
                ({attachmentIds.length}/10)
              </span>
            </div>

            {libraryFiles.length > 0 && (
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="min-h-[30px] px-2.5 rounded-lg bg-white border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {pickerOpen ? 'Hide Saved Library' : `Choose Saved (${libraryFiles.length})`}
              </button>
            )}
          </div>

          {/* Hidden Inputs: Camera, Device Gallery, PDF/Files */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Interactive Dropzone + Source Buttons */}
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 space-y-2.5 text-center">
            <p className="text-[11px] text-slate-500">
              {uploading
                ? 'Uploading files to your workspace vault…'
                : 'Drag & drop PDFs or photos here, or pick from camera, gallery, or files'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[34px] px-3 rounded-lg bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                Camera
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[34px] px-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-200/80 disabled:opacity-50 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                Photo Gallery
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[34px] px-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-semibold inline-flex items-center gap-1.5 hover:bg-slate-200/80 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-red-600" />
                PDF / Files
              </button>
            </div>
          </div>

          {uploadError && (
            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
              {uploadError}
            </div>
          )}

          {/* Currently Attached Files */}
          {attachedFiles.length > 0 ? (
            <div className="space-y-1.5">
              {attachedFiles.map((file) => {
                const isPdf = file.kind === 'pdf';
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onPreviewFile(file)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      {isPdf ? (
                        <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                      <span className="truncate font-medium text-slate-800">{file.name}</span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {formatFileSize(file.sizeBytes)}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPreviewFile(file)}
                        aria-label={`Preview ${file.name}`}
                        className="p-1 rounded text-slate-400 hover:text-slate-800 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttachment(file.id)}
                        aria-label={`Remove ${file.name}`}
                        className="p-1 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Attach PDFs or photos directly, or pick from files already saved in your library.
            </p>
          )}

          {/* Reusable File Library Picker */}
          {pickerOpen && libraryFiles.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5 max-h-44 overflow-y-auto">
              <div className="text-[11px] font-medium text-slate-500">
                Select files from your library:
              </div>
              {libraryFiles.map((file) => {
                const selected = attachmentIds.includes(file.id);
                const isPdf = file.kind === 'pdf';
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => toggleAttachment(file.id)}
                    className={`w-full px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 text-left text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {isPdf ? (
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${selected ? 'text-red-300' : 'text-red-600'}`}
                        />
                      ) : (
                        <ImageIcon
                          className={`w-3.5 h-3.5 shrink-0 ${selected ? 'text-blue-300' : 'text-blue-600'}`}
                        />
                      )}
                      <span className="truncate font-medium">{file.name}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono text-[10px] ${
                          selected ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {formatFileSize(file.sizeBytes)}
                      </span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !businessId}
            className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// --- 4. HABIT MODAL ---
export function HabitModal({
  open,
  businesses,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  businesses: Business[];
  editing: Habit | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    businessId: string;
    scheduledTime: string;
    recurrenceRule: HabitRecurrenceRule;
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('07:00');
  const [recurrenceRule, setRecurrenceRule] = useState<HabitRecurrenceRule>('daily');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title || '');
    setBusinessId(editing?.businessId || businesses.find((b) => b.name === 'Personal')?.id || businesses[0]?.id || '');
    setScheduledTime(editing?.scheduledTime || '07:00');
    setRecurrenceRule(editing?.recurrenceRule || 'daily');
  }, [open, editing, businesses]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !businessId || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        businessId,
        scheduledTime,
        recurrenceRule,
        isActive: editing ? editing.isActive : true,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={editing ? 'Edit Habit' : 'New Daily Habit'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Habit Title</label>
          <input
            type="text"
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 06:00 Strength Training"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Business / Area</label>
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-sm text-slate-900"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Cadence</label>
            <select
              value={recurrenceRule}
              onChange={(e) => setRecurrenceRule(e.target.value as HabitRecurrenceRule)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-sm text-slate-900"
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Target Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : editing ? 'Save Habit' : 'Create Habit'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// --- 5. EXECUTIVE NOTIFICATIONS & CADENCE MODAL ---
export function NotificationsModal({
  open,
  profile,
  onClose,
  onSavePrefs,
  onTestAlert,
}: {
  open: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSavePrefs: (prefs: {
    morningBriefingEnabled: boolean;
    middayStallAlertEnabled: boolean;
    nightAuditEnabled: boolean;
  }) => Promise<void>;
  onTestAlert: (kind: 'briefing' | 'stall' | 'audit') => void;
}) {
  const [morning, setMorning] = useState(true);
  const [midday, setMidday] = useState(true);
  const [night, setNight] = useState(true);
  const [perm, setPerm] = useState<string>('default');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMorning(profile?.morningBriefingEnabled ?? true);
    setMidday(profile?.middayStallAlertEnabled ?? true);
    setNight(profile?.nightAuditEnabled ?? true);
    void getNotificationPermission().then(setPerm);
  }, [open, profile]);

  if (!open) return null;

  const requestBrowserPermission = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === 'granted') {
      void showNotificationNow('EmpireOS notifications on', 'You will get task reminders and daily briefings here.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSavePrefs({
        morningBriefingEnabled: morning,
        middayStallAlertEnabled: midday,
        nightAuditEnabled: night,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Executive Alerts & Cadence" onClose={onClose}>
      <div className="space-y-5">
        {/* Browser Push Permission Card */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              {perm === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">System Notifications</div>
              <p className="text-xs text-slate-500">
                {perm === 'granted'
                  ? 'Enabled for exact task reminders and daily briefings.'
                  : perm === 'denied'
                    ? 'Blocked. Turn notifications on for EmpireOS in your phone Settings. In-app banners remain active.'
                    : perm === 'unsupported'
                      ? 'On iPhone, add EmpireOS to your Home Screen first, then open it from there to enable notifications.'
                      : 'Allow notifications for exact reminder times and briefings.'}
              </p>
            </div>
          </div>
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              type="button"
              onClick={requestBrowserPermission}
              className="min-h-[38px] px-3 rounded-lg bg-slate-900 text-white font-semibold text-xs whitespace-nowrap shrink-0 hover:bg-slate-800 cursor-pointer"
            >
              Enable
            </button>
          )}
        </div>

        {/* Daily Cadence Schedules */}
        <div className="space-y-2.5">
          {[
            {
              key: 'briefing' as const,
              time: '08:00 AM',
              title: 'Morning Briefing',
              desc: 'Delivers your top 3 highest-leverage priority tasks.',
              enabled: morning,
              toggle: () => setMorning((v) => !v),
            },
            {
              key: 'stall' as const,
              time: '02:00 PM',
              title: 'Mid-Day Stall Alert',
              desc: 'Triggers if your daily execution rate is below 30%.',
              enabled: midday,
              toggle: () => setMidday((v) => !v),
            },
            {
              key: 'audit' as const,
              time: '09:30 PM',
              title: 'Night Execution Audit',
              desc: 'Summarizes completed vs. missed commitments for the day.',
              enabled: night,
              toggle: () => setNight((v) => !v),
            },
          ].map((item) => (
            <div
              key={item.key}
              className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-amber-700">{item.time}</span>
                  <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                </div>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onTestAlert(item.key)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Preview
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  onClick={item.toggle}
                  className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                    item.enabled ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                      item.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
