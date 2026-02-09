import React, { useState, useEffect } from 'react';
import { useMatchState, VIEWS } from './hooks/useMatchState';
import { globalStyles } from './theme';
import HomeView from './views/HomeView';
import SetupView from './views/SetupView';
import ShareView from './views/ShareView';
import MatchView from './views/MatchView';
import SummaryView from './views/SummaryView';
import ViewerView from './views/ViewerView';

// App modes: HOME → SETUP → (SHARE) → MATCH → SUMMARY  |  VIEWER
const MODES = { HOME: 'home', SETUP: 'setup', SHARE: 'share', MATCH: 'match', SUMMARY: 'summary', VIEWER: 'viewer' };

function getInitialRoute() {
  const path = window.location.pathname;
  const joinMatch = path.match(/^\/join\/([A-Za-z0-9]{4})$/);
  if (joinMatch) return { mode: MODES.VIEWER, code: joinMatch[1].toUpperCase() };
  return { mode: MODES.HOME, code: null };
}

export default function App() {
  const state = useMatchState();
  const [mode, setMode] = useState(() => getInitialRoute().mode);
  const [viewerCode, setViewerCode] = useState(() => getInitialRoute().code);

  // Sync view state van useMatchState naar mode
  useEffect(() => {
    if (state.view === VIEWS.MATCH && mode === MODES.SETUP) setMode(MODES.MATCH);
    if (state.view === VIEWS.SUMMARY && mode === MODES.MATCH) setMode(MODES.SUMMARY);
  }, [state.view]);

  // Popstate handling voor /join/:code URLs
  useEffect(() => {
    const handlePop = () => {
      const route = getInitialRoute();
      if (route.mode === MODES.VIEWER) {
        setMode(MODES.VIEWER);
        setViewerCode(route.code);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const goHome = () => {
    setMode(MODES.HOME);
    setViewerCode(null);
    window.history.pushState(null, '', '/');
  };

  const handleStartOnline = () => {
    state.setIsOnline(true);
    setMode(MODES.SETUP);
  };

  const handleStartLocal = () => {
    state.setIsOnline(false);
    setMode(MODES.SETUP);
  };

  const handleJoin = (code) => {
    setViewerCode(code.toUpperCase());
    setMode(MODES.VIEWER);
    window.history.pushState(null, '', `/join/${code.toUpperCase()}`);
  };

  const handleSetupDone = async () => {
    // Start de wedstrijd (zet state.view naar MATCH)
    state.startMatch();
    if (state.isOnline) {
      // Online: eerst wedstrijd aanmaken op server, dan share scherm tonen
      const code = await state.createOnlineMatch();
      if (code) {
        setMode(MODES.SHARE);
      } else {
        // Fallback: gewoon door naar match (offline)
        setMode(MODES.MATCH);
      }
    } else {
      setMode(MODES.MATCH);
    }
  };

  const handleShareContinue = () => {
    setMode(MODES.MATCH);
  };

  const handleNewMatch = () => {
    state.setView(VIEWS.SETUP);
    setMode(MODES.HOME);
    window.history.pushState(null, '', '/');
  };

  return (
    <>
      <style>{globalStyles}</style>
      {mode === MODES.HOME && (
        <HomeView
          onStartOnline={handleStartOnline}
          onStartLocal={handleStartLocal}
          onJoin={handleJoin}
        />
      )}
      {mode === MODES.SETUP && (
        <SetupView state={state} onStartMatch={handleSetupDone} />
      )}
      {mode === MODES.SHARE && (
        <ShareView code={state.matchCode} onContinue={handleShareContinue} />
      )}
      {mode === MODES.MATCH && (
        <MatchView state={state} />
      )}
      {mode === MODES.SUMMARY && (
        <SummaryView state={state} onNewMatch={handleNewMatch} />
      )}
      {mode === MODES.VIEWER && (
        <ViewerView code={viewerCode} onBack={goHome} />
      )}
    </>
  );
}
