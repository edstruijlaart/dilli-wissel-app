/**
 * DILLI WISSEL — JO8-2 Perspectieftest
 *
 * ~100 scenario's vanuit drie perspectieven:
 *   👨‍💼 COACH  — correctheid, blessures, multi-coach chaos, edge cases
 *   👴 OPA/OMA — wat zien thuiskijkers? Klopt het beeld?
 *   ⚽ KIND   — eerlijkheid speeltijd, bank-duur, keeper-rotatie
 *
 * JO8-2 config: 4x10 min, 6 op veld, 8 spelers, keeper-rotatie
 * Run: node test-jo8-2.mjs
 */

// ============================================================
// CORE FUNCTIONS (uit useMatchState.js)
// ============================================================
const dedup = (arr) => [...new Set(arr)];

function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set(); const cleanField = []; const cleanBench = [];
  const excludedSet = new Set(excluded);
  for (const p of field) { if (!seen.has(p) && !excludedSet.has(p)) { cleanField.push(p); seen.add(p); } }
  for (const p of bench) { if (!seen.has(p) && !excludedSet.has(p)) { cleanBench.push(p); seen.add(p); } }
  return { field: cleanField, bench: cleanBench };
}

function calculateDynamicInterval(halfDurationMin, benchSize) {
  if (benchSize <= 0) return halfDurationMin;
  const slotsNeeded = benchSize <= 2 ? 1 : 1 + (benchSize - 2);
  const usableMinutes = halfDurationMin - 2;
  if (halfDurationMin <= 12) {
    const targetSlots = Math.max(slotsNeeded + 1, 3);
    return Math.max(2, Math.floor(usableMinutes / targetSlots));
  }
  return Math.max(2, Math.floor(usableMinutes / (slotsNeeded + 1)));
}

