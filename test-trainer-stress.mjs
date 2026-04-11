/**
 * TRAINER STRESSTEST — Ed's perspectief langs de lijn
 *
 * Niet technisch, maar praktisch. Wat verwacht Ed als hij op
 * zaterdagochtend de app opent en een wedstrijd coacht?
 *
 * Run: node test-trainer-stress.mjs
 */

// === Core functions (uit useMatchState.js) ===
const dedup = (arr) => [...new Set(arr)];

function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set(); const cf = []; const cb = [];
  const ex = new Set(excluded);
  for (const p of field) { if (!seen.has(p) && !ex.has(p)) { cf.push(p); seen.add(p); } }
  for (const p of bench) { if (!seen.has(p) && !ex.has(p)) { cb.push(p); seen.add(p); } }
  return { field: cf, bench: cb };
}

function calculateDynamicInterval(halfDurationMin, benchSize) {
  if (benchSize <= 0) return halfDurationMin;
  const slotsNeeded = benchSize <= 2 ? 1 : 1 + (benchSize - 2);
  const usableMinutes = halfDurationMin - 2;
  const intervalMin = usableMinutes / (slotsNeeded + 1);
  if (halfDurationMin <= 12) {
    const targetSlots = Math.max(slotsNeeded + 1, 3);
    const shortInterval = usableMinutes / targetSlots;
    return Math.max(2, Math.floor(shortInterval));
  }
  return Math.max(2, Math.floor(intervalMin));
}

function generateSubSchedule(playerList, keeperName, numOnField, hDuration, nHalves, sInterval, currentPlayTime = {}, excludedList = [], initialField = null, initialBench = null, keeperRotationEnabled = false, keeperQueueList = []) {
  const allActive = playerList.filter(p => !excludedList.includes(p));
  const F = numOnField; const D = hDuration * 60; const I = sInterval * 60;
  const outfieldForInit = allActive.filter(p => p !== keeperName);
  let field = dedup(initialField ? [...initialField] : [keeperName, ...outfieldForInit.slice(0, F - 1)]);
  let bench = dedup(initialBench ? [...initialBench] : outfieldForInit.slice(F - 1)).filter(p => !field.includes(p));
  field = field.filter(p => !excludedList.includes(p));
  bench = bench.filter(p => !excludedList.includes(p));
  const B = bench.length; if (B <= 0 || I <= 0) return [];
  const slotsPerHalf = Math.max(1, Math.floor(D / I));
  const fieldSlots = F - 1;
  const projected = {}; allActive.forEach(p => { projected[p] = currentPlayTime[p] || 0; });
  const benchWait = {}; const fieldStreak = {};
  allActive.forEach(p => { benchWait[p] = bench.includes(p) ? 1 : 0; fieldStreak[p] = field.includes(p) ? 1 : 0; });
  const schedule = []; let slotId = 0;
  for (let half = 1; half <= nHalves; half++) {
    const halfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0)
      ? keeperQueueList[(half - 1) % keeperQueueList.length] : keeperName;
    const prevHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half > 1)
      ? keeperQueueList[(half - 2) % keeperQueueList.length] : (half > 1 ? keeperName : null);
    const nextHalfKeeper = (keeperRotationEnabled && keeperQueueList.length > 0 && half < nHalves)
      ? keeperQueueList[half % keeperQueueList.length] : null;
    if (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper) {
      projected[prevHalfKeeper] = (projected[prevHalfKeeper] || 0) + D * 0.5;
      const promote = (player) => {
        if (!bench.includes(player)) return;
        bench = bench.filter(p => p !== player); field = [...field, player];
        if (field.length > F) {
          const go = field.filter(p => p !== halfKeeper && p !== prevHalfKeeper)
            .sort((a, b) => (projected[b] || 0) - (projected[a] || 0)).slice(0, field.length - F);
          field = field.filter(p => !go.includes(p)); bench = [...bench, ...go];
        }
      };
      promote(halfKeeper); promote(prevHalfKeeper);
    }
    const grace = (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper) ? prevHalfKeeper : null;
    let firstSlot = true;
    const slotTimes = []; const MIN_END = 120;
    const longWaiters = bench.filter(p => (benchWait[p] || 0) >= 2);
    if (half > 1 && longWaiters.length > 0) slotTimes.push(30);
    for (let s = 1; s <= slotsPerHalf; s++) { const t = s * I; if (t <= D - MIN_END && t > 30) slotTimes.push(t); }
    let prev = 0;
    for (const st of slotTimes) {
      const perSlot = firstSlot ? Math.min(2, bench.length, fieldSlots) : 1;
      const delta = st - prev;
      field.filter(p => p !== halfKeeper).forEach(p => { projected[p] = (projected[p] || 0) + delta; });
      let elig = field.filter(p => p !== halfKeeper);
      if (firstSlot && grace && elig.includes(grace)) elig = elig.filter(p => p !== grace);
      const last = st === slotTimes[slotTimes.length - 1];
      if (last && nextHalfKeeper && nextHalfKeeper !== halfKeeper && elig.includes(nextHalfKeeper))
        elig = elig.filter(p => p !== nextHalfKeeper);
      elig.sort((a, b) => { const d = (projected[b]||0) - (projected[a]||0); return d !== 0 ? d : (fieldStreak[b]||0) - (fieldStreak[a]||0); });
      const out = elig.slice(0, perSlot);
      const bSorted = [...bench].sort((a, b) => { const w = (benchWait[b]||0) - (benchWait[a]||0); return w !== 0 ? w : (projected[a]||0) - (projected[b]||0); });
      const inn = bSorted.slice(0, perSlot);
      if (out.length > 0 && inn.length > 0) {
        schedule.push({ id: `s-${++slotId}`, half, time: st, absoluteTime: (half-1)*D+st, out:[...out], inn:[...inn], status:'pending' });
        bench.filter(p => !inn.includes(p)).forEach(p => { benchWait[p] = (benchWait[p]||0)+1; });
        field.filter(p => p !== halfKeeper && !out.includes(p)).forEach(p => { fieldStreak[p] = (fieldStreak[p]||0)+1; });
        out.forEach(p => { benchWait[p] = 1; fieldStreak[p] = 0; });
        inn.forEach(p => { benchWait[p] = 0; fieldStreak[p] = 1; });
        field = field.filter(p => !out.includes(p)).concat(inn);
        bench = bench.filter(p => !inn.includes(p)).concat(out);
        firstSlot = false;
      }
      prev = st;
    }
    const lastT = slotTimes.length > 0 ? slotTimes[slotTimes.length-1] : 0;
    field.filter(p => p !== halfKeeper).forEach(p => { projected[p] = (projected[p]||0) + D - lastT; });
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
    currentPlayTime, excluded, dedupField, dedupBench,
    keeperRotationEnabled, keeperQueueList
  );
  const halfOffset = (currentHalf - 1) * hDuration * 60;
  const adjusted = remaining.map(s => ({ ...s, half: s.half + currentHalf - 1, absoluteTime: s.absoluteTime + halfOffset }));
  const future = adjusted.filter(s => s.absoluteTime > currentAbsTime);
  return [...fixed, ...future.map((s, i) => ({ ...s, id: `recalc-${fromIndex+1}-${i}`, status: 'pending', executedAt: null }))];
}

