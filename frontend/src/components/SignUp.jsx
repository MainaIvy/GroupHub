import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/images/groubhub logo.svg';

const SignUp = () => {
  const [accountType, setAccountType] = useState(null); // 'student' or 'lecturer'
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    regNumber: '', // e.g., dcs-00-0001/2025 (optional UI field)
    university: '',
    yearOfStudy: '',
    password: '',
    confirmPassword: '',

    // legacy fields already used by your current UI
    studentId: '',
    course: '',

    staffId: '',
    department: '',
    coursesTaught: '',
    salutation: '',

    agreeToTerms: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!accountType) {
      alert('Please select an account type.');
      return;
    }

    const normalizedEmail = formData.email?.trim()?.toLowerCase?.() || '';
    const normalizedFullName = formData.fullName?.trim() || '';
    const normalizedUniversity = formData.university?.trim() || '';
    const normalizedPassword = formData.password || '';

    // Your task request: registration number + year of study snake_case.
    // However, your backend signup_view currently reads camelCase keys:
    // - student: course, yearOfStudy
    // - lecturer: salutation, staffId, department, coursesTaught
    // It also reads fullName and university.
    // To avoid the 400s, we send the exact keys your backend expects.
    // We additionally include snake_case duplicates for compatibility with any future serializers.

    const studentRegistrationNumber = (formData.regNumber || formData.studentId || '').trim();
    const studentYearOfStudy = String(formData.yearOfStudy || '').trim();
    const studentCourse = (formData.course || '').trim();

    const lecturerStaffId = (formData.staffId || '').trim();
    const lecturerDepartment = (formData.department || '').trim();
    const lecturerCoursesTaught = (formData.coursesTaught || '').trim();

    const signupData = {
      // Django User/serializer typical fields
      // Backend signup_view requires these keys: email, password, user_type
      user_type: accountType,

      // Map email -> username (and include both for safety)
      email: normalizedEmail,
      username: normalizedEmail,

      password: normalizedPassword,

      // Backend expects camelCase keys
      fullName: normalizedFullName,
      full_name: normalizedFullName,
      university: normalizedUniversity,

      // Also include snake_case duplicates (harmless if backend ignores them)
      university_snake_case: normalizedUniversity
    };

    if (accountType === 'student') {
      signupData.course = studentCourse;
      signupData.course_snake_case = studentCourse;

      // Backend reads: yearOfStudy
      signupData.yearOfStudy = studentYearOfStudy;
      signupData.year_of_study = studentYearOfStudy;

      // Not currently used by backend signup_view, but requested by you.
      signupData.registration_number = studentRegistrationNumber;
      signupData.registrationNumber = studentRegistrationNumber;
      signupData.regNumber = studentRegistrationNumber;

      // Keep legacy UI fields from your earlier component (harmless)
      signupData.studentId = studentRegistrationNumber;
    }

    if (accountType === 'lecturer') {
      signupData.salutation = (formData.salutation || '').trim();
      signupData.staffId = lecturerStaffId;
      signupData.department = lecturerDepartment;
      signupData.coursesTaught = lecturerCoursesTaught;

      // snake_case duplicates
      signupData.staff_id = lecturerStaffId;
      signupData.courses_taught = lecturerCoursesTaught;
      signupData.salutation_snake_case = signupData.salutation;
    }

    try {
      const response = await fetch('/api/signup/', {
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
        alert(data?.error || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('Network error. Please check your connection and try again.');
    }
  };

  if (!accountType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full space-y-10">
          <div className="text-center">
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 border border-[#F57D67] rounded-lg shadow-md text-sm font-medium text-white bg-[#F57D67] hover:bg-[#e66b5b] transition-colors"
            >
              ← Back to Home
            </Link>
            <div className="mt-8">
              <div className="flex justify-center mb-6">
                <img src={logo} alt="GroupHub Logo" className="h-20 w-auto" />
              </div>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Join GroupHub</h1>
              <p className="text-lg text-gray-600">Choose your account type to get started</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div
              onClick={() => setAccountType('student')}
              className="cursor-pointer bg-white p-10 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-blue-500 hover:scale-105 transform"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 p-4 bg-blue-50 rounded-full">
                  <svg className="w-16 h-16 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.84L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.84l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Student</h3>
                <p className="text-gray-600 text-center leading-relaxed">
                  Join as a student to collaborate on group projects, track assignments, and work seamlessly with your
                  grouopmates.
                </p>
              </div>
            </div>
            <div
              onClick={() => setAccountType('lecturer')}
              className="cursor-pointer bg-white p-10 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-green-500 hover:scale-105 transform"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 p-4 bg-green-50 rounded-full">
                  <svg className="w-16 h-16 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Lecturer</h3>
                <p className="text-gray-600 text-center leading-relaxed">
                  Join as a lecturer to oversee student projects, and facilitate academic collaboration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <img src={logo} alt="GroupHub Logo" className="h-16 w-auto" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {accountType === 'student' ? 'Student Sign Up' : 'Lecturer Sign Up'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-slate-600 hover:text-slate-500">
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-gray-600">
            Want to sign up as a {accountType === 'student' ? 'Lecturer' : 'Student'} instead?{' '}
            <button onClick={() => setAccountType(null)} className="font-medium text-slate-600 hover:text-slate-500">
              Switch
            </button>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {accountType === 'student' && (
              <>
                <div>
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

                <div>
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
                  <label htmlFor="yearOfStudy" className="sr-only">
                    Year of Study
                  </label>
                  <select
                    id="yearOfStudy"
                    name="yearOfStudy"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={formData.yearOfStudy}
                    onChange={handleChange}
                  >
                    <option value="">Select Year of Study</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                    <option value="5">5th Year</option>
                    <option value="6">6th Year</option>
                  </select>
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
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>

                {/* keep your older fields hidden/unused in UI contract */}
                <input type="hidden" name="studentId" value={formData.studentId} />
                <input type="hidden" name="course" value={formData.course} />
              </>
            )}

            {accountType === 'lecturer' && (
              <>
                <div>
                  <label htmlFor="salutation" className="sr-only">
                    Salutation
                  </label>
                  <select
                    id="salutation"
                    name="salutation"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={formData.salutation}
                    onChange={handleChange}
                  >
                    <option value="">Select Salutation</option>
                    <option value="Prof">Prof</option>
                    <option value="Dr">Dr</option>
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="fullName" className="sr-only">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Email address (e.g., email@zetech.ac.ke)"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="staffId" className="sr-only">
                    Staff ID
                  </label>
                  <input
                    id="staffId"
                    name="staffId"
                    type="text"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Staff ID (e.g., AB1234)"
                    value={formData.staffId}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="university" className="sr-only">
                    University/Institution
                  </label>
                  <select
                    id="university"
                    name="university"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={formData.university}
                    onChange={handleChange}
                  >
                    <option value="">Select University/Institution</option>
                    <option value="zetech">Zetech University</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="department" className="sr-only">
                    Department
                  </label>
                  <input
                    id="department"
                    name="department"
                    type="text"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Department"
                    value={formData.department}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="coursesTaught" className="sr-only">
                    Courses you teach
                  </label>
                  <input
                    id="coursesTaught"
                    name="coursesTaught"
                    type="text"
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Courses you teach (optional)"
                    value={formData.coursesTaught}
                    onChange={handleChange}
                  />
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
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              className={`h-4 w-4 focus:ring-slate-500 border-gray-300 rounded ${accountType === 'student' ? 'text-blue-600' : 'text-green-600'}`}
              checked={formData.agreeToTerms}
              onChange={handleChange}
            />
            <label htmlFor="agreeToTerms" className="ml-2 block text-sm text-gray-900">
              I agree to the{' '}
              <Link to="/terms" className="text-slate-600 hover:text-slate-500">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-slate-600 hover:text-slate-500">
                Privacy Policy
              </Link>
            </label>
          </div>

          <div>
            <button
              type="submit"
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${accountType === 'student' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUp;