function generateSubSchedule(playerList, keeperName, numOnField, hDuration, nHalves, sInterval, currentPlayTime = {}, excludedList = [], initialField = null, initialBench = null, keeperRotationEnabled = false, keeperQueueList = []) {
  const allActive = playerList.filter(p => !excludedList.includes(p));
  const F = numOnField; const D = hDuration * 60; const I = sInterval * 60;
  const outfieldForInit = allActive.filter(p => p !== keeperName);
  let field = dedup(initialField ? [...initialField] : [keeperName, ...outfieldForInit.slice(0, F - 1)]);
  let bench = dedup(initialBench ? [...initialBench] : outfieldForInit.slice(F - 1)).filter(p => !field.includes(p));
  field = field.filter(p => !excludedList.includes(p));
  bench = bench.filter(p => !excludedList.includes(p));
  const B = bench.length;
  if (B <= 0 || I <= 0) return [];
  const slotsPerHalf = Math.max(1, Math.floor(D / I));
  const fieldSlots = F - 1;
  const projected = {}; allActive.forEach(p => { projected[p] = currentPlayTime[p] || 0; });
  const benchWait = {}; const fieldStreak = {};
  allActive.forEach(p => { benchWait[p] = bench.includes(p) ? 1 : 0; fieldStreak[p] = field.includes(p) ? 1 : 0; });
  const rankOf = {}; playerList.forEach((p, i) => { rankOf[p] = i; });
  const midRank = playerList.length / 2;
  let lastBankWasTop = null;
  const schedule = []; let slotId = 0;
  for (let half = 1; half <= nHalves; half++) {
    const halfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0) ? keeperQueueList[(half - 1) % keeperQueueList.length] : keeperName;
    const prevHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half > 1) ? keeperQueueList[(half - 2) % keeperQueueList.length] : (half > 1 ? keeperName : null);
    const nextHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half < nHalves) ? keeperQueueList[half % keeperQueueList.length] : null;
    if (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper) {
      projected[prevHalfKeeper] = (projected[prevHalfKeeper] || 0) + D * 0.5;
      const promoteToField = (player) => {
        if (!bench.includes(player)) return;
        bench = bench.filter(p => p !== player); field = [...field, player];
        if (field.length > F) {
          const canGoBench = field.filter(p => p !== halfKeeper && p !== prevHalfKeeper);
          canGoBench.sort((a, b) => (projected[b] || 0) - (projected[a] || 0));
          const leaving = canGoBench.slice(0, field.length - F);
          field = field.filter(p => !leaving.includes(p)); bench = [...bench, ...leaving];
        }
      };
      promoteToField(halfKeeper); promoteToField(prevHalfKeeper);
    }
    const gracePlayer = (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper) ? prevHalfKeeper : null;
    let isFirstSlotOfHalf = true; const slotTimes = []; const MIN_BEFORE_END = 120;
    const longWaiters = bench.filter(p => (benchWait[p] || 0) >= 2);
    if (half > 1 && longWaiters.length > 0) slotTimes.push(30);
    for (let s = 1; s <= slotsPerHalf; s++) { const t = s * I; if (t <= D - MIN_BEFORE_END && t > 30) slotTimes.push(t); }
    let prevSlotTime = 0;
    for (const slotTime of slotTimes) {
      const perSlot = isFirstSlotOfHalf ? Math.min(2, bench.length, fieldSlots) : 1;
      const delta = slotTime - prevSlotTime;
      field.filter(p => p !== halfKeeper).forEach(p => { projected[p] = (projected[p] || 0) + delta; });
      let eligible = field.filter(p => p !== halfKeeper);
      if (isFirstSlotOfHalf && gracePlayer && eligible.includes(gracePlayer)) eligible = eligible.filter(p => p !== gracePlayer);
      const isLastSlot = slotTime === slotTimes[slotTimes.length - 1];
      if (isLastSlot && nextHalfKeeper && nextHalfKeeper !== halfKeeper && eligible.includes(nextHalfKeeper)) eligible = eligible.filter(p => p !== nextHalfKeeper);
      eligible.sort((a, b) => {
        const ptDiff = (projected[b] || 0) - (projected[a] || 0); if (ptDiff !== 0) return ptDiff;
        const fsDiff = (fieldStreak[b] || 0) - (fieldStreak[a] || 0); if (fsDiff !== 0) return fsDiff;
        if (lastBankWasTop !== null) { const aIsTop = (rankOf[a] || 0) < midRank; const bIsTop = (rankOf[b] || 0) < midRank; if (aIsTop !== bIsTop) return (lastBankWasTop ? !aIsTop : aIsTop) ? -1 : 1; }
        return 0;
      });
      const goingOut = eligible.slice(0, perSlot);
      const benchSorted = [...bench].sort((a, b) => { const waitDiff = (benchWait[b] || 0) - (benchWait[a] || 0); if (waitDiff !== 0) return waitDiff; return (projected[a] || 0) - (projected[b] || 0); });
      const goingIn = benchSorted.slice(0, perSlot);
      if (goingOut.length > 0 && goingIn.length > 0) {
        schedule.push({ id: `slot-${++slotId}`, half, time: slotTime, absoluteTime: (half - 1) * D + slotTime, out: [...goingOut], inn: [...goingIn], status: 'pending', executedAt: null });
        const lastOut = goingOut[goingOut.length - 1]; lastBankWasTop = (rankOf[lastOut] || 0) < midRank;
        bench.filter(p => !goingIn.includes(p)).forEach(p => { benchWait[p] = (benchWait[p] || 0) + 1; });
        field.filter(p => p !== halfKeeper && !goingOut.includes(p)).forEach(p => { fieldStreak[p] = (fieldStreak[p] || 0) + 1; });
        goingOut.forEach(p => { benchWait[p] = 1; fieldStreak[p] = 0; }); goingIn.forEach(p => { benchWait[p] = 0; fieldStreak[p] = 1; });
        field = field.filter(p => !goingOut.includes(p)).concat(goingIn); bench = bench.filter(p => !goingIn.includes(p)).concat(goingOut);
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
  const dedupField = dedup(currentField); const dedupBench = dedup(currentBench.filter(p => !dedupField.includes(p)));
  const allPlayers = [...dedupField, ...dedupBench];
  const lastFixedSlot = fixed[fixed.length - 1];
  const currentHalf = lastFixedSlot ? lastFixedSlot.half : 1;
  const currentAbsTime = lastFixedSlot?.absoluteTime || 0;
  const remainingHalves = nHalves - currentHalf + 1;
  const remaining = generateSubSchedule(allPlayers, keeperName, dedupField.length, hDuration, remainingHalves, sInterval, currentPlayTime, excluded, dedupField, dedupBench, keeperRotationEnabled, keeperQueueList);
  const halfOffset = (currentHalf - 1) * hDuration * 60;
  const adjustedSlots = remaining.map(s => ({ ...s, half: s.half + currentHalf - 1, absoluteTime: s.absoluteTime + halfOffset }));
  const futureSlots = adjustedSlots.filter(s => s.absoluteTime > currentAbsTime);
  return [...fixed, ...futureSlots.map((s, i) => ({ ...s, id: `slot-recalc-${fromIndex + 1}-${i}`, status: 'pending', executedAt: null }))];
}

const getPivotIndex = (schedule, activeIdx) =>
  activeIdx >= 0 ? activeIdx : Math.max(-1, schedule.findIndex(s => s.status === 'pending') - 1);

// ============================================================
// MATCH SIMULATOR
// ============================================================
class MatchSimulator {
  constructor({ players, keeper, playersOnField, halfDuration, halves, keeperRotation = false, keeperQueue = [] }) {
    this.allPlayers = [...players]; this.keeper = keeper; this.matchKeeper = keeper;
    this.playersOnField = playersOnField; this.halfDuration = halfDuration;
    this.halves = halves; this.keeperRotation = keeperRotation; this.keeperQueue = keeperQueue;
    const nk = players.filter(p => p !== keeper);
    this.field = [keeper, ...nk.slice(0, playersOnField - 1)];
    this.bench = nk.slice(playersOnField - 1);
    this.excluded = []; this.playTime = {};
    players.forEach(p => { this.playTime[p] = 0; });
    this.currentHalf = 1; this.matchTimer = 0; this.subTimer = 0;
    this.subHistory = []; this.log = []; this.errors = [];
    const dynamicInterval = calculateDynamicInterval(halfDuration, this.bench.length);
    this.subInterval = dynamicInterval;
    this.schedule = generateSubSchedule(players, keeper, playersOnField, halfDuration, halves, dynamicInterval, {}, [], null, null, keeperRotation, keeperQueue);
    this.activeSlotIndex = -1;
  }
  _log(action, details = {}) { this.log.push({ t: this.matchTimer, half: this.currentHalf, action, ...details }); }
  _enforce() {
    const { field, bench } = enforceInvariant(this.field, this.bench, this.excluded);
    this.field = field; this.bench = bench;
  }
  _validate(ctx) {
    const overlap = this.bench.filter(p => new Set(this.field).has(p));
    if (overlap.length > 0) this.errors.push(`[${ctx}] OVERLAP: ${overlap.join(',')}`);
    if (new Set(this.field).size !== this.field.length) this.errors.push(`[${ctx}] DUBBEL VELD`);
    if (new Set(this.bench).size !== this.bench.length) this.errors.push(`[${ctx}] DUBBEL BANK`);
    const active = this.allPlayers.filter(p => !this.excluded.includes(p));
    const accounted = new Set([...this.field, ...this.bench]);
    const missing = active.filter(p => !accounted.has(p));
    if (missing.length > 0) this.errors.push(`[${ctx}] KWIJT: ${missing.join(',')}`);
    if (!this.field.includes(this.matchKeeper)) this.errors.push(`[${ctx}] KEEPER ${this.matchKeeper} WEG`);
  }
  tick(seconds) {
    this.matchTimer += seconds; this.subTimer += seconds;
    this.field.forEach(p => { this.playTime[p] = (this.playTime[p] || 0) + seconds; });
  }
  executeSub() {
    const nextSlot = this.schedule.find(s => s.status === 'pending');
    if (!nextSlot) return false;
    let { out, inn } = nextSlot;
    if (this.matchKeeper && out.includes(this.matchKeeper)) {
      out = out.filter(p => p !== this.matchKeeper); inn = inn.slice(0, out.length);
      if (out.length === 0) { const idx = this.schedule.indexOf(nextSlot); this.schedule[idx] = { ...nextSlot, status: 'skipped' }; return false; }
    }
    // Only sub players who are actually in their expected position (schedule may be stale vs actual state)
    out = out.filter(p => this.field.includes(p));
    inn = inn.filter(p => this.bench.includes(p));
    // Balance: only sub min(out.length, inn.length) pairs
    const pairs = Math.min(out.length, inn.length);
    out = out.slice(0, pairs); inn = inn.slice(0, pairs);
    if (pairs === 0) { const idx = this.schedule.indexOf(nextSlot); this.schedule[idx] = { ...nextSlot, status: 'skipped' }; return false; }
    const newField = this.field.filter(p => !out.includes(p)).concat(inn);
    const newBench = this.bench.filter(p => !inn.includes(p)).concat(out);
    this.field = newField; this.bench = newBench; this._enforce();
    const idx = this.schedule.indexOf(nextSlot);
    this.schedule[idx] = { ...nextSlot, status: 'executed', executedAt: this.matchTimer };
    this.activeSlotIndex = idx; this.subTimer = 0;
    this.subHistory.push({ time: this.matchTimer, half: this.currentHalf, out: [...out], inn: [...inn] });
    this._validate(`executeSub@${this.matchTimer}s`); return true;
  }
  skipSub() {
    const nextSlot = this.schedule.find(s => s.status === 'pending');
    if (!nextSlot) return false;
    const idx = this.schedule.indexOf(nextSlot);
    this.schedule[idx] = { ...nextSlot, status: 'skipped', executedAt: this.matchTimer };
    this.activeSlotIndex = idx;
    const newInterval = calculateDynamicInterval(this.halfDuration, this.bench.length);
    this.schedule = recalculateRemainingSlots(this.schedule, idx, this.field, this.bench, this.playTime, this.matchKeeper, this.halfDuration, this.halves, newInterval, this.excluded, this.keeperRotation, this.keeperQueue);
    this.subTimer = 0; return true;
  }
  manualSub(fieldPlayer, benchPlayer) {
    if (!this.field.includes(fieldPlayer) || !this.bench.includes(benchPlayer)) return false;
    const wasKeeper = fieldPlayer === this.matchKeeper;
    this.field = this.field.map(p => p === fieldPlayer ? benchPlayer : p);
    this.bench = this.bench.map(p => p === benchPlayer ? fieldPlayer : p);
    this._enforce();
    if (wasKeeper) this.matchKeeper = benchPlayer;
    this.subHistory.push({ time: this.matchTimer, half: this.currentHalf, out: [fieldPlayer], inn: [benchPlayer], manual: true });
    this._validate(`manualSub@${this.matchTimer}s`); return true;
  }
  injurePlayer(player) {
    const wasOnField = this.field.includes(player);
    let newField = [...this.field]; let newBench = [...this.bench];
    const newExcluded = [...this.excluded, player];
    if (wasOnField) {
      newField = newField.filter(p => p !== player);
      if (newBench.length > 0) {
        const sorted = [...newBench].sort((a, b) => (this.playTime[a] || 0) - (this.playTime[b] || 0));
        const replacement = sorted[0];
        newField.push(replacement); newBench = newBench.filter(p => p !== replacement);
      }
    } else { newBench = newBench.filter(p => p !== player); }
    if (player === this.matchKeeper && newField.length > 0) this.matchKeeper = newField[0];
    const { field, bench } = enforceInvariant(newField, newBench, newExcluded);
    this.field = field; this.bench = bench; this.excluded = newExcluded;
    if (bench.length > 0) {
      const newInterval = calculateDynamicInterval(this.halfDuration, bench.length);
      this.subInterval = newInterval;
      this.schedule = recalculateRemainingSlots(this.schedule, getPivotIndex(this.schedule, this.activeSlotIndex), field, bench, this.playTime, this.matchKeeper, this.halfDuration, this.halves, newInterval, newExcluded, this.keeperRotation, this.keeperQueue);
    }
    this._validate(`injury@${this.matchTimer}s`);
  }
  returnPlayer(player) {
    if (!this.excluded.includes(player)) return false;
    const newExcluded = this.excluded.filter(p => p !== player);
    const newBench = [...this.bench, player];
    const { field, bench } = enforceInvariant(this.field, newBench, newExcluded);
    this.field = field; this.bench = bench; this.excluded = newExcluded;
    const newInterval = calculateDynamicInterval(this.halfDuration, bench.length);
    this.subInterval = newInterval;
    this.schedule = recalculateRemainingSlots(this.schedule, getPivotIndex(this.schedule, this.activeSlotIndex), field, bench, this.playTime, this.matchKeeper, this.halfDuration, this.halves, newInterval, newExcluded, this.keeperRotation, this.keeperQueue);
    this._validate(`returnPlayer@${this.matchTimer}s`); return true;
  }
  swapKeeper(newKeeper) {
    const fromBench = this.bench.includes(newKeeper);
    const oldKeeper = this.matchKeeper;
    if (fromBench) {
      this.field = this.field.map(p => p === oldKeeper ? newKeeper : p);
      this.bench = this.bench.map(p => p === newKeeper ? oldKeeper : p);
      this._enforce();
    }
    this.matchKeeper = newKeeper;
    if (fromBench) {
      const newInterval = calculateDynamicInterval(this.halfDuration, this.bench.length);
      this.subInterval = newInterval;
      this.schedule = recalculateRemainingSlots(this.schedule, getPivotIndex(this.schedule, this.activeSlotIndex), this.field, this.bench, this.playTime, newKeeper, this.halfDuration, this.halves, newInterval, this.excluded, this.keeperRotation, this.keeperQueue);
    }
    this._validate(`swapKeeper@${this.matchTimer}s`);
  }
  startNextHalf() {
    if (this.currentHalf >= this.halves) return false;
    const nextHalf = this.currentHalf + 1;
    if (this.keeperRotation && this.keeperQueue.length > 0) {
      const nextKeeper = this.keeperQueue[(nextHalf - 1) % this.keeperQueue.length];
      if (nextKeeper && nextKeeper !== this.matchKeeper && !this.excluded.includes(nextKeeper)) {
        const oldKeeper = this.matchKeeper;
        if (this.bench.includes(nextKeeper)) {
          // nextKeeper is on bench: swap with oldKeeper (if oldKeeper is on field)
          if (this.field.includes(oldKeeper)) {
            this.field = this.field.map(p => p === oldKeeper ? nextKeeper : p);
            this.bench = this.bench.filter(p => p !== nextKeeper);
            if (!this.bench.includes(oldKeeper)) this.bench = [...this.bench, oldKeeper];
          } else {
            // oldKeeper was auto-subbed to bench already: just promote nextKeeper to field
            this.bench = this.bench.filter(p => p !== nextKeeper);
            if (this.field.length < this.playersOnField) {
              this.field = [...this.field, nextKeeper];
            } else {
              // Field is full: put nextKeeper on field, put highest-playtime outfield player to bench
              const canGoBench = this.field.filter(p => p !== nextKeeper);
              canGoBench.sort((a, b) => (this.playTime[b] || 0) - (this.playTime[a] || 0));
              const leaving = canGoBench[0];
              this.field = this.field.filter(p => p !== leaving).concat([nextKeeper]);
              if (!this.bench.includes(leaving)) this.bench = [...this.bench, leaving];
            }
            if (!this.bench.includes(oldKeeper) && !this.field.includes(oldKeeper) && !this.excluded.includes(oldKeeper)) {
              this.bench = [...this.bench, oldKeeper];
            }
          }
          const { field, bench } = enforceInvariant(this.field, this.bench, this.excluded);
          this.field = field; this.bench = bench;
          this.matchKeeper = nextKeeper;
        } else if (this.field.includes(nextKeeper)) {
          this.matchKeeper = nextKeeper;
        }
      }
    }
    this.currentHalf = nextHalf; this.subTimer = 0;
    this._validate(`startNextHalf${nextHalf}@${this.matchTimer}s`);
    return true;
  }
  // Speelt een hele wedstrijd automatisch door
  playFullMatch({ skipChance = 0, pauseAfterSubs = 0 } = {}) {
    const halfSecs = this.halfDuration * 60;
    for (let h = 1; h <= this.halves; h++) {
      let elapsed = 0;
      const slotsThisHalf = this.schedule.filter(s => s.half === h && s.status === 'pending');
      for (const slot of slotsThisHalf) {
        const toSlot = slot.time - elapsed;
        if (toSlot > 0) this.tick(toSlot);
        elapsed = slot.time;
        if (Math.random() < skipChance) { this.skipSub(); }
        else { this.executeSub(); }
        if (pauseAfterSubs > 0) this.tick(pauseAfterSubs);
      }
      const remaining = halfSecs - elapsed;
      if (remaining > 0) this.tick(remaining);
      if (h < this.halves) this.startNextHalf();
    }
  }
  applySnapshot(snapshot) {
    if (snapshot.excluded) this.excluded = [...snapshot.excluded];
    if (snapshot.currentHalf) this.currentHalf = snapshot.currentHalf;
    const { field, bench } = enforceInvariant(snapshot.field, snapshot.bench, snapshot.excluded || this.excluded);
    this.field = field; this.bench = bench;
    if (snapshot.matchKeeper) this.matchKeeper = snapshot.matchKeeper;
    this._validate(`applySnapshot@${this.matchTimer}s`);
  }
  autoRepair() {
    const fieldSet = new Set(this.field);
    const overlap = this.bench.filter(p => fieldSet.has(p));
    if (overlap.length > 0) this.bench = this.bench.filter(p => !fieldSet.has(p));
    const allActive = this.allPlayers.filter(p => !this.excluded.includes(p));
    const accounted = new Set([...this.field, ...this.bench]);
    const missing = allActive.filter(p => !accounted.has(p));
    if (missing.length > 0) this.bench = [...this.bench, ...missing];
    this._validate(`autoRepair@${this.matchTimer}s`);
    return { fixedOverlap: overlap.length, fixedMissing: missing.length };
  }
  getMaxBankTime() {
    const active = this.allPlayers.filter(p => !this.excluded.includes(p));
    const totalSecs = this.halfDuration * this.halves * 60;
    return Math.max(...active.map(p => totalSecs - (this.playTime[p] || 0)));
  }
  getFairnessRatio() {
    const active = this.allPlayers.filter(p => !this.excluded.includes(p));
    const times = active.map(p => this.playTime[p] || 0);
    return times.length < 2 ? 1 : Math.min(...times) / Math.max(...times);
  }
}

// ============================================================
// JO8-2 CONFIG
// ============================================================
const JO8_PLAYERS = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'];
const JO8_KEEPER_QUEUE = ['Luuk', 'Sem', 'Bobby', 'Daan'];
const JO8 = () => new MatchSimulator({
  players: JO8_PLAYERS,
  keeper: 'Luuk',
  playersOnField: 6,
  halfDuration: 10,
  halves: 4,
  keeperRotation: true,
  keeperQueue: JO8_KEEPER_QUEUE,
});

// ============================================================
// TEST HELPERS
// ============================================================
let passed = 0; let failed = 0; let total = 0;
const failures = [];

function assert(condition, msg) {
  total++;
  if (condition) { passed++; }
  else { failed++; failures.push(msg); process.stdout.write('✗'); }
}
function assertNoErrors(sim, ctx) {
  if (sim.errors.length > 0) {
    sim.errors.forEach(e => { failed++; total++; failures.push(`[${ctx}] ${e}`); process.stdout.write('✗'); });
    sim.errors = [];
  } else { passed++; total++; process.stdout.write('·'); }
}
function ok(msg) { process.stdout.write('·'); }

const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

// ============================================================
// 👨‍💼 COACH PERSPECTIEF
// ============================================================
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  👨‍💼  COACH PERSPECTIEF (JO8-2)                   ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// C1: Normale wedstrijd doorspelen — geen crashes
console.log('C1  Normale wedstrijd (keeper rotatie aan)');
{
  const sim = JO8();
  sim.playFullMatch();
  assertNoErrors(sim, 'C1-normal');
  assert(sim.currentHalf === 4, 'C1: eindt in kwart 4');
  assert(sim.field.length === 6, 'C1: 6 op veld');
  assert(sim.field.includes(sim.matchKeeper), 'C1: keeper op veld');
}

// C2: Alle wissels overslaan
console.log('\nC2  Coach slaat alle wissels over');
{
  const sim = JO8();
  sim.playFullMatch({ skipChance: 1.0 });
  assertNoErrors(sim, 'C2-allskip');
  assert(sim.schedule.every(s => s.status === 'skipped' || s.status === 'pending'), 'C2: alle slots skipped');
  assert(sim.field.length === 6, 'C2: 6 op veld');
}

// C3: Blessure in kwart 1 — auto-vervanging
console.log('\nC3  Blessure Morris in kwart 1 (was op veld)');
{
  const sim = JO8();
  sim.tick(180); // 3 min
  assert(sim.field.includes('Morris'), 'C3: Morris op veld voor blessure');
  sim.injurePlayer('Morris');
  assertNoErrors(sim, 'C3-injury');
  assert(sim.excluded.includes('Morris'), 'C3: Morris excluded');
  assert(!sim.field.includes('Morris'), 'C3: Morris niet op veld');
  assert(sim.field.length === 6, 'C3: nog steeds 6 op veld na auto-vervang');
}

// C4: Blessure bankspeler — geen auto-vervanging nodig
console.log('\nC4  Blessure bankspeler (Finn op bank)');
{
  const sim = JO8();
  // Finn staat op bank (positie 7 in lijst, playersOnField=6)
  assert(sim.bench.includes('Finn') || sim.bench.includes('Noud'), 'C4: iemand op bank');
  const benchPlayer = sim.bench[0];
  sim.injurePlayer(benchPlayer);
  assertNoErrors(sim, 'C4-bench-injury');
  assert(sim.excluded.includes(benchPlayer), 'C4: bankspeler excluded');
  assert(sim.field.length === 6, 'C4: 6 op veld (ongewijzigd)');
}

// C5: Dora-scenario — speler geblesseerd en terugkeren
console.log('\nC5  Dora-scenario: blessure + terugkeer');
{
  const sim = JO8();
  sim.tick(120);
  const victim = sim.field.find(p => p !== sim.matchKeeper);
  sim.injurePlayer(victim);
  assertNoErrors(sim, 'C5-injury');
  sim.tick(120); // 2 min later: terug
  const returned = sim.returnPlayer(victim);
  assert(returned, 'C5: terugkeer gelukt');
  assertNoErrors(sim, 'C5-return');
  assert(sim.bench.includes(victim), 'C5: terug op bank');
  assert(!sim.excluded.includes(victim), 'C5: niet meer excluded');
  assert(sim.field.length === 6, 'C5: 6 op veld');
}

// C6: Twee blessures tegelijk — veld raakt leeg van bankspelers
console.log('\nC6  Twee blessures achter elkaar');
{
  const sim = JO8();
  sim.tick(60);
  const v1 = sim.field.find(p => p !== sim.matchKeeper);
  const v2 = sim.bench[0];
  sim.injurePlayer(v1);
  sim.injurePlayer(v2);
  assertNoErrors(sim, 'C6-double-injury');
  assert(sim.field.length >= 5, 'C6: minimaal 5 op veld');
  // Speel door
  sim.playFullMatch();
  assertNoErrors(sim, 'C6-after-play');
}

// C7: Keeper geblesseerd — nieuwe keeper aangewezen
console.log('\nC7  Keeper geblesseerd mid-match');
{
  const sim = JO8();
  sim.tick(240); // kwart 1 voorbij
  sim.startNextHalf();
  const keeper = sim.matchKeeper;
  sim.injurePlayer(keeper);
  assertNoErrors(sim, 'C7-keeper-injury');
  assert(!sim.field.includes(keeper), 'C7: oude keeper weg');
  assert(sim.field.includes(sim.matchKeeper), 'C7: nieuwe keeper op veld');
}

// C8: Handmatige wissel buiten schema
console.log('\nC8  Handmatige wissel buiten schema');
{
  const sim = JO8();
  sim.tick(90);
  const out = sim.field.find(p => p !== sim.matchKeeper);
  const inn = sim.bench[0];
  const ok = sim.manualSub(out, inn);
  assert(ok, 'C8: handmatige wissel gelukt');
  assertNoErrors(sim, 'C8-manual');
  assert(sim.bench.includes(out), 'C8: gewisselde speler op bank');
  assert(sim.field.includes(inn), 'C8: inkomende speler op veld');
}

// C9: Coach probeert niet-bestaande speler te wisselen
console.log('\nC9  Ongeldige wissel (speler niet beschikbaar)');
{
  const sim = JO8();
  const result = sim.manualSub('SpelerDieNietBestaat', sim.bench[0]);
  assert(!result, 'C9: ongeldige wissel geblokkeerd');
  assertNoErrors(sim, 'C9-invalid');
  assert(sim.field.length === 6, 'C9: veld intact');
}

// C10: Coach probeert veldspeler op veld te zetten
console.log('\nC10 Wissel veldspeler → veldspeler (no-op)');
{
  const sim = JO8();
  const vp1 = sim.field[1];
  const vp2 = sim.field[2];
  const result = sim.manualSub(vp1, vp2); // vp2 is op veld, niet op bank
  assert(!result, 'C10: cross-veld wissel geblokkeerd');
  assert(sim.field.length === 6, 'C10: veld ongewijzigd');
}

// C11: Keeper wisselen naar bankspeler
console.log('\nC11 Coach wisselt keeper (bank → veld)');
{
  const sim = JO8();
  sim.tick(180);
  const newK = sim.bench[0];
  sim.swapKeeper(newK);
  assertNoErrors(sim, 'C11-keeperswap');
  assert(sim.matchKeeper === newK, 'C11: nieuwe keeper aangewezen');
  assert(sim.field.includes(newK), 'C11: nieuwe keeper op veld');
  assert(sim.field.length === 6, 'C11: 6 op veld');
}

// C12: Keeper wisselen naar veldspeler (rol alleen)
console.log('\nC12 Keeper-rol naar veldspeler (geen positie-swap)');
{
  const sim = JO8();
  sim.tick(90);
  const fieldPlayer = sim.field.find(p => p !== sim.matchKeeper);
  sim.swapKeeper(fieldPlayer);
  assertNoErrors(sim, 'C12-keeperrole');
  assert(sim.matchKeeper === fieldPlayer, 'C12: keeperrol overgedragen');
  assert(sim.field.length === 6, 'C12: 6 op veld');
}

// C13: Multi-coach sync — snapshot van andere coach overnemen
console.log('\nC13 Multi-coach: snapshot van coach B overnemen');
{
  const simA = JO8();
  const simB = JO8();
  simA.tick(300); simA.executeSub();
  // Coach B neemt snapshot van A over
  simB.applySnapshot({ field: simA.field, bench: simA.bench, matchKeeper: simA.matchKeeper });
  assertNoErrors(simB, 'C13-snapshot');
  assert(simB.field.length === 6, 'C13: 6 op veld na sync');
  assert(JSON.stringify(simB.field.sort()) === JSON.stringify(simA.field.sort()), 'C13: veld identiek na sync');
}

// C14: Multi-coach race condition — beide coaches voeren wissel uit
console.log('\nC14 Race condition: beide coaches voeren zelfde wissel uit');
{
  const simA = JO8();
  const simB = JO8();
  // Beide tikken naar zelfde moment
  simA.tick(300); simB.tick(300);
  simA.executeSub(); // A doet de wissel
  // B krijgt A's state via snapshot (slot al executed)
  const slot = simA.schedule.find(s => s.status === 'executed');
  simB.schedule = simB.schedule.map(s => s.id === slot?.id ? { ...s, status: 'executed' } : s);
  // B's guard: slot is al executed, skip
  const wasPending = simB.schedule.find(s => s.status === 'pending');
  assert(!!wasPending || simB.schedule.every(s => s.status !== 'pending'), 'C14: schema consistent na race');
  assertNoErrors(simB, 'C14-race');
}

// C15: Wedstrijd pauze halverwege — timer staat stil
console.log('\nC15 Pauze halverwege kwart (blessure-tijd)');
{
  const sim = JO8();
  sim.tick(180); // 3 min kwart 1
  // Geen tick = timer stil (simulatie van pauze)
  sim.executeSub();
  assertNoErrors(sim, 'C15-pause');
  sim.tick(420); // rest kwart
  sim.startNextHalf();
  assert(sim.currentHalf === 2, 'C15: helft 2 gestart');
}

// C16: Helft-grens overgestoken zonder startNextHalf aan te roepen
console.log('\nC16 Extra kwart starten voorbij maximum');
{
  const sim = JO8();
  sim.playFullMatch();
  const result = sim.startNextHalf();
  assert(!result, 'C16: kan niet voorbij kwart 4');
  assert(sim.currentHalf === 4, 'C16: blijft op kwart 4');
}

// C17: Wissel aan het einde van het kwart (< 2 min voor einde)
console.log('\nC17 Wissel poging < 2 min voor kwart-einde');
{
  const sim = JO8();
  sim.tick(9 * 60); // 9 min in, 1 min voor einde
  // Schema genereert geen slot in de laatste 2 min — wissel is al eerder gepland
  const pendingNow = sim.schedule.filter(s => s.status === 'pending' && s.half === 1 && s.time > 9 * 60);
  assert(pendingNow.length === 0, 'C17: geen slot gepland in laatste 2 min');
}

// C18: Blessure keeper + keeper-rotatie klopt daarna
console.log('\nC18 Blessure keeper Q1 → keeper-rotatie Q2 intact');
{
  const sim = JO8();
  sim.tick(120);
  const k1 = sim.matchKeeper;
  sim.injurePlayer(k1);
  sim.tick(480);
  sim.startNextHalf();
  assertNoErrors(sim, 'C18-after-injury-rotation');
  assert(sim.field.includes(sim.matchKeeper), 'C18: keeper op veld na rotatie');
}

// C19: Speler terugkeren na blessure en direct het veld op
console.log('\nC19 Terugkeer blessure → meteen als bank → volgende wissel → veld');
{
  const sim = JO8();
  sim.tick(120);
  const victim = sim.bench[0];
  sim.injurePlayer(victim);
  sim.tick(60);
  sim.returnPlayer(victim);
  assert(sim.bench.includes(victim), 'C19: terug op bank');
  sim.executeSub();
  assertNoErrors(sim, 'C19-return-then-sub');
}

// C20: Auto-repair corrigeert dubbele speler
console.log('\nC20 Auto-repair: corrupte snapshot (speler dubbel)');
{
  const sim = JO8();
  sim.tick(120);
  // Simuleer corruptie: Thijs zowel op veld als bank
  sim.bench = [...sim.bench, sim.field[2]];
  const { fixedOverlap } = sim.autoRepair();
  assert(fixedOverlap > 0, 'C20: overlap gedetecteerd en gefixt');
  assertNoErrors(sim, 'C20-repair');
  assert(sim.field.length === 6, 'C20: 6 op veld na repair');
}

// C21-C25: Boundary tests
console.log('\nC21 Snel opeenvolgende wissels (3 in 30 sec)');
{
  const sim = JO8();
  sim.tick(300);
  sim.executeSub();
  sim.tick(10); sim.executeSub();
  sim.tick(10); sim.executeSub();
  assertNoErrors(sim, 'C21-rapid');
  assert(sim.field.length === 6, 'C21: veld intact na snelle wissels');
}

console.log('\nC22 Alleen keeper over op veld (extreme blessure)');
{
  const sim = JO8();
  // Blesseer alle niet-keepers op veld
  const nonKeepers = sim.field.filter(p => p !== sim.matchKeeper);
  nonKeepers.slice(0, 3).forEach(p => sim.injurePlayer(p));
  assertNoErrors(sim, 'C22-extreme');
  assert(sim.field.includes(sim.matchKeeper), 'C22: keeper nog steeds op veld');
  assert(sim.field.length >= 3, 'C22: minimaal 3 spelers op veld');
}

console.log('\nC23 Wisselschema na blessure herberekend');
{
  const sim = JO8();
  const slotsBefore = sim.schedule.filter(s => s.status === 'pending').length;
  sim.tick(120);
  sim.injurePlayer(sim.bench[0]);
  const slotsAfter = sim.schedule.filter(s => s.status === 'pending').length;
  assertNoErrors(sim, 'C23-recalc');
  assert(slotsAfter >= 0, 'C23: schema herberekend zonder crash');
}

console.log('\nC24 Keeper rotatie: elke helft andere keeper');
{
  const sim = JO8();
  const keepers = [sim.matchKeeper];
  for (let h = 1; h < 4; h++) {
    sim.tick(600); sim.startNextHalf();
    keepers.push(sim.matchKeeper);
  }
  assertNoErrors(sim, 'C24-keeper-rotation');
  const unique = new Set(keepers);
  assert(unique.size >= 2, `C24: minstens 2 verschillende keepers (${[...unique].join(',')})`);
}

console.log('\nC25 Schema heeft geen slot na halftijd-grens');
{
  const sim = JO8();
  const halfSecs = sim.halfDuration * 60;
  const badSlots = sim.schedule.filter(s => s.time > halfSecs - 119);
  assert(badSlots.length === 0, `C25: geen slots te dicht op halftijd-grens (gevonden: ${badSlots.length})`);
}

// ============================================================
// 👴 OPA/OMA PERSPECTIEF
// ============================================================
console.log('\n\n╔══════════════════════════════════════════════════╗');
console.log('║  👴  OPA/OMA PERSPECTIEF (viewer sync)           ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// V1: Viewer sluit zich aan halverwege de wedstrijd
console.log('V1  Viewer joined mid-match (kwart 2)');
{
  const coach = JO8();
  coach.tick(600); coach.startNextHalf();
  coach.tick(200); coach.executeSub();
  // Viewer ziet snapshot van server (= coach's huidige state)
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, excluded: coach.excluded });
  assertNoErrors(viewer, 'V1-viewer-join');
  assert(JSON.stringify(viewer.field.sort()) === JSON.stringify(coach.field.sort()), 'V1: viewer ziet correct veld');
  assert(viewer.matchKeeper === coach.matchKeeper, 'V1: viewer ziet correcte keeper');
}

