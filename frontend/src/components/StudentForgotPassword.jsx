import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail, AlertCircle, CheckCircle, X } from 'lucide-react';
import logo from '../assets/images/GROUPHUBLOGO.png';
import { API_BASE } from '../apiConfig';

export default function StudentForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setResetUrl('');
    setToken('');

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      setError('Enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/accounts/student/forgot-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to send reset link.');
        return;
      }
      setSuccess(true);
      setResetUrl(data.reset_url || '');
      setToken(data.token || '');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = () => {
    if (!resetUrl) return;
    navigator.clipboard.writeText(resetUrl);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 text-slate-900 backdrop-blur-sm sm:p-6">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-title"
        className="relative my-auto w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.3)] sm:p-8"
      >
        <header className="mb-5 flex items-center justify-between">
          <img src={logo} alt="GroupHub" className="h-10 w-auto" />
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
            <Mail className="h-7 w-7" />
          </div>
          <h1 id="forgot-title" className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            Reset password
          </h1>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Enter your student email to receive a password reset link.
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
                <div className="text-sm text-emerald-800">
                  <p className="font-semibold">Reset link ready</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Copy the link below and open it in your browser to set a new password. The link expires in 2 hours.
                  </p>
                  {resetUrl && (
                    <div className="mt-2.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 flex items-center gap-2">
                      <code className="flex-1 text-[10px] break-all text-emerald-900">{resetUrl}</code>
                      <button
                        type="button"
                        onClick={copyLink}
                        aria-label="Copy reset link"
                        className="rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/student/reset-password/${token}/`)}
                    className="mt-2.5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Go to reset password
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {(error || !success) && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error || 'Enter your student email to receive a reset link.'}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                Student email
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
                <Mail className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                  placeholder="student@zetech.ac.ke"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:opacity-70"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </span>
              ) : (
                'Send reset link'
              )}
            </button>

            <p className="pt-1 text-center text-sm text-slate-500">
              <Link to="/login" className="font-semibold text-violet-700 hover:text-violet-900">
                ← Back to sign in
              </Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
