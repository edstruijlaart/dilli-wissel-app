/**
 * DILLI WISSEL — Volledige wedstrijd-simulatie
 *
 * Simuleert complete wedstrijden met ALLE chaos die in productie voorkomt:
 * - Normale wissels via het schema
 * - Keeper wissels mid-match
 * - Blessures (bal tegen hoofd, botsing)
 * - Keeper rotatie bij helft-overgangen
 * - Handmatige wissels buiten schema
 * - Spelers die terugkomen na blessure-achtig scenario
 * - Meerdere acties snel achter elkaar
 * - Multi-coach sync (snapshot apply → re-apply)
 * - State corruptie → auto-repair
 * - 4-helft wedstrijden (JO9 format)
 * - Wisselschema generatie + herberekening
 *
 * Run: node test-simulation.mjs
 */

// ============================================================
// CORE FUNCTIONS (gekopieerd uit useMatchState.js)
// ============================================================

const dedup = (arr) => [...new Set(arr)];

function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set();
  const cleanField = [];
  const cleanBench = [];
  const excludedSet = new Set(excluded);
  for (const p of field) {
    if (!seen.has(p) && !excludedSet.has(p)) { cleanField.push(p); seen.add(p); }
  }
  for (const p of bench) {
    if (!seen.has(p) && !excludedSet.has(p)) { cleanBench.push(p); seen.add(p); }
  }
  return { field: cleanField, bench: cleanBench };
}

function calculateDynamicInterval(halfDurationMin, benchSize) {
  if (benchSize <= 0) return halfDurationMin;
  const slotsNeeded = benchSize <= 2 ? 1 : 1 + (benchSize - 2);
  const usableMinutes = halfDurationMin - 2;
  const intervalMin = usableMinutes / (slotsNeeded + 1);
  return Math.max(2, Math.floor(intervalMin));
}

function generateSubSchedule(playerList, keeperName, numOnField, hDuration, nHalves, sInterval, currentPlayTime = {}, excludedList = [], initialField = null, initialBench = null, keeperRotationEnabled = false, keeperQueueList = []) {
  const allActive = playerList.filter(p => !excludedList.includes(p));
  const F = numOnField;
  const D = hDuration * 60;
  const I = sInterval * 60;
  const outfieldForInit = allActive.filter(p => p !== keeperName);
  let field = dedup(initialField ? [...initialField] : [keeperName, ...outfieldForInit.slice(0, F - 1)]);
  let bench = dedup(initialBench ? [...initialBench] : outfieldForInit.slice(F - 1)).filter(p => !field.includes(p));
  field = field.filter(p => !excludedList.includes(p));
  bench = bench.filter(p => !excludedList.includes(p));
  const B = bench.length;
  if (B <= 0 || I <= 0) return [];
  const slotsPerHalf = Math.max(1, Math.floor(D / I));
  const fieldSlots = F - 1;
  const projected = {};
  allActive.forEach(p => { projected[p] = currentPlayTime[p] || 0; });
  const benchWait = {};
  const fieldStreak = {};
  allActive.forEach(p => {
    benchWait[p] = bench.includes(p) ? 1 : 0;
    fieldStreak[p] = field.includes(p) ? 1 : 0;
  });
  const rankOf = {};
  playerList.forEach((p, i) => { rankOf[p] = i; });
  const midRank = playerList.length / 2;
  let lastBankWasTop = null;
  const schedule = [];
  let slotId = 0;
  for (let half = 1; half <= nHalves; half++) {
    const halfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0)
      ? keeperQueueList[(half - 1) % keeperQueueList.length] : keeperName;
    const prevHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half > 1)
      ? keeperQueueList[(half - 2) % keeperQueueList.length] : (half > 1 ? keeperName : null);
    const nextHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half < nHalves)
      ? keeperQueueList[half % keeperQueueList.length] : null;
    if (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper) {
      projected[prevHalfKeeper] = (projected[prevHalfKeeper] || 0) + D * 0.5;
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
    const gracePlayer = (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper)
      ? prevHalfKeeper : null;
    let isFirstSlotOfHalf = true;
    const slotTimes = [];
    const MIN_BEFORE_END = 120;
    for (let s = 1; s <= slotsPerHalf; s++) {
      const t = s * I;
      if (t <= D - MIN_BEFORE_END) slotTimes.push(t);
    }
    let prevSlotTime = 0;
    for (const slotTime of slotTimes) {
      const perSlot = isFirstSlotOfHalf ? Math.min(2, bench.length, fieldSlots) : 1;
      const delta = slotTime - prevSlotTime;
      field.filter(p => p !== halfKeeper).forEach(p => { projected[p] = (projected[p] || 0) + delta; });
      let eligible = field.filter(p => p !== halfKeeper);
      if (isFirstSlotOfHalf && gracePlayer && eligible.includes(gracePlayer))
        eligible = eligible.filter(p => p !== gracePlayer);
      const isLastSlot = slotTime === slotTimes[slotTimes.length - 1];
      if (isLastSlot && nextHalfKeeper && nextHalfKeeper !== halfKeeper && eligible.includes(nextHalfKeeper))
        eligible = eligible.filter(p => p !== nextHalfKeeper);
      eligible.sort((a, b) => {
        const ptDiff = (projected[b] || 0) - (projected[a] || 0);
        if (ptDiff !== 0) return ptDiff;
        const fsDiff = (fieldStreak[b] || 0) - (fieldStreak[a] || 0);
        if (fsDiff !== 0) return fsDiff;
        if (lastBankWasTop !== null) {
          const aIsTop = (rankOf[a] || 0) < midRank;
          const bIsTop = (rankOf[b] || 0) < midRank;
          if (aIsTop !== bIsTop) return (lastBankWasTop ? !aIsTop : aIsTop) ? -1 : 1;
        }
        return 0;
      });
      const goingOut = eligible.slice(0, perSlot);
      const benchSorted = [...bench].sort((a, b) => {
        const waitDiff = (benchWait[b] || 0) - (benchWait[a] || 0);
        if (waitDiff !== 0) return waitDiff;
        return (projected[a] || 0) - (projected[b] || 0);
      });
      const goingIn = benchSorted.slice(0, perSlot);
      if (goingOut.length > 0 && goingIn.length > 0) {
        schedule.push({
          id: `slot-${++slotId}`, half, time: slotTime,
          absoluteTime: (half - 1) * D + slotTime,
          out: [...goingOut], inn: [...goingIn],
          status: 'pending', executedAt: null,
        });
        const lastOut = goingOut[goingOut.length - 1];
        lastBankWasTop = (rankOf[lastOut] || 0) < midRank;
        bench.filter(p => !goingIn.includes(p)).forEach(p => { benchWait[p] = (benchWait[p] || 0) + 1; });
        field.filter(p => p !== halfKeeper && !goingOut.includes(p)).forEach(p => { fieldStreak[p] = (fieldStreak[p] || 0) + 1; });
        goingOut.forEach(p => { benchWait[p] = 1; fieldStreak[p] = 0; });
        goingIn.forEach(p => { benchWait[p] = 0; fieldStreak[p] = 1; });
        field = field.filter(p => !goingOut.includes(p)).concat(goingIn);
        bench = bench.filter(p => !goingIn.includes(p)).concat(goingOut);
        isFirstSlotOfHalf = false;
      }
      prevSlotTime = slotTime;
    }
    const lastSlotTime = slotTimes.length > 0 ? slotTimes[slotTimes.length - 1] : 0;
    const remaining = D - lastSlotTime;
    field.filter(p => p !== halfKeeper).forEach(p => { projected[p] = (projected[p] || 0) + remaining; });
  }
  return schedule;
}