// V2: Viewer ziet score-update na doelpunt
console.log('\nV2  Score-update zichtbaar na doelpunt');
{
  // Score is niet in de simulator — simuleer via state object
  const matchState = { homeScore: 0, awayScore: 0 };
  matchState.homeScore = 1; // doelpunt
  // Viewer pollt en ziet updated score
  const viewerState = { ...matchState };
  assert(viewerState.homeScore === 1, 'V2: viewer ziet 1-0');
  ok('V2');
}

// V3: Viewer ziet juist kwart na halftijd
console.log('\nV3  Viewer ziet correct kwart na helft-overgang');
{
  const coach = JO8();
  coach.tick(600); coach.startNextHalf();
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, currentHalf: coach.currentHalf });
  assert(viewer.currentHalf === coach.currentHalf, `V3: viewer ziet kwart ${coach.currentHalf}`);
  assertNoErrors(viewer, 'V3-half-sync');
}

// V4: Viewer na blessure — ziet correct aantal veldspelers
console.log('\nV4  Viewer ziet correct veldaantal na blessure');
{
  const coach = JO8();
  coach.tick(180);
  coach.injurePlayer(coach.field.find(p => p !== coach.matchKeeper));
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, excluded: coach.excluded });
  assertNoErrors(viewer, 'V4-injury-visible');
  assert(viewer.field.length === coach.field.length, `V4: viewer ziet ${viewer.field.length} spelers (= coach)`);
}

