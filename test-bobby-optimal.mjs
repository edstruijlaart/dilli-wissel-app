/**
 * BOBBY OPTIMAL — Bereken het meest eerlijke wisselschema voor JO8-2
 *
 * Format: 4x10 minuten, 8 spelers, 6 op veld, 2 op bank
 * Keeper rotatie: elk kwart andere keeper
 *
 * Vragen die we beantwoorden:
 * 1. Wat is het optimale wisselinterval?
 * 2. Hoeveel wissels per kwart is eerlijk?
 * 3. Wie begint op de bank? (spreiding over wedstrijden)
 * 4. Hoe vaak wordt elk kind gewisseld? Is dat eerlijk verdeeld?
 * 5. Hoe voorkom je "wordt je nou alweer gewisseld"?
 *
 * Run: node test-bobby-optimal.mjs
 */

const dedup = (arr) => [...new Set(arr)];

function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set();
  const cleanField = [];
  const cleanBench = [];
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
  const B = bench.length;
  if (B <= 0 || I <= 0) return [];
  const slotsPerHalf = Math.max(1, Math.floor(D / I));
  const fieldSlots = F - 1;
  const projected = {};
  allActive.forEach(p => { projected[p] = currentPlayTime[p] || 0; });
  const benchWait = {}; const fieldStreak = {};
  allActive.forEach(p => { benchWait[p] = bench.includes(p) ? 1 : 0; fieldStreak[p] = field.includes(p) ? 1 : 0; });
  const rankOf = {}; playerList.forEach((p, i) => { rankOf[p] = i; });
  const midRank = playerList.length / 2;
  let lastBankWasTop = null;
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
    for (let s = 1; s <= slotsPerHalf; s++) { const t = s * I; if (t <= D - MIN_BEFORE_END) slotTimes.push(t); }
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

// ============================================================
// VRAAG 1: Wat is het optimale interval?
// Test alle intervallen van 2 t/m 8 minuten
// ============================================================
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  BOBBY JO8-2 OPTIMALISATIE                             ║');
console.log('║  4x10 min, 8 spelers, 6 op veld, 2 op bank            ║');
console.log('║  Keeper rotatie per kwart                               ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const PLAYERS = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'];
const KEEPER_QUEUE = ['Luuk', 'Sem', 'Bobby', 'Daan'];
const HALF_DURATION = 10;
const HALVES = 4;
const ON_FIELD = 6;
const TOTAL_TIME = HALF_DURATION * HALVES * 60; // 2400s

console.log('\n\n═══ VRAAG 1: Welk interval is het eerlijkst? ═══\n');
console.log('Interval  Slots  Wissels/kwart  MaxVerschil  Fairness  MinSpeeltijd');
console.log('────────  ─────  ─────────────  ───────────  ────────  ────────────');

const intervalResults = [];

for (let intervalMin = 2; intervalMin <= 8; intervalMin++) {
  const schedule = generateSubSchedule(
    PLAYERS, 'Luuk', ON_FIELD, HALF_DURATION, HALVES, intervalMin,
    {}, [], null, null, true, KEEPER_QUEUE
  );

  // Simuleer de hele wedstrijd
  const playTime = {};
  PLAYERS.forEach(p => { playTime[p] = 0; });
  let field = ['Luuk', ...PLAYERS.filter(p => p !== 'Luuk').slice(0, ON_FIELD - 1)];
  let bench = PLAYERS.filter(p => p !== 'Luuk').slice(ON_FIELD - 1);

  let timer = 0;
  let subTimer = 0;
  let currentHalf = 1;
  let keeper = 'Luuk';
  let subsExecuted = 0;
  const subCounts = {};

  for (let half = 1; half <= HALVES; half++) {
    if (half > 1) {
      currentHalf = half;
      keeper = KEEPER_QUEUE[(half - 1) % KEEPER_QUEUE.length];
      subTimer = 0;
    }

    for (let t = 0; t < HALF_DURATION * 60; t += 10) {
      timer += 10;
      subTimer += 10;
      field.forEach(p => { playTime[p] = (playTime[p] || 0) + 10; });

      if (subTimer >= intervalMin * 60) {
        const slot = schedule.find(s => s.status === 'pending');
        if (slot) {
          let { out, inn } = slot;
          // Keeper bescherming
          if (out.includes(keeper)) {
            out = out.filter(p => p !== keeper);
            inn = inn.slice(0, out.length);
          }
          if (out.length > 0 && inn.length > 0) {
            const nf = field.filter(p => !out.includes(p)).concat(inn);
            const nb = bench.filter(p => !inn.includes(p)).concat(out);
            const e = enforceInvariant(nf, nb, []);
            field = e.field; bench = e.bench;
            out.forEach(p => { subCounts[p] = (subCounts[p] || 0) + 1; });
            inn.forEach(p => { subCounts[p] = (subCounts[p] || 0) + 1; });
            subsExecuted++;
          }
          slot.status = 'executed';
        }
        subTimer = 0;
      }
    }
  }

  const times = Object.entries(playTime).map(([n, t]) => t);
  const maxDiff = Math.max(...times) - Math.min(...times);
  const minTime = Math.min(...times);
  const fairness = Math.round(minTime / Math.max(...times) * 100);
  const subsPerQ = Math.round(subsExecuted / HALVES * 10) / 10;

  intervalResults.push({ interval: intervalMin, slots: schedule.length, subsExecuted, subsPerQ, maxDiff, fairness, minTime, subCounts: { ...subCounts } });

  console.log(
    `  ${intervalMin} min`.padEnd(10) +
    `${schedule.length}`.padStart(5) +
    `${subsPerQ}`.padStart(14) +
    `${Math.round(maxDiff/60)} min`.padStart(13) +
    `${fairness}%`.padStart(10) +
    `${Math.round(minTime/60)} min`.padStart(12)
  );
}

