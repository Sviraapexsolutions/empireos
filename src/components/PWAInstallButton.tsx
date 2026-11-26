import { useEffect, useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenReleasePage?: () => void;
  compact?: boolean;
}

export function PWAInstallButton({
  onOpenReleasePage,
  compact = false,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (!showIOSGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSGuide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showIOSGuide]);

  // Suppress button when already running in standalone installed mode
  if (isInstalled) {
    return null;
  }

  // Native Chromium / Android / Desktop install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'min-h-[36px] px-3 text-xs' : 'min-h-[40px] px-4 text-xs sm:text-sm'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari guided Add to Home Screen flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-semibold hover:bg-slate-200/70 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'min-h-[36px] px-3 text-xs' : 'min-h-[40px] px-3.5 text-xs sm:text-sm'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setShowIOSGuide(false)}
            />
            <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
                    alt="EmpireOS"
                    className="w-8 h-8 rounded-lg border border-slate-200"
                  />
                  <h3 id="ios-install-title" className="font-display text-base font-bold text-slate-900">
                    Install EmpireOS on iOS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close iOS install guide"
                  className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Add EmpireOS to your iPhone or iPad Home Screen for a full-screen native app
                  experience synced live with your Android APK and desktop workspace.
                </p>

                <ol className="space-y-3 text-xs text-slate-800">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[11px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span className="leading-relaxed">
                      Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />{' '}
                      <strong>Share</strong> button in the Safari toolbar.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[11px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span className="leading-relaxed">
                      Scroll down and tap{' '}
                      <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-slate-700" />{' '}
                      <strong>Add to Home Screen</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[11px] flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span className="leading-relaxed">
                      Tap <strong>Add</strong> in the top-right corner, then launch EmpireOS from
                      your Home Screen.
                    </span>
                  </li>
                </ol>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {onOpenReleasePage && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowIOSGuide(false);
                        onOpenReleasePage();
                      }}
                      className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 cursor-pointer"
                    >
                      APK &amp; Release Page
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    className="min-h-[38px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    Got It
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback on desktop / non-prompt browsers: open the public iOS + Android APK release hub
  if (onOpenReleasePage) {
    return (
      <button
        type="button"
        onClick={onOpenReleasePage}
        title="Install on iOS or Download Android APK"
        className={`rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-semibold hover:bg-slate-200/70 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'min-h-[36px] px-3 text-xs' : 'min-h-[40px] px-3.5 text-xs sm:text-sm'
        }`}
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Get App</span>
      </button>
    );
  }

  return null;
}