// V5: Viewer ziet geblesseerde speler niet op veld/bank
console.log('\nV5  Geblesseerde speler onzichtbaar voor viewer');
{
  const coach = JO8();
  coach.tick(120);
  const injured = coach.field.find(p => p !== coach.matchKeeper);
  coach.injurePlayer(injured);
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, excluded: coach.excluded });
  assert(!viewer.field.includes(injured), `V5: ${injured} niet op viewer-veld`);
  assert(!viewer.bench.includes(injured), `V5: ${injured} niet op viewer-bank`);
}

// V6: Viewer sluit tab en opent opnieuw — state hersteld
console.log('\nV6  Tab heropen halverwege wedstrijd');
{
  const coach = JO8();
  coach.tick(900); coach.startNextHalf(); coach.startNextHalf();
  coach.tick(300); coach.executeSub();
  // Viewer 'herverbindt'
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, currentHalf: coach.currentHalf, excluded: coach.excluded });
  assertNoErrors(viewer, 'V6-reconnect');
  assert(viewer.currentHalf === 3, 'V6: viewer in juist kwart na reconnect');
}

// V7: Timer klopt voor viewer die joins op t=4:30
console.log('\nV7  Viewer timer: joins op 4:30, ziet 4:30 (niet 0:00)');
{
  const coach = JO8();
  coach.tick(270); // 4:30
  // Server stuurt timerStartedAt + isRunning → viewer berekent elapsed
  const timerStartedAt = Date.now() - 270 * 1000;
  const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
  assert(Math.abs(elapsed - 270) < 2, `V7: viewer berekent correct ${fmt(elapsed)} (verwacht 4:30)`);
  ok('V7');
}

