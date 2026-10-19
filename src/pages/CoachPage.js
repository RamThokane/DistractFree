import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import AgentChat from '../components/AgentChat';

/**
 * Focus coach — chat with the AI assistant. Other pages can hand over a
 * question with navigate('/dashboard/coach', { state: { ask } }).
 */
const CoachPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Keep the handed-over question, then clear it from history so a reload doesn't ask again
  const [question] = useState(() => location.state?.ask || null);

  useEffect(() => {
    if (location.state?.ask) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  return (
    <PageTransition>
      <div className="pg-head">
        <div>
          <p className="pg-kicker">AI assistant</p>
          <h2 className="pg-title">Focus <em>coach</em></h2>
          <p className="pg-sub">
            Ask about your focus, plan sessions, or tidy up your blocked sites. Nothing changes until you confirm it.
          </p>
        </div>
      </div>
      <AgentChat initialQuestion={question} />
    </PageTransition>
  );
};

export default CoachPage;
