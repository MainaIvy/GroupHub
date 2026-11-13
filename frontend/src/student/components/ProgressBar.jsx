import React from 'react';

export const ProgressBar = ({ value = 0, label }) => (
  <div>
    <div role="progressbar" aria-label={label || 'Progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} className="h-2 overflow-hidden rounded-full bg-[#DDE4EC]">
      <div className="h-full rounded-full bg-[#4A6079]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
);

// My share of the group's points, with a marker at the fair share (100 / members).
export const ShareBar = ({ sharePercent = 0, memberCount = 1, points = 0, totalPoints = 0, isEarly = false }) => {
  const fair = memberCount > 0 ? 100 / memberCount : 100;
  const segments = Array.from({ length: Math.max(memberCount, 1) }, (_, i) => ({
    start: i * fair,
    end: (i + 1) * fair,
  }));

  return (
    <div className={isEarly ? 'opacity-60' : ''}>
      <div className="relative h-3 overflow-hidden rounded-full bg-[#E5E7EB]" style={{ minHeight: '12px' }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{
              left: `${seg.start}%`,
              width: `${seg.end - seg.start}%`,
              backgroundColor: i % 2 === 0 ? '#DDE4EC' : '#E5E7EB',
            }}
          />
        ))}
        {sharePercent > 0 && (
          <div
            className="absolute top-0 h-full rounded-full bg-[#4A6079]"
            style={{ width: `${Math.max(0, Math.min(100, sharePercent))}%`, zIndex: 2 }}
          />
        )}
        <span aria-hidden="true" className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-[#1F2D3D]" style={{ left: `${fair}%`, zIndex: 3 }} />
      </div>
      <p className="mt-1 text-xs text-[#4F5F73]">
        {isEarly
          ? `${Math.max(0, totalPoints || 0)} of 6 points to start balancing`
          : `${points} of ${totalPoints} points (${Math.round(sharePercent)}%) · fair share ${Math.round(fair)}%`}
      </p>
    </div>
  );
};

export default ProgressBar;
