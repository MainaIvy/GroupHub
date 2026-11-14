import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { X, ShieldCheck, Mail } from 'lucide-react';
import logo from '../assets/images/groubhub logo.svg';

const GoogleGIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C34.73 32.657 30.83 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.962 3.037l5.657-5.657C34.046 6.053 29.268 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 19.123 12 24 12c3.059 0 5.842 1.154 7.962 3.037l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.268 0 10.046-2.053 13.719-5.419l-5.657-5.657C30.842 35.187 28.059 36 24 36c-6.83 0-10.73-3.343-11.303-7.999L6.306 33.31C9.656 39.663 16.318 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a11.999 11.999 0 0 1-3.68 6.592l5.657 5.657C36.963 36.116 44 30.44 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const GoogleSignInButton = ({ onSuccess, onError, isLoading }) => {
  const handleGoogleLogin = useGoogleLogin({
    onSuccess,
    onError,
  });

  return (
    <button
      type="button"
      onClick={() => handleGoogleLogin()}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
    >
      <GoogleGIcon className="h-5 w-5" />
      <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
    </button>
  );
};

const Login = ({ googleEnabled = false }) => {
  const [formData, setFormData] = useState({ username: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [validationError, setValidationError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const usernameRef = useRef(null);

  const handleGoogleSuccess = async (tokenResponse) => {
    try {
      setGoogleLoading(true);
      setGoogleError('');
      // @react-oauth/google returns the ID token in the `credential` field
      const googleToken = tokenResponse?.credential || tokenResponse?.id_token || tokenResponse?.access_token || tokenResponse?.token;
      if (!googleToken) throw new Error('Missing Google token.');

      const response = await fetch('/api/accounts/google/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.access) {
        throw new Error(data?.error || data?.detail || 'Google login failed.');
      }

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh || '');
      const user = data.user || {};
      const profileComplete = Boolean(user.profile_complete);
      localStorage.setItem('user', JSON.stringify(user));

      // Redirect logic
      let targetPath;
      if (user.is_staff) {
        targetPath = '/admin/dashboard';
      } else if (user.user_type === 'lecturer') {
        targetPath = user.lecturer_setup_required ? '/lecturer/setup' : '/lecturer/dashboard';
      } else if (user.user_type === 'student' && !profileComplete) {
        targetPath = '/student/complete-profile';
      } else {
        targetPath = '/student/dashboard';
      }
      window.location.href = targetPath;
    } catch (requestError) {
      console.error('Google login error:', requestError);
      setGoogleError('Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => setGoogleError('Google sign-in was cancelled.');

  useEffect(() => {
    if (usernameRef.current) usernameRef.current.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
    if (validationError) setValidationError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    setValidationError('');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    const username = (formData.username || '').trim();
    const passwordTrimmed = formData.password || '';

    if (!username || !passwordTrimmed) {
      setValidationError('Enter your admission number or staff ID and password.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: passwordTrimmed }),
      });

      const data = await response.json().catch(() => null);

          if (!response.ok) {
            const friendlyError = data?.error || data?.detail || 'Incorrect email or password. Please try again.';
            setError(friendlyError);
            return;
          }

      localStorage.setItem('access_token', data.access || data.access_token || '');
      localStorage.setItem('refresh_token', data.refresh || data.refresh_token || '');

      const profile = data.user || data.profile || data.account || {};
      const rawUserType = (
        profile.user_type ||
        profile.role ||
        data.user_type ||
        data.role ||
        data.type ||
        profile.type ||
        'student'
      )?.toString().toLowerCase();

      const userType = rawUserType === 'lecturer' ? 'lecturer' : 'student';
      const userEmail = (profile.email || data.email || '').toString().trim();
      const isAdmin = Boolean(profile.is_staff || data.is_staff);
      const profileComplete = Boolean(profile.profile_complete || data.profile_complete);

      localStorage.setItem('user', JSON.stringify({
        id: profile.id || null,
        email: userEmail,
        username: profile.username || username,
        user_type: userType,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
            is_staff: isAdmin,
            lecturer_setup_required: Boolean(profile.lecturer_setup_required || data.lecturer_setup_required),
            profile_complete: profileComplete,
      }));

      setSuccessMessage('Login successful! Redirecting to your dashboard...');
      setTimeout(() => {
            let targetPath;
            if (isAdmin) {
              targetPath = '/admin/dashboard';
            } else if (userType === 'lecturer') {
              targetPath = Boolean(profile.lecturer_setup_required || data.lecturer_setup_required) ? '/lecturer/setup' : '/lecturer/dashboard';
            } else if (userType === 'student' && !profileComplete) {
              targetPath = '/student/complete-profile';
            } else {
              targetPath = '/student/dashboard';
            }
            window.location.href = targetPath;
      }, 500);
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
        aria-labelledby="login-title"
        className="relative my-auto w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.3)] sm:p-8"
      >
        <header className="mb-5 flex items-center justify-between">
          <img src={logo} alt="GroupHub" className="h-8 w-auto" />
          <Link
            to="/"
            aria-label="Close sign in"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </Link>
        </header>

        <div className="mb-6 text-center">
          <h1 id="login-title" className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Sign in to continue to your GroupHub workspace.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">
              Admission number / Staff ID
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
              <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
                <path d="m5 7 7 6 7-6" />
              </svg>
              <input
                ref={usernameRef}
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                placeholder="e.g. ZEC/001/2024 or CS2345"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
              Password
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
                autoComplete="current-password"
                required
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="text-slate-400 transition hover:text-violet-700"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
                    <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c5 0 9 4 9 7 0 1.3-.8 2.74-2.1 4.1" />
                    <path d="M6.61 6.61A15.47 15.47 0 0 0 3 12c0 3 4 7 9 7 1.71 0 3.27-.38 4.61-1.05" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-violet-700 transition-colors hover:text-violet-900">
              Forgot password?
            </Link>
          </div>

          {(validationError || error) && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {validationError || error}
            </p>
          )}

          {successMessage && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:opacity-70"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                or continue with
              </span>
            </div>
          </div>

          {googleEnabled ? (
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              isLoading={googleLoading}
            />
          ) : (
            <button
              type="button"
              disabled
              title="Google sign-in is not configured"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 opacity-70"
            >
              <GoogleGIcon className="h-5 w-5" />
              <span>Continue with Google</span>
            </button>
          )}

          {googleError && (
            <p className="text-center text-xs text-red-600">{googleError}</p>
          )}

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                or sign in as staff
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {googleEnabled ? (
              <GoogleSignInButton
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                isLoading={googleLoading}
              />
            ) : (
              <button
                type="button"
                disabled
                title="Google sign-in is not configured"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 opacity-70"
              >
                <GoogleGIcon className="h-5 w-5" />
                <span>Continue with Google</span>
              </button>
            )}

            <Link
              to="/staff/activate-email"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Mail className="h-5 w-5" />
              </div>
              <span>Activate with email</span>
            </Link>
          </div>

          <p className="pt-1 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-violet-700 hover:text-violet-900">
              Sign up
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
};

export default Login;
