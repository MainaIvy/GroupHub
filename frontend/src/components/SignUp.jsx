import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, GraduationCap, ShieldCheck, Mail, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2, Clock, User, Building, Hash } from 'lucide-react';
import { getAcademicCourses } from '../api';
import { API_BASE } from '../apiConfig';
import logo from '../assets/images/GROUPHUBLOGO.png';

const PasswordRules = ({ value }) => {
  const minLen = value.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const allOk = minLen && hasLetter && hasDigit;
  return (
    <div className="text-[10px] leading-none">
      <div className={`flex items-center gap-1 mt-1 ${allOk ? 'text-[#4F5F73]' : 'text-[#9AA9B8]'}`}>
        <span className={`text-[10px] ${minOk(minLen) ? 'text-[#4CAF50]' : 'text-[#9AA9B8]'}`}>{minLen ? '\u2713' : '\u203a'}</span>
        <span>At least 8 characters</span>
      </div>
      <div className={`flex items-center gap-1 ${allOk ? 'text-[#4F5F73]' : 'text-[#9AA9B8]'}`}>
        <span className={`text-[10px] ${minOk(hasLetter) ? 'text-[#4CAF50]' : 'text-[#9AA9B8]'}`}>{minOk(hasLetter) ? '\u2713' : '\u203a'}</span>
        <span>Letters</span>
      </div>
      <div className={`flex items-center gap-1 mb-1 ${allOk ? 'text-[#4F5F73]' : 'text-[#9AA9B8]'}`}>
        <span className={`text-[10px] ${minOk(hasDigit) ? 'text-[#4CAF50]' : 'text-[#9AA9B8]'}`}>{minOk(hasDigit) ? '\u2713' : '\u203a'}</span>
        <span>Numbers</span>
      </div>
    </div>
  );
};

const minOk = (v) => Boolean(v);

const PasswordInput = ({
  id, name, label, value, onChange, required, autoComplete, showPassword, toggleShowPassword, error,
}) => (
  <div className="space-y-1">
    <label
      htmlFor={id}
      className={`block text-xs font-medium text-[#1F2D3D] mb-1 ${error ? 'text-red-600' : 'text-[#1F2D3D]'}`}
    >
      {label} <span className="text-red-500">*</span>
    </label>
    <div className="relative">
      <input
        id={id}
        name={name}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        className={`w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none pr-10 ${error ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20' : ''}`}
        placeholder={name === 'password' ? 'Create a password' : 'Confirm your password'}
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
    {value && <PasswordRules value={value} />}
    {error && <p className="text-[10px] text-red-600 mt-0.5">{error}</p>}
  </div>
);

const FieldError = ({ id, message }) => (
  <p id={id} className="text-[10px] text-red-600 mt-0.5">{message}</p>
);

