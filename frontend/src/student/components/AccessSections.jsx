import React from 'react';
import { Mail, UserPlus } from 'lucide-react';

const Pending = ({ title, icon, items, access, accept, decline, acceptLabel, declineLabel, emptyText }) => {
  const Icon = icon;
  return (
  <section className="rounded-xl border border-[#D7DEE6] bg-white p-4">
    <h2 className="flex items-center gap-2 text-base font-bold text-[#1F2D3D]"><Icon size={18} aria-hidden="true" /> {title}{items.length ? <span className="rounded-full bg-[#E3EAF2] px-2 text-xs font-bold text-[#2F4A66]">{items.length}</span> : null}</h2>
    {items.length ? (
      <ul className="mt-2 divide-y divide-[#EEF1F4]">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1F2D3D]">{item.title}</p>
              <p className="text-sm text-[#4F5F73]">{item.message}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={access.busyId === item.id} onClick={() => decline(item)} className="h-10 rounded-lg border border-[#D7DEE6] px-4 text-sm font-semibold text-[#1F2D3D] hover:bg-[#EEF1F4] disabled:opacity-60">{declineLabel}</button>
              <button type="button" disabled={access.busyId === item.id} onClick={() => accept(item)} className="h-10 rounded-lg bg-[#35475C] px-4 text-sm font-semibold text-white hover:bg-[#435B76] disabled:opacity-60">{acceptLabel}</button>
            </div>
          </li>
        ))}
      </ul>
    ) : <p className="mt-2 text-sm text-[#4F5F73]">{emptyText}</p>}
  </section>
  );
};

// Invitations (for me) and Join requests (for groups I lead), with the actions to answer them.
const AccessSections = ({ notif, access }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    {access.error ? <p role="alert" className="col-span-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{access.error}</p> : null}
    <Pending title="Invitations" icon={Mail} items={notif.invites} access={access} accept={access.acceptInvite} decline={access.declineInvite} acceptLabel="Accept" declineLabel="Decline" emptyText="No pending invitations." />
    <Pending title="Join requests" icon={UserPlus} items={notif.joinRequests} access={access} accept={access.approveRequest} decline={access.declineRequest} acceptLabel="Approve" declineLabel="Decline" emptyText="No one is waiting for approval." />
  </div>
);

export default AccessSections;