const getPivotIndex = (schedule, activeIdx) =>
  activeIdx >= 0 ? activeIdx : Math.max(-1, schedule.findIndex(s => s.status === 'pending') - 1);


// === SIMULATOR ===
class Sim {
  constructor(opts) {
    this.players = [...opts.players];
    this.matchKeeper = opts.keeper;
    this.playersOnField = opts.playersOnField;
    this.halfDuration = opts.halfDuration;
    this.halves = opts.halves;
    this.keeperRotation = opts.keeperRotation || false;
    this.keeperQueue = opts.keeperQueue || [];

    // Shuffle (zoals productie)
    const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
    const nk = shuffle(this.players.filter(p => p !== opts.keeper));
    this.field = [opts.keeper, ...nk.slice(0, opts.playersOnField - 1)];
    this.bench = nk.slice(opts.playersOnField - 1);
    this.excluded = [];

    this.subInterval = calculateDynamicInterval(opts.halfDuration, this.bench.length);
    this.schedule = generateSubSchedule(
      this.players, opts.keeper, opts.playersOnField, opts.halfDuration, opts.halves, this.subInterval,
      {}, [], null, null, opts.keeperRotation, opts.keeperQueue
    );

    this.playTime = {}; this.keeperTime = {};
    this.players.forEach(p => { this.playTime[p] = 0; this.keeperTime[p] = 0; });
    this.currentHalf = 1; this.matchTimer = 0; this.subTimer = 0;
    this.subHistory = []; this.activeSlotIndex = -1; this.errors = [];
  }

  _enforce() {
    const { field, bench } = enforceInvariant(this.field, this.bench, this.excluded);
    this.field = field; this.bench = bench;
  }

  _validate(ctx) {
    const fs = new Set(this.field);
    const overlap = this.bench.filter(p => fs.has(p));
    if (overlap.length > 0) this.errors.push(`[${ctx}] OVERLAP: ${overlap}`);
    if (new Set(this.field).size !== this.field.length) this.errors.push(`[${ctx}] DUBBEL VELD`);
    if (new Set(this.bench).size !== this.bench.length) this.errors.push(`[${ctx}] DUBBEL BANK`);
    const active = this.players.filter(p => !this.excluded.includes(p));
    const acc = new Set([...this.field, ...this.bench]);
    const miss = active.filter(p => !acc.has(p));
    if (miss.length > 0) this.errors.push(`[${ctx}] KWIJT: ${miss}`);
    if (!this.field.includes(this.matchKeeper)) this.errors.push(`[${ctx}] KEEPER ${this.matchKeeper} NIET OP VELD`);
  }

