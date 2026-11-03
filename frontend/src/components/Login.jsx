import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import logo from '../assets/images/groubhub logo.svg';

const GoogleLoginButton = ({ googleClientId, onLoadingChange, onError }) => {
  const handleSuccess = async (credentialResponse) => {
    try {
      onLoadingChange(true);
      onError('');

      const idToken = credentialResponse?.credential;
      if (!idToken) {
        onError('Google sign-in failed: missing id_token from Google OAuth.');
        return;
      }

      const response = await fetch('/api/accounts/google/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);

        const localizedUser = {
          email: data?.user?.email || data?.user?.username || 'google-user',
          user_type: data?.user?.user_type || data?.user_type || 'student',
          first_name: data?.user?.first_name || 'User',
          last_name: data?.user?.last_name || 'Account',
        };
        localStorage.setItem('user', JSON.stringify(localizedUser));

        if (localizedUser.user_type === 'lecturer') {
          window.location.href = '/lecturer/dashboard';
        } else {
          window.location.href = '/student/dashboard';
        }
      } else {
        const message = data?.error || data?.detail || `Google login failed (HTTP ${response.status}).`;
        onError(message);
      }
    } catch (err) {
      console.error('Google login error:', err);
      onError('Google sign-in failed due to a network or server error.');
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError('Google sign-in was cancelled or failed.')}
        useOneTap={false}
        theme="outline"
        size="large"
        text="signin_with"
        shape="rectangular"
      />
    </div>
  );
};

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const emailRef = useRef(null);



  useEffect(() => {
    if (emailRef.current) emailRef.current.focus();
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
    e?.stopPropagation?.();

    setIsLoading(true);
    setError('');
    setValidationError('');

    const emailTrimmed = (formData.email || '').trim();
    const passwordTrimmed = formData.password || '';

    if (!emailTrimmed || !passwordTrimmed) {
      const missing = [];
      if (!emailTrimmed) missing.push('email');
      if (!passwordTrimmed) missing.push('password');
      setValidationError(`Please enter your ${missing.join(' and ')}.`);
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        username: emailTrimmed.toLowerCase(),
        password: passwordTrimmed,
      };

      const response = await fetch('/api/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);

        const emailTrimmedLower = emailTrimmed.toLowerCase();
        let calculatedUserType = data.user?.user_type || data.user_type;

        if (!calculatedUserType) {
          calculatedUserType = emailTrimmedLower.includes('lecturer') ? 'lecturer' : 'student';
        }

        localStorage.setItem(
          'user',
          JSON.stringify({
            email: emailTrimmedLower,
            user_type: calculatedUserType,
            first_name: 'User',
            last_name: 'Account',
          })
        );

        if (calculatedUserType === 'lecturer') {
          window.location.href = '/lecturer/dashboard';
          return;
        }

        window.location.href = '/student/dashboard';
        return;
      }

      const message = data?.error || data?.detail || `Login failed (HTTP ${response.status}).`;
      setError(message);
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logo} alt="GroupHub Logo" className="h-10 w-auto" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome Back</h1>
            <p className="text-base text-gray-600">Log in to continue</p>
          </div>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-1">
                  Email address
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-200 bg-gray-50 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-300 sm:text-sm transition-all duration-200"
                  placeholder="yourname@zetech.ac.ke"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div className="relative">
                <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-xl relative block w-full px-4 py-3 pr-10 border border-gray-200 bg-gray-50 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-300 sm:text-sm transition-all duration-200"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />

                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {(validationError || error) && (
                <p className="text-red-600 text-sm text-center">{validationError || error}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-amber-600 hover:text-amber-500 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-[#F57D67] hover:bg-[#e66b5b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F57D67] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : null}
                {isLoading ? 'Logging in...' : 'Log In'}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-100 text-gray-500">OR</span>
              </div>
            </div>

            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>

              <div>
                <GoogleLoginButton
                  googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}

                  onLoadingChange={setGoogleLoading}
                  onError={setGoogleError}
                />

                {googleLoading ? (
                  <p className="text-gray-600 text-sm text-center mt-2">Signing in...</p>
                ) : null}
                {googleError && <p className="text-red-600 text-sm text-center mt-2">{googleError}</p>}
              </div>
            </GoogleOAuthProvider>
          </form>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

