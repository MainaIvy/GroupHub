import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/images/groubhub logo.svg';

const GraduationCapIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7.5 10v5c0 .9.6 1.7 1.4 2l3.1 1.3c.3.1.6.1.9 0l3.1-1.3c.8-.3 1.4-1.1 1.4-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UserIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const SignUpRoleSelect = ({ setRole }) => {
  const roleCards = [
    {
      key: 'student',
      title: 'Student',
      description: 'Join as a student to collaborate on group projects, track assignments, and work seamlessly with your groupmates.',
      icon: GraduationCapIcon,
      iconClassName: 'bg-[#EAF2FF] text-[#1F4E79]',
      pillClassName: 'bg-[#1F4E79] text-white border-[#1F4E79] shadow-[0_10px_20px_rgba(31,78,121,0.18)]',
    },
    {
      key: 'lecturer',
      title: 'Lecturer',
      description: 'Join as a lecturer to oversee student projects and facilitate academic collaboration.',
      icon: UserIcon,
      iconClassName: 'bg-[#EAF8F4] text-[#1F4E79]',
      pillClassName: 'bg-[#1F4E79] text-white border-[#1F4E79] shadow-[0_10px_20px_rgba(31,78,121,0.18)]',
    },
  ];

  return (
    <div className="min-h-screen bg-[#26303B] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[760px]">
        <div className="rounded-[32px] bg-transparent p-0 text-center">
          <div className="mb-5 flex justify-center">
            <img src={logo} alt="GroupHub Logo" className="h-10 w-auto" />
          </div>

          <h1 className="text-3xl sm:text-[2.5rem] font-bold text-[#EBEBDD] tracking-[-0.04em]">
            Join GroupHub
          </h1>
          <p className="mt-2 text-base text-[#EBEBDD]/75">
            Choose your account type to get started
          </p>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {roleCards.map(({ key, title, description, icon: Icon, iconClassName, pillClassName }) => (
              <button
                key={key}
                type="button"
                onClick={() => setRole(key)}
                className="group flex h-full min-h-[330px] flex-col justify-between rounded-[28px] border border-[#E5E7EB] bg-white p-6 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1F4E79] hover:shadow-[0_18px_32px_rgba(31,78,121,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E79] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F3F3EE]"
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`mb-4 flex h-[5.2rem] w-[5.2rem] items-center justify-center rounded-full border border-[#DDE7F3] ${iconClassName}`}>
                    {React.createElement(Icon, { className: 'h-10 w-10' })}
                  </div>

                  <h3 className="text-[1.8rem] font-bold leading-none text-[#0F172A] transition-colors duration-200 group-hover:text-[#1F4E79]">
                    {title}
                  </h3>

                  <p className="mt-3 min-h-[84px] text-base leading-7 text-[#475569]">
                    {description}
                  </p>
                </div>

                <div className="mt-5 flex justify-center">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${pillClassName} group-hover:translate-y-[-1px]`}>
                    {`I'm a ${title}`}
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 pt-6">
            <p className="text-sm text-[#EBEBDD]/75">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-[#1F4E79] hover:text-[#173d5d] transition-colors ml-1"
              >
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SignUp = () => {
  const [selectedRole, setSelectedRole] = React.useState(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [courseOptions, setCourseOptions] = React.useState([]);
  const [courseLoading, setCourseLoading] = React.useState(false);
  const [courseError, setCourseError] = React.useState('');
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState('');
  const [selectedSemester, setSelectedSemester] = React.useState('');
  const [formError, setFormError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const departments = [
    'Computer Science',
    'School of Law',
    'Clinical Medicine',
    'Nursing',
    'Psychology & Social Sciences',
  ];

  React.useEffect(() => {
    if (selectedRole !== 'student') {
      return;
    }

    const controller = new AbortController();
    setCourseLoading(true);
    setCourseError('');

    fetch('/api/accounts/academic/courses/', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load courses.');
        }
        const data = await response.json();
        setCourseOptions(data.courses || []);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setCourseOptions([]);
          setCourseError(error.message || 'Unable to load the course catalog.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCourseLoading(false);
        }
      });

    return () => controller.abort();
    }, [selectedRole]);

    const selectedCourse = courseOptions.find((course) => String(course.id) === selectedCourseId);
    const availableYears = Object.keys(selectedCourse?.structure || {}).sort((first, second) => Number(first) - Number(second));
    const availableSemesters = selectedYear ? (selectedCourse?.structure?.[selectedYear] || []) : [];

  if (selectedRole) {
    const isStudent = selectedRole === 'student';

    return (
      <div className="min-h-screen bg-[#26303B] text-[#EBEBDD] flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[520px] rounded-[30px] border border-white/10 bg-[#0F172A] px-6 py-6 shadow-[0_30px_60px_rgba(15,23,42,0.45)]">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedRole(null)}
              className="text-sm font-medium text-[#EBEBDD]/70 hover:text-[#EBEBDD]"
            >
              ← Back
            </button>
            <span className="inline-block rounded-full bg-[#1F4E79] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              {isStudent ? 'Student' : 'Lecturer'}
            </span>
          </div>

          <div className="mb-6 flex justify-center">
            <img src={logo} alt="GroupHub" className="h-12 w-auto opacity-95" />
          </div>

          <h1 className="mb-2 text-center text-3xl font-bold text-[#EBEBDD]">
            {isStudent ? 'Student Sign Up' : 'Lecturer Sign Up'}
          </h1>
          <p className="mb-6 text-center text-sm text-[#EBEBDD]/70">
            {isStudent
              ? 'Create your student account to join groups and manage assignments.'
              : 'Create your lecturer account to manage units and supervise students.'}
          </p>

          <form
            className="space-y-4"
            onChange={() => { if (formError) setFormError(''); }}
            onSubmit={(event) => {
              event.preventDefault();
              setFormError('');
              const form = event.currentTarget;
              const formData = new FormData(form);

              if (isStudent) {
                // Student Payload
                const payload = {
                  user_type: 'student',
                  fullName: (formData.get('fullName') || '').toString().trim(),
                  admissionNumber: (formData.get('username') || '').toString().trim().toUpperCase(),
                  email: (formData.get('email') || '').toString().trim().toLowerCase(),
                  password: (formData.get('password') || '').toString(),
                  confirmPassword: (formData.get('confirmPassword') || '').toString(),
                  course_id: Number(formData.get('course_id')),
                  yearOfStudy: Number(formData.get('yearOfStudy')),
                  semester: Number(formData.get('semester')),
                };

                if (!payload.fullName || !payload.admissionNumber || !payload.email || !payload.password || !payload.confirmPassword || !payload.course_id || !payload.yearOfStudy || !payload.semester) {
                  setFormError('Complete all fields and choose a programme, year, and semester.');
                  return;
                }

                if (!/^[a-zA-Z0-9._%+-]+@zetech\.ac\.ke$/i.test(payload.email)) {
                  setFormError('Use your Zetech email address ending in @zetech.ac.ke.');
                  return;
                }

                if (!formData.get('agreeTerms')) {
                  setFormError('Please agree to the terms before creating your account.');
                  return;
                }

                if (payload.password !== payload.confirmPassword) {
                  setFormError('Passwords do not match.');
                  return;
                }

                setSubmitting(true);
                fetch('/api/accounts/signup/', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })
                  .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) {
                      throw new Error(data.error || 'Unable to create student account.');
                    }

                    const loginResponse = await fetch('/api/login/', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        username: payload.admissionNumber,
                        password: payload.password,
                      }),
                    });

                    const loginData = await loginResponse.json();
                    if (!loginResponse.ok) {
                      throw new Error(loginData.error || 'Unable to sign in automatically.');
                    }

                    localStorage.setItem('access_token', loginData.access || loginData.access_token || '');
                    localStorage.setItem('refresh_token', loginData.refresh || loginData.refresh_token || '');
                    localStorage.setItem('user', JSON.stringify({
                      id: loginData.user?.id || null,
                      email: loginData.user?.email || payload.email,
                      username: loginData.user?.username || payload.admissionNumber,
                      first_name: loginData.user?.first_name || payload.fullName.split(' ')[0],
                      last_name: loginData.user?.last_name || payload.fullName.split(' ').slice(1).join(' '),
                      user_type: 'student',
                      course: selectedCourse?.name || '',
                      year_of_study: String(payload.yearOfStudy),
                      semester: Number(payload.semester),
                      enrolled_course_id: payload.course_id,
                    }));

                    window.location.href = '/student-dashboard';
                  })
                  .catch((error) => {
                    setFormError(error.message || 'Unable to create student account.');
                  })
                  .finally(() => setSubmitting(false));

              } else {
                // Lecturer Payload
                const payload = {
                  user_type: 'lecturer',
                  username: (formData.get('username') || '').toString().trim().toUpperCase(),
                  staffId: (formData.get('username') || '').toString().trim().toUpperCase(),
                  fullName: (formData.get('fullName') || '').toString().trim(),
                  email: (formData.get('email') || '').toString().trim().toLowerCase(),
                  password: (formData.get('password') || '').toString(),
                  confirmPassword: (formData.get('confirmPassword') || '').toString(),
                  department: (formData.get('department') || '').toString().trim(),
                };

                if (!payload.username || !payload.fullName || !payload.email || !payload.password || !payload.confirmPassword || !payload.department) {
                  setFormError('Complete all lecturer fields before creating your account.');
                  return;
                }

                if (!/^[a-zA-Z0-9._%+-]+@zetech\.ac\.ke$/i.test(payload.email)) {
                  setFormError('Use your Zetech email address ending in @zetech.ac.ke.');
                  return;
                }

                if (payload.password !== payload.confirmPassword) {
                  setFormError('Passwords do not match.');
                  return;
                }

                if (!formData.get('agreeTerms')) {
                  setFormError('Please agree to the terms before creating your account.');
                  return;
                }

                setSubmitting(true);
                fetch('/api/accounts/signup/', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })
                  .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) {
                      throw new Error(data.error || 'Unable to create lecturer account.');
                    }

                    const loginResponse = await fetch('/api/login/', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        username: payload.username,
                        password: payload.password,
                      }),
                    });

                    const loginData = await loginResponse.json();
                    if (!loginResponse.ok) {
                      throw new Error(loginData.error || 'Unable to sign in automatically.');
                    }

                    const [firstName, ...rest] = (payload.fullName || '').split(' ');
                    const lastName = rest.join(' ');

                    localStorage.setItem('access_token', loginData.access || loginData.access_token || '');
                    localStorage.setItem('refresh_token', loginData.refresh || loginData.refresh_token || '');
                    localStorage.setItem('user', JSON.stringify({
                      id: loginData.user?.id || null,
                      email: loginData.user?.email || payload.email,
                      username: loginData.user?.username || payload.username,
                      user_type: 'lecturer',
                      first_name: firstName || 'Lecturer',
                      last_name: lastName || 'User',
                    }));

                    window.location.href = loginData.user?.user_type === 'student' ? '/student-dashboard' : '/lecturer-dashboard';
                  })
                  .catch((error) => {
                    setFormError(error.message || 'Unable to create lecturer account.');
                  })
                  .finally(() => setSubmitting(false));
              }
            }}
          >
            {/* Full Name (for both student & lecturer) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">Full Name</label>
              <input
                name="fullName"
                type="text"
                className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#EBEBDD]/5 px-4 py-3 text-[#EBEBDD] placeholder-[#EBEBDD]/40 focus:border-[#1F4E79] focus:outline-none"
                placeholder={isStudent ? 'e.g. Ivy Maina' : 'Dr. Jane Doe or Prof. James Mwangi'}
                required
              />
            </div>

            {/* Admission Number / Staff ID */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">
                {isStudent ? 'Admission Number (Adm)' : 'Staff ID'}
              </label>
              <input
                name="username"
                type="text"
                className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#EBEBDD]/5 px-4 py-3 text-[#EBEBDD] placeholder-[#EBEBDD]/40 focus:border-[#1F4E79] focus:outline-none"
                placeholder={isStudent ? 'e.g. ZEC/001/2024' : 'e.g. CS2345'}
                required
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">
                {isStudent ? 'Email' : 'Institutional Email'}
              </label>
              <input
                name="email"
                type="email"
                className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#EBEBDD]/5 px-4 py-3 text-[#EBEBDD] placeholder-[#EBEBDD]/40 focus:border-[#1F4E79] focus:outline-none"
                placeholder="name@zetech.ac.ke"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#EBEBDD]/5 px-4 py-3 pr-12 text-[#EBEBDD] placeholder-[#EBEBDD]/40 focus:border-[#1F4E79] focus:outline-none"
                  placeholder="Create a password"
                  required
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#EBEBDD]/70 hover:text-[#EBEBDD]"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">Confirm password</label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#EBEBDD]/5 px-4 py-3 pr-12 text-[#EBEBDD] placeholder-[#EBEBDD]/40 focus:border-[#1F4E79] focus:outline-none"
                  placeholder="Confirm password"
                  required
                />
                <button
                  type="button"
                  aria-label="Toggle confirm password visibility"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#EBEBDD]/70 hover:text-[#EBEBDD]"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Student Specific Fields */}
            {isStudent ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">Course / Programme</label>
                  <select
                    name="course_id"
                    value={selectedCourseId}
                    onChange={(event) => {
                      setSelectedCourseId(event.target.value);
                      setSelectedYear('');
                      setSelectedSemester('');
                    }}
                    className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#0F172A] px-4 py-3 text-[#EBEBDD] [color-scheme:light] focus:border-[#1F4E79] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    required
                    disabled={courseLoading || Boolean(courseError)}
                  >
                    <option value="" disabled className="bg-white text-slate-500">
                      {courseLoading ? 'Loading courses…' : 'Select course / programme'}
                    </option>
                    {courseOptions.map((course) => (
                      <option key={course.id} value={course.id} className="bg-white text-slate-900">{course.code} – {course.name}</option>
                    ))}
                  </select>
                  {courseLoading && <p role="status" className="mt-2 text-xs text-[#EBEBDD]/70">Loading course catalog…</p>}
                  {courseError && <p role="alert" className="mt-2 text-xs text-amber-300">{courseError}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">Year of Study</label>
                  <select
                    name="yearOfStudy"
                    value={selectedYear}
                    onChange={(event) => {
                      setSelectedYear(event.target.value);
                      setSelectedSemester('');
                    }}
                    className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#0F172A] px-4 py-3 text-[#EBEBDD] [color-scheme:light] focus:border-[#1F4E79] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    required
                    disabled={!selectedCourseId}
                  >
                    <option value="" disabled className="bg-white text-slate-500">Select year of study</option>
                    {availableYears.map((year) => <option key={year} value={year} className="bg-white text-slate-900">Year {year}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">Semester</label>
                  <select
                    name="semester"
                    value={selectedSemester}
                    onChange={(event) => setSelectedSemester(event.target.value)}
                    className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#0F172A] px-4 py-3 text-[#EBEBDD] [color-scheme:light] focus:border-[#1F4E79] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    required
                    disabled={!selectedYear}
                  >
                    <option value="" disabled className="bg-white text-slate-500">Select semester</option>
                    {availableSemesters.map((semester) => <option key={semester} value={semester} className="bg-white text-slate-900">Semester {semester}</option>)}
                  </select>
                </div>
              </>
            ) : (
              /* Lecturer Department Field */
              <div>
                <label className="mb-2 block text-sm font-medium text-[#EBEBDD]">Department / Faculty</label>
                <select
                  name="department"
                  defaultValue=""
                  className="w-full rounded-2xl border border-[#EBEBDD]/20 bg-[#0F172A] px-4 py-3 text-[#EBEBDD] focus:border-[#1F4E79] focus:outline-none"
                  required
                >
                  <option value="" disabled className="text-slate-700">Select a department</option>
                  {departments.map((department) => (
                    <option key={department} value={department} className="text-slate-900">{department}</option>
                  ))}
                </select>
              </div>
            )}

            {formError && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-white">{formError}</p>}

            <label className="flex items-start gap-3 text-sm text-[#EBEBDD]/80">
              <input
                name="agreeTerms"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-[#EBEBDD]/30 bg-[#0F172A] accent-[#1F4E79]"
              />
              <span>I agree to the terms and conditions.</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-full bg-[#1F4E79] px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#173d5d]"
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#EBEBDD]/70">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#1F4E79] hover:text-[#173d5d]">
              Log In
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <SignUpRoleSelect setRole={setSelectedRole} />;
};

export default SignUp;
