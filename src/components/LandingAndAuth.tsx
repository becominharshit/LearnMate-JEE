import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Languages,
  Target,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Lock,
  ArrowLeft,
  Compass,
} from 'lucide-react';
import { signInWithGoogle, emailSignIn, emailSignUp, resetPassword } from '../firebase';
import { BrandLogo } from './BrandLogo';
import { LandingShowcase } from './landing/LandingShowcase';
import { getDaysToJeeMain2027Session1 } from '../config/examSpecs';

export type LegalModalTabId = 'privacy' | 'terms' | 'ai-safety' | 'google-api' | 'contact';

interface LandingPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  onOpenLegal?: (tab: LegalModalTabId) => void;
  darkMode?: boolean;
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  darkMode,
  onToggleTheme,
}) => {
  return <LandingShowcase darkMode={darkMode} onToggleTheme={onToggleTheme} />;
};

interface AuthScreenProps {
  initialMode: 'signin' | 'signup';
  onBackToLanding: () => void;
  onAuthComplete: () => void;
  onTryDemo?: () => void;
  onOpenLegal?: (tab: LegalModalTabId) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode,
  onBackToLanding,
  onAuthComplete,
  onTryDemo,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isUnder18, setIsUnder18] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    guardian?: string;
  }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const daysToJee2027 = getDaysToJeeMain2027Session1();

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const outcome = await signInWithGoogle(false);
      if (outcome.redirected) {
        return;
      }
      if (outcome.user) {
        onAuthComplete();
      } else if (outcome.cancelled) {
        setErrorMsg(
          'Google Sign-In was closed. Retry or sign in with email.'
        );
      } else if (outcome.errorMessage) {
        setErrorMsg(outcome.errorMessage);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSent(false);
    const trimmed = resetEmail.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(trimmed);
      setResetSent(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const nextFieldErrors: typeof fieldErrors = {};
    if (mode === 'signup' && !name.trim()) {
      nextFieldErrors.name = 'Enter your name.';
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      nextFieldErrors.email = 'Enter a valid email.';
    }
    if (password.length < 6) {
      nextFieldErrors.password = 'Minimum 6 characters.';
    }
    if (mode === 'signup' && isUnder18 && (!EMAIL_PATTERN.test(guardianEmail.trim()) || !guardianConsent)) {
      nextFieldErrors.guardian =
        'Under 18 requires guardian email and consent.';
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setErrorMsg(
        nextFieldErrors.name ||
          nextFieldErrors.email ||
          nextFieldErrors.password ||
          nextFieldErrors.guardian ||
          'Check highlighted fields.'
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await emailSignUp(name, email.trim(), password);
        try {
          localStorage.setItem(
            'learnmate_signup_consent_v1',
            JSON.stringify({
              isMinor: isUnder18,
              guardianEmail: guardianEmail.trim(),
              guardianConsentGranted: isUnder18 ? guardianConsent : true,
              recordedAtIso: new Date().toISOString(),
            })
          );
        } catch {
          // ignore storage error
        }
      } else {
        await emailSignIn(email.trim(), password);
      }
      onAuthComplete();
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Authentication failed. Check credentials or continue with Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F8FAFF] dark:bg-[#070B14] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Left Brand Showcase Panel */}
      <div className="lg:col-span-6 bg-[#070B14] border-r border-white/[0.08] text-[#F8FAFC] p-8 sm:p-14 flex flex-col justify-between">
        <BrandLogo className="w-8 h-7" tone="dark-surface" showWordmark badgeText="JEE" />

        <div className="my-12 space-y-6 max-w-lg">
          <h1 className="font-display font-bold text-3xl sm:text-4xl leading-tight tracking-[-0.025em]">
            Your JEE workspace, built around your notes.
          </h1>

          <div className="space-y-3.5 text-sm text-[#94A3B8]">
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-[#2563EB] shrink-0" />
              <span>Chapter notes, scans, and 12h lecture transcripts.</span>
            </div>
            <div className="flex items-center gap-3">
              <Languages className="w-4 h-4 text-[#7C3AED] shrink-0" />
              <span>English, Hinglish, and Hindi study modes.</span>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-[#00A86B] shrink-0" />
              <span>75-Q NTA CBT simulator &amp; SM-2 Mistake DNA.</span>
            </div>
          </div>

          <div className="pt-1 tabular-nums text-xs text-[#94A3B8]">
            {daysToJee2027}d to JEE Main 2027 Session 1
          </div>
        </div>

        <div className="text-xs text-[#94A3B8]">
          Private per-student workspace · Firebase Auth &amp; Firestore
        </div>
      </div>

      {/* Right Auth Form Panel */}
      <div className="lg:col-span-6 p-6 sm:p-14 flex flex-col justify-center max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] mb-6 cursor-pointer w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        {resetMode ? (
          <div className="space-y-5">
            <div>
              <h2 className="font-display font-semibold text-2xl">
                Reset password
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
                We&apos;ll email you a reset link.
              </p>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              {resetSent && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
                  Reset email sent to <strong>{resetEmail}</strong>.
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg btn-brand font-semibold text-sm flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setResetSent(false);
                setErrorMsg(null);
              }}
              className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
            >
              ← Back to Sign In
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display font-semibold text-2xl">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1 mb-6">
              Private encrypted study workspace.
            </p>

            {/* Instant Password-less Google Sign-In Button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] flex items-center justify-center gap-3 text-sm font-medium transition-colors duration-150 cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative my-6 flex items-center justify-center">
              <div className="border-t border-[#E2E8F0] dark:border-white/[0.08] w-full" />
              <span className="bg-[#F8FAFF] dark:bg-[#070B14] px-3 text-[11px] text-slate-400 whitespace-nowrap">
                or email
              </span>
              <div className="border-t border-[#E2E8F0] dark:border-white/[0.08] w-full" />
            </div>

            <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      placeholder="Aarav Sharma"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border bg-white dark:bg-[#111827] text-sm focus:outline-none ${
                        fieldErrors.name ? 'border-red-500' : 'border-[#E2E8F0] dark:border-white/[0.08] focus:border-[#2563EB]'
                      }`}
                    />
                  </div>
                  {fieldErrors.name && (
                    <p className="mt-1 text-[11px] text-red-500">{fieldErrors.name}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="you@example.com"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border bg-white dark:bg-[#111827] text-sm focus:outline-none ${
                      fieldErrors.email ? 'border-red-500' : 'border-[#E2E8F0] dark:border-white/[0.08] focus:border-[#2563EB]'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Minimum 6 characters"
                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border bg-white dark:bg-[#111827] text-sm focus:outline-none ${
                      fieldErrors.password ? 'border-red-500' : 'border-[#E2E8F0] dark:border-white/[0.08] focus:border-[#2563EB]'
                    }`}
                  />
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.password}</p>
                )}
                {mode === 'signin' && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setResetMode(true);
                        setResetSent(false);
                        setErrorMsg(null);
                      }}
                      className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2.5 text-xs">
                  <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnder18}
                      onChange={(e) => setIsUnder18(e.target.checked)}
                      className="rounded accent-[#2563EB]"
                    />
                    <span>Under 18 (guardian consent required)</span>
                  </label>
                  {isUnder18 && (
                    <div className="space-y-2 pl-1">
                      <input
                        type="email"
                        value={guardianEmail}
                        onChange={(e) => setGuardianEmail(e.target.value)}
                        placeholder="Parent / Guardian email"
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] text-xs bg-[#F1F5F9] dark:bg-[#1E293B] focus:outline-none focus:border-[#2563EB]"
                      />
                      <label className="flex items-start gap-2 text-[11px] text-[#475569] dark:text-[#94A3B8] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={guardianConsent}
                          onChange={(e) => setGuardianConsent(e.target.checked)}
                          className="mt-0.5 rounded accent-[#2563EB]"
                        />
                        <span>
                          Guardian consents under India DPDP Act 2023 &amp; GDPR.
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-brand w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <ArrowRight className="w-4 h-4" />
                <span>{mode === 'signup' ? 'Create account' : 'Sign in'}</span>
              </button>
            </form>

            <p className="text-center text-xs text-[#475569] dark:text-[#94A3B8] mt-5">
              {mode === 'signup' ? (
                <>
                  Have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                      setFieldErrors({});
                    }}
                    className="font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New to LearnMate?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                      setFieldErrors({});
                    }}
                    className="font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Create account
                  </button>
                </>
              )}
            </p>

            {onTryDemo && (
              <div className="mt-5 pt-4 border-t border-[#E2E8F0] dark:border-white/[0.08] space-y-2">
                <button
                  type="button"
                  onClick={onTryDemo}
                  className="w-full py-2.5 px-4 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-medium flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                  <span>Try Demo Without Account</span>
                </button>
                <p className="text-[11px] text-center text-[#475569] dark:text-[#94A3B8]">
                  Local preview only.
                </p>
              </div>
            )}
          </>
        )}

        <div className="mt-6 pt-4 border-t border-[#E2E8F0] dark:border-white/[0.08] flex items-center gap-2 text-[11px] text-[#475569] dark:text-[#94A3B8]">
          <ShieldCheck className="w-4 h-4 text-[#00A86B] shrink-0" />
          <span>Private to your account.</span>
        </div>
      </div>
    </div>
  );
};