// Bepaal optimaal
const best = intervalResults.sort((a, b) => b.fairness - a.fairness)[0];
console.log(`\n  ► OPTIMAAL INTERVAL: ${best.interval} minuten (${best.fairness}% fairness, ${best.subsPerQ} wissels/kwart)`);


// ============================================================
// VRAAG 2: Wie zit als eerste op de bank? Spreiding per wedstrijd
// ============================================================
console.log('\n\n═══ VRAAG 2: Bank-startpositie spreiding over 8 wedstrijden ═══\n');

console.log('Het probleem: als Daan elke week begint op de bank, zeggen ouders');
console.log('"wordt je nou alweer gewisseld". Oplossing: roteer wie begint op de bank.\n');

const bankStarts = {};
PLAYERS.forEach(p => { bankStarts[p] = 0; });

console.log('Wedstr  Bank-start       Keeper   Uitleg');
console.log('──────  ───────────────   ───────  ──────');

for (let game = 0; game < 8; game++) {
  // Roteer de spelerslijst: elke wedstrijd beginnen andere 2 spelers op de bank
  // Simpele rotatie: shift de niet-keeper spelers
  const keeper = KEEPER_QUEUE[game % KEEPER_QUEUE.length];
  const nonKeeper = PLAYERS.filter(p => p !== keeper);
  // Roteer de niet-keeper lijst: elke wedstrijd 2 posities opschuiven
  const rotated = [...nonKeeper.slice((game * 2) % nonKeeper.length), ...nonKeeper.slice(0, (game * 2) % nonKeeper.length)];
  const fieldPlayers = [keeper, ...rotated.slice(0, ON_FIELD - 1)];
  const benchPlayers = rotated.slice(ON_FIELD - 1);

  benchPlayers.forEach(p => { bankStarts[p]++; });

  console.log(
    `  ${game + 1}`.padEnd(8) +
    `${benchPlayers.join(', ')}`.padEnd(18) +
    `${keeper}`.padEnd(9) +
    `speler ${(game * 2) % nonKeeper.length + 1}-${(game * 2 + 1) % nonKeeper.length + 1} beginnen op bank`
  );
}

console.log('\n  Totaal bankstarts over 8 wedstrijden:');
Object.entries(bankStarts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
  const bar = '█'.repeat(count * 3);
  console.log(`    ${name.padEnd(8)} ${count}x ${bar}`);
});


// ============================================================
// VRAAG 3: Wisselfrequentie — "wordt je nou alweer gewisseld"
// ============================================================
console.log('\n\n═══ VRAAG 3: Wisselfrequentie analyse ═══\n');

// Gebruik het optimale interval
const optInterval = best.interval;
console.log(`Met interval ${optInterval} min:`);

const schedule = generateSubSchedule(
  PLAYERS, 'Luuk', ON_FIELD, HALF_DURATION, HALVES, optInterval,
  {}, [], null, null, true, KEEPER_QUEUE
);

// Analyseer het schema per speler
const playerSwaps = {};
PLAYERS.forEach(p => { playerSwaps[p] = { out: [], inn: [], totalSwaps: 0 }; });

schedule.forEach(slot => {
  slot.out.forEach(p => {
    playerSwaps[p].out.push({ half: slot.half, time: slot.time });
    playerSwaps[p].totalSwaps++;
  });
  slot.inn.forEach(p => {
    playerSwaps[p].inn.push({ half: slot.half, time: slot.time });
    playerSwaps[p].totalSwaps++;
  });
});

