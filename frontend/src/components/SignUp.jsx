import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { GraduationCap, X, ShieldCheck, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
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

const PasswordInput = ({ id, name, placeholder, value, onChange, required, autoComplete, showPassword, toggleShowPassword }) => (
  <div className="relative">
    <input
      id={id}
      name={name}
      type={showPassword ? 'text' : 'password'}
      autoComplete={autoComplete}
      required={required}
      className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none pr-10"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
    <button
      type="button"
      onClick={toggleShowPassword}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6079] hover:text-[#35475C]"
      aria-label="Toggle password visibility"
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
);

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    regNumber: '',
    university: '',
    academicLevel: '',
    courseId: '',
    yearOfStudy: '',
    password: '',
    confirmPassword: '',
    studentId: '',
    course: '',
    agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [academicCourses, setAcademicCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const [signupError, setSignupError] = useState('');

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
      setSignupError('Passwords do not match');
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
      user_type: 'student',
      email: normalizedEmail,
      username: normalizedEmail,
      password: normalizedPassword,
      confirmPassword: normalizedPassword,
      fullName: normalizedFullName,
      full_name: normalizedFullName,
      university: normalizedUniversity,
      university_snake_case: normalizedUniversity,
    };

    signupData.admissionNumber = studentRegistrationNumber;
    signupData.course = studentCourse;
    signupData.course_snake_case = studentCourse;
    signupData.course_id = Number(formData.courseId);
    signupData.academic_level = formData.academicLevel;
    signupData.yearOfStudy = studentYearOfStudy;
    signupData.year_of_study = studentYearOfStudy;
    signupData.semester = studentSemester;
    signupData.registration_number = studentRegistrationNumber;
    signupData.registrationNumber = studentRegistrationNumber;
    signupData.regNumber = studentRegistrationNumber;
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
    <div className="min-h-screen bg-[#E4E9EF] flex items-center justify-center p-4">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-title"
        className="w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-6 shadow-lg"
      >
        <div className="mb-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#35475C]/10 text-[#35475C]">
            <img src={logo} alt="GroupHub" className="h-9 w-9" />
          </div>
          <h1 id="signup-title" className="mt-3 text-xl font-bold text-[#1F2D3D]">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-[#4F5F73]">
            Join your campus community and make great things happen together.
          </p>
        </div>

        <form className="signup-form space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                placeholder="email@zetech.ac.ke"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="regNumber" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                id="regNumber"
                name="regNumber"
                type="text"
                required
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                placeholder="e.g., dcs-00-0001/2025"
                value={formData.regNumber}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="university" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                University/Institution <span className="text-red-500">*</span>
              </label>
              <select
                id="university"
                name="university"
                required
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                value={formData.university}
                onChange={handleChange}
              >
                <option value="">Select University/Institution</option>
                <option value="zetech">Zetech University</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="academicLevel" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                Academic Level <span className="text-red-500">*</span>
              </label>
              <select
                id="academicLevel"
                name="academicLevel"
                required
                disabled={coursesLoading}
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
              <label htmlFor="yearOfStudy" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                Year of Study <span className="text-red-500">*</span>
              </label>
              <select
                id="yearOfStudy"
                name="yearOfStudy"
                required
                disabled={!formData.academicLevel}
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
          </div>

          <div>
            <label htmlFor="courseId" className="block text-xs font-medium text-[#1F2D3D] mb-1">
              Course <span className="text-red-500">*</span>
            </label>
            <select
              id="courseId"
              name="courseId"
              required
              disabled={!formData.academicLevel || !formData.yearOfStudy || coursesLoading || studentCourses.length === 0}
              className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
              <p className="mt-1 text-xs text-[#9AA9B8]">No courses are available for this academic level and year.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PasswordInput
              id="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              showPassword={showPassword}
              toggleShowPassword={() => setShowPassword(!showPassword)}
            />
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
              showPassword={showConfirmPassword}
              toggleShowPassword={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          </div>

          {/* keep your older fields hidden/unused in UI contract */}
          <input type="hidden" name="studentId" value={formData.studentId} />
          <input type="hidden" name="course" value={formData.course} />

          {signupError && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{signupError}</span>
            </div>
          )}

          <div className="flex items-start gap-3">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[#D7DEE6] bg-[#EEF1F4] text-[#35475C] focus:ring-[#35475C]"
              checked={formData.agreeToTerms}
              onChange={handleChange}
            />
            <label htmlFor="agreeToTerms" className="ml-2 text-sm leading-6 text-[#1F2D3D]">
              I agree to the{' '}
              <Link to="/terms" className="font-medium text-[#35475C] underline">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-medium text-[#35475C] underline">
                Privacy Policy
              </Link>
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#35475C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#435B76] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            Create Account
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#4F5F73]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#35475C] underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
};

export default SignUp;