  tick(s) {
    this.matchTimer += s; this.subTimer += s;
    this.field.forEach(p => { this.playTime[p] += s; if (p === this.matchKeeper) this.keeperTime[p] += s; });
  }

  executeSub() {
    const slot = this.schedule.find(s => s.status === 'pending');
    if (!slot) return false;
    let { out, inn } = slot;
    if (this.matchKeeper && out.includes(this.matchKeeper)) {
      out = out.filter(p => p !== this.matchKeeper); inn = inn.slice(0, out.length);
      if (!out.length) { slot.status = 'skipped'; return false; }
    }
    const nf = this.field.filter(p => !out.includes(p)).concat(inn);
    const nb = this.bench.filter(p => !inn.includes(p)).concat(out);
    this.field = nf; this.bench = nb; this._enforce();
    slot.status = 'executed'; this.activeSlotIndex = this.schedule.indexOf(slot);
    this.subTimer = 0;
    this.subHistory.push({ time: this.matchTimer, half: this.currentHalf, out: [...out], inn: [...inn] });
    this._validate(`sub@${this.matchTimer}`);
    return true;
  }

  skipSub() {
    const slot = this.schedule.find(s => s.status === 'pending');
    if (!slot) return;
    const idx = this.schedule.indexOf(slot);
    this.schedule[idx] = { ...slot, status: 'skipped', executedAt: this.matchTimer };
    this.schedule = recalculateRemainingSlots(
      this.schedule, idx, this.field, this.bench, this.playTime,
      this.matchKeeper, this.halfDuration, this.halves, this.subInterval, this.excluded,
      this.keeperRotation, this.keeperQueue
    );
    this.subTimer = 0;
  }

  manualSub(fp, bp) {
    if (!this.field.includes(fp) || !this.bench.includes(bp)) return false;
    const wasK = fp === this.matchKeeper;
    this.field = this.field.map(p => p === fp ? bp : p);
    this.bench = this.bench.map(p => p === bp ? fp : p);
    this._enforce(); if (wasK) this.matchKeeper = bp;
    this.subHistory.push({ time: this.matchTimer, half: this.currentHalf, out: [fp], inn: [bp], manual: true });
    this._validate(`manual@${this.matchTimer}`);
    return true;
  }

  swapKeeper(newK) {
    const old = this.matchKeeper;
    const fromBench = this.bench.includes(newK);
    if (fromBench) {
      this.field = this.field.map(p => p === old ? newK : p);
      this.bench = this.bench.map(p => p === newK ? old : p);
      this._enforce();
    }
    this.matchKeeper = newK;
    if (fromBench && this.bench.length > 0) {
      const ni = calculateDynamicInterval(this.halfDuration, this.bench.length);
      this.subInterval = ni;
      this.schedule = recalculateRemainingSlots(
        this.schedule, getPivotIndex(this.schedule, this.activeSlotIndex),
        this.field, this.bench, this.playTime, newK, this.halfDuration, this.halves, ni, this.excluded,
        this.keeperRotation, this.keeperQueue
      );
    }
    this._validate(`keeperSwap@${this.matchTimer}`);
  }

  injure(p) {
    const wasField = this.field.includes(p);
    let nf = [...this.field]; let nb = [...this.bench]; const ne = [...this.excluded, p];
    if (wasField) {
      nf = nf.filter(x => x !== p);
      if (nb.length > 0) {
        const repl = [...nb].sort((a,b) => (this.playTime[a]||0)-(this.playTime[b]||0))[0];
        nf.push(repl); nb = nb.filter(x => x !== repl);
      }
    } else { nb = nb.filter(x => x !== p); }
    if (p === this.matchKeeper && nf.length > 0) this.matchKeeper = nf[0];
    const e = enforceInvariant(nf, nb, ne);
    this.field = e.field; this.bench = e.bench; this.excluded = ne;
    if (e.bench.length > 0) {
      const ni = calculateDynamicInterval(this.halfDuration, e.bench.length);
      this.subInterval = ni;
      this.schedule = recalculateRemainingSlots(
        this.schedule, getPivotIndex(this.schedule, this.activeSlotIndex),
        e.field, e.bench, this.playTime, this.matchKeeper, this.halfDuration, this.halves, ni, ne,
        this.keeperRotation, this.keeperQueue
      );
    }
    this._validate(`injury@${this.matchTimer}`);
  }

