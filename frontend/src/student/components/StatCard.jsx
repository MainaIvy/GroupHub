import React from 'react';

const StatCard = ({ label, value, hint, icon: Icon }) => {
  const t = {
    edge: 'border-l-[#35475C]',
    icon: 'bg-[#E2E8F0] text-[#35475C]',
    value: 'text-[#1F2D33]',
  };
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border border-[#D7DEE6] border-l-4 ${t.edge} bg-white p-4`}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#4A6079] uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-[28px] font-bold leading-tight {t.value}">{value}</p>
        {hint ? <p className="mt-1 text-[12px] text-[#6B7A8C]">{hint}</p> : null}
      </div>
      {Icon ? <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.icon}`}><Icon size={18} /></span> : null}
    </div>
  );
};

export default StatCard;
