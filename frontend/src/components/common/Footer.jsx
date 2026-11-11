import React from 'react';
import logo from '../../assets/images/groubhub logo.svg';
import { FileText, Info, Mail, Phone, Shield } from 'lucide-react';

const Footer = ({ active = '' }) => {
  const linkClass = (section) => `inline-flex items-center gap-2 rounded-md py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
    active === section ? 'text-white' : 'text-[#dfe7ef] hover:text-[#f3d6c5]'
  }`;

  return (
    <footer className="bg-[#26303B] text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-7 px-6 py-8 sm:px-8 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <a href="/" aria-label="GroupHub home" className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <img src={logo} alt="GroupHub" className="h-12 w-auto" />
          </a>
          <p className="mt-2 text-xs text-[#dfe7ef]">
            Empowering student collaboration · &copy; 2026 GroupHub
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 md:col-span-2 lg:col-span-1">
          <a href="/about" className={linkClass('about')} aria-current={active === 'about' ? 'page' : undefined}>
            <Info size={15} aria-hidden="true" /> About
          </a>
          <a href="/contact" className={linkClass('contact')} aria-current={active === 'contact' ? 'page' : undefined}>
            <Mail size={15} aria-hidden="true" /> Contact
          </a>
          <a href="/privacy" className={linkClass('privacy')} aria-current={active === 'privacy' ? 'page' : undefined}>
            <Shield size={15} aria-hidden="true" /> Privacy
          </a>
          <a href="/terms" className={linkClass('terms')} aria-current={active === 'terms' ? 'page' : undefined}>
            <FileText size={15} aria-hidden="true" /> Terms
          </a>
        </nav>

        <div className="flex flex-col items-center gap-2 text-sm md:col-span-2 md:flex-row md:justify-center lg:col-span-1 lg:flex-col lg:items-end lg:gap-1">
          <a href="mailto:support@grouphub.com" className="inline-flex items-center gap-2 text-[#dfe7ef] transition-colors hover:text-[#f3d6c5]">
            <Mail size={15} aria-hidden="true" /> support@grouphub.com
          </a>
          <a href="tel:+15551234567" className="inline-flex items-center gap-2 text-[#dfe7ef] transition-colors hover:text-[#f3d6c5]">
            <Phone size={15} aria-hidden="true" /> 0700000000
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
