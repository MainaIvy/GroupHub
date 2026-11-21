import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import logo from '../assets/images/GROUPHUBLOGO.png';
import { API_BASE } from '../apiConfig';

export default function LecturerChangePassword() {
  const navigate = useNavigate();
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (field, value) => {
    setPasswords((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const { current, new: newPassword, confirm } = passwords;

    if (!current || !newPassword || !confirm) {
      setError('All password fields are required.');
      return;
    }
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must be at least 8 characters and contain both letters and numbers.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/accounts/lecturer/change-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({
          current_password: current,
          new_password: newPassword,
          confirm_password: confirm,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Password change failed.');
        return;
      }
      setSuccess(true);

      // Update stored user to clear must_change_password
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          user.must_change_password = false;
          localStorage.setItem('user', JSON.stringify(user));
        } catch {}
      }

      setTimeout(() => {
        navigate('/lecturer/dashboard');
      }, 1000);
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
        aria-labelledby="change-password-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-lg"
      >
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="GroupHub" className="h-14 w-auto" />
          </div>
          <h1 id="change-password-title" className="mt-4 text-2xl font-bold text-[#1F2D3D]">
            Change your password
          </h1>
          <p className="mt-2 text-[#4F5F73]">
            Your account was created with a default password. Please set a new password to continue.
          </p>
        </div>

        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 text-center">
            <p className="font-semibold mb-2">Password changed successfully!</p>
            <p className="text-xs">Redirecting to your dashboard...</p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="current" className="block text-sm font-medium text-[#1F2D3D] mb-1">
                Current password <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 transition-colors focus-within:border-[#35475C] focus-within:ring-2 focus-within:ring-[#35475C]/20">
                <svg className="h-5 w-5 shrink-0 text-[#4F5F73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7.5A4 4 0 0 1 16 7.5V10" />
                </svg>
                <input
                  id="current"
                  name="current"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full bg-transparent text-sm text-[#1F2D3D] placeholder-[#9AA9B8] focus:outline-none pr-10"
                  placeholder="••••••••"
                  value={passwords.current}
                  onChange={(e) => handleChange('current', e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6079] hover:text-[#35475C]"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label="Toggle password visibility"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-[#1F2D3D] mb-1">
                New password <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 transition-colors focus-within:border-[#35475C] focus-within:ring-2 focus-within:ring-[#35475C]/20">
                <svg className="h-5 w-5 shrink-0 text-[#4F5F73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7.5A4 4 0 0 1 16 7.5V10" />
                </svg>
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full bg-transparent text-sm text-[#1F2D3D] placeholder-[#9AA9B8] focus:outline-none pr-10"
                  placeholder="••••••••"
                  value={passwords.new}
                  onChange={(e) => handleChange('new', e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6079] hover:text-[#35475C]"
                  onClick={() => setShowNew(!showNew)}
                  aria-label="Toggle password visibility"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-[#4F5F73]">
                At least 8 characters with letters and numbers.
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1F2D3D] mb-1">
                Confirm new password <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 transition-colors focus-within:border-[#35475C] focus-within:ring-2 focus-within:ring-[#35475C]/20">
                <svg className="h-5 w-5 shrink-0 text-[#4F5F73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7.5A4 4 0 0 1 16 7.5V10" />
                </svg>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full bg-transparent text-sm text-[#1F2D3D] placeholder-[#9AA9B8] focus:outline-none pr-10"
                  placeholder="••••••••"
                  value={passwords.confirm}
                  onChange={(e) => handleChange('confirm', e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6079] hover:text-[#35475C]"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label="Toggle password visibility"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#35475C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#435B76] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing...
                </span>
              ) : (
                'Change password'
              )}
            </button>
          </form>
        )}

        <p className="pt-4 text-center text-sm text-[#4F5F73]">
          <Link to="/login" className="font-semibold text-[#35475C] underline">
            ← Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
