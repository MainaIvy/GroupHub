import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, ShieldCheck, Eye, EyeOff, X } from 'lucide-react';
import logo from '../assets/images/groubhub logo.svg';

export default function StaffResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link.');
      setValidating(false);
    } else {
      setValidating(false);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setMessage('');

    if (!password || !confirmPassword) {
      setError('Both password fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be at least 8 characters and contain both letters and numbers.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/accounts/staff/reset-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Password reset failed.');
        return;
      }
      setSuccess(true);
      setMessage('Password reset successfully! Redirecting to sign in...');

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
          <p className="mt-4 text-sm text-slate-500">Validating reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 text-slate-900 backdrop-blur-sm sm:p-6">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        className="relative my-auto w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.3)] sm:p-8"
      >
        <header className="mb-5 flex items-center justify-between">
          <img src={logo} alt="GroupHub" className="h-8 w-auto" />
          <Link
            to="/login"
            aria-label="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </Link>
        </header>

        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            {success ? <CheckCircle className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <h1 id="reset-title" className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            {success ? 'Password reset' : 'Reset your password'}
          </h1>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {success ? 'Your password has been updated.' : 'Enter a new password for your lecturer account.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                New password
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
                <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7.5A4 4 0 0 1 16 7.5V10" />
                </svg>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 transition hover:text-violet-700"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                Confirm password
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
                <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7.5A4 4 0 0 1 16 7.5V10" />
                </svg>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-slate-400 transition hover:text-violet-700"
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Password must be at least 8 characters and contain both letters and numbers.
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:opacity-70"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </span>
              ) : (
                'Reset password'
              )}
            </button>
          </form>
        )}

        <p className="pt-4 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-violet-700 hover:text-violet-900">
            ← Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}