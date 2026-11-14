import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle, GraduationCap } from 'lucide-react';
import api from '../../api';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState('');
  const [formData, setFormData] = useState({
    admissionNumber: '',
    courseId: '',
    yearOfStudy: '',
    semester: '',
    firstName: '',
    lastName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [redirectTo, setRedirectTo] = useState('/student/dashboard');

  useEffect(() => {
    if (location.state?.from) {
      setRedirectTo(location.state.from);
    }
  }, [location]);

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
    api.get('/academic/courses/')
      .then((response) => {
        if (!cancelled) {
          setCourses(response.data.courses || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCoursesError('Failed to load programmes. Please refresh and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCoursesLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.first_name) setFormData(prev => ({ ...prev, firstName: user.first_name }));
        if (user.last_name) setFormData(prev => ({ ...prev, lastName: user.last_name }));
        // Pre-fill email prefix as admission number suggestion
        if (user.email && !formData.admissionNumber) {
          const prefix = user.email.split('@')[0].toUpperCase();
          setFormData(prev => ({ ...prev, admissionNumber: prefix }));
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [formData.admissionNumber]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCourseChange = (courseId) => {
    setFormData(prev => ({ ...prev, courseId, yearOfStudy: '', semester: '' }));
    setYears([]);
    setSemesters([]);
    if (!courseId) return;
    const course = courses.find(c => String(c.id) === String(courseId));
    if (course?.units) {
      const uniqueYears = [...new Set(course.units.map(u => u.year_of_study).filter(Boolean))].sort((a, b) => a - b);
      setYears(uniqueYears);
    }
  };

  const handleYearChange = (year) => {
    setFormData(prev => ({ ...prev, yearOfStudy: year, semester: '' }));
    setSemesters([]);
    if (!year || !formData.courseId) return;
    const course = courses.find(c => String(c.id) === String(formData.courseId));
    if (course?.units) {
      const uniqueSemesters = [...new Set(course.units.filter(u => u.year_of_study === Number(year)).map(u => u.semester).filter(Boolean))].sort((a, b) => a - b);
      setSemesters(uniqueSemesters);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const { admissionNumber, courseId, yearOfStudy, semester, firstName, lastName } = formData;

    if (!admissionNumber.trim()) {
      setError('Admission number is required.');
      return;
    }
    if (!/^[A-Z0-9\-/]+$/.test(admissionNumber.trim())) {
      setError('Admission number can only contain letters, numbers, hyphens, and slashes.');
      return;
    }
    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!courseId) {
      setError('Please select a programme.');
      return;
    }
    if (!yearOfStudy) {
      setError('Please select a year of study.');
      return;
    }
    if (!semester) {
      setError('Please select a semester.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/profile/complete/', {
        admission_number: admissionNumber.trim().toUpperCase(),
        course_id: Number(courseId),
        year_of_study: Number(yearOfStudy),
        semester: Number(semester),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      const data = response.data;
      const user = data.user || {};

      // Update localStorage with new user data
      localStorage.setItem('user', JSON.stringify({
        ...JSON.parse(localStorage.getItem('user') || '{}'),
        ...user,
        profile_complete: true,
      }));

      setSuccess(true);

      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 1500);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to complete profile. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#E4E9EF] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[#1F2D3D]">Profile Complete!</h2>
          <p className="mt-2 text-[#4F5F73]">
            You are enrolled in {data?.enrolled_units || 0} units for {data?.term || 'the current term'}.
          </p>
          <p className="mt-2 text-sm text-[#4F5F73]">Redirecting to dashboard...</p>
          <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-[#35475C]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E9EF] flex items-center justify-center p-6">
      <main className="w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#35475C]/10 text-[#35475C]">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#1F2D3D]">Complete Your Profile</h1>
          <p className="mt-2 text-[#4F5F73]">
            Please provide your academic details to finish setting up your account.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admissionNumber" className="block text-sm font-medium text-[#1F2D3D] mb-1">
              Admission Number
            </label>
            <input
              id="admissionNumber"
              name="admissionNumber"
              type="text"
              value={formData.admissionNumber}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
              placeholder="e.g., DCS-01-0001/2024"
              required
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-[#9AA9B8]">Your official admission/registration number</p>
          </div>

          <div>
            <label htmlFor="courseId" className="block text-sm font-medium text-[#1F2D3D] mb-1">
              Programme <span className="text-red-500">*</span>
            </label>
            <select
              id="courseId"
              name="courseId"
              value={formData.courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
              required
              disabled={isLoading || coursesLoading}
            >
              <option value="">Select your programme</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </select>
            {coursesLoading && <p className="mt-1 text-xs text-[#9AA9B8]">Loading programmes...</p>}
            {coursesError && <p className="mt-1 text-xs text-red-600">{coursesError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="yearOfStudy" className="block text-sm font-medium text-[#1F2D3D] mb-1">
                Year of Study <span className="text-red-500">*</span>
              </label>
              <select
                id="yearOfStudy"
                name="yearOfStudy"
                value={formData.yearOfStudy}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                required
                disabled={isLoading || years.length === 0}
              >
                <option value="">Select year</option>
                {years.map((year) => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
              {years.length === 0 && !coursesLoading && (
                <p className="mt-1 text-xs text-[#9AA9B8]">Select a programme first</p>
              )}
            </div>

            <div>
              <label htmlFor="semester" className="block text-sm font-medium text-[#1F2D3D] mb-1">
                Semester <span className="text-red-500">*</span>
              </label>
              <select
                id="semester"
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                required
                disabled={isLoading || semesters.length === 0}
              >
                <option value="">Select semester</option>
                {semesters.map((sem) => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
              {semesters.length === 0 && !coursesLoading && (
                <p className="mt-1 text-xs text-[#9AA9B8]">Select a year first</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-[#1F2D3D] mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                placeholder="First name"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-[#1F2D3D] mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2.5 text-sm text-[#1F2D3D] placeholder:text-[#9AA9B8] focus:border-[#35475C] focus:ring-2 focus:ring-[#35475C]/20 outline-none"
                placeholder="Last name"
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#35475C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#435B76] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Completing...
              </span>
            ) : (
              'Complete Profile'
            )}
          </button>
        </form>
      </main>
    </div>
  );
}