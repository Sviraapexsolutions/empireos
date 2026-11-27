import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2, Mic, MicOff, Sparkles, Trash2, X } from 'lucide-react';
import type { AiProvider, Business, Project } from '../types/empire';
import { getTodayKey } from '../utils/dateUtils';
import { parseQuickAddInput } from '../utils/nlParser';
import { parseVoiceToTasks, type VoiceTaskDraft } from '../services/aiCoach';

export interface VoiceTaskToCreate {
  title: string;
  businessId: string;
  projectId: string;
  phaseHeading: string;
  date: string;
  time: string;
  priority: 'high' | 'standard';
  repeat: 'none' | 'daily' | 'weekdays' | 'weekly';
  isMilestone: boolean;
}

interface Draft extends VoiceTaskToCreate {
  key: string;
  include: boolean;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface VoiceCaptureModalProps {
  open: boolean;
  businesses: Business[];
  projects: Project[];
  aiProvider: AiProvider;
  onClose: () => void;
  onAdd: (tasks: VoiceTaskToCreate[]) => Promise<void>;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function VoiceCaptureModal({ open, businesses, projects, aiProvider, onClose, onAdd }: VoiceCaptureModalProps) {
  const activeBiz = useMemo(() => businesses.filter((b) => b.isActive), [businesses]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);
  const RecognitionCtor = useMemo(() => getRecognitionCtor(), []);

  const [phase, setPhase] = useState<'capture' | 'review'>('capture');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (!open) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    setPhase('capture');
    setTranscript('');
    setInterim('');
    setError('');
    setNote('');
    setDrafts([]);
  }, [open]);

  if (!open) return null;

