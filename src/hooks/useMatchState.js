import { useState, useEffect, useRef, useCallback } from 'react';
import { playWhistle, notifySub, notifyHalf, notifyEnd, notifyGoal } from '../utils/audio';
import { fmt } from '../utils/format';
import { assignPlayersToFormation } from '../data/formations';

export const VIEWS = { SETUP: "setup", MATCH: "match", SUMMARY: "summary" };

// --- Pre-calculated substitution schedule (v3.16.0) ---

/**
 * Genereer een volledig wisselschema over alle helften.
 * Pure functie — geen React state dependency.
 *
 * @param {string[]} playerList - Alle spelers (incl. keeper)
 * @param {string} keeperName - Naam van de keeper
 * @param {number} numOnField - Aantal spelers op het veld (incl. keeper)
 * @param {number} hDuration - Helftduur in minuten
 * @param {number} nHalves - Aantal helften
 * @param {number} sInterval - Wisselinterval in minuten
 * @param {Object} currentPlayTime - Huidige speeltijd per speler (voor herberekening)
 * @param {string[]} excludedList - Uitgesloten spelers (blessure/rood)
 * @param {string[]|null} initialField - Huidige veldspelers (voor herberekening)
 * @param {string[]|null} initialBench - Huidige bankspelers (voor herberekening)
 * @returns {Array} schedule - Array van wisselslots
 */
function generateSubSchedule(playerList, keeperName, numOnField, hDuration, nHalves, sInterval, currentPlayTime = {}, excludedList = [], initialField = null, initialBench = null) {
  const outfield = playerList.filter(p => p !== keeperName && !excludedList.includes(p));
  const F = numOnField;
  const B = outfield.length - (F - 1); // bench size (F includes keeper)
  const D = hDuration * 60;
  const I = sInterval * 60;

  if (B <= 0 || I <= 0) return [];

  const slotsPerHalf = Math.max(1, Math.floor(D / I) - 1);
  const fieldSlots = F - 1; // veldplekken excl. keeper
  const perSlot = Math.max(1, Math.min(B, Math.min(fieldSlots, Math.round(B * I / D))));

  // Gebruik meegegeven field/bench of bereken initieel
  let field = initialField ? [...initialField] : [keeperName, ...outfield.slice(0, F - 1)];
  let bench = initialBench ? [...initialBench] : outfield.slice(F - 1);

  // Filter uitgesloten spelers
  field = field.filter(p => !excludedList.includes(p));
  bench = bench.filter(p => !excludedList.includes(p));

  // Track geplande speeltijd per outfield speler
  const projected = {};
  outfield.forEach(p => { projected[p] = currentPlayTime[p] || 0; });

  const schedule = [];
  let slotId = 0;

  for (let half = 1; half <= nHalves; half++) {
    const slotTimes = [];
    const MIN_BEFORE_END = 120; // 2 minuten voor einde helft niet meer wisselen
    for (let s = 1; s <= slotsPerHalf; s++) {
      const t = s * I;
      if (t <= D - MIN_BEFORE_END) slotTimes.push(t);
    }

    let prevSlotTime = 0;
    for (const slotTime of slotTimes) {
      // Update projected speeltijd voor veldspelers
      const delta = slotTime - prevSlotTime;
      field.filter(p => p !== keeperName).forEach(p => {
        projected[p] = (projected[p] || 0) + delta;
      });

      // Wie eruit: veldspelers (excl. keeper) met MEESTE projected speeltijd
      const eligible = field.filter(p => p !== keeperName);
      eligible.sort((a, b) => (projected[b] || 0) - (projected[a] || 0));
      const goingOut = eligible.slice(0, perSlot);

      // Wie erin: bankspelers met MINSTE projected speeltijd
      const benchSorted = [...bench].sort((a, b) => (projected[a] || 0) - (projected[b] || 0));
      const goingIn = benchSorted.slice(0, perSlot);

      if (goingOut.length > 0 && goingIn.length > 0) {
        schedule.push({
          id: `slot-${++slotId}`,
          half,
          time: slotTime,
          absoluteTime: (half - 1) * D + slotTime,
          out: [...goingOut],
          inn: [...goingIn],
          status: 'pending',
          executedAt: null,
        });

        // Pas field/bench aan voor volgende slot
        field = field.filter(p => !goingOut.includes(p)).concat(goingIn);
        bench = bench.filter(p => !goingIn.includes(p)).concat(goingOut);
      }

      prevSlotTime = slotTime;
    }

    // Einde helft: resterende speeltijd optellen
    if (slotTimes.length > 0) {
      const remaining = D - slotTimes[slotTimes.length - 1];
      field.filter(p => p !== keeperName).forEach(p => {
        projected[p] = (projected[p] || 0) + remaining;
      });
    }
  }

  return schedule;
}

