import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Mail, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import logo from '../assets/images/groubhub logo.svg';

export default function StaffActivateEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setMessage('');

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      setError('Enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/accounts/staff/signin-email/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to send sign-in link.');
        return;
      }
      setSuccess(true);
      setMessage(data.message || 'Sign-in link sent. Check the backend console for the link in development.');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 text-slate-900 backdrop-blur-sm sm:p-6">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="activate-title"
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
            <Mail className="h-7 w-7" />
          </div>
          <h1 id="activate-title" className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            Staff sign in
          </h1>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Enter your lecturer email to receive a sign-in link.
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
                <div className="text-sm text-emerald-800">
                  <p className="font-semibold">Sign-in link sent</p>
                  <p className="mt-1">{message}</p>
                  <p className="mt-2 text-xs text-emerald-700">
                    In development, the activation link is printed to the backend console. 
                    Check the terminal running the Django server.
                  </p>
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
                {error || 'Enter your lecturer email to receive a sign-in link.'}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                Lecturer email
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
                  placeholder="lecturer@zetech.ac.ke"
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
                'Send sign-in link'
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