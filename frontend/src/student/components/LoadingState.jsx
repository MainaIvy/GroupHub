import React from 'react';

const LoadingState = ({ label = 'Loading…', rows = 0 }) => (
  <div role="status" aria-live="polite" className="rounded-xl border border-[#D7DEE6] bg-white p-6 text-center">
    <div aria-hidden="true" className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#D7DEE6] border-t-[#4A6079]" />
    <p className="mt-2 text-sm text-[#4F5F73]">{label}</p>
    {rows ? <div aria-hidden="true" className="mt-4 space-y-2">{Array.from({ length: rows }).map((_, index) => <div key={index} className="h-4 animate-pulse rounded bg-[#E2E8F0]" />)}</div> : null}
  </div>
);

export default LoadingState;
