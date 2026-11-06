import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
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
    <button type="button" onClick={() => handleGoogleLogin()} disabled={isLoading}>
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
      const googleToken = tokenResponse?.access_token || tokenResponse?.id_token || tokenResponse?.token;
      if (!googleToken) throw new Error('Missing Google token.');

      const response = await fetch('/api/google/login/', {
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
      localStorage.setItem('user', JSON.stringify(user));
      window.location.href = user.is_staff
        ? '/admin/dashboard'
        : user.user_type === 'lecturer'
          ? (user.lecturer_setup_required ? '/lecturer/setup' : '/lecturer/dashboard')
          : '/student/dashboard';
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

      localStorage.setItem('user', JSON.stringify({
        id: profile.id || null,
        email: userEmail,
        username: profile.username || username,
        user_type: userType,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
            is_staff: isAdmin,
            lecturer_setup_required: Boolean(profile.lecturer_setup_required || data.lecturer_setup_required),
      }));

      setSuccessMessage('Login successful! Redirecting to your dashboard...');
      setTimeout(() => {
            const targetPath = isAdmin
              ? '/admin/dashboard'
              : userType === 'lecturer'
                ? (Boolean(profile.lecturer_setup_required || data.lecturer_setup_required) ? '/lecturer/setup' : '/lecturer/dashboard')
                : '/student/dashboard';
            window.location.href = targetPath;
      }, 500);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#26303B] text-[#EBEBDD] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[440px] rounded-[30px] border border-white/10 bg-[#0F172A] px-6 py-5 shadow-[0_30px_60px_rgba(15,23,42,0.45)] backdrop-blur-sm">
        <div className="mb-6 flex justify-center">
          <img src={logo} alt="GroupHub" className="h-12 w-auto opacity-95" />
        </div>

        <div className="mb-6 border-b border-[#EBEBDD]/20 pb-3">
          <button
            type="button"
            className="mx-auto block w-full text-center text-2xl font-semibold text-[#EBEBDD]"
          >
            Login
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="mb-2 block text-lg font-medium text-[#EBEBDD]">
              Admission number / Staff ID
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-[#EBEBDD]/25 bg-[#EBEBDD]/5 px-4 py-3 focus-within:border-[#9A694E] transition-colors">
              <svg className="h-5 w-5 text-[#EBEBDD]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
                className="w-full bg-transparent text-base text-[#EBEBDD] placeholder-[#EBEBDD]/50 focus:outline-none"
                placeholder="e.g. ZEC/001/2024 or CS2345"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-lg font-medium text-[#EBEBDD]">
              Password
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-[#EBEBDD]/25 bg-[#EBEBDD]/5 px-4 py-3 focus-within:border-[#9A694E] transition-colors">
              <svg className="h-5 w-5 text-[#EBEBDD]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7.5A4 4 0 0 1 16 7.5V10" />
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="w-full bg-transparent text-base text-[#EBEBDD] placeholder-[#EBEBDD]/50 focus:outline-none"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="text-[#EBEBDD]/70 hover:text-[#EBEBDD]"
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
            <Link to="/forgot-password" className="text-sm text-[#EBEBDD]/80 hover:text-[#EBEBDD] transition-colors">
              Forgot password?
            </Link>
          </div>

          {(validationError || error) && (
            <p className="rounded-xl border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-white">
              {validationError || error}
            </p>
          )}

          {successMessage && (
            <p className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-100">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-[#1F4E79] px-4 py-4 text-lg font-semibold text-white transition-colors hover:bg-[#173d5d] disabled:opacity-70"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#EBEBDD]/20" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#2C3D3A] px-3 text-xs uppercase tracking-[0.2em] text-[#EBEBDD]/60">
                or continue with
              </span>
            </div>
          </div>

          {googleEnabled && (
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              isLoading={googleLoading}
            />
          )}

          {googleError && (
            <p className="text-center text-xs text-white">{googleError}</p>
          )}

          <p className="pt-1 text-center text-base text-[#EBEBDD]/80">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-[#1F4E79] hover:text-[#173d5d]">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
