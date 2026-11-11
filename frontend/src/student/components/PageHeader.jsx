import React from 'react';

const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#D7DEE6] pb-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-bold text-[#1F2D3D]">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-[#4F5F73]">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default PageHeader;
