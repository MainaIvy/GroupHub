import React, { useMemo } from 'react';
import { LogOut, Settings } from 'lucide-react';
import useOutsideClick from '../hooks/useOutsideClick';

const AvatarMenu = ({ user, academic, initials, open, onToggle, onClose, onSettings }) => {
  useOutsideClick(open, onClose);
  const name = useMemo(() => {
    const first = user?.first_name;
    const last = user?.last_name;
    const derived = `${first || ''} ${last || ''}`.trim();
    if (derived) {
      return derived;
    }
    // Fallback to email prefix
    const email = user?.email || '';
    const prefix = email.split('@')[0];
    // Clean up prefix (replace dots, underscores, hyphens with spaces)
    const cleanPrefix = prefix.replace(/[._-]/g, ' ').trim();
    return cleanPrefix || 'Student';
  }, [user]);

  return (
    <div className="relative" data-popover-root>
      <button type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={onToggle} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#35475C] text-sm font-bold text-white hover:bg-[#435B76]">
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-[#D7DEE6] bg-white p-2 shadow-lg">
          <div className="border-b border-[#EEF1F4] px-2 pb-2">
            <p className="truncate text-sm font-semibold text-[#1F2D3D]">{name}</p>
            <p className="truncate text-xs text-[#4F5F73]">{academic?.course_name || user?.course || ''}</p>
            <p className="truncate text-xs text-[#4F5F73]">{user?.email || ''}</p>
          </div>
          <button type="button" role="menuitem" onClick={() => { onClose(); onSettings(); }} className="mt-1 flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#1F2D3D] hover:bg-[#EEF1F4]">
            <Settings size={16} aria-hidden="true" /> Settings
          </button>
          <button type="button" role="menuitem" onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-red-700 hover:bg-red-50">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default AvatarMenu;
