import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });

export default function LecturerSetup() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/accounts/lecturer/setup/', { headers: headers() })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load assignments.')))
      .then((data) => {
        setAssignments(data.assignments || []);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF3FA] text-[#0F3D6E]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const approvedAssignments = assignments.filter(a => a.status === 'approved');
  const pendingAssignments = assignments.filter(a => a.status === 'pending');

  return (
    <main className="min-h-screen bg-[#EEF3FA] px-4 py-10 text-[#26303B]">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F3D6E]">Teaching Units Status</h1>
            <p className="mt-1 text-sm text-slate-500">Your units are assigned by administrators.</p>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {approvedAssignments.length === 0 && pendingAssignments.length === 0 ? (
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
        ) : (
          <>
            {approvedAssignments.length > 0 && (
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0F3D6E]">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Active Assignments ({approvedAssignments.length})
                </h3>
                <div className="mt-3 space-y-2">
                  {approvedAssignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-xl bg-green-50 p-4 border border-green-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-[#0F3D6E]">{assignment.unit_code} · {assignment.unit}</p>
                          <p className="text-sm text-slate-500 mt-1">{assignment.term}</p>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                          Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingAssignments.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0F3D6E]">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Pending Approval ({pendingAssignments.length})
                </h3>
                <div className="mt-3 space-y-2">
                  {pendingAssignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-xl bg-amber-50 p-4 border border-amber-100">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-[#0F3D6E]">{assignment.unit_code} · {assignment.unit}</p>
                          <p className="text-sm text-slate-500 mt-1">{assignment.term} · awaiting admin approval</p>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Questions about your assignments? Contact your department administrator.
          </p>
        </div>
      </section>
    </main>
  );
}