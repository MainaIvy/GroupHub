import React from 'react';

export const ProgressBar = ({ value = 0, label }) => (
  <div>
    <div role="progressbar" aria-label={label || 'Progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} className="h-2 overflow-hidden rounded-full bg-[#DDE4EC]">
      <div className="h-full rounded-full bg-[#4A6079]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
);

// My share of the group's points, with a marker at the fair share (100 / members).
export const ShareBar = ({ sharePercent = 0, memberCount = 1, points = 0, totalPoints = 0 }) => {
  const fair = memberCount > 0 ? 100 / memberCount : 100;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-[#DDE4EC]">
        <div className="h-full rounded-full bg-[#4A6079]" style={{ width: `${Math.max(0, Math.min(100, sharePercent))}%` }} />
        <span aria-hidden="true" className="absolute -top-1 h-4 w-0.5 rounded bg-[#1F2D3D]" style={{ left: `${fair}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#4F5F73]">{points} of {totalPoints} points ({Math.round(sharePercent)}%) · fair share {Math.round(fair)}%</p>
    </div>
  );
};

export default ProgressBar;
