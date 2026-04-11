/**
 * BOBBY GEVOEL-SIMULATIE
 *
 * Dit is geen technische test. Dit is een simulatie van hoe een
 * zaterdagochtend VOELT voor elk kind en elke ouder.
 *
 * Meetpunten:
 * - Hoeveel minuten speelt mijn kind?
 * - Hoe lang zit mijn kind achter elkaar op de bank?
 * - Hoe vaak wordt mijn kind gewisseld? (elke wissel = emotioneel moment)
 * - Staat mijn kind wéér op de bank terwijl X al 3 kwarten speelt?
 * - Is het voorspelbaar? Kan ik als ouder zien wanneer mijn kind speelt?
 * - Keeper: telt dat als "spelen"? (ja voor het kind, soms niet voor de ouder)
 * - 17-0 scenario: mid-kwart keeper wissel door ouder-druk
 *
 * Run: node test-bobby-gevoel.mjs
 */

// === Core functions (uit useMatchState.js) ===
const dedup = (arr) => [...new Set(arr)];

function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set();
  const cleanField = []; const cleanBench = [];
  const excludedSet = new Set(excluded);
  for (const p of field) { if (!seen.has(p) && !excludedSet.has(p)) { cleanField.push(p); seen.add(p); } }
  for (const p of bench) { if (!seen.has(p) && !excludedSet.has(p)) { cleanBench.push(p); seen.add(p); } }
  return { field: cleanField, bench: cleanBench };
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
    const gracePlayer = (half > 1 && keeperRotationEnabled && prevHalfKeeper && prevHalfKeeper !== halfKeeper)
      ? prevHalfKeeper : null;
    let isFirstSlotOfHalf = true;
    const slotTimes = []; const MIN_BEFORE_END = 120;
    // Kwartstart-wissel voor lang wachtende bankspelers
    const longWaiters = bench.filter(p => (benchWait[p] || 0) >= 2);
    if (half > 1 && longWaiters.length > 0) slotTimes.push(30);
    for (let s = 1; s <= slotsPerHalf; s++) { const t = s * I; if (t <= D - MIN_BEFORE_END && t > 30) slotTimes.push(t); }
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
        return (fieldStreak[b] || 0) - (fieldStreak[a] || 0);
      });
      const goingOut = eligible.slice(0, perSlot);
      const benchSorted = [...bench].sort((a, b) => {
        const waitDiff = (benchWait[b] || 0) - (benchWait[a] || 0);
        if (waitDiff !== 0) return waitDiff;
        return (projected[a] || 0) - (projected[b] || 0);
      });
      const goingIn = benchSorted.slice(0, perSlot);
      if (goingOut.length > 0 && goingIn.length > 0) {
        schedule.push({ id: `slot-${++slotId}`, half, time: slotTime, absoluteTime: (half - 1) * D + slotTime,
          out: [...goingOut], inn: [...goingIn], status: 'pending', executedAt: null });
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

// === GEVOEL-SIMULATOR ===
// Trackt alles wat een kind en ouder VOELEN

class GevoelSimulator {
  constructor({ players, keeper, playersOnField, halfDuration, halves, keeperRotation = false, keeperQueue = [], interval = null }) {
    this.players = [...players];
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

    this.currentHalf = 1;
    this.matchTimer = 0;
    this.subTimer = 0;

    // Interval
    if (interval) {
      this.subInterval = interval;
    } else {
      const benchSize = this.bench.length;
      const slotsNeeded = benchSize <= 2 ? 1 : 1 + (benchSize - 2);
      const usable = halfDuration - 2;
      this.subInterval = Math.max(2, Math.floor(usable / (slotsNeeded + 1)));
    }

    // Schema
    this.schedule = generateSubSchedule(
      players, keeper, playersOnField, halfDuration, halves, this.subInterval,
      {}, [], null, null, keeperRotation, keeperQueue
    );

    // === GEVOEL TRACKING ===
    // Per speler: elk moment bijhouden wat ze doen
    this.timeline = {}; // { "Luuk": [{ from: 0, to: 240, role: "veld" }, { from: 240, to: 480, role: "bank" }] }
    this.playTime = {};
    this.keeperTime = {};
    this.bankTime = {};
    this.subCount = {};   // hoe vaak gewisseld (in+uit)
    this.bankStints = {};  // array van banktijden: [180, 240, 120] (hoe lang elke keer op de bank)
    this.currentBankStart = {}; // wanneer begon deze bankbeurt
    this.goalsByPlayer = {};
    this.errors = [];

    players.forEach(p => {
      this.playTime[p] = 0;
      this.keeperTime[p] = 0;
      this.bankTime[p] = 0;
      this.subCount[p] = 0;
      this.bankStints[p] = [];
      this.timeline[p] = [];
      this.currentBankStart[p] = null;
      this.goalsByPlayer[p] = 0;
    });

    // Initieel: wie zit op de bank?
    this.bench.forEach(p => {
      this.currentBankStart[p] = 0;
      this.timeline[p].push({ from: 0, role: 'bank' });
    });
    this.field.forEach(p => {
      this.timeline[p].push({ from: 0, role: p === keeper ? 'keeper' : 'veld' });
    });
  }

  _closeTimeline(player, at) {
    const tl = this.timeline[player];
    if (tl.length > 0 && !tl[tl.length - 1].to) {
      tl[tl.length - 1].to = at;
    }
  }

  _openTimeline(player, at, role) {
    this._closeTimeline(player, at);
    this.timeline[player].push({ from: at, role });
  }

  tick(seconds) {
    this.matchTimer += seconds;
    this.subTimer += seconds;
    this.field.forEach(p => {
      this.playTime[p] += seconds;
      if (p === this.matchKeeper) this.keeperTime[p] += seconds;
    });
    this.bench.forEach(p => {
      this.bankTime[p] += seconds;
    });
  }

  executeSub() {
    const slot = this.schedule.find(s => s.status === 'pending');
    if (!slot) return false;

    let { out, inn } = slot;
    if (this.matchKeeper && out.includes(this.matchKeeper)) {
      out = out.filter(p => p !== this.matchKeeper);
      inn = inn.slice(0, out.length);
      if (out.length === 0) {
        slot.status = 'skipped';
        return false;
      }
    }

    // Track wisselgevoel
    out.forEach(p => {
      this.subCount[p]++;
      this._openTimeline(p, this.matchTimer, 'bank');
      this.currentBankStart[p] = this.matchTimer;
    });
    inn.forEach(p => {
      this.subCount[p]++;
      this._openTimeline(p, this.matchTimer, 'veld');
      // Sluit bankperiode
      if (this.currentBankStart[p] !== null) {
        this.bankStints[p].push(this.matchTimer - this.currentBankStart[p]);
        this.currentBankStart[p] = null;
      }
    });

    const nf = this.field.filter(p => !out.includes(p)).concat(inn);
    const nb = this.bench.filter(p => !inn.includes(p)).concat(out);
    const e = enforceInvariant(nf, nb, this.excluded);
    this.field = e.field; this.bench = e.bench;

    slot.status = 'executed';
    this.subTimer = 0;
    return true;
  }

  swapKeeper(newKeeper) {
    const oldKeeper = this.matchKeeper;
    const fromBench = this.bench.includes(newKeeper);

    if (fromBench) {
      const nf = this.field.map(p => p === oldKeeper ? newKeeper : p);
      const nb = this.bench.map(p => p === newKeeper ? oldKeeper : p);
      const e = enforceInvariant(nf, nb, this.excluded);
      this.field = e.field; this.bench = e.bench;

      this._openTimeline(newKeeper, this.matchTimer, 'keeper');
      if (this.currentBankStart[newKeeper] !== null) {
        this.bankStints[newKeeper].push(this.matchTimer - this.currentBankStart[newKeeper]);
        this.currentBankStart[newKeeper] = null;
      }
      this._openTimeline(oldKeeper, this.matchTimer, 'bank');
      this.currentBankStart[oldKeeper] = this.matchTimer;
      this.subCount[newKeeper]++;
      this.subCount[oldKeeper]++;
    } else {
      this._openTimeline(newKeeper, this.matchTimer, 'keeper');
      this._openTimeline(oldKeeper, this.matchTimer, 'veld');
    }

    this.matchKeeper = newKeeper;
  }

  manualSub(fieldPlayer, benchPlayer) {
    if (!this.field.includes(fieldPlayer) || !this.bench.includes(benchPlayer)) return false;
    const wasKeeper = fieldPlayer === this.matchKeeper;

    this.subCount[fieldPlayer]++;
    this.subCount[benchPlayer]++;
    this._openTimeline(fieldPlayer, this.matchTimer, 'bank');
    this.currentBankStart[fieldPlayer] = this.matchTimer;
    this._openTimeline(benchPlayer, this.matchTimer, wasKeeper ? 'keeper' : 'veld');
    if (this.currentBankStart[benchPlayer] !== null) {
      this.bankStints[benchPlayer].push(this.matchTimer - this.currentBankStart[benchPlayer]);
      this.currentBankStart[benchPlayer] = null;
    }

    const nf = this.field.map(p => p === fieldPlayer ? benchPlayer : p);
    const nb = this.bench.map(p => p === benchPlayer ? fieldPlayer : p);
    const e = enforceInvariant(nf, nb, this.excluded);
    this.field = e.field; this.bench = e.bench;
    if (wasKeeper) this.matchKeeper = benchPlayer;
    return true;
  }

  injurePlayer(player) {
    const wasOnField = this.field.includes(player);
    this._closeTimeline(player, this.matchTimer);
    this.timeline[player].push({ from: this.matchTimer, role: 'uit' });

    let nf = [...this.field]; let nb = [...this.bench];
    if (wasOnField) {
      nf = nf.filter(p => p !== player);
      if (nb.length > 0) {
        const repl = [...nb].sort((a, b) => (this.playTime[a]||0) - (this.playTime[b]||0))[0];
        nf.push(repl); nb = nb.filter(p => p !== repl);
        this._openTimeline(repl, this.matchTimer, 'veld');
        if (this.currentBankStart[repl] !== null) {
          this.bankStints[repl].push(this.matchTimer - this.currentBankStart[repl]);
          this.currentBankStart[repl] = null;
        }
      }
    } else { nb = nb.filter(p => p !== player); }

    if (player === this.matchKeeper && nf.length > 0) this.matchKeeper = nf[0];
    const e = enforceInvariant(nf, nb, [...this.excluded, player]);
    this.field = e.field; this.bench = e.bench;
    this.excluded.push(player);
  }

  startNextHalf() {
    if (this.currentHalf >= this.halves) return false;
    const nextHalf = this.currentHalf + 1;

    if (this.keeperRotation && this.keeperQueue.length > 0) {
      const nextKeeper = this.keeperQueue[(nextHalf - 1) % this.keeperQueue.length];
      if (nextKeeper && nextKeeper !== this.matchKeeper && !this.excluded.includes(nextKeeper)) {
        const isOnBench = this.bench.includes(nextKeeper);
        if (isOnBench) {
          const old = this.matchKeeper;
          const nf = this.field.map(p => p === old ? nextKeeper : p);
          const nb = this.bench.map(p => p === nextKeeper ? old : p);
          const e = enforceInvariant(nf, nb, this.excluded);
          this.field = e.field; this.bench = e.bench;
          this._openTimeline(nextKeeper, this.matchTimer, 'keeper');
          if (this.currentBankStart[nextKeeper] !== null) {
            this.bankStints[nextKeeper].push(this.matchTimer - this.currentBankStart[nextKeeper]);
            this.currentBankStart[nextKeeper] = null;
          }
          this._openTimeline(old, this.matchTimer, 'bank');
          this.currentBankStart[old] = this.matchTimer;
        } else {
          this._openTimeline(this.matchKeeper, this.matchTimer, 'veld');
          this._openTimeline(nextKeeper, this.matchTimer, 'keeper');
        }
        this.matchKeeper = nextKeeper;
      }
    }

    this.currentHalf = nextHalf;
    this.subTimer = 0;
    return true;
  }

  goal(scorer) {
    this.goalsByPlayer[scorer] = (this.goalsByPlayer[scorer] || 0) + 1;
  }

  // Sluit alle timelines af
  finalize() {
    this.players.forEach(p => this._closeTimeline(p, this.matchTimer));
    // Sluit openstaande bankperiodes
    this.bench.forEach(p => {
      if (this.currentBankStart[p] !== null) {
        this.bankStints[p].push(this.matchTimer - this.currentBankStart[p]);
      }
    });
  }

  // === GEVOEL-RAPPORT ===
  printReport(title) {
    this.finalize();
    const total = this.matchTimer;
    const fm = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

    console.log(`\n${'─'.repeat(64)}`);
    console.log(`  ${title}`);
    console.log(`${'─'.repeat(64)}`);
    console.log(`  Wedstrijd: ${this.halves}x${this.halfDuration}min = ${fm(total)} | Interval: ${this.subInterval}min`);
    console.log(`  Schema: ${this.schedule.filter(s=>s.status==='executed').length} uitgevoerd, ${this.schedule.filter(s=>s.status==='skipped').length} overgeslagen\n`);

    // Sorteer op speeltijd (minste eerst = meest "benadeeld gevoel")
    const sorted = this.players
      .filter(p => !this.excluded.includes(p))
      .map(p => ({
        name: p,
        fieldTime: this.playTime[p] - this.keeperTime[p],
        keeperTime: this.keeperTime[p],
        totalPlay: this.playTime[p],
        bankTotal: this.bankTime[p],
        subs: this.subCount[p],
        maxBank: this.bankStints[p].length > 0 ? Math.max(...this.bankStints[p]) : 0,
        bankCount: this.bankStints[p].length,
        goals: this.goalsByPlayer[p] || 0,
      }))
      .sort((a, b) => a.totalPlay - b.totalPlay);

    const maxPlay = Math.max(...sorted.map(p => p.totalPlay));
    const minPlay = Math.min(...sorted.map(p => p.totalPlay));

    console.log('  Naam      Veld    Keeper  Bank   Wissels  MaxBank  Gevoel');
    console.log('  ────────  ──────  ──────  ─────  ───────  ───────  ──────');

    sorted.forEach(p => {
      const pct = Math.round(p.totalPlay / total * 100);
      const bar = '█'.repeat(Math.round(pct / 5));
      const bankBar = p.maxBank > 0 ? `${fm(p.maxBank)}` : '-';

      // GEVOEL-INDICATOR
      let gevoel = '';
      if (p.totalPlay === maxPlay) gevoel = '😊 meest gespeeld';
      else if (p.totalPlay === minPlay) gevoel = '😕 minst gespeeld';
      else if (p.maxBank >= 8 * 60) gevoel = '😤 lang op bank';
      else if (p.subs >= 5) gevoel = '😵 vaak gewisseld';
      else if (p.keeperTime > 0 && p.fieldTime < total * 0.3) gevoel = '🧤 vooral keeper';
      else gevoel = '😊 prima';

      console.log(
        `  ${p.name.padEnd(10)}${fm(p.fieldTime).padStart(6)}  ${fm(p.keeperTime).padStart(6)}  ${fm(p.bankTotal).padStart(5)}  ${String(p.subs).padStart(5)}x  ${bankBar.padStart(7)}  ${gevoel}`
      );
    });

    const diff = maxPlay - minPlay;
    console.log(`\n  Verschil max-min: ${fm(diff)} (${Math.round(diff/60)} min)`);
    if (diff <= 2 * 60) console.log('  ✅ Uitstekend — verschil minder dan 2 minuten');
    else if (diff <= 4 * 60) console.log('  ✅ Goed — verschil minder dan 4 minuten');
    else if (diff <= 8 * 60) console.log('  ⚠️ Matig — verschil meer dan 4 minuten');
    else console.log('  ❌ Oneerlijk — verschil meer dan 8 minuten');

    // Timeline view
    console.log('\n  TIMELINE (elke ─ = 1 minuut):');
    const minuteWidth = Math.ceil(total / 60);

    // Kwarttijden
    let halfLine = '  '.padEnd(12);
    for (let m = 0; m < minuteWidth; m++) {
      const kwart = Math.floor(m / this.halfDuration) + 1;
      if (m % this.halfDuration === 0) halfLine += `K${kwart}`;
      else if (m % this.halfDuration === 1) halfLine += '';
      else halfLine += ' ';
    }
    console.log(halfLine);

    sorted.forEach(p => {
      let line = `  ${p.name.padEnd(10)}`;
      for (let m = 0; m < minuteWidth; m++) {
        const sec = m * 60;
        const tl = this.timeline[p.name].find(t => t.from <= sec && (!t.to || t.to > sec));
        if (!tl) { line += '·'; continue; }
        switch (tl.role) {
          case 'veld': line += '█'; break;
          case 'keeper': line += '🧤'[0]; break;  // K
          case 'bank': line += '░'; break;
          case 'uit': line += '✕'; break;
          default: line += '?';
        }
      }
      line += ` ${Math.round(p.totalPlay/total*100)}%`;
      console.log(line);
    });

    console.log('  Legenda: █=veld  K=keeper  ░=bank  ✕=uit\n');

    return { maxPlay, minPlay, diff, sorted };
  }
}


// ============================================================
// Helper: speel een standaard wedstrijd
// ============================================================
function playMatch(sim, events = []) {
  for (let half = 1; half <= sim.halves; half++) {
    if (half > 1) sim.startNextHalf();

    for (let sec = 0; sec < sim.halfDuration * 60; sec += 10) {
      sim.tick(10);

      // Process events op dit tijdstip
      const absTime = (half - 1) * sim.halfDuration * 60 + sec + 10;
      events.filter(e => e.at === absTime).forEach(e => {
        switch (e.type) {
          case 'injury': sim.injurePlayer(e.player); break;
          case 'keeperSwap': sim.swapKeeper(e.player); break;
          case 'manualSub': sim.manualSub(e.out, e.inn); break;
          case 'goal': sim.goal(e.player); break;
        }
      });

      if (sim.subTimer >= sim.subInterval * 60) {
        sim.executeSub();
      }
    }
  }
}


console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  BOBBY GEVOEL-SIMULATIE                                     ║');
console.log('║  Hoe voelt een wedstrijd voor elk kind en elke ouder?       ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const PLAYERS = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'];
const KEEPERS = ['Luuk', 'Sem', 'Bobby', 'Daan'];

// ============================================================
// WEDSTRIJD 1: Perfecte wedstrijd — geen incidenten
// ============================================================
{
  const sim = new GevoelSimulator({
    players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });
  playMatch(sim);
  sim.printReport('WEDSTRIJD 1: Perfecte wedstrijd (geen incidenten)');
}


// ============================================================
// WEDSTRIJD 2: 17-0 scenario
// Luuk scoort 5 goals in kwart 1. Moeder roept dat Luuk keeper
// moet worden. Coach wisselt Luuk naar keeper halverwege kwart 2.
// ============================================================
{
  const sim = new GevoelSimulator({
    players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });

  // Kwart 1: Luuk is keeper maar scoort goals (veldspelers scoren eigenlijk)
  // Kwart 2: Sem is keeper via rotatie
  // Na 4 min in kwart 2: moeder van Luuk vindt dat Luuk moet keepen
  playMatch(sim, [
    { at: 60, type: 'goal', player: 'Luuk' },
    { at: 150, type: 'goal', player: 'Luuk' },
    { at: 240, type: 'goal', player: 'Morris' },
    { at: 350, type: 'goal', player: 'Luuk' },
    { at: 500, type: 'goal', player: 'Luuk' },
    // Kwart 2, 4 min: moeder eist keeper swap
    { at: 840, type: 'keeperSwap', player: 'Luuk' },
    { at: 900, type: 'goal', player: 'Luuk' },
  ]);
  const r = sim.printReport('WEDSTRIJD 2: 17-0 scenario — Luuk moet keepen van moeder');
  console.log('  Wat hier mis kan gaan:');
  console.log('  - Luuk was al keeper kwart 1, wordt nu WEER keeper kwart 2');
  console.log('  - Sem (eigenlijk keeper kwart 2) wordt ineens naar veld/bank gestuurd');
  console.log('  - Het wisselschema klopt niet meer (berekend met Sem als keeper)');
  console.log('  - Luuk staat straks 3 kwarten in het doel → "hij speelt niet echt"');
}


// ============================================================
// WEDSTRIJD 3: Twee blessures + keeper valt uit
// ============================================================
{
  const sim = new GevoelSimulator({
    players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });

  playMatch(sim, [
    // Kwart 1, 6 min: Noud krijgt bal tegen hoofd
    { at: 360, type: 'injury', player: 'Noud' },
    // Kwart 3, 3 min: keeper Bobby (kwart 3 keeper) botst met tegenstander
    { at: 1380, type: 'injury', player: 'Bobby' },
  ]);
  sim.printReport('WEDSTRIJD 3: Twee blessures + keeper valt uit');
}


// ============================================================
// WEDSTRIJD 4: Coach wisselt handmatig (overruled het schema)
// Kind X had net gewisseld, maar coach vindt dat Y eruit moet
// ============================================================
{
  const sim = new GevoelSimulator({
    players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });

  playMatch(sim, [
    // Kwart 2, 7 min: coach wisselt handmatig (buiten schema)
    { at: 1020, type: 'manualSub', out: 'Morris', inn: 'Finn' },
    // Kwart 3, 5 min: coach wisselt weer handmatig
    { at: 1500, type: 'manualSub', out: 'Daan', inn: 'Thijs' },
  ]);
  sim.printReport('WEDSTRIJD 4: Coach overruled schema met handmatige wissels');
}


// ============================================================
// WEDSTRIJD 5: 7 spelers (1 op bank) — iemand afgemeld
// ============================================================
{
  const players7 = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn'];
  const sim = new GevoelSimulator({
    players: players7, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });
  playMatch(sim);
  sim.printReport('WEDSTRIJD 5: 7 spelers (Noud afgemeld)');
}


// ============================================================
// WEDSTRIJD 6: Keeper rotatie gestopt halverwege (coach besluit)
// ============================================================
{
  const sim = new GevoelSimulator({
    players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });

  // Speel kwart 1+2 normaal
  for (let half = 1; half <= 2; half++) {
    if (half > 1) sim.startNextHalf();
    for (let sec = 0; sec < 10 * 60; sec += 10) {
      sim.tick(10);
      if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  // Coach zet rotatie uit na kwart 2
  sim.keeperRotation = false;

  // Kwart 3+4: zelfde keeper als kwart 2
  for (let half = 3; half <= 4; half++) {
    sim.startNextHalf();
    for (let sec = 0; sec < 10 * 60; sec += 10) {
      sim.tick(10);
      if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  sim.printReport('WEDSTRIJD 6: Keeper rotatie gestopt na kwart 2');
}


// ============================================================
// WEDSTRIJD 7: Kwart 3 eerder afgefloten (7 min i.p.v. 10)
// ============================================================
{
  const sim = new GevoelSimulator({
    players: PLAYERS, keeper: 'Luuk', playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });

  for (let half = 1; half <= 4; half++) {
    if (half > 1) sim.startNextHalf();
    const duration = (half === 3) ? 7 * 60 : 10 * 60; // kwart 3 = 7 min
    for (let sec = 0; sec < duration; sec += 10) {
      sim.tick(10);
      if (sim.subTimer >= sim.subInterval * 60) sim.executeSub();
    }
  }

  sim.printReport('WEDSTRIJD 7: Kwart 3 eerder afgefloten (7 min)');
}


// ============================================================
// SEIZOENSANALYSE: 8 wedstrijden met wisselende bank-start
// ============================================================
console.log('\n' + '═'.repeat(64));
console.log('  SEIZOENSANALYSE: 8 wedstrijden');
console.log('═'.repeat(64));

const seasonStats = {};
PLAYERS.forEach(p => {
  seasonStats[p] = { totalPlay: 0, totalKeeper: 0, totalBank: 0, maxBankEver: 0,
    totalSubs: 0, games: 0, bankStarts: 0, longestBenchStreak: 0 };
});

for (let game = 0; game < 8; game++) {
  // Roteer spelerslijst: elke wedstrijd andere 2 op de bank
  const keeper = KEEPERS[game % KEEPERS.length];
  const nonKeeper = PLAYERS.filter(p => p !== keeper);
  const rotated = [...nonKeeper.slice((game * 2) % nonKeeper.length), ...nonKeeper.slice(0, (game * 2) % nonKeeper.length)];
  const ordered = [keeper, ...rotated];

  const sim = new GevoelSimulator({
    players: ordered, keeper, playersOnField: 6,
    halfDuration: 10, halves: 4,
    keeperRotation: true, keeperQueue: KEEPERS,
  });

  playMatch(sim);
  sim.finalize();

  // Accumuleer
  ordered.forEach(p => {
    seasonStats[p].totalPlay += sim.playTime[p];
    seasonStats[p].totalKeeper += sim.keeperTime[p];
    seasonStats[p].totalBank += sim.bankTime[p];
    seasonStats[p].totalSubs += sim.subCount[p];
    seasonStats[p].games++;
    if (sim.bench.includes(p) || sim.bankStints[p].length > 0) {
      // Was ooit op bank
    }
    const maxB = sim.bankStints[p].length > 0 ? Math.max(...sim.bankStints[p]) : 0;
    if (maxB > seasonStats[p].maxBankEver) seasonStats[p].maxBankEver = maxB;
    if (sim.timeline[p][0]?.role === 'bank') seasonStats[p].bankStarts++;
  });
}

const fm = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

console.log('\n  Cumulatief over 8 wedstrijden (gesorteerd op speeltijd):');
console.log('  Naam      Veld      Keeper    Bank      Wissels  BankStart  MaxBank');
console.log('  ────────  ────────  ────────  ────────  ───────  ─────────  ───────');

const seasonSorted = Object.entries(seasonStats)
  .sort((a, b) => b[1].totalPlay - a[1].totalPlay);

const maxSeason = seasonSorted[0][1].totalPlay;
const minSeason = seasonSorted[seasonSorted.length - 1][1].totalPlay;

seasonSorted.forEach(([name, s]) => {
  const pct = Math.round(s.totalPlay / maxSeason * 100);
  console.log(
    `  ${name.padEnd(10)}` +
    `${fm(s.totalPlay - s.totalKeeper).padStart(8)}  ` +
    `${fm(s.totalKeeper).padStart(8)}  ` +
    `${fm(s.totalBank).padStart(8)}  ` +
    `${String(s.totalSubs).padStart(5)}x  ` +
    `${String(s.bankStarts).padStart(7)}x  ` +
    `${fm(s.maxBankEver).padStart(7)}`
  );
});

console.log(`\n  Seizoen fairness: ${Math.round(minSeason / maxSeason * 100)}% (min/max speeltijd)`);
console.log(`  Verschil: ${fm(maxSeason - minSeason)} over 8 wedstrijden (${Math.round((maxSeason-minSeason)/60/8)} min/wedstrijd gemiddeld)`);

if (minSeason / maxSeason >= 0.85) console.log('  ✅ Uitstekend — bijna gelijke speeltijd over het seizoen');
else if (minSeason / maxSeason >= 0.70) console.log('  ✅ Goed — acceptabel verschil');
else console.log('  ⚠️ Kan beter — overweeg bank-start rotatie');
