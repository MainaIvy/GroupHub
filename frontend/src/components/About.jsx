import React from 'react';
import { CheckCircle2, GraduationCap, BarChart3, MessageCircle, Shield, Sparkles } from 'lucide-react';
import logo from '../assets/images/groubhub logo.svg';
import { NavLink } from 'react-router-dom';
import Footer from './common/Footer';


const About = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navbar */}
      <nav className="bg-slate-700 text-white p-2 sticky top-0 z-10">
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
              to="/login"
              className={({ isActive }) =>
                isActive
                  ? 'text-white bg-[#F57D67] px-4 py-2 rounded-md'
                  : 'hover:text-slate-300 px-4 py-2 rounded-md'
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-800 to-[#F57D67] opacity-95" />
        <div className="relative container mx-auto px-4 py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white border border-white/15">
              <Sparkles size={16} /> About GroupHub
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-extrabold text-white leading-tight">
              Where Academic Collaboration Meets Efficiency
            </h1>
            <p className="mt-4 text-white/90 text-lg">
              GroupHub centralizes your entire group project lifecycle—tasks, communication, and progress—so
              students and lecturers can collaborate with clarity.
            </p>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl font-bold mb-4">🚀 Our Vision</h2>
              <p className="text-slate-600 leading-relaxed">
                Group work shouldn’t feel chaotic. Every semester, students deal with recurring headaches—ghost
                teammates, scattered files across messaging apps, missed deadlines, and uncoordinated task delegation.
                Meanwhile, lecturers and project supervisors are left in the dark, forced to grade a group collectively
                without visibility into who actually did the work.
              </p>
              <p className="text-slate-600 leading-relaxed mt-4">
                GroupHub is the ultimate bridge between students and educators. We centralize the entire project
                lifecycle into one intuitive workspace, transforming chaotic school assignments into streamlined,
                accountable, high-performing milestones.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <Shield className="text-[#F57D67]" size={22} />
                <h3 className="text-xl font-semibold">What you get</h3>
              </div>
              <ul className="mt-4 space-y-3 text-slate-700">
                {[
                  'Transparent accountability for every task',
                  'Communication right inside the project dashboard',
                  'Lecturer oversight with progress visibility',
                  'Clear timelines to keep teams aligned',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <CheckCircle2 className="text-green-600 mt-0.5" size={18} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-10 bg-slate-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8">🛠️ The Core Challenges We Solve</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="text-slate-800" size={22} />
                <h3 className="text-lg font-semibold">The Accountability Gap</h3>
              </div>
              <p className="mt-3 text-slate-600">One or two students often do most of the work while others coast.</p>
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
                <p className="font-medium">GroupHub Solution</p>
                <p className="text-sm mt-1">
                  Each task is assigned to a user with a transparent history log—updates are recorded and visible.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <MessageCircle className="text-slate-800" size={22} />
                <h3 className="text-lg font-semibold">Communication Fragmentation</h3>
              </div>
              <p className="mt-3 text-slate-600">Critical updates get lost across WhatsApp, Telegram, Discord, and email.</p>
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
                <p className="font-medium">GroupHub Solution</p>
                <p className="text-sm mt-1">
                  Bring discussions into the project dashboard so communication stays contextual.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <GraduationCap className="text-slate-800" size={22} />
                <h3 className="text-lg font-semibold">Supervisor Oversight</h3>
              </div>
              <p className="mt-3 text-slate-600">Lecturers see results only at presentation week, too late to help.</p>
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
                <p className="font-medium">GroupHub Solution</p>
                <p className="text-sm mt-1">
                  A dedicated Lecturer Portal provides progress metrics and access to project logs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform features cards */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10">✨ Key Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Smart Onboarding',
                desc: 'Set up your team quickly with profiles and goals.',
              },
              {
                title: 'Interactive Task Boards',
                desc: 'Assign responsibilities, deadlines, and requirements.',
              },
              {
                title: 'Live Dashboards',
                desc: 'Track real-time progress with unified timelines.',
              },
              {
                title: 'Objective Evaluation Metrics',
                desc: 'Grade based on true participation and history logs.',
              },
            ].map((card) => (
              <div key={card.title} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="mt-3 text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for modern classroom */}
      <section className="py-12 bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold">🎓 Built for the Modern Classroom</h2>
              <p className="mt-4 text-white/90 leading-relaxed">
                Whether you’re a student keeping your graduation project on track or a lecturer managing
                dozens of senior design teams, GroupHub provides the structure, clarity, and data needed to succeed.
              </p>
              <p className="mt-4 text-white/90 leading-relaxed">
                No more ghosting. No more guesswork. Just better collaboration.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-semibold">Ready to get started?</h3>
              <p className="mt-2 text-white/90">Create your account in seconds and begin collaborating.</p>
              <div className="mt-6 flex gap-3 flex-wrap">
                <a
                  href="/signup"
                  className="inline-flex items-center justify-center bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-slate-100"
                >
                  Sign Up
                </a>
                <a
                  href="/login"
                  className="inline-flex items-center justify-center bg-transparent text-white px-6 py-3 rounded-lg border border-white/30 hover:bg-white/10 font-semibold"
                >
                  Login
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer active="about" />
    </div>

  );
};

export default About;



