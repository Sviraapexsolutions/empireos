import React, { useEffect, useState } from 'react';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, KeyRound, Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { auth } from '../firebase';
import { appPath } from '../config/appConfig';

/**
 * In-app handler for Firebase email links (password reset, email verification, email recovery).
 * Opening the page only *checks* the code; it is used up only when the user presses the button.
 * This stops email link scanners (Gmail/Outlook safe-links) from "expiring" the link first.
 */

type ActionMode = 'resetPassword' | 'verifyEmail' | 'recoverEmail' | 'verifyAndChangeEmail';

export function getAuthActionParams(): { mode: ActionMode; oobCode: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') as ActionMode | null;
  const oobCode = params.get('oobCode');
  if (!mode || !oobCode) return null;
  if (!['resetPassword', 'verifyEmail', 'recoverEmail', 'verifyAndChangeEmail'].includes(mode)) {
    return null;
  }
  return { mode, oobCode };
}

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/expired-action-code':
      return 'This link has expired (links last 1 hour). Request a new email and use the newest one.';
    case 'auth/invalid-action-code':
      return 'This link was already used or replaced by a newer email. Request a new one and open only the latest email.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account exists for this link.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.';
    default:
      return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  }
}

interface AuthActionPageProps {
  mode: ActionMode;
  oobCode: string;
  onDone: () => void;
}

export function AuthActionPage({ mode, oobCode, onDone }: AuthActionPageProps) {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        if (mode === 'resetPassword') {
          const mail = await verifyPasswordResetCode(auth, oobCode);
          if (active) setEmail(mail);
        } else {
          const info = await checkActionCode(auth, oobCode);
          if (active) setEmail(info.data.email || info.data.previousEmail || '');
        }
      } catch (err) {
        if (active) setError(friendlyError(err));
      } finally {
        if (active) setChecking(false);
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [mode, oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    setError('');
    setBusy(true);
    try {
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) await auth.currentUser.reload().catch(() => undefined);
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const goToApp = () => {
    window.history.replaceState({}, '', appPath());
    onDone();
  };

  const title =
    mode === 'resetPassword'
      ? 'Set a new password'
      : mode === 'recoverEmail'
        ? 'Restore your email'
        : 'Verify your email';

  const inputCls =
    'w-full min-h-[48px] px-4 rounded-xl bg-white border border-slate-300 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900';

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="space-y-2">
          <div className="font-display text-2xl font-bold text-slate-900">EmpireOS</div>
          <h1 className="font-display text-xl font-bold text-slate-900">{title}</h1>
          {email && !error && <p className="text-sm text-slate-500 break-all">{email}</p>}
        </div>

        {checking ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking your link…
          </div>
        ) : done ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                {mode === 'resetPassword'
                  ? 'Your password has been changed. Sign in with your new password.'
                  : mode === 'recoverEmail'
                    ? 'Your previous email has been restored. We recommend resetting your password too.'
                    : 'Your email is verified.'}
              </span>
            </div>
            <button
              type="button"
              onClick={goToApp}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 cursor-pointer"
            >
              Continue to EmpireOS
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : error && (mode !== 'resetPassword' || !email) ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={goToApp}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Back to sign in
            </button>
          </div>
        ) : mode === 'resetPassword' ? (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputCls}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleApply()}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
            {mode === 'recoverEmail' ? 'Restore my email' : 'Verify my email'}
          </button>
        )}
      </div>
    </div>
  );
}