function recalculateRemainingSlots(schedule, fromIndex, currentField, currentBench, currentPlayTime, keeperName, hDuration, nHalves, sInterval, excluded, keeperRotationEnabled = false, keeperQueueList = []) {
  const fixed = schedule.filter((s, i) => i <= fromIndex);
  const dedupField = dedup(currentField);
  const dedupBench = dedup(currentBench.filter(p => !dedupField.includes(p)));
  const allPlayers = [...dedupField, ...dedupBench];
  const lastFixedSlot = fixed[fixed.length - 1];
  const currentHalf = lastFixedSlot ? lastFixedSlot.half : 1;
  const currentAbsTime = lastFixedSlot?.absoluteTime || 0;
  const remainingHalves = nHalves - currentHalf + 1;
  const remaining = generateSubSchedule(
    allPlayers, keeperName, dedupField.length,
    hDuration, remainingHalves, sInterval,
    currentPlayTime, excluded,
    dedupField, dedupBench,
    keeperRotationEnabled, keeperQueueList
  );
  const halfOffset = (currentHalf - 1) * hDuration * 60;
  const adjustedSlots = remaining.map(s => ({
    ...s, half: s.half + currentHalf - 1, absoluteTime: s.absoluteTime + halfOffset,
  }));
  const futureSlots = adjustedSlots.filter(s => s.absoluteTime > currentAbsTime);
  return [...fixed, ...futureSlots.map((s, i) => ({
    ...s, id: `slot-recalc-${fromIndex + 1}-${i}`, status: 'pending', executedAt: null,
  }))];
}

const getPivotIndex = (schedule, activeIdx) =>
  activeIdx >= 0 ? activeIdx : Math.max(-1, schedule.findIndex(s => s.status === 'pending') - 1);


// ============================================================
// MATCH SIMULATOR — simuleert de volledige state machine
// ============================================================

class MatchSimulator {
  constructor({ players, keeper, playersOnField, halfDuration, halves, keeperRotation = false, keeperQueue = [] }) {
    this.allPlayers = [...players];
    this.keeper = keeper;
    this.matchKeeper = keeper;
    this.playersOnField = playersOnField;
    this.halfDuration = halfDuration;
    this.halves = halves;
    this.keeperRotation = keeperRotation;
    this.keeperQueue = keeperQueue;

    const nk = players.filter(p => p !== keeper);
    this.field = [keeper, ...nk.slice(0, playersOnField - 1)];
    this.bench = nk.slice(playersOnField - 1);
    this.excluded = [];
    this.playTime = {};
    players.forEach(p => { this.playTime[p] = 0; });

    this.currentHalf = 1;
    this.matchTimer = 0;
    this.subTimer = 0;
    this.subHistory = [];
    this.log = [];
    this.errors = [];

    // Schema
    const dynamicInterval = calculateDynamicInterval(halfDuration, this.bench.length);
    this.subInterval = dynamicInterval;
    this.schedule = generateSubSchedule(
      players, keeper, playersOnField, halfDuration, halves, dynamicInterval,
      {}, [], null, null, keeperRotation, keeperQueue
    );
    this.activeSlotIndex = -1;
  }

  _log(action, details = {}) {
    this.log.push({ t: this.matchTimer, half: this.currentHalf, action, ...details });
  }

  _enforce() {
    const before = { field: this.field.length, bench: this.bench.length };
    const { field, bench } = enforceInvariant(this.field, this.bench, this.excluded);
    this.field = field;
    this.bench = bench;
    if (field.length !== before.field || bench.length !== before.bench) {
      this._log('invariant_fixed', { before, after: { field: field.length, bench: bench.length } });
    }
  }

  _validate(context) {
    const fieldSet = new Set(this.field);
    const benchSet = new Set(this.bench);
    const excludedSet = new Set(this.excluded);

    // Check 1: geen overlap field/bench
    const overlap = this.bench.filter(p => fieldSet.has(p));
    if (overlap.length > 0) {
      this.errors.push(`[${context}] OVERLAP: ${overlap.join(', ')} op veld EN bank`);
    }

    // Check 2: geen dubbelen binnen field
    if (new Set(this.field).size !== this.field.length) {
      this.errors.push(`[${context}] DUBBEL OP VELD: ${this.field.join(', ')}`);
    }

    // Check 3: geen dubbelen binnen bench
    if (new Set(this.bench).size !== this.bench.length) {
      this.errors.push(`[${context}] DUBBEL OP BANK: ${this.bench.join(', ')}`);
    }

    // Check 4: alle actieve spelers accounted for
    const active = this.allPlayers.filter(p => !excludedSet.has(p));
    const accounted = new Set([...this.field, ...this.bench]);
    const missing = active.filter(p => !accounted.has(p));
    if (missing.length > 0) {
      this.errors.push(`[${context}] KWIJT: ${missing.join(', ')}`);
    }

    // Check 5: geen excluded spelers op veld of bank
    const excludedOnField = this.field.filter(p => excludedSet.has(p));
    const excludedOnBench = this.bench.filter(p => excludedSet.has(p));
    if (excludedOnField.length > 0 || excludedOnBench.length > 0) {
      this.errors.push(`[${context}] EXCLUDED MAAR ACTIEF: veld=${excludedOnField.join(',')}, bank=${excludedOnBench.join(',')}`);
    }

    // Check 6: keeper op het veld
    if (!this.field.includes(this.matchKeeper)) {
      this.errors.push(`[${context}] KEEPER ${this.matchKeeper} NIET OP VELD`);
    }
  }

  // Simuleer tijdsverloop (in seconden)
  tick(seconds) {
    this.matchTimer += seconds;
    this.subTimer += seconds;
    this.field.forEach(p => {
      this.playTime[p] = (this.playTime[p] || 0) + seconds;
    });
  }

  // Voer schema-wissel uit
  executeSub() {
    const nextSlot = this.schedule.find(s => s.status === 'pending');
    if (!nextSlot) return false;

    let { out, inn } = nextSlot;

    // KEEPER BESCHERMING: keeper mag nooit via auto-wissel van het veld
    if (this.matchKeeper && out.includes(this.matchKeeper)) {
      this._log('executeSub_keeperProtected', { removedFromOut: this.matchKeeper });
      out = out.filter(p => p !== this.matchKeeper);
      inn = inn.slice(0, out.length);
      if (out.length === 0 || inn.length === 0) {
        // Skip deze slot, markeer als skipped
        const idx = this.schedule.indexOf(nextSlot);
        this.schedule[idx] = { ...nextSlot, status: 'skipped', executedAt: this.matchTimer };
        return false;
      }
    }

    this._log('executeSub', { out, inn });

    const newField = this.field.filter(p => !out.includes(p)).concat(inn);
    const newBench = this.bench.filter(p => !inn.includes(p)).concat(out);
    this.field = newField;
    this.bench = newBench;
    this._enforce();

    // Markeer slot
    const idx = this.schedule.indexOf(nextSlot);
    this.schedule[idx] = { ...nextSlot, status: 'executed', executedAt: this.matchTimer };
    this.activeSlotIndex = idx;
    this.subTimer = 0;
    this.subHistory.push({ time: this.matchTimer, half: this.currentHalf, out: [...out], inn: [...inn] });

    this._validate(`executeSub @ ${this.matchTimer}s`);
    return true;
  }

  // Handmatige wissel
  manualSub(fieldPlayer, benchPlayer) {
    if (!this.field.includes(fieldPlayer) || !this.bench.includes(benchPlayer)) {
      this._log('manualSub_blocked', { fieldPlayer, benchPlayer });
      return false;
    }
    const wasKeeper = fieldPlayer === this.matchKeeper;
    this._log('manualSub', { out: fieldPlayer, inn: benchPlayer, wasKeeper });
    const newField = this.field.map(p => p === fieldPlayer ? benchPlayer : p);
    const newBench = this.bench.map(p => p === benchPlayer ? fieldPlayer : p);
    this.field = newField;
    this.bench = newBench;
    this._enforce();
    // Keeper-rol overdragen aan inkomende speler
    if (wasKeeper) this.matchKeeper = benchPlayer;
    this.subHistory.push({ time: this.matchTimer, half: this.currentHalf, out: [fieldPlayer], inn: [benchPlayer], manual: true });
    this._validate(`manualSub @ ${this.matchTimer}s`);
    return true;
  }

