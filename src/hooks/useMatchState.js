import { useState, useEffect, useRef, useCallback } from 'react';
import { playWhistle, notifySub, notifyHalf, notifyEnd } from '../utils/audio';
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

  const intervalRef = useRef(null);
  const alertShownRef = useRef(false);
  const totalMatchTime = halfDuration * halves;

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
    playWhistle();
    const init = {}; players.forEach(p => (init[p] = 0));
    let fl, bl;
    if (keeper) { const nk = players.filter(p => p !== keeper); fl = [keeper, ...nk.slice(0, playersOnField - 1)]; bl = nk.slice(playersOnField - 1); }
    else { fl = players.slice(0, playersOnField); bl = players.slice(playersOnField); }
    setOnField(fl); setOnBench(bl); setMatchKeeper(keeper);
    setPlayTime(init); setCurrentHalf(1); setMatchTimer(0); setSubTimer(0);
    setIsRunning(true); setIsPaused(false); setShowSubAlert(false);
    setSubHistory([]); setHalfBreak(false); alertShownRef.current = false;
    setHomeScore(0); setAwayScore(0);
    setView(VIEWS.MATCH);
  };

  // Timer tick
  useEffect(() => {
    if (isRunning && !isPaused && !halfBreak) {
      intervalRef.current = setInterval(() => {
        setMatchTimer(p => p + 1);
        setSubTimer(p => p + 1);
        setOnField(cf => { setPlayTime(prev => { const n = { ...prev }; cf.forEach(p => (n[p] = (n[p] || 0) + 1)); return n; }); return cf; });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, isPaused, halfBreak]);

  // Half end + sub alert detection
  useEffect(() => {
    if (!isRunning || isPaused || halfBreak) return;
    const hs = halfDuration * 60;
    const he = matchTimer - (currentHalf - 1) * hs;
    if (he >= hs) {
      clearInterval(intervalRef.current);
      if (currentHalf < halves) { setHalfBreak(true); setShowSubAlert(false); notifyHalf(); }
      else { setIsRunning(false); notifyEnd(); setView(VIEWS.SUMMARY); }
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
  };

  const skipSubs = () => { setShowSubAlert(false); setSubTimer(0); alertShownRef.current = false; };

  const startNextHalf = () => {
    setCurrentHalf(p => p + 1); setHalfBreak(false); setSubTimer(0); alertShownRef.current = false;
    if (onBench.length > 0) { setSuggestedSubs(calculateSubs(onField, onBench, playTime, matchKeeper)); setShowSubAlert(true); notifySub(); }
  };

  const manualSub = (fp, bp) => {
    const wasKeeper = fp === matchKeeper;
    setOnField(onField.map(p => (p === fp ? bp : p)));
    setOnBench(onBench.map(p => (p === bp ? fp : p)));
    if (wasKeeper) setMatchKeeper(bp);
    setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [fp], inn: [bp], manual: true, keeperSwap: wasKeeper }]);
  };

  const swapKeeper = (newKeeper) => {
    const fromBench = onBench.includes(newKeeper);
    if (fromBench) {
      // Bankspeler wordt keeper: oude keeper gaat naar bank
      const oldKeeper = matchKeeper;
      setOnField(onField.map(p => (p === oldKeeper ? newKeeper : p)));
      setOnBench(onBench.map(p => (p === newKeeper ? oldKeeper : p)));
      setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [oldKeeper], inn: [newKeeper], keeperChange: true, newKeeper }]);
    } else {
      // Veldspeler wordt keeper: alleen rol wisselen
      setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [], inn: [], keeperChange: true, newKeeper }]);
    }
    setMatchKeeper(newKeeper);
    setShowKeeperPicker(false);
  };

  return {
    // Setup state
    players, setPlayers, keeper, setKeeper, newPlayer, setNewPlayer,
    playersOnField, setPlayersOnField, halfDuration, setHalfDuration,
    halves, setHalves, subInterval, setSubInterval,
    homeTeam, setHomeTeam, awayTeam, setAwayTeam,
    // Match state
    view, setView, onField, onBench, playTime, currentHalf,
    matchTimer, subTimer, isRunning, isPaused, setIsPaused,
    showSubAlert, suggestedSubs, subHistory, halfBreak,
    manualSubMode, setManualSubMode, matchKeeper,
    showKeeperPicker, setShowKeeperPicker,
    homeScore, setHomeScore, awayScore, setAwayScore,
    // Paste state
    showPaste, setShowPaste, clipboardNames, setClipboardNames,
    showClipBanner, setShowClipBanner, clipDismissed, setClipDismissed,
    pasteText, setPasteText, pasteResult, setPasteResult,
    // Computed
    totalMatchTime,
    // Actions
    addPlayer, removePlayer, movePlayer, toggleKeeper,
    startMatch, executeSubs, skipSubs, startNextHalf,
    manualSub, swapKeeper, setIsRunning,
  };
}
