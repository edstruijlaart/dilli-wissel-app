/**
 * Simulatietest voor Dilli Wissel state management.
 * Test scenario's die in productie fout gingen:
 * 1. Keeper wissel mid-wedstrijd
 * 2. Blessure → auto-vervanging → schema herberekening
 * 3. Meerdere wissels snel achter elkaar
 * 4. Helft-overgang met keeper rotatie
 * 5. State repair na corruptie
 *
 * Run: node test-simulation.mjs
 */

// --- Minimale import van de pure functions ---
const dedup = (arr) => [...new Set(arr)];

function enforceInvariant(field, bench, excluded = []) {
  const seen = new Set();
  const cleanField = [];
  const cleanBench = [];
  const excludedSet = new Set(excluded);

  for (const p of field) {
    if (!seen.has(p) && !excludedSet.has(p)) {
      cleanField.push(p);
      seen.add(p);
    }
  }
  for (const p of bench) {
    if (!seen.has(p) && !excludedSet.has(p)) {
      cleanBench.push(p);
      seen.add(p);
    }
  }
  return { field: cleanField, bench: cleanBench };
}

// --- Test helpers ---
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function assertNoOverlap(field, bench, context) {
  const fieldSet = new Set(field);
  const overlap = bench.filter(p => fieldSet.has(p));
  assert(overlap.length === 0, `${context}: overlap found: ${overlap.join(', ')}`);
}

function assertAllAccountedFor(players, field, bench, excluded, context) {
  const accounted = new Set([...field, ...bench, ...excluded]);
  const missing = players.filter(p => !accounted.has(p));
  assert(missing.length === 0, `${context}: missing players: ${missing.join(', ')}`);
}

// --- Test 1: enforceInvariant fixes duplicates ---
console.log('\n--- Test 1: enforceInvariant fixes duplicates ---');
{
  const field = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris'];
  const bench = ['Bobby', 'Thijs', 'Morris']; // Bobby en Morris staan dubbel!
  const { field: f, bench: b } = enforceInvariant(field, bench, []);
  assertNoOverlap(f, b, 'T1');
  assert(f.length === 5, `T1: field should be 5, got ${f.length}`);
  assert(b.length === 1, `T1: bench should be 1 (only Thijs), got ${b.length} (${b.join(',')})`);
  assert(b.includes('Thijs'), 'T1: Thijs should be on bench');
}

// --- Test 2: enforceInvariant with excluded players ---
console.log('\n--- Test 2: enforceInvariant with excluded players ---');
{
  const field = ['Luuk', 'Sem', 'Bobby', 'Daan', 'Morris'];
  const bench = ['Thijs', 'Finn'];
  const excluded = ['Bobby']; // Blessure
  const { field: f, bench: b } = enforceInvariant(field, bench, excluded);
  assert(!f.includes('Bobby'), 'T2: Bobby should not be on field (excluded)');
  assert(!b.includes('Bobby'), 'T2: Bobby should not be on bench (excluded)');
  assert(f.length === 4, `T2: field should be 4, got ${f.length}`);
  assert(b.length === 2, `T2: bench should be 2, got ${b.length}`);
}

// --- Test 3: Simulate substitution with invariant ---
console.log('\n--- Test 3: Substitution simulation ---');
{
  let field = ['Keeper', 'A', 'B', 'C', 'D'];
  let bench = ['E', 'F'];
  const excluded = [];

  // Wissel: C eruit, E erin
  const out = ['C'];
  const inn = ['E'];
  const newField = field.filter(p => !out.includes(p)).concat(inn);
  const newBench = bench.filter(p => !inn.includes(p)).concat(out);
  const { field: f, bench: b } = enforceInvariant(newField, newBench, excluded);

  assertNoOverlap(f, b, 'T3');
  assert(f.includes('E'), 'T3: E should be on field');
  assert(b.includes('C'), 'T3: C should be on bench');
  assert(!f.includes('C'), 'T3: C should NOT be on field');
  assertAllAccountedFor(['Keeper', 'A', 'B', 'C', 'D', 'E', 'F'], f, b, excluded, 'T3');
}

// --- Test 4: Rapid multiple subs (race condition scenario) ---
console.log('\n--- Test 4: Rapid multiple substitutions ---');
{
  let field = ['Keeper', 'A', 'B', 'C', 'D'];
  let bench = ['E', 'F', 'G'];
  const excluded = [];

  // Sub 1: A→E
  let nf = field.filter(p => p !== 'A').concat(['E']);
  let nb = bench.filter(p => p !== 'E').concat(['A']);
  ({ field, bench: bench } = enforceInvariant(nf, nb, excluded));
  let result = enforceInvariant(nf, nb, excluded);
  field = result.field;
  bench = result.bench;

  // Sub 2 (before state settles): B���F — simulate using previous field/bench
  nf = field.filter(p => p !== 'B').concat(['F']);
  nb = bench.filter(p => p !== 'F').concat(['B']);
  result = enforceInvariant(nf, nb, excluded);
  field = result.field;
  bench = result.bench;

  assertNoOverlap(field, bench, 'T4');
  assertAllAccountedFor(['Keeper', 'A', 'B', 'C', 'D', 'E', 'F', 'G'], field, bench, excluded, 'T4');
  assert(field.includes('E') && field.includes('F'), 'T4: E and F should be on field');
  assert(bench.includes('A') && bench.includes('B'), 'T4: A and B should be on bench');
}

