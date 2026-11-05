import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import slide1 from '../assets/images/slideshow_1.jpg';
import slide2 from '../assets/images/slideshow_2.jpg';
import slide3 from '../assets/images/slideshow_3.jpg';
import slide4 from '../assets/images/slideshow_4.jpg';

const GraduationCapIcon = ({ className = '' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 10v5c0 .9.6 1.7 1.4 2l3.1 1.3c.3.1.6.1.9 0l3.1-1.3c.8-.3 1.4-1.1 1.4-2v-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UserIcon = ({ className = '' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M20 21a8 8 0 0 0-16 0"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

const HomeWireframeIcon = ({ className = '' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 10.5 12 4l8 6.5V20a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 20v-9.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M9.2 21.6v-7.1c0-.9.7-1.6 1.6-1.6h2.4c.9 0 1.6.7 1.6 1.6v7.1"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const slidesInit = [slide1, slide2, slide3, slide4];

const SignUpOnboarding = ({ setRole }) => {
  const [slides] = useState(slidesInit);
  const [slideIndex, setSlideIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNextIndex((prev) => (prev + 1) % slides.length);
      setSlideIndex((prev) => (prev + 1) % slides.length);
      setFadeKey((k) => k + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <div className="h-screen w-full relative overflow-hidden flex flex-col justify-between">
      {/* Background Slideshow */}
      <div className="h-screen w-full fixed top-0 left-0 z-0 overflow-hidden">
        <div className="absolute inset-0">
          <img
            key={`bg-${slideIndex}`}
            src={slides[slideIndex]}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out opacity-100"
          />
          <img
            key={`fade-${fadeKey}`}
            src={slides[nextIndex]}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out opacity-0"
            style={{ pointerEvents: 'none' }}
            onLoad={(e) => {
              const img = e.currentTarget;
              requestAnimationFrame(() => {
                img.classList.remove('opacity-0');
                img.classList.add('opacity-100');
              });
            }}
          />
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[4px] z-10" />
      </div>

      {/* Top Header Controls */}
      <header className="relative z-20 px-6 sm:px-10 py-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="relative group flex items-center">
            <Link
              to="/"
              className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 hover:border-white/30 text-white transition-all duration-200 flex items-center justify-center"
              aria-label="Back to home"
            >
              <HomeWireframeIcon className="w-5 h-5" />
            </Link>

            <span className="absolute left-14 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-200 bg-slate-900 border border-slate-700 text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap">
              Back to home
            </span>
          </div>

          <div>
            <span className="text-white font-bold tracking-tight text-xl">
              Group<span className="text-[#FF7A00]">Hub</span>
            </span>
          </div>
        </div>
      </header>

      {/* Center Role Selection */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-lg mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Who's using GroupHub?
          </h1>
          <p className="text-slate-300 text-sm sm:text-base mt-2">
            Select your workspace profile to get started.
          </p>
        </div>

        {/* Role Cards */}
        <div className="flex flex-row items-center justify-center gap-6 sm:gap-8 max-w-md w-full">
          {/* Student Card */}
          <button
            type="button"
            onClick={() => setRole('student')}
            className="group relative flex flex-col items-center justify-center w-36 sm:w-44 h-40 sm:h-48 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-[#FF7A00] transition-all duration-300 hover:-translate-y-1"
          >
            <div className="p-3.5 rounded-2xl bg-white/5 group-hover:bg-[#FF7A00]/10 transition-colors mb-3">
              <GraduationCapIcon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-200 group-hover:text-[#FF7A00] transition-colors" />
            </div>
            <span className="text-white font-semibold text-base sm:text-lg group-hover:text-[#FF7A00] transition-colors">
              Student
            </span>
            <span className="text-xs text-slate-400 mt-0.5">Join & manage groups</span>
          </button>

          {/* Lecturer Card */}
          <button
            type="button"
            onClick={() => setRole('lecturer')}
            className="group relative flex flex-col items-center justify-center w-36 sm:w-44 h-40 sm:h-48 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-[#FF7A00] transition-all duration-300 hover:-translate-y-1"
          >
            <div className="p-3.5 rounded-2xl bg-white/5 group-hover:bg-[#FF7A00]/10 transition-colors mb-3">
              <UserIcon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-200 group-hover:text-[#FF7A00] transition-colors" />
            </div>
            <span className="text-white font-semibold text-base sm:text-lg group-hover:text-[#FF7A00] transition-colors">
              Lecturer
            </span>
            <span className="text-xs text-slate-400 mt-0.5">Create & oversee units</span>
          </button>
        </div>

        {/* Footer Link */}
        <div className="mt-10 text-center">
          <p className="text-sm font-medium text-slate-300">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-[#FF7A00] hover:text-[#e66e00] font-semibold hover:underline ml-1"
            >
              Log In
            </Link>
          </p>
        </div>
      </main>

      {/* Subtle Bottom Spacer */}
      <footer className="relative z-20 py-4 text-center text-xs text-slate-500">
        © 2026 GroupHub. All rights reserved.
      </footer>
    </div>
  );
};

export default SignUpOnboarding;