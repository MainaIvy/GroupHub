import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Home from './components/Home';
import SignUp from './components/SignUp';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import LecturerDashboard from './components/LecturerDashboard';
import LecturerSetup from './components/LecturerSetup';
import AdminDashboard from './components/AdminDashboard';
import About from './components/About';
import Contact from './components/Contact';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import GroupChatRoom from './components/GroupChatRoom';
import JoinLink from './components/JoinLink';
import StaffActivateEmail from './components/StaffActivateEmail';
import StaffActivate from './components/StaffActivate';
import StaffForgotPassword from './components/StaffForgotPassword';
import StaffResetPassword from './components/StaffResetPassword';
import CompleteProfile from './student/pages/CompleteProfile';
import { GoogleOAuthProvider } from '@react-oauth/google';

const ProtectedStudentRoute = ({ children }) => {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return <Navigate to="/login" replace />;
  }
  try {
    const user = JSON.parse(userStr);
    // Only redirect to complete-profile if:
    // - student AND profile incomplete AND not coming from signup (signup creates complete profiles)
    // Students who sign up via the form already fill in programme, year, semester
    if (user.user_type === 'student' && !user.profile_complete) {
      // Check if they just signed up (signup creates complete profile)
      // If profile_complete is false, they likely logged in via Google and need to complete profile
      return <Navigate to="/student/complete-profile" replace />;
    }
    return children;
  } catch {
    return <Navigate to="/login" replace />;
  }
};

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const loginPage = (
    <>
      <Login googleEnabled={Boolean(googleClientId)} />
    </>
  );

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/join/:code" element={<JoinLink />} />
        <Route path="/groupchatroom" element={<GroupChatRoom />} />
        <Route path="/groups/:groupId/chat" element={<GroupChatRoom />} />
        <Route path="/groupchatroom/:groupId" element={<GroupChatRoom />} />

        <Route
          path="/login"
          element={
            googleClientId ? (
              <GoogleOAuthProvider clientId={googleClientId}>
                {loginPage}
              </GoogleOAuthProvider>
            ) : loginPage
          }
        />

        <Route path="/staff/activate-email" element={<StaffActivateEmail />} />
        <Route path="/staff/activate/:token" element={<StaffActivate />} />
        <Route path="/staff/forgot-password" element={<StaffForgotPassword />} />
        <Route path="/staff/reset-password/:token" element={<StaffResetPassword />} />

        <Route path="/student/complete-profile" element={<CompleteProfile />} />

        <Route
          path="/student/dashboard"
          element={
            <ProtectedStudentRoute>
              <StudentDashboard />
            </ProtectedStudentRoute>
          }
        />
        <Route
          path="/student-dashboard"
          element={
            <ProtectedStudentRoute>
              <StudentDashboard />
            </ProtectedStudentRoute>
          }
        />
        <Route
          path="/student/units/:unitId"
          element={
            <ProtectedStudentRoute>
              <StudentDashboard />
            </ProtectedStudentRoute>
          }
        />
        <Route
          path="/student/groups/:groupId"
          element={
            <ProtectedStudentRoute>
              <StudentDashboard />
            </ProtectedStudentRoute>
          }
        />
        <Route path="/lecturer/dashboard" element={<LecturerDashboard />} />
        <Route path="/lecturer-dashboard" element={<LecturerDashboard />} />
        <Route path="/lecturer/setup" element={<LecturerSetup />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
