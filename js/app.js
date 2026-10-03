(function () {
  const L = window.Logic;
  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet');
  const $toast = document.getElementById('toast');

  // localStorage can throw (private mode, quota) — the app must still work without it.
  const store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem('uc.' + k);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(k, v) {
      try {
        if (v == null) localStorage.removeItem('uc.' + k);
        else localStorage.setItem('uc.' + k, JSON.stringify(v));
      } catch {}
    },
  };

  const ROLE = {
    civil: { label: 'Civil', emoji: '🙂' },
    undercover: { label: 'Undercover', emoji: '🕵️' },
    mrwhite: { label: 'Mr. White', emoji: '🎩' },
  };

  let settings = store.get('settings', null) || { names: [], undercover: 1, mrwhite: 0, custom: false };
  let game = store.get('game', null); // null = setup screen
  let scores = store.get('scores', {});
  let used = store.get('used', []);
  let customPairs = store.get('custom', []);
  let sheet = null; // { type, ...params } — transient UI, never persisted

  const allPairs = () => window.WORDS.concat(customPairs);

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function saveSettings() { store.set('settings', settings); }
  // A revealed word is never persisted, so a reload never shows it to the wrong person.
  function saveGame() { store.set('game', game && { ...game, revealed: false, guessRevealed: false }); }

  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
  }

  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      }
    } catch {}
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && game) keepAwake();
  });

  // ---------- Setup ----------

  function syncRoles() {
    const n = settings.names.length;
    if (!settings.custom || n < L.MIN_PLAYERS) {
      Object.assign(settings, L.defaultRoles(Math.max(n, L.MIN_PLAYERS)));
      return;
    }
    // Keep the user's choice but shrink it if the table got too small.
    const max = L.maxImpostors(n);
    while (settings.undercover + settings.mrwhite > max) {
      if (settings.undercover > settings.mrwhite) settings.undercover--;
      else settings.mrwhite--;
    }
    if (settings.undercover + settings.mrwhite < 1) settings.undercover = 1;
  }

  function stepper(role, label, value, n) {
    const max = L.maxImpostors(n);
    const total = settings.undercover + settings.mrwhite;
    return `
      <div class="stepper">
        <span class="label">${label}</span>
        <div class="ctrl">
          <button data-action="step" data-role="${role}" data-d="-1" aria-label="Moins" ${value <= 0 || total <= 1 ? 'disabled' : ''}>−</button>
          <output>${value}</output>
          <button data-action="step" data-role="${role}" data-d="1" aria-label="Plus" ${n < L.MIN_PLAYERS || total >= max ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
  }

  function renderSetup() {
    const n = settings.names.length;
    const full = n >= L.MAX_PLAYERS;
    const err = L.validateRoles(n, settings.undercover, settings.mrwhite);
    const civils = n - settings.undercover - settings.mrwhite;
    const usedSet = new Set(used);
    const pairs = allPairs();
    const fresh = pairs.filter((p) => !usedSet.has(L.pairKey(p))).length;
    return `
      <header class="top">
        <h1 class="logo">Under<span>cover</span></h1>
        <div class="top-actions">
          <button class="icon-btn" data-action="sheet" data-type="rules" aria-label="Règles">?</button>
          <button class="icon-btn" data-action="sheet" data-type="words" aria-label="Binômes">📝</button>
          <button class="icon-btn" data-action="sheet" data-type="scores" aria-label="Scores">🏆</button>
        </div>
      </header>

      <section class="card">
        <div class="card-head"><h2>Joueurs</h2><span class="muted">${n} / ${L.MAX_PLAYERS}</span></div>
        <form class="add-row" data-form="add-player">
          <input id="name-input" maxlength="16" placeholder="${full ? 'Table complète' : 'Prénom'}" autocomplete="off" autocorrect="off" autocapitalize="words" enterkeyhint="done" ${full ? 'disabled' : ''}>
          <button class="btn small primary" type="submit" ${full ? 'disabled' : ''}>Ajouter</button>
        </form>
        ${n
          ? `<ul class="players">${settings.names
              .map(
                (name, i) => `
            <li><span class="num">${i + 1}</span><span class="pname">${esc(name)}</span>
              <button class="x" data-action="remove-player" data-i="${i}" aria-label="Retirer ${esc(name)}">×</button></li>`
              )
              .join('')}</ul>`
          : '<p class="muted empty">Ajoutez-vous dans l’ordre où vous êtes assis : c’est l’ordre de parole.</p>'}
      </section>

      <section class="card">
        <h2>Rôles</h2>
        ${stepper('undercover', '🕵️ Undercover', settings.undercover, n)}
        ${stepper('mrwhite', '🎩 Mr. White', settings.mrwhite, n)}
        ${n < L.MIN_PLAYERS
          ? `<p class="summary">Encore ${L.MIN_PLAYERS - n} joueur${L.MIN_PLAYERS - n > 1 ? 's' : ''} minimum.</p>`
          : err
            ? `<p class="summary error">${esc(err)}</p>`
            : `<p class="summary">${civils} civil${civils > 1 ? 's' : ''} · ${settings.undercover} undercover · ${settings.mrwhite} Mr. White</p>`}
      </section>

      <div class="bottom">
        <p class="muted center" style="font-size:14px">${fresh} binôme${fresh > 1 ? 's' : ''} pas encore joué${fresh > 1 ? 's' : ''} sur ${pairs.length}</p>
        <button class="btn primary" data-action="start" ${err ? 'disabled' : ''}>Lancer la partie</button>
      </div>`;
  }

  function addPlayer(raw) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) return false;
    if (settings.names.length >= L.MAX_PLAYERS) return toast(`${L.MAX_PLAYERS} joueurs maximum`), false;
    if (settings.names.some((n) => n.toLowerCase() === name.toLowerCase())) return toast(`${name} est déjà là`), false;
    settings.names.push(name);
    syncRoles();
    saveSettings();
    return true;
  }

  function startGame() {
    const n = settings.names.length;
    if (L.validateRoles(n, settings.undercover, settings.mrwhite)) return;
    const pick = L.pickPair(allPairs(), used);
    used = pick.used;
    store.set('used', used);
    const dealt = L.assignRoles(settings.names, settings.undercover, settings.mrwhite, pick.pair);
    game = {
      phase: 'pass',
      players: dealt.players,
      civilWord: dealt.civilWord,
      undercoverWord: dealt.undercoverWord,
      passIndex: 0,
      revealed: false,
      order: [],
      round: 1,
      pending: null,
      winner: null,
      gains: null,
    };
    if (pick.reset) toast('Tous les binômes ont été joués, on repart pour un tour !');
    saveGame();
    keepAwake();
  }

  // ---------- Distribution ----------

  function wordCard(p) {
    if (p.role === 'mrwhite') {
      return `
        <div class="word-card mrwhite">
          <span class="label">Pas de mot pour toi</span>
          <div class="word">🎩 Mr. White</div>
          <p class="hint">Écoute les autres et bluffe. Si tu te fais éliminer, tu peux encore gagner en devinant le mot des civils.</p>
        </div>`;
    }
    return `
      <div class="word-card">
        <span class="label">Ton mot</span>
        <div class="word">${esc(p.word)}</div>
        <p class="hint">Civil ou Undercover ? À toi de le découvrir…</p>
      </div>`;
  }

  function renderPass() {
    const N = game.players.length;
    const p = game.players[game.passIndex];
    const last = game.passIndex === N - 1;
    const top = `
      <header class="top">
        <button class="text-btn" data-action="quit">✕ Quitter</button>
        <span class="step">${game.passIndex + 1} / ${N}</span>
        <span style="width:88px"></span>
      </header>`;
    if (!game.revealed) {
      return `${top}
        <div class="stage">
          <p class="muted">Passe le téléphone à</p>
          <h1 class="big-name">${esc(p.name)}</h1>
          <button class="reveal-card" data-action="reveal">
            <span>👀</span><strong>Appuie pour voir ton mot</strong><small>Vérifie que personne ne regarde</small>
          </button>
        </div>`;
    }
    return `${top}
      <div class="stage">
        <h1 class="big-name" style="font-size:28px">${esc(p.name)}</h1>
        ${wordCard(p)}
      </div>
      <div class="bottom">
        <button class="btn primary" data-action="hide">${last ? 'C’est retenu, on commence' : 'C’est retenu, je cache'}</button>
      </div>`;
  }

  // ---------- Play ----------

  function renderPlay() {
    const ps = game.players;
    return `
      <header class="top">
        <button class="text-btn" data-action="quit">✕ Quitter</button>
        <span class="step">TOUR ${game.round}</span>
        <button class="text-btn" data-action="reshuffle">🔀 Ordre</button>
      </header>

      <section class="card">
        <h2>Ordre de parole</h2>
        <p class="muted" style="font-size:15px">Chacun donne un indice sur son mot, sans le dire.</p>
        <ol class="order">${game.order.map((i) => `<li>${esc(ps[i].name)}</li>`).join('')}</ol>
      </section>

      <section class="card">
        <h2>Vote</h2>
        <p class="muted" style="font-size:15px">Après le débat, touchez le joueur éliminé.</p>
        <div class="grid">
          ${ps
            .map((p, i) =>
              p.alive
                ? `<button class="pcard" data-action="pick" data-i="${i}">${esc(p.name)}</button>`
                : `<div class="pcard dead"><s>${esc(p.name)}</s><small class="${p.role}-c">${ROLE[p.role].emoji} ${ROLE[p.role].label}</small></div>`
            )
            .join('')}
        </div>
      </section>`;
  }

  function eliminate(i) {
    game.players[i].alive = false;
    game.pending = i;
    game.phase = 'eliminated';
    saveGame();
  }

  function renderEliminated() {
    const p = game.players[game.pending];
    const r = ROLE[p.role];
    const winner = p.role === 'mrwhite' ? null : L.checkWinner(game.players);
    const next =
      p.role === 'mrwhite'
        ? `<button class="btn primary" data-action="to-guess">Mr. White tente sa chance</button>`
        : winner
          ? `<button class="btn primary" data-action="finish" data-w="${winner}">Voir les résultats</button>`
          : `<button class="btn primary" data-action="next-round">Tour suivant</button>`;
    return `
      <div class="stage">
        <p class="muted">${esc(p.name)} était…</p>
        <div class="badge ${p.role}-c"><span class="emoji">${r.emoji}</span><span class="role">${r.label}</span></div>
        ${p.role === 'mrwhite' ? '<p class="muted">Dernière chance : deviner le mot des civils.</p>' : ''}
      </div>
      <div class="bottom">${next}</div>`;
  }

  function renderGuess() {
    const p = game.players[game.pending];
    return `
      <div class="stage">
        <p class="muted">🎩 Dernière chance</p>
        <h1 class="big-name" style="font-size:34px">${esc(p.name)}, quel est le mot des civils ?</h1>
        <p class="muted">Dis-le à voix haute, puis révèle la réponse.</p>
        ${game.guessRevealed
          ? `<div class="word-card"><span class="label">Le mot des civils</span><div class="word">${esc(game.civilWord)}</div></div>`
          : `<button class="reveal-card" data-action="reveal-guess" style="aspect-ratio:auto;padding:28px"><span>🔒</span><strong>Révéler la réponse</strong></button>`}
      </div>
      <div class="bottom">
        ${game.guessRevealed
          ? `<div class="btn-row">
              <button class="btn" data-action="guess" data-ok="0">❌ Raté</button>
              <button class="btn ok" data-action="guess" data-ok="1">✅ Trouvé</button>
            </div>`
          : ''}
      </div>`;
  }

  function nextRound() {
    game.round++;
    game.order = L.speakingOrder(game.players);
    game.phase = 'play';
    game.pending = null;
    saveGame();
  }

  function finish(winner) {
    game.winner = winner;
    game.phase = 'result';
    const before = scores;
    scores = L.applyScores(scores, game.players, winner);
    game.gains = Object.fromEntries(game.players.map((p) => [p.name, scores[p.name] - (before[p.name] || 0)]));
    store.set('scores', scores);
    saveGame();
  }

  // ---------- Result ----------

  function renderResult() {
    const ps = game.players;
    const hasUc = ps.some((p) => p.role === 'undercover');
    const hasMw = ps.some((p) => p.role === 'mrwhite');
    const title = {
      civils: 'Les Civils gagnent\u00a0!\u00a0🎉',
      impostors: hasUc && hasMw ? 'Les infiltrés gagnent\u00a0!\u00a0🕵️' : hasUc ? 'Victoire de l’Undercover\u00a0!\u00a0🕵️' : 'Mr. White gagne\u00a0!\u00a0🎩',
      mrwhite: 'Mr. White a trouvé\u00a0!\u00a0🎩',
    }[game.winner];
    const board = Object.entries(scores)
      .filter(([name]) => ps.some((p) => p.name === name))
      .sort((a, b) => b[1] - a[1]);
    return `
      <div class="stage" style="flex:0;padding-top:24px"><h1 class="winner-title">${title}</h1></div>

      <div class="words-reveal">
        <div><small class="civil-c">Civils</small><strong>${esc(game.civilWord)}</strong></div>
        <div><small class="undercover-c">Undercover</small><strong>${esc(game.undercoverWord)}</strong></div>
      </div>

      <section class="card">
        <h2>Les rôles</h2>
        <ul class="rows">
          ${ps
            .map(
              (p) => `<li><span>${esc(p.name)}</span><span class="${p.role}-c" style="font-weight:800">${ROLE[p.role].emoji} ${ROLE[p.role].label}</span></li>`
            )
            .join('')}
        </ul>
      </section>

      <section class="card">
        <h2>Scores</h2>
        <ul class="rows">
          ${board
            .map(
              ([name, pts]) =>
                `<li class="${game.gains[name] ? 'winner-row' : ''}"><span>${esc(name)}${game.gains[name] ? `<span class="gain">+${game.gains[name]}</span>` : ''}</span><span class="pts">${pts}</span></li>`
            )
            .join('')}
        </ul>
      </section>

      <div class="bottom">
        <button class="btn primary" data-action="replay">Rejouer avec un nouveau mot</button>
        <button class="btn" data-action="menu">Modifier les joueurs</button>
      </div>`;
  }

  // ---------- Sheets ----------

  function renderSheet() {
    if (!sheet) {
      $sheet.className = '';
      $sheet.innerHTML = '';
      return;
    }
    let body = '';
    if (sheet.type === 'rules') {
      body = `
        <h2>Règles</h2>
        <ul class="rules">
          <li><b>Civils</b> : ils ont tous le même mot.</li>
          <li><b>Undercover</b> : il a un mot proche, mais différent. Il ne sait pas qu’il est Undercover.</li>
          <li><b>Mr. White</b> : il n’a pas de mot. Il bluffe. Il ne parle jamais en premier.</li>
          <li>À chaque tour, chacun donne un indice sur son mot, puis on débat et on vote pour éliminer quelqu’un.</li>
          <li>Les <b>civils</b> gagnent quand tous les infiltrés sont éliminés.</li>
          <li>Les <b>infiltrés</b> gagnent s’il ne reste plus qu’un seul civil.</li>
          <li>Un <b>Mr. White</b> éliminé peut deviner le mot des civils : s’il trouve, il gagne seul.</li>
          <li>Points : civil 2, undercover 10, Mr. White 6, pour chaque joueur du camp gagnant.</li>
        </ul>
        <button class="btn" data-action="close-sheet">Compris</button>`;
    } else if (sheet.type === 'scores') {
      const board = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      body = `
        <h2>Scores</h2>
        ${board.length
          ? `<ul class="rows">${board.map(([n, p]) => `<li><span>${esc(n)}</span><span class="pts">${p}</span></li>`).join('')}</ul>`
          : '<p>Aucune partie terminée pour l’instant.</p>'}
        ${board.length ? '<button class="btn danger" data-action="reset-scores">Remettre les scores à zéro</button>' : ''}
        <button class="btn" data-action="close-sheet">Fermer</button>`;
    } else if (sheet.type === 'words') {
      body = `
        <h2>Binômes</h2>
        <p>${window.WORDS.length} binômes intégrés + ${customPairs.length} perso. Une paire ne retombe pas tant que vous n’avez pas tout joué.</p>
        <form class="pair-form" data-form="add-pair">
          <div class="inputs">
            <input class="field" name="a" maxlength="30" placeholder="Mot 1" autocomplete="off" autocapitalize="sentences">
            <input class="field" name="b" maxlength="30" placeholder="Mot 2" autocomplete="off" autocapitalize="sentences">
          </div>
          <button class="btn primary" type="submit">Ajouter ce binôme</button>
        </form>
        ${customPairs.length
          ? `<ul class="custom-list">${customPairs
              .map(
                (p, i) => `<li><span>${esc(p[0])} / ${esc(p[1])}</span><button class="x" data-action="remove-pair" data-i="${i}" aria-label="Supprimer">×</button></li>`
              )
              .join('')}</ul>`
          : ''}
        <button class="btn" data-action="reset-used">Réinitialiser l’historique (${used.length} joué${used.length > 1 ? 's' : ''})</button>
        <button class="btn" data-action="close-sheet">Fermer</button>`;
    } else if (sheet.type === 'player') {
      const p = game.players[sheet.i];
      body = `
        <h2>${esc(p.name)}</h2>
        <button class="btn danger" data-action="eliminate" data-i="${sheet.i}">Éliminer ${esc(p.name)}</button>
        <button class="btn" data-action="peek" data-i="${sheet.i}">${esc(p.name)} a oublié son mot</button>
        <button class="btn" data-action="close-sheet">Annuler</button>`;
    } else if (sheet.type === 'peek') {
      const p = game.players[sheet.i];
      body = sheet.shown
        ? `${wordCard(p)}<button class="btn primary" data-action="close-sheet">Cacher</button>`
        : `<h2>Passe le téléphone à ${esc(p.name)}</h2>
           <button class="btn primary" data-action="peek-show">C’est moi, montrer mon mot</button>
           <button class="btn" data-action="close-sheet">Annuler</button>`;
    }
    $sheet.className = 'open';
    $sheet.innerHTML = `<div class="backdrop" data-action="close-sheet"></div><div class="panel" role="dialog" aria-modal="true"><div class="grabber"></div>${body}</div>`;
  }

  // ---------- Render & events ----------

  let lastPhase;
  function render() {
    const phase = game ? game.phase : 'setup';
    $app.innerHTML = {
      setup: renderSetup,
      pass: renderPass,
      play: renderPlay,
      eliminated: renderEliminated,
      guess: renderGuess,
      result: renderResult,
    }[phase]();
    if (phase !== lastPhase) window.scrollTo(0, 0);
    lastPhase = phase;
    renderSheet();
  }

  const actions = {
    sheet: (d) => (sheet = { type: d.type }),
    'close-sheet': () => (sheet = null),
    'remove-player': (d) => {
      settings.names.splice(+d.i, 1);
      syncRoles();
      saveSettings();
    },
    step: (d) => {
      settings[d.role] = Math.max(0, settings[d.role] + +d.d);
      settings.custom = true;
      saveSettings();
    },
    start: startGame,
    reveal: () => (game.revealed = true),
    hide: () => {
      game.revealed = false;
      if (game.passIndex < game.players.length - 1) {
        game.passIndex++;
      } else {
        game.phase = 'play';
        game.order = L.speakingOrder(game.players);
      }
      saveGame();
    },
    reshuffle: () => {
      game.order = L.speakingOrder(game.players);
      saveGame();
    },
    pick: (d) => (sheet = { type: 'player', i: +d.i }),
    eliminate: (d) => {
      sheet = null;
      eliminate(+d.i);
    },
    peek: (d) => (sheet = { type: 'peek', i: +d.i, shown: false }),
    'peek-show': () => (sheet.shown = true),
    'to-guess': () => {
      game.phase = 'guess';
      game.guessRevealed = false;
      saveGame();
    },
    'reveal-guess': () => (game.guessRevealed = true),
    guess: (d) => {
      if (d.ok === '1') return finish('mrwhite');
      const w = L.checkWinner(game.players);
      w ? finish(w) : nextRound();
    },
    'next-round': nextRound,
    finish: (d) => finish(d.w),
    replay: startGame,
    menu: () => {
      game = null;
      saveGame();
    },
    quit: () => {
      if (!confirm('Arrêter la partie en cours ?')) return;
      game = null;
      saveGame();
    },
    'reset-scores': () => {
      if (!confirm('Remettre tous les scores à zéro ?')) return;
      scores = {};
      store.set('scores', scores);
    },
    'reset-used': () => {
      used = [];
      store.set('used', used);
      toast('Historique remis à zéro');
    },
    'remove-pair': (d) => {
      const [removed] = customPairs.splice(+d.i, 1);
      used = used.filter((k) => k !== L.pairKey(removed));
      store.set('custom', customPairs);
      store.set('used', used);
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    fn(el.dataset);
    render();
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'add-player') {
      const input = form.querySelector('input');
      const added = addPlayer(input.value);
      render();
      // Keep the keyboard up so the next name can be typed straight away.
      const next = document.getElementById('name-input');
      if (next && !next.disabled) {
        if (!added) next.value = input.value;
        next.focus();
      }
    } else if (form.dataset.form === 'add-pair') {
      const a = form.a.value.trim();
      const b = form.b.value.trim();
      if (!a || !b) return toast('Il faut deux mots');
      if (a.toLowerCase() === b.toLowerCase()) return toast('Les deux mots doivent être différents');
      const keys = [L.pairKey([a, b]), L.pairKey([b, a])];
      if (allPairs().some((p) => keys.includes(L.pairKey(p)))) return toast('Ce binôme existe déjà');
      customPairs.push([a, b]);
      store.set('custom', customPairs);
      toast(`${a} / ${b} ajouté`);
      renderSheet();
      $sheet.querySelector('input[name=a]')?.focus();
    }
  });

  // Resume an interrupted game (iOS may kill the web app when it's in the background).
  if (game && !game.players) game = null;
  syncRoles();
  render();
  if (game) keepAwake();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
