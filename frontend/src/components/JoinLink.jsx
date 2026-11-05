import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Keeps the code across login; the student dashboard picks it up and opens the join screen.
const JoinLink = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const cleaned = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (cleaned) localStorage.setItem('pending_join_code', cleaned);
    navigate('/student-dashboard', { replace: true });
  }, [code, navigate]);

  return null;
};

export default JoinLink;
