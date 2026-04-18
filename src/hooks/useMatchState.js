import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { playWhistle, notifySub, notifyHalf, notifyEnd, notifyGoal } from '../utils/audio';
import { fmt, getHalfElapsed } from '../utils/format';
import { assignPlayersToFormation } from '../data/formations';

export const VIEWS = { SETUP: "setup", MATCH: "match", SUMMARY: "summary" };

// Dedup helper: verwijder duplicaten uit een array (behoud eerste voorkomen)
const dedup = (arr) => [...new Set(arr)];

// --- STATE INVARIANT: garandeert dat field en bench NOOIT overlappen ---
// Elke speler zit in PRECIES één lijst (field, bench, of excluded). Nooit dubbel.
function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set();
  const cleanField = [];
  const cleanBench = [];
  const excludedSet = new Set(excluded);

  // Field heeft prioriteit: wie op het veld staat, staat op het veld
  for (const p of field) {
    if (!seen.has(p) && !excludedSet.has(p)) {
      cleanField.push(p);
      seen.add(p);
    }
  }
  // Bench: alleen spelers die NIET al op het veld staan
  for (const p of bench) {
    if (!seen.has(p) && !excludedSet.has(p)) {
      cleanBench.push(p);
      seen.add(p);
    }
  }
  return { field: cleanField, bench: cleanBench };
}

// --- DEBUG LOG: capture elke state-mutatie voor post-match analyse ---
const MAX_LOG_ENTRIES = 500;
let matchLog = [];

function logAction(action, details = {}) {
  const entry = {
    t: Date.now(),
    action,
    ...details,
  };
  matchLog.push(entry);
  if (matchLog.length > MAX_LOG_ENTRIES) matchLog = matchLog.slice(-MAX_LOG_ENTRIES);
}

export function getMatchLog() { return [...matchLog]; }
export function clearMatchLog() { matchLog = []; }

/**
 * Bereken dynamisch wisselinterval zodat wisselmomenten de helft netjes vullen.
 * @param {number} halfDurationMin - Helftduur in minuten
 * @param {number} benchSize - Aantal bankspelers
 * @returns {number} interval in minuten (afgerond op hele minuten, min 2)
 */
function calculateDynamicInterval(halfDurationMin, benchSize) {
  if (benchSize <= 0) return halfDurationMin;
  // Doel: MAXIMALE GELIJKE SPEELTIJD.
  //
  // Simulatie-geoptimaliseerd (test-bobby-optimaliseer.mjs):
  // - JO8/JO9 (4x10min, 1-2 bank): interval 2.5-3 min is optimaal
  //   → 3 wisselmomenten per kwart, maxBank 5 min, fairness 80%+
  // - Grotere teams (2x20min, 3+ bank): interval 4-6 min
  //
  const slotsNeeded = benchSize <= 2 ? 1 : 1 + (benchSize - 2);
  const usableMinutes = halfDurationMin - 2;
  const intervalMin = usableMinutes / (slotsNeeded + 1);

  // Korte kwarten (<=12 min): vaker wisselen zodat niemand een heel kwart op de bank zit
  if (halfDurationMin <= 12) {
    // Doel: minstens 3 wisselmomenten per kwart
    const targetSlots = Math.max(slotsNeeded + 1, 3);
    const shortInterval = usableMinutes / targetSlots;
    return Math.max(2, Math.floor(shortInterval));
  }

  return Math.max(2, Math.floor(intervalMin));
}

