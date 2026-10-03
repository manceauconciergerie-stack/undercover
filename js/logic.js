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

  // Impostors may match the civils in number, but never outnumber them.
  function maxImpostors(n) {
    return Math.floor(n / 2);
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

  // Indices in a fully random speaking order. The only constraint is that Mr. White never
  // opens; everyone else is equally likely at every position, so the order reveals nothing.
  function speakingOrder(players, rand = Math.random) {
    const alive = players.map((p, i) => i).filter((i) => players[i].alive);
    const starters = alive.filter((i) => players[i].role !== 'mrwhite');
    const pool = starters.length ? starters : alive;
    const first = pool[Math.floor(rand() * pool.length)];
    return [first].concat(shuffle(alive.filter((i) => i !== first), rand));
  }

  // Lenient comparison for Mr. White's guess: ignores case, accents, punctuation,
  // a leading article and a plural, and forgives one typo on words of 5+ letters.
  function normalizeWord(s) {
    return String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’'`-]/g, ' ')
      .trim()
      .replace(/^(le|la|les|l|un|une|des|du|de)\s+/, '')
      .replace(/[^a-z0-9]/g, '')
      .replace(/(s|x)$/, '');
  }

  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  function guessMatches(guess, word) {
    const g = normalizeWord(guess);
    const w = normalizeWord(word);
    if (!g) return false;
    if (g === w) return true;
    return w.length >= 5 && editDistance(g, w) <= 1;
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
    speakingOrder, normalizeWord, guessMatches, checkWinner, applyScores, pairKey, pickPair,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