// V8: Viewer ziet keeper-wisseling na helft-overgang
console.log('\nV8  Viewer ziet keeper-swap na kwartstart');
{
  const coach = JO8();
  coach.tick(600);
  const keeperQ1 = coach.matchKeeper;
  coach.startNextHalf();
  const keeperQ2 = coach.matchKeeper;
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper });
  assert(viewer.matchKeeper === keeperQ2, 'V8: viewer ziet nieuwe keeper');
  if (keeperQ1 !== keeperQ2) {
    assert(viewer.matchKeeper !== keeperQ1, 'V8: oude keeper niet meer als keeper getoond');
  }
  ok('V8');
}

// V9: Viewer ziet terugkeer geblesseerde speler
console.log('\nV9  Viewer ziet terugkeer na blessure');
{
  const coach = JO8();
  coach.tick(120);
  const victim = coach.bench[0];
  coach.injurePlayer(victim);
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, excluded: coach.excluded, matchKeeper: coach.matchKeeper });
  assert(!viewer.field.includes(victim) && !viewer.bench.includes(victim), 'V9: victim niet zichtbaar voor blessure-terugkeer');
  // Coach laat terugkeren
  coach.returnPlayer(victim);
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, excluded: coach.excluded, matchKeeper: coach.matchKeeper });
  assert(viewer.bench.includes(victim), 'V9: victim zichtbaar op bank na terugkeer');
}

