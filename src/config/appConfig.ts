/**
 * Static-hosting configuration (GitHub Pages + Capacitor Android wrapper).
 * Values come from Vite env variables injected at build time by the GitHub workflow.
 */

/** Base path the app is served from, always ends with "/" (e.g. "/empireos/"). */
export const BASE_PATH: string = import.meta.env.BASE_URL || '/';

/** Public URL of the hosted web app (used for share links). */
export const PUBLIC_APP_URL: string =
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
  (typeof window !== 'undefined' ? `${window.location.origin}${BASE_PATH}` : BASE_PATH);

/** Direct download URL of the latest Android APK (GitHub Releases). */
export const APK_DOWNLOAD_URL: string = (import.meta.env.VITE_APK_URL as string | undefined) || '';

/** Human readable release page (GitHub Releases). */
export const APK_RELEASE_PAGE_URL: string =
  (import.meta.env.VITE_RELEASE_PAGE_URL as string | undefined) || '';

/** Version label baked into this build. */
export const APP_VERSION: string = (import.meta.env.VITE_APP_VERSION as string | undefined) || 'dev';

/** Android package id used by the Capacitor wrapper. */
export const ANDROID_PACKAGE_ID = 'com.smgroup.empireos';

/** Path helpers that respect the base path. */
export function appPath(sub = ''): string {
  return `${BASE_PATH}${sub.replace(/^\/+/, '')}`;
}

export function isInstallPath(pathname: string): boolean {
  const rel = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname.replace(/^\/+/, '');
  const clean = rel.replace(/\/+$/, '');
  return clean === 'install' || clean === 'download';
}

/** True when running inside the Android APK (Capacitor WebView). */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  return /EmpireOSAndroid/i.test(navigator.userAgent);
}

/** True when launched from an iOS/Android home screen icon. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia?.('(display-mode: standalone)').matches;
}