// Pivot index voor schema herberekening: vind startpunt voor recalculate
const getPivotIndex = (schedule, activeIdx) =>
  activeIdx >= 0 ? activeIdx : Math.max(-1, schedule.findIndex(s => s.status === 'pending') - 1);

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
function generateSubSchedule(playerList, keeperName, numOnField, hDuration, nHalves, sInterval, currentPlayTime = {}, excludedList = [], initialField = null, initialBench = null, keeperRotationEnabled = false, keeperQueueList = []) {
  const allActive = playerList.filter(p => !excludedList.includes(p));
  const F = numOnField;
  const D = hDuration * 60;
  const I = sInterval * 60;

  // Gebruik meegegeven field/bench of bereken initieel — dedup voor veiligheid
  const outfieldForInit = allActive.filter(p => p !== keeperName);
  let field = dedup(initialField ? [...initialField] : [keeperName, ...outfieldForInit.slice(0, F - 1)]);
  let bench = dedup(initialBench ? [...initialBench] : outfieldForInit.slice(F - 1)).filter(p => !field.includes(p));

  // Filter uitgesloten spelers
  field = field.filter(p => !excludedList.includes(p));
  bench = bench.filter(p => !excludedList.includes(p));

  const B = bench.length;
  if (B <= 0 || I <= 0) return [];

  // Aantal mogelijke wisselmomenten per helft.
  // De MIN_BEFORE_END check in de slotTimes loop filtert al te late slots,
  // dus geen extra -1 aftrekken hier.
  const slotsPerHalf = Math.max(1, Math.floor(D / I));
  const fieldSlots = F - 1; // veldplekken excl. keeper

  // Track "felt" speeltijd: veldtijd + keepertijd × 0.5
  const projected = {};
  allActive.forEach(p => { projected[p] = currentPlayTime[p] || 0; });

  // v3.31.0 — Eerlijkheid in beleving: track consecutieve bank/veld-slots
  const benchWait = {};
  const fieldStreak = {};
  allActive.forEach(p => {
    benchWait[p] = bench.includes(p) ? 1 : 0;
    fieldStreak[p] = field.includes(p) ? 1 : 0;
  });

  // Spelersvolgorde = verborgen sterkte-ranking (index 0 = sterkst)
  // Gebruikt voor spreiding: niet twee spelers uit zelfde sterkte-helft achter elkaar naar bank
  const rankOf = {};
  playerList.forEach((p, i) => { rankOf[p] = i; });
  const midRank = playerList.length / 2;
  let lastBankWasTop = null; // null = geen vorige, true = top-helft, false = bottom-helft

  const schedule = [];
  let slotId = 0;

  for (let half = 1; half <= nHalves; half++) {
    // Keeper per helft
    const halfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0)
      ? keeperQueueList[(half - 1) % keeperQueueList.length]
      : keeperName;
    const prevHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half > 1)
      ? keeperQueueList[(half - 2) % keeperQueueList.length]
      : (half > 1 ? keeperName : null);
    const nextHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half < nHalves)
      ? keeperQueueList[half % keeperQueueList.length]
      : null;

    // Keeper swap bij helft-overgang
    if (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper) {
      projected[prevHalfKeeper] = (projected[prevHalfKeeper] || 0) + D * 0.5;

      // Promote speler van bank naar veld, balanceer als veld te groot wordt
      const promoteToField = (player) => {
        if (!bench.includes(player)) return;
        bench = bench.filter(p => p !== player);
        field = [...field, player];
        if (field.length > F) {
          const canGoBench = field.filter(p => p !== halfKeeper && p !== prevHalfKeeper);
          canGoBench.sort((a, b) => (projected[b] || 0) - (projected[a] || 0));
          const leaving = canGoBench.slice(0, field.length - F);
          field = field.filter(p => !leaving.includes(p));
          bench = [...bench, ...leaving];
        }
      };

      promoteToField(halfKeeper);
      promoteToField(prevHalfKeeper);
    }

    // Grace period: ex-keeper mag niet naar bank in eerste slot van deze helft
    const gracePlayer = (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper)
      ? prevHalfKeeper : null;

    let isFirstSlotOfHalf = true;

    const slotTimes = [];
    const MIN_BEFORE_END = 120;
    // Kwartstart-wissel: als er bankspelers zijn die al lang wachten (>= 1 kwart),
    // voeg een vroeg wisselmoment toe op 30s zodat ze snel het veld in gaan
    const longWaiters = bench.filter(p => (benchWait[p] || 0) >= 2);
    if (half > 1 && longWaiters.length > 0) {
      slotTimes.push(30); // 30 seconden na kwartstart
    }
    for (let s = 1; s <= slotsPerHalf; s++) {
      const t = s * I;
      if (t <= D - MIN_BEFORE_END && t > 30) slotTimes.push(t); // skip als al op 30s
    }

    let prevSlotTime = 0;
    for (const slotTime of slotTimes) {
      const perSlot = isFirstSlotOfHalf ? Math.min(2, bench.length, fieldSlots) : 1;

      // Update projected speeltijd voor veldspelers (niet keeper)
      const delta = slotTime - prevSlotTime;
      field.filter(p => p !== halfKeeper).forEach(p => {
        projected[p] = (projected[p] || 0) + delta;
      });

      // Wie eruit: veldspelers met MEESTE speeltijd
      let eligible = field.filter(p => p !== halfKeeper);
      // Grace period: ex-keeper beschermd in eerste slot
      if (isFirstSlotOfHalf && gracePlayer && eligible.includes(gracePlayer)) {
        eligible = eligible.filter(p => p !== gracePlayer);
      }
      // Bescherm next-half keeper: niet wisselen in laatste slot voor rust
      const isLastSlot = slotTime === slotTimes[slotTimes.length - 1];
      if (isLastSlot && nextHalfKeeper && nextHalfKeeper !== halfKeeper && eligible.includes(nextHalfKeeper)) {
        eligible = eligible.filter(p => p !== nextHalfKeeper);
      }
      // Sortering: meeste speeltijd eerst, bij gelijk: langst op veld, bij gelijk: spreiding
      eligible.sort((a, b) => {
        const ptDiff = (projected[b] || 0) - (projected[a] || 0);
        if (ptDiff !== 0) return ptDiff;
        const fsDiff = (fieldStreak[b] || 0) - (fieldStreak[a] || 0);
        if (fsDiff !== 0) return fsDiff;
        // Spreiding: prefereer speler uit andere sterkte-helft dan laatste bank-speler
        if (lastBankWasTop !== null) {
          const aIsTop = (rankOf[a] || 0) < midRank;
          const bIsTop = (rankOf[b] || 0) < midRank;
          if (aIsTop !== bIsTop) {
            const preferA = lastBankWasTop ? !aIsTop : aIsTop;
            return preferA ? -1 : 1;
          }
        }
        return 0;
      });
      const goingOut = eligible.slice(0, perSlot);

      // Wie erin: bankspelers met LANGSTE WACHTTIJD eerst, bij gelijk: minste speeltijd
      const benchSorted = [...bench].sort((a, b) => {
        const waitDiff = (benchWait[b] || 0) - (benchWait[a] || 0);
        if (waitDiff !== 0) return waitDiff;
        return (projected[a] || 0) - (projected[b] || 0);
      });
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

        // Track spreiding: wie ging er als laatste naar de bank?
        const lastOut = goingOut[goingOut.length - 1];
        lastBankWasTop = (rankOf[lastOut] || 0) < midRank;

        // Update eerlijkheid-tracking
        bench.filter(p => !goingIn.includes(p)).forEach(p => { benchWait[p] = (benchWait[p] || 0) + 1; });
        field.filter(p => p !== halfKeeper && !goingOut.includes(p)).forEach(p => { fieldStreak[p] = (fieldStreak[p] || 0) + 1; });
        goingOut.forEach(p => { benchWait[p] = 1; fieldStreak[p] = 0; });
        goingIn.forEach(p => { benchWait[p] = 0; fieldStreak[p] = 1; });

        // Pas field/bench aan voor volgende slot
        field = field.filter(p => !goingOut.includes(p)).concat(goingIn);
        bench = bench.filter(p => !goingIn.includes(p)).concat(goingOut);
        isFirstSlotOfHalf = false;
      }

      prevSlotTime = slotTime;
    }

    // Einde helft: resterende speeltijd optellen
    const lastSlotTime = slotTimes.length > 0 ? slotTimes[slotTimes.length - 1] : 0;
    const remaining = D - lastSlotTime;
    field.filter(p => p !== halfKeeper).forEach(p => {
      projected[p] = (projected[p] || 0) + remaining;
    });
  }

  return schedule;
}