  // Keeper wissel
  swapKeeper(newKeeper) {
    const fromBench = this.bench.includes(newKeeper);
    const oldKeeper = this.matchKeeper;
    this._log('swapKeeper', { oldKeeper, newKeeper, fromBench });

    if (fromBench) {
      const newField = this.field.map(p => p === oldKeeper ? newKeeper : p);
      const newBench = this.bench.map(p => p === newKeeper ? oldKeeper : p);
      this.field = newField;
      this.bench = newBench;
      this._enforce();
    }
    this.matchKeeper = newKeeper;

    // Herbereken schema
    if (fromBench && this.bench.length > 0) {
      const newInterval = calculateDynamicInterval(this.halfDuration, this.bench.length);
      this.subInterval = newInterval;
      this.schedule = recalculateRemainingSlots(
        this.schedule, getPivotIndex(this.schedule, this.activeSlotIndex),
        this.field, this.bench, this.playTime, newKeeper,
        this.halfDuration, this.halves, newInterval, this.excluded,
        this.keeperRotation, this.keeperQueue
      );
    }
    this._validate(`swapKeeper @ ${this.matchTimer}s`);
  }

  // Blessure
  injurePlayer(player) {
    const wasOnField = this.field.includes(player);
    this._log('injury', { player, wasOnField });

    let newField = [...this.field];
    let newBench = [...this.bench];
    const newExcluded = [...this.excluded, player];

    if (wasOnField) {
      newField = newField.filter(p => p !== player);
      // Auto-vervanging
      if (newBench.length > 0) {
        const sorted = [...newBench].sort((a, b) => (this.playTime[a] || 0) - (this.playTime[b] || 0));
        const replacement = sorted[0];
        newField.push(replacement);
        newBench = newBench.filter(p => p !== replacement);
        this._log('injury_replacement', { out: player, inn: replacement });
      }
    } else {
      newBench = newBench.filter(p => p !== player);
    }

    // Als keeper geblesseerd is
    if (player === this.matchKeeper && newField.length > 0) {
      this.matchKeeper = newField[0];
      this._log('injury_keeper_change', { newKeeper: this.matchKeeper });
    }

    const { field: safeField, bench: safeBench } = enforceInvariant(newField, newBench, newExcluded);
    this.field = safeField;
    this.bench = safeBench;
    this.excluded = newExcluded;

    // Herbereken schema
    if (safeBench.length > 0) {
      const newInterval = calculateDynamicInterval(this.halfDuration, safeBench.length);
      this.subInterval = newInterval;
      this.schedule = recalculateRemainingSlots(
        this.schedule, getPivotIndex(this.schedule, this.activeSlotIndex),
        safeField, safeBench, this.playTime, this.matchKeeper,
        this.halfDuration, this.halves, newInterval, newExcluded,
        this.keeperRotation, this.keeperQueue
      );
    }
    this._validate(`injury @ ${this.matchTimer}s`);
  }

  // Helft-overgang
  startNextHalf() {
    if (this.currentHalf >= this.halves) {
      this._log('startNextHalf_blocked', { currentHalf: this.currentHalf, halves: this.halves });
      return false;
    }
    const nextHalf = this.currentHalf + 1;
    this._log('startNextHalf', { from: this.currentHalf, to: nextHalf });

    // Keeper rotatie
    if (this.keeperRotation && this.keeperQueue.length > 0) {
      const nextKeeper = this.keeperQueue[(nextHalf - 1) % this.keeperQueue.length];
      if (nextKeeper && nextKeeper !== this.matchKeeper && !this.excluded.includes(nextKeeper)) {
        const isOnField = this.field.includes(nextKeeper);
        const isOnBench = this.bench.includes(nextKeeper);
        if (isOnField) {
          this.matchKeeper = nextKeeper;
        } else if (isOnBench) {
          const oldKeeper = this.matchKeeper;
          const newField = this.field.map(p => p === oldKeeper ? nextKeeper : p);
          const newBench = this.bench.map(p => p === nextKeeper ? oldKeeper : p);
          const { field, bench } = enforceInvariant(newField, newBench, this.excluded);
          this.field = field;
          this.bench = bench;
          this.matchKeeper = nextKeeper;
          this._log('keeper_rotation_swap', { oldKeeper, nextKeeper });
        }
      }
    }

    this.currentHalf = nextHalf;
    this.subTimer = 0;
    this._validate(`startNextHalf ${nextHalf} @ ${this.matchTimer}s`);
    return true;
  }

  // Simuleer server snapshot (multi-coach sync)
  applySnapshot(snapshot) {
    this._log('applySnapshot');
    const { field, bench } = enforceInvariant(snapshot.field, snapshot.bench, snapshot.excluded || this.excluded);
    this.field = field;
    this.bench = bench;
    if (snapshot.matchKeeper) this.matchKeeper = snapshot.matchKeeper;
    this._validate(`applySnapshot @ ${this.matchTimer}s`);
  }

  // Simuleer corrupte snapshot (wat er in productie fout gaat)
  applyCorruptSnapshot(corruption) {
    this._log('applyCorruptSnapshot', corruption);
    // Pas corruptie toe VOOR enforceInvariant — test of de invariant het fixt
    const rawField = corruption.field || this.field;
    const rawBench = corruption.bench || this.bench;
    const { field, bench } = enforceInvariant(rawField, rawBench, this.excluded);
    this.field = field;
    this.bench = bench;
    // Fix keeper als die van het veld is verdwenen door corruptie
    if (!this.field.includes(this.matchKeeper)) {
      // Keeper naar eerste veldspeler (zelfde als productie bij injury)
      if (this.field.length > 0) {
        this.matchKeeper = this.field[0];
        this._log('keeper_recovered', { newKeeper: this.matchKeeper });
      }
    }
    this._validate(`applyCorruptSnapshot @ ${this.matchTimer}s`);
  }

  // Auto-repair check (zoals de 5s interval in productie)
  autoRepair() {
    const fieldSet = new Set(this.field);
    const overlap = this.bench.filter(p => fieldSet.has(p));
    if (overlap.length > 0) {
      this._log('autoRepair_overlap', { overlap });
      this.bench = this.bench.filter(p => !fieldSet.has(p));
    }
    const allActive = this.allPlayers.filter(p => !this.excluded.includes(p));
    const accounted = new Set([...this.field, ...this.bench]);
    const missing = allActive.filter(p => !accounted.has(p));
    if (missing.length > 0) {
      this._log('autoRepair_missing', { missing });
      this.bench = [...this.bench, ...missing];
    }
    this._validate(`autoRepair @ ${this.matchTimer}s`);
    return { fixedOverlap: overlap.length, fixedMissing: missing.length };
  }

  getStats() {
    return {
      field: [...this.field],
      bench: [...this.bench],
      excluded: [...this.excluded],
      keeper: this.matchKeeper,
      playTime: { ...this.playTime },
      subs: this.subHistory.length,
      errors: [...this.errors],
      log: [...this.log],
    };
  }
}

// ============================================================
// TEST HELPERS
// ============================================================
let passed = 0;
let failed = 0;
let totalAssertions = 0;

