import React from 'react';
import heroBg from '../assets/images/students-studying-together-medium-shot.jpg';
import logo from '../assets/images/groubhub logo.svg';
import { Users, MessageCircle, Upload, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Footer from './common/Footer';

const Home = () => {
  return (
    <div className="min-h-screen bg-[#EBEBDD] text-[#26303B] flex flex-col">
      <nav className="sticky top-0 z-50 bg-[#26303B] border-b border-[#1d2630]/80 m-0 p-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="GroupHub Logo"
              className="h-12 sm:h-14 w-auto transition-transform duration-200 hover:scale-105"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? 'px-3.5 py-2 rounded-xl text-sm sm:text-base font-semibold text-white bg-[#344153]'
                  : 'px-3.5 py-2 rounded-xl text-sm sm:text-base font-medium text-[#e2e8f0] hover:text-white hover:bg-[#344153] transition-colors duration-200'
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive
                  ? 'px-3.5 py-2 rounded-xl text-sm sm:text-base font-semibold text-white bg-[#344153]'
                  : 'px-3.5 py-2 rounded-xl text-sm sm:text-base font-medium text-[#e2e8f0] hover:text-white hover:bg-[#344153] transition-colors duration-200'
              }
            >
              Login
            </NavLink>

            <NavLink
              to="/signup"
              className="px-5 py-2.5 rounded-xl text-sm sm:text-base font-semibold text-white bg-[#1F4E79] hover:bg-[#173d5d] transition-colors duration-200 shadow-none"
            >
              Sign Up
            </NavLink>
          </div>
        </div>
      </nav>

      <section className="relative min-h-[calc(100vh-73px)] flex items-center justify-center m-0 p-0 overflow-hidden">
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        ></div>

        <div className="absolute inset-0 bg-slate-950/35" aria-hidden="true" />

        <div className="relative z-10 w-full py-16">
          <div className="mx-auto max-w-3xl px-4 text-center text-white">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Built for Student Teams
            </h1>

            <p className="mt-4 sm:mt-5 text-base sm:text-lg md:text-xl text-slate-200 leading-relaxed max-w-2xl mx-auto">
              From group assignments to final submission—manage projects, track progress, and collaborate effortlessly.
            </p>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center">
              <a
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-[#1F4E79] text-white px-8 py-3.5 rounded-xl text-base sm:text-lg font-semibold hover:bg-[#173d5d] transition-colors duration-200 shadow-none"
              >
                Get Started Free
              </a>

              <button
                type="button"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-white border border-[#e5e7eb] text-[#26303B] px-8 py-3.5 rounded-xl text-base sm:text-lg font-semibold hover:bg-[#f3f4f6] transition-colors duration-200 shadow-sm"
              >
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFAFA]">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-[#0f172a] mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Users size={40} className="text-[#9A694E]" />,
                title: 'Organize Projects',
                description: 'Keep all your group projects in one place'
              },
              {
                icon: <BarChart3 size={40} className="text-[#2C5D7C]" />,
                title: 'Track Progress',
                description: 'Monitor tasks and deadlines effortlessly'
              },
              {
                icon: <MessageCircle size={40} className="text-[#4A7C59]" />,
                title: 'Collaborate Easily',
                description: 'Chat and share ideas with your team'
              },
              {
                icon: <Upload size={40} className="text-[#7B5E3A]" />,
                title: 'Never Miss Deadlines',
                description: 'Get reminders and stay on track'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white p-7 rounded-2xl border border-[#e5e7eb] shadow-sm text-center">
                <div className="mb-4 flex justify-center">{feature.icon}</div>
                <h3 className="text-xl font-bold text-[#0f172a] mb-2">{feature.title}</h3>
                <p className="text-[#64748b] text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#F5F5F5] border-y border-[#e5e7eb]">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-[#0f172a] mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                number: '1️⃣',
                title: 'Create or join a group',
                description: 'Start collaborating with your classmates'
              },
              {
                number: '2️⃣',
                title: 'Add your projects and tasks',
                description: 'Organize everything in one place'
              },
              {
                number: '3️⃣',
                title: 'Collaborate and track progress',
                description: 'Work together and stay on top of deadlines'
              }
            ].map((step, index) => (
              <div key={index} className="text-center p-4">
                <div className="text-5xl mb-4">{step.number}</div>
                <h3 className="text-xl font-bold text-[#0f172a] mb-2">{step.title}</h3>
                <p className="text-[#64748b] text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#EBEBDD]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a] mb-4">
            Join 10,000+ students managing their projects better
          </h2>
        </div>
      </section>

      <section className="py-20 bg-[#26303B] text-white border-b border-[#1d2630]/80">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Ready to streamline your group work?
          </h2>
          <p className="text-[#dfe7ef] mb-8 text-base sm:text-lg">
            Say goodbye to disorganized WhatsApp threads and lost files.
          </p>
          <a
            href="/signup"
            className="inline-flex items-center justify-center bg-[#1F4E79] text-white px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-[#173d5d] transition-colors duration-200 shadow-none"
          >
            Sign Up Now
          </a>
        </div>
      </section>

      <Footer active="home" />
    </div>
  );
};

export default Home;