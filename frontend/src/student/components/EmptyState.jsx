import React from 'react';
import { btnPrimary } from '../design';

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center rounded-xl border border-dashed border-[#B8C4D2] bg-white px-6 py-10 text-center">
    {Icon ? <Icon size={32} className="mb-2 text-[#4F5F73]" aria-hidden="true" /> : null}
    <p className="text-base font-semibold text-[#1F2D3D]">{title}</p>
    {description ? <p className="mt-1 max-w-md text-sm text-[#4F5F73]">{description}</p> : null}
    {actionLabel && onAction ? <button type="button" onClick={onAction} className={`${btnPrimary} mt-4`}>{actionLabel}</button> : null}
  </div>
);

export default EmptyState;
