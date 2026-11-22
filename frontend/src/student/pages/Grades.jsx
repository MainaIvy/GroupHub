import React, { useEffect, useState } from 'react';
import { FileText, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { API } from '../utils';
import axios from '../../api';

const PANEL = 'rounded-xl border border-[#D5DDE6] bg-white shadow-sm';
const PANEL_HEAD = 'mb-3 flex items-center justify-between gap-2';
const PANEL_TITLE = 'text-base font-bold text-[#1F2D3D]';
const EMPTY_MIN_H = 'min-h-[200px]';

const Grades = ({ ctx }) => {
  const { setError } = ctx;
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorState('');
      try {
        const response = await axios.get(API.studentGrades);
        if (!cancelled) setGrades(response.data.grades || []);
      } catch (requestError) {
        if (!cancelled) {
          const msg = requestError.response?.data?.error || 'Unable to load your grades.';
          setErrorState(msg);
          if (setError) setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [setError]);

  if (loading) {
    return (
      <section className="space-y-6">
        <PageHeader title="My Grades" subtitle="Released marks and feedback across your groups." />
        <div className={`flex flex-col items-center justify-center gap-1 pt-12 text-center ${EMPTY_MIN_H}`}>
          <p className="text-sm text-[#4F5F73]">Loading grades…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="My Grades"
        subtitle="Released marks and feedback across your groups."
      />
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      {grades.length === 0 ? (
        <div className={`${PANEL} p-12`}>
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <FileText size={40} className="mx-auto text-[#B8C6D6]" aria-hidden="true" />
            <h2 className="text-base font-bold text-[#1F2D3D]">No grades released yet</h2>
            <p className="text-sm text-[#4F5F73]">
              Your lecturers have not released any marks yet. Check back here once grades are published.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {grades.map((g) => {
            const groupMark = g.group_mark != null ? String(g.group_mark) : '—';
            const finalMark = g.final_mark != null ? String(g.final_mark) : '—';
            const differs = g.final_mark != null && g.group_mark != null && Number(g.final_mark) !== Number(g.group_mark);
            const releasedDate = g.released_at ? new Date(g.released_at).toLocaleDateString(undefined, {
              day: 'numeric', month: 'short', year: 'numeric',
            }) : '—';
            return (
              <div
                key={g.id}
                className={`${PANEL} p-5 hover:shadow-sm transition-shadow`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wide text-[#35475C]">
                        {g.unit_code || 'Unit'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#1F2D3D]">{g.project_title}</h3>
                    <p className="mt-0.5 text-sm text-[#4F5F73]">
                      {g.unit_name ? `${g.unit_name}` : ''}
                      {g.group_id ? ` · Group ${g.group_id}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-[#4F5F73]">
                      Released {releasedDate}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3 lg:items-end">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F5F73]">Group mark</p>
                      <p className="text-xl font-bold text-[#1F2D3D]">{groupMark}</p>
                    </div>
                    <div className={`text-right ${differs ? 'text-amber-800' : 'text-[#35475C]'}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F5F73]">Your mark</p>
                      <p className="text-xl font-bold">{finalMark}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-[#EEF1F4] pt-4 space-y-2">
                  {g.feedback ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4F5F73]">Feedback</p>
                      <p className="text-sm text-[#33445A] whitespace-pre-wrap">{g.feedback}</p>
                    </>
                  ) : null}
                  {g.reason ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4F5F73]">Reason for difference</p>
                      <p className="text-sm text-[#33445A] whitespace-pre-wrap bg-[#FEF3C7] border border-[#FDE68A] rounded-lg p-3">
                        {g.reason}
                      </p>
                    </>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] text-[#4F5F73] bg-[#EEF1F4] rounded-lg p-3">
                  <span className="font-semibold text-[#35475C]">Note:</span> The group mark is shared by all members of your group. Your personal mark reflects your individual contribution and may differ from the group mark.
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default Grades;
