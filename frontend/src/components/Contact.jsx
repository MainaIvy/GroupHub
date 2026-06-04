import React, { useMemo, useState } from 'react';
import {
  Mail,
  MessageSquare,
  GraduationCap,
  Building2,
  Clock,
  MapPin,
  Sparkles,
  Shield,
  Users,
} from 'lucide-react';
import logo from '../assets/images/groubhub logo.svg';
import { NavLink } from 'react-router-dom';
import Footer from './common/Footer';


const Contact = () => {

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'student',
    subject: '',
    message: '',
  });

  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const roleOptions = useMemo(
    () => [
      { value: 'student', label: 'Student' },
      { value: 'lecturer', label: 'Lecturer / Supervisor' },
      { value: 'other', label: 'Other' },
    ],
    []
  );

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setStatus({ type: 'idle', message: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus({
      type: 'success',
      message: 'Message sent! Our team will get back to you shortly.',
    });

    setFormData({ fullName: '', email: '', role: 'student', subject: '', message: '' });
  };

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
              to="/login"
              className={({ isActive }) =>
                isActive
                  ? 'text-white bg-[#F57D67] px-3 py-1 rounded-md'
                  : 'hover:text-slate-300'
              }
            >
              Login
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
              <Sparkles size={16} /> Get in Touch with GroupHub
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-extrabold text-white leading-tight">
              We’re here to support your collaboration journey.
            </h1>
            <p className="mt-4 text-white/90 text-lg">
              Reach out to our team anytime!
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Area Layout Container */}
      <div className="container mx-auto px-4 py-10 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Contact channels */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">🏫 University Support & Inquiries</h2>
              <p className="text-slate-600 leading-relaxed">
                Are you a student needing help with your project workspace, or a lecturer looking to integrate
                GroupHub into your unit curriculum this semester? Find the fastest way to reach us below.
              </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3">
                  <Users className="text-[#F57D67]" size={22} />
                  <h3 className="text-xl font-semibold">👥 For Students</h3>
                </div>

                <div className="mt-4 space-y-3 text-slate-700">
                  <p className="flex items-start gap-3">
                    <Mail className="text-slate-800 mt-0.5" size={18} />
                    <span>
                      <span className="font-semibold">Support Email:</span>{' '}
                      <a href="mailto:support@grouphub.ac.ke" className="text-[#F57D67] hover:underline">
                        support@grouphub.ac.ke
                      </a>
                    </span>
                  </p>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="text-[#F57D67]" size={18} />
                      <p>
                        <span className="font-semibold">Response Time:</span> We usually respond within 24 hours
                        during working weekdays.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <p>
                      <span className="font-semibold">Tip:</span> For quicker troubleshooting, please include your
                      <span className="font-semibold"> Student ID</span> and <span className="font-semibold">Group ID</span>{' '}
                      in your email!
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3">
                  <GraduationCap className="text-[#F57D67]" size={22} />
                  <h3 className="text-xl font-semibold">🎓 For Lecturers & Faculty</h3>
                </div>

                <div className="mt-4 space-y-3 text-slate-700">
                  <p className="flex items-start gap-3">
                    <Mail className="text-slate-800 mt-0.5" size={18} />
                    <span>
                      <span className="font-semibold">Faculty Relations:</span>{' '}
                      <a href="mailto:faculty@grouphub.ac.ke" className="text-[#F57D67] hover:underline">
                        faculty@grouphub.ac.ke
                      </a>
                    </span>
                  </p>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="text-[#F57D67]" size={18} />
                      <p>
                        <span className="font-semibold">Office Hours:</span> Monday to Friday, 8:00 AM – 5:00 PM
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <p>
                      <span className="font-semibold">Request a Demo:</span> Reach out via email to schedule a quick
                      15-minute system integration walkthrough for your department.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <MapPin className="text-[#F57D67]" size={22} />
                <h3 className="text-xl font-semibold">📍 Our Office Location</h3>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="text-[#F57D67]" size={18} />
                    <p>
                      <span className="font-semibold">Campus:</span> Zetech University, Main Campus
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="text-[#F57D67]" size={18} />
                    <p>
                      <span className="font-semibold">Office:</span> Technology &amp; Innovation Hub, 3rd Floor, Room 302
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 md:col-span-2">
                  <div className="flex items-center gap-3">
                    <Clock className="text-[#F57D67]" size={18} />
                    <p>
                      <span className="font-semibold">Hours:</span> Monday – Friday: 9:00 AM – 4:00 PM (Closed on
                      weekends and public holidays)
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="text-[#F57D67]" size={22} />
                <h3 className="text-2xl font-bold">💬 Frequently Asked Questions (Quick Fixes)</h3>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <p className="font-semibold">Q: I can't see the project group my classmate created. What should I do?</p>
                  <p className="mt-2 text-slate-600">
                    A: Make sure your teammate has spelled your username correctly on the onboarding invitation, or ask them to share the unique Group Invite Link directly from their dashboard.
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <p className="font-semibold">Q: Can a lecturer see our group chat messages?</p>
                  <p className="mt-2 text-slate-600">
                    A: No. Your group workspace chats are private to your team. Lecturers can only view task assignments, milestone completion logs, and project progress metrics to evaluate grading.
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <p className="font-semibold">Q: How do I report a ghost teammate who isn't contributing?</p>
                  <p className="mt-2 text-slate-600">
                    A: GroupHub automatically logs task activity. Ensure all uncompleted tasks are formally assigned on the Task Board. The system will reflect the lack of activity on the final supervisor dashboard automatically.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Right column: Form */}
          <aside className="lg:col-span-1">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <h3 className="text-2xl font-bold">📬 Drop Us a Message</h3>
              <p className="text-slate-600 mt-2">
                Share your details and we’ll route your request to the right team.
              </p>

              {status.type !== 'idle' && (
                <div
                  className={
                    status.type === 'success'
                      ? 'mt-4 rounded-xl border border-green-200 bg-green-50 text-green-800 p-4'
                      : 'mt-4 rounded-xl border border-red-200 bg-red-50 text-red-800 p-4'
                  }
                >
                  {status.message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    value={formData.fullName}
                    onChange={(e) => setField('fullName', e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F57D67]/60"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Email Address</label>
                  <input
                    value={formData.email}
                    onChange={(e) => setField('email', e.target.value)}
                    type="email"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F57D67]/60"
                    placeholder="Use your university email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Role</label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {roleOptions.map((opt) => (
                      <label key={opt.value} className="inline-flex items-center gap-2 text-slate-700">
                        <input
                          type="radio"
                          name="role"
                          value={opt.value}
                          checked={formData.role === opt.value}
                          onChange={() => setField('role', opt.value)}
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Subject</label>
                  <input
                    value={formData.subject}
                    onChange={(e) => setField('subject', e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F57D67]/60"
                    placeholder="How can we help?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setField('message', e.target.value)}
                    required
                    rows={5}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F57D67]/60"
                    placeholder="Write your message..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center bg-[#F57D67] border-2 border-[#F57D67] text-white px-6 py-3 rounded-lg hover:bg-[#e66b5b] hover:border-[#e66b5b] text-lg font-semibold transition-all duration-200"
                >
                  Send Message
                </button>

                <p className="text-xs text-slate-500 leading-relaxed">
                  By submitting this form, you agree that GroupHub may contact you regarding your request.
                </p>
              </form>
            </section>
          </aside>
        </div>
      </div> {/* 📳 MOVED HERE: This now safely closes your content box layout */}

      {/* Footer */}
      <Footer active="contact" />

    </div>

  );
};

export default Contact;
