import React from 'react';
import { useMatchState, VIEWS } from './hooks/useMatchState';
import { globalStyles } from './theme';
import SetupView from './views/SetupView';
import MatchView from './views/MatchView';
import SummaryView from './views/SummaryView';

export default function App() {
  const state = useMatchState();

  return (
    <>
      <style>{globalStyles}</style>
      {state.view === VIEWS.SETUP && <SetupView state={state} />}
      {state.view === VIEWS.MATCH && <MatchView state={state} />}
      {state.view === VIEWS.SUMMARY && <SummaryView state={state} />}
    </>
  );
}
