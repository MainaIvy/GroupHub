import React from 'react';
import { Plus } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../design';

// Shown only in the Overview and Groups headers.
const GroupActions = ({ onJoin, onCreate }) => (
  <>
    <button type="button" onClick={() => onJoin()} className={btnSecondary}>Join with code</button>
    <button type="button" onClick={() => onCreate()} className={btnPrimary}><Plus size={16} aria-hidden="true" /> Create group</button>
  </>
);

export default GroupActions;
