import React from 'react';

const Settings = ({ ctx }) => {
  const { settingsCatalog, settingsForm, setSettingsForm, settingsLoading, settingsLoadError, setSettingsLoadKey, settingsBusy, settingsMessage, settingsError, passwordForm, setPasswordForm, passwordBusy, passwordMessage, passwordError, settingsYears, settingsSemesters, handleSettingsSubmit, handlePasswordSubmit } = ctx;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-[#D7DEE6] pb-4">
        <h2 className="text-xl font-semibold text-[#35475C]">Settings</h2>
        <p className="mt-1 text-sm text-[#4F5F73]">Update your account and academic details.</p>
      </div>

      {settingsLoading ? <p role="status" className="rounded-lg border border-[#D7DEE6] bg-white p-6 text-sm text-[#596579]">Loading account settings…</p> : null}
      {settingsLoadError && !settingsLoading ? <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700"><span>{settingsLoadError}</span><button type="button" onClick={() => setSettingsLoadKey((key) => key + 1)} className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50">Retry</button></div> : null}
      {!settingsLoading && !settingsLoadError ? <form onSubmit={handleSettingsSubmit} className="space-y-5 rounded-lg border border-[#D7DEE6] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#35475C]">Personal and academic details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-[#435B76]">
            First name
            <input required value={settingsForm.first_name} onChange={(event) => setSettingsForm((current) => ({ ...current, first_name: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
          </label>
          <label className="block text-xs font-semibold text-[#435B76]">
            Last name
            <input value={settingsForm.last_name} onChange={(event) => setSettingsForm((current) => ({ ...current, last_name: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
          </label>
          <label className="block text-xs font-semibold text-[#435B76] sm:col-span-2">
            Programme
            <select value={settingsForm.course_id} onChange={(event) => setSettingsForm((current) => ({ ...current, course_id: event.target.value, year_of_study: '', semester: '' }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]">
              <option value="">Select programme</option>
              {settingsCatalog.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[#435B76]">
            Year of study
            <select value={settingsForm.year_of_study} disabled={!settingsForm.course_id} onChange={(event) => setSettingsForm((current) => ({ ...current, year_of_study: event.target.value, semester: '' }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3] disabled:bg-[#EEF1F4]">
              <option value="">Select year</option>
              {settingsYears.map((year) => <option key={year} value={year}>Year {year}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[#435B76]">
            Semester
            <select value={settingsForm.semester} disabled={!settingsForm.year_of_study} onChange={(event) => setSettingsForm((current) => ({ ...current, semester: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3] disabled:bg-[#EEF1F4]">
              <option value="">Select semester</option>
              {settingsSemesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
            </select>
          </label>
        </div>
        {settingsError && <p role="alert" className="text-xs font-medium text-red-700">{settingsError}</p>}
        {settingsMessage && <p role="status" className="text-xs font-medium text-[#435B76]">{settingsMessage}</p>}
        <div className="flex justify-end border-t border-[#E4E9EF] pt-4">
          <button type="submit" disabled={settingsBusy} className="rounded-md bg-[#35475C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4A6079] disabled:opacity-50">{settingsBusy ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form> : null}

      {!settingsLoading && !settingsLoadError ? <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-lg border border-[#D7DEE6] bg-white p-5">
        <div>
          <h3 className="text-sm font-semibold text-[#35475C]">Change password</h3>
          <p className="mt-1 text-xs text-[#4F5F73]">Use your current password to confirm the change.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ['current_password', 'Current password'],
            ['new_password', 'New password'],
            ['confirm_password', 'Confirm new password'],
          ].map(([field, label]) => (
            <label key={field} className="block text-xs font-semibold text-[#435B76]">
              {label}
              <input type="password" required autoComplete="new-password" value={passwordForm[field]} onChange={(event) => setPasswordForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1.5 w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#29384A] outline-none focus:border-[#7189A3]" />
            </label>
          ))}
        </div>
        {passwordError && <p role="alert" className="text-xs font-medium text-red-700">{passwordError}</p>}
        {passwordMessage && <p role="status" className="text-xs font-medium text-[#435B76]">{passwordMessage}</p>}
        <div className="flex justify-end border-t border-[#E4E9EF] pt-4">
          <button type="submit" disabled={passwordBusy} className="rounded-md border border-[#CBD5E1] bg-[#EEF1F4] px-4 py-2.5 text-xs font-semibold text-[#354B63] hover:bg-[#E4E9EF] disabled:opacity-50">{passwordBusy ? 'Updating…' : 'Update password'}</button>
        </div>
      </form> : null}
    </div>
  );
};

export default Settings;
