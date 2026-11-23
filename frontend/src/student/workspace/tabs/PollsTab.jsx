import React from 'react';
import PollPanel from '../../../components/PollPanel';

const PollsTab = ({ groupId, readOnly }) => <PollPanel groupId={groupId} defaultOpen readOnly={readOnly} />;

export default PollsTab;