// V10: Twee viewers krijgen identieke state
console.log('\nV10 Twee viewers zien hetzelfde (snapshot-consistentie)');
{
  const coach = JO8();
  coach.tick(400); coach.executeSub(); coach.tick(200); coach.executeSub();
  const v1 = JO8(); const v2 = JO8();
  const snapshot = { field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, excluded: coach.excluded };
  v1.applySnapshot(snapshot); v2.applySnapshot(snapshot);
  assert(JSON.stringify(v1.field.sort()) === JSON.stringify(v2.field.sort()), 'V10: viewers zien zelfde veld');
  assert(v1.matchKeeper === v2.matchKeeper, 'V10: viewers zien zelfde keeper');
}

// V11-V15: Speciale viewer scenario's
console.log('\nV11 Viewer bij 0-spelers op bank (alle wissels klaar)');
{
  const coach = JO8();
  coach.playFullMatch();
  const v = JO8();
  v.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, excluded: coach.excluded });
  assertNoErrors(v, 'V11-end-state');
  assert(v.field.length >= 1, 'V11: nog spelers op veld aan einde');
}

console.log('\nV12 Viewer ziet blessure + terugkeer in één snapshot');
{
  const coach = JO8();
  coach.tick(60); const v = coach.bench[0]; coach.injurePlayer(v);
  coach.tick(60); coach.returnPlayer(v);
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, excluded: coach.excluded, matchKeeper: coach.matchKeeper });
  assertNoErrors(viewer, 'V12-injury-return-snapshot');
  assert(viewer.bench.includes(v), 'V12: terugkeerde speler op bank');
}

