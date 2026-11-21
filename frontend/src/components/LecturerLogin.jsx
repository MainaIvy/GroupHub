import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import logo from '../assets/images/GROUPHUBLOGO.png';
import { API_BASE } from '../apiConfig';

export default function LecturerLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: 'lecturer123' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const emailRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const email = (formData.email || '').trim().toLowerCase();
    const password = formData.password || '';

    if (!email || !password) {
      setError('Email and password are required.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/accounts/lecturer/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.access) {
        setError(data?.error || data?.detail || 'Invalid email or password.');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh || '');
      const user = data.user || {};
      const mustChange = Boolean(user.must_change_password);
      localStorage.setItem('user', JSON.stringify({
        ...user,
        must_change_password: mustChange,
      }));

      if (mustChange) {
        navigate('/lecturer/change-password');
      } else {
        navigate('/lecturer/dashboard');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E9EF] flex items-start justify-center p-6">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="lecturer-login-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-lg"
      >
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="GroupHub" className="h-14 w-auto" />
          </div>
          <h1 id="lecturer-login-title" className="mt-4 text-2xl font-bold text-[#1F2D3D]">
            Lecturer Sign In
          </h1>
          <p className="mt-2 text-[#4F5F73]">
            Sign in to your lecturer workspace. Default password is <strong className="text-[#35475C]">lecturer123</strong>.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#1F2D3D] mb-1">
              Email address <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 transition-colors focus-within:border-[#35475C] focus-within:ring-2 focus-within:ring-[#35475C]/20">
              <svg className="h-5 w-5 shrink-0 text-[#4F5F73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
                <polyline points="22 6 12 13 2 6" />
              </svg>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-transparent text-sm text-[#1F2D3D] placeholder-[#9AA9B8] focus:outline-none"
                placeholder="name@university.edu"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1F2D3D] mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 transition-colors focus-within:border-[#35475C] focus-within:ring-2 focus-within:ring-[#35475C]/20">
              <svg className="h-5 w-5 shrink-0 text-[#4F5F73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7.5A4 4 0 0 1 16 7.5V10" />
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="w-full bg-transparent text-sm text-[#1F2D3D] placeholder-[#9AA9B8] focus:outline-none pr-10"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6079] hover:text-[#35475C]"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-[#4F5F73]">
              Default password: <strong className="text-[#35475C]">lecturer123</strong>. You will be prompted to change it after signing in.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#35475C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#435B76] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="pt-4 text-center text-sm text-[#4F5F73]">
            Already have your own password?{' '}
            <Link to="/login" className="font-semibold text-[#35475C] underline">
              Sign in with staff ID
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