/**
 * Herbereken resterende wisselslots na skip/injury/edit.
 * Behoudt alle executed/skipped slots, herberekent pending slots.
 */
function recalculateRemainingSlots(schedule, fromIndex, currentField, currentBench, currentPlayTime, keeperName, hDuration, nHalves, sInterval, excluded, keeperRotationEnabled = false, keeperQueueList = []) {
  // Behoud alle slots t/m fromIndex (executed/skipped)
  const fixed = schedule.filter((s, i) => i <= fromIndex);

  // Alle actieve spelers = field + bench (keeper zit al in field) — dedup voor veiligheid
  const dedupField = dedup(currentField);
  const dedupBench = dedup(currentBench.filter(p => !dedupField.includes(p)));
  const allPlayers = [...dedupField, ...dedupBench];

  // Bepaal huidige helft uit het schema (voor correcte startpositie)
  const lastFixedSlot = fixed[fixed.length - 1];
  const currentHalf = lastFixedSlot ? lastFixedSlot.half : 1;
  const currentAbsTime = lastFixedSlot?.absoluteTime || 0;

  // Genereer schema alleen voor RESTERENDE helften (niet opnieuw van helft 1)
  // Dit voorkomt dat het schema helft 1 opnieuw simuleert met verkeerde state
  const remainingHalves = nHalves - currentHalf + 1;

  const remaining = generateSubSchedule(
    allPlayers, keeperName, dedupField.length,
    hDuration, remainingHalves, sInterval,
    currentPlayTime, excluded,
    dedupField, dedupBench,
    keeperRotationEnabled, keeperQueueList
  );

  // Corrigeer absoluteTime: schema denkt dat het bij helft 1 start,
  // maar we zijn eigenlijk bij currentHalf
  const halfOffset = (currentHalf - 1) * hDuration * 60;
  const adjustedSlots = remaining.map(s => ({
    ...s,
    half: s.half + currentHalf - 1,
    absoluteTime: s.absoluteTime + halfOffset,
  }));

  // Filter: alleen slots die NA het huidige punt vallen
  const futureSlots = adjustedSlots.filter(s => s.absoluteTime > currentAbsTime);

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
  const [keeperPlayTime, setKeeperPlayTime] = useState({}); // Keepertijd apart (voor 0.5x weging)
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
  const [homeLogo, setHomeLogo] = useState(null); // URL van clublogo thuisteam (via VoetbalAssist API)
  const [awayLogo, setAwayLogo] = useState(null); // URL van clublogo uitteam
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

  // Keeper roulatie (v3.30.0) — optionele keeper per helft
  const [keeperRotation, setKeeperRotation] = useState(false);
  const [keeperQueue, setKeeperQueue] = useState([]); // Per-helft keeper: ["Luuk", "Daan", "Morris", ...]

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
  const coachSecretRef = useRef(null); // Auth token voor write operaties
  const lastSyncTimeRef = useRef(0); // Timestamp laatste succesvolle PUT
  const isAdoptingRef = useRef(false); // Voorkom sync-loop bij adoptie server state
  const subLatencyRef = useRef(0); // Seconden latency tussen alert en coach actie
  const halfJustStartedRef = useRef(false); // Guard: skip half-end detection na helft-overgang
  const totalMatchTime = halfDuration * halves;

  // --- API Sync ---
  const getMatchSnapshot = useCallback(() => ({
    status: view === VIEWS.MATCH ? (halfBreak ? 'halftime' : isRunning ? (isPaused ? 'paused' : 'live') : 'ended') : view === VIEWS.SUMMARY ? 'ended' : 'setup',
    team,
    coachName,
    homeTeam, awayTeam, homeLogo, awayLogo,
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
    keeperPlayTime,
    subHistory,
    injuryTime,
    isRunning, isPaused, halfBreak,
    matchMode, autoSubs, formation, playerPositions, squadNumbers,
    // Keeper roulatie (v3.30.0)
    keeperRotation, keeperQueue,
    // Wisselschema sync (v3.16.0)
    subSchedule, activeSlotIndex, excludedPlayers, scheduleVersion, subsPerSlot,
    // Alert state (voor reconnect restore)
    showSubAlert, suggestedSubs,
    _coachId: coachIdRef.current,
    _updatedAt: Date.now(),
  }), [view, team, coachName, homeTeam, awayTeam, homeLogo, awayLogo, players, matchKeeper, playersOnField, halfDuration, halves, subInterval, onField, onBench, homeScore, awayScore, goalScorers, currentHalf, matchTimer, subTimer, isRunning, isPaused, halfBreak, playTime, keeperPlayTime, subHistory, injuryTime, matchMode, autoSubs, formation, playerPositions, squadNumbers, keeperRotation, keeperQueue, subSchedule, activeSlotIndex, excludedPlayers, scheduleVersion, subsPerSlot, showSubAlert, suggestedSubs]);

  const syncToServer = useCallback(() => {
    if (!isOnline || !matchCode) return;
    clearTimeout(syncTimeoutRef.current);
    // Debounce: wacht 300ms zodat snelle opeenvolgende updates worden gebundeld
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const snapshot = getMatchSnapshot();
        const headers = { 'Content-Type': 'application/json' };
        if (coachSecretRef.current) headers['X-Coach-Secret'] = coachSecretRef.current;
        const res = await fetch(`/api/match/${matchCode}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(snapshot),
        });
        if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
        setSyncError(null);
        lastSyncTimeRef.current = Date.now();
        // Flush pending events die eerder gefaald zijn
        if (pendingEventsRef.current.length > 0) {
          const pending = [...pendingEventsRef.current];
          pendingEventsRef.current = [];
          for (const ev of pending) {
            try {
              const evHeaders = { 'Content-Type': 'application/json' };
              if (coachSecretRef.current) evHeaders['X-Coach-Secret'] = coachSecretRef.current;
              await fetch(`/api/match/events/${matchCode}`, {
                method: 'POST',
                headers: evHeaders,
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
      const headers = { 'Content-Type': 'application/json' };
      if (coachSecretRef.current) headers['X-Coach-Secret'] = coachSecretRef.current;
      const res = await fetch(`/api/match/events/${matchCode}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ev),
      });
      if (!res.ok) throw new Error(`Event sync failed: ${res.status}`);
    } catch (err) {
      console.error('Event sync error:', err);
      pendingEventsRef.current.push(ev);
    }
  }, [isOnline, matchCode]);

  // --- Multi-coach sync: adopteer server state van andere coach ---
  const applyServerSnapshot = useCallback((data) => {
    isAdoptingRef.current = true;

    // Live match state — enforce invariant (voorkomt dubbele spelers)
    const { field: serverField, bench: serverBench } = enforceInvariant(
      data.onField || [], data.onBench || [], data.excludedPlayers || []
    );
    logAction('applyServerSnapshot', { fieldSize: serverField.length, benchSize: serverBench.length });
    setOnField(serverField);
    setOnBench(serverBench);
    // Keeper bescherming: als keeper niet meer op veld staat, herstel
    const snapshotKeeper = data.matchKeeper || data.keeper;
    if (snapshotKeeper && !serverField.includes(snapshotKeeper) && serverField.length > 0) {
      logAction('applyServerSnapshot_keeperRecovered', { lostKeeper: snapshotKeeper, newKeeper: serverField[0] });
    }
    setPlayTime(data.playTime || {});
    if (data.keeperPlayTime) setKeeperPlayTime(data.keeperPlayTime);
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

    // Sub alert: alleen sluiten als de server GEEN alert meer heeft
    // (andere coach heeft gewisseld of overgeslagen)
    if (showSubAlert && !data.showSubAlert) {
      setShowSubAlert(false);
      alertShownRef.current = false;
    } else if (data.showSubAlert && data.suggestedSubs) {
      // Server heeft alert: overnemen (voor reconnect en sync)
      setShowSubAlert(true);
      setSuggestedSubs(data.suggestedSubs);
      alertShownRef.current = true;
    }

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
          team, homeTeam, awayTeam, homeLogo, awayLogo, players, keeper,
          playersOnField, halfDuration, halves, subInterval,
          keeperRotation, keeperQueue,
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
      coachSecretRef.current = data.coachSecret || null;
      if (data.coachSecret) {
        try { localStorage.setItem(`dilli_secret_${data.code}`, data.coachSecret); } catch {}
      }
      return data.code;
    } catch (err) {
      console.error('Create match error:', err);
      setSyncError('Wedstrijd aanmaken mislukt');
      return null;
    }
  }, [team, homeTeam, awayTeam, homeLogo, awayLogo, players, keeper, playersOnField, halfDuration, halves, subInterval, keeperRotation, keeperQueue]);

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
    if (players.length < playersOnField) return;
    clearMatchLog(); // Fresh log voor nieuwe wedstrijd
    const init = {}; players.forEach(p => (init[p] = 0));
    // Shuffle niet-keeper spelers: eerlijke random verdeling wie op de bank begint
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    let fl, bl;
    if (keeper) { const nk = shuffle(players.filter(p => p !== keeper)); fl = [keeper, ...nk.slice(0, playersOnField - 1)]; bl = nk.slice(playersOnField - 1); }
    else { const shuffled = shuffle([...players]); fl = shuffled.slice(0, playersOnField); bl = shuffled.slice(playersOnField); }
    logAction('startMatch', { players: players.length, field: fl.length, bench: bl.length, benchStart: [...bl], keeper, halves, halfDuration });
    setOnField(fl); setOnBench(bl); setMatchKeeper(keeper);
    setPlayTime(init); setKeeperPlayTime({}); setCurrentHalf(1); setMatchTimer(0); setSubTimer(0);
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
      // Dynamisch interval: bereken vanuit helftduur en bankgrootte
      const dynamicInterval = calculateDynamicInterval(halfDuration, bl.length);
      setSubInterval(dynamicInterval);
      const schedule = generateSubSchedule(
        players, keeper, playersOnField, halfDuration, halves, dynamicInterval,
        {}, [], null, null, keeperRotation, keeperQueue
      );
      setSubSchedule(schedule);
      setActiveSlotIndex(-1);
      setExcludedPlayers([]);
      setScheduleVersion(1);
      // subsPerSlot niet meer globaal relevant — eerste slot = 2, rest = 1
      setSubsPerSlot(1);
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
          if (matchKeeper && cf.includes(matchKeeper)) {
            setKeeperPlayTime(prev => ({ ...prev, [matchKeeper]: (prev[matchKeeper] || 0) + delta }));
          }
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
    // Bij scherm-aan: meteen sync zodat server actuele timer timestamps heeft
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncToServer();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', handleVisibility); };
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
    // visibilitychange: direct pollen als scherm weer aan gaat
    // Triggert ook checkCoachPush() op server → coach krijgt push
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [isOnline, matchCode, view, applyServerSnapshot]);

  // --- AUTO-REPAIR: detecteer en fix inconsistenties elke 5 seconden ---
  useEffect(() => {
    if (view !== VIEWS.MATCH || !isRunning) return;
    const iv = setInterval(() => {
      // Check: zit een speler in BEIDE lijsten?
      const fieldSet = new Set(onField);
      const overlap = onBench.filter(p => fieldSet.has(p));
      if (overlap.length > 0) {
        logAction('autoRepair_overlap', { overlap });
        // Fix: verwijder uit bench (field heeft prioriteit)
        setOnBench(prev => prev.filter(p => !fieldSet.has(p)));
      }
      // Check: missende spelers (niet op veld, bank, of excluded)
      const allActive = players.filter(p => !excludedPlayers.includes(p));
      const accounted = new Set([...onField, ...onBench]);
      const missing = allActive.filter(p => !accounted.has(p));
      if (missing.length > 0) {
        logAction('autoRepair_missing', { missing });
        setOnBench(prev => [...prev, ...missing]);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [view, isRunning, onField, onBench, players, excludedPlayers]);

  // Memoize: index van volgende pending slot (voorkomt array scan elke seconde)
  const nextPendingSlotIdx = useMemo(() => subSchedule.findIndex(s => s.status === 'pending'), [subSchedule]);

  // Half end + sub alert detection
  useEffect(() => {
    if (!isRunning || isPaused || halfBreak) return;
    // Guard: skip detection direct na helft-overgang (voorkom valse triggers)
    if (halfJustStartedRef.current) {
      halfJustStartedRef.current = false;
      return;
    }
    const hs = halfDuration * 60;
    const he = getHalfElapsed(matchTimer, currentHalf, halfDuration);
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
    // Geen wisseladvies in laatste 2 minuten van helft + alleen als er pending slots zijn
    const remainingInHalf = hs - he;
    if (autoSubs && subTimer >= subInterval * 60 && !alertShownRef.current && onBench.length > 0 && remainingInHalf >= 120 && nextPendingSlotIdx >= 0) {
      alertShownRef.current = true;
      subLatencyRef.current = subTimer - (subInterval * 60);
      setActiveSlotIndex(nextPendingSlotIdx);
      setSuggestedSubs(calculateSubs(onField, onBench, playTime, matchKeeper));
      setShowSubAlert(true);
      notifySub();
    }
  }, [matchTimer, subTimer, isRunning, isPaused, halfBreak, currentHalf, halves, halfDuration, subInterval, onField, onBench, playTime, calculateSubs, matchKeeper, nextPendingSlotIdx]);

  const executeSubs = () => {
    let { out, inn } = suggestedSubs;
    // Guard: voorkom stille no-op als suggestedSubs leeg is (race condition met multi-coach sync)
    if (out.length === 0 || inn.length === 0) {
      setShowSubAlert(false);
      alertShownRef.current = false;
      return;
    }
    // KEEPER BESCHERMING: keeper mag nooit via auto-wissel van het veld
    if (matchKeeper && out.includes(matchKeeper)) {
      logAction('executeSubs_keeperProtected', { removedFromOut: matchKeeper });
      out = out.filter(p => p !== matchKeeper);
      inn = inn.slice(0, out.length); // Houd paren gelijk
      if (out.length === 0 || inn.length === 0) {
        setShowSubAlert(false);
        alertShownRef.current = false;
        return;
      }
    }
    // Atomic state update met invariant enforcement
    const newField = onField.filter(p => !out.includes(p)).concat(inn);
    const newBench = onBench.filter(p => !inn.includes(p)).concat(out);
    const { field: safeField, bench: safeBench } = enforceInvariant(newField, newBench, excludedPlayers);
    logAction('executeSubs', { out, inn, fieldBefore: onField.length, fieldAfter: safeField.length });
    setOnField(safeField);
    setOnBench(safeBench);
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
          const newField = dedup(onField.filter(p => !out.includes(p) && !inn.includes(p)).concat(inn));
          const newBench = dedup(onBench.filter(p => !inn.includes(p) && !out.includes(p)).concat(out));
          const recalc = recalculateRemainingSlots(
            updated, activeSlotIndex, newField, newBench, playTime,
            matchKeeper, halfDuration, halves, subInterval, excludedPlayers,
            keeperRotation, keeperQueue
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
    syncToServer();
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
          matchKeeper, halfDuration, halves, subInterval, excludedPlayers,
          keeperRotation, keeperQueue
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

  const returnPlayerFromExclusion = (player) => {
    const newExcluded = excludedPlayers.filter(p => p !== player);
    const newBench = [...onBench, player];
    const { field: safeField, bench: safeBench } = enforceInvariant(onField, newBench, newExcluded);
    logAction('returnPlayerFromExclusion', { player, fieldSize: safeField.length, benchSize: safeBench.length });
    setOnField(safeField);
    setOnBench(safeBench);
    setExcludedPlayers(newExcluded);
    const newInterval = calculateDynamicInterval(halfDuration, safeBench.length);
    setSubInterval(newInterval);
    setSubSchedule(prev => {
      const recalc = recalculateRemainingSlots(
        prev, getPivotIndex(prev, activeSlotIndex),
        safeField, safeBench, playTime, matchKeeper, halfDuration, halves, newInterval, newExcluded,
        keeperRotation, keeperQueue
      );
      setScheduleVersion(v => v + 1);
      return recalc;
    });
    syncToServer();
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
        const sorted = [...newBench].filter(p => !newField.includes(p)).sort((a, b) => (playTime[a] || 0) - (playTime[b] || 0));
        const replacement = sorted[0];
        if (replacement) {
          newField.push(replacement);
          newBench = newBench.filter(p => p !== replacement);
          setSubHistory(h => [...h, { time: fmt(matchTimer), half: currentHalf, out: [player], inn: [replacement], injury: true }]);
          addEvent({ type: 'injury_sub', time: fmt(matchTimer), half: currentHalf, out: player, inn: replacement });
        } else {
          addEvent({ type: 'injury_no_sub', time: fmt(matchTimer), half: currentHalf, out: player });
        }
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

    const { field: safeField, bench: safeBench } = enforceInvariant(newField, newBench, newExcluded);
    logAction('excludePlayer', { player, wasOnField, fieldSize: safeField.length, benchSize: safeBench.length });
    setOnField(safeField);
    setOnBench(safeBench);
    setExcludedPlayers(newExcluded);

    // Bug Fix: als geen bankspelers meer → sluit alert en leeg schema
    if (safeBench.length === 0) {
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

    // Schema herberekenen met nieuwe speler-pool + dynamisch interval herberekenen
    const newInterval = calculateDynamicInterval(halfDuration, safeBench.length);
    setSubInterval(newInterval);
    setSubSchedule(prev => {
      const recalc = recalculateRemainingSlots(
        prev, getPivotIndex(prev, activeSlotIndex),
        safeField, safeBench, playTime, newKeeper, halfDuration, halves, newInterval, newExcluded,
        keeperRotation, keeperQueue
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
    // BOUNDS CHECK: voorkom dat we voorbij het aantal helften gaan
    if (currentHalf >= halves) {
      logAction('startNextHalf_blocked', { currentHalf, halves });
      return;
    }
    const nextHalf = currentHalf + 1;
    logAction('startNextHalf', { from: currentHalf, to: nextHalf });
    // Snap timer naar helftgrens: voorkom dat overgeschoten blessuretijd
    // de half-end detection triggert voor de nieuwe helft
    const expectedStart = currentHalf * halfDuration * 60;
    if (matchTimer > expectedStart) {
      setMatchTimer(expectedStart);
      matchTimerRef.current = expectedStart;
    }
    halfJustStartedRef.current = true;
    setCurrentHalf(nextHalf);
    setHalfBreak(false);
    setInjuryTime(false);
    setSubTimer(0);
    alertShownRef.current = false;
    subLatencyRef.current = 0;

    // Keeper roulatie: auto-swap keeper bij helft-overgang
    let activeKeeper = matchKeeper;
    if (keeperRotation && keeperQueue.length > 0) {
      const nextKeeper = keeperQueue[(nextHalf - 1) % keeperQueue.length];
      // Alleen swappen als volgende keeper beschikbaar is (niet uitgevallen)
      if (nextKeeper && nextKeeper !== matchKeeper && !excludedPlayers.includes(nextKeeper)) {
        const isOnFieldNow = onField.includes(nextKeeper);
        const isOnBenchNow = onBench.includes(nextKeeper);
        if (isOnFieldNow) {
          // Veldspeler → keeper: alleen rol-swap, geen fysieke wissel
          setMatchKeeper(nextKeeper);
          activeKeeper = nextKeeper;
          setSubHistory(h => [...h, { time: fmt(matchTimer), half: nextHalf, keeperChange: true, newKeeper: nextKeeper }]);
          addEvent({ type: 'keeper_rotation', time: fmt(matchTimer), half: nextHalf, newKeeper: nextKeeper });
        } else if (isOnBenchNow) {
          // Bankspeler → keeper: fysieke wissel met huidige keeper
          const oldKeeper = matchKeeper;
          const newFieldArr = onField.map(p => p === oldKeeper ? nextKeeper : p);
          const newBenchArr = onBench.map(p => p === nextKeeper ? oldKeeper : p);
          const { field: safeField, bench: safeBench } = enforceInvariant(newFieldArr, newBenchArr, excludedPlayers);
          setOnField(safeField);
          setOnBench(safeBench);
          setMatchKeeper(nextKeeper);
          activeKeeper = nextKeeper;
          logAction('keeperRotation_swap', { oldKeeper, nextKeeper });
          // Positie overnemen
          if (playersOnField >= 7) {
            setPlayerPositions(prev => {
              const n = { ...prev };
              if (n[oldKeeper]) { n[nextKeeper] = { ...n[oldKeeper] }; delete n[oldKeeper]; }
              return n;
            });
          }
          setSubHistory(h => [...h, { time: fmt(matchTimer), half: nextHalf, out: [oldKeeper], inn: [nextKeeper], keeperChange: true, newKeeper: nextKeeper }]);
          addEvent({ type: 'keeper_rotation', time: fmt(matchTimer), half: nextHalf, newKeeper: nextKeeper, swappedOut: oldKeeper });
        }
      }
    }

    addEvent({ type: 'half_start', time: fmt(matchTimer), half: nextHalf });
    // Dynamisch interval herberekenen (bankgrootte kan gewijzigd zijn door keeper swap)
    if (autoSubs && onBench.length > 0) {
      const newInterval = calculateDynamicInterval(halfDuration, onBench.length);
      setSubInterval(newInterval);
    }
    // Wissel-alert komt automatisch via timer detection (subTimer start op 0)
  };

  const manualSub = (fp, bp) => {
    // Validatie: speler moet daadwerkelijk op veld resp. bank staan
    if (!onField.includes(fp) || !onBench.includes(bp)) {
      logAction('manualSub_blocked', { fp, bp, fpOnField: onField.includes(fp), bpOnBench: onBench.includes(bp) });
      return;
    }
    const wasKeeper = fp === matchKeeper;
    // Bij keeper wissel: nieuw speler erft keeper-rol (niet naar bank sturen!)
    // Dit is correct gedrag — keeper draagt rol over aan inkomende speler
    const newFieldArr = onField.map(p => (p === fp ? bp : p));
    const newBenchArr = onBench.map(p => (p === bp ? fp : p));
    const { field: safeField, bench: safeBench } = enforceInvariant(newFieldArr, newBenchArr, excludedPlayers);
    logAction('manualSub', { out: fp, inn: bp });
    setOnField(safeField);
    setOnBench(safeBench);
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
      const newFieldArr = onField.map(p => (p === oldKeeper ? newKeeper : p));
      const newBenchArr = onBench.map(p => (p === newKeeper ? oldKeeper : p));
      const { field: safeField, bench: safeBench } = enforceInvariant(newFieldArr, newBenchArr, excludedPlayers);
      logAction('swapKeeper', { oldKeeper, newKeeper, fromBench: true });
      setOnField(safeField);
      setOnBench(safeBench);
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
        const recalc = recalculateRemainingSlots(
          prev, getPivotIndex(prev, activeSlotIndex), newField, newBench, playTime, newKeeper, halfDuration, halves, subInterval, excludedPlayers
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
      // Stuur coach-code mee zodat de server de coachSecret kan teruggeven
      const headers = {};
      try {
        const saved = JSON.parse(localStorage.getItem('dilli_coach') || '{}');
        if (saved.code) headers['X-Coach-Code'] = saved.code;
      } catch { /* ignore */ }

      const res = await fetch(`/api/match/${code}`, { headers });
      if (!res.ok) {
        console.error('Reconnect failed:', res.status, res.statusText, 'for code:', code);
        return false;
      }
      const data = await res.json();

      // CoachSecret: gebruik server response (als coach-code geldig was) of localStorage
      if (data.coachSecret) {
        coachSecretRef.current = data.coachSecret;
        try { localStorage.setItem(`dilli_secret_${code}`, data.coachSecret); } catch {}
      } else {
        // Fallback: probeer uit localStorage (van eerdere sessie)
        try {
          const stored = localStorage.getItem(`dilli_secret_${code}`);
          if (stored) coachSecretRef.current = stored;
        } catch {}
      }

      // Setup state (niet in applyServerSnapshot)
      setMatchCode(code);
      setIsOnline(true);
      setTeam(data.team || '');
      setHomeTeam(data.homeTeam || 'Dilettant');
      setAwayTeam(data.awayTeam || '');
      setHomeLogo(data.homeLogo || null);
      setAwayLogo(data.awayLogo || null);
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
      setKeeperRotation(data.keeperRotation || false);
      setKeeperQueue(data.keeperQueue || []);

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

  // --- STATE REPAIR: herstel consistentie wanneer state corrupt is ---
  const repairState = useCallback(() => {
    const allActive = players.filter(p => !excludedPlayers.includes(p));
    const { field: safeField, bench: safeBench } = enforceInvariant(onField, onBench, excludedPlayers);

    // Check of er spelers missen (niet op veld, niet op bank, niet excluded)
    const accounted = new Set([...safeField, ...safeBench, ...excludedPlayers]);
    const missing = allActive.filter(p => !accounted.has(p));

    // Missende spelers naar de bank
    const finalBench = [...safeBench, ...missing];

    // Check of veld te veel spelers heeft
    let finalField = safeField;
    if (safeField.length > playersOnField) {
      // Overtollige spelers naar bank (keeper beschermd)
      const excess = safeField.filter(p => p !== matchKeeper).slice(playersOnField - 1);
      finalField = safeField.filter(p => !excess.includes(p));
      finalBench.push(...excess);
    }

    logAction('repairState', {
      hadDuplicates: safeField.length !== onField.length || safeBench.length !== onBench.length,
      missingPlayers: missing,
      fieldBefore: onField.length, fieldAfter: finalField.length,
      benchBefore: onBench.length, benchAfter: finalBench.length,
    });

    setOnField(finalField);
    setOnBench(finalBench);
    addEvent({ type: 'state_repair', time: fmt(matchTimer), half: currentHalf });
    syncToServer();
    return { repaired: true, fixed: missing.length > 0 || safeField.length !== onField.length };
  }, [players, excludedPlayers, onField, onBench, playersOnField, matchKeeper, matchTimer, currentHalf, addEvent, syncToServer]);

  // Wedstrijd definitief beëindigen → naar samenvatting
  const finalizeMatch = useCallback(() => {
    setPendingEnd(false);
    setView(VIEWS.SUMMARY);
  }, []);

  // Wedstrijd opslaan in team historie (inclusief debug log)
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
            excludedPlayers, players, halves, halfDuration,
            matchLog: getMatchLog(),
          },
        }),
      });
      const data = await res.json();
      return data.ok || false;
    } catch {
      return false;
    }
  }, [team, homeTeam, awayTeam, homeScore, awayScore, playTime, goalScorers, subHistory, events, excludedPlayers, players, halves, halfDuration]);

  return {
    // Setup state
    players, setPlayers, keeper, setKeeper, newPlayer, setNewPlayer,
    playersOnField, setPlayersOnField, halfDuration, setHalfDuration,
    halves, setHalves, subInterval, setSubInterval,
    homeTeam, setHomeTeam, awayTeam, setAwayTeam,
    homeLogo, setHomeLogo, awayLogo, setAwayLogo,
    team, setTeam,
    // Match state
    view, setView, onField, onBench, playTime, keeperPlayTime, currentHalf,
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
    // Keeper roulatie (v3.30.0)
    keeperRotation, setKeeperRotation, keeperQueue, setKeeperQueue,
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
    startMatch, startTimer, executeSubs, skipSubs, editSubProposal, excludePlayer, returnPlayerFromExclusion, forceEndHalf, startNextHalf,
    manualSub, swapKeeper, setIsRunning, calculateSubs,
    // Repair + Debug
    repairState,
  };
}
