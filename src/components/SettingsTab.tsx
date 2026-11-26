import React, { useEffect, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  linkWithPopup,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { getStaticReleaseStatus, type ReleaseStatus } from './InstallReleasePage';
import { PUBLIC_APP_URL } from '../config/appConfig';
import {
  DEFAULT_MODELS,
  getCoachApiKey,
  getCoachModel,
  getProviderAvailability,
  setCoachApiKey,
  setCoachModel,
  type ProviderAvailability,
} from '../services/aiCoach';
import { auth, googleProvider, sendResetLink } from '../firebase';
import type {
  AiProvider,
  Business,
  CoachLog,
  Habit,
  Project,
  Task,
  TaskFile,
  UserProfile,
} from '../types/empire';
import {
  compressAvatarImage,
  formatFileSize,
  removeFileFromVault,
  saveFileToVault,
} from '../utils/fileVault';

interface SettingsTabProps {
  user: User;
  profile: UserProfile | null;
  avatarUrl: string | null;
  businesses: Business[];
  projects: Project[];
  tasks: Task[];
  habits: Habit[];
  coachLogs: CoachLog[];
  files: TaskFile[];
  onSaveProfile: (data: {
    displayName: string;
    username: string;
    bio: string;
    avatarFileId: string;
    aiProvider: AiProvider;
  }) => Promise<void>;
  onAvatarUpdated: (newAvatarFileId: string) => void;
  onUploadFile: (file: File) => Promise<TaskFile>;
  onDeleteFile: (file: TaskFile) => void;
  onPreviewFile: (file: TaskFile) => void;
  onOpenNotifications: () => void;
  onRequestClearWorkspace: () => void;
  onOpenInstallPage: () => void;
}

export function SettingsTab({
  user,
  profile,
  avatarUrl,
  businesses,
  projects,
  tasks,
  habits,
  coachLogs,
  files,
  onSaveProfile,
  onAvatarUpdated,
  onUploadFile,
  onDeleteFile,
  onPreviewFile,
  onOpenNotifications,
  onRequestClearWorkspace,
  onOpenInstallPage,
}: SettingsTabProps) {
  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.displayName || user.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarFileId, setAvatarFileId] = useState(profile?.avatarFileId || '');
  const [aiProvider, setAiProvider] = useState<AiProvider>(profile?.aiProvider || 'gemini');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // AI Provider server availability
  const [providers, setProviders] = useState<ProviderAvailability | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  // Password management
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // File Library upload state
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [fileError, setFileError] = useState('');

  // Enhanced User Management state
  const [uidCopied, setUidCopied] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [googleLinkedNow, setGoogleLinkedNow] = useState(false);

  // Mobile App & Android APK Release state (static: from build config)
  const [releaseStatus] = useState<ReleaseStatus | null>(() => getStaticReleaseStatus());
  const [installLinkCopied, setInstallLinkCopied] = useState(false);

  // AI coach keys (stored on this device only)
  const [geminiKey, setGeminiKey] = useState(() => getCoachApiKey('gemini'));
  const [claudeKey, setClaudeKey] = useState(() => getCoachApiKey('claude'));
  const [geminiModel, setGeminiModel] = useState(() => getCoachModel('gemini'));
  const [claudeModel, setClaudeModel] = useState(() => getCoachModel('claude'));
  const [keysSavedMsg, setKeysSavedMsg] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const fileLibraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName || user.displayName || '');
    setUsername(profile?.username || '');
    setBio(profile?.bio || '');
    setAvatarFileId(profile?.avatarFileId || '');
    setAiProvider(profile?.aiProvider || 'gemini');
  }, [profile, user.displayName]);

  useEffect(() => {
    setProviders(getProviderAvailability());
  }, []);

  const handleSaveCoachKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setCoachApiKey('gemini', geminiKey);
    setCoachApiKey('claude', claudeKey);
    setCoachModel('gemini', geminiModel);
    setCoachModel('claude', claudeModel);
    setProviders(getProviderAvailability());
    setKeysSavedMsg('Saved on this device.');
    setTimeout(() => setKeysSavedMsg(''), 2200);
  };

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  const hasGoogleProvider =
    googleLinkedNow || user.providerData.some((p) => p.providerId === 'google.com');
  const effectiveAvatar = avatarUrl || user.photoURL || null;
  const userInitial = (displayName || user.email || 'E').charAt(0).toUpperCase();

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const installPageUrl = `${PUBLIC_APP_URL}install`;

  const handleCopyInstallUrl = async () => {
    try {
      await navigator.clipboard.writeText(installPageUrl);
      setInstallLinkCopied(true);
      setTimeout(() => setInstallLinkCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleLinkGoogle = async () => {
    setPwError('');
    setPwMessage('');
    setLinkingGoogle(true);
    try {
      await linkWithPopup(user, googleProvider);
      setGoogleLinkedNow(true);
      setPwMessage('Google Sign-In linked to your account.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to link Google account.';
      if (msg.includes('credential-already-in-use')) {
        setPwError('This Google account is already linked to another EmpireOS profile.');
      } else if (!msg.includes('popup-closed-by-user')) {
        setPwError(msg);
      }
    } finally {
      setLinkingGoogle(false);
    }
  };

  const handleExportWorkspaceJson = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      account: {
        uid: user.uid,
        email: user.email,
        displayName: profile?.displayName || user.displayName,
        username: profile?.username || '',
        aiProvider: profile?.aiProvider || 'gemini',
      },
      businesses,
      projects,
      tasks,
      habits,
      coachLogs,
      files,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empireos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError('');
    setProfileMessage('');
    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a PNG, JPEG, or WebP image for your profile picture.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const compressed = await compressAvatarImage(file);
      const nextId = `avatar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await saveFileToVault(nextId, compressed, 'avatar.jpg', 'image/jpeg');

      const oldId = avatarFileId;
      setAvatarFileId(nextId);
      await onSaveProfile({
        displayName: displayName.trim() || 'Founder',
        username,
        bio,
        avatarFileId: nextId,
        aiProvider,
      });
      onAvatarUpdated(nextId);
      if (oldId) {
        void removeFileFromVault(oldId);
      }
      setProfileMessage('Profile picture updated.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarFileId) return;
    setUploadingAvatar(true);
    setProfileError('');
    setProfileMessage('');
    try {
      const oldId = avatarFileId;
      setAvatarFileId('');
      await onSaveProfile({
        displayName: displayName.trim() || 'Founder',
        username,
        bio,
        avatarFileId: '',
        aiProvider,
      });
      onAvatarUpdated('');
      void removeFileFromVault(oldId);
      setProfileMessage('Custom profile picture removed.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to remove profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfileForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setSavingProfile(true);
    try {
      const cleanName = displayName.trim() || 'Founder';
      await onSaveProfile({
        displayName: cleanName,
        username,
        bio,
        avatarFileId,
        aiProvider,
      });
      if (user.displayName !== cleanName) {
        await updateProfile(user, { displayName: cleanName });
      }
      setProfileMessage('Profile settings saved.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSelectProvider = async (next: AiProvider) => {
    if (next === aiProvider || savingProvider) return;
    setAiProvider(next);
    setSavingProvider(true);
    try {
      await onSaveProfile({
        displayName: displayName.trim() || 'Founder',
        username,
        bio,
        avatarFileId,
        aiProvider: next,
      });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwMessage('');

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    if (!user.email) {
      setPwError('No email address is linked to this account.');
      return;
    }

    setPwBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMessage('Password updated successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update password.';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setPwError('Current password is incorrect.');
      } else if (msg.includes('weak-password')) {
        setPwError('Password is too weak. Choose a stronger password.');
      } else {
        setPwError(msg);
      }
    } finally {
      setPwBusy(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user.email) return;
    setPwError('');
    setPwMessage('');
    setPwBusy(true);
    try {
      await sendResetLink(user.email);
      setResetSent(true);
      setPwMessage(
        `Reset link sent to ${user.email}. Open it (check Spam too), set your new password on the secure page, then sign in again.`
      );
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setPwBusy(false);
    }
  };

  const handleLibraryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setFileError('');
    setUploadingFiles(true);
    try {
      for (const f of selected) {
        await onUploadFile(f);
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setUploadingFiles(false);
      if (fileLibraryInputRef.current) fileLibraryInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Profile &amp; Workspace Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your founder profile, AI Accountability Coach engine, security, and reusable task
          attachments.
        </p>
      </div>

      {/* 1. MY PROFILE & PICTURE */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <UserIcon className="w-4 h-4 text-slate-700" />
          <h3 className="font-display text-base font-bold text-slate-900">My Profile</h3>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            {effectiveAvatar ? (
              <img
                src={effectiveAvatar}
                alt={displayName || 'Founder'}
                referrerPolicy="no-referrer"
                className="w-18 h-18 rounded-2xl object-cover border border-slate-200 bg-slate-100"
              />
            ) : (
              <div className="w-18 h-18 rounded-2xl bg-slate-900 text-white font-display font-bold text-2xl flex items-center justify-center">
                {userInitial}
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-2xl bg-white/80 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-slate-900 animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                {effectiveAvatar ? 'Change Photo' : 'Upload Photo'}
              </button>
              {avatarFileId && (
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={handleRemoveAvatar}
                  className="min-h-[38px] px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200/70 disabled:opacity-50 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Square-cropped JPEG (256×256). Synced locally and to your workspace vault.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfileForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Display Name</label>
              <input
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Username</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm text-slate-400 font-mono">@</span>
                <input
                  type="text"
                  maxLength={40}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                  placeholder="founder_handle"
                  className="w-full min-h-[42px] pl-8 pr-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 font-mono focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Founder Bio / North Star</label>
            <textarea
              rows={2}
              maxLength={240}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Building a ₹1,000 Cr portfolio across Fuel, Marketing, SaaS, and BrickTech."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900 resize-none"
            />
            <div className="text-right text-[11px] font-mono text-slate-400">{bio.length}/240</div>
          </div>

          {profileError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {profileError}
            </div>
          )}
          {profileMessage && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800">
              {profileMessage}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="min-h-[40px] px-5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </section>

      {/* 2. AI ACCOUNTABILITY COACH ENGINE (GEMINI OR CLAUDE) */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                AI Accountability Coach Engine
              </h3>
              <p className="text-xs text-slate-500">
                Choose whether Gemini or Claude powers your ₹1,000 Cr Empire Reality Checks.
              </p>
            </div>
          </div>
          {savingProvider && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              id: 'gemini' as AiProvider,
              name: 'Google Gemini',
              model: providers?.gemini.model || DEFAULT_MODELS.gemini,
              configured: providers ? providers.gemini.configured : true,
              secretHint: 'GEMINI_API_KEY',
              desc: 'Fast structured JSON accountability pushes with verified founder quotes.',
            },
            {
              id: 'claude' as AiProvider,
              name: 'Anthropic Claude',
              model: providers?.claude.model || DEFAULT_MODELS.claude,
              configured: providers ? providers.claude.configured : false,
              secretHint: 'ANTHROPIC_API_KEY',
              desc: 'Sharp executive directness powered by Anthropic Claude.',
            },
          ].map((eng) => {
            const active = aiProvider === eng.id;
            return (
              <button
                key={eng.id}
                type="button"
                onClick={() => void handleSelectProvider(eng.id)}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  active
                    ? 'border-slate-900 bg-slate-50/90 ring-1 ring-slate-900/10'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{eng.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">{eng.model}</div>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      active ? 'bg-slate-900 text-white' : 'border border-slate-300'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">{eng.desc}</p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">API Key on this device</span>
                  {eng.configured ? (
                    <span className="font-semibold text-emerald-700">Configured &amp; Ready</span>
                  ) : (
                    <span className="font-medium text-amber-700">
                      Add key below
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSaveCoachKeys} className="space-y-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Gemini API key</label>
              <input type="password" autoComplete="off" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza… (from aistudio.google.com/apikey)" className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Gemini model</label>
              <input type="text" value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} placeholder={DEFAULT_MODELS.gemini} className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Claude (Anthropic) API key</label>
              <input type="password" autoComplete="off" value={claudeKey} onChange={(e) => setClaudeKey(e.target.value)} placeholder="sk-ant-… (optional)" className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Claude model</label>
              <input type="text" value={claudeModel} onChange={(e) => setClaudeModel(e.target.value)} placeholder={DEFAULT_MODELS.claude} className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-slate-900" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 leading-relaxed">
              Keys are stored only on this device (not in the cloud). Enter them once on each phone or browser you use.
            </span>
            <div className="flex items-center gap-2">
              {keysSavedMsg && <span className="text-[11px] font-semibold text-emerald-700">{keysSavedMsg}</span>}
              <button type="submit" className="min-h-[38px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer">
                Save Keys
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 3. ACCOUNT SECURITY, LINKED PROVIDERS & PASSWORD */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <KeyRound className="w-4 h-4 text-slate-700" />
          <h3 className="font-display text-base font-bold text-slate-900">
            User Management &amp; Account Security
          </h3>
        </div>

        {/* Account Identity & Session Summary */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                <Mail className="w-4 h-4 text-slate-500" />
                <span>{user.email}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Connected sign-in methods:{' '}
                {[
                  hasPasswordProvider ? 'Email & Password' : null,
                  hasGoogleProvider ? 'Google Sign-In' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Firebase Auth'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!hasGoogleProvider && (
                <button
                  type="button"
                  disabled={linkingGoogle}
                  onClick={handleLinkGoogle}
                  className="min-h-[36px] px-3 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {linkingGoogle ? 'Linking…' : 'Link Google Sign-In'}
                </button>
              )}
              <button
                type="button"
                disabled={pwBusy || resetSent}
                onClick={handleSendResetEmail}
                className="min-h-[36px] px-3 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                {resetSent ? 'Reset Email Sent' : 'Send Password Reset Email'}
              </button>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 font-mono">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400">UID:</span>
              <span className="text-slate-700 truncate">{user.uid.slice(0, 14)}…</span>
              <button
                type="button"
                onClick={handleCopyUid}
                aria-label="Copy User ID"
                className="text-slate-400 hover:text-slate-900 cursor-pointer shrink-0"
              >
                {uidCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="truncate">
              <span className="text-slate-400">Joined: </span>
              <span className="text-slate-700">
                {user.metadata.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
            <div className="truncate">
              <span className="text-slate-400">Last Sign-In: </span>
              <span className="text-slate-700">
                {user.metadata.lastSignInTime
                  ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {hasPasswordProvider && (
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div className="text-xs font-semibold text-slate-700">Change Password</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwBusy || !currentPassword || !newPassword || !confirmPassword}
                className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                {pwBusy ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        )}

        {pwError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
            {pwError}
          </div>
        )}
        {pwMessage && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800">
            {pwMessage}
          </div>
        )}
      </section>

      {/* 4. REUSABLE TASK FILE LIBRARY (PDFs & PHOTOS) */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <Paperclip className="w-4 h-4 text-slate-700" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Task File Library (PDFs &amp; Photos)
              </h3>
              <p className="text-xs text-slate-500">
                Upload PDFs and photos once, then attach them to any task in one click.
              </p>
            </div>
          </div>

          <div>
            <input
              ref={fileLibraryInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={handleLibraryFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingFiles}
              onClick={() => fileLibraryInputRef.current?.click()}
              className="min-h-[38px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {uploadingFiles ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {uploadingFiles ? 'Uploading…' : 'Upload PDF / Photo'}
            </button>
          </div>
        </div>

        {fileError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
            {fileError}
          </div>
        )}

        {files.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-8 text-center space-y-1.5">
            <p className="text-sm font-medium text-slate-700">No files uploaded yet</p>
            <p className="text-xs text-slate-500">
              Add invoices, blueprints, site photos, or pitch deck PDFs (up to 12 MB each) to reuse
              across tasks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {files.map((file) => {
              const isPdf = file.kind === 'pdf';
              const usedByCount = tasks.filter((t) => t.attachmentIds?.includes(file.id)).length;
              return (
                <div
                  key={file.id}
                  className="p-3 sm:px-4 bg-white hover:bg-slate-50/70 flex items-center justify-between gap-3 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onPreviewFile(file)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isPdf ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {isPdf ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                        {file.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {isPdf ? 'PDF' : 'Photo'} · {formatFileSize(file.sizeBytes)} · Attached to{' '}
                        {usedByCount} {usedByCount === 1 ? 'task' : 'tasks'}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPreviewFile(file)}
                      aria-label={`Preview ${file.name}`}
                      className="min-w-[34px] min-h-[34px] rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFile(file)}
                      aria-label={`Delete ${file.name}`}
                      className="min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. MOBILE APP, iOS & CONNECTED ANDROID APK RELEASE */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-slate-700" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Mobile App &amp; Connected Android APK Release
              </h3>
              <p className="text-xs text-slate-500">
                Share one public release page for iOS Home Screen install and direct Android APK
                download.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyInstallUrl}
              className="min-h-[36px] px-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {installLinkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied /install URL
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Release Page Link
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenInstallPage}
              className="min-h-[36px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Release Page
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-900">Android APK</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {releaseStatus?.apkAvailable
                ? `Latest build v${releaseStatus.version} — built automatically by GitHub Actions on every update.`
                : 'Built automatically by GitHub Actions on every update.'}
            </p>
          </div>
          {releaseStatus?.apkAvailable && (
            <a
              href={releaseStatus.downloadUrl}
              className="min-h-[36px] px-3.5 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              Download APK
            </a>
          )}
        </div>
      </section>

      {/* 6. WORKSPACE CONTROLS, DATA EXPORT & SESSION */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 pb-3.5">
          <h3 className="font-display text-base font-bold text-slate-900">
            Workspace Data &amp; Session Controls
          </h3>
          <p className="text-xs text-slate-500">
            Export a full JSON snapshot of your portfolio, adjust daily briefings, or manage your
            active session.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportWorkspaceJson}
            className="min-h-[40px] px-4 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-200/70 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Workspace JSON Backup
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="min-h-[40px] px-4 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-200/70 cursor-pointer"
          >
            Configure Daily Briefings
          </button>

          <button
            type="button"
            onClick={onRequestClearWorkspace}
            className="min-h-[40px] px-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Tasks &amp; Projects
          </button>

          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-1.5 ml-auto cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}