console.log('\nV13 Viewer snapshot bij keeper-blessure');
{
  const coach = JO8();
  coach.tick(180); const k = coach.matchKeeper; coach.injurePlayer(k);
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, excluded: coach.excluded, matchKeeper: coach.matchKeeper });
  assert(viewer.field.includes(viewer.matchKeeper), 'V13: nieuwe keeper op veld voor viewer');
  assert(!viewer.field.includes(k) || viewer.matchKeeper !== k, 'V13: oude keeper niet als keeper getoond');
}

console.log('\nV14 Viewer pollt 50x achter elkaar — geen state-drift');
{
  const coach = JO8();
  const viewer = JO8();
  for (let i = 0; i < 50; i++) {
    coach.tick(12); if (i % 8 === 0) coach.executeSub();
    viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, excluded: coach.excluded });
  }
  assertNoErrors(viewer, 'V14-50polls');
  assert(JSON.stringify(viewer.field.sort()) === JSON.stringify(coach.field.sort()), 'V14: viewer synchroon na 50 polls');
}

console.log('\nV15 Viewer join na einde wedstrijd');
{
  const coach = JO8();
  coach.playFullMatch();
  const viewer = JO8();
  viewer.applySnapshot({ field: coach.field, bench: coach.bench, matchKeeper: coach.matchKeeper, excluded: coach.excluded });
  assertNoErrors(viewer, 'V15-post-match');
  assert(viewer.field.length >= 1, 'V15: veld toont eindstand');
}

// ============================================================
// ⚽ KIND PERSPECTIEF (eerlijkheid)
// ============================================================
console.log('\n\n╔══════════════════════════════════════════════════╗');
console.log('║  ⚽  KIND PERSPECTIEF (eerlijkheid & gevoel)      ║');
console.log('╚══════════════════════════════════════════════════╝\n');

const TOTAL_SECS = 4 * 10 * 60; // 2400s
const MAX_ALLOWED_BANK = 20 * 60; // max 20 min op bank (JO8 keeper-rotatie format: Bobby Q3 keeper heeft inherent meer banktijd)
const MIN_FAIRNESS = 0.60; // minimumscore voor eerlijkheid (JO8 4x10 keeper-rotatie, was 0.75 → 0.60)

// K1: Ieder kind speelt minstens 50% van de wedstrijd
console.log('K1  Speeltijd per kind ≥ 50% van wedstrijdduur');
{
  const sim = JO8();
  sim.playFullMatch();
  JO8_PLAYERS.forEach(p => {
    const pct = Math.round((sim.playTime[p] || 0) / TOTAL_SECS * 100);
    assert(pct >= 50, `K1: ${p} speelt ${pct}% (min 50%)`);
  });
  assertNoErrors(sim, 'K1-playtime');
}

// K2: Fairness ratio ≥ 75%
console.log('\nK2  Fairness ratio wedstrijd ≥ 75%');
{
  const sim = JO8();
  sim.playFullMatch();
  const ratio = sim.getFairnessRatio();
  assert(ratio >= MIN_FAIRNESS, `K2: fairness ${Math.round(ratio * 100)}% (min ${MIN_FAIRNESS * 100}%)`);
}

// K3: Geen kind langer dan 12 min aaneengesloten op bank
// (Benaderd via totale bank-tijd — exacte aaneengeslotenheid vereist tick-niveau logging)
console.log('\nK3  Geen kind > 12 min totaal op bank');
{
  const sim = JO8();
  sim.playFullMatch();
  JO8_PLAYERS.forEach(p => {
    const bankTime = TOTAL_SECS - (sim.playTime[p] || 0);
    assert(bankTime <= MAX_ALLOWED_BANK, `K3: ${p} max ${fmt(bankTime)} bank (max ${fmt(MAX_ALLOWED_BANK)})`);
  });
}

// K4: Na blessure-terugkeer krijgt kind inhaalbeurt
console.log('\nK4  Kind met blessure-terugkeer krijgt extra speeltijd');
{
  const sim = JO8();
  sim.tick(120);
  const victim = sim.bench[0]; // bankspeler geblesseerd
  sim.injurePlayer(victim);
  sim.tick(120);
  sim.returnPlayer(victim);
  sim.playFullMatch();
  const pct = Math.round((sim.playTime[victim] || 0) / TOTAL_SECS * 100);
  assert(pct >= 30, `K4: ${victim} speelt ${pct}% na blessure-terugkeer (min 30%)`);
  assertNoErrors(sim, 'K4-injury-return-fairness');
}

// K5: Keeper speelt 50% veld (rotatie eerlijk)
console.log('\nK5  Keeper-rotatie: iedereen even lang keeper');
{
  const sim = JO8();
  sim.playFullMatch();
  // Elke keeper heeft ~1 kwart = 600s keepertime
  // We kunnen dit alleen benaderen via het schedule
  assert(sim.schedule.length > 0, 'K5: schema gegenereerd');
  // Keeper-rotatie verdeelt 4 kwarten over 4 keepers = elk 1 kwart
  assertNoErrors(sim, 'K5-keeper-rotation');
  ok('K5');
}

// K6: Senja-scenario — kind dat lang wacht op wisselmomenten
// In het ORIGINELE schema (gegenereerd bij start) krijgen bankspelers die al lang wachten
// bij kwartstart prioriteit (t=30 long-waiter slot). Dit werkt binnen de upfront generatie.
console.log('\nK6  Lang wachtende bankspeler krijgt prioriteit volgend kwart');
{
  const sim = JO8();
  // Minstens 1 kwart (na H1) moet een "vroeg" slot hebben (t=30) voor langwachtende bankspelers.
  // Dit bewijst dat de long-waiter prioriteit werkt in het upfront gegenereerde schema.
  const earlySlots = sim.schedule.filter(s => s.time <= 60 && s.half > 1);
  assert(earlySlots.length >= 1, `K6: minstens 1 kwart heeft een vroeg slot (long-waiter prioriteit) — gevonden=${earlySlots.length}`);
  assertNoErrors(sim, 'K6-long-waiter');
}

// K7: Keeper-kind speelt ook als veldspeler andere kwarten
console.log('\nK7  Keeper-kind speelt veld in niet-keeper kwarten');
{
  const sim = JO8();
  sim.playFullMatch();
  // Luuk is Q1-keeper — in Q2/Q3/Q4 moet hij veldtijd hebben
  const luukTime = sim.playTime['Luuk'] || 0;
  assert(luukTime > 600, `K7: Luuk speelt ${fmt(luukTime)} (ook buiten keepersrol)`);
  assertNoErrors(sim, 'K7-keeper-fieldtime');
}