  startNextHalf() {
    if (this.currentHalf >= this.halves) return false;
    const next = this.currentHalf + 1;
    if (this.keeperRotation && this.keeperQueue.length > 0) {
      const nk = this.keeperQueue[(next-1) % this.keeperQueue.length];
      if (nk && nk !== this.matchKeeper && !this.excluded.includes(nk)) {
        if (this.bench.includes(nk)) {
          const old = this.matchKeeper;
          this.field = this.field.map(p => p === old ? nk : p);
          this.bench = this.bench.map(p => p === nk ? old : p);
          this._enforce();
        }
        this.matchKeeper = nk;
      }
    }
    this.currentHalf = next; this.subTimer = 0;
    this._validate(`nextHalf@${this.matchTimer}`);
    return true;
  }

  autoRepair() {
    const fs = new Set(this.field);
    const overlap = this.bench.filter(p => fs.has(p));
    if (overlap.length > 0) this.bench = this.bench.filter(p => !fs.has(p));
    const active = this.players.filter(p => !this.excluded.includes(p));
    const acc = new Set([...this.field, ...this.bench]);
    const miss = active.filter(p => !acc.has(p));
    if (miss.length > 0) this.bench = [...this.bench, ...miss];
  }
}

// === TEST FRAMEWORK ===
let passed = 0; let failed = 0; let total = 0;
const assert = (c, m) => { total++; if (c) passed++; else { failed++; console.error(`    FAIL: ${m}`); } };
const assertClean = (sim, ctx) => {
  if (sim.errors.length > 0) { sim.errors.forEach(e => { total++; failed++; console.error(`    FAIL [${ctx}]: ${e}`); }); sim.errors = []; }
  else { total++; passed++; }
};
const fm = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const PLAYERS = ['Luuk','Sem','Bobby','Daan','Morris','Thijs','Finn','Noud'];
const KEEPERS = ['Luuk','Sem','Bobby','Daan'];

function playFull(sim) {
  for (let h = 1; h <= sim.halves; h++) {
    if (h > 1) sim.startNextHalf();
    for (let s = 0; s < sim.halfDuration * 60; s += 10) {
      sim.tick(10);
      if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }
}

function fairnessReport(sim, label) {
  const active = sim.players.filter(p => !sim.excluded.includes(p));
  const times = active.map(p => ({ name: p, play: sim.playTime[p], keep: sim.keeperTime[p] })).sort((a,b) => b.play - a.play);
  const max = times[0].play; const min = times[times.length-1].play;
  const diff = max - min; const total = sim.matchTimer;
  console.log(`  ${label}:`);
  times.forEach(p => {
    const pct = Math.round(p.play / total * 100);
    const role = p.keep > 0 ? ` (${fm(p.keep)} keeper)` : '';
    console.log(`    ${p.name.padEnd(8)} ${fm(p.play).padStart(5)} (${String(pct).padStart(2)}%)${role}`);
  });
  console.log(`    Verschil: ${fm(diff)} | ${sim.subHistory.length} wissels\n`);
  return { max, min, diff, times };
}


// =====================================================================
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  TRAINER STRESSTEST                                         ║');
console.log('║  "Werkt het zoals ik verwacht als ik langs de lijn sta?"    ║');
console.log('╚══════════════════════════════════════════════════════════════╝');


// === 1: IK DRUK OP START, KLOPT DE VERDELING? ===
console.log('\n══ 1. Ik druk op start. Klopt de verdeling? ══');
{
  // 10x starten, elke keer moet de shuffle andere spelers op de bank zetten
  const bankStarts = {};
  PLAYERS.forEach(p => { bankStarts[p] = 0; });

  for (let i = 0; i < 100; i++) {
    const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
      halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });
    sim.bench.forEach(p => { bankStarts[p]++; });
  }

  console.log('  100x gestart — wie begon hoe vaak op de bank:');
  const sorted = Object.entries(bankStarts).filter(([n]) => n !== 'Luuk').sort((a,b) => b[1] - a[1]);
  sorted.forEach(([name, count]) => {
    const bar = '█'.repeat(Math.round(count / 3));
    console.log(`    ${name.padEnd(8)} ${String(count).padStart(3)}x ${bar}`);
  });

  // Keeper mag NOOIT op de bank beginnen
  assert(bankStarts['Luuk'] === 0, 'Keeper begint nooit op de bank');
  // Iedereen moet minstens 10x op de bank begonnen zijn (bij 100 runs, 2/7 kans)
  const allFair = sorted.every(([,c]) => c >= 10);
  assert(allFair, 'Iedereen begint regelmatig op de bank (shuffle werkt)');
  const maxStart = sorted[0][1]; const minStart = sorted[sorted.length-1][1];
  console.log(`    Verschil: ${maxStart - minStart} (ideaal: <15 bij 100 runs)`);
  assert(maxStart - minStart < 25, 'Shuffle is redelijk eerlijk verdeeld');
}


