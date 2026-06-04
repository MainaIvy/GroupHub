import React from 'react';
import { Shield, Mail, MapPin } from 'lucide-react';
import logo from '../assets/images/groubhub logo.svg';
import { NavLink } from 'react-router-dom';
import Footer from './common/Footer';


const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <nav className="bg-slate-700 text-white p-2 sticky top-0 z-10 w-full">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <img src={logo} alt="Logo" className="h-12 w-auto mr-4" />
          </div>
          <div className="space-x-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? 'text-white bg-[#F57D67] px-4 py-2 rounded-md'
                  : 'hover:text-slate-300 px-4 py-2 rounded-md'
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                isActive
                  ? 'text-white bg-[#F57D67] px-3 py-1 rounded-md'
                  : 'hover:text-slate-300'
              }
            >
              About
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                isActive
                  ? 'text-white bg-[#F57D67] px-3 py-1 rounded-md'
                  : 'hover:text-slate-300'
              }
            >
              Contact
            </NavLink>
            <NavLink
              to="/signup"
              className={({ isActive }) =>
                isActive
                  ? 'text-white bg-[#F57D67] px-4 py-2 rounded-md'
                  : 'bg-white text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100'
              }
            >
              Sign Up
            </NavLink>
          </div>
        </div>
      </nav>


      {/* Hero */}
      <section className="relative overflow-hidden w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-800 to-[#F57D67] opacity-95" />
        <div className="relative container mx-auto px-4 py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white border border-white/15">
              <Shield size={16} /> Privacy Policy
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-extrabold text-white leading-tight">
              GroupHub Privacy Policy
            </h1>
            <p className="mt-4 text-white/90 text-lg">Last Updated: May 28, 2026</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-10 flex-grow">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <p className="text-slate-600 italic mb-6">
            Welcome to GroupHub. We are committed to protecting the privacy of our academic users.
          </p>

          <h2 className="text-2xl font-bold mb-3">1. Introduction</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            Welcome to GroupHub. We are committed to protecting the privacy of our academic users. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our platform to
            manage academic project groups, assign milestones, and communicate with your teammates and instructors.
          </p>
          <p className="text-slate-700 leading-relaxed mb-8">
            By accessing or using GroupHub, you agree to the terms of this Privacy Policy.
          </p>

          <h2 className="text-2xl font-bold mb-3">2. Information We Collect</h2>
          <h3 className="text-xl font-semibold mb-2">A. Account &amp; Profile Information</h3>
          <ul className="list-disc pl-5 text-slate-700 leading-relaxed mb-6">
            <li>Students: Full name, university email address, student registration number (ID), role selection, and profile metrics.</li>
            <li>Lecturers / Supervisors: Full name, institutional email address, department details, and assigned course units.</li>
          </ul>

          <h3 className="text-xl font-semibold mb-2">B. Workspace &amp; Collaboration Content</h3>
          <ul className="list-disc pl-5 text-slate-700 leading-relaxed mb-8">
            <li>Project Tracking Data: Group names, assigned task descriptions, milestone due dates, submission histories, and individual project logs.</li>
            <li>Internal Communications: Text messages, file attachments, and timestamps generated within private group workspace chat panels.</li>
          </ul>

          <h2 className="text-2xl font-bold mb-3">3. How We Use Your Information</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            We use the collected information strictly to enhance academic accountability and platform utility:
          </p>
          <ul className="list-disc pl-5 text-slate-700 leading-relaxed mb-8">
            <li>To Enable Collaboration: Allowing students to search for, invite, and onboard peers into designated project groups.</li>
            <li>To Facilitate Fair Grading: Compiling transparent, real-time participation metrics and project history logs accessible exclusively to authorized faculty supervisors via the Lecturer Portal.</li>
            <li>To Communicate Updates: Sending automated email alerts for upcoming project deadlines, task completions, or system notifications.</li>
          </ul>

          <h2 className="text-2xl font-bold mb-3">4. Information Sharing &amp; Disclosure</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            We value your academic privacy. GroupHub does not sell, rent, or trade your personal data to third-party advertisers. Your information is only shared within the following boundaries:
          </p>
          <ul className="list-disc pl-5 text-slate-700 leading-relaxed mb-6">
            <li>
              <span className="font-semibold">Team Transparancy:</span> Your profile name, task status, and chat messages are visible to verified members of your specific project group.
            </li>
            <li>
              <span className="font-semibold">Faculty Visibility:</span> Authorized lecturers, unit supervisors, and department administrators can view your task completion graphs, activity logs, and milestone deadlines.
            </li>
          </ul>
          <p className="text-slate-700 leading-relaxed mb-8">
            <span className="font-semibold">Chat Privacy Note:</span> While task activity charts and submission logs are transparently shared with instructors for objective grading, private group chat text channels remain restricted to group participants to support uninhibited team brainstorming.
          </p>

          <h2 className="text-2xl font-bold mb-3">5. Data Security</h2>
          <p className="text-slate-700 leading-relaxed mb-8">
            We implement industry-standard security measures to keep your data safe. All connection traffic to our Django backend is encrypted. Project files, database records, and authentication tokens are securely managed to prevent unauthorized leaks or modifications.
          </p>

          <h2 className="text-2xl font-bold mb-3">6. Your Rights &amp; Control</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            You retain control over your platform data:
          </p>
          <ul className="list-disc pl-5 text-slate-700 leading-relaxed mb-8">
            <li>
              <span className="font-semibold">Profile Corrections:</span> You can update your full name or password at any time via your Account Settings dashboard.
            </li>
            <li>
              <span className="font-semibold">Data Deletion:</span> Upon the successful completion and grading of an academic semester unit, account archiving or data removal can be requested in accordance with your university’s IT data-retention guidelines by contacting our support team.
            </li>
          </ul>

          <h2 className="text-2xl font-bold mb-3">7. Contact Us</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            If you have any questions or concerns regarding this Privacy Policy or how your student/faculty metrics are managed, please reach out to us:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="text-[#F57D67]" size={20} />
                <h3 className="text-lg font-semibold">Email</h3>
              </div>
              <p className="text-slate-700">
                <a href="mailto:privacy@grouphub.ac.ke" className="text-[#F57D67] hover:underline">
                  privacy@grouphub.ac.ke
                </a>
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="text-[#F57D67]" size={20} />
                <h3 className="text-lg font-semibold">Office Location</h3>
              </div>
              <p className="text-slate-700">Zetech University Main Campus, Technology &amp; Innovation Hub, 3rd Floor, Room 302</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer active="privacy" />
    </div>

  );
};

export default PrivacyPolicy;



