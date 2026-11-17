import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, X, ShieldCheck, Mail, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { getAcademicCourses } from '../api';
import { API_BASE } from '../apiConfig';
import logo from '../assets/images/GROUPHUBLOGO.png';

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
    semester: '',
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

  const levelOrder = { certificate: 0, diploma: 1, bachelors: 2 };
  const academicLevels = [...new Set(academicCourses.flatMap((course) => (course.units || [])
    .map((unit) => unit.academic_level?.trim())
    .filter(Boolean)))].sort((a, b) => {
    const la = levelOrder[a.toLowerCase()] ?? 99;
    const lb = levelOrder[b.toLowerCase()] ?? 99;
    return la - lb || a.localeCompare(b);
  });
  const studentCourses = academicCourses.filter((course) => (
    formData.academicLevel
    && (course.units || []).some((unit) => (
      unit.academic_level?.trim() === formData.academicLevel
    ))
  ));
  const selectedStudentCourse = academicCourses.find((course) => String(course.id) === formData.courseId);
  const studentYears = [...new Set(selectedStudentCourse?.units
    .filter((unit) => unit.academic_level?.trim() === formData.academicLevel)
    .map((unit) => String(unit.year_of_study)))].sort((a, b) => Number(a) - Number(b));

  const studentSemesters = [...new Set(selectedStudentCourse?.units
    .filter((unit) => unit.academic_level?.trim() === formData.academicLevel
      && String(unit.year_of_study) === formData.yearOfStudy)
    .map((unit) => Number(unit.semester))
    .filter((semester) => Number.isInteger(semester) && semester > 0)
    .sort((a, b) => a - b))];

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

    if (!formData.academicLevel || !formData.courseId || !studentYearOfStudy || !formData.semester) {
      setSignupError('Select an academic level, course, year, and semester with available units.');
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
    signupData.semester = Number(formData.semester);
    signupData.registration_number = studentRegistrationNumber;
    signupData.registrationNumber = studentRegistrationNumber;
    signupData.regNumber = studentRegistrationNumber;
    signupData.studentId = studentRegistrationNumber;

    try {
      const response = await fetch(`${API_BASE}/api/accounts/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData)
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        console.log('Signup successful:', data);

        if (data?.access) localStorage.setItem('access_token', data.access);
        if (data?.refresh) localStorage.setItem('refresh_token', data.refresh);

        const user = data.user || {};
        localStorage.setItem('user', JSON.stringify(user));

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
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#35475C] border border-[#D7DEE6] hover:bg-[#EEF1F4] hover:text-[#35475C] transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back</span>
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
                  semester: '',
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
              disabled={!formData.academicLevel || !formData.courseId}
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                value={formData.yearOfStudy}
                onChange={(event) => setFormData((current) => ({
                  ...current,
                  yearOfStudy: event.target.value,
                  semester: '',
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
                yearOfStudy: '',
                semester: '',
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
              <p className="mt-1 text-xs text-[#9AA9B8]">No courses are available for this academic level.</p>
            )}
          </div>

          <div>
            <label htmlFor="semester" className="block text-xs font-medium text-[#1F2D3D] mb-1">
              Semester <span className="text-red-500">*</span>
            </label>
            <select
              id="semester"
              name="semester"
              required
              disabled={!formData.academicLevel || !formData.courseId || studentSemesters.length === 0}
              className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={formData.semester}
              onChange={(event) => setFormData((current) => ({
                ...current,
                semester: event.target.value,
              }))}
            >
              <option value="">
                {studentSemesters.length ? 'Select Semester' : 'No semesters available'}
              </option>
              {studentSemesters.map((semester) => (
                <option key={semester} value={semester}>Semester {semester}</option>
              ))}
            </select>
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