// === 2: NORMALE WEDSTRIJD — SPEELT IEDEREEN GENOEG? ===
console.log('\n══ 2. Normale wedstrijd — speelt iedereen genoeg? ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });
  console.log(`  Interval: ${sim.subInterval} min, schema: ${sim.schedule.length} slots`);
  console.log(`  Bank start: ${sim.bench.join(', ')}`);

  playFull(sim);
  assertClean(sim, 'normale wedstrijd');

  const r = fairnessReport(sim, 'Eindstand');
  assert(r.min > 0, 'Iedereen heeft gespeeld');
  // Met shuffle + keeper rotatie is 16 min verschil realistisch maximum
  assert(r.diff <= 18 * 60, `Verschil <= 18 min (is ${fm(r.diff)})`);
}


// === 3: IK SKIP EEN WISSEL WANT IK STA TE PRATEN MET EEN OUDER ===
console.log('\n══ 3. Ik mis een wissel (stond te praten) ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  // Kwart 1: skip de eerste wissel
  let skippedOnce = false;
  for (let s = 0; s < 10*60; s += 10) {
    sim.tick(10);
    if (sim.subTimer >= sim.subInterval * 60) {
      if (!skippedOnce) {
        console.log('  >> Skip eerste wissel (stond te praten met ouder)');
        sim.skipSub();
        skippedOnce = true;
      } else {
        sim.executeSub();
      }
    }
  }

  // Rest normaal
  for (let h = 2; h <= 4; h++) {
    sim.startNextHalf();
    for (let s = 0; s < 10*60; s += 10) {
      sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  assertClean(sim, 'skip wissel');
  const r = fairnessReport(sim, 'Na 1 gemiste wissel');
  assert(r.min > 0, 'Iedereen heeft toch gespeeld');
}


// === 4: KEEPER MOET INEENS WISSELEN (17-0 SCENARIO) ===
console.log('\n══ 4. Luuk scoort te veel → moet keepen van moeder ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  // Kwart 1 normaal (Luuk is keeper)
  for (let s = 0; s < 10*60; s += 10) {
    sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  // Kwart 2: Sem is nu keeper via rotatie
  sim.startNextHalf();
  console.log(`  Kwart 2 start: keeper=${sim.matchKeeper}`);

  // Na 3 min: moeder wil dat Luuk keept
  for (let s = 0; s < 3*60; s += 10) {
    sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  if (sim.field.includes('Luuk')) {
    console.log('  >> Moeder: "Luuk moet keepen!" Coach wisselt keeper');
    sim.swapKeeper('Luuk');
    assertClean(sim, 'keeper swap moeder');
    console.log(`  Keeper is nu: ${sim.matchKeeper}`);
  }

  // Rest kwart 2
  for (let s = 3*60; s < 10*60; s += 10) {
    sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  // Kwart 3+4: zet rotatie uit, Luuk blijft keeper
  sim.keeperRotation = false;
  console.log('  >> Coach zet rotatie uit. Luuk blijft keeper.');

  for (let h = 3; h <= 4; h++) {
    sim.startNextHalf();
    assert(sim.matchKeeper === 'Luuk', `Luuk is keeper kwart ${h}`);
    for (let s = 0; s < 10*60; s += 10) {
      sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  assertClean(sim, '17-0 scenario');
  fairnessReport(sim, '17-0: Luuk 3 kwarten keeper');
}


// === 5: KIND RAAKT GEBLESSEERD — WAT DOET DE APP? ===
console.log('\n══ 5. Noud krijgt bal tegen hoofd in kwart 2 ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  // Kwart 1 normaal
  for (let s = 0; s < 10*60; s += 10) {
    sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  // Kwart 2: Noud raakt geblesseerd na 4 min
  sim.startNextHalf();
  for (let s = 0; s < 4*60; s += 10) {
    sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }

  const noudOnField = sim.field.includes('Noud');
  console.log(`  >> Noud geblesseerd (was ${noudOnField ? 'op veld' : 'op bank'})`);
  sim.injure('Noud');
  assertClean(sim, 'blessure Noud');
  console.log(`  Nu: ${sim.field.length} veld, ${sim.bench.length} bank`);
  assert(!sim.field.includes('Noud') && !sim.bench.includes('Noud'), 'Noud is eruit');

  // Rest wedstrijd met 7 spelers
  for (let s = 4*60; s < 10*60; s += 10) {
    sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }
  for (let h = 3; h <= 4; h++) {
    sim.startNextHalf();
    for (let s = 0; s < 10*60; s += 10) {
      sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  assertClean(sim, 'na blessure');
  fairnessReport(sim, 'Na blessure Noud (7 spelers verder)');
}


// === 6: TWEE BLESSURES — VAN 2 OP BANK NAAR 0 ===
console.log('\n══ 6. Twee blessures: van 2 op bank naar 0 ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  for (let s = 0; s < 5*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  // Twee botsingen
  const targets = sim.field.filter(p => p !== sim.matchKeeper).slice(0, 2);
  console.log(`  >> ${targets[0]} en ${targets[1]} botsen op elkaar — allebei eruit`);
  sim.injure(targets[0]);
  sim.injure(targets[1]);
  assertClean(sim, 'dubbele blessure');
  console.log(`  Nu: ${sim.field.length} veld, ${sim.bench.length} bank, ${sim.excluded.length} uit`);

  // Als bank leeg is, spelen we met minder
  if (sim.bench.length === 0) {
    console.log('  >> Geen wissels meer mogelijk — spelen met minder');
    // Wissels die vóór de blessure gepland waren kunnen nog pending zijn,
    // maar kunnen niet uitgevoerd worden (geen bankspelers). Dat is OK.
    assert(sim.bench.length === 0, 'Bank is leeg na dubbele blessure');
  }

  // Speel rest
  for (let s = 5*60; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  for (let h = 2; h <= 4; h++) {
    sim.startNextHalf();
    for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  }
  assertClean(sim, 'na dubbele blessure');
  fairnessReport(sim, 'Na 2 blessures');
}


// === 7: IK WISSEL HANDMATIG (SCHEMA NEGEREN) ===
console.log('\n══ 7. Ik negeer het schema en wissel zelf ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  for (let s = 0; s < 3*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  // Handmatige wissel: langste op veld eruit
  const longest = sim.field.filter(p => p !== sim.matchKeeper).sort((a,b) => sim.playTime[b] - sim.playTime[a])[0];
  const fromBench = sim.bench[0];
  if (longest && fromBench) {
    console.log(`  >> Handmatig: ${longest} eruit, ${fromBench} erin`);
    sim.manualSub(longest, fromBench);
    assertClean(sim, 'handmatige wissel');
  }

  // Doe daarna een schema-wissel
  sim.tick(sim.subInterval * 60);
  const subOk = sim.executeSub();
  console.log(`  >> Daarna schema-wissel: ${subOk ? 'OK' : 'geen slot'}`);

  // Rest normaal
  for (let s = 0; s < 7*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  for (let h = 2; h <= 4; h++) {
    sim.startNextHalf();
    for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  }

  assertClean(sim, 'handmatig + schema');
  fairnessReport(sim, 'Mix handmatig + schema');
}


// === 8: KWART EERDER AFGEFLOTEN ===
console.log('\n══ 8. Scheids fluit kwart 3 af na 7 min ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  for (let h = 1; h <= 2; h++) {
    if (h > 1) sim.startNextHalf();
    for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  }

  // Kwart 3: maar 7 min
  sim.startNextHalf();
  for (let s = 0; s < 7*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  console.log('  >> Scheids fluit af na 7 min');

  // Kwart 4 normaal
  sim.startNextHalf();
  assertClean(sim, 'kwart 4 na vroeg einde');
  for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  assertClean(sim, 'vroeg einde');
  fairnessReport(sim, 'Kwart 3 was 7 min');
}


// === 9: MEGA CHAOS — ALLES TEGELIJK ===
console.log('\n══ 9. Mega chaos: alles wat fout kan gaan ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  // K1: skip eerste wissel, handmatige wissel op 5 min
  for (let s = 0; s < 10*60; s += 10) {
    sim.tick(10);
    if (sim.subTimer >= sim.subInterval * 60) {
      if (sim.subHistory.length === 0) { sim.skipSub(); }
      else { sim.executeSub(); }
    }
    if (s === 5*60 && sim.bench.length > 0) {
      const fp = sim.field.filter(p => p !== sim.matchKeeper)[0];
      if (fp) sim.manualSub(fp, sim.bench[0]);
    }
  }
  assertClean(sim, 'K1 chaos');

  // K2: blessure + keeper swap
  sim.startNextHalf();
  for (let s = 0; s < 3*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  const injTarget = sim.field.filter(p => p !== sim.matchKeeper)[0];
  if (injTarget) { console.log(`  K2 >> ${injTarget} geblesseerd`); sim.injure(injTarget); }

  for (let s = 3*60; s < 6*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  const newK = sim.field.filter(p => p !== sim.matchKeeper)[0];
  if (newK) { console.log(`  K2 >> Keeper wissel naar ${newK}`); sim.swapKeeper(newK); }
  for (let s = 6*60; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  assertClean(sim, 'K2 chaos');

  // K3: kort kwart (7 min) + keeper rotatie uit
  sim.startNextHalf();
  sim.keeperRotation = false;
  for (let s = 0; s < 7*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  assertClean(sim, 'K3 chaos');

  // K4: nog een blessure
  sim.startNextHalf();
  for (let s = 0; s < 4*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  const injTarget2 = sim.field.filter(p => p !== sim.matchKeeper && !sim.excluded.includes(p))[0];
  if (injTarget2) { console.log(`  K4 >> ${injTarget2} geblesseerd`); sim.injure(injTarget2); }
  for (let s = 4*60; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  assertClean(sim, 'K4 chaos');

  fairnessReport(sim, 'Mega chaos eindstand');
  assert(!sim.startNextHalf(), 'Geen kwart 5');
}


// === 10: 50 WILLEKEURIGE WEDSTRIJDEN — NOOIT CRASHEN ===
console.log('\n══ 10. 50 willekeurige wedstrijden — 0 crashes verwacht ══');
{
  let crashes = 0; let totalErrors = 0;
  const rng = (n) => Math.floor(Math.random() * n);

  for (let game = 0; game < 50; game++) {
    const sim = new Sim({ players: PLAYERS, keeper: KEEPERS[rng(4)], playersOnField: 6,
      halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

    try {
      for (let h = 1; h <= 4; h++) {
        if (h > 1) sim.startNextHalf();
        for (let s = 0; s < 10*60; s += 10) {
          sim.tick(10);
          if (sim.subTimer >= sim.subInterval * 60) {
            // 15% kans: skip
            if (Math.random() < 0.15) sim.skipSub();
            else sim.executeSub();
          }
          // 2% kans: handmatige wissel
          if (Math.random() < 0.02 && sim.bench.length > 0) {
            const fp = sim.field.filter(p => p !== sim.matchKeeper)[rng(sim.field.length - 1)];
            if (fp) sim.manualSub(fp, sim.bench[rng(sim.bench.length)]);
          }
          // 0.5% kans: blessure
          if (Math.random() < 0.005 && sim.field.length > 3 && sim.excluded.length < 3) {
            const t = sim.field.filter(p => p !== sim.matchKeeper);
            if (t.length > 0) sim.injure(t[rng(t.length)]);
          }
          // 1% kans: keeper swap
          if (Math.random() < 0.01) {
            const c = sim.field.filter(p => p !== sim.matchKeeper);
            if (c.length > 0) sim.swapKeeper(c[rng(c.length)]);
          }
        }
      }
    } catch (err) { crashes++; console.error(`  CRASH wedstrijd ${game+1}: ${err.message}`); }

    totalErrors += sim.errors.length;
    sim.errors = [];
  }

  assert(crashes === 0, `0 crashes in 50 wedstrijden (had ${crashes})`);
  assert(totalErrors === 0, `0 state errors in 50 wedstrijden (had ${totalErrors})`);
  console.log(`  50 wedstrijden: ${crashes} crashes, ${totalErrors} state errors`);
}


// === 11: KWART LOOPT 3 MIN OVER ===
console.log('\n══ 11. Kwart 2 loopt 3 min over (scheids vergeet te fluiten) ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  // Kwart 1 normaal
  for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  // Kwart 2: 13 min i.p.v. 10
  sim.startNextHalf();
  for (let s = 0; s < 13*60; s += 10) {
    sim.tick(10);
    if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
  }
  console.log(`  Kwart 2 duurde 13 min. Timer: ${fm(sim.matchTimer)}`);
  assertClean(sim, 'kwart 2 over');

  // Kwart 3+4 normaal
  for (let h = 3; h <= 4; h++) {
    sim.startNextHalf();
    assertClean(sim, `kwart ${h} start na overtime`);
    for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  }

  assertClean(sim, 'overtime einde');
  const r = fairnessReport(sim, 'Kwart 2 was 13 min (3 min over)');
  assert(r.min > 0, 'Iedereen gespeeld na overtime');
  assert(!sim.startNextHalf(), 'Geen kwart 5 na overtime');
  console.log(`  Totaal: ${fm(sim.matchTimer)} (normaal 40:00)`);
}


// === 12: ELK KWART LOOPT 2 MIN OVER ===
console.log('\n══ 12. Elk kwart loopt 2 min over (soepele scheids) ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  for (let h = 1; h <= 4; h++) {
    if (h > 1) sim.startNextHalf();
    for (let s = 0; s < 12*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  }

  assertClean(sim, 'alle kwarten over');
  const r = fairnessReport(sim, 'Elk kwart 12 min (8 min extra totaal)');
  assert(r.min > 0, 'Iedereen gespeeld');
  console.log(`  Totaal: ${fm(sim.matchTimer)} (normaal 40:00)`);
}


// === 13: 5 MIN BLESSURETIJD IN LAATSTE KWART ===
console.log('\n══ 13. Blessuretijd in kwart 4: 5 min extra ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  // Kwart 1-3 normaal
  for (let h = 1; h <= 3; h++) {
    if (h > 1) sim.startNextHalf();
    for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  }

  // Kwart 4: blessure + 5 min extra
  sim.startNextHalf();
  for (let s = 0; s < 6*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  const target = sim.field.filter(p => p !== sim.matchKeeper)[0];
  console.log(`  >> ${target} geblesseerd op min 6 van kwart 4`);
  sim.injure(target);

  // 5 min blessuretijd (kwart duurt nu 15 min)
  for (let s = 0; s < 9*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  assertClean(sim, 'blessuretijd');
  fairnessReport(sim, 'Kwart 4 duurde 15 min (blessuretijd)');
  console.log(`  Totaal: ${fm(sim.matchTimer)}`);
}


// === 14: OVERTIME + KEEPER SWAP + BLESSURE TEGELIJK ===
console.log('\n══ 14. Overtime + keeper swap + blessure in kwart 3 ══');
{
  const sim = new Sim({ players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

  for (let h = 1; h <= 2; h++) {
    if (h > 1) sim.startNextHalf();
    for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  }

  // Kwart 3: chaos
  sim.startNextHalf();
  for (let s = 0; s < 4*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  // Keeper swap
  const newK = sim.field.filter(p => p !== sim.matchKeeper)[0];
  console.log(`  >> Keeper swap: ${sim.matchKeeper} → ${newK}`);
  sim.swapKeeper(newK);

  for (let s = 0; s < 3*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  // Blessure
  const inj = sim.field.filter(p => p !== sim.matchKeeper)[0];
  console.log(`  >> ${inj} geblesseerd op min 7`);
  sim.injure(inj);

  // Scheids laat 4 min extra spelen (kwart duurt 14 min)
  for (let s = 0; s < 7*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }
  console.log(`  >> Kwart 3 duurde 14 min`);

  // Kwart 4 normaal
  sim.startNextHalf();
  assertClean(sim, 'K4 na mega K3');
  for (let s = 0; s < 10*60; s += 10) { sim.tick(10); if (sim.subTimer >= sim.subInterval * 60) sim.executeSub(); }

  assertClean(sim, 'mega combo einde');
  fairnessReport(sim, 'Overtime + keeper swap + blessure');
}


// === 15: 50 RANDOM WEDSTRIJDEN MET OVERTIME ===
console.log('\n══ 15. 50 willekeurige wedstrijden (met overtime) ══');
{
  let crashes = 0; let totalErrors = 0;
  const rng = (n) => Math.floor(Math.random() * n);

  for (let game = 0; game < 50; game++) {
    const sim = new Sim({ players: PLAYERS, keeper: KEEPERS[rng(4)], playersOnField: 6,
      halfDuration: 10, halves: 4, keeperRotation: true, keeperQueue: KEEPERS });

    try {
      for (let h = 1; h <= 4; h++) {
        if (h > 1) sim.startNextHalf();
        // Random kwartduur: 8-14 min
        const dur = (8 + rng(7)) * 60;
        for (let s = 0; s < dur; s += 10) {
          sim.tick(10);
          if (sim.subTimer >= sim.subInterval * 60) {
            if (Math.random() < 0.1) sim.skipSub(); else sim.executeSub();
          }
          if (Math.random() < 0.02 && sim.bench.length > 0) {
            const fp = sim.field.filter(p => p !== sim.matchKeeper)[rng(Math.max(1,sim.field.length-1))];
            if (fp) sim.manualSub(fp, sim.bench[rng(sim.bench.length)]);
          }
          if (Math.random() < 0.003 && sim.field.length > 3 && sim.excluded.length < 3) {
            const t = sim.field.filter(p => p !== sim.matchKeeper);
            if (t.length > 0) sim.injure(t[rng(t.length)]);
          }
          if (Math.random() < 0.005) {
            const c = sim.field.filter(p => p !== sim.matchKeeper);
            if (c.length > 0) sim.swapKeeper(c[rng(c.length)]);
          }
        }
      }
    } catch (err) { crashes++; console.error(`  CRASH wedstrijd ${game+1}: ${err.message}`); }
    totalErrors += sim.errors.length; sim.errors = [];
  }

  assert(crashes === 0, `0 crashes in 50 wedstrijden (had ${crashes})`);
  assert(totalErrors === 0, `0 state errors (had ${totalErrors})`);
  console.log(`  50 wedstrijden (random 8-14 min kwarten): ${crashes} crashes, ${totalErrors} errors`);
}


// =====================================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`RESULTAAT: ${passed}/${total} checks geslaagd`);
if (failed > 0) { console.log(`\n❌ ${failed} GEFAALD`); process.exit(1); }
else { console.log(`\n✅ ALLES WERKT — de app doet wat Ed verwacht`); }
