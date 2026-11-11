import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { btnSecondary } from '../design';

const ErrorState = ({ message = 'Something went wrong.', onRetry }) => (
  <div role="alert" className="flex flex-col items-center rounded-xl border border-red-200 bg-white px-6 py-8 text-center">
    <AlertTriangle size={28} className="mb-2 text-red-600" aria-hidden="true" />
    <p className="text-sm font-semibold text-red-700">{message}</p>
    {onRetry ? <button type="button" onClick={onRetry} className={`${btnSecondary} mt-4`}>Try again</button> : null}
  </div>
);

export default ErrorState;
