import { AlertTriangle, CheckCircle2, Hourglass, Moon } from 'lucide-react';

// Design tokens for the student area. CSS variables live in design.css.
export const tokens = {
  fontBody: 15,
  fontLabel: 13,
  radius: 12,
  space: 8,
  brand: '#35475C',
  brandHover: '#435B76',
  accent: '#4A6079',
  page: '#E2E8F0',
  border: '#D7DEE6',
  ink: '#1F2D3D',
  text: '#33445A',
  muted: '#4F5F73',
};

export const card = 'rounded-xl border border-[#D7DEE6] bg-white';
export const cardPad = `${card} p-4`;
export const btnPrimary = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#35475C] px-4 text-sm font-semibold text-white hover:bg-[#435B76] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6079] focus-visible:ring-offset-2 disabled:opacity-60';
export const btnSecondary = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-4 text-sm font-semibold text-[#1F2D3D] hover:bg-[#EEF1F4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6079] focus-visible:ring-offset-2 disabled:opacity-60';
export const btnDanger = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60';

// Amber and red are reserved for status; brand colour is for navigation and buttons.
export const STATUS = {
  on_track: { label: 'On track', icon: CheckCircle2, classes: 'bg-[#E3EAF2] text-[#2F4A66] border-[#C3D0DF]' },
  quiet: { label: 'Quiet', icon: Moon, classes: 'bg-amber-50 text-amber-800 border-amber-300' },
  at_risk: { label: 'At risk', icon: AlertTriangle, classes: 'bg-red-50 text-red-700 border-red-300' },
  too_early: { label: 'Too early', icon: Hourglass, classes: 'bg-[#EEF1F4] text-[#4F5F73] border-[#D7DEE6]' },
};
