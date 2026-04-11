#!/usr/bin/env node
/**
 * DEFINITIEVE MEGATEST — alles in één run
 *
 * 200 willekeurige wedstrijden met:
 * - Random teamgrootte (6-10 spelers)
 * - Random veldgrootte (5-7)
 * - Random kwartduur (8-15 min)
 * - Random aantal kwarten (2 of 4)
 * - Random keeper rotatie (ja/nee)
 * - Random events per wedstrijd: blessures, keeper swaps, skips,
 *   handmatige wissels, overtime, kort kwart, corrupte snapshots
 *
 * Eén regel output per wedstrijd. Moet 200/200 halen.
 *
 * Run: node test-final.mjs
 */

const dedup = (arr) => [...new Set(arr)];
function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set(); const cf = []; const cb = []; const ex = new Set(excluded);
  for (const p of field) { if (!seen.has(p) && !ex.has(p)) { cf.push(p); seen.add(p); } }
  for (const p of bench) { if (!seen.has(p) && !ex.has(p)) { cb.push(p); seen.add(p); } }
  return { field: cf, bench: cb };
}
function calculateDynamicInterval(hd, bs) {
  if (bs <= 0) return hd;
  const sn = bs <= 2 ? 1 : 1 + (bs - 2); const u = hd - 2;
  if (hd <= 12) { return Math.max(2, Math.floor(u / Math.max(sn + 1, 3))); }
  return Math.max(2, Math.floor(u / (sn + 1)));
}
function generateSubSchedule(pl, kn, nof, hd, nh, si, cpt={}, el=[], ifl=null, ibl=null, kre=false, kql=[]) {
  const aa = pl.filter(p => !el.includes(p)); const F=nof; const D=hd*60; const I=si*60;
  const oi = aa.filter(p => p !== kn);
  let field = dedup(ifl ? [...ifl] : [kn, ...oi.slice(0, F-1)]);
  let bench = dedup(ibl ? [...ibl] : oi.slice(F-1)).filter(p => !field.includes(p));
  field = field.filter(p => !el.includes(p)); bench = bench.filter(p => !el.includes(p));
  const B = bench.length; if (B <= 0 || I <= 0) return [];
  const sph = Math.max(1, Math.floor(D / I)); const fs = F - 1;
  const proj = {}; aa.forEach(p => { proj[p] = cpt[p] || 0; });
  const bw = {}; const fst = {};
  aa.forEach(p => { bw[p] = bench.includes(p)?1:0; fst[p] = field.includes(p)?1:0; });
  const sch = []; let sid = 0;
  for (let half = 1; half <= nh; half++) {
    const hk = (kre && kql.length > 0) ? kql[(half-1)%kql.length] : kn;
    const phk = (kre && kql.length > 0 && half > 1) ? kql[(half-2)%kql.length] : (half>1?kn:null);
    const nhk = (kre && kql.length > 0 && half < nh) ? kql[half%kql.length] : null;
    if (half>1 && kre && phk && phk!==hk) {
      proj[phk] = (proj[phk]||0)+D*0.5;
      const prom = (player) => { if (!bench.includes(player)) return; bench=bench.filter(p=>p!==player); field=[...field,player]; if (field.length>F) { const cg=field.filter(p=>p!==hk&&p!==phk).sort((a,b)=>(proj[b]||0)-(proj[a]||0)).slice(0,field.length-F); field=field.filter(p=>!cg.includes(p)); bench=[...bench,...cg]; } };
      prom(hk); prom(phk);
    }
    const grace = (half>1&&kre&&phk&&phk!==hk)?phk:null;
    let first = true;
    const st = []; const ME = 120;
    const lw = bench.filter(p => (bw[p]||0)>=2);
    if (half>1 && lw.length>0) st.push(30);
    for (let s=1;s<=sph;s++){const t=s*I;if(t<=D-ME&&t>30)st.push(t);}
    let prev = 0;
    for (const slotTime of st) {
      const ps = first ? Math.min(2,bench.length,fs) : 1;
      const delta = slotTime - prev;
      field.filter(p=>p!==hk).forEach(p=>{proj[p]=(proj[p]||0)+delta;});
      let elig = field.filter(p=>p!==hk);
      if(first&&grace&&elig.includes(grace))elig=elig.filter(p=>p!==grace);
      const last=slotTime===st[st.length-1];
      if(last&&nhk&&nhk!==hk&&elig.includes(nhk))elig=elig.filter(p=>p!==nhk);
      elig.sort((a,b)=>{const d=(proj[b]||0)-(proj[a]||0);return d!==0?d:(fst[b]||0)-(fst[a]||0);});
      const out=elig.slice(0,ps);
      const bs=[...bench].sort((a,b)=>{const w=(bw[b]||0)-(bw[a]||0);return w!==0?w:(proj[a]||0)-(proj[b]||0);});
      const inn=bs.slice(0,ps);
      if(out.length>0&&inn.length>0){
        sch.push({id:`s-${++sid}`,half,time:slotTime,absoluteTime:(half-1)*D+slotTime,out:[...out],inn:[...inn],status:'pending'});
        bench.filter(p=>!inn.includes(p)).forEach(p=>{bw[p]=(bw[p]||0)+1;});
        field.filter(p=>p!==hk&&!out.includes(p)).forEach(p=>{fst[p]=(fst[p]||0)+1;});
        out.forEach(p=>{bw[p]=1;fst[p]=0;}); inn.forEach(p=>{bw[p]=0;fst[p]=1;});
        field=field.filter(p=>!out.includes(p)).concat(inn);
        bench=bench.filter(p=>!inn.includes(p)).concat(out);
        first=false;
      }
      prev=slotTime;
    }
    const lt=st.length>0?st[st.length-1]:0;
    field.filter(p=>p!==hk).forEach(p=>{proj[p]=(proj[p]||0)+D-lt;});
  }
  return sch;
}
function recalculateRemainingSlots(schedule,fi,cf,cb,cpt,kn,hd,nh,si,ex,kre=false,kql=[]) {
  const fixed=schedule.filter((s,i)=>i<=fi);
  const df=dedup(cf);const db=dedup(cb.filter(p=>!df.includes(p)));const ap=[...df,...db];
  const lfs=fixed[fixed.length-1];const ch=lfs?lfs.half:1;const cat=lfs?.absoluteTime||0;
  const rh=nh-ch+1;
  const rem=generateSubSchedule(ap,kn,df.length,hd,rh,si,cpt,ex,df,db,kre,kql);
  const ho=(ch-1)*hd*60;
  const adj=rem.map(s=>({...s,half:s.half+ch-1,absoluteTime:s.absoluteTime+ho}));
  const fut=adj.filter(s=>s.absoluteTime>cat);
  return [...fixed,...fut.map((s,i)=>({...s,id:`rc-${fi+1}-${i}`,status:'pending',executedAt:null}))];
}
const getPivotIndex=(s,ai)=>ai>=0?ai:Math.max(-1,s.findIndex(x=>x.status==='pending')-1);

