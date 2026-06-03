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

  if (!isOpen) return null;

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (view === 'LOGIN') {
        await logIn(email, password);
        setSuccess('Logged in successfully!');
        setTimeout(() => {
          onClose();
        }, 1000);
      } else if (view === 'SIGNUP') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
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
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already registered.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Invalid email address format.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await logInGoogle();
      setSuccess('Logged in via Google successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-In aborted.');
    } finally {
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
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all font-bold"
          >
            {loading && <RefreshCw size={12} className="animate-spin" />}
            {view === 'LOGIN' && 'Sign In'}
            {view === 'SIGNUP' && 'Start Syncing Portfolio'}
            {view === 'FORGOT' && 'Send Email Reset Link'}
          </button>

          {view !== 'FORGOT' && (
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <span className="relative bg-slate-900 px-3 text-[10px] font-mono uppercase text-slate-500 font-bold">OR</span>
            </div>
          )}

          {view !== 'FORGOT' && (
            <button 
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full py-2.5 border border-slate-800 hover:border-slate-705 text-slate-300 hover:text-white rounded-xl bg-slate-950/40 hover:bg-slate-950/80 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue With Google
            </button>
          )}

          {/* Switch screens */}
          <div className="pt-2 text-center text-xs font-mono">
            {view === 'LOGIN' ? (
              <span className="text-slate-500">
                New to Bang On AI?{' '}
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

        {/* Console Note */}
        <div className="bg-slate-950 p-3 text-center border-t border-slate-850/80 text-[9px] text-slate-500 font-mono tracking-wider">
          💡 Make sure "Email/Password" and "Google" are enabled on your Console.
        </div>
      </div>
    </div>
  );
}