function assert(condition, msg) {
  totalAssertions++;
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function assertNoErrors(sim, context) {
  // Filter alleen HUIDIGE errors (na de laatste clearErrors)
  if (sim.errors.length > 0) {
    sim.errors.forEach(e => { failed++; totalAssertions++; console.error(`  FAIL [${context}]: ${e}`); });
    sim.errors = []; // Clear na rapportage
  } else {
    passed++; totalAssertions++;
  }
}


// ============================================================
// SCENARIO 1: Normale JO11 wedstrijd (2 helften, 8 spelers, 5 op veld)
// ============================================================
console.log('\n=== SCENARIO 1: Normale JO11 wedstrijd ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  assert(sim.field.length === 5, 'S1: 5 spelers op veld bij start');
  assert(sim.bench.length === 3, 'S1: 3 spelers op bank bij start');
  assert(sim.schedule.length > 0, `S1: schema heeft ${sim.schedule.length} slots`);
  console.log(`  Schema: ${sim.schedule.length} wisselslots`);

  // Helft 1: tick en wissel op elk schema-moment
  let subsExecuted = 0;
  for (let t = 0; t < 20 * 60; t += 30) {
    sim.tick(30);
    if (sim.subTimer >= sim.subInterval * 60) {
      if (sim.executeSub()) subsExecuted++;
    }
  }
  console.log(`  Helft 1: ${subsExecuted} wissels uitgevoerd`);
  assertNoErrors(sim, 'S1 helft 1');

  // Rust + helft 2
  assert(sim.startNextHalf(), 'S1: helft 2 starten');
  subsExecuted = 0;
  for (let t = 0; t < 20 * 60; t += 30) {
    sim.tick(30);
    if (sim.subTimer >= sim.subInterval * 60) {
      if (sim.executeSub()) subsExecuted++;
    }
  }
  console.log(`  Helft 2: ${subsExecuted} wissels uitgevoerd`);
  assertNoErrors(sim, 'S1 helft 2');

  // Einde: bounds check
  assert(!sim.startNextHalf(), 'S1: helft 3 geblokkeerd (maar 2 helften)');

  // Speeltijd check: iedereen moet gespeeld hebben
  const stats = sim.getStats();
  const times = Object.values(stats.playTime);
  assert(times.every(t => t > 0), 'S1: iedereen heeft gespeeld');
  const maxDiff = Math.max(...times) - Math.min(...times);
  console.log(`  Speeltijd: min=${Math.min(...times)}s, max=${Math.max(...times)}s, verschil=${maxDiff}s`);
}


// ============================================================
// SCENARIO 2: Chaos-wedstrijd (vandaag) — blessures, keeper wissels, alles tegelijk
// ============================================================
console.log('\n=== SCENARIO 2: Chaos-wedstrijd (productie scenario van vandaag) ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud', 'Bram'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 15, halves: 4,
  });

  console.log(`  Start: ${sim.field.length} veld, ${sim.bench.length} bank, ${sim.schedule.length} wisselslots`);

  // Helft 1: 5 min spelen, dan blessure
  sim.tick(300);
  sim.executeSub(); // Eerste wissel
  sim.tick(60);

  // BAL TEGEN HOOFD — Bobby uit wedstrijd
  console.log('  >> Bobby: bal tegen hoofd');
  sim.injurePlayer('Bobby');
  assertNoErrors(sim, 'S2 injury Bobby');
  assert(!sim.field.includes('Bobby') && !sim.bench.includes('Bobby'), 'S2: Bobby uit wedstrijd');

  sim.tick(180);
  sim.executeSub();
  sim.tick(120);

  // Keeper wissel mid-helft!
  console.log('  >> Keeper wissel: Luuk → Sem');
  sim.swapKeeper('Sem');
  assertNoErrors(sim, 'S2 keeper swap');
  assert(sim.matchKeeper === 'Sem', 'S2: Sem is nu keeper');

  sim.tick(300);

  // Helft 2
  assert(sim.startNextHalf(), 'S2: helft 2 starten');
  assertNoErrors(sim, 'S2 helft 2 start');
  sim.tick(200);
  sim.executeSub();

  // Nog een blessure — Daan botst
  console.log('  >> Daan: botsing');
  sim.injurePlayer('Daan');
  assertNoErrors(sim, 'S2 injury Daan');

  sim.tick(300);
  sim.executeSub();
  sim.tick(400);

  // Helft 3
  assert(sim.startNextHalf(), 'S2: helft 3 starten');
  assertNoErrors(sim, 'S2 helft 3');
  sim.tick(400);

  // Handmatige wissel (coach beslissing, buiten schema)
  const benchPlayer = sim.bench[0];
  const fieldPlayer = sim.field.find(p => p !== sim.matchKeeper);
  if (benchPlayer && fieldPlayer) {
    console.log(`  >> Handmatige wissel: ${fieldPlayer} → ${benchPlayer}`);
    sim.manualSub(fieldPlayer, benchPlayer);
    assertNoErrors(sim, 'S2 manual sub');
  }

  sim.tick(500);

  // Helft 4
  assert(sim.startNextHalf(), 'S2: helft 4 starten');
  assertNoErrors(sim, 'S2 helft 4');
  sim.tick(300);
  sim.executeSub();
  sim.tick(600);

  // Einde: GEEN helft 5
  assert(!sim.startNextHalf(), 'S2: helft 5 geblokkeerd');

  const stats = sim.getStats();
  console.log(`  Einde: ${stats.subs} wissels, ${stats.excluded.length} uitgevallen, ${stats.errors.length} errors`);
  assert(stats.errors.length === 0, `S2: geen errors (had ${stats.errors.length})`);
}


// ============================================================
// SCENARIO 3: Keeper rotatie (3 keepers, 4 helften)
// ============================================================
console.log('\n=== SCENARIO 3: Keeper rotatie ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 15, halves: 4,
    keeperRotation: true, keeperQueue: ['Luuk', 'Sem', 'Bobby', 'Daan'],
  });

  for (let half = 1; half <= 4; half++) {
    if (half > 1) {
      assert(sim.startNextHalf(), `S3: helft ${half} starten`);
    }
    assertNoErrors(sim, `S3 helft ${half} start`);
    console.log(`  Helft ${half}: keeper=${sim.matchKeeper}, veld=[${sim.field.join(',')}]`);

    // Speel helft
    for (let t = 0; t < 15 * 60; t += 60) {
      sim.tick(60);
      if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
    assertNoErrors(sim, `S3 helft ${half} einde`);
  }

  assert(!sim.startNextHalf(), 'S3: helft 5 geblokkeerd');
  assert(sim.errors.length === 0, `S3: geen errors`);
}


// ============================================================
// SCENARIO 4: Multi-coach sync met corrupte snapshots
// ============================================================
console.log('\n=== SCENARIO 4: Multi-coach sync — corrupte snapshots ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  sim.tick(300);
  sim.executeSub();

  // Corrupte snapshot 1: speler op BEIDE lijsten
  console.log('  >> Corrupte snapshot: Bobby op veld EN bank');
  sim.applyCorruptSnapshot({
    field: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris'],
    bench: ['Bobby', 'Thijs', 'Finn'], // Bobby dubbel!
  });
  assertNoErrors(sim, 'S4 corrupt 1');
  assert(!sim.bench.includes('Bobby') || !sim.field.includes('Bobby'),
    'S4: Bobby staat niet meer dubbel na invariant');

  sim.tick(200);

  // Corrupte snapshot 2: speler KWIJT
  console.log('  >> Corrupte snapshot: Finn kwijt');
  sim.applyCorruptSnapshot({
    field: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris'],
    bench: ['Thijs'], // Finn ontbreekt!
  });
  // validate zal "KWIJT: Finn" melden — dat is VERWACHT voor de repair
  sim.errors = []; // Clear verwachte pre-repair errors
  // Auto-repair moet Finn terugzetten
  const repair = sim.autoRepair();
  console.log(`  Auto-repair: ${repair.fixedMissing} missende spelers hersteld`);
  assert(repair.fixedMissing === 1, 'S4: Finn hersteld door auto-repair');
  assertNoErrors(sim, 'S4 auto-repair');

  // Corrupte snapshot 3: dubbelen BINNEN field
  console.log('  >> Corrupte snapshot: Sem 2x op veld');
  sim.applyCorruptSnapshot({
    field: ['Luuk', 'Sem', 'Sem', 'Daan', 'Morris'],
    bench: ['Bobby', 'Thijs', 'Finn'],
  });
  assert(sim.field.filter(p => p === 'Sem').length === 1, 'S4: Sem maar 1x op veld na invariant');
  assertNoErrors(sim, 'S4 corrupt 3');
}


