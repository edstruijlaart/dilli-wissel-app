import { useState, useEffect, useRef, useCallback } from 'react';
import { playWhistle, notifySub, notifyHalf, notifyEnd, notifyGoal } from '../utils/audio';
import { fmt } from '../utils/format';

export const VIEWS = { SETUP: "setup", MATCH: "match", SUMMARY: "summary" };

export function useMatchState() {
  const [players, setPlayers] = useState([]);
  const [keeper, setKeeper] = useState(null);
  const [newPlayer, setNewPlayer] = useState("");
  const [playersOnField, setPlayersOnField] = useState(5);
  const [halfDuration, setHalfDuration] = useState(20);
  const [halves, setHalves] = useState(2);
  const [subInterval, setSubInterval] = useState(5);
  const [view, setView] = useState(VIEWS.SETUP);
  const [onField, setOnField] = useState([]);
  const [onBench, setOnBench] = useState([]);
  const [playTime, setPlayTime] = useState({});
  const [currentHalf, setCurrentHalf] = useState(1);
  const [matchTimer, setMatchTimer] = useState(0);
  const [subTimer, setSubTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSubAlert, setShowSubAlert] = useState(false);
  const [suggestedSubs, setSuggestedSubs] = useState({ out: [], inn: [] });
  const [subHistory, setSubHistory] = useState([]);
  const [halfBreak, setHalfBreak] = useState(false);
  const [manualSubMode, setManualSubMode] = useState(null);
  const [showPaste, setShowPaste] = useState(false);
  const [clipboardNames, setClipboardNames] = useState([]);
  const [showClipBanner, setShowClipBanner] = useState(false);
  const [clipDismissed, setClipDismissed] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteResult, setPasteResult] = useState(null);
  const [matchKeeper, setMatchKeeper] = useState(null);
  const [showKeeperPicker, setShowKeeperPicker] = useState(false);
  const [homeTeam, setHomeTeam] = useState("Dilettant");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [goalScorers, setGoalScorers] = useState({}); // { "Luuk": 2, "Sem": 1 }

  // Multiplayer state
  const [matchCode, setMatchCode] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [team, setTeam] = useState("");
  const [syncError, setSyncError] = useState(null);

  const intervalRef = useRef(null);
  const alertShownRef = useRef(false);
  const syncTimeoutRef = useRef(null);
  const timerStartRef = useRef(null); // Timestamp wanneer timer start
  const totalMatchTime = halfDuration * halves;

  // --- API Sync ---
  const getMatchSnapshot = useCallback(() => ({
    status: view === VIEWS.MATCH ? (halfBreak ? 'halftime' : isRunning ? (isPaused ? 'paused' : 'live') : 'ended') : view === VIEWS.SUMMARY ? 'ended' : 'setup',
    team,
    homeTeam, awayTeam,
    players, keeper: matchKeeper,
    matchKeeper,
    playersOnField, halfDuration, halves, subInterval,
    onField, onBench,
    homeScore, awayScore,
    currentHalf,
    // Timer sync via timestamps
    timerStartedAt: (isRunning && !isPaused && !halfBreak) ? new Date(Date.now() - matchTimer * 1000).toISOString() : null,
    elapsedAtPause: matchTimer,
    subTimerStartedAt: (isRunning && !isPaused && !halfBreak) ? new Date(Date.now() - subTimer * 1000).toISOString() : null,
    subElapsedAtPause: subTimer,
    playTime,
    isRunning, isPaused, halfBreak,
  }), [view, team, homeTeam, awayTeam, players, matchKeeper, playersOnField, halfDuration, halves, subInterval, onField, onBench, homeScore, awayScore, currentHalf, matchTimer, subTimer, isRunning, isPaused, halfBreak, playTime]);

  const syncToServer = useCallback(() => {
    if (!isOnline || !matchCode) return;
    clearTimeout(syncTimeoutRef.current);
    // Debounce: wacht 300ms zodat snelle opeenvolgende updates worden gebundeld
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const snapshot = getMatchSnapshot();
        await fetch(`/api/match/${matchCode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
        });
        setSyncError(null);
      } catch (err) {
        console.error('Sync error:', err);
        setSyncError('Sync mislukt');
      }
    }, 300);
  }, [isOnline, matchCode, getMatchSnapshot]);

  const addEvent = useCallback(async (event) => {
    if (!isOnline || !matchCode) return;
    try {
      await fetch(`/api/match/events/${matchCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (err) {
      console.error('Event sync error:', err);
    }
  }, [isOnline, matchCode]);

  // Sync bij elke relevante state wijziging
  useEffect(() => {
    if (isOnline && matchCode && view !== VIEWS.SETUP) syncToServer();
  }, [onField, onBench, homeScore, awayScore, isRunning, isPaused, halfBreak, currentHalf, matchKeeper, playTime, view]);

  // --- Online wedstrijd aanmaken ---
  const createOnlineMatch = useCallback(async () => {
    try {
      const res = await fetch('/api/match/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team, homeTeam, awayTeam, players, keeper,
          playersOnField, halfDuration, halves, subInterval,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        // Team heeft al een actieve wedstrijd
        setSyncError(`${team} heeft al een actieve wedstrijd (${data.existingCode})`);
        return null;
      }

      if (!res.ok) {
        setSyncError('Wedstrijd aanmaken mislukt');
        return null;
      }

      setMatchCode(data.code);
      setIsOnline(true);
      return data.code;
    } catch (err) {
      console.error('Create match error:', err);
      setSyncError('Wedstrijd aanmaken mislukt');
      return null;
    }
  }, [team, homeTeam, awayTeam, players, keeper, playersOnField, halfDuration, halves, subInterval]);

  // --- Bestaande logica ---
  const addPlayer = () => { const n = newPlayer.trim(); if (n && !players.includes(n)) { setPlayers([...players, n]); setNewPlayer(""); } };
  const removePlayer = (name) => { setPlayers(players.filter(p => p !== name)); if (keeper === name) setKeeper(null); };
  const movePlayer = (i, d) => { const a = [...players]; const n = i + d; if (n < 0 || n >= a.length) return; [a[i], a[n]] = [a[n], a[i]]; setPlayers(a); };
  const toggleKeeper = (name) => setKeeper(keeper === name ? null : name);

  const calculateSubs = useCallback((field, bench, pt, kp) => {
    if (bench.length === 0) return { out: [], inn: [] };
    const el = field.filter(p => p !== kp);
    if (el.length === 0) return { out: [], inn: [] };
    const n = Math.min(bench.length, Math.max(1, bench.length));
    return { out: [...el].sort((a, b) => (pt[b] || 0) - (pt[a] || 0)).slice(0, n), inn: [...bench].sort((a, b) => (pt[a] || 0) - (pt[b] || 0)).slice(0, n) };
  }, []);

  const startMatch = () => {
    if (players.length <= playersOnField) return;
    const init = {}; players.forEach(p => (init[p] = 0));
    let fl, bl;
    if (keeper) { const nk = players.filter(p => p !== keeper); fl = [keeper, ...nk.slice(0, playersOnField - 1)]; bl = nk.slice(playersOnField - 1); }
    else { fl = players.slice(0, playersOnField); bl = players.slice(playersOnField); }
    setOnField(fl); setOnBench(bl); setMatchKeeper(keeper);
    setPlayTime(init); setCurrentHalf(1); setMatchTimer(0); setSubTimer(0);
    setIsRunning(false); setIsPaused(false); setShowSubAlert(false);
    setSubHistory([]); setHalfBreak(false); alertShownRef.current = false;
    setHomeScore(0); setAwayScore(0); setGoalScorers({});
    setView(VIEWS.MATCH);
  };

  const startTimer = () => {
    playWhistle();
    timerStartRef.current = Date.now() - (matchTimer * 1000); // Start vanaf huidige tijd
    setIsRunning(true);
    setIsPaused(false);
    addEvent({ type: 'match_start', time: '0:00', half: 1 });
  };

  // Timer tick - timestamp-based voor accuracy
  useEffect(() => {
    if (isRunning && !isPaused && !halfBreak) {
      // Sla huidige staat op bij pause/resume
      if (!timerStartRef.current) {
        timerStartRef.current = Date.now() - (matchTimer * 1000);
      }

      intervalRef.current = setInterval(() => {
        // Bereken tijd vanaf timestamp (beschermt tegen schermvergrendeling)
        const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
        const prevMatchTimer = matchTimer;

        setMatchTimer(elapsed);
        setSubTimer(prev => prev + (elapsed - prevMatchTimer));
        setOnField(cf => {
          setPlayTime(prev => {
            const n = { ...prev };
            cf.forEach(p => (n[p] = (n[p] || 0) + (elapsed - prevMatchTimer)));
            return n;
          });
          return cf;
        });
      }, 1000);
    } else {
      // Reset timestamp bij pauze
      timerStartRef.current = null;
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, isPaused, halfBreak, matchTimer]);

  // Periodieke sync elke 10 seconden (voor playTime updates)
  useEffect(() => {
    if (!isOnline || !matchCode || !isRunning || isPaused || halfBreak) return;
    const iv = setInterval(syncToServer, 10000);
    return () => clearInterval(iv);
  }, [isOnline, matchCode, isRunning, isPaused, halfBreak, syncToServer]);

  // Half end + sub alert detection
  useEffect(() => {
    if (!isRunning || isPaused || halfBreak) return;
    const hs = halfDuration * 60;
    const he = matchTimer - (currentHalf - 1) * hs;
    if (he >= hs) {
      clearInterval(intervalRef.current);
      if (currentHalf < halves) {
        setHalfBreak(true); setShowSubAlert(false); notifyHalf();
        addEvent({ type: 'half_end', time: fmt(matchTimer), half: currentHalf });
      } else {
        setIsRunning(false); notifyEnd(); setView(VIEWS.SUMMARY);
        addEvent({ type: 'match_end', time: fmt(matchTimer), half: currentHalf });
      }
      return;
    }
    if (subTimer >= subInterval * 60 && !alertShownRef.current && onBench.length > 0) {
      alertShownRef.current = true;
      setSuggestedSubs(calculateSubs(onField, onBench, playTime, matchKeeper));
      setShowSubAlert(true);
      notifySub();
    }
  }, [matchTimer, subTimer, isRunning, isPaused, halfBreak, currentHalf, halves, halfDuration, subInterval, onField, onBench, playTime, calculateSubs, matchKeeper]);

  const executeSubs = () => {
    const { out, inn } = suggestedSubs;
    setOnField(onField.filter(p => !out.includes(p)).concat(inn));
    setOnBench(onBench.filter(p => !inn.includes(p)).concat(out));
    setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [...out], inn: [...inn] }]);
    setShowSubAlert(false); setSubTimer(0); alertShownRef.current = false;
    addEvent({ type: 'sub_auto', time: fmt(matchTimer), half: currentHalf, out: [...out], inn: [...inn] });
  };

  const skipSubs = () => { setShowSubAlert(false); setSubTimer(0); alertShownRef.current = false; };

  const forceEndHalf = () => {
    clearInterval(intervalRef.current);
    if (currentHalf < halves) {
      setHalfBreak(true); setShowSubAlert(false); notifyHalf();
      addEvent({ type: 'half_end_manual', time: fmt(matchTimer), half: currentHalf });
    } else {
      setIsRunning(false); notifyEnd(); setView(VIEWS.SUMMARY);
      addEvent({ type: 'match_end_manual', time: fmt(matchTimer), half: currentHalf });
    }
  };

  const startNextHalf = () => {
    setCurrentHalf(p => p + 1); setHalfBreak(false); setSubTimer(0); alertShownRef.current = false;
    addEvent({ type: 'half_start', time: fmt(matchTimer), half: currentHalf + 1 });
    if (onBench.length > 0) { setSuggestedSubs(calculateSubs(onField, onBench, playTime, matchKeeper)); setShowSubAlert(true); notifySub(); }
  };

  const manualSub = (fp, bp) => {
    const wasKeeper = fp === matchKeeper;
    setOnField(onField.map(p => (p === fp ? bp : p)));
    setOnBench(onBench.map(p => (p === bp ? fp : p)));
    if (wasKeeper) setMatchKeeper(bp);
    setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [fp], inn: [bp], manual: true, keeperSwap: wasKeeper }]);
    addEvent({ type: 'sub_manual', time: fmt(matchTimer), half: currentHalf, out: [fp], inn: [bp] });
  };

  const swapKeeper = (newKeeper) => {
    const fromBench = onBench.includes(newKeeper);
    if (fromBench) {
      const oldKeeper = matchKeeper;
      setOnField(onField.map(p => (p === oldKeeper ? newKeeper : p)));
      setOnBench(onBench.map(p => (p === newKeeper ? oldKeeper : p)));
      setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [oldKeeper], inn: [newKeeper], keeperChange: true, newKeeper }]);
    } else {
      setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [], inn: [], keeperChange: true, newKeeper }]);
    }
    setMatchKeeper(newKeeper);
    setShowKeeperPicker(false);
    addEvent({ type: 'keeper_change', time: fmt(matchTimer), half: currentHalf, newKeeper });
  };

  const updateScore = (side, delta, scorer) => {
    if (side === 'home') {
      const newScore = Math.max(0, homeScore + delta);
      setHomeScore(newScore);
      if (delta > 0) {
        notifyGoal();
        if (scorer) setGoalScorers(prev => ({ ...prev, [scorer]: (prev[scorer] || 0) + 1 }));
        addEvent({ type: 'goal_home', time: fmt(matchTimer), half: currentHalf, scorer: scorer || null });
      }
    } else {
      const newScore = Math.max(0, awayScore + delta);
      setAwayScore(newScore);
      if (delta > 0) addEvent({ type: 'goal_away', time: fmt(matchTimer), half: currentHalf });
    }
  };

  // --- Reconnect: herstel state vanuit server na page refresh ---
  const reconnectToMatch = useCallback(async (code) => {
    try {
      const res = await fetch(`/api/match/${code}`);
      if (!res.ok) return false;
      const data = await res.json();

      // Herstel alle match state
      setMatchCode(code);
      setIsOnline(true);
      setTeam(data.team || '');
      setHomeTeam(data.homeTeam || 'Dilettant');
      setAwayTeam(data.awayTeam || '');
      setPlayers(data.players || []);
      setMatchKeeper(data.matchKeeper || data.keeper || null);
      setKeeper(data.matchKeeper || data.keeper || null);
      setPlayersOnField(data.playersOnField || 5);
      setHalfDuration(data.halfDuration || 20);
      setHalves(data.halves || 2);
      setSubInterval(data.subInterval || 5);
      setOnField(data.onField || []);
      setOnBench(data.onBench || []);
      setHomeScore(data.homeScore || 0);
      setAwayScore(data.awayScore || 0);
      setCurrentHalf(data.currentHalf || 1);
      setPlayTime(data.playTime || {});
      setHalfBreak(data.halfBreak || false);

      // Timer herstel
      if (data.timerStartedAt && data.isRunning && !data.isPaused && !data.halfBreak) {
        // Wedstrijd loopt: bereken verstreken tijd
        const elapsed = Math.floor((Date.now() - new Date(data.timerStartedAt).getTime()) / 1000);
        setMatchTimer(elapsed);
        const subElapsed = data.subTimerStartedAt
          ? Math.floor((Date.now() - new Date(data.subTimerStartedAt).getTime()) / 1000)
          : 0;
        setSubTimer(subElapsed);
        setIsRunning(true);
        setIsPaused(false);
      } else {
        // Gepauzeerd of gestopt
        setMatchTimer(data.elapsedAtPause || 0);
        setSubTimer(data.subElapsedAtPause || 0);
        setIsRunning(data.isRunning || false);
        setIsPaused(data.isPaused || false);
      }

      // Status → view
      if (data.status === 'ended') {
        setView(VIEWS.SUMMARY);
        setIsRunning(false);
      } else {
        setView(VIEWS.MATCH);
      }

      alertShownRef.current = false;
      return true;
    } catch (err) {
      console.error('Reconnect error:', err);
      return false;
    }
  }, []);

  return {
    // Setup state
    players, setPlayers, keeper, setKeeper, newPlayer, setNewPlayer,
    playersOnField, setPlayersOnField, halfDuration, setHalfDuration,
    halves, setHalves, subInterval, setSubInterval,
    homeTeam, setHomeTeam, awayTeam, setAwayTeam,
    team, setTeam,
    // Match state
    view, setView, onField, onBench, playTime, currentHalf,
    matchTimer, subTimer, isRunning, isPaused, setIsPaused,
    showSubAlert, suggestedSubs, subHistory, halfBreak,
    manualSubMode, setManualSubMode, matchKeeper,
    showKeeperPicker, setShowKeeperPicker,
    homeScore, setHomeScore, awayScore, setAwayScore, goalScorers, setGoalScorers,
    // Paste state
    showPaste, setShowPaste, clipboardNames, setClipboardNames,
    showClipBanner, setShowClipBanner, clipDismissed, setClipDismissed,
    pasteText, setPasteText, pasteResult, setPasteResult,
    // Multiplayer
    matchCode, setMatchCode, isOnline, setIsOnline, syncError,
    createOnlineMatch, updateScore, reconnectToMatch,
    // Computed
    totalMatchTime,
    // Actions
    addPlayer, removePlayer, movePlayer, toggleKeeper,
    startMatch, startTimer, executeSubs, skipSubs, forceEndHalf, startNextHalf,
    manualSub, swapKeeper, setIsRunning,
  };
}
