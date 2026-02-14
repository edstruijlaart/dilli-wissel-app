import React, { useState, useEffect, useRef } from 'react';
import { useMatchState, VIEWS } from './hooks/useMatchState';
import { globalStyles } from './theme';
import HomeView from './views/HomeView';
import SetupView from './views/SetupView';
import ShareView from './views/ShareView';
import MatchView from './views/MatchView';
import SummaryView from './views/SummaryView';
import ViewerView from './views/ViewerView';
import AdminView from './views/AdminView';

// App modes: HOME → SETUP → (SHARE) → MATCH → SUMMARY  |  VIEWER | ADMIN
const MODES = { HOME: 'home', SETUP: 'setup', SHARE: 'share', MATCH: 'match', SUMMARY: 'summary', VIEWER: 'viewer', ADMIN: 'admin' };

const SESSION_KEY = 'dilli_active_match';

function saveSession(matchCode, mode) {
  if (matchCode && (mode === MODES.MATCH || mode === MODES.SHARE || mode === MODES.SUMMARY)) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ matchCode, mode }));
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function getInitialRoute() {
  const path = window.location.pathname;
  if (path === '/admin') return { mode: MODES.ADMIN, code: null };
  const joinMatch = path.match(/^\/join\/([A-Za-z0-9]{4})$/);
  if (joinMatch) return { mode: MODES.VIEWER, code: joinMatch[1].toUpperCase() };
  return { mode: MODES.HOME, code: null };
}

export default function App() {
  const state = useMatchState();
  const [mode, setMode] = useState(() => getInitialRoute().mode);
  const [viewerCode, setViewerCode] = useState(() => getInitialRoute().code);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectAttempted = useRef(false);

  // Reconnect bij page refresh: check sessionStorage
  useEffect(() => {
    if (reconnectAttempted.current) return;
    reconnectAttempted.current = true;
    // Skip als we in viewer of admin mode zitten
    const initMode = getInitialRoute().mode;
    if (initMode === MODES.VIEWER || initMode === MODES.ADMIN) return;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) return;
      const { matchCode } = JSON.parse(saved);
      if (!matchCode) return;
      setReconnecting(true);
      state.reconnectToMatch(matchCode).then((ok) => {
        if (ok) {
          // reconnectToMatch zet view, daaruit leiden we mode af
          // Mode wordt via de useEffect hieronder gesynchroniseerd
        } else {
          clearSession();
        }
        setReconnecting(false);
      });
    } catch { clearSession(); setReconnecting(false); }
  }, []);

  // Sync view state van useMatchState naar mode
  useEffect(() => {
    if (state.view === VIEWS.MATCH && (mode === MODES.SETUP || mode === MODES.HOME)) {
      setMode(MODES.MATCH);
      saveSession(state.matchCode, MODES.MATCH);
    }
    if (state.view === VIEWS.SUMMARY && (mode === MODES.MATCH || mode === MODES.HOME)) {
      setMode(MODES.SUMMARY);
      saveSession(state.matchCode, MODES.SUMMARY);
    }
  }, [state.view, state.matchCode]);

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
    clearSession();
    window.history.pushState(null, '', '/');
  };

  const handleStartOnline = (teamData) => {
    state.setIsOnline(true);
    if (teamData?.team) state.setTeam(teamData.team);
    if (teamData?.players?.length) state.setPlayers(teamData.players);
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

  const handleJoinAsCoach = async (code) => {
    const success = await state.reconnectToMatch(code.toUpperCase());
    if (success) {
      setMode(MODES.MATCH);
      saveSession(code.toUpperCase(), MODES.MATCH);
    }
    return success;
  };

  const handleSetupDone = async () => {
    // Start de wedstrijd (zet state.view naar MATCH)
    state.startMatch();
    if (state.isOnline) {
      // Online: eerst wedstrijd aanmaken op server, dan share scherm tonen
      const code = await state.createOnlineMatch();
      if (code) {
        setMode(MODES.SHARE);
        saveSession(code, MODES.SHARE);
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
    saveSession(state.matchCode, MODES.MATCH);
  };

  const handleNewMatch = () => {
    state.setView(VIEWS.SETUP);
    state.setGoalScorers({});
    state.setHomeScore(0);
    state.setAwayScore(0);
    setMode(MODES.HOME);
    clearSession();
    window.history.pushState(null, '', '/');
  };

  if (reconnecting) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{ fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F5F5F7" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚽</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#6B7280" }}>Wedstrijd herstellen...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      {mode === MODES.HOME && (
        <HomeView
          onStartOnline={handleStartOnline}
          onStartLocal={handleStartLocal}
          onJoin={handleJoin}
          onJoinAsCoach={handleJoinAsCoach}
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
      {mode === MODES.ADMIN && (
        <AdminView onBack={goHome} />
      )}
    </>
  );
}