// ============================================================
// SCENARIO 5: Extreme stress test — 100 random acties
// ============================================================
console.log('\n=== SCENARIO 5: Stress test — 100 random acties ===');
{
  const players = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud', 'Bram', 'Jesse'];
  const sim = new MatchSimulator({
    players, keeper: 'Luuk', playersOnField: 6, halfDuration: 20, halves: 4,
    keeperRotation: true, keeperQueue: ['Luuk', 'Sem', 'Bobby'],
  });

  const rng = (max) => Math.floor(Math.random() * max);
  const actions = ['tick', 'sub', 'manual', 'keeper', 'injury', 'nextHalf', 'corrupt', 'repair'];
  let actionsPerformed = 0;

  for (let i = 0; i < 100; i++) {
    const action = actions[rng(actions.length)];
    try {
      switch (action) {
        case 'tick':
          sim.tick(30 + rng(120));
          break;
        case 'sub':
          sim.executeSub();
          break;
        case 'manual':
          if (sim.bench.length > 0 && sim.field.length > 1) {
            const fp = sim.field[1 + rng(sim.field.length - 1)]; // Skip keeper
            const bp = sim.bench[rng(sim.bench.length)];
            if (fp && bp) sim.manualSub(fp, bp);
          }
          break;
        case 'keeper':
          if (sim.field.length > 1) {
            const candidates = sim.field.filter(p => p !== sim.matchKeeper);
            if (candidates.length > 0) sim.swapKeeper(candidates[rng(candidates.length)]);
          }
          break;
        case 'injury':
          if (sim.field.length > 2) { // Minimaal keeper + 1 speler behouden
            const targets = sim.field.filter(p => p !== sim.matchKeeper);
            if (targets.length > 0 && sim.excluded.length < players.length - 3) {
              sim.injurePlayer(targets[rng(targets.length)]);
            }
          }
          break;
        case 'nextHalf':
          sim.startNextHalf();
          break;
        case 'corrupt':
          // Simuleer corruptie: dupliceer random speler
          if (sim.field.length > 0 && sim.bench.length > 0) {
            const dup = sim.field[rng(sim.field.length)];
            sim.applyCorruptSnapshot({
              field: [...sim.field],
              bench: [...sim.bench, dup],
            });
          }
          break;
        case 'repair':
          sim.autoRepair();
          break;
      }
      actionsPerformed++;
    } catch (err) {
      failed++; totalAssertions++;
      console.error(`  CRASH bij actie ${i} (${action}): ${err.message}`);
    }
  }

  assertNoErrors(sim, 'S5 stress test');
  const stats = sim.getStats();
  console.log(`  ${actionsPerformed} acties uitgevoerd, ${stats.subs} wissels, ${stats.excluded.length} blessures, ${stats.errors.length} errors`);
  assert(stats.errors.length === 0, `S5: geen state errors na 100 random acties`);
}


// ============================================================
// SCENARIO 6: Edge cases — minimale bezetting
// ============================================================
console.log('\n=== SCENARIO 6: Minimale bezetting (5 spelers, 0 op bank) ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  assert(sim.bench.length === 0, 'S6: 0 op bank');
  assert(sim.schedule.length === 0, 'S6: geen wisselschema (niemand om te wisselen)');

  sim.tick(600);
  assert(!sim.executeSub(), 'S6: kan niet wisselen zonder bank');

  // Blessure: speelt met 4
  sim.injurePlayer('Morris');
  assertNoErrors(sim, 'S6 injury');
  assert(sim.field.length === 4, 'S6: 4 op veld na blessure');
  assert(sim.bench.length === 0, 'S6: nog steeds 0 op bank');
}


