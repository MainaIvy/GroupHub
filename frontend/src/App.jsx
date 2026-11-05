import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './components/Home';
import SignUp from './components/SignUp';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import LecturerDashboard from './components/LecturerDashboard';
import About from './components/About';
import Contact from './components/Contact';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import AdminDashboard from './components/AdminDashboard';
import GroupChatRoom from './components/GroupChatRoom';
import JoinLink from './components/JoinLink';
import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
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
            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
              <Login />
            </GoogleOAuthProvider>
          }
        />

        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/lecturer/dashboard" element={<LecturerDashboard />} />
        <Route path="/lecturer-dashboard" element={<LecturerDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

