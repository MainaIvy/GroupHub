import React from 'react';
import { Shield, Mail, MapPin } from 'lucide-react';
import logo from '../assets/images/groubhub logo.svg';
import { NavLink } from 'react-router-dom';
import Footer from './common/Footer';


const TermsOfService = () => {
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
              <Shield size={16} /> Terms of Service
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-extrabold text-white leading-tight">
              GroupHub Terms of Service
            </h1>
            <p className="mt-4 text-white/90 text-lg">Last Updated: May 28, 2026</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-10 flex-grow">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-2xl font-bold mb-3">1. Acceptance of Terms</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            By creating an account, logging in, or using any feature on GroupHub, you agree to be bound by these Terms of
            Service. If you do not agree to these terms, you may not access or use the platform. These terms apply to all
            visitors, students, lecturers, and others who access the service.
          </p>

          <h2 className="text-2xl font-bold mb-3">2. User Accounts &amp; Eligibility</h2>
          <h3 className="text-xl font-semibold mb-2">Academic Use</h3>
          <p className="text-slate-700 leading-relaxed mb-4">
            GroupHub is built explicitly for educational institutions, project collaboration, and classroom management.
            Accounts should be registered using valid institutional or university-provided email addresses.
          </p>
          <h3 className="text-xl font-semibold mb-2">Account Security</h3>
          <p className="text-slate-700 leading-relaxed mb-4">
            You are entirely responsible for maintaining the confidentiality of your login credentials (username and
            password). You agree to notify support immediately if you suspect any unauthorized use of your account.
          </p>
          <h3 className="text-xl font-semibold mb-2">Accuracy</h3>
          <p className="text-slate-700 leading-relaxed mb-6">
            You agree to provide true, accurate, and current profile information, including using your real academic name for
            project logging and supervisor verification.
          </p>

          <h2 className="text-2xl font-bold mb-3">3. Platform Rules &amp; Academic Integrity</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            GroupHub is designed to foster fair collaboration and transparent tracking. By using the platform, you agree to
            adhere to the following behavioral standards:
          </p>

          <h3 className="text-xl font-semibold mb-2">A. Academic Honesty</h3>
          <h4 className="text-lg font-semibold mb-2">Accurate Logging</h4>
          <p className="text-slate-700 leading-relaxed mb-4">
            You must only log tasks, write updates, or check off milestones that accurately reflect your true personal
            contributions. Falsifying activity metrics or logging work on behalf of a user who did not participate is
            strictly prohibited.
          </p>
          <h4 className="text-lg font-semibold mb-2">Plagiarism &amp; Code Sharing</h4>
          <p className="text-slate-700 leading-relaxed mb-6">
            Any project files, documents, or source code uploaded to GroupHub workspaces must comply with your
            institution's academic integrity policies.
          </p>

          <h3 className="text-xl font-semibold mb-2">B. Acceptable Conduct</h3>
          <h4 className="text-lg font-semibold mb-2">Respectful Communication</h4>
          <p className="text-slate-700 leading-relaxed mb-4">
            Group workspace chats must remain professional and free of harassment, abusive language, discrimination, or
            bullying against teammates or faculty supervisors.
          </p>
          <h4 className="text-lg font-semibold mb-2">No Malicious Use</h4>
          <p className="text-slate-700 leading-relaxed mb-6">
            You may not attempt to disrupt the Django backend server, inject malicious scripts into JSX inputs, bypass
            workspace authentication layers, or reverse-engineer the dashboard tracking metrics.
          </p>

          <h2 className="text-2xl font-bold mb-3">4. Role-Specific Guidelines</h2>
          <h3 className="text-xl font-semibold mb-2">👥 For Students</h3>
          <p className="text-slate-700 leading-relaxed mb-6">
            Forming a group or sharing an onboarding invite link binds you to collective project tracking. You acknowledge
            that while group chat content is kept private to your team, your specific task board activity logs, submission
            timelines, and phase progress percentages are made visible to your unit instructor for objective grading
            evaluation.
          </p>

          <h3 className="text-xl font-semibold mb-2">🎓 For Lecturers &amp; Supervisors</h3>
          <p className="text-slate-700 leading-relaxed mb-6">
            Lecturer accounts are granted administrative access to track assigned student group metrics. Supervisors agree
            to use the dashboard metrics, activity history logs, and participation charts strictly for fair academic
            evaluation, guidance, and grading purposes.
          </p>

          <h2 className="text-2xl font-bold mb-3">5. Intellectual Property</h2>
          <h3 className="text-xl font-semibold mb-2">Your Content</h3>
          <p className="text-slate-700 leading-relaxed mb-4">
            Students and project teams retain full ownership of the original intellectual property, code, research, and
            documentation uploaded to their workspaces. GroupHub does not claim ownership over your school projects.
          </p>
          <h3 className="text-xl font-semibold mb-2">Our Platform</h3>
          <p className="text-slate-700 leading-relaxed mb-6">
            The GroupHub design layouts, branding assets, custom tracking algorithms, and frontend user interfaces are the
            exclusive property of GroupHub and are protected by copyright laws.
          </p>

          <h2 className="text-2xl font-bold mb-3">6. Limitation of Liability</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            GroupHub is provided on an "as-is" and "as-available" basis for academic administration. While we strive for 100%
            database uptime, we are not liable for any temporary service disruptions, unrecorded submission deadlines due to
            network issues, or loss of project files. Students are always highly encouraged to maintain separate secondary
            backups of their critical project source code.
          </p>

          <h2 className="text-2xl font-bold mb-3">7. Modifications to Service</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            We reserve the right to update, tweak, or temporarily modify platform features at any time to improve the onboarding
            flow, user interface, or system security patches. Continued use of the platform following any changes constitutes
            your acceptance of the updated terms.
          </p>

          <h2 className="text-2xl font-bold mb-3">8. Termination</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            We reserve the right to suspend or terminate access to your account immediately, without prior notice, if you violate
            any of these terms, breach academic integrity policies, or engage in malicious behavior on the platform.
          </p>

          <h2 className="text-2xl font-bold mb-3">9. Contact Us</h2>
          <p className="text-slate-700 leading-relaxed mb-6">
            If you have any questions regarding these Terms of Service, please reach out to our administration:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="text-[#F57D67]" size={20} />
                <h3 className="text-lg font-semibold">Email</h3>
              </div>
              <p className="text-slate-700">
                <a href="mailto:legal@grouphub.ac.ke" className="text-[#F57D67] hover:underline">
                  legal@grouphub.ac.ke
                </a>
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="text-[#F57D67]" size={20} />
                <h3 className="text-lg font-semibold">Office</h3>
              </div>
              <p className="text-slate-700">
                Technology &amp; Innovation Hub, 3rd Floor, Room 302
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer active="terms" />
    </div>

  );
};

export default TermsOfService;



