import React from 'react';
import logo from '../../assets/images/groubhub logo.svg';
import { FileText, Info, Mail, Phone, Shield } from 'lucide-react';

const Footer = ({ active = '' }) => {
  return (
    <footer className="bg-[#26303B] text-white py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start mb-4">
              <img src={logo} alt="Logo" className="h-20 w-auto mr-3" />
            </div>
            <p className="text-[#dfe7ef] italic">"Empowering student collaboration"</p>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <div className="flex flex-col space-y-2">
              <a
                href="/about"
                className={`flex items-center justify-center transition-colors ${active === 'about' ? 'text-white bg-white/10 px-3 py-1 rounded-md' : 'hover:text-[#f3d6c5]'}`}
              >
                <Info size={16} className="mr-2" /> About
              </a>
              <a
                href="/contact"
                className="flex items-center justify-center hover:text-[#f3d6c5] transition-colors"
              >
                <Mail size={16} className="mr-2" /> Contact
              </a>
              <a
                href="/privacy"
                className="flex items-center justify-center hover:text-[#f3d6c5] transition-colors"
              >
                <Shield size={16} className="mr-2" /> Privacy Policy
              </a>
              <a
                href="/terms"
                className="flex items-center justify-center hover:text-[#f3d6c5] transition-colors"
              >
                <FileText size={16} className="mr-2" /> Terms
              </a>
            </div>
          </div>

          <div className="text-center md:text-right">
            <h3 className="text-lg font-semibold mb-4">Get in Touch</h3>
            <div className="space-y-2">
              <p className="flex items-center justify-center md:justify-end">
                <Mail size={16} className="mr-2" /> support@grouphub.com
              </p>
              <p className="flex items-center justify-center md:justify-end">
                <Phone size={16} className="mr-2" /> +1 (555) 123-4567
              </p>
            </div>
            <p className="text-[#dfe7ef] mt-4">&copy; 2026 GroupHub. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

