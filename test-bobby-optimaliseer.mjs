/**
 * BOBBY INTERVAL OPTIMALISATIE
 *
 * Brute-force: test ALLE intervallen van 2.0 t/m 9.0 minuten (per 0.5 min)
 * Meet per interval:
 *   - Max-min speeltijdverschil
 *   - Langste bankperiode
 *   - Aantal wissels (te veel = chaotisch)
 *   - Gemiddeld gevoel-score
 *
 * Dan: implementeer het beste interval en draai gevoel-simulaties
 */

const dedup = (arr) => [...new Set(arr)];

function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set(); const cf = []; const cb = [];
  const ex = new Set(excluded);
  for (const p of field) { if (!seen.has(p) && !ex.has(p)) { cf.push(p); seen.add(p); } }
  for (const p of bench) { if (!seen.has(p) && !ex.has(p)) { cb.push(p); seen.add(p); } }
  return { field: cf, bench: cb };
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
    // Kwartstart-wissel voor lang wachtende bankspelers
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

// === Simuleer een complete wedstrijd en meet alles ===
function simulate(players, keeper, onField, halfDur, halves, intervalSec, keeperQueue) {
  const intervalMin = intervalSec / 60;
  const schedule = generateSubSchedule(
    players, keeper, onField, halfDur, halves, intervalMin,
    {}, [], null, null, true, keeperQueue
  );

  const playTime = {}; const bankTime = {}; const bankStints = {};
  const currentBankStart = {}; const subCount = {};
  players.forEach(p => { playTime[p]=0; bankTime[p]=0; bankStints[p]=[]; currentBankStart[p]=null; subCount[p]=0; });

  const nk = players.filter(p => p !== keeper);
  let field = [keeper, ...nk.slice(0, onField - 1)];
  let bench = nk.slice(onField - 1);
  let matchKeeper = keeper;
  bench.forEach(p => { currentBankStart[p] = 0; });

  let timer = 0; let subTimer = 0;

  for (let half = 1; half <= halves; half++) {
    if (half > 1) {
      const nextK = keeperQueue[(half-1) % keeperQueue.length];
      if (nextK !== matchKeeper) {
        const onBench = bench.includes(nextK);
        if (onBench) {
          const old = matchKeeper;
          field = field.map(p => p === old ? nextK : p);
          bench = bench.map(p => p === nextK ? old : p);
          const e = enforceInvariant(field, bench, []);
          field = e.field; bench = e.bench;
          if (currentBankStart[nextK] !== null) {
            bankStints[nextK].push(timer - currentBankStart[nextK]);
            currentBankStart[nextK] = null;
          }
          currentBankStart[old] = timer;
          subCount[nextK]++; subCount[old]++;
        }
        matchKeeper = nextK;
      }
      subTimer = 0;
    }

    for (let sec = 0; sec < halfDur * 60; sec += 5) {
      timer += 5; subTimer += 5;
      field.forEach(p => { playTime[p] += 5; });
      bench.forEach(p => { bankTime[p] += 5; });

      if (subTimer >= intervalSec) {
        const slot = schedule.find(s => s.status === 'pending');
        if (slot) {
          let { out, inn } = slot;
          if (matchKeeper && out.includes(matchKeeper)) {
            out = out.filter(p => p !== matchKeeper);
            inn = inn.slice(0, out.length);
          }
          if (out.length > 0 && inn.length > 0) {
            out.forEach(p => { subCount[p]++; currentBankStart[p] = timer; });
            inn.forEach(p => {
              subCount[p]++;
              if (currentBankStart[p] !== null) {
                bankStints[p].push(timer - currentBankStart[p]);
                currentBankStart[p] = null;
              }
            });
            const nf = field.filter(p => !out.includes(p)).concat(inn);
            const nb = bench.filter(p => !inn.includes(p)).concat(out);
            const e = enforceInvariant(nf, nb, []);
            field = e.field; bench = e.bench;
            slot.status = 'executed';
          } else { slot.status = 'skipped'; }
        }
        subTimer = 0;
      }
    }
  }

  // Sluit openstaande bankstints
  bench.forEach(p => {
    if (currentBankStart[p] !== null) bankStints[p].push(timer - currentBankStart[p]);
  });

  const times = Object.values(playTime);
  const maxPlay = Math.max(...times);
  const minPlay = Math.min(...times);
  const maxBank = Math.max(...players.map(p => bankStints[p].length > 0 ? Math.max(...bankStints[p]) : 0));
  const executed = schedule.filter(s => s.status === 'executed').length;

  return { playTime, bankTime, bankStints, subCount, maxPlay, minPlay, diff: maxPlay - minPlay, maxBank, executed, timer };
}

