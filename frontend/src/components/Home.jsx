import React from 'react';
import heroBg from '../assets/images/students-studying-together-medium-shot.jpg';
import logo from '../assets/images/groubhub logo.svg';
import { Users, MessageCircle, Upload, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Footer from './common/Footer';


const Home = () => {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar */}
      <nav className="bg-slate-700 text-white p-2">
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
      <section className="relative h-screen flex items-center justify-center">
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        ></div>
        {/* Subtle dark overlay for better text contrast */}
        <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
        <div className="relative z-10 text-center text-white">

          <h1 className="text-5xl font-bold mb-4">Manage Group Projects, Together</h1>
          <p className="text-xl mb-8">The all-in-one platform for student teams to manage projects, track assignments, and collaborate seamlessly</p>
          <div className="space-x-4">
            <a
              href="/signup"
              className="inline-flex items-center bg-slate-700 text-white px-8 py-3 rounded-lg hover:bg-slate-600 text-lg"
            >
              Get Started Free
            </a>
            <button className="bg-[#F57D67] border-2 border-[#F57D67] text-white px-8 py-3 rounded-lg hover:bg-[#e66b5b] text-lg">Watch Demo</button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-slate-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Users size={48} />,
                title: 'Organize Projects',
                description: 'Keep all your group projects in one place'
              },
              {
                icon: <BarChart3 size={48} />,
                title: 'Track Progress',
                description: 'Monitor tasks and deadlines effortlessly'
              },
              {
                icon: <MessageCircle size={48} />,
                title: 'Collaborate Easily',
                description: 'Chat and share ideas with your team'
              },
              {
                icon: <Upload size={48} />,
                title: 'Never Miss Deadlines',
                description: 'Get reminders and stay on track'
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-md text-center">
                <div className="text-slate-700 mb-4 flex justify-center">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
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
              <div key={index} className="text-center">
                <div className="text-6xl mb-4">{step.number}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-slate-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Join 10,000+ students managing their projects better</h2>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-slate-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your group work?</h2>
          <a
            href="/signup"
            className="inline-flex items-center justify-center bg-white text-slate-700 px-8 py-3 rounded-lg hover:bg-slate-100 text-lg"
          >
            Sign Up Now
          </a>
        </div>
      </section>

      {/* Footer */}
      <Footer active="home" />
    </div>

  );
};

export default Home;