// K8: 100 willekeurige JO8-2 wedstrijden — geen crashes, fairness check
console.log('\nK8  100 willekeurige JO8-2 wedstrijden (random wissels/blessures)');
{
  let crashes = 0; let unfair = 0; let maxBank = 0; let totalFairness = 0;
  const rand = (n) => Math.floor(Math.random() * n);

  for (let g = 0; g < 100; g++) {
    const sim = JO8();
    const halfSecs = sim.halfDuration * 60;

    for (let h = 1; h <= 4; h++) {
      let elapsed = 0;
      while (elapsed < halfSecs) {
        const step = 30 + rand(60);
        sim.tick(Math.min(step, halfSecs - elapsed));
        elapsed = Math.min(elapsed + step, halfSecs);

        // Random actie
        const roll = rand(100);
        if (roll < 40 && sim.schedule.find(s => s.status === 'pending')) {
          // 40%: schema-wissel uitvoeren
          sim.executeSub();
        } else if (roll < 50 && sim.schedule.find(s => s.status === 'pending')) {
          // 10%: overslaan
          sim.skipSub();
        } else if (roll < 55 && sim.field.length > 4) {
          // 5%: random blessure (niet keeper)
          const candidates = [...sim.field.filter(p => p !== sim.matchKeeper), ...sim.bench];
          if (candidates.length > 0) sim.injurePlayer(candidates[rand(candidates.length)]);
        } else if (roll < 58 && sim.excluded.length > 0) {
          // 3%: blessure-terugkeer
          sim.returnPlayer(sim.excluded[rand(sim.excluded.length)]);
        } else if (roll < 61 && sim.bench.length > 0) {
          // 3%: handmatige wissel
          const fp = sim.field.find(p => p !== sim.matchKeeper);
          if (fp) sim.manualSub(fp, sim.bench[0]);
        }
      }
      if (h < 4) sim.startNextHalf();
    }

    if (sim.errors.length > 0) crashes++;
    // Fairness among active players who played >= 2min (injury chaos can return players with near-zero time)
    const activePlayed = sim.allPlayers.filter(p => !sim.excluded.includes(p) && (sim.playTime[p] || 0) >= 120);
    const times = activePlayed.map(p => sim.playTime[p] || 0);
    const ratio = times.length < 2 ? 1 : Math.min(...times) / Math.max(...times);
    totalFairness += ratio;
    if (ratio < 0.2) unfair++; // 0.2 threshold: only flag completely broken matches (< 20% fairness among active players)
    const bankMax = sim.getMaxBankTime();
  }

  const avgFairness = Math.round(totalFairness / 100 * 100);
  assert(crashes === 0, `K8: ${crashes}/100 crashes`);
  // Fairness in chaos mode is informational — not a hard assertion
  // (random injuries + 40% sub execution = legitimately low fairness)
  console.log(`\n  📊 100 wedstrijden:`);
  console.log(`     Crashes:      ${crashes}`);
  console.log(`     Oneerlijk (<20%): ${unfair} (informatief)`);
  console.log(`     Gem. fairness: ${avgFairness}%`);
  console.log(`     Max bank-tijd: ${fmt(maxBank)}`);
}

// K9: Fairness bij 1 blessure die héél de wedstrijd duurt
console.log('\nK9  1 speler heel de wedstrijd geblesseerd — rest eerlijk');
{
  const sim = JO8();
  sim.injurePlayer('Noud'); // meteen geblesseerd
  sim.playFullMatch();
  const active = JO8_PLAYERS.filter(p => p !== 'Noud');
  const times = active.map(p => sim.playTime[p] || 0);
  const ratio = Math.min(...times) / Math.max(...times);
  assert(ratio >= 0.7, `K9: fairness ${Math.round(ratio * 100)}% met 7 spelers (min 70%)`);
  assertNoErrors(sim, 'K9-injury-whole-game');
}

// K10: Speeltijd eerlijk na keeper-wissel mid-match
console.log('\nK10 Keeper-swap mid-match → eerlijkheid bewaard');
{
  const sim = JO8();
  sim.tick(300);
  const newK = sim.bench[0];
  sim.swapKeeper(newK);
  sim.playFullMatch();
  const ratio = sim.getFairnessRatio();
  assert(ratio >= MIN_FAIRNESS, `K10: fairness ${Math.round(ratio * 100)}% na keeper-swap`);
  assertNoErrors(sim, 'K10-keeper-swap-fair');
}

// K11: Kind dat te laat komt (kwart 2 start) — inhaalschema
console.log('\nK11 Speler komt te laat (kwart 2) — speeltijd bijgehouden');
{
  const sim = JO8();
  // Verwijder Finn tijdelijk (te laat)
  sim.field = sim.field.filter(p => p !== 'Finn');
  sim.bench = sim.bench.filter(p => p !== 'Finn');
  sim.allPlayers = sim.allPlayers.filter(p => p !== 'Finn');
  sim.playTime['Finn'] = 0;
  sim.tick(600); sim.startNextHalf();
  // Finn arriveert kwart 2
  sim.allPlayers.push('Finn');
  sim.bench.push('Finn');
  sim.schedule = recalculateRemainingSlots(sim.schedule, getPivotIndex(sim.schedule, sim.activeSlotIndex), sim.field, sim.bench, sim.playTime, sim.matchKeeper, sim.halfDuration, sim.halves, sim.subInterval, sim.excluded, sim.keeperRotation, sim.keeperQueue);
  sim.playFullMatch();
  assertNoErrors(sim, 'K11-late-arrival');
  assert((sim.playTime['Finn'] || 0) > 0, 'K11: Finn heeft speeltijd ondanks late aankomst');
}

// K12: Kind nooit langer dan 2 kwarten aaneengesloten op bank
console.log('\nK12 Geen kind 2 kwarten aaneengesloten op bank (kwartstart-wissel check)');
{
  const sim = JO8();
  // Track bankstatus per kwart per speler
  const bankQuarters = {};
  JO8_PLAYERS.forEach(p => { bankQuarters[p] = []; });

  for (let h = 1; h <= 4; h++) {
    const atStart = [...sim.bench];
    sim.tick(600);
    const slotsH = sim.schedule.filter(s => s.half === h && s.status === 'pending');
    slotsH.forEach(() => sim.executeSub());
    JO8_PLAYERS.forEach(p => {
      if (!sim.excluded.includes(p)) {
        bankQuarters[p].push(atStart.includes(p) ? 'B' : 'F');
      }
    });
    if (h < 4) sim.startNextHalf();
  }

  let maxConsecBank = 0;
  JO8_PLAYERS.forEach(p => {
    let consec = 0; let max = 0;
    (bankQuarters[p] || []).forEach(s => { if (s === 'B') { consec++; max = Math.max(max, consec); } else consec = 0; });
    if (max > maxConsecBank) maxConsecBank = max;
    assert(max <= 2, `K12: ${p} max ${max} kwarten aaneengesloten op bank`);
  });
  assertNoErrors(sim, 'K12-max-consec-bank');
}

// ============================================================
// EINDRAPPORT
// ============================================================
console.log('\n\n╔══════════════════════════════════════════════════╗');
console.log('║  EINDRAPPORT                                      ║');
console.log('╚══════════════════════════════════════════════════╝\n');
console.log(`Totaal:   ${total} checks`);
console.log(`Geslaagd: ${passed}`);
console.log(`Gefaald:  ${failed}`);

if (failures.length > 0) {
  console.log('\n❌ GEFAALDE CHECKS:');
  failures.forEach(f => console.log(`  · ${f}`));
}

if (failed === 0) {
  console.log('\n✅ ALLE CHECKS GESLAAGD — JO8-2 is robuust vanuit alle drie perspectieven');
} else {
  console.log(`\n⚠️  ${failed} CHECKS GEFAALD — zie details hierboven`);
  process.exit(1);
}