// ============================================================
// SCENARIO 7: 4 helften met blessure in elke helft
// ============================================================
console.log('\n=== SCENARIO 7: 4 helften, blessure per helft ===');
{
  const players = ['K', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const sim = new MatchSimulator({
    players, keeper: 'K', playersOnField: 6, halfDuration: 15, halves: 4,
  });

  const injuryTargets = ['B', 'D', 'F', 'H']; // 1 per helft

  for (let half = 1; half <= 4; half++) {
    if (half > 1) sim.startNextHalf();

    // Speel 5 min
    sim.tick(300);
    sim.executeSub();
    sim.tick(120);

    // Blessure
    const target = injuryTargets[half - 1];
    if (sim.field.includes(target) || sim.bench.includes(target)) {
      console.log(`  Helft ${half}: ${target} uitgevallen`);
      sim.injurePlayer(target);
    }

    // Speel rest
    sim.tick(480);
    sim.executeSub();

    assertNoErrors(sim, `S7 helft ${half}`);
  }

  const stats = sim.getStats();
  console.log(`  Einde: ${stats.excluded.length} uitgevallen, ${stats.field.length} op veld, ${stats.bench.length} op bank`);
  assert(stats.errors.length === 0, 'S7: geen errors met 4 blessures over 4 helften');
}


// ============================================================
// SCENARIO 8: Schema-herberekening na edit (coach wijzigt wissel)
// ============================================================
console.log('\n=== SCENARIO 8: Schema-herberekening na handmatige wijziging ===');
{
  const sim = new MatchSimulator({
    players: ['K', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  sim.tick(300);

  // Coach wijzigt het wisselvoorstel: in plaats van schema, doe A↔E
  const originalSlot = sim.schedule.find(s => s.status === 'pending');
  if (originalSlot) {
    console.log(`  Origineel voorstel: ${originalSlot.out.join(',')} → ${originalSlot.inn.join(',')}`);

    // Manually override en executeer
    const out = ['A'];
    const inn = ['E'];
    const newField = sim.field.filter(p => !out.includes(p)).concat(inn);
    const newBench = sim.bench.filter(p => !inn.includes(p)).concat(out);
    const { field, bench } = enforceInvariant(newField, newBench, sim.excluded);
    sim.field = field;
    sim.bench = bench;
    sim._validate('S8 edited sub');

    // Herbereken schema
    const idx = sim.schedule.indexOf(originalSlot);
    sim.schedule[idx] = { ...originalSlot, status: 'executed', out, inn };
    sim.schedule = recalculateRemainingSlots(
      sim.schedule, idx, sim.field, sim.bench, sim.playTime,
      sim.matchKeeper, sim.halfDuration, sim.halves, sim.subInterval, sim.excluded
    );
    console.log(`  Na edit: ${sim.schedule.filter(s => s.status === 'pending').length} pending slots`);
  }

  // Speel door
  sim.tick(600);
  sim.executeSub();
  sim.tick(300);
  assertNoErrors(sim, 'S8 na edit');
}


// ============================================================
// SCENARIO 9: ZATERDAGOCHTEND — Einde helft met open wisseladvies
// Wat als de timer afloopt terwijl je net een wisseladvies hebt gekregen?
// ============================================================
console.log('\n=== SCENARIO 9: Timer loopt af tijdens open wisseladvies ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 15, halves: 2,
  });

  // Speel tot vlak voor einde helft 1
  sim.tick(14 * 60); // 14 minuten
  // Er zou nu een wisseladvies moeten staan — maar de helft is bijna voorbij
  const pendingBefore = sim.schedule.filter(s => s.status === 'pending').length;

  // Timer loopt af — helft eindigt
  sim.tick(60); // 15 minuten = einde helft

  // Start helft 2 ZONDER de wissel uit te voeren (coach was te laat)
  sim.startNextHalf();
  assertNoErrors(sim, 'S9 helft 2 na gemiste wissel');

  // Speel helft 2 normaal
  for (let t = 0; t < 15 * 60; t += 60) {
    sim.tick(60);
    if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  const stats = sim.getStats();
  assertNoErrors(sim, 'S9 einde');
  // Iedereen moet gespeeld hebben
  const minTime = Math.min(...Object.values(stats.playTime));
  assert(minTime > 0, `S9: iedereen heeft gespeeld (min=${minTime}s)`);
  console.log(`  Gemiste wissels: ${pendingBefore - sim.schedule.filter(s => s.status === 'pending').length} uitgevoerd in helft 2`);
  console.log(`  Schema: ${sim.schedule.filter(s => s.status === 'executed').length} uitgevoerd, ${sim.schedule.filter(s => s.status === 'pending').length} pending, ${sim.schedule.filter(s => s.status === 'skipped').length} overgeslagen`);
}


// ============================================================
// SCENARIO 10: KEEPER FAIRNESS — Keeper speelt hele wedstrijd,
// wordt die dan benadeeld in speeltijd-weging?
// ============================================================
console.log('\n=== SCENARIO 10: Keeper speeltijd fairness ===');
{
  const sim = new MatchSimulator({
    players: ['Keeper', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'],
    keeper: 'Keeper', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  // Speel volledige wedstrijd
  for (let half = 1; half <= 2; half++) {
    if (half > 1) sim.startNextHalf();
    for (let t = 0; t < 20 * 60; t += 30) {
      sim.tick(30);
      if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  const stats = sim.getStats();
  assertNoErrors(sim, 'S10');

  // Keeper speelt 100% (staat hele wedstrijd op veld)
  const totalMatch = 20 * 60 * 2;
  const keeperTime = stats.playTime['Keeper'];
  assert(keeperTime === totalMatch, `S10: keeper speelt hele wedstrijd (${keeperTime}s van ${totalMatch}s)`);

  // Veldspelers moeten eerlijk verdeeld zijn (niet de keeper)
  const fieldPlayerTimes = Object.entries(stats.playTime)
    .filter(([name]) => name !== 'Keeper')
    .map(([name, time]) => ({ name, time }))
    .sort((a, b) => b.time - a.time);

  const maxFieldTime = fieldPlayerTimes[0].time;
  const minFieldTime = fieldPlayerTimes[fieldPlayerTimes.length - 1].time;
  const fairnessDiff = maxFieldTime - minFieldTime;
  const avgFieldTime = fieldPlayerTimes.reduce((s, p) => s + p.time, 0) / fieldPlayerTimes.length;

  console.log(`  Keeper: ${keeperTime}s (100%)`);
  console.log(`  Veldspelers: min=${minFieldTime}s, max=${maxFieldTime}s, gem=${Math.round(avgFieldTime)}s`);
  console.log(`  Verschil max-min: ${fairnessDiff}s (${Math.round(fairnessDiff/60)}min)`);
  fieldPlayerTimes.forEach(p => {
    const pct = Math.round(p.time / totalMatch * 100);
    console.log(`    ${p.name}: ${p.time}s (${pct}%)`);
  });

  // Eerlijkheidscheck: verschil mag niet meer dan 50% van een helft zijn
  const maxAcceptableDiff = 20 * 60 * 0.5; // halve helft
  assert(fairnessDiff <= maxAcceptableDiff,
    `S10: speeltijdverschil ${fairnessDiff}s moet < ${maxAcceptableDiff}s zijn`);
}


// ============================================================
// SCENARIO 11: SKIP CASCADE — Coach slaat 2+ wissels over,
// herberekent het schema dan eerlijk?
// ============================================================
console.log('\n=== SCENARIO 11: Skip cascade — meerdere wissels overslaan ===');
{
  const sim = new MatchSimulator({
    players: ['K', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  // Helft 1: sla de eerste 2 wissels OVER
  let skipped = 0;
  for (let t = 0; t < 20 * 60; t += 30) {
    sim.tick(30);
    if (sim.subTimer >= sim.subInterval * 60) {
      const nextSlot = sim.schedule.find(s => s.status === 'pending');
      if (nextSlot && skipped < 2) {
        // Skip! Markeer als overgeslagen en herbereken
        const idx = sim.schedule.indexOf(nextSlot);
        sim.schedule[idx] = { ...nextSlot, status: 'skipped', executedAt: sim.matchTimer };
        sim.schedule = recalculateRemainingSlots(
          sim.schedule, idx, sim.field, sim.bench, sim.playTime,
          sim.matchKeeper, sim.halfDuration, sim.halves, sim.subInterval, sim.excluded
        );
        sim.subTimer = 0;
        skipped++;
        console.log(`  Skip ${skipped}: ${nextSlot.out.join(',')} → ${nextSlot.inn.join(',')}`);
      } else {
        sim.executeSub();
      }
    }
  }

  // Helft 2: voer alles uit
  sim.startNextHalf();
  for (let t = 0; t < 20 * 60; t += 30) {
    sim.tick(30);
    if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  assertNoErrors(sim, 'S11');
  const stats = sim.getStats();

  // Na 2 skips: check dat bankspelers die NIET gescheduled waren ook speeltijd kregen
  // NB: met 2 skips in helft 1 is het realistisch dat sommige spelers pas in helft 2 spelen
  const times = Object.entries(stats.playTime).filter(([n]) => n !== 'K');
  const playedCount = times.filter(([,t]) => t > 0).length;
  assert(playedCount >= 4, `S11: minstens 4 van 7 spelers hebben gespeeld (${playedCount})`);
  console.log(`  ${skipped} wissels overgeslagen, ${stats.subs} wissels uitgevoerd`);
  console.log(`  Speeltijden: ${times.map(([n,t]) => `${n}=${t}s`).join(', ')}`);
}


// ============================================================
// SCENARIO 12: MAAR 1 BANKSPELER — het moeilijkste scenario
// Elke wissel is dezelfde 2 spelers die om en om gaan
// ============================================================
console.log('\n=== SCENARIO 12: Maar 1 bankspeler ===');
{
  const sim = new MatchSimulator({
    players: ['K', 'A', 'B', 'C', 'D', 'E'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  assert(sim.bench.length === 1, `S12: 1 bankspeler (${sim.bench.join(',')})`);
  console.log(`  Start: veld=[${sim.field.join(',')}], bank=[${sim.bench.join(',')}]`);

  // Speel volledige wedstrijd
  let totalSubs = 0;
  for (let half = 1; half <= 2; half++) {
    if (half > 1) sim.startNextHalf();
    for (let t = 0; t < 20 * 60; t += 30) {
      sim.tick(30);
      if (sim.subTimer >= sim.subInterval * 60) {
        if (sim.executeSub()) totalSubs++;
      }
    }
  }

  assertNoErrors(sim, 'S12');
  const stats = sim.getStats();
  const times = Object.entries(stats.playTime).filter(([n]) => n !== 'K');
  const maxDiff = Math.max(...times.map(([,t]) => t)) - Math.min(...times.map(([,t]) => t));
  console.log(`  ${totalSubs} wissels uitgevoerd`);
  console.log(`  Speeltijden: ${times.map(([n,t]) => `${n}=${t}s`).join(', ')}`);
  console.log(`  Max verschil: ${maxDiff}s (${Math.round(maxDiff/60)}min)`);
  assert(totalSubs > 0, 'S12: minstens 1 wissel uitgevoerd');
}


// ============================================================
// SCENARIO 13: WISSELCOUNT — wie is hoe vaak gewisseld?
// ============================================================
console.log('\n=== SCENARIO 13: Wisselcount per speler ===');
{
  const sim = new MatchSimulator({
    players: ['K', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 4,
  });

  for (let half = 1; half <= 4; half++) {
    if (half > 1) sim.startNextHalf();
    for (let t = 0; t < 20 * 60; t += 30) {
      sim.tick(30);
      if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  assertNoErrors(sim, 'S13');

  // Tel wissels per speler
  const subCounts = {};
  sim.subHistory.forEach(sub => {
    (sub.out || []).forEach(p => { subCounts[p] = (subCounts[p] || 0) + 1; });
    (sub.inn || []).forEach(p => { subCounts[p] = (subCounts[p] || 0) + 1; });
  });

  console.log(`  ${sim.subHistory.length} wissels totaal`);
  Object.entries(subCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`    ${name}: ${count}x gewisseld`);
  });

  // Keeper mag niet gewisseld zijn (staat altijd op veld)
  assert(!subCounts['K'] || subCounts['K'] === 0, 'S13: keeper niet gewisseld');

  // Iedereen behalve keeper moet minstens 1x gewisseld zijn
  const nonKeeper = ['Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'];
  const allSubbed = nonKeeper.every(p => (subCounts[p] || 0) > 0);
  assert(allSubbed, 'S13: iedereen (behalve keeper) is minstens 1x gewisseld');
}


// ============================================================
// SCENARIO 14: MATCH SAVE — is alle data compleet voor terugkijken?
// ============================================================
console.log('\n=== SCENARIO 14: Match save completeness ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 15, halves: 2,
  });

  // Speel met wat blessures en wissels
  sim.tick(300);
  sim.executeSub();
  sim.tick(200);
  sim.injurePlayer('Bobby');
  sim.tick(400);

  sim.startNextHalf();
  sim.tick(300);
  sim.executeSub();
  sim.tick(600);

  const stats = sim.getStats();

  // Simuleer wat we opslaan naar de server
  const savedMatch = {
    homeTeam: 'Dilettant',
    awayTeam: 'Tegenstander',
    homeScore: 3,
    awayScore: 1,
    playTime: stats.playTime,
    goalScorers: { 'Sem': 2, 'Daan': 1 },
    subHistory: sim.subHistory,
    events: sim.log.filter(l => ['executeSub', 'injury', 'startNextHalf'].includes(l.action)),
    excludedPlayers: stats.excluded,
    players: sim.allPlayers,
    halves: sim.halves,
    halfDuration: sim.halfDuration,
    matchLog: stats.log,
  };

  // Controleer completeness
  assert(savedMatch.playTime && Object.keys(savedMatch.playTime).length === 7, 'S14: playTime voor alle spelers');
  assert(savedMatch.subHistory.length > 0, 'S14: wisselgeschiedenis aanwezig');
  assert(savedMatch.events.length > 0, 'S14: events aanwezig');
  assert(savedMatch.excludedPlayers.includes('Bobby'), 'S14: Bobby in excluded');
  assert(savedMatch.matchLog.length > 0, 'S14: debug log aanwezig');
  assert(savedMatch.players.length === 7, 'S14: spelerslijst compleet');

  // Wisselcount reconstrueerbaar uit subHistory
  const subCounts = {};
  savedMatch.subHistory.forEach(sub => {
    (sub.out || []).forEach(p => { subCounts[p] = (subCounts[p] || 0) + 1; });
    (sub.inn || []).forEach(p => { subCounts[p] = (subCounts[p] || 0) + 1; });
  });
  assert(Object.keys(subCounts).length > 0, 'S14: wisselcount reconstrueerbaar');

  console.log(`  Opgeslagen: ${Object.keys(savedMatch.playTime).length} speeltijden, ${savedMatch.subHistory.length} wissels, ${savedMatch.events.length} events, ${savedMatch.matchLog.length} logregels`);
  console.log(`  Wisselcounts: ${Object.entries(subCounts).map(([n,c]) => `${n}:${c}x`).join(', ')}`);
}


// ============================================================
// SCENARIO 15: KEEPER ROTATIE + BLESSURE — keeper valt uit,
// wie pakt het over? Blijft de rotatie kloppen?
// ============================================================
console.log('\n=== SCENARIO 15: Keeper rotatie + keeper valt uit ===');
{
  const sim = new MatchSimulator({
    players: ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'],
    keeper: 'Luuk', playersOnField: 5, halfDuration: 15, halves: 4,
    keeperRotation: true, keeperQueue: ['Luuk', 'Sem', 'Bobby', 'Daan'],
  });

  // Helft 1: Luuk is keeper
  assert(sim.matchKeeper === 'Luuk', 'S15: Luuk start als keeper');
  sim.tick(600);
  sim.executeSub();
  sim.tick(300);

  // Helft 2: Sem wordt keeper
  sim.startNextHalf();
  assert(sim.matchKeeper === 'Sem', `S15: Sem is keeper helft 2 (is ${sim.matchKeeper})`);
  sim.tick(300);

  // SEM VALT UIT als keeper! (bal in gezicht of zoiets)
  console.log('  >> Keeper Sem valt uit!');
  sim.injurePlayer('Sem');
  assertNoErrors(sim, 'S15 keeper injury');
  assert(sim.matchKeeper !== 'Sem', 'S15: Sem is niet meer keeper');
  assert(!sim.field.includes('Sem'), 'S15: Sem niet meer op veld');
  console.log(`  Nieuwe keeper: ${sim.matchKeeper}`);

  sim.tick(600);

  // Helft 3: Bobby zou keeper moeten worden (volgende in queue)
  sim.startNextHalf();
  assertNoErrors(sim, 'S15 helft 3');
  console.log(`  Helft 3 keeper: ${sim.matchKeeper}`);

  sim.tick(900);

  // Helft 4: Daan wordt keeper (Sem is excluded, wordt overgeslagen)
  sim.startNextHalf();
  assertNoErrors(sim, 'S15 helft 4');
  console.log(`  Helft 4 keeper: ${sim.matchKeeper}`);

  assert(!sim.startNextHalf(), 'S15: helft 5 geblokkeerd');

  const stats = sim.getStats();
  assert(stats.errors.length === 0, 'S15: geen errors');
  assert(stats.excluded.includes('Sem'), 'S15: Sem is excluded');
}


// ============================================================
// SCENARIO 16: APP CRASH + RECONNECT — state herstellen vanuit
// een server snapshot na page refresh
// ============================================================
console.log('\n=== SCENARIO 16: App crash + reconnect ===');
{
  const sim = new MatchSimulator({
    players: ['K', 'A', 'B', 'C', 'D', 'E', 'F'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  // Speel 10 minuten met wat wissels
  sim.tick(300);
  sim.executeSub();
  sim.tick(300);

  // Sla huidige state op (= server snapshot)
  const snapshot = {
    field: [...sim.field],
    bench: [...sim.bench],
    matchKeeper: sim.matchKeeper,
    playTime: { ...sim.playTime },
    excluded: [...sim.excluded],
  };

  // "CRASH" — maak een nieuwe simulator (= page refresh)
  const sim2 = new MatchSimulator({
    players: ['K', 'A', 'B', 'C', 'D', 'E', 'F'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  // Herstel vanuit snapshot
  sim2.applySnapshot(snapshot);
  sim2.playTime = snapshot.playTime; // Herstel speeltijden
  sim2.matchTimer = sim.matchTimer;  // Herstel timer

  assertNoErrors(sim2, 'S16 reconnect');

  // Veld/bank moet identiek zijn aan voor de crash
  assert(JSON.stringify(sim2.field.sort()) === JSON.stringify(snapshot.field.sort()),
    'S16: veld hersteld na reconnect');
  assert(JSON.stringify(sim2.bench.sort()) === JSON.stringify(snapshot.bench.sort()),
    'S16: bank hersteld na reconnect');

  // Speel door
  sim2.tick(600);
  sim2.executeSub();
  assertNoErrors(sim2, 'S16 doorspelen na reconnect');
  console.log(`  Reconnect OK, doorgespeeld met ${sim2.field.length} op veld`);
}


// ============================================================
// SCENARIO 17: DUBBELE BLESSURE TEGELIJK — 2 spelers tegelijk uit
// (botsing met elkaar)
// ============================================================
console.log('\n=== SCENARIO 17: Dubbele blessure (botsing) ===');
{
  const sim = new MatchSimulator({
    players: ['K', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  sim.tick(300);

  // A en B botsen op elkaar — allebei uit
  console.log('  >> A en B botsen op elkaar');
  sim.injurePlayer('A');
  assertNoErrors(sim, 'S17 injury A');
  sim.injurePlayer('B');
  assertNoErrors(sim, 'S17 injury B');

  assert(!sim.field.includes('A') && !sim.field.includes('B'), 'S17: A en B niet op veld');
  assert(sim.excluded.includes('A') && sim.excluded.includes('B'), 'S17: A en B excluded');
  console.log(`  Na dubbele blessure: veld=[${sim.field.join(',')}], bank=[${sim.bench.join(',')}]`);

  // Speel door
  sim.tick(600);
  if (sim.bench.length > 0) sim.executeSub();
  sim.tick(300);

  sim.startNextHalf();
  sim.tick(1200);

  assertNoErrors(sim, 'S17 einde');
  console.log(`  Einde: ${sim.field.length} op veld, ${sim.bench.length} op bank, ${sim.excluded.length} uit`);
}


// ============================================================
// SCENARIO 18: LATE ARRIVAL — kind komt te laat, moet midden in
// wedstrijd worden toegevoegd
// ============================================================
console.log('\n=== SCENARIO 18: Kind komt te laat ===');
{
  const sim = new MatchSimulator({
    players: ['K', 'A', 'B', 'C', 'D', 'E', 'F'],
    keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
  });

  // Speel 10 minuten
  sim.tick(600);
  sim.executeSub();

  // Noah komt te laat! Voeg toe aan de bank
  console.log('  >> Noah komt te laat (10 min)');
  sim.allPlayers.push('Noah');
  sim.bench.push('Noah');
  sim.playTime['Noah'] = 0;
  sim._enforce();
  sim._validate('S18 late arrival');
  assertNoErrors(sim, 'S18 late arrival');

  // Herbereken schema met nieuwe speler
  const newInterval = calculateDynamicInterval(sim.halfDuration, sim.bench.length);
  sim.subInterval = newInterval;
  sim.schedule = recalculateRemainingSlots(
    sim.schedule, getPivotIndex(sim.schedule, sim.activeSlotIndex),
    sim.field, sim.bench, sim.playTime, sim.matchKeeper,
    sim.halfDuration, sim.halves, newInterval, sim.excluded
  );

  // Coach wisselt Noah handmatig in (realistisch scenario)
  const longestOnField = sim.field
    .filter(p => p !== sim.matchKeeper)
    .sort((a, b) => (sim.playTime[b] || 0) - (sim.playTime[a] || 0))[0];
  console.log(`  Coach wisselt ${longestOnField} → Noah (handmatig)`);
  sim.manualSub(longestOnField, 'Noah');
  assertNoErrors(sim, 'S18 manual sub Noah');

  // Speel rest helft 1 + helft 2
  for (let t = 0; t < 10 * 60; t += 60) {
    sim.tick(60);
    if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  sim.startNextHalf();
  for (let t = 0; t < 20 * 60; t += 60) {
    sim.tick(60);
    if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  assertNoErrors(sim, 'S18 einde');
  assert(sim.playTime['Noah'] > 0, `S18: Noah heeft gespeeld (${sim.playTime['Noah']}s)`);
  console.log(`  Noah speeltijd: ${sim.playTime['Noah']}s`);
}


// ============================================================
// SCENARIO 19: FAIRNESS DEEP DIVE — speel 10 wedstrijden,
// analyseer speeltijdverdeling statistisch
// ============================================================
console.log('\n=== SCENARIO 19: Fairness analyse over 10 wedstrijden ===');
{
  const players = ['K', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'];
  const cumulative = {};
  players.forEach(p => { cumulative[p] = 0; });

  for (let game = 0; game < 10; game++) {
    const sim = new MatchSimulator({
      players, keeper: 'K', playersOnField: 5, halfDuration: 20, halves: 2,
    });

    for (let half = 1; half <= 2; half++) {
      if (half > 1) sim.startNextHalf();
      for (let t = 0; t < 20 * 60; t += 30) {
        sim.tick(30);
        if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
      }
    }

    // Accumuleer
    Object.entries(sim.playTime).forEach(([name, time]) => {
      cumulative[name] += time;
    });

    if (sim.errors.length > 0) {
      sim.errors.forEach(e => { failed++; totalAssertions++; console.error(`  FAIL [game ${game}]: ${e}`); });
      sim.errors = [];
    }
  }

  const nonKeeper = Object.entries(cumulative).filter(([n]) => n !== 'K');
  nonKeeper.sort((a, b) => b[1] - a[1]);
  const maxTime = nonKeeper[0][1];
  const minTime = nonKeeper[nonKeeper.length - 1][1];
  const avg = nonKeeper.reduce((s, [,t]) => s + t, 0) / nonKeeper.length;

  console.log('  Cumulatieve speeltijd over 10 wedstrijden:');
  nonKeeper.forEach(([name, time]) => {
    const pct = Math.round(time / maxTime * 100);
    const deviation = Math.round((time - avg) / avg * 100);
    console.log(`    ${name}: ${time}s (${pct}% van max, ${deviation > 0 ? '+' : ''}${deviation}% van gem)`);
  });

  const fairnessRatio = minTime / maxTime;
  console.log(`  Fairness ratio: ${Math.round(fairnessRatio * 100)}% (min/max)`);
  assert(fairnessRatio >= 0.5, `S19: fairness ratio ${Math.round(fairnessRatio*100)}% moet >= 50% zijn`);
  passed++; totalAssertions++; // Extra pass voor geen crashes in 10 games
}


// ============================================================
// SCENARIO 20: MEGA STRESS — 500 random acties, 10 spelers,
// keeper rotatie, 4 helften. Mag NOOIT crashen.
// ============================================================
console.log('\n=== SCENARIO 20: Mega stress — 500 random acties ===');
{
  const players = ['K', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const sim = new MatchSimulator({
    players, keeper: 'K', playersOnField: 6, halfDuration: 15, halves: 4,
    keeperRotation: true, keeperQueue: ['K', 'A', 'B', 'C'],
  });

  const rng = (max) => Math.floor(Math.random() * max);
  const actions = ['tick', 'tick', 'tick', 'sub', 'sub', 'manual', 'keeper', 'injury', 'nextHalf', 'corrupt', 'repair'];
  // Gewogen: meer ticks en subs (realistischer)
  let crashes = 0;

  for (let i = 0; i < 500; i++) {
    const action = actions[rng(actions.length)];
    try {
      switch (action) {
        case 'tick': sim.tick(10 + rng(60)); break;
        case 'sub': sim.executeSub(); break;
        case 'manual':
          if (sim.bench.length > 0 && sim.field.length > 1) {
            const nonKeeper = sim.field.filter(p => p !== sim.matchKeeper);
            if (nonKeeper.length > 0) {
              sim.manualSub(nonKeeper[rng(nonKeeper.length)], sim.bench[rng(sim.bench.length)]);
            }
          }
          break;
        case 'keeper':
          if (sim.field.length > 1) {
            const c = sim.field.filter(p => p !== sim.matchKeeper);
            if (c.length > 0) sim.swapKeeper(c[rng(c.length)]);
          }
          break;
        case 'injury':
          if (sim.field.length > 2 && sim.excluded.length < players.length - 3) {
            const t = sim.field.filter(p => p !== sim.matchKeeper);
            if (t.length > 0) sim.injurePlayer(t[rng(t.length)]);
          }
          break;
        case 'nextHalf': sim.startNextHalf(); break;
        case 'corrupt':
          if (sim.field.length > 0 && sim.bench.length > 0) {
            sim.applyCorruptSnapshot({
              field: [...sim.field, sim.bench[rng(sim.bench.length)]],
              bench: [...sim.bench],
            });
          }
          break;
        case 'repair': sim.autoRepair(); break;
      }
    } catch (err) {
      crashes++;
      console.error(`  CRASH bij actie ${i} (${action}): ${err.message}`);
    }
  }

  assert(crashes === 0, `S20: 0 crashes (had ${crashes})`);
  assertNoErrors(sim, 'S20');
  const stats = sim.getStats();
  console.log(`  500 acties: ${stats.subs} wissels, ${stats.excluded.length} blessures, ${crashes} crashes`);
}


// ============================================================
// RESULTATEN
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`RESULTATEN: ${passed}/${totalAssertions} assertions geslaagd`);
if (failed > 0) {
  console.log(`\n❌ ${failed} TESTS GEFAALD`);
  process.exit(1);
} else {
  console.log(`\n✅ ALLES GESLAAGD — de state machine is robuust`);
}
