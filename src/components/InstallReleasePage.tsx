import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  PlusSquare,
  Share,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { formatFileSize } from '../utils/fileVault';
import {
  ANDROID_PACKAGE_ID,
  APK_DOWNLOAD_URL,
  APK_RELEASE_PAGE_URL,
  APP_VERSION,
  BASE_PATH,
  PUBLIC_APP_URL,
} from '../config/appConfig';

export interface ReleaseStatus {
  apkAvailable: boolean;
  fileName: string | null;
  version: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
  packageName: string;
  sha256Fingerprint: string;
  sha256Configured: boolean;
  downloadUrl: string;
  manifestUrl: string;
  assetLinksUrl: string;
  releasePageUrl?: string;
}

export function getStaticReleaseStatus(): ReleaseStatus | null {
  if (!APK_DOWNLOAD_URL) return null;
  return {
    apkAvailable: true,
    fileName: 'EmpireOS.apk',
    version: APP_VERSION,
    sizeBytes: null,
    uploadedAt: null,
    packageName: ANDROID_PACKAGE_ID,
    sha256Fingerprint: '',
    sha256Configured: false,
    downloadUrl: APK_DOWNLOAD_URL,
    manifestUrl: `${PUBLIC_APP_URL}manifest.webmanifest`,
    assetLinksUrl: '',
    releasePageUrl: APK_RELEASE_PAGE_URL,
  };
}

interface InstallReleasePageProps {
  isSignedIn: boolean;
  onBackToApp: () => void;
  onOpenSettingsRelease?: () => void;
}

export function InstallReleasePage({
  isSignedIn,
  onBackToApp,
  onOpenSettingsRelease,
}: InstallReleasePageProps) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const status: ReleaseStatus | null = getStaticReleaseStatus();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = PUBLIC_APP_URL;
  const releasePageUrl = `${PUBLIC_APP_URL}install`;

  const copyText = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900">
      {/* Compact Sticky Top Navigation */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={`${BASE_PATH}pwa-192x192.png`}
            alt="EmpireOS"
            className="w-7 h-7 rounded-lg border border-slate-200 shrink-0"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 truncate">
            EmpireOS
          </span>
          <span className="hidden sm:inline text-xs font-medium text-slate-400">
            / Mobile &amp; APK Release
          </span>
        </div>

        <button
          type="button"
          onClick={onBackToApp}
          className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isSignedIn ? 'Back to Workspace' : 'Open Web App'}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {/* 1. Release Hero Banner */}
        <section className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <img
              src={`${BASE_PATH}pwa-512x512.png`}
              alt="EmpireOS App Icon"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-slate-200 shadow-sm shrink-0"
            />
            <div className="space-y-1.5 min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Install EmpireOS on iOS &amp; Android
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
                One live Firebase-synced account across iPhone, iPad, Android APK, and desktop.
                Every task, habit, attachment, and AI Reality Check updates instantly everywhere.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PWA Manifest &amp; Offline Sync Active
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">
                  {status?.apkAvailable
                    ? `Android APK v${status.version} Ready`
                    : 'Android Instant App + TWA APK Ready'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => copyText('releaseUrl', releasePageUrl)}
              className="min-h-[42px] px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              {copiedKey === 'releaseUrl' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied Release URL
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Release Page Link
                </>
              )}
            </button>
            {isSignedIn && onOpenSettingsRelease && (
              <button
                type="button"
                onClick={onOpenSettingsRelease}
                className="min-h-[42px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Back to Settings
              </button>
            )}
          </div>
        </section>

        {/* 2. Platform Install Grid: Android APK + iOS Home Screen App */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Android Card */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Android Connected APK
                    </h2>
                    <p className="text-xs text-slate-500">
                      Direct .apk installer or instant Chrome app
                    </p>
                  </div>
                </div>
              </div>

              {status?.apkAvailable ? (
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-emerald-900">
                        {status.fileName || `EmpireOS-v${status.version}.apk`}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-700">
                        Version {status.version}
                        {status.sizeBytes ? ` · ${formatFileSize(status.sizeBytes)}` : ''}
                      </div>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  </div>
                  <a
                    href={status.downloadUrl}
                    download
                    className="w-full min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download EmpireOS APK (v{status.version})
                  </a>
                  <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                    Open the downloaded file on Android and enable “Install unknown apps” for your
                    browser if prompted. All data syncs automatically with your Firebase account.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-900">
                    Android APK not published yet
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The APK is built automatically by GitHub Actions. Once the first build finishes,
                    a direct Download APK button appears right here.
                  </p>
                </div>
              )}

              {/* Instant Android Chrome Install */}
              <div className="pt-1 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">
                  Or Install Instantly via Android Chrome (No Sideloading)
                </div>
                {isInstalled ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    EmpireOS is already installed on this device.
                  </div>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={() => void install()}
                    className="w-full min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Install EmpireOS App Now
                  </button>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Open this link in <strong>Chrome on Android</strong>, tap the{' '}
                    <strong>⋮ menu</strong> in the top-right corner, and tap{' '}
                    <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500">
              {status?.releasePageUrl ? (
                <a
                  href={status.releasePageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-slate-600 hover:text-slate-900 underline inline-flex items-center gap-1"
                >
                  All releases on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span>Built automatically by GitHub Actions on every update.</span>
              )}
            </div>
          </section>

          {/* iOS Card */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    iPhone &amp; iPad (iOS)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Full-screen standalone app via Safari (zero App Store review needed)
                  </p>
                </div>
              </div>

              <ol className="space-y-3 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="leading-relaxed">
                    Open your live EmpireOS link in <strong>Safari</strong> on iPhone or iPad
                    (not inside an in-app browser).
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="leading-relaxed">
                    Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />{' '}
                    <strong>Share</strong> button at the bottom of Safari.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="leading-relaxed">
                    Scroll down, tap{' '}
                    <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-slate-800" />{' '}
                    <strong>Add to Home Screen</strong>, and tap <strong>Add</strong>.
                  </div>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => copyText('iosUrl', origin)}
                className="w-full min-h-[42px] px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                {copiedKey === 'iosUrl' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied EmpireOS Link for Safari
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy EmpireOS Link for iOS Safari
                  </>
                )}
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500">
              Configured with 180×180 PNG Apple Touch Icon, standalone full-screen viewport, and
              offline Firestore persistence.
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}
