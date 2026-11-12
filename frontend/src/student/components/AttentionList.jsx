import React from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Mail, UserPlus, Vote } from 'lucide-react';

const dueLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const LIMIT = 4;

const Row = ({ icon, tone, title, detail, children, onClick }) => {
  const Icon = icon;
  return (
  <li className="flex flex-wrap items-center justify-between gap-2 py-2">
    <button type="button" onClick={onClick} disabled={!onClick} className="flex min-w-0 flex-1 items-start gap-2 text-left">
      <Icon size={18} aria-hidden="true" className={`mt-0.5 shrink-0 ${tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-[#35475C]'}`} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#1F2D33]">{title}</span>
        <span className="block text-sm text-[#4A6079]">{detail}</span>
      </span>
    </button>
    {children}
  </li>
  );
};

const ActionButtons = ({ busy, onDecline, onAccept, declineLabel, acceptLabel }) => (
  <div className="flex gap-2">
    <button type="button" disabled={busy} onClick={onDecline} className="h-10 rounded-lg border border-[#D7DEE6] px-4 text-sm font-semibold text-[#1F2D33] hover:bg-[#EEF1F4] disabled:opacity-60">{declineLabel}</button>
    <button type="button" disabled={busy} onClick={onAccept} className="h-10 rounded-lg bg-[#35475C] px-4 text-sm font-semibold text-white hover:bg-[#4A6079] disabled:opacity-60">{acceptLabel}</button>
  </div>
);

const AttentionList = ({ overdue, dueSoon, invites, polls, joinRequests, access, onOpenTask, onOpenPoll, firstGroupWorkload, firstTotalPoints }) => {
  const total = overdue.length + dueSoon.length + invites.length + polls.length + joinRequests.length;
  const extra = (list) => (list.length > LIMIT ? <li className="py-1 text-sm text-[#4A6079]">+{list.length - LIMIT} more</li> : null);

  const MIN_BALANCE_POINTS = 6;
  const showBalanceMessage = total === 0 && firstGroupWorkload && firstTotalPoints < MIN_BALANCE_POINTS;

  return (
    <section aria-labelledby="attention-title" className="rounded-xl border border-[#D7DEE6] bg-white p-4">
      <h2 id="attention-title" className="text-base font-bold text-[#1F2D33]">Needs your attention</h2>
      {total === 0 ? (
        showBalanceMessage ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-[#4A6079]"><CheckCircle2 size={18} aria-hidden="true" className="text-[#35475C]" /> Your group has {firstTotalPoints} of {MIN_BALANCE_POINTS} points. Add tasks to start balancing.</p>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-sm text-[#4A6079]"><CheckCircle2 size={18} aria-hidden="true" className="text-[#35475C]" /> You're all caught up.</p>
        )
      ) : (
        <ul className="mt-2 divide-y divide-[#EEF1F4]">
          {overdue.slice(0, LIMIT).map((task) => (
            <Row key={`o-${task.id}`} icon={AlertTriangle} tone="danger" title={task.title} detail={`Overdue since ${dueLabel(task.due_date)} · ${task.group_name}`} onClick={() => onOpenTask(task)} />
          ))}
          {extra(overdue)}
          {dueSoon.slice(0, LIMIT).map((task) => (
            <Row key={`d-${task.id}`} icon={CalendarClock} tone="warn" title={task.title} detail={`Due ${dueLabel(task.due_date)} · ${task.group_name}`} onClick={() => onOpenTask(task)} />
          ))}
          {extra(dueSoon)}
          {invites.map((item) => (
            <Row key={`i-${item.id}`} icon={Mail} title={item.title} detail={item.message}>
              <ActionButtons busy={access.busyId === item.id} onDecline={() => access.declineInvite(item)} onAccept={() => access.acceptInvite(item)} declineLabel="Decline" acceptLabel="Accept" />
            </Row>
          ))}
          {polls.slice(0, LIMIT).map((poll) => (
            <Row key={`p-${poll.id}`} icon={Vote} title={`Vote: ${poll.question}`} detail={`Open poll · ${poll.group_name}`} onClick={() => onOpenPoll(poll)} />
          ))}
          {extra(polls)}
          {joinRequests.map((item) => (
            <Row key={`j-${item.id}`} icon={UserPlus} title={item.title} detail={item.message}>
              <ActionButtons busy={access.busyId === item.id} onDecline={() => access.declineRequest(item)} onAccept={() => access.approveRequest(item)} declineLabel="Decline" acceptLabel="Approve" />
            </Row>
          ))}
        </ul>
      )}
      {access.error ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{access.error}</p> : null}
    </section>
  );
};

export default AttentionList;
