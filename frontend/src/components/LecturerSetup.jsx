import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function LecturerSetup() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#EEF3FA] px-4 py-10 text-[#26303B]">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F3D6E]">Teaching Units Status</h1>
            <p className="mt-1 text-sm text-slate-500">Your units are assigned by administrators.</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-8 text-center border border-slate-200">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-lg font-semibold text-[#0F3D6E]">No units assigned yet</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Your administrator will assign teaching units through the roster import. 
            Once assigned, they will appear here automatically.
          </p>
          <div className="mt-6 rounded-lg bg-violet-50 p-4 text-left border border-violet-200">
            <p className="text-sm font-medium text-violet-800">What happens next:</p>
            <ul className="mt-2 space-y-1 text-sm text-violet-700">
              <li>• Admin imports lecturer roster with unit assignments</li>
              <li>• You receive an email to activate your account</li>
              <li>• Units appear here once approved for the current term</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Questions about your assignments? Contact your department administrator.
          </p>
        </div>
      </section>
    </main>
  );
}