  const startListening = () => {
    if (!RecognitionCtor) return;
    setError('');
    try {
      const rec = new RecognitionCtor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let finalText = '';
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interimText += r[0].transcript;
        }
        if (finalText) setTranscript((prev) => `${prev ? `${prev} ` : ''}${finalText.trim()}`);
        setInterim(interimText);
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setError('Microphone access was blocked. Allow the microphone for this app, or type / use your keyboard’s mic below.');
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          setError(`Voice input stopped (${e.error}). You can type or use your keyboard’s mic below.`);
        }
      };
      rec.onend = () => {
        setListening(false);
        setInterim('');
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setError('Voice input is not available here. Use the mic on your keyboard instead.');
    }
  };

  const stopListening = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const matchBiz = (name: string): Business | undefined => {
    const n = name.trim().toLowerCase();
    if (!n) return undefined;
    return (
      activeBiz.find((b) => b.name.toLowerCase() === n) ||
      activeBiz.find((b) => b.name.toLowerCase().includes(n) || n.includes(b.name.toLowerCase()))
    );
  };

  const toDraft = (d: VoiceTaskDraft, i: number): Draft => {
    const proj = d.project
      ? activeProjects.find((p) => p.name.toLowerCase() === d.project.toLowerCase())
      : undefined;
    const biz = (proj && businesses.find((b) => b.id === proj.businessId)) || matchBiz(d.venture) || activeBiz[0];
    return {
      key: `d${i}_${Date.now()}`,
      include: true,
      title: d.title,
      businessId: biz?.id || '',
      projectId: proj?.id || '',
      phaseHeading: proj?.phaseHeadings[0] || '',
      date: d.date,
      time: d.time,
      priority: d.priority,
      repeat: d.repeat,
      isMilestone: d.isMilestone,
    };
  };

  const understand = async () => {
    stopListening();
    const text = `${transcript} ${interim}`.trim();
    if (!text) {
      setError('Say or type what you need to do first.');
      return;
    }
    setParsing(true);
    setError('');
    setNote('');
    const today = getTodayKey();
    try {
      const [y, m, d] = today.split('-').map(Number);
      const list = await parseVoiceToTasks(aiProvider, text, {
        today,
        weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()],
        ventures: activeBiz.map((b) => b.name),
        projects: activeProjects.map((p) => ({
          name: p.name,
          venture: businesses.find((b) => b.id === p.businessId)?.name || '',
        })),
      });
      if (list.length === 0) throw new Error('EMPTY');
      setDrafts(list.map(toDraft));
    } catch (err) {
      // Fallback: built-in parser (no AI key, offline, or AI error)
      const parsed = parseQuickAddInput(text, activeBiz, activeProjects, today);
      setDrafts([
        {
          key: `d0_${Date.now()}`,
          include: true,
          title: parsed.cleanTitle || text,
          businessId: parsed.business?.id || activeBiz[0]?.id || '',
          projectId: parsed.project?.id || '',
          phaseHeading: parsed.project?.phaseHeadings[0] || '',
          date: parsed.scheduledDate,
          time: parsed.scheduledTime,
          priority: parsed.priority,
          repeat: parsed.recurrenceRule,
          isMilestone: parsed.isMilestone,
        },
      ]);
      const msg = err instanceof Error ? err.message : '';
      setNote(
        msg === 'NO_KEY'
          ? 'Basic understanding used. Add your Gemini key in Settings for smarter parsing (Hindi/Hinglish, multiple tasks).'
          : 'AI could not be reached, so basic understanding was used. Please check the details.'
      );
    } finally {
      setParsing(false);
      setPhase('review');
    }
  };

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const selected = drafts.filter((d) => d.include && d.title.trim() && d.businessId);

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await onAdd(selected.map(({ key: _k, include: _i, ...rest }) => rest));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the tasks.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full min-h-[40px] px-2.5 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40 cursor-default" />
      <div className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {phase === 'review' && (
              <button type="button" onClick={() => setPhase('capture')} aria-label="Back" className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {phase === 'capture' ? 'Voice Add' : 'Here’s what I understood'}
              </h2>
              <p className="text-xs text-slate-500">
                {phase === 'capture'
                  ? 'Speak naturally — e.g. “Call Shashank about Pidilite rates Friday 11 am, urgent”.'
                  : 'Check and edit before adding. Nothing is saved until you tap Add.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="min-w-[36px] min-h-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === 'capture' ? (
          <div className="space-y-4">
            {RecognitionCtor ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? 'Stop listening' : 'Start listening'}
                  className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                    listening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {listening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                <span className="text-xs text-slate-500">{listening ? 'Listening… tap to stop' : 'Tap to speak'}</span>
                <div className="inline-flex p-1 rounded-lg bg-slate-100 text-xs">
                  {(['en-IN', 'hi-IN'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      disabled={listening}
                      className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${lang === l ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                    >
                      {l === 'en-IN' ? 'English' : 'हिंदी'}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 rounded-xl bg-amber-50 border border-amber-200 p-3">
                Tap the box below and use the <strong>🎤 mic on your keyboard</strong> to speak.
              </p>
            )}

            <textarea
              value={interim ? `${transcript} ${interim}`.trim() : transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              placeholder="Your words appear here — you can also type or fix them."
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
            {error && <div className="text-xs text-red-600">{error}</div>}
            <button
              type="button"
              onClick={() => void understand()}
              disabled={parsing}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {parsing ? 'Understanding…' : 'Understand'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {note && <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">{note}</div>}
            {drafts.map((d) => {
              const bizProjects = activeProjects.filter((p) => p.businessId === d.businessId);
              return (
                <div key={d.key} className={`rounded-xl border p-3 space-y-2.5 ${d.include ? 'border-slate-300' : 'border-slate-200 opacity-50'}`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => update(d.key, { include: !d.include })}
                      aria-label={d.include ? 'Exclude task' : 'Include task'}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${d.include ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300'}`}
                    >
                      {d.include && <Check className="w-4 h-4" />}
                    </button>
                    <input value={d.title} onChange={(e) => update(d.key, { title: e.target.value })} className={`${inputCls} font-medium`} maxLength={200} aria-label="Task title" />
                    {drafts.length > 1 && (
                      <button type="button" onClick={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))} aria-label="Remove" className="min-w-[36px] min-h-[36px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={d.businessId}
                      onChange={(e) => update(d.key, { businessId: e.target.value, projectId: '', phaseHeading: '' })}
                      className={inputCls}
                      aria-label="Venture"
                    >
                      {activeBiz.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <select
                      value={d.projectId}
                      onChange={(e) => {
                        const p = bizProjects.find((x) => x.id === e.target.value);
                        update(d.key, { projectId: e.target.value, phaseHeading: p?.phaseHeadings[0] || '' });
                      }}
                      className={inputCls}
                      aria-label="Project"
                    >
                      <option value="">No project</option>
                      {bizProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input type="date" value={d.date} onChange={(e) => update(d.key, { date: e.target.value })} className={inputCls} aria-label="Date" />
                    <input type="time" value={d.time} onChange={(e) => update(d.key, { time: e.target.value })} className={inputCls} aria-label="Time" />
                    <select value={d.priority} onChange={(e) => update(d.key, { priority: e.target.value as Draft['priority'] })} className={inputCls} aria-label="Priority">
                      <option value="standard">Standard</option>
                      <option value="high">High priority</option>
                    </select>
                    <select value={d.repeat} onChange={(e) => update(d.key, { repeat: e.target.value as Draft['repeat'] })} className={inputCls} aria-label="Repeat">
                      <option value="none">Does not repeat</option>
                      <option value="daily">Every day (routine)</option>
                      <option value="weekdays">Mon–Fri (routine)</option>
                      <option value="weekly">Every week (routine)</option>
                    </select>
                  </div>
                </div>
              );
            })}
            {error && <div className="text-xs text-red-600">{error}</div>}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || selected.length === 0}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Adding…' : `Add ${selected.length} task${selected.length === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
