import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmOption {
  value: string;
  label: string;
  description: string;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'neutral';
  options?: ConfirmOption[];
  defaultOption?: string;
  onCancel: () => void;
  onConfirm: (selectedOption?: string) => Promise<void> | void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  tone = 'danger',
  options,
  defaultOption,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [selected, setSelected] = useState<string>(defaultOption || options?.[0]?.value || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(defaultOption || options?.[0]?.value || '');
      setBusy(false);
    }
  }, [open, defaultOption, options]);

  useEffect(() => {
    if (!open || busy) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(options ? selected : undefined);
      onCancel();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3
              id="confirm-dialog-title"
              className="font-display text-base font-bold text-slate-900 truncate"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation"
            className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>

          {options && options.length > 0 && (
            <div className="space-y-2">
              {options.map((opt) => {
                const active = selected === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelected(opt.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900/10'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          active ? 'border-slate-900' : 'border-slate-300'
                        }`}
                      >
                        {active && <span className="w-2 h-2 rounded-full bg-slate-900" />}
                      </span>
                      <span className="text-xs font-semibold text-slate-900">{opt.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-6">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="min-h-[40px] px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirm}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                tone === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