// ============================================================
// BRUTE FORCE: test alle intervallen (per 15 seconden)
// ============================================================
const PLAYERS = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris', 'Thijs', 'Finn', 'Noud'];
const KEEPERS = ['Luuk', 'Sem', 'Bobby', 'Daan'];
const fm = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  INTERVAL OPTIMALISATIE — JO8-2 (4x10, 8 spelers, 6 veld) ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('Test elk interval van 1:30 t/m 8:00 (per 15 sec)...\n');
console.log('Interval  Wissels  Verschil  MaxBank  Subs/speler  Score');
console.log('────────  ───────  ────────  ───────  ───────────  ─────');

const results = [];

for (let sec = 90; sec <= 480; sec += 15) {
  const r = simulate(PLAYERS, 'Luuk', 6, 10, 4, sec, KEEPERS);
  const avgSubs = Object.values(r.subCount).reduce((s,v) => s+v, 0) / PLAYERS.length;

  // Score: lager = beter
  // MaxBank weegt zwaar (gevoel kind), verschil ook zwaar, te veel wissels = chaos
  const score = r.diff * 0.8 + r.maxBank * 1.5 + Math.max(0, avgSubs - 5) * 90;

  results.push({ sec, ...r, avgSubs, score });

  const label = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
  console.log(
    `  ${label.padEnd(8)}` +
    `${String(r.executed).padStart(5)}    ` +
    `${fm(r.diff).padStart(6)}    ` +
    `${fm(r.maxBank).padStart(5)}  ` +
    `${avgSubs.toFixed(1).padStart(10)}  ` +
    `${Math.round(score).toString().padStart(5)}`
  );
}

results.sort((a, b) => a.score - b.score);
const best = results[0];
const top5 = results.slice(0, 5);

console.log(`\n\n══ TOP 5 INTERVALLEN ══\n`);
top5.forEach((r, i) => {
  const label = `${Math.floor(r.sec/60)}:${String(r.sec%60).padStart(2,'0')}`;
  console.log(`  ${i+1}. ${label} — verschil ${fm(r.diff)}, maxBank ${fm(r.maxBank)}, ${r.executed} wissels (score: ${Math.round(r.score)})`);
});

const bestLabel = `${Math.floor(best.sec/60)}:${String(best.sec%60).padStart(2,'0')}`;
console.log(`\n  ► WINNAAR: ${bestLabel} (${best.sec} seconden)\n`);

// ============================================================
// DETAIL-ANALYSE van het winnende interval
// ============================================================
console.log(`\n══ DETAIL: ${bestLabel} INTERVAL ══\n`);

const detail = simulate(PLAYERS, 'Luuk', 6, 10, 4, best.sec, KEEPERS);

console.log('Speeltijd per speler:');
const sorted = Object.entries(detail.playTime).sort((a,b) => b[1] - a[1]);
sorted.forEach(([name, time]) => {
  const pct = Math.round(time / detail.timer * 100);
  const bank = detail.bankTime[name];
  const maxB = detail.bankStints[name].length > 0 ? Math.max(...detail.bankStints[name]) : 0;
  const subs = detail.subCount[name];
  const bar = '█'.repeat(Math.round(pct / 3));
  console.log(`  ${name.padEnd(8)} ${fm(time).padStart(5)} (${String(pct).padStart(2)}%) bank:${fm(bank).padStart(5)} maxBank:${fm(maxB).padStart(4)} ${subs}x gew. ${bar}`);
});
console.log(`\n  Verschil: ${fm(detail.diff)} | MaxBank: ${fm(detail.maxBank)}`);


