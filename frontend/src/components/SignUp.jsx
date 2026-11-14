import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { GraduationCap, X, ShieldCheck, Mail } from 'lucide-react';
import { getAcademicCourses } from '../api';
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

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    regNumber: '', // e.g., dcs-00-0001/2025 (optional UI field)
    university: '',
    academicLevel: '',
    courseId: '',
    yearOfStudy: '',
    password: '',
    confirmPassword: '',

    // legacy fields already used by your current UI
    studentId: '',
    course: '',

    agreeToTerms: false
  });

  const [academicCourses, setAcademicCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const [signupError, setSignupError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    setCoursesError('');
    getAcademicCourses()
      .then((courses) => {
        if (!cancelled) {
          setAcademicCourses(courses);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error.response?.data?.error || 'Courses could not be loaded. Please refresh and try again.';
          setCoursesError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCoursesLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const academicLevels = useMemo(
    () => [...new Set(academicCourses.flatMap((course) => (course.units || [])
      .map((unit) => unit.academic_level?.trim())
      .filter(Boolean)))].sort(),
    [academicCourses]
  );
  const studentCourses = academicCourses.filter((course) => (
    formData.academicLevel
    && (course.units || []).some((unit) => (
      unit.academic_level?.trim() === formData.academicLevel
      && (!formData.yearOfStudy || String(unit.year_of_study) === formData.yearOfStudy)
    ))
  ));
  const selectedStudentCourse = academicCourses.find((course) => String(course.id) === formData.courseId);
  const studentYears = [...new Set(studentCourses.flatMap((course) => (course.units || [])
    .filter((unit) => unit.academic_level?.trim() === formData.academicLevel)
    .map((unit) => String(unit.year_of_study))))].sort((a, b) => Number(a) - Number(b));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const normalizedEmail = formData.email?.trim()?.toLowerCase?.() || '';
    const normalizedFullName = formData.fullName?.trim() || '';
    const normalizedUniversity = formData.university?.trim() || '';
    const normalizedPassword = formData.password || '';

    const studentRegistrationNumber = (formData.regNumber || formData.studentId || '').trim();
    const studentYearOfStudy = String(formData.yearOfStudy || '').trim();
    const studentCourse = (selectedStudentCourse?.name || formData.course || '').trim();
    const studentLevelUnits = (selectedStudentCourse?.units || []).filter((unit) => (
      unit.academic_level?.trim() === formData.academicLevel
      && String(unit.year_of_study) === studentYearOfStudy
    ));
    const studentSemester = studentLevelUnits
      .map((unit) => Number(unit.semester))
      .filter((semester) => Number.isInteger(semester) && semester > 0)
      .sort((a, b) => a - b)[0];

    if (!formData.academicLevel || !formData.courseId || !studentYearOfStudy || !studentSemester) {
      setSignupError('Select an academic level, course, and year with available units.');
      return;
    }

    const signupData = {
      // Django User/serializer typical fields
      // Backend signup_view requires these keys: email, password, user_type
      user_type: 'student',

      // Map email -> username (and include both for safety)
      email: normalizedEmail,
      username: normalizedEmail,

      password: normalizedPassword,
      confirmPassword: normalizedPassword,

      // Backend expects camelCase keys
      fullName: normalizedFullName,
      full_name: normalizedFullName,
      university: normalizedUniversity,

      // Also include snake_case duplicates (harmless if backend ignores them)
      university_snake_case: normalizedUniversity
    };

    signupData.admissionNumber = studentRegistrationNumber;
    signupData.course = studentCourse;
    signupData.course_snake_case = studentCourse;
    signupData.course_id = Number(formData.courseId);
    signupData.academic_level = formData.academicLevel;
    signupData.yearOfStudy = studentYearOfStudy;
    signupData.year_of_study = studentYearOfStudy;
    signupData.semester = studentSemester;

    // Not currently used by backend signup_view, but requested by you.
    signupData.registration_number = studentRegistrationNumber;
    signupData.registrationNumber = studentRegistrationNumber;
    signupData.regNumber = studentRegistrationNumber;

    // Keep legacy UI fields from your earlier component (harmless)
    signupData.studentId = studentRegistrationNumber;

    try {
      const response = await fetch('/api/accounts/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData)
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        console.log('Signup successful:', data);

        if (data?.access) localStorage.setItem('access_token', data.access);
        if (data?.refresh) localStorage.setItem('refresh_token', data.refresh);

        window.location.href = '/login';
      } else {
        const data = await response.json().catch(() => null);
        setSignupError(data?.error || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError('Network error. Please check your connection and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-slate-950/45 p-2 text-slate-900 backdrop-blur-sm sm:p-3">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-title"
        className="relative my-auto max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/80 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.3)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-5"
      >
        <header className="mb-2 flex items-center justify-between">
          <img src={logo} alt="GroupHub" className="h-8 w-auto" />
          <Link
            to="/"
            aria-label="Close sign up"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </Link>
        </header>

        <div className="mx-auto mb-2 max-w-lg text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            <span id="signup-title">Create your account</span>
          </h1>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Join your campus community and make great things happen together.
          </p>
        </div>

        <form className="signup-form space-y-2" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:min-h-[216px] sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className="sr-only">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleChange}
              />
            </div>

                <div>
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Email address (e.g., email@zetech.ac.ke)"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="regNumber" className="sr-only">
                    Registration Number
                  </label>
                  <input
                    id="regNumber"
                    name="regNumber"
                    type="text"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Registration Number (e.g., dcs-00-0001/2025)"
                    value={formData.regNumber}
                    onChange={handleChange}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="university" className="sr-only">
                    University/Institution
                  </label>
                  <select
                    id="university"
                    name="university"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={formData.university}
                    onChange={handleChange}
                  >
                    <option value="">Select University/Institution</option>
                    <option value="zetech">Zetech University</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="academicLevel" className="sr-only">
                    Academic Level
                  </label>
                  <select
                    id="academicLevel"
                    name="academicLevel"
                    required
                    disabled={coursesLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={formData.academicLevel}
                    aria-describedby={coursesError ? 'course-load-error' : undefined}
                    onChange={(event) => setFormData((current) => ({
                      ...current,
                      academicLevel: event.target.value,
                      courseId: '',
                      yearOfStudy: '',
                    }))}
                  >
                    <option value="">
                      {coursesLoading ? 'Loading academic levels...' : academicLevels.length ? 'Select Academic Level' : 'No academic levels available'}
                    </option>
                    {academicLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                  {coursesError && <p id="course-load-error" className="mt-1 text-xs text-red-600">{coursesError}</p>}
                </div>

                <div>
                  <label htmlFor="yearOfStudy" className="sr-only">
                    Year of Study
                  </label>
                  <select
                    id="yearOfStudy"
                    name="yearOfStudy"
                    required
                    disabled={!formData.academicLevel}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={formData.yearOfStudy}
                    onChange={(event) => setFormData((current) => ({
                      ...current,
                      yearOfStudy: event.target.value,
                      courseId: '',
                    }))}
                  >
                    <option value="">Select Year of Study</option>
                    {studentYears.map((year) => <option key={year} value={year}>Year {year}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="courseId" className="sr-only">
                    Course
                  </label>
                  <select
                    id="courseId"
                    name="courseId"
                    required
                    disabled={!formData.academicLevel || !formData.yearOfStudy || coursesLoading || studentCourses.length === 0}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    value={formData.courseId}
                    onChange={(event) => setFormData((current) => ({
                      ...current,
                      courseId: event.target.value,
                    }))}
                  >
                    <option value="">
                      {coursesLoading ? 'Loading courses...' : 'Select Course'}
                    </option>
                    {studentCourses.map((course) => (
                      <option key={course.id} value={course.id}>{course.code} — {course.name}</option>
                    ))}
                  </select>
                  {!coursesLoading && formData.academicLevel && studentCourses.length === 0 && !coursesError && (
                    <p className="mt-1 text-xs text-slate-500">No courses are available for this academic level and year.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="sr-only">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>

                {/* keep your older fields hidden/unused in UI contract */}
                <input type="hidden" name="studentId" value={formData.studentId} />
                <input type="hidden" name="course" value={formData.course} />
          </div>

          {signupError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {signupError}
            </p>
          )}

          <div className="flex items-center">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-violet-600 focus:ring-violet-500"
              checked={formData.agreeToTerms}
              onChange={handleChange}
            />
            <label htmlFor="agreeToTerms" className="ml-2 block text-sm leading-6 text-slate-600">
              I agree to the{' '}
              <Link to="/terms" className="font-medium text-violet-700 hover:text-violet-900">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-medium text-violet-700 hover:text-violet-900">
                Privacy Policy
              </Link>
            </label>
          </div>

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-violet-500/30 focus:ring-offset-2"
            >
              Create Account
            </button>
          </div>
        </form>
        <p className="mt-2 border-t border-slate-100 pt-2 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-violet-700 transition hover:text-violet-900">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
};

export default SignUp;
