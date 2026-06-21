import React, { useState } from 'react';
import { useAuth } from '../services/AuthProvider';
import { Mail, Lock, User, RefreshCw, X, ShieldCheck, HelpCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signUp, logIn, logInGoogle, passwordReset } = useAuth();
  const [view, setView] = useState<'LOGIN' | 'SIGNUP' | 'FORGOT'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [consentGiven, setConsentGiven] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  if (!isOpen) return null;

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(pass)) {
      return 'Password must contain at least one uppercase letter.';
    }
    if (!/[0-9]/.test(pass)) {
      return 'Password must contain at least one number.';
    }
    return null;
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return '';
    if (pass.length < 8) return 'weak';
    const hasUppercase = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    if (hasUppercase && hasNumber) return 'strong';
    return 'medium';
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (view === 'LOGIN') {
        const now = new Date();
        if (lockedUntil && now < lockedUntil) {
          const minutesLeft = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
          throw new Error(`Login locked. Too many failed attempts. Try again in ${minutesLeft} minute(s).`);
        }

        try {
          await logIn(email, password);
          setLoginAttempts(0);
          setLockedUntil(null);
          setSuccess('Logged in successfully!');
          setTimeout(() => {
            onClose();
          }, 1000);
        } catch (err: any) {
          if (err.code === 'auth/operation-not-allowed') {
            throw err; // Let outer catch block process and output the clean console link message
          }
          const newAttempts = loginAttempts + 1;
          setLoginAttempts(newAttempts);
          
          if (newAttempts >= 5) {
            const lockTime = new Date(Date.now() + 15 * 60 * 1000);
            setLockedUntil(lockTime);
            throw new Error('Too many failed attempts. Locked for 15 minutes.');
          } else {
            let cleanMsg = err.message || 'Invalid credentials.';
            if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
              cleanMsg = 'Invalid email or password.';
            }
            throw new Error(`${cleanMsg} ${5 - newAttempts} attempts remaining.`);
          }
        }
      } else if (view === 'SIGNUP') {
        const strengthErr = validatePassword(password);
        if (strengthErr) {
          throw new Error(strengthErr);
        }
        if (!consentGiven) {
          throw new Error('You must accept the terms & privacy directive to proceed.');
        }
        await signUp(email, password, name || 'Member');
        setSuccess('Registered successfully! Your workspace is ready.');
        setTimeout(() => {
          onClose();
        }, 1000);
      } else if (view === 'FORGOT') {
        await passwordReset(email);
        setSuccess('Password reset link sent! Check your inbox.');
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'Authentication failed.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already registered.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Invalid email address format.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'Email/Password sign-in is disabled in your Supabase project. Please go to Supabase Dashboard -> Authentication -> Providers, click "Email", and click Enable.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    console.log('[Auth] handleGoogleSignIn triggered');

    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('Google sign-in timed out. Please try again.');
      console.warn('[Auth] Google sign-in operation timed out after 15 seconds');
    }, 15000);

    try {
      console.log('[Auth] handleGoogleSignIn -> Calling logInGoogle(true) [Redirect]');
      clearTimeout(timeoutId);
      await logInGoogle(true);
      console.log('[Auth] Redirect initiated successfully.');
      setSuccess('Redirecting to Google Sign-In...');
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[Auth] handleGoogleSignIn caught error:', err);
      let errMsg = err.message || 'Google sign-in failed.';
      if (err.code === 'auth/popup-closed-by-user') {
        errMsg = 'Sign-in popup was closed before completion. Please try again.';
      } else if (err.code === 'auth/popup-blocked') {
        errMsg = 'The sign-in popup was blocked by your browser. Please allow popups for this site, or try to enable it in settings.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'Google sign-in is disabled in your Supabase project. Please go to Supabase Dashboard -> Authentication -> Providers, click "Google", and click Enable.';
      }
      setError(errMsg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      {/* Container */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-405 hover:text-white hover:bg-slate-800 rounded-lg transition-colors z-10"
        >
          <X size={16} />
        </button>

        {/* Header Decorator */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-slate-900 to-indigo-500/10 p-6 pt-8 text-center border-b border-slate-800/60">
          <div className="mx-auto w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center mb-3">
            <ShieldCheck className="text-emerald-400" size={20} />
          </div>
          <h2 className="text-xl font-bold text-white uppercase tracking-wider font-mono">
            {view === 'LOGIN' && 'Sign In to Workspace'}
            {view === 'SIGNUP' && 'Create Cloud Profile'}
            {view === 'FORGOT' && 'Forgotten Password'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {view === 'LOGIN' && 'Access persistent watchlists and automated setups'}
            {view === 'SIGNUP' && 'Enter details to synchronize your data cross-device'}
            {view === 'FORGOT' && 'Reset link will be delivered to your registered inbox'}
          </p>
        </div>

        {/* Forms body */}
        <form onSubmit={handleAuthAction} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-900 rounded-lg text-rose-400 text-xs font-mono leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-950/45 border border-emerald-900 rounded-lg text-emerald-400 text-xs font-mono leading-relaxed">
              ✓ {success}
            </div>
          )}

          {view === 'SIGNUP' && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block mb-1">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text"
                  placeholder="E.g., Faisal Darjee"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-slate-700 focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 font-mono transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block mb-1">Email ID</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="email"
                placeholder="E.g., subscriber@gmail.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-slate-700 focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 font-mono transition-all"
              />
            </div>
          </div>

          {view !== 'FORGOT' && (
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">Password</label>
                {view === 'LOGIN' && (
                  <button 
                    type="button"
                    onClick={() => setView('FORGOT')}
                    className="text-[9px] font-mono text-sky-450 hover:underline hover:text-sky-400"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-slate-700 focus:outline-none rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 font-mono transition-all"
                />
              </div>
              {view === 'SIGNUP' && password && (
                <div className="space-y-1 mt-1.5 p-2 bg-slate-950/30 rounded-lg border border-slate-900/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 font-mono">Password strength:</span>
                    <span className={`text-[9px] font-mono font-bold capitalize ${
                      getPasswordStrength(password) === 'weak' ? 'text-rose-400' :
                      getPasswordStrength(password) === 'medium' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {getPasswordStrength(password)}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-950 rounded overflow-hidden">
                    <div 
                      className={`h-full rounded transition-all duration-300 ${
                        getPasswordStrength(password) === 'weak' ? 'w-1/3 bg-rose-500' :
                        getPasswordStrength(password) === 'medium' ? 'w-2/3 bg-amber-500' :
                        'w-full bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'SIGNUP' && (
            <div className="flex items-start gap-2.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/40 my-1">
              <input
                type="checkbox"
                id="consentCheck"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-0.5 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer h-3.5 w-3.5"
              />
              <label htmlFor="consentCheck" className="text-[10px] text-slate-400 font-mono leading-normal select-none">
                I hereby declare that I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Terms of Service</a> and the <a href="/privacy" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Privacy Directive</a>, and understand this is an educational simulation.
              </label>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || (view === 'SIGNUP' && !consentGiven)}
            className="w-full py-2.5 mt-2 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all font-bold"
          >
            {loading && <RefreshCw size={12} className="animate-spin" />}
            {view === 'LOGIN' && 'Sign In'}
            {view === 'SIGNUP' && 'Start Syncing Portfolio'}
            {view === 'FORGOT' && 'Send Email Reset Link'}
          </button>

          {/* Google Sign-In Option */}
          {view !== 'FORGOT' && (
            <div className="space-y-3 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <span className="relative px-3 bg-slate-900 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                  Or continue with
                </span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-mono text-xs flex items-center justify-center gap-2 group transition-all cursor-pointer"
              >
                <svg className="h-4 w-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Google Account
              </button>
            </div>
          )}

          {/* Switch screens */}
          <div className="pt-2 text-center text-xs font-mono">
            {view === 'LOGIN' ? (
              <span className="text-slate-500">
                New to PRISMX?{' '}
                <button 
                  type="button"
                  onClick={() => setView('SIGNUP')}
                  className="text-emerald-400 hover:underline hover:text-emerald-300 font-bold"
                >
                  Create free account
                </button>
              </span>
            ) : view === 'SIGNUP' ? (
              <span className="text-slate-500">
                Already registered?{' '}
                <button 
                  type="button"
                  onClick={() => setView('LOGIN')}
                  className="text-emerald-400 hover:underline hover:text-emerald-300 font-bold"
                >
                  Sign In instead
                </button>
              </span>
            ) : (
              <button 
                type="button"
                onClick={() => setView('LOGIN')}
                className="text-emerald-400 hover:underline hover:text-emerald-300 font-bold"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </form>

        {/* Protection Footer Note */}
        <div className="bg-slate-950 p-4 text-center border-t border-slate-850/80 text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1.5">
          <ShieldCheck size={12} className="text-emerald-400" />
          Protected by Supabase Authentication
        </div>
      </div>
    </div>
  );
}
