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
  // Create segments for each member (fair share segments)
  const segments = Array.from({ length: memberCount }, (_, i) => ({
    start: i * fair,
    end: (i + 1) * fair,
  }));

  return (
    <div>
      <div className="relative h-3 rounded-full bg-[#E5E7EB]" style={{ minHeight: '12px' }}>
        {/* Fair share segments - alternating subtle colors */}
        {segments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-0 h-full rounded-full"
            style={{
              left: `${seg.start}%`,
              width: `${seg.end - seg.start}%`,
              backgroundColor: i % 2 === 0 ? '#DDE4EC' : '#E5E7EB',
              opacity: isEarly ? 0.6 : 1,
            }}
          />
        ))}
        {/* User's actual share */}
        {sharePercent > 0 && (
          <div
            className="absolute top-0 h-full rounded-full bg-[#4A6079]"
            style={{ width: `${Math.max(0, Math.min(100, sharePercent))}%`, zIndex: 2 }}
          />
        )}
        {/* Fair share marker */}
        <span aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 h-6 w-0.5 rounded bg-[#1F2D3D]" style={{ left: `${fair}%`, zIndex: 3 }} />
      </div>
      <p className="mt-1 text-xs text-[#4F5F73]">
        {points} of {totalPoints} points ({Math.round(sharePercent)}%) 
        {isEarly ? (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Early &mdash; balancing starts at {totalPoints >= 6 ? '6' : '6'} points
          </span>
        ) : (
          <span> \u00B7 fair share {Math.round(fair)}%</span>
        )}
      </p>
    </div>
  );
};

export default ProgressBar;