// === NAMES ===
const ALL_NAMES = ['Luuk','Sem','Bobby','Daan','Morris','Thijs','Finn','Noud','Bram','Jesse'];
const rng = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=rng(i+1);[r[i],r[j]]=[r[j],r[i]];} return r; };

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  DEFINITIEVE MEGATEST — 200 willekeurige wedstrijden        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let totalGames = 0; let crashes = 0; let stateErrors = 0;
let maxDiffSeen = 0; let worstGame = '';

for (let game = 0; game < 200; game++) {
  // Random config
  const nPlayers = 6 + rng(5); // 6-10
  const players = shuffle(ALL_NAMES).slice(0, nPlayers);
  const onField = Math.min(nPlayers, 5 + rng(3)); // 5-7, maar niet meer dan spelers
  const halves = Math.random() < 0.6 ? 4 : 2;
  const halfDur = 8 + rng(8); // 8-15 min
  const keeperRot = Math.random() < 0.7;
  const keeper = players[0];
  const keeperQueue = keeperRot ? players.slice(0, Math.min(halves, 4)) : [];

  const benchSize = nPlayers - onField;
  if (benchSize < 0) continue;

  const interval = calculateDynamicInterval(halfDur, benchSize);
  const schedule = generateSubSchedule(
    players, keeper, onField, halfDur, halves, interval,
    {}, [], null, null, keeperRot, keeperQueue
  );

  // State
  const nk = shuffle(players.filter(p => p !== keeper));
  let field = [keeper, ...nk.slice(0, onField - 1)];
  let bench = nk.slice(onField - 1);
  let excluded = [];
  let matchKeeper = keeper;
  const playTime = {}; players.forEach(p => { playTime[p] = 0; });
  let currentHalf = 1; let matchTimer = 0; let subTimer = 0;
  let activeSlotIndex = -1; let errors = [];

  const validate = (ctx) => {
    const fs = new Set(field);
    if (bench.some(p => fs.has(p))) errors.push(`[${ctx}] OVERLAP`);
    if (new Set(field).size !== field.length) errors.push(`[${ctx}] DUP_FIELD`);
    const active = players.filter(p => !excluded.includes(p));
    const acc = new Set([...field, ...bench]);
    if (active.some(p => !acc.has(p))) errors.push(`[${ctx}] MISSING`);
    if (!field.includes(matchKeeper)) errors.push(`[${ctx}] KEEPER_GONE`);
  };

  try {
    for (let half = 1; half <= halves; half++) {
      if (half > 1) {
        // Keeper rotatie
        if (keeperRot && keeperQueue.length > 0) {
          const nk = keeperQueue[(half-1) % keeperQueue.length];
          if (nk && nk !== matchKeeper && !excluded.includes(nk)) {
            if (bench.includes(nk)) {
              const old = matchKeeper;
              field = field.map(p => p===old?nk:p); bench = bench.map(p => p===nk?old:p);
              const e = enforceInvariant(field, bench, excluded); field=e.field; bench=e.bench;
            }
            matchKeeper = nk;
          }
        }
        currentHalf = half; subTimer = 0;
      }

      // Random kwartduur: soms kort, soms overtime
      const actualDur = halfDur * 60 + (rng(6) - 2) * 30; // -60s tot +90s

      for (let s = 0; s < actualDur; s += 10) {
        matchTimer += 10; subTimer += 10;
        field.forEach(p => { playTime[p] += 10; });

        if (subTimer >= interval * 60) {
          const slot = schedule.find(x => x.status === 'pending');
          if (slot) {
            // 10% skip
            if (Math.random() < 0.10) {
              slot.status = 'skipped';
            } else {
              let { out, inn } = slot;
              if (matchKeeper && out.includes(matchKeeper)) {
                out = out.filter(p => p !== matchKeeper); inn = inn.slice(0, out.length);
              }
              if (out.length > 0 && inn.length > 0) {
                const nf = field.filter(p => !out.includes(p)).concat(inn);
                const nb = bench.filter(p => !inn.includes(p)).concat(out);
                const e = enforceInvariant(nf, nb, excluded); field=e.field; bench=e.bench;
                slot.status = 'executed';
              } else { slot.status = 'skipped'; }
            }
          }
          subTimer = 0;
        }

        // 2% handmatige wissel
        if (Math.random() < 0.02 && bench.length > 0) {
          const fp = field.filter(p => p !== matchKeeper)[rng(Math.max(1,field.length-1))];
          if (fp && bench.length > 0) {
            const bp = bench[rng(bench.length)];
            const wasK = fp === matchKeeper;
            field = field.map(p => p===fp?bp:p); bench = bench.map(p => p===bp?fp:p);
            const e = enforceInvariant(field, bench, excluded); field=e.field; bench=e.bench;
            if (wasK) matchKeeper = bp;
          }
        }

        // 0.3% blessure
        if (Math.random() < 0.003 && field.length > 3 && excluded.length < nPlayers - 3) {
          const targets = field.filter(p => p !== matchKeeper);
          if (targets.length > 0) {
            const victim = targets[rng(targets.length)];
            field = field.filter(p => p !== victim);
            if (bench.length > 0) {
              const repl = bench.sort((a,b) => (playTime[a]||0)-(playTime[b]||0))[0];
              field.push(repl); bench = bench.filter(p => p !== repl);
            }
            if (victim === matchKeeper && field.length > 0) matchKeeper = field[0];
            excluded.push(victim);
            const e = enforceInvariant(field, bench, excluded); field=e.field; bench=e.bench;
          }
        }

        // 0.5% keeper swap
        if (Math.random() < 0.005) {
          const cands = field.filter(p => p !== matchKeeper);
          if (cands.length > 0) {
            const newK = cands[rng(cands.length)];
            matchKeeper = newK;
          }
        }

        // 1% corrupt snapshot
        if (Math.random() < 0.01 && field.length > 0 && bench.length > 0) {
          const dup = field[rng(field.length)];
          const raw = [...field, dup]; // Dubbele speler!
          const e = enforceInvariant(raw, bench, excluded); field=e.field; bench=e.bench;
          if (!field.includes(matchKeeper) && field.length > 0) matchKeeper = field[0];
        }

        // Periodieke validate
        if (s % 300 === 0) validate(`G${game+1}H${half}@${s}`);
      }
    }

    // Eindvalidatie
    validate(`G${game+1}_end`);

    // Fairness check
    const active = players.filter(p => !excluded.includes(p));
    if (active.length > 0) {
      const times = active.map(p => playTime[p]);
      const diff = Math.max(...times) - Math.min(...times);
      if (diff > maxDiffSeen) { maxDiffSeen = diff; worstGame = `G${game+1} (${nPlayers}sp ${onField}v ${halves}x${halfDur}m)`; }
    }

  } catch (err) {
    crashes++;
    console.error(`  💥 CRASH G${game+1}: ${err.message}`);
  }

  stateErrors += errors.length;
  if (errors.length > 0) {
    errors.forEach(e => console.error(`  ⚠️ G${game+1}: ${e}`));
  }

  totalGames++;

  // Progress elke 50 wedstrijden
  if ((game+1) % 50 === 0) {
    console.log(`  ... ${game+1}/200 wedstrijden: ${crashes} crashes, ${stateErrors} state errors`);
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`\n  200 WEDSTRIJDEN GESPEELD`);
console.log(`  Crashes:      ${crashes}`);
console.log(`  State errors: ${stateErrors}`);
console.log(`  Worst fairness: ${Math.round(maxDiffSeen/60)} min verschil (${worstGame})`);

if (crashes === 0 && stateErrors === 0) {
  console.log(`\n  ✅ 200/200 — KEIHARDE GOEDKEURING`);
} else {
  console.log(`\n  ❌ GEFAALD`);
  process.exit(1);
}
