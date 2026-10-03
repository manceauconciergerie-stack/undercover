const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');
const WORDS = require('../js/words.js');

const names = (n) => Array.from({ length: n }, (_, i) => `J${i + 1}`);

test('default roles are valid for every player count 3..12', () => {
  for (let n = L.MIN_PLAYERS; n <= L.MAX_PLAYERS; n++) {
    const { undercover, mrwhite } = L.defaultRoles(n);
    assert.equal(L.validateRoles(n, undercover, mrwhite), null, `n=${n}`);
  }
});

test('validateRoles rejects bad setups', () => {
  assert.ok(L.validateRoles(2, 1, 0));
  assert.ok(L.validateRoles(13, 1, 0));
  assert.ok(L.validateRoles(6, 0, 0));
  assert.ok(L.validateRoles(4, 2, 1)); // 3 impostors vs 1 civil
  assert.ok(L.validateRoles(5, 2, 1)); // impostors would outnumber civils
  assert.equal(L.validateRoles(4, 1, 1), null); // 2 vs 2 is allowed
  assert.equal(L.validateRoles(6, 3, 0), null);
  assert.equal(L.validateRoles(12, 5, 1), null);
});

test('assignRoles gives exact role counts and correct words', () => {
  for (let run = 0; run < 200; run++) {
    const { players, civilWord, undercoverWord } = L.assignRoles(names(12), 3, 1, ['A', 'B']);
    const count = (r) => players.filter((p) => p.role === r).length;
    assert.equal(count('undercover'), 3);
    assert.equal(count('mrwhite'), 1);
    assert.equal(count('civil'), 8);
    assert.notEqual(civilWord, undercoverWord);
    for (const p of players) {
      if (p.role === 'civil') assert.equal(p.word, civilWord);
      if (p.role === 'undercover') assert.equal(p.word, undercoverWord);
      if (p.role === 'mrwhite') assert.equal(p.word, null);
    }
  }
});

test('the civil word is drawn from both sides of the pair', () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) seen.add(L.assignRoles(names(5), 1, 1, ['A', 'B']).civilWord);
  assert.deepEqual([...seen].sort(), ['A', 'B']);
});

test('Mr. White never speaks first and order covers every alive player', () => {
  for (let run = 0; run < 300; run++) {
    const { players } = L.assignRoles(names(8), 2, 1, ['A', 'B']);
    players[run % 8].alive = run % 3 !== 0; // knock someone out sometimes
    const order = L.speakingOrder(players);
    assert.notEqual(players[order[0]].role, 'mrwhite');
    assert.equal(order.length, players.filter((p) => p.alive).length);
    assert.equal(new Set(order).size, order.length);
  }
});

test('speaking order is random, not a rotation of the seating', () => {
  const players = names(8).map((name) => ({ name, role: 'civil', alive: true }));
  let rotations = 0;
  for (let run = 0; run < 200; run++) {
    const o = L.speakingOrder(players);
    if (o.every((v, k) => k === 0 || v === (o[k - 1] + 1) % 8)) rotations++;
  }
  assert.ok(rotations < 10, `${rotations}/200 orders were plain rotations`);
});

test('Mr. White lands on every position except the first', () => {
  const players = names(5).map((name, i) => ({ name, role: i === 2 ? 'mrwhite' : 'civil', alive: true }));
  const seen = new Set();
  for (let run = 0; run < 500; run++) seen.add(L.speakingOrder(players).indexOf(2));
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4]);
});

test('guessMatches is lenient on form, strict on meaning', () => {
  assert.ok(L.guessMatches('raclette', 'Raclette'));
  assert.ok(L.guessMatches('  RACLETE ', 'Raclette')); // one typo
  assert.ok(L.guessMatches('creme', 'Crème'));
  assert.ok(L.guessMatches('la plage', 'Plage'));
  assert.ok(L.guessMatches('frite', 'Frites'));
  assert.ok(L.guessMatches('age de glace', 'L’Âge de glace'));
  assert.ok(L.guessMatches('roi lion', 'Le Roi Lion'));
  assert.ok(!L.guessMatches('', 'Plage'));
  assert.ok(!L.guessMatches('fondue', 'Raclette'));
  assert.ok(!L.guessMatches('lien', 'Lion')); // no typo tolerance on short words
});

test('no pair is so close that guessing the undercover word counts as the civil word', () => {
  for (const [a, b] of WORDS) assert.ok(!L.guessMatches(a, b), `${a} ~ ${b}`);
});

test('checkWinner', () => {
  const P = (role, alive = true) => ({ role, alive });
  assert.equal(L.checkWinner([P('civil'), P('civil'), P('civil'), P('undercover', false)]), 'civils');
  assert.equal(L.checkWinner([P('civil'), P('civil', false), P('undercover')]), 'impostors');
  assert.equal(L.checkWinner([P('civil'), P('civil'), P('mrwhite'), P('undercover')]), null);
  assert.equal(L.checkWinner([P('civil'), P('mrwhite'), P('civil', false)]), 'impostors');
});

test('applyScores rewards only the winning camp', () => {
  const players = [
    { name: 'a', role: 'civil' },
    { name: 'b', role: 'undercover' },
    { name: 'c', role: 'mrwhite' },
  ];
  assert.deepEqual(L.applyScores({}, players, 'civils'), { a: 2, b: 0, c: 0 });
  assert.deepEqual(L.applyScores({ a: 1 }, players, 'impostors'), { a: 1, b: 10, c: 6 });
  assert.deepEqual(L.applyScores({}, players, 'mrwhite'), { a: 0, b: 0, c: 6 });
});

test('pickPair never repeats until the pool is exhausted, then restarts', () => {
  let used = [];
  const seen = new Set();
  for (let i = 0; i < WORDS.length; i++) {
    const r = L.pickPair(WORDS, used);
    assert.equal(r.reset, false);
    assert.ok(!seen.has(L.pairKey(r.pair)), 'repeat before exhaustion');
    seen.add(L.pairKey(r.pair));
    used = r.used;
  }
  const r = L.pickPair(WORDS, used);
  assert.equal(r.reset, true);
  assert.equal(r.used.length, 1);
});

test('word list: 100+ pairs, no duplicate pairs, no word paired with itself', () => {
  assert.ok(WORDS.length >= 100, `only ${WORDS.length} pairs`);
  const keys = new Set();
  for (const [a, b] of WORDS) {
    assert.ok(a && b, 'empty word');
    assert.notEqual(a.toLowerCase(), b.toLowerCase());
    const k = [a, b].map((w) => w.toLowerCase()).sort().join('|');
    assert.ok(!keys.has(k), `duplicate pair ${k}`);
    keys.add(k);
  }
});
