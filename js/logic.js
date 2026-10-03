// Pure game logic — no DOM. Shared by the app and the node tests.
(function (root) {
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 12;
  const POINTS = { civil: 2, undercover: 10, mrwhite: 6 };

  function defaultRoles(n) {
    if (n <= 4) return { undercover: 1, mrwhite: 0 };
    if (n <= 6) return { undercover: 1, mrwhite: 1 };
    if (n <= 9) return { undercover: 2, mrwhite: 1 };
    return { undercover: 3, mrwhite: 1 };
  }

  // Impostors must stay a strict minority, otherwise the game is decided before it starts.
  function maxImpostors(n) {
    return Math.floor((n - 1) / 2);
  }

  function validateRoles(n, undercover, mrwhite) {
    if (n < MIN_PLAYERS) return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
    if (n > MAX_PLAYERS) return `${MAX_PLAYERS} joueurs maximum.`;
    if (undercover < 0 || mrwhite < 0) return 'Nombre de rôles invalide.';
    if (undercover + mrwhite < 1) return 'Il faut au moins un Undercover ou un Mr. White.';
    if (undercover + mrwhite > maxImpostors(n)) return 'Trop d’infiltrés pour ce nombre de joueurs.';
    return null;
  }

  function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Returns players in input order, each with a role and the word they see (null for Mr. White).
  function assignRoles(names, undercover, mrwhite, pair, rand = Math.random) {
    const swap = rand() < 0.5;
    const civilWord = swap ? pair[1] : pair[0];
    const undercoverWord = swap ? pair[0] : pair[1];
    const roles = shuffle(
      [
        ...Array(undercover).fill('undercover'),
        ...Array(mrwhite).fill('mrwhite'),
        ...Array(names.length - undercover - mrwhite).fill('civil'),
      ],
      rand
    );
    const players = names.map((name, i) => ({
      name,
      role: roles[i],
      word: roles[i] === 'civil' ? civilWord : roles[i] === 'undercover' ? undercoverWord : null,
      alive: true,
    }));
    return { players, civilWord, undercoverWord };
  }

  // Indices in speaking order: starts at a random non-Mr. White player, then follows the list.
  function speakingOrder(players, rand = Math.random) {
    const alive = players.map((p, i) => i).filter((i) => players[i].alive);
    const starters = alive.filter((i) => players[i].role !== 'mrwhite');
    const pool = starters.length ? starters : alive;
    const start = pool[Math.floor(rand() * pool.length)];
    const k = alive.indexOf(start);
    return alive.slice(k).concat(alive.slice(0, k));
  }

  // 'civils' | 'impostors' | null (game continues).
  function checkWinner(players) {
    const alive = players.filter((p) => p.alive);
    const impostors = alive.filter((p) => p.role !== 'civil').length;
    const civils = alive.length - impostors;
    if (impostors === 0) return 'civils';
    if (civils <= 1) return 'impostors';
    return null;
  }

  // winner: 'civils' | 'impostors' | 'mrwhite'. Returns a new { name: points } map.
  function applyScores(scores, players, winner) {
    const next = { ...scores };
    for (const p of players) {
      const won =
        (winner === 'civils' && p.role === 'civil') ||
        (winner === 'impostors' && p.role !== 'civil') ||
        (winner === 'mrwhite' && p.role === 'mrwhite');
      next[p.name] = (next[p.name] || 0) + (won ? POINTS[p.role] : 0);
    }
    return next;
  }

  const pairKey = (pair) => `${pair[0]}|${pair[1]}`.toLowerCase();

  // Picks a pair not in `used`; when the pool is exhausted, starts a new cycle.
  function pickPair(pairs, used, rand = Math.random) {
    const usedSet = new Set(used);
    let pool = pairs.filter((p) => !usedSet.has(pairKey(p)));
    let reset = false;
    if (!pool.length) {
      pool = pairs;
      reset = true;
    }
    const pair = pool[Math.floor(rand() * pool.length)];
    const nextUsed = (reset ? [] : used).concat(pairKey(pair));
    return { pair, used: nextUsed, reset };
  }

  const api = {
    MIN_PLAYERS, MAX_PLAYERS, POINTS,
    defaultRoles, maxImpostors, validateRoles, shuffle, assignRoles,
    speakingOrder, checkWinner, applyScores, pairKey, pickPair,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