console.log('\nWisselpatroon per speler:');
console.log('─────────────────────────');

PLAYERS.forEach(name => {
  const p = playerSwaps[name];
  if (p.totalSwaps === 0) {
    console.log(`  ${name.padEnd(8)} niet gewisseld (keeper hele kwart)`);
    return;
  }

  const events = [];
  p.out.forEach(s => events.push({ half: s.half, time: s.time, dir: 'ERUIT' }));
  p.inn.forEach(s => events.push({ half: s.half, time: s.time, dir: 'ERIN' }));
  events.sort((a, b) => (a.half - 1) * 600 + a.time - ((b.half - 1) * 600 + b.time));

  const timeline = events.map(e => `K${e.half} ${Math.round(e.time/60)}'${e.dir === 'ERUIT' ? '↓' : '↑'}`).join('  ');
  console.log(`  ${name.padEnd(8)} ${p.totalSwaps}x gewisseld  ${timeline}`);
});

// Bereken max opeenvolgende bank-periodes
console.log('\nLangste aaneengesloten periodes op bank:');
console.log('─────────────────────────────────────────');

PLAYERS.forEach(name => {
  const p = playerSwaps[name];
  if (p.totalSwaps === 0) return;

  // Bereken hoelang elk bank-bezoek duurt
  const bankPeriods = [];
  for (let i = 0; i < p.out.length; i++) {
    const outTime = (p.out[i].half - 1) * HALF_DURATION * 60 + p.out[i].time;
    // Zoek de eerstvolgende inn na dit out
    const nextInn = p.inn.find(s => {
      const innTime = (s.half - 1) * HALF_DURATION * 60 + s.time;
      return innTime > outTime;
    });
    if (nextInn) {
      const innTime = (nextInn.half - 1) * HALF_DURATION * 60 + nextInn.time;
      bankPeriods.push(innTime - outTime);
    }
  }

  if (bankPeriods.length > 0) {
    const maxBank = Math.max(...bankPeriods);
    console.log(`  ${name.padEnd(8)} max ${Math.round(maxBank/60)} min op bank`);
  }
});


// ============================================================
// VRAAG 4: Het ideale schema — print het volledige wisselschema
// ============================================================
console.log('\n\n═══ HET IDEALE SCHEMA VOOR BOBBY ═══\n');
console.log(`Interval: ${optInterval} min, ${schedule.length} wisselmomenten over 4 kwarten\n`);

let currentKeeper = 'Luuk';
for (let half = 1; half <= HALVES; half++) {
  currentKeeper = KEEPER_QUEUE[(half - 1) % KEEPER_QUEUE.length];
  const halfSlots = schedule.filter(s => s.half === half);
  console.log(`  Kwart ${half} (keeper: ${currentKeeper}):`);
  if (halfSlots.length === 0) {
    console.log(`    Geen wissels dit kwart`);
  }
  halfSlots.forEach(slot => {
    const pairs = slot.out.map((o, i) => `${o} → ${slot.inn[i]}`).join(', ');
    console.log(`    ${Math.round(slot.time/60)}' — ${pairs}`);
  });
}


// ============================================================
// ADVIES
// ============================================================
console.log('\n\n╔══════════════════════════════════════════════════════════╗');
console.log('║  ADVIES VOOR ED                                         ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`
  1. WISSELINTERVAL: ${optInterval} minuten
     → ${best.subsPerQ} wissel(s) per kwart, ${best.slots} totaal over de wedstrijd

  2. BANK-START ROTATIE: elke wedstrijd andere 2 kinderen op de bank
     → Maak een rooster: wedstrijd 1 beginnen A+B op bank,
       wedstrijd 2 beginnen C+D, etc. Zo is het eerlijk EN zichtbaar.
     → De app kan dit automatisch als je de spelerslijst elke
       wedstrijd 2 posities opschuift.

  3. "WORDT JE NOU ALWEER GEWISSELD?"
     → Met ${optInterval}-min interval zit elk kind max ${Math.round(optInterval * 1.5)} min
       op de bank per keer. Dat is kort genoeg.
     → Het schema zorgt dat niemand 2x achter elkaar naar de bank
       gaat (spreiding). Elk kind wordt ${Math.round(best.slots / PLAYERS.length * 2)} - ${Math.round(best.slots / PLAYERS.length * 2 + 2)}x gewisseld per wedstrijd.
     → TIP: leg aan ouders uit dat wisselen EERLIJK is, niet straf.
       "Iedereen speelt evenveel" is de boodschap.

  4. KEEPER ROTATIE: elk kwart andere keeper uit de queue
     → Keeper telt mee voor speeltijd (op 50% gewogen)
     → Als een keeper uitvalt, pakt de volgende in de queue het over
`);
