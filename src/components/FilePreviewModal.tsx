import { useEffect, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react';
import type { TaskFile } from '../types/empire';
import { formatFileSize, loadFileObjectUrl } from '../utils/fileVault';

interface FilePreviewModalProps {
  file: TaskFile | null;
  onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setMissing(false);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setMissing(false);
    setObjectUrl(null);

    loadFileObjectUrl(file.id)
      .then((url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setObjectUrl(url);
        setMissing(!url);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [file, onClose]);

  if (!file) return null;

  const isPdf = file.kind === 'pdf' || file.mimeType === 'application/pdf';
  const isImage = file.kind === 'image' || file.mimeType.startsWith('image/');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.name}`}
    >
      <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isPdf ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{file.name}</h3>
              <p className="text-[11px] font-mono text-slate-500">
                {file.mimeType} · {formatFileSize(file.sizeBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {objectUrl && (
              <a
                href={objectUrl}
                download={file.name}
                className="min-h-[36px] px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="min-w-[36px] min-h-[36px] rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 min-h-[320px] bg-slate-50 flex items-center justify-center overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-2.5 text-slate-500 py-16">
              <Loader2 className="w-6 h-6 text-slate-900 animate-spin" />
              <span className="text-xs">Loading attachment…</span>
            </div>
          ) : missing || !objectUrl ? (
            <div className="text-center max-w-sm space-y-2 py-12">
              <p className="text-sm font-semibold text-slate-900">File preview unavailable</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                This file was not found in local storage or the server vault. Re-upload it from
                Settings or the task editor to restore access.
              </p>
            </div>
          ) : isImage ? (
            <img
              src={objectUrl}
              alt={file.name}
              className="max-w-full max-h-[72vh] rounded-xl border border-slate-200 bg-white shadow-sm object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={objectUrl}
              title={file.name}
              className="w-full h-[72vh] rounded-xl border border-slate-200 bg-white"
            />
          ) : (
            <div className="text-center space-y-3 py-12">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
              <a
                href={objectUrl}
                download={file.name}
                className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