/**
 * Herbereken resterende wisselslots na skip/injury/edit.
 * Behoudt alle executed/skipped slots, herberekent pending slots.
 */
function recalculateRemainingSlots(schedule, fromIndex, currentField, currentBench, currentPlayTime, keeperName, hDuration, nHalves, sInterval, excluded) {
  // Behoud alle slots t/m fromIndex (executed/skipped)
  const fixed = schedule.filter((s, i) => i <= fromIndex);

  // Alle actieve spelers = field + bench (keeper zit al in field)
  const allPlayers = [...currentField, ...currentBench];

  // Genereer nieuw schema met actuele speeltijden en veld/bank bezetting
  const remaining = generateSubSchedule(
    allPlayers, keeperName, currentField.length,
    hDuration, nHalves, sInterval,
    currentPlayTime, excluded,
    currentField, currentBench
  );

  // Filter: alleen slots die NA het huidige absolute moment vallen
  const currentAbsTime = schedule[fromIndex]?.absoluteTime || 0;
  const futureSlots = remaining.filter(s => s.absoluteTime > currentAbsTime);

  // Merge: fixed + herberekende future slots
  return [...fixed, ...futureSlots.map((s, i) => ({
    ...s,
    id: `slot-recalc-${fromIndex + 1}-${i}`,
    status: 'pending',
    executedAt: null,
  }))];
}

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
  const [injuryTime, setInjuryTime] = useState(false);
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
  const [events, setEvents] = useState([]);
  const [pendingEnd, setPendingEnd] = useState(false); // Wedstrijd wil eindigen, wacht op coach bevestiging

  // Tactiek modus state (JO13+ / 11v11)
  const [matchMode, setMatchMode] = useState("speeltijd"); // "speeltijd" | "tactiek" (legacy)
  const [autoSubs, setAutoSubs] = useState(true); // Eerlijke wissels aan/uit (onafhankelijk van veld-view)
  const [formation, setFormation] = useState(null); // "4-3-3" | "custom" | null
  const [playerPositions, setPlayerPositions] = useState({}); // { "Bobby": { x: 50, y: 85 } }
  const [squadNumbers, setSquadNumbers] = useState({}); // { "Bobby": 1 }

  // Wisselschema state (v3.16.0 — pre-calculated substitution schedule)
  const [subSchedule, setSubSchedule] = useState([]); // [{id, half, time, absoluteTime, out, inn, status, executedAt}]
  const [activeSlotIndex, setActiveSlotIndex] = useState(-1); // Index van actief wisselmoment (-1 = geen)
  const [excludedPlayers, setExcludedPlayers] = useState([]); // Spelers uitgevallen (blessure/rood)
  const [scheduleVersion, setScheduleVersion] = useState(0); // Teller voor herberekening tracking
  const [subsPerSlot, setSubsPerSlot] = useState(1); // Berekend aantal wissels per moment

  // Multiplayer state
  const [matchCode, setMatchCode] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [team, setTeam] = useState("");
  const [coachName, setCoachName] = useState("");
  const [syncError, setSyncError] = useState(null);
  const [viewers, setViewers] = useState(0);

  const intervalRef = useRef(null);
  const alertShownRef = useRef(false);
  const syncTimeoutRef = useRef(null);
  const timerStartRef = useRef(null); // Timestamp wanneer timer start
  const matchTimerRef = useRef(0); // Huidige matchTimer waarde voor interval closure
  const pendingEventsRef = useRef([]); // Queue voor gefaalde event syncs
  const coachIdRef = useRef(Math.random().toString(36).slice(2, 10)); // Unieke coach sessie ID
  const lastSyncTimeRef = useRef(0); // Timestamp laatste succesvolle PUT
  const isAdoptingRef = useRef(false); // Voorkom sync-loop bij adoptie server state
  const subLatencyRef = useRef(0); // Seconden latency tussen alert en coach actie
  const totalMatchTime = halfDuration * halves;

  // --- API Sync ---
  const getMatchSnapshot = useCallback(() => ({
    status: view === VIEWS.MATCH ? (halfBreak ? 'halftime' : isRunning ? (isPaused ? 'paused' : 'live') : 'ended') : view === VIEWS.SUMMARY ? 'ended' : 'setup',
    team,
    coachName,
    homeTeam, awayTeam,
    players, keeper: matchKeeper,
    matchKeeper,
    playersOnField, halfDuration, halves, subInterval,
    onField, onBench,
    homeScore, awayScore,
    goalScorers,
    currentHalf,
    // Timer sync via timestamps
    timerStartedAt: (isRunning && !isPaused && !halfBreak) ? new Date(Date.now() - matchTimer * 1000).toISOString() : null,
    elapsedAtPause: matchTimer,
    subTimerStartedAt: (isRunning && !isPaused && !halfBreak) ? new Date(Date.now() - subTimer * 1000).toISOString() : null,
    subElapsedAtPause: subTimer,
    playTime,
    subHistory,
    injuryTime,
    isRunning, isPaused, halfBreak,
    matchMode, autoSubs, formation, playerPositions, squadNumbers,
    // Wisselschema sync (v3.16.0)
    subSchedule, activeSlotIndex, excludedPlayers, scheduleVersion, subsPerSlot,
    // Alert state (voor reconnect restore)
    showSubAlert, suggestedSubs,
    _coachId: coachIdRef.current,
    _updatedAt: Date.now(),
  }), [view, team, coachName, homeTeam, awayTeam, players, matchKeeper, playersOnField, halfDuration, halves, subInterval, onField, onBench, homeScore, awayScore, goalScorers, currentHalf, matchTimer, subTimer, isRunning, isPaused, halfBreak, playTime, subHistory, injuryTime, matchMode, autoSubs, formation, playerPositions, squadNumbers, subSchedule, activeSlotIndex, excludedPlayers, scheduleVersion, subsPerSlot, showSubAlert, suggestedSubs]);

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
        lastSyncTimeRef.current = Date.now();
        // Flush pending events die eerder gefaald zijn
        if (pendingEventsRef.current.length > 0) {
          const pending = [...pendingEventsRef.current];
          pendingEventsRef.current = [];
          for (const ev of pending) {
            try {
              await fetch(`/api/match/events/${matchCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ev),
              });
            } catch {
              pendingEventsRef.current.push(ev);
            }
          }
        }
      } catch (err) {
        console.error('Sync error:', err);
        setSyncError('Sync mislukt');
      }
    }, 300);
  }, [isOnline, matchCode, getMatchSnapshot]);

  const addEvent = useCallback(async (event) => {
    if (!isOnline || !matchCode) return;
    const ev = { ...event, id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    try {
      await fetch(`/api/match/events/${matchCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ev),
      });
    } catch (err) {
      console.error('Event sync error:', err);
      pendingEventsRef.current.push(ev);
    }
  }, [isOnline, matchCode]);

  // --- Multi-coach sync: adopteer server state van andere coach ---
  const applyServerSnapshot = useCallback((data) => {
    isAdoptingRef.current = true;

    // Live match state
    setOnField(data.onField || []);
    setOnBench(data.onBench || []);
    setPlayTime(data.playTime || {});
    setHomeScore(data.homeScore || 0);
    setAwayScore(data.awayScore || 0);
    setGoalScorers(data.goalScorers || {});
    setCurrentHalf(data.currentHalf || 1);
    setHalfBreak(data.halfBreak || false);
    setInjuryTime(data.injuryTime || false);
    setMatchKeeper(data.matchKeeper || data.keeper || null);
    setSubHistory(data.subHistory || []);
    setIsRunning(data.isRunning || false);
    setIsPaused(data.isPaused || false);

    // Timer: herbereken vanuit server timestamps
    if (data.timerStartedAt && data.isRunning && !data.isPaused && !data.halfBreak) {
      const elapsed = Math.floor((Date.now() - new Date(data.timerStartedAt).getTime()) / 1000);
      setMatchTimer(elapsed);
      matchTimerRef.current = elapsed;
      const subElapsed = data.subTimerStartedAt
        ? Math.floor((Date.now() - new Date(data.subTimerStartedAt).getTime()) / 1000)
        : 0;
      setSubTimer(subElapsed);
    } else {
      setMatchTimer(data.elapsedAtPause || 0);
      matchTimerRef.current = data.elapsedAtPause || 0;
      setSubTimer(data.subElapsedAtPause || 0);
    }

    // Tactiek modus state
    setMatchMode(data.matchMode || "speeltijd");
    setAutoSubs(data.autoSubs != null ? data.autoSubs : (data.matchMode !== "tactiek"));
    setFormation(data.formation || null);
    setPlayerPositions(data.playerPositions || {});
    setSquadNumbers(data.squadNumbers || {});

    // Wisselschema state (v3.16.0)
    if (data.subSchedule) setSubSchedule(data.subSchedule);
    if (data.activeSlotIndex !== undefined) setActiveSlotIndex(data.activeSlotIndex);
    if (data.excludedPlayers) setExcludedPlayers(data.excludedPlayers);
    if (data.scheduleVersion !== undefined) setScheduleVersion(data.scheduleVersion);
    if (data.subsPerSlot !== undefined) setSubsPerSlot(data.subsPerSlot);

    // Sub alert sluiten (andere coach heeft gewisseld of overgeslagen)
    if (showSubAlert) {
      setShowSubAlert(false);
    }
    alertShownRef.current = false;

    // Anti-echo: reset na React batch update
    setTimeout(() => { isAdoptingRef.current = false; }, 0);
  }, [showSubAlert]);

  // Sync bij elke relevante state wijziging (anti-echo: skip als we server state adopteren)
  useEffect(() => {
    if (isOnline && matchCode && view !== VIEWS.SETUP && !isAdoptingRef.current) syncToServer();
  }, [onField, onBench, homeScore, awayScore, isRunning, isPaused, halfBreak, currentHalf, matchKeeper, playTime, view, matchCode, formation, playerPositions]);

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
    // Schema-based: haal volgende pending slot uit het schema
    if (subSchedule.length > 0) {
      const nextSlot = subSchedule.find(s => s.status === 'pending');
      if (nextSlot) return { out: nextSlot.out, inn: nextSlot.inn };
    }
    // Legacy fallback: ad-hoc berekening (backwards compatible)
    if (bench.length === 0) return { out: [], inn: [] };
    const el = field.filter(p => p !== kp);
    if (el.length === 0) return { out: [], inn: [] };
    const n = bench.length;
    return { out: [...el].sort((a, b) => (pt[b] || 0) - (pt[a] || 0)).slice(0, n), inn: [...bench].sort((a, b) => (pt[a] || 0) - (pt[b] || 0)).slice(0, n) };
  }, [subSchedule]);

  const startMatch = () => {
    if (players.length <= playersOnField) return;
    const init = {}; players.forEach(p => (init[p] = 0));
    let fl, bl;
    if (keeper) { const nk = players.filter(p => p !== keeper); fl = [keeper, ...nk.slice(0, playersOnField - 1)]; bl = nk.slice(playersOnField - 1); }
    else { fl = players.slice(0, playersOnField); bl = players.slice(playersOnField); }
    setOnField(fl); setOnBench(bl); setMatchKeeper(keeper);
    setPlayTime(init); setCurrentHalf(1); setMatchTimer(0); setSubTimer(0);
    matchTimerRef.current = 0; // Reset ref zodat delta-berekening niet negatief wordt
    setIsRunning(false); setIsPaused(false); setShowSubAlert(false);
    setSubHistory([]); setHalfBreak(false); setInjuryTime(false);
    alertShownRef.current = false; setManualSubMode(null);
    setHomeScore(0); setAwayScore(0); setGoalScorers({});
    setEvents([]); // Reset events van vorige wedstrijd
    setPendingEnd(false);
    // Veld-view: wijs spelers toe aan opstellingsposities (bij >= 7 op veld)
    if (playersOnField >= 7 && formation && formation !== "custom") {
      setPlayerPositions(assignPlayersToFormation(formation, fl, keeper));
    }
    // Wisselschema: genereer pre-calculated schedule bij start (alleen als autoSubs aan)
    if (autoSubs) {
      const schedule = generateSubSchedule(players, keeper, playersOnField, halfDuration, halves, subInterval);
      setSubSchedule(schedule);
      setActiveSlotIndex(-1);
      setExcludedPlayers([]);
      setScheduleVersion(1);
      const B = players.length - playersOnField;
      const I = subInterval * 60;
      const D = halfDuration * 60;
      setSubsPerSlot(Math.max(1, Math.min(B, Math.round(B * I / D))));
    } else {
      setSubSchedule([]);
      setActiveSlotIndex(-1);
      setExcludedPlayers([]);
      setScheduleVersion(0);
      setSubsPerSlot(1);
    }
    subLatencyRef.current = 0;
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
        timerStartRef.current = Date.now() - (matchTimerRef.current * 1000);
      }

      intervalRef.current = setInterval(() => {
        // Bereken tijd vanaf timestamp (beschermt tegen schermvergrendeling)
        const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
        const delta = elapsed - matchTimerRef.current;
        matchTimerRef.current = elapsed;

        setMatchTimer(elapsed);
        setSubTimer(prev => prev + delta);
        setOnField(cf => {
          setPlayTime(prev => {
            const n = { ...prev };
            cf.forEach(p => (n[p] = (n[p] || 0) + delta));
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
  }, [isRunning, isPaused, halfBreak]);

  // Periodieke sync elke 10 seconden (voor playTime updates)
  useEffect(() => {
    if (!isOnline || !matchCode || !isRunning || isPaused || halfBreak) return;
    const iv = setInterval(syncToServer, 10000);
    return () => clearInterval(iv);
  }, [isOnline, matchCode, isRunning, isPaused, halfBreak, syncToServer]);

  // --- Multi-coach polling: adopteer wijzigingen van andere coaches + events ophalen ---
  useEffect(() => {
    if (!isOnline || !matchCode || view === VIEWS.SETUP) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/match/${matchCode}`);
        if (!res.ok) return;
        const data = await res.json();
        // Viewer count altijd updaten
        if (data.viewers !== undefined) setViewers(data.viewers);
        // Events ophalen voor coach dashboard
        try {
          const evRes = await fetch(`/api/match/events/${matchCode}`);
          if (evRes.ok) {
            const evData = await evRes.json();
            setEvents(evData);
          }
        } catch { /* ignore */ }
        // Skip als server geen coach sync bevat (initiële create data)
        if (!data._coachId) return;
        // Skip eigen updates
        if (data._coachId === coachIdRef.current) return;
        // Skip als ouder dan onze laatste push
        if (data._updatedAt && data._updatedAt < lastSyncTimeRef.current) return;
        // Andere coach heeft gewijzigd: adopteer
        applyServerSnapshot(data);
      } catch { /* ignore */ }
    };
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [isOnline, matchCode, view, applyServerSnapshot]);

  // Half end + sub alert detection
  useEffect(() => {
    if (!isRunning || isPaused || halfBreak) return;
    const hs = halfDuration * 60;
    const he = matchTimer - (currentHalf - 1) * hs;
    const maxInjuryTime = 5 * 60; // 5 minuten blessuretijd

    // Blessuretijd: tussen hs en hs + 5 min
    if (he >= hs && he < hs + maxInjuryTime) {
      if (!injuryTime) {
        setInjuryTime(true);
        addEvent({ type: 'injury_time_start', time: fmt(matchTimer), half: currentHalf });
      }
    }

    // Stop na maximale tijd (regulier + 5 min blessuretijd)
    if (he >= hs + maxInjuryTime) {
      clearInterval(intervalRef.current);
      setInjuryTime(false);
      if (currentHalf < halves) {
        setHalfBreak(true); setShowSubAlert(false); notifyHalf();
        addEvent({ type: 'half_end', time: fmt(matchTimer), half: currentHalf });
      } else {
        setIsRunning(false); notifyEnd(); setPendingEnd(true);
        addEvent({ type: 'match_end', time: fmt(matchTimer), half: currentHalf });
      }
      return;
    }
    // Geen wisseladvies in laatste 2 minuten van helft
    const remainingInHalf = hs - he;
    if (autoSubs && subTimer >= subInterval * 60 && !alertShownRef.current && onBench.length > 0 && remainingInHalf >= 120) {
      alertShownRef.current = true;
      // Track latency start (coach ziet nu de alert)
      subLatencyRef.current = subTimer - (subInterval * 60);
      // Zoek index van volgende pending slot in schema
      const nextIdx = subSchedule.findIndex(s => s.status === 'pending');
      if (nextIdx >= 0) setActiveSlotIndex(nextIdx);
      setSuggestedSubs(calculateSubs(onField, onBench, playTime, matchKeeper));
      setShowSubAlert(true);
      notifySub();
    }
  }, [matchTimer, subTimer, isRunning, isPaused, halfBreak, currentHalf, halves, halfDuration, subInterval, onField, onBench, playTime, calculateSubs, matchKeeper, subSchedule]);

  const executeSubs = () => {
    const { out, inn } = suggestedSubs;
    setOnField(prev => prev.filter(p => !out.includes(p)).concat(inn));
    setOnBench(prev => prev.filter(p => !inn.includes(p)).concat(out));
    setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [...out], inn: [...inn] }]);
    // Markeer slot als executed + detecteer edits voor herberekening
    if (activeSlotIndex >= 0) {
      const originalSlot = subSchedule[activeSlotIndex];
      const wasEdited = originalSlot && (
        JSON.stringify(originalSlot.out.slice().sort()) !== JSON.stringify([...out].sort()) ||
        JSON.stringify(originalSlot.inn.slice().sort()) !== JSON.stringify([...inn].sort())
      );
      setSubSchedule(prev => {
        const updated = prev.map((s, i) =>
          i === activeSlotIndex ? { ...s, status: 'executed', executedAt: matchTimer, out: [...out], inn: [...inn] } : s
        );
        if (wasEdited) {
          // Coach heeft voorstel aangepast: herbereken toekomstige slots
          const newField = onField.filter(p => !out.includes(p)).concat(inn);
          const newBench = onBench.filter(p => !inn.includes(p)).concat(out);
          const recalc = recalculateRemainingSlots(
            updated, activeSlotIndex, newField, newBench, playTime,
            matchKeeper, halfDuration, halves, subInterval, excludedPlayers
          );
          setScheduleVersion(v => v + 1);
          return recalc;
        }
        return updated;
      });
    }
    // Latency-compensatie: overshoot meenemen naar volgende cyclus (niet 0 resetten)
    const overshoot = subTimer - (subInterval * 60);
    setSubTimer(Math.max(0, overshoot));
    setShowSubAlert(false);
    alertShownRef.current = false;
    setActiveSlotIndex(-1);
    subLatencyRef.current = 0;
    addEvent({ type: 'sub_auto', time: fmt(matchTimer), half: currentHalf, out: [...out], inn: [...inn] });
  };

  const skipSubs = () => {
    // Markeer slot als skipped in schema + herbereken resterende slots
    if (activeSlotIndex >= 0) {
      setSubSchedule(prev => {
        const updated = prev.map((s, i) =>
          i === activeSlotIndex ? { ...s, status: 'skipped', executedAt: matchTimer } : s
        );
        // Herbereken toekomstige slots met actuele speeltijden
        const recalc = recalculateRemainingSlots(
          updated, activeSlotIndex, onField, onBench, playTime,
          matchKeeper, halfDuration, halves, subInterval, excludedPlayers
        );
        setScheduleVersion(v => v + 1);
        return recalc;
      });
    }
    // Latency-compensatie: overshoot meenemen
    const overshoot = subTimer - (subInterval * 60);
    setSubTimer(Math.max(0, overshoot));
    setShowSubAlert(false);
    alertShownRef.current = false;
    setActiveSlotIndex(-1);
    subLatencyRef.current = 0;
    addEvent({ type: 'sub_skipped', time: fmt(matchTimer), half: currentHalf });
    syncToServer();
  };

  // Coach past wisselvoorstel aan via dropdowns in de alert
  const editSubProposal = (index, direction, newPlayer) => {
    setSuggestedSubs(prev => {
      const updated = { out: [...prev.out], inn: [...prev.inn] };
      updated[direction][index] = newPlayer;
      return updated;
    });
  };

  // Blessure/uitsluiting: speler verwijderen uit wedstrijd + schema herberekenen
  const excludePlayer = (player) => {
    const wasOnField = onField.includes(player);
    const wasKeeper = player === matchKeeper;
    let newField = [...onField];
    let newBench = [...onBench];
    const newExcluded = [...excludedPlayers, player];

    if (wasOnField) {
      newField = newField.filter(p => p !== player);
      // Auto-vervanging: bankspeler met minste speeltijd erin
      if (newBench.length > 0) {
        const sorted = [...newBench].sort((a, b) => (playTime[a] || 0) - (playTime[b] || 0));
        const replacement = sorted[0];
        newField.push(replacement);
        newBench = newBench.filter(p => p !== replacement);
        setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [player], inn: [replacement], injury: true }]);
        addEvent({ type: 'injury_sub', time: fmt(matchTimer), half: currentHalf, out: player, inn: replacement });
      } else {
        // Geen bankspelers: spelen met minder
        addEvent({ type: 'injury_no_sub', time: fmt(matchTimer), half: currentHalf, out: player });
      }
    } else {
      newBench = newBench.filter(p => p !== player);
      addEvent({ type: 'injury_bench', time: fmt(matchTimer), half: currentHalf, out: player });
    }

    // Als geblesseerde speler keeper was: eerste veldspeler wordt keeper
    let newKeeper = matchKeeper;
    if (wasKeeper && newField.length > 0) {
      newKeeper = newField[0];
      setMatchKeeper(newKeeper);
      addEvent({ type: 'keeper_change', time: fmt(matchTimer), half: currentHalf, newKeeper });
    }

    setOnField(newField);
    setOnBench(newBench);
    setExcludedPlayers(newExcluded);

    // Bug Fix: als geen bankspelers meer → sluit alert en leeg schema
    if (newBench.length === 0) {
      if (showSubAlert) {
        setShowSubAlert(false);
        alertShownRef.current = false;
      }
      setSubSchedule(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'skipped' } : s));
      setScheduleVersion(v => v + 1);
      addEvent({ type: 'no_subs_remaining', time: fmt(matchTimer), half: currentHalf });
      syncToServer();
      return;
    }

    // Schema herberekenen met nieuwe speler-pool
    setSubSchedule(prev => {
      const recalc = recalculateRemainingSlots(
        prev, activeSlotIndex >= 0 ? activeSlotIndex : prev.findIndex(s => s.status === 'pending') - 1,
        newField, newBench, playTime, newKeeper, halfDuration, halves, subInterval, newExcluded
      );
      setScheduleVersion(v => v + 1);
      return recalc;
    });
    syncToServer();
  };

  const forceEndHalf = () => {
    clearInterval(intervalRef.current);
    if (currentHalf < halves) {
      setHalfBreak(true); setShowSubAlert(false); notifyHalf();
      addEvent({ type: 'half_end_manual', time: fmt(matchTimer), half: currentHalf });
    } else {
      setIsRunning(false); notifyEnd(); setPendingEnd(true);
      addEvent({ type: 'match_end_manual', time: fmt(matchTimer), half: currentHalf });
    }
  };

  const startNextHalf = () => {
    const nextHalf = currentHalf + 1;
    setCurrentHalf(nextHalf);
    setHalfBreak(false);
    setInjuryTime(false);
    setSubTimer(0);
    alertShownRef.current = false;
    subLatencyRef.current = 0;
    addEvent({ type: 'half_start', time: fmt(matchTimer), half: nextHalf });
    // Toon eerste wissel van nieuwe helft als er bankspelers zijn
    if (onBench.length > 0) {
      // Zoek volgende pending slot (in het nieuwe helft-gedeelte van schema)
      const nextIdx = subSchedule.findIndex(s => s.status === 'pending');
      if (nextIdx >= 0) setActiveSlotIndex(nextIdx);
      setSuggestedSubs(calculateSubs(onField, onBench, playTime, matchKeeper));
      setShowSubAlert(true);
      notifySub();
    }
  };

  const manualSub = (fp, bp) => {
    const wasKeeper = fp === matchKeeper;
    setOnField(onField.map(p => (p === fp ? bp : p)));
    setOnBench(onBench.map(p => (p === bp ? fp : p)));
    if (wasKeeper) setMatchKeeper(bp);
    // Veld-view: inkomende speler erft positie van uitgaande
    if (playersOnField >= 7) {
      setPlayerPositions(prev => {
        const n = { ...prev };
        if (n[fp]) { n[bp] = { ...n[fp] }; delete n[fp]; }
        return n;
      });
    }
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
    // Bug Fix: keeper swap tijdens actieve sub alert → herbereken suggestedSubs
    if (showSubAlert) {
      const updatedField = fromBench ? onField.map(p => (p === matchKeeper ? newKeeper : p)) : onField;
      const updatedBench = fromBench ? onBench.map(p => (p === newKeeper ? matchKeeper : p)) : onBench;
      setSuggestedSubs(calculateSubs(updatedField, updatedBench, playTime, newKeeper));
    }
    // Keeper van bank: veld/bank compositie veranderd → schema herberekenen
    if (fromBench) {
      const newField = onField.map(p => (p === matchKeeper ? newKeeper : p));
      const newBench = onBench.map(p => (p === newKeeper ? matchKeeper : p));
      setSubSchedule(prev => {
        const pivotIdx = activeSlotIndex >= 0 ? activeSlotIndex : prev.findIndex(s => s.status === 'pending') - 1;
        const recalc = recalculateRemainingSlots(
          prev, pivotIdx, newField, newBench, playTime, newKeeper, halfDuration, halves, subInterval, excludedPlayers
        );
        setScheduleVersion(v => v + 1);
        return recalc;
      });
    }
  };

  const updatePlayerPosition = (name, pos) => {
    setPlayerPositions(prev => ({ ...prev, [name]: pos }));
    if (formation !== "custom") setFormation("custom");
  };

  const updateScore = (side, delta, scorer) => {
    if (side === 'home') {
      const newScore = Math.max(0, homeScore + delta);
      setHomeScore(newScore);
      if (delta > 0) {
        notifyGoal();
        if (scorer) setGoalScorers(prev => ({ ...prev, [scorer]: (prev[scorer] || 0) + 1 }));
        addEvent({ type: 'goal_home', time: fmt(matchTimer), half: currentHalf, scorer: scorer || null });
      } else if (delta < 0 && homeScore > 0) {
        // Verwijder laatste scorer
        setGoalScorers(prev => {
          const updated = { ...prev };
          const scorers = Object.entries(updated).filter(([, v]) => v > 0);
          if (scorers.length > 0) {
            const [lastScorer] = scorers[scorers.length - 1];
            updated[lastScorer] = updated[lastScorer] - 1;
            if (updated[lastScorer] <= 0) delete updated[lastScorer];
          }
          return updated;
        });
        addEvent({ type: 'goal_removed_home', time: fmt(matchTimer), half: currentHalf });
      }
    } else {
      const newScore = Math.max(0, awayScore + delta);
      setAwayScore(newScore);
      if (delta > 0) addEvent({ type: 'goal_away', time: fmt(matchTimer), half: currentHalf });
      else if (delta < 0 && awayScore > 0) addEvent({ type: 'goal_removed_away', time: fmt(matchTimer), half: currentHalf });
    }
  };

  // --- Reconnect: herstel state vanuit server na page refresh ---
  const reconnectToMatch = useCallback(async (code) => {
    try {
      const res = await fetch(`/api/match/${code}`);
      if (!res.ok) {
        console.error('Reconnect failed:', res.status, res.statusText, 'for code:', code);
        return false;
      }
      const data = await res.json();

      // Setup state (niet in applyServerSnapshot)
      setMatchCode(code);
      setIsOnline(true);
      setTeam(data.team || '');
      setHomeTeam(data.homeTeam || 'Dilettant');
      setAwayTeam(data.awayTeam || '');
      setPlayers(data.players || []);
      setKeeper(data.matchKeeper || data.keeper || null);
      setPlayersOnField(data.playersOnField || 5);
      setHalfDuration(data.halfDuration || 20);
      setHalves(data.halves || 2);
      setSubInterval(data.subInterval || 5);

      // CoachName: gebruik localStorage naam van joining coach, fallback naar server data
      try {
        const saved = JSON.parse(localStorage.getItem('dilli_coach') || '{}');
        setCoachName(saved.coachName || data.coachName || '');
      } catch { setCoachName(data.coachName || ''); }

      // Tactiek modus state (setup level)
      setMatchMode(data.matchMode || "speeltijd");
      setAutoSubs(data.autoSubs != null ? data.autoSubs : (data.matchMode !== "tactiek"));
      setFormation(data.formation || null);
      setSquadNumbers(data.squadNumbers || {});

      // Live match state + timer via gedeelde functie
      applyServerSnapshot(data);

      // Bug Fix: herstel sub alert na reconnect (pagina refresh)
      if (data.showSubAlert && data.suggestedSubs) {
        setShowSubAlert(true);
        setSuggestedSubs(data.suggestedSubs);
        alertShownRef.current = true;
      }

      // Status → view
      if (data.status === 'ended') {
        setView(VIEWS.SUMMARY);
        setIsRunning(false);
      } else {
        setView(VIEWS.MATCH);
      }
      return true;
    } catch (err) {
      console.error('Reconnect error:', err);
      return false;
    }
  }, [applyServerSnapshot]);

  // Wedstrijd definitief beëindigen → naar samenvatting
  const finalizeMatch = useCallback(() => {
    setPendingEnd(false);
    setView(VIEWS.SUMMARY);
  }, []);

  // Wedstrijd opslaan in team historie
  const saveMatchToHistory = useCallback(async () => {
    const teamName = team || homeTeam || '';
    if (!teamName) return false;
    try {
      const res = await fetch('/api/match/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName,
          match: {
            homeTeam, awayTeam, homeScore, awayScore,
            playTime, goalScorers, subHistory, events,
          },
        }),
      });
      const data = await res.json();
      return data.ok || false;
    } catch {
      return false;
    }
  }, [team, homeTeam, awayTeam, homeScore, awayScore, playTime, goalScorers, subHistory, events]);

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
    showSubAlert, suggestedSubs, subHistory, halfBreak, injuryTime,
    manualSubMode, setManualSubMode, matchKeeper,
    showKeeperPicker, setShowKeeperPicker,
    homeScore, setHomeScore, awayScore, setAwayScore, goalScorers, setGoalScorers,
    // Paste state
    showPaste, setShowPaste, clipboardNames, setClipboardNames,
    showClipBanner, setShowClipBanner, clipDismissed, setClipDismissed,
    pasteText, setPasteText, pasteResult, setPasteResult,
    // Tactiek modus + autoSubs
    matchMode, setMatchMode, autoSubs, setAutoSubs, formation, setFormation,
    playerPositions, setPlayerPositions, updatePlayerPosition,
    squadNumbers, setSquadNumbers,
    // Wisselschema (v3.16.0)
    subSchedule, activeSlotIndex, excludedPlayers, scheduleVersion, subsPerSlot,
    // Multiplayer
    matchCode, setMatchCode, isOnline, setIsOnline, syncError,
    coachName, setCoachName, viewers, events, pendingEnd,
    createOnlineMatch, updateScore, reconnectToMatch, addEvent,
    finalizeMatch, saveMatchToHistory,
    // Computed
    totalMatchTime,
    // Actions
    addPlayer, removePlayer, movePlayer, toggleKeeper,
    startMatch, startTimer, executeSubs, skipSubs, editSubProposal, excludePlayer, forceEndHalf, startNextHalf,
    manualSub, swapKeeper, setIsRunning, calculateSubs,
  };
}
