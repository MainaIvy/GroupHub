import React from 'react';

const Avatar = ({ name = '', size = 32, className = '' }) => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  return (
    <span title={name} style={{ width: size, height: size, minWidth: size, flexShrink: 0 }} className={`inline-flex items-center justify-center rounded-full bg-[#E3EAF2] text-xs font-bold text-[#2F4A66] ring-2 ring-white ${className}`}>
      {initials}
    </span>
  );
};

export default Avatar;
