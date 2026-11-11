import React from 'react';
import { STATUS } from '../design';

const HealthBadge = ({ status = 'too_early', reason }) => {
  const config = STATUS[status] || STATUS.too_early;
  const Icon = config.icon;
  return (
    <span title={reason || config.label} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${config.classes}`}>
      <Icon size={14} aria-hidden="true" />
      {config.label}
    </span>
  );
};

export default HealthBadge;