// ============================================================
// SEIZOEN-SIMULATIE met het winnende interval
// ============================================================
console.log(`\n\n══ SEIZOEN: 8 wedstrijden met ${bestLabel} interval ══\n`);

const season = {};
PLAYERS.forEach(p => { season[p] = { play: 0, bank: 0, subs: 0, maxBank: 0 }; });

for (let game = 0; game < 8; game++) {
  const keeper = KEEPERS[game % KEEPERS.length];
  // Roteer spelerslijst: andere 2 beginnen op bank
  const nk = PLAYERS.filter(p => p !== keeper);
  const rot = [...nk.slice((game*2) % nk.length), ...nk.slice(0, (game*2) % nk.length)];
  const ordered = [keeper, ...rot];

  const r = simulate(ordered, keeper, 6, 10, 4, best.sec, KEEPERS);
  ordered.forEach(p => {
    season[p].play += r.playTime[p];
    season[p].bank += r.bankTime[p];
    season[p].subs += r.subCount[p];
    const mb = r.bankStints[p].length > 0 ? Math.max(...r.bankStints[p]) : 0;
    if (mb > season[p].maxBank) season[p].maxBank = mb;
  });
}

console.log('Cumulatief over 8 wedstrijden:');
console.log('Naam      Speeltijd  Bank      Wissels  MaxBank');
console.log('────────  ─────────  ────────  ───────  ───────');

const seasonSorted = Object.entries(season).sort((a,b) => b[1].play - a[1].play);
const maxSeason = seasonSorted[0][1].play;
const minSeason = seasonSorted[seasonSorted.length-1][1].play;

seasonSorted.forEach(([name, s]) => {
  const pct = Math.round(s.play / maxSeason * 100);
  console.log(
    `  ${name.padEnd(10)}${fm(s.play).padStart(7)} (${pct}%)` +
    `  ${fm(s.bank).padStart(7)}` +
    `  ${String(s.subs).padStart(5)}x` +
    `  ${fm(s.maxBank).padStart(7)}`
  );
});

const fairness = Math.round(minSeason / maxSeason * 100);
console.log(`\n  Seizoen fairness: ${fairness}%`);
console.log(`  Verschil: ${fm(maxSeason - minSeason)} over 8 wedstrijden`);


// ============================================================
// CONCLUSIE
// ============================================================
console.log(`\n\n╔══════════════════════════════════════════════════════════════╗`);
console.log(`║  CONCLUSIE                                                   ║`);
console.log(`╚══════════════════════════════════════════════════════════════╝`);
console.log(`
  OPTIMAAL INTERVAL VOOR JO8-2: ${bestLabel} (${best.sec} seconden)

  Per wedstrijd (4x10 min):
    ${best.executed} wissels
    Max verschil: ${fm(best.diff)}
    Langste bankbeurt: ${fm(best.maxBank)}
    Gem. wissels per speler: ${best.avgSubs.toFixed(1)}

  Over een seizoen (8 wedstrijden):
    Fairness: ${fairness}%

  Wat dit betekent voor het GEVOEL:
    Kind:  "Ik zit max ${fm(best.maxBank)} op de bank, dan mag ik weer"
    Ouder: "Mijn kind speelt ${Math.round(detail.minPlay/detail.timer*100)}-${Math.round(detail.maxPlay/detail.timer*100)}% van de wedstrijd"
    Coach: "${best.executed} wisseladviezen, goed te doen langs de lijn"
`);

// Return het interval zodat we het kunnen gebruiken
console.log(`\n  >>> IMPLEMENTATIE: calculateDynamicInterval moet ${best.sec}s (${bestLabel}) teruggeven`);
console.log(`      voor benchSize=2, halfDuration=10\n`);
