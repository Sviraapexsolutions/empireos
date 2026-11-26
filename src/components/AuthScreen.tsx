import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { isNativeApp, isStandalonePwa } from '../config/appConfig';

type AuthMode = 'login' | 'signup' | 'reset';

interface AuthScreenProps {
  unverifiedUser?: User | null;
  onVerificationRefreshed?: () => void;
  onOpenInstallPage?: () => void;
}

export function AuthScreen({
  unverifiedUser,
  onVerificationRefreshed,
  onOpenInstallPage,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const hideGoogle = isNativeApp();

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing.');
      } else {
        setError(
          isStandalonePwa()
            ? 'Google sign-in could not complete inside the home-screen app. Please sign in with email & password instead (you can set a password from Settings in a browser).'
            : err instanceof Error
              ? err.message
              : 'Google Sign-In failed.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    const trimmedEmail = email.trim();

    try {
      if (mode === 'reset') {
        if (!trimmedEmail) {
          setError('Enter your email address to receive a password reset link.');
          setBusy(false);
          return;
        }
        await sendPasswordResetEmail(auth, trimmedEmail);
        setInfo('Password reset email dispatched. Check your inbox.');
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setBusy(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim().slice(0, 100) });
        }
        await sendEmailVerification(cred.user);
        setInfo('Account created. Verify your email address via the link sent to your inbox.');
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password auth is not enabled in your Firebase project yet. Enable it in Firebase Console → Authentication → Sign-in method → Email/Password, or continue immediately with Google Sign-In below.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Switch to Sign In.');
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setBusy(true);
    setError('');
    try {
      await sendEmailVerification(unverifiedUser);
      setInfo('Verification email resent. Check your inbox and spam folder.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!unverifiedUser) return;
    setBusy(true);
    setError('');
    try {
      await unverifiedUser.reload();
      if (auth.currentUser?.emailVerified) {
        onVerificationRefreshed?.();
      } else {
        setError('Email is not verified yet. Click the link in your inbox, then tap refresh.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed.');
    } finally {
      setBusy(false);
    }
  };

  if (unverifiedUser) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-sm">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Verify your email to unlock Firestore sync
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              We sent a verification link to <span className="text-slate-900 font-medium">{unverifiedUser.email}</span>.
              Verified accounts enforce strict zero-trust ownership across all your ventures.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
              {info}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleCheckVerified}
              className="w-full min-h-[46px] px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
              I have verified — Continue
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleResendVerification}
              className="w-full min-h-[44px] px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-medium text-sm hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Resend verification email
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full min-h-[44px] px-4 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Sign out and switch account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 flex flex-col lg:flex-row">
      {/* Left Executive Thesis Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[54%] bg-white border-r border-slate-200 p-12 xl:p-16 flex-col justify-between">
        <div>
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            EmpireOS
          </span>
        </div>

        <div className="max-w-xl space-y-8">
          <div className="space-y-4">
            <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12]">
              Command every venture from one disciplined cockpit.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed">
              Built for operators running multi-business portfolios. Unify projects, milestones,
              dependencies, daily habits, and relentless AI accountability on offline-first cloud sync.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {[
              { name: 'Sundaram Mahadeo Fuel', color: '#F59E0B' },
              { name: 'SM Marketing', color: '#3B82F6' },
              { name: 'Svira Apex Solutions', color: '#8B5CF6' },
              { name: 'Buildsphere & Agni BrickTech', color: '#10B981' },
              { name: 'Kirana Court', color: '#14B8A6' },
              { name: 'Personal', color: '#EF4444' },
            ].map((venture) => (
              <div
                key={venture.name}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F7F8FA] border border-slate-200/80"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: venture.color }}
                />
                <span className="text-xs font-medium text-slate-800 truncate">{venture.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>Offline-First Firestore Sync</span>
          <span aria-hidden="true">·</span>
          <span>Natural Language Quick-Add</span>
          <span aria-hidden="true">·</span>
          <span>₹1,000 Cr Accountability Coach</span>
        </div>
      </div>

      {/* Right Auth Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-7 bg-white lg:bg-transparent border border-slate-200 lg:border-0 rounded-2xl p-6 sm:p-8 lg:p-0 shadow-xs lg:shadow-none">
          <div className="space-y-2">
            <div className="lg:hidden font-display text-2xl font-bold tracking-tight text-slate-900 mb-3">
              EmpireOS
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {mode === 'login'
                ? 'Sign in to Command Center'
                : mode === 'signup'
                  ? 'Initialize your EmpireOS account'
                  : 'Reset account password'}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === 'login'
                ? 'Your ventures, tasks, habits, and coach logs sync across devices.'
                : mode === 'signup'
                  ? 'First sign-in sets up your 6 color-coded ventures with a clean slate.'
                  : 'Enter your email to receive a secure Firebase password reset link.'}
            </p>
          </div>

          {!hideGoogle && (
            <>
          {/* Google Primary Auth */}
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleSignIn}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white text-slate-900 border border-slate-300 font-semibold text-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400">or use email &amp; password</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>
            </>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
              {error}
            </div>
          )}

          {info && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700" htmlFor="auth-name">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aditya Agarwal"
                  maxLength={100}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700" htmlFor="auth-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@empire.in"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700" htmlFor="auth-password">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setError('');
                        setInfo('');
                      }}
                      className="text-xs text-amber-700 font-medium hover:text-amber-800 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>
                {mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Reset Link'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <>
                New to EmpireOS?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setInfo('');
                  }}
                  className="text-slate-900 font-semibold hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setInfo('');
                  }}
                  className="text-slate-900 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
          {onOpenInstallPage && (
            <div className="pt-3 border-t border-slate-200/80 text-center">
              <button
                type="button"
                onClick={onOpenInstallPage}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Install on iOS or Download Android APK
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