const StepIndicator = ({ step }) => {
  const steps = ['Personal details', 'Academic details', 'Review & create'];
  return (
    <div className="flex items-center gap-4 mb-6">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex flex-col items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
            n < step ? 'bg-[#35475C] text-white' : n === step ? 'bg-[#35475C] text-white' : 'bg-[#EEF1F4] text-[#4F5F73] border border-[#D7DEE6]'
          }`}>{n}</div>
          <span className={`text-[10px] font-medium ${
            n <= step ? 'text-[#35475C]' : 'text-[#4F5F73]'
          }`}>{steps[n - 1]}</span>
        </div>
      ))}
    </div>
  );
};

const EditLink = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-xs font-semibold text-[#35475C] hover:text-[#1F2D3D] underline hover:underline"
  >
    Edit {label}
  </button>
);

const SignUp = () => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [academicCourses, setAcademicCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [signupError, setSignupError] = useState('');

  const STORAGE_KEY = 'grouphub_signup_form';

  const emptyForm = () => ({
    fullName: '',
    email: '',
    regNumber: '',
    university: '',
    academicLevel: '',
    courseId: '',
    yearOfStudy: '',
    semester: '',
    password: '',
    confirmPassword: '',
    studentId: '',
    course: '',
    agreeToTerms: false,
  });

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setFormData({ ...emptyForm(), ...parsed });
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch {
      // ignore quota errors
    }
  }, [formData]);

  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    setCoursesError('');
    getAcademicCourses()
      .then((courses) => {
        if (!cancelled) setAcademicCourses(courses);
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error.response?.data?.error || 'Courses could not be loaded. Please refresh and try again.';
          setCoursesError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const levelOrder = { certificate: 0, diploma: 1, bachelors: 2 };
  const academicLevels = useMemo(() => [...new Set(academicCourses.flatMap((course) => (course.units || [])
    .map((unit) => unit.academic_level?.trim())
    .filter(Boolean)))].sort((a, b) => {
    const la = levelOrder[a.toLowerCase()] ?? 99;
    const lb = levelOrder[b.toLowerCase()] ?? 99;
    return la - lb || a.localeCompare(b);
  }), [academicCourses]);

  const studentCourses = useMemo(() => academicCourses.filter((course) => (
    formData.academicLevel
    && (course.units || []).some((unit) => (
      unit.academic_level?.trim() === formData.academicLevel
    ))
  )), [academicCourses, formData.academicLevel]);

  const selectedStudentCourse = useMemo(() => academicCourses.find((course) => String(course.id) === formData.courseId), [academicCourses, formData.courseId]);

  const studentYears = useMemo(() => [...new Set(selectedStudentCourse?.units
    .filter((unit) => unit.academic_level?.trim() === formData.academicLevel)
    .map((unit) => String(unit.year_of_study)))].sort((a, b) => Number(a) - Number(b)),
  [selectedStudentCourse, formData.academicLevel]);

  const studentSemesters = useMemo(() => [...new Set(selectedStudentCourse?.units
    .filter((unit) => unit.academic_level?.trim() === formData.academicLevel
      && String(unit.year_of_study) === formData.yearOfStudy)
    .map((unit) => Number(unit.semester))
    .filter((semester) => Number.isInteger(semester) && semester > 0)
    .sort((a, b) => a - b))],
  [selectedStudentCourse, formData.academicLevel, formData.yearOfStudy]);

  const uniqueUniversities = useMemo(() => [...new Set(academicCourses.map((c) => c.university).filter(Boolean))], [academicCourses]);

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSignupError('');
  };

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  }, []);

  const validateStep1 = useCallback(() => {
    const errors = {};
    const email = String(formData.email || '').trim();
    const regNumber = String(formData.regNumber || '').trim();
    const password = formData.password || '';
    const confirmPassword = formData.confirmPassword || '';
    const fullName = String(formData.fullName || '').trim();

    if (!fullName) errors.fullName = 'Full name is required.';
    if (!email) errors.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (!regNumber) errors.regNumber = 'Registration number is required.';
    else if (!/^[a-zA-Z]{2,4}-\d{2}-\d{4}\/\d{4}$/.test(regNumber)) {
      errors.regNumber = 'Use format CODE-XX-XXXX/YYYY (e.g., DCS-00-0001/2025).';
    }
    if (!password) errors.password = 'Create a password.';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    else if (!/[a-zA-Z]/.test(password)) errors.password = 'Password must contain at least one letter.';
    else if (!/\d/.test(password)) errors.password = 'Password must contain at least one number.';
    if (!confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const validateStep2 = useCallback(() => {
    const errors = {};
    if (!formData.academicLevel) errors.academicLevel = 'Select an academic level.';
    if (!formData.courseId) errors.courseId = 'Select a course.';
    if (!formData.yearOfStudy) errors.yearOfStudy = 'Select a year of study.';
    if (!formData.semester) errors.semester = 'Select a semester.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');

    const step1Ok = validateStep1();
    const step2Ok = validateStep2();

    if (!step1Ok || !step2Ok) {
      setStep(1);
      return;
    }

    const normalizedEmail = String(formData.email || '').trim().toLowerCase();
    const normalizedFullName = String(formData.fullName || '').trim();
    const normalizedUniversity = String(formData.university || '').trim();
    const normalizedPassword = formData.password || '';
    const studentRegistrationNumber = String(formData.regNumber || '').trim();
    const studentYearOfStudy = String(formData.yearOfStudy || '').trim();
    const studentCourse = (selectedStudentCourse?.name || formData.course || '').trim();

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
    signupData.semester = Number(formData.semester);
    signupData.registration_number = studentRegistrationNumber;
    signupData.registrationNumber = studentRegistrationNumber;
    signupData.regNumber = studentRegistrationNumber;
    signupData.studentId = studentRegistrationNumber;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/accounts/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData)
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);

        if (data?.access) localStorage.setItem('access_token', data.access);
        if (data?.refresh) localStorage.setItem('refresh_token', data.refresh);

        const user = data.user || {};
        localStorage.setItem('user', JSON.stringify(user));

        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}

        let targetPath;
        if (user.is_staff) {
          targetPath = '/admin/dashboard';
        } else if (user.user_type === 'lecturer') {
          targetPath = user.lecturer_setup_required ? '/lecturer/setup' : '/lecturer/dashboard';
        } else {
          targetPath = '/student/dashboard';
        }
        window.location.href = targetPath;
      } else {
        const data = await response.json().catch(() => null);
        const serverError = data?.error || 'Signup failed. Please try again.';

        if (data?.field) {
          setFieldErrors({ [data.field]: serverError });
          setStep(1);
        } else {
          setSignupError(serverError);
        }
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  };

  const goToStep = (n) => setStep(n);

  const step1Complete = Boolean(formData.fullName && formData.email && formData.regNumber && formData.password && formData.confirmPassword);
  const step2Complete = Boolean(formData.academicLevel && formData.courseId && formData.yearOfStudy && formData.semester);

  const regPrefix = String(formData.regNumber || '').split('-')[0]?.toUpperCase();
  const programmeCode = selectedStudentCourse?.code?.toUpperCase();
  const prefixMismatch = regPrefix && programmeCode && regPrefix !== programmeCode;

  const intakeYearRaw = String(formData.regNumber || '').split('/')[1];
  const intakeYear = intakeYearRaw ? Number(intakeYearRaw) : null;
  const yearOfStudyNum = Number(formData.yearOfStudy || 0);
  const currentYear = new Date().getFullYear();
  let intakeWarning = '';
  if (intakeYear && yearOfStudyNum) {
    const expectedIntake = currentYear - (yearOfStudyNum - 1);
    if (Math.abs(intakeYear - expectedIntake) > 1) {
      intakeWarning = `Intake year ${intakeYear} doesn't align with year of study ${yearOfStudyNum} (expected around ${expectedIntake}).`;
    }
  }

  return (
    <div className="min-h-screen bg-[#E4E9EF] flex items-center justify-center p-4">
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-title"
        className="w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-6 shadow-lg"
      >
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#35475C] border border-[#D7DEE6] hover:bg-[#EEF1F4] hover:text-[#35475C] transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Home</span>
        </Link>
        <div className="mb-4 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="GroupHub" className="h-14 w-auto" />
          </div>
          <h1 id="signup-title" className="mt-3 text-xl font-bold text-[#1F2D3D]">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-[#4F5F73]">
            Join your campus community and make great things happen together.
          </p>
        </div>

        <StepIndicator step={step} />

        {/* Google signup + divider */}
        {step === 1 && (
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                window.location.href = `${API_BASE}/api/accounts/google/login/`;
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-4 py-3 text-sm font-medium text-[#1F2D3D] hover:bg-[#EEF1F4] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.19v2.85C3.58 23.47 8.13 25 12 25c5.16 0 9.42-3.86 9.96-8.75H12z"/>
                <path fill="#FBBC05" d="M12 5.38c1.61 0 3.09.59 4.23 1.56l3.15-3.15C17.08 1.48 14.37.3 12 .3 6.69.3 2.19 3.25 2.19 7.19h2.85c.44-1.73 1.97-3 3.96-3.5V5.38z"/>
                <path fill="#EA4335" d="M12 7.19c2.48 0 4.5 1.81 4.79 4.25h-2.95c-.21-1.08-.6-2-1.29-2.72v-1.53h3.57c.86 1.32 1.34 2.88 1.34 4.56 0 2.43-1.17 4.6-3.08 6.04v-2.09c-.2-.04-.41-.07-.61-.07H7.63v2.25h3.69c-1.16 1.94-2.92 3.16-4.97 3.16-2.57 0-4.81-1.6-5.59-3.81H2.19V7.19z"/>
              </svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-1.5 text-xs text-[#4F5F73]">
              <span className="flex h-[1px] flex-1 bg-[#D7DEE6]"></span>
              <span>or sign up with email</span>
              <span className="flex h-[1px] flex-1 bg-[#D7DEE6]"></span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Personal Details */}
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-[#1F2D3D] mb-4">Personal details</h2>
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
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none ${fieldErrors.fullName ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20' : 'border-[#D7DEE6]'}`}
                    placeholder="Full Name"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                  {fieldErrors.fullName && <FieldError id="error-fullName" message={fieldErrors.fullName} />}
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
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none ${fieldErrors.email ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20' : 'border-[#D7DEE6]'}`}
                    placeholder="email@zetech.ac.ke"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  {fieldErrors.email && <FieldError id="error-email" message={fieldErrors.email} />}
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
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none ${fieldErrors.regNumber ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20' : 'border-[#D7DEE6]'}`}
                    placeholder="e.g., DCS-00-0001/2025"
                    value={formData.regNumber}
                    onChange={handleChange}
                  />
                  {fieldErrors.regNumber && <FieldError id="error-regNumber" message={fieldErrors.regNumber} />}
                </div>
                {uniqueUniversities.length > 1 && (
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
                      {uniqueUniversities.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {fieldErrors.university && <FieldError id="error-university" message={fieldErrors.university} />}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <PasswordInput
                  id="password"
                  name="password"
                  label="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  showPassword={showPassword}
                  toggleShowPassword={() => setShowPassword(!showPassword)}
                  error={fieldErrors.password}
                />
              </div>
              <div className="space-y-1">
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  showPassword={showConfirmPassword}
                  toggleShowPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                  error={fieldErrors.confirmPassword}
                />
              </div>
              {prefixMismatch && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>
                    Registration prefix <b>{regPrefix}</b> doesn't match programme code <b>{programmeCode}</b>. It will be matched on the selected course.
                  </span>
                </div>
              )}
              {intakeWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{intakeWarning}</span>
                </div>
              )}
              {signupError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{signupError}</span>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  disabled={!step1Complete || submitting}
                  onClick={validateStep1 ? () => { if (validateStep1()) goToStep(2); } : goToStep(2)}
                  className={`w-auto rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    step1Complete ? 'bg-[#35475C] text-white hover:bg-[#435B76]' : 'bg-[#EEF1F4] text-[#4F5F73] cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </span>
                </button>
              </div>
            </>
          )}

          {/* Step 2: Academic Details */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-[#1F2D3D] mb-4">Academic details</h2>
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
                    onChange={(event) => setField('academicLevel', event.target.value)}
                  >
                    <option value="">
                      {coursesLoading ? 'Loading academic levels...' : academicLevels.length ? 'Select Academic Level' : 'No academic levels available'}
                    </option>
                    {academicLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                  {fieldErrors.academicLevel && <FieldError id="error-academicLevel" message={fieldErrors.academicLevel} />}
                  {coursesError && <p id="course-load-error" className="mt-1 text-xs text-red-600">{coursesError}</p>}
                </div>
                <div>
                  <label htmlFor="courseId" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                    Course <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="courseId"
                    name="courseId"
                    required
                    disabled={!formData.academicLevel || coursesLoading || studentCourses.length === 0}
                    className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    value={formData.courseId}
                    onChange={(event) => setField('courseId', event.target.value)}
                  >
                    <option value="">
                      {coursesLoading ? 'Loading courses...' : 'Select Course'}
                    </option>
                    {studentCourses.map((course) => (
                      <option key={course.id} value={course.id}>{course.code} — {course.name}</option>
                    ))}
                  </select>
                  {fieldErrors.courseId && <FieldError id="error-courseId" message={fieldErrors.courseId} />}
                  {!coursesLoading && formData.academicLevel && studentCourses.length === 0 && !coursesError && (
                    <p className="mt-1 text-xs text-[#9AA9B8]">No courses are available for this academic level.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="yearOfStudy" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                    Year of Study <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="yearOfStudy"
                    name="yearOfStudy"
                    required
                    disabled={!formData.academicLevel || !formData.courseId || coursesLoading}
                    className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    value={formData.yearOfStudy}
                    onChange={(event) => setField('yearOfStudy', event.target.value)}
                  >
                    <option value="">Select Year of Study</option>
                    {studentYears.map((year) => <option key={year} value={year}>Year {year}</option>)}
                  </select>
                  {fieldErrors.yearOfStudy && <FieldError id="error-yearOfStudy" message={fieldErrors.yearOfStudy} />}
                </div>
                <div>
                  <label htmlFor="semester" className="block text-xs font-medium text-[#1F2D3D] mb-1">
                    Semester <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="semester"
                    name="semester"
                    required
                    disabled={!formData.academicLevel || !formData.courseId || !formData.yearOfStudy || studentSemesters.length === 0}
                    className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    value={formData.semester}
                    onChange={(event) => setField('semester', event.target.value)}
                  >
                    <option value="">
                      {studentSemesters.length ? 'Select Semester' : 'No semesters available'}
                    </option>
                    {studentSemesters.map((semester) => (
                      <option key={semester} value={semester}>Semester {semester}</option>
                    ))}
                  </select>
                  {fieldErrors.semester && <FieldError id="error-semester" message={fieldErrors.semester} />}
                </div>
              </div>
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="w-auto rounded-lg border border-[#D7DEE6] px-4 py-3 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4] hover:border-[#B7C3D2] transition-colors"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>Back</span>
                    <ChevronLeft size={14} />
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!step2Complete || submitting}
                  onClick={() => { if (validateStep2()) goToStep(3); }}
                  className={`w-auto rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    step2Complete ? 'bg-[#35475C] text-white hover:bg-[#435B76]' : 'bg-[#EEF1F4] text-[#4F5F73] cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Step 3: Review & Create */}
          {step === 3 && (
            <>
              <h2 className="text-base font-semibold text-[#1F2D3D] mb-4">Review your details</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><User size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">Full name</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73] truncate">{formData.fullName}</p>
                      <EditLink onClick={() => goToStep(1)} label="name" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><Mail size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">Email address</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73] truncate max-w-[220px]">{formData.email}</p>
                      <EditLink onClick={() => goToStep(1)} label="email" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><Hash size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">Registration number</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73] truncate">{formData.regNumber}</p>
                      <EditLink onClick={() => goToStep(1)} label="reg. number" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><Building size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">University</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73] truncate">{formData.university || 'Not set'}</p>
                      <EditLink onClick={() => goToStep(1)} label="university" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><GraduationCap size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">Academic level</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73]">{formData.academicLevel}</p>
                      <EditLink onClick={() => goToStep(2)} label="level" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><Hash size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">Programme</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73] truncate">{selectedStudentCourse?.name || formData.course}</p>
                      <EditLink onClick={() => goToStep(2)} label="programme" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><Clock size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">Year of study</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73]">Year {formData.yearOfStudy}</p>
                      <EditLink onClick={() => goToStep(2)} label="year" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1F4] text-[#4F5F73]"><Clock size={16} /></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#1F2D3D]">Semester</p>
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-[#4F5F73]">Semester {formData.semester}</p>
                      <EditLink onClick={() => goToStep(2)} label="semester" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-[#D7DEE6] bg-[#EEF1F4] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#35475C] text-white"><CheckCircle2 size={16} /></div>
                  <div>
                    <p className="text-xs font-medium text-[#1F2D3D]">Account will be created</p>
                    <p className="text-xs text-[#4F5F73]">Your account will be active immediately after creation.</p>
                  </div>
                </div>
              </div>

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

              {signupError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{signupError}</span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="w-auto rounded-lg border border-[#D7DEE6] px-4 py-3 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4] hover:border-[#B7C3D2] transition-colors"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>Back</span>
                    <ChevronLeft size={14} />
                  </div>
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formData.agreeToTerms}
                  className={`w-auto rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    submitting ? 'bg-[#4F5F73] text-white cursor-not-allowed' : formData.agreeToTerms ? 'bg-[#35475C] text-white hover:bg-[#435B76]' : 'bg-[#EEF1F4] text-[#4F5F73] cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating account…
                      </>
                    ) : (
                      <>
                        <span>Create account</span>
                        <ChevronRight size={14} />
                      </>
                    )}
                  </div>
                </button>
              </div>
            </>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-[#4F5F73]">
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
