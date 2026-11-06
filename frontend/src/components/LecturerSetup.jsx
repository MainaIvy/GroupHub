import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });

export default function LecturerSetup() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState({ departments: [], courses: [], units: [], terms: [] });
  const [selection, setSelection] = useState({ department: '', course: '', level: '', unit: '', term: '' });
  const [added, setAdded] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/accounts/lecturer/setup/', { headers: headers() })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load the academic catalogue.')))
      .then(setCatalog)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const courses = useMemo(() => catalog.courses.filter((course) => !selection.department || course.department === selection.department), [catalog.courses, selection.department]);
  const levels = useMemo(() => [...new Set(catalog.units
    .filter((unit) => !selection.course || String(unit.course_id) === selection.course)
    .map((unit) => unit.academic_level).filter(Boolean))], [catalog.units, selection.course]);
  const terms = useMemo(() => catalog.terms.filter((term) => catalog.units.some((unit) => (
    String(unit.course_id) === selection.course
    && (!selection.level || unit.academic_level === selection.level)
    && unit.year_of_study === term.year
    && unit.semester === term.semester
  ))), [catalog, selection.course, selection.level]);
  const units = useMemo(() => catalog.units.filter((unit) => (
    (!selection.course || String(unit.course_id) === selection.course)
    && (!selection.level || unit.academic_level === selection.level)
    && (!selection.term || String(catalog.terms.find((term) => String(term.id) === selection.term)?.year) === String(unit.year_of_study)
      && String(catalog.terms.find((term) => String(term.id) === selection.term)?.semester) === String(unit.semester))
  )), [catalog, selection]);

  const addUnit = () => {
    const unit = units.find((item) => String(item.id) === selection.unit);
    const term = catalog.terms.find((item) => String(item.id) === selection.term);
    if (!unit || !term || added.some((item) => item.unit_id === unit.id && item.term_id === term.id)) return;
    setAdded((current) => [...current, {
      unit_id: unit.id, term_id: term.id, unit, term,
      course: catalog.courses.find((item) => item.id === unit.course_id),
    }]);
    setSelection((current) => ({ ...current, unit: '' }));
  };

  const save = async () => {
    setError('');
    const response = await fetch('/api/accounts/lecturer/setup/', {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: added.map(({ unit_id, term_id }) => ({ unit_id, term_id })) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Unable to save teaching units.');
      return;
    }
    navigate('/lecturer/dashboard');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#EEF3FA] text-[#0F3D6E]">Loading setup...</div>;
  return (
    <main className="min-h-screen bg-[#EEF3FA] px-4 py-10 text-[#26303B]">
      <section className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-[#0F3D6E]">Set up your teaching units</h1>
        <p className="mt-1 text-sm text-slate-500">Add every unit you teach this term, then save them together.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <select className="rounded-xl border p-3" value={selection.department} onChange={(event) => setSelection({ department: event.target.value, course: '', level: '', unit: '', term: '' })}>
            <option value="">Department</option>
            {catalog.departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
          <select className="rounded-xl border p-3" value={selection.course} onChange={(event) => setSelection({ ...selection, course: event.target.value, level: '', unit: '', term: '' })}>
            <option value="">Course / programme</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
          </select>
          <select className="rounded-xl border p-3" value={selection.level} onChange={(event) => setSelection({ ...selection, level: event.target.value, unit: '' })}>
            <option value="">Academic level</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <select className="rounded-xl border p-3" value={selection.term} onChange={(event) => setSelection({ ...selection, term: event.target.value, unit: '' })}>
            <option value="">Year & semester</option>
            {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
          </select>
          <select className="rounded-xl border p-3" value={selection.unit} onChange={(event) => setSelection({ ...selection, unit: event.target.value })}>
            <option value="">Unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
          </select>
          <button type="button" onClick={addUnit} className="rounded-xl bg-[#0F3D6E] px-4 py-3 font-semibold text-white">Add unit</button>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500"><tr><th className="p-3">Department</th><th className="p-3">Level</th><th className="p-3">Course</th><th className="p-3">Year & semester</th><th className="p-3">Unit</th><th /></tr></thead>
            <tbody>{added.map((item) => <tr key={`${item.unit_id}-${item.term_id}`} className="border-b">
              <td className="p-3">{item.course?.department}</td><td className="p-3">{item.unit.academic_level || '—'}</td><td className="p-3">{item.course?.name}</td><td className="p-3">{item.term.name}</td><td className="p-3">{item.unit.code} · {item.unit.name}</td>
              <td className="p-3"><button type="button" onClick={() => setAdded((current) => current.filter((entry) => entry !== item))} className="text-red-600">Remove</button></td>
            </tr>)}</tbody>
          </table>
          {!added.length && <p className="py-8 text-center text-sm text-slate-500">No units added yet.</p>}
        </div>
        <button type="button" disabled={!added.length} onClick={save} className="mt-6 rounded-xl bg-[#F57D67] px-5 py-3 font-semibold text-white disabled:opacity-50">Save all teaching units</button>
      </section>
    </main>
  );
}
