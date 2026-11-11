import React from 'react';

const TONES = {
  default: { edge: 'border-l-[#4A6079]', icon: 'bg-[#E3EAF2] text-[#2F4A66]', value: 'text-[#1F2D3D]' },
  success: { edge: 'border-l-emerald-600', icon: 'bg-emerald-50 text-emerald-700', value: 'text-[#1F2D3D]' },
  warning: { edge: 'border-l-amber-500', icon: 'bg-amber-50 text-amber-700', value: 'text-[#1F2D3D]' },
  danger: { edge: 'border-l-red-600', icon: 'bg-red-50 text-red-700', value: 'text-red-700' },
};

const StatCard = ({ label, value, hint, icon: Icon, tone = 'default' }) => {
  const t = TONES[tone] || TONES.default;
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border border-l-4 border-[#D7DEE6] ${t.edge} bg-white p-4`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#4F5F73]">{label}</p>
        <p className={`mt-1 text-[32px] font-bold leading-tight ${t.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-[13px] text-[#4F5F73]">{hint}</p> : null}
      </div>
      {Icon ? <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.icon}`}><Icon size={20} /></span> : null}
    </div>
  );
};

export default StatCard;
