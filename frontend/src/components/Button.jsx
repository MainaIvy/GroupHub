import React from 'react';

const VARIANTS = {
  primary: 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#4A6079] px-4 text-sm font-semibold text-white hover:bg-[#35475C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7189A3] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
  secondary: 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#D7DEE6] bg-white px-4 text-sm font-semibold text-[#1F2D3D] hover:bg-[#EEF1F4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7189A3] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
  danger: 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
  ghost: 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-[#35475C] hover:bg-[#EEF1F4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7189A3] focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
};

export default function Button({
  children,
  variant = 'primary',
  disabled = false,
  onClick,
  type = 'button',
  iconLeft,
  iconRight,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {iconLeft && <span className="shrink-0">{iconLeft}</span>}
      <span className="flex items-center">{children}</span>
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}