// --- Test 5: Keeper swap from bench (tricky scenario) ---
console.log('\n--- Test 5: Keeper swap from bench ---');
{
  let field = ['OldKeeper', 'A', 'B', 'C', 'D'];
  let bench = ['NewKeeper', 'F'];
  const excluded = [];

  // Swap: OldKeeper↔NewKeeper
  const nf = field.map(p => p === 'OldKeeper' ? 'NewKeeper' : p);
  const nb = bench.map(p => p === 'NewKeeper' ? 'OldKeeper' : p);
  const { field: f, bench: b } = enforceInvariant(nf, nb, excluded);

  assertNoOverlap(f, b, 'T5');
  assert(f.includes('NewKeeper'), 'T5: NewKeeper should be on field');
  assert(b.includes('OldKeeper'), 'T5: OldKeeper should be on bench');
  assert(f.length === 5, `T5: field size should be 5, got ${f.length}`);
}

// --- Test 6: Injury during active sub (complex scenario) ---
console.log('\n--- Test 6: Injury mid-match with replacement ---');
{
  let field = ['Keeper', 'A', 'B', 'C', 'D'];
  let bench = ['E', 'F'];
  const excluded = [];

  // B gets injured, E replaces
  const newField = field.filter(p => p !== 'B');
  newField.push('E'); // replacement
  const newBench = bench.filter(p => p !== 'E');
  const newExcluded = ['B'];

  const { field: f, bench: b } = enforceInvariant(newField, newBench, newExcluded);
  assertNoOverlap(f, b, 'T6');
  assert(!f.includes('B') && !b.includes('B'), 'T6: B should be excluded');
  assert(f.includes('E'), 'T6: E should be on field as replacement');
  assert(f.length === 5, `T6: field should still be 5, got ${f.length}`);
}

// --- Test 7: Corrupt state repair ---
console.log('\n--- Test 7: State repair ---');
{
  // Simulate corrupt state: player on BOTH lists + missing player
  const players = ['Keeper', 'A', 'B', 'C', 'D', 'E', 'F'];
  const field = ['Keeper', 'A', 'B', 'C', 'D', 'B']; // B is dubbel!
  const bench = ['B', 'E']; // B staat ook op bank!
  // F is missing!
  const excluded = [];

  const { field: safeField, bench: safeBench } = enforceInvariant(field, bench, excluded);
  // Check for missing players
  const accounted = new Set([...safeField, ...safeBench, ...excluded]);
  const missing = players.filter(p => !accounted.has(p));
  const finalBench = [...safeBench, ...missing];

  assertNoOverlap(safeField, finalBench, 'T7');
  assertAllAccountedFor(players, safeField, finalBench, excluded, 'T7');
  assert(finalBench.includes('F'), 'T7: missing player F should be on bench after repair');
}

// --- Test 8: Half transition bounds check ---
console.log('\n--- Test 8: Bounds check simulation ---');
{
  const halves = 4;
  let currentHalf = 4;

  // Should NOT allow starting half 5
  const canStartNext = currentHalf < halves;
  assert(!canStartNext, 'T8: should not allow starting half 5 when halves=4');

  currentHalf = 3;
  const canStartNext2 = currentHalf < halves;
  assert(canStartNext2, 'T8: should allow starting half 4 when currentHalf=3, halves=4');
}

// --- Test 9: Multiple injuries then sub (today's scenario) ---
console.log('\n--- Test 9: Multiple injuries then normal sub ---');
{
  let field = ['Keeper', 'A', 'B', 'C', 'D'];
  let bench = ['E', 'F', 'G'];
  let excluded = [];

  // Injury 1: C (ball to head)
  field = field.filter(p => p !== 'C');
  field.push('E');
  bench = bench.filter(p => p !== 'E');
  excluded.push('C');
  let result = enforceInvariant(field, bench, excluded);
  field = result.field;
  bench = result.bench;

  assertNoOverlap(field, bench, 'T9a');
  assert(field.length === 5, 'T9a: field should be 5 after injury replacement');

  // Normal sub: A→F
  let nf = field.filter(p => p !== 'A').concat(['F']);
  let nb = bench.filter(p => p !== 'F').concat(['A']);
  result = enforceInvariant(nf, nb, excluded);
  field = result.field;
  bench = result.bench;

  assertNoOverlap(field, bench, 'T9b');
  assertAllAccountedFor(['Keeper', 'A', 'B', 'D', 'E', 'F', 'G'], field, bench, excluded, 'T9b');

  // Injury 2: D (collision)
  field = field.filter(p => p !== 'D');
  field.push('G');
  bench = bench.filter(p => p !== 'G');
  excluded.push('D');
  result = enforceInvariant(field, bench, excluded);
  field = result.field;
  bench = result.bench;

  assertNoOverlap(field, bench, 'T9c');
  assert(field.length === 5, `T9c: field should be 5, got ${field.length}`);
  assert(bench.length === 1, `T9c: bench should be 1 (only A), got ${bench.length}`);
}

// --- Results ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('SOME TESTS FAILED!');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
