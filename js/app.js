(() => {
  let activeTab = 'hand';
  let searchQuery = '';

  // ── Render ────────────────────────────────────────────────────
  function render() {
    const s = State.get();
    UI.renderTracker(s);
    UI.renderDeckList(s.library, searchQuery);
    UI.renderZone('hand', s.hand);
    UI.renderZone('battlefield', s.battlefield);
    UI.renderZone('graveyard', s.graveyard);
    UI.renderZone('exile', s.exile);
    UI.renderTokens(s.tokens, s.availableTokens);
    syncTabVisibility();
    updateGameLabel();
  }

  function syncTabVisibility() {
    document.querySelectorAll('.zone-panel').forEach(el => {
      el.classList.toggle('hidden', el.dataset.zone !== activeTab);
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === activeTab);
      const zone = b.dataset.tab;
      const s = State.get();
      const count = zone === 'hand' ? s.hand.length
        : zone === 'battlefield' ? s.battlefield.length
        : zone === 'graveyard' ? s.graveyard.length
        : zone === 'exile' ? s.exile.length : 0;
      b.querySelector('.tab-count').textContent = count > 0 ? ` (${count})` : '';
    });
  }

  function updateGameLabel() {
    const s = State.get();
    const el = document.getElementById('game-name-label');
    if (el) el.textContent = s.gameName || 'Unsaved game';
  }

  function renderHome() {
    UI.renderSavedDecks(State.loadDecks());
    UI.renderSavedGames(State.loadGames());
    const hasSession = State.hasActiveSession();
    const cont = document.getElementById('continue-btn');
    if (cont) {
      cont.classList.toggle('hidden', !hasSession);
      if (hasSession) {
        const s = State.get();
        cont.textContent = `▶ Continue — ${s.deckName}, Turn ${s.turn}`;
      }
    }
  }

  // ── Screen Navigation ─────────────────────────────────────────
  function showHome() {
    document.getElementById('home-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    hideImportModal();
    renderHome();
  }

  function showGame() {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    const s = State.get();
    document.getElementById('deck-title').textContent = s.deckName;
    activeTab = 'hand';
    render();
  }

  function showImportModal() {
    document.getElementById('import-modal').classList.remove('hidden');
    document.getElementById('import-error').textContent = '';
    document.getElementById('deck-url').value = '';
    document.getElementById('deck-text').value = '';
  }

  function hideImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
  }

  function showSaveModal() {
    const s = State.get();
    document.getElementById('save-game-input').value = s.gameName || defaultGameName();
    document.getElementById('save-modal').classList.remove('hidden');
  }

  function hideSaveModal() {
    document.getElementById('save-modal').classList.add('hidden');
  }

  function defaultGameName() {
    const s = State.get();
    const d = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${s.deckName} – ${d}`;
  }

  // ── Import ────────────────────────────────────────────────────
  async function handleImport(e) {
    e.preventDefault();
    const urlInput = document.getElementById('deck-url').value.trim();
    const textInput = document.getElementById('deck-text').value.trim();
    if (!urlInput && !textInput) {
      document.getElementById('import-error').textContent = 'Enter a Moxfield URL/ID or paste a decklist.';
      return;
    }
    const btn = document.getElementById('import-btn');
    btn.disabled = true;
    btn.textContent = 'Importing…';
    document.getElementById('import-error').textContent = '';
    try {
      const data = await API.loadDeck(urlInput || textInput, !urlInput);
      State.initDeck(data);
      hideImportModal();
      showGame();
      showToast(`"${data.deckName}" imported and saved to library`);
    } catch (err) {
      document.getElementById('import-error').textContent = `Import failed: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Import Deck';
    }
  }

  // ── Home Screen Actions ───────────────────────────────────────
  function handleHomeAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'play-deck':
        if (State.hasActiveSession() && !confirm('Start a new game? Your current unsaved progress will be lost.')) return;
        if (State.startGameFromDeck(id)) showGame();
        break;

      case 'delete-deck':
        if (!confirm('Delete this deck from your library?')) return;
        State.deleteDeck(id);
        renderHome();
        break;

      case 'load-game':
        if (State.hasActiveSession() && !confirm('Load this saved game? Your current unsaved progress will be lost.')) return;
        if (State.loadGameSnapshot(id)) showGame();
        break;

      case 'delete-game':
        if (!confirm('Delete this saved game?')) return;
        State.deleteGame(id);
        renderHome();
        break;
    }
  }

  // ── Save Game ─────────────────────────────────────────────────
  function handleSaveGame(e) {
    e.preventDefault();
    const name = document.getElementById('save-game-input').value.trim();
    if (!name) return;
    State.saveGameSnapshot(name);
    hideSaveModal();
    updateGameLabel();
    showToast(`Game saved: "${name}"`);
  }

  // ── Game Actions ──────────────────────────────────────────────
  function handleDeckCardClick(e) {
    const card = e.target.closest('.deck-card');
    if (!card) return;
    const name = decodeURIComponent(card.dataset.name);
    const inst = State.drawToHand(name);
    if (inst) { activeTab = 'hand'; render(); showToast(`${name} drawn to hand`); }
  }

  function handleDeckCardHover(e) {
    const card = e.target.closest('.deck-card');
    if (!card) return;
    const name = decodeURIComponent(card.dataset.name);
    const lib = State.get().library.find(c => c.name === name);
    if (lib?.scryfall) UI.showCardPreview(UI.cardImageUrl(lib.scryfall, 'normal'), name);
  }

  function handleCardAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const ctype = btn.dataset.ctype;

    switch (action) {
      case 'play':           State.moveCard(id, 'battlefield'); activeTab = 'battlefield'; break;
      case 'discard':        State.moveCard(id, 'graveyard');   activeTab = 'graveyard';   break;
      case 'hand-exile':     State.moveCard(id, 'exile');       activeTab = 'exile';       break;
      case 'tap':            State.tapCard(id);                                             break;
      case 'to-graveyard':   State.moveCard(id, 'graveyard');   activeTab = 'graveyard';   break;
      case 'to-exile':       State.moveCard(id, 'exile');       activeTab = 'exile';       break;
      case 'return-hand':
      case 'exile-hand':     State.moveCard(id, 'hand');        activeTab = 'hand';        break;
      case 'return-play':    State.moveCard(id, 'battlefield'); activeTab = 'battlefield'; break;
      case 'grave-exile':    State.moveCard(id, 'exile');       activeTab = 'exile';       break;
      case 'add-counter':    State.addCounter(id, ctype);                                  break;
      case 'tap-token':      State.tapToken(id);                                           break;
      case 'remove-token':   State.removeToken(id);                                        break;
      case 'token-counter':  State.addTokenCounter(id, ctype);                             break;
      default: return;
    }
    render();
  }

  function handlePhaseClick(e) {
    const btn = e.target.closest('.phase-btn');
    if (!btn) return;
    const phase = btn.dataset.phase;
    State.setPhase(phase);
    const s = State.get();
    const triggered = Effects.getPhaseEffectsForCards(s.battlefield, phase);
    const label = Effects.PHASES.find(p => p.id === phase)?.label || phase;
    if (triggered.length) UI.showEffectModal(triggered, label);
    render();
  }

  function handleAddToken() {
    const select = document.getElementById('token-select');
    if (!select?.value) return;
    const token = State.get().availableTokens.find(t => t.id === select.value);
    if (token) { State.addToken(token); render(); }
  }

  function handleAddCustomToken() {
    const name = document.getElementById('custom-token-name')?.value?.trim();
    const p = document.getElementById('custom-token-p')?.value?.trim() || '*';
    const t = document.getElementById('custom-token-t')?.value?.trim() || '*';
    if (!name) return;
    State.addCustomToken(name, p, t);
    document.getElementById('custom-token-name').value = '';
    render();
  }

  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ── Event Binding ─────────────────────────────────────────────
  function bindEvents() {
    // Home screen
    document.getElementById('show-import-btn').addEventListener('click', showImportModal);
    document.getElementById('continue-btn').addEventListener('click', showGame);
    document.getElementById('home-library').addEventListener('click', handleHomeAction);
    document.getElementById('home-games').addEventListener('click', handleHomeAction);
    document.getElementById('cancel-import-btn').addEventListener('click', hideImportModal);
    document.getElementById('import-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('import-modal')) hideImportModal();
    });
    document.getElementById('import-form').addEventListener('submit', handleImport);

    // Game screen navigation
    document.getElementById('home-btn').addEventListener('click', () => showHome());
    document.getElementById('save-game-btn').addEventListener('click', showSaveModal);
    document.getElementById('save-game-form').addEventListener('submit', handleSaveGame);
    document.getElementById('cancel-save-btn').addEventListener('click', hideSaveModal);
    document.getElementById('save-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('save-modal')) hideSaveModal();
    });

    // Deck list
    document.getElementById('card-search').addEventListener('input', e => {
      searchQuery = e.target.value;
      UI.renderDeckList(State.get().library, searchQuery);
    });
    document.getElementById('card-list').addEventListener('click', handleDeckCardClick);
    document.getElementById('card-list').addEventListener('mouseover', handleDeckCardHover);
    document.getElementById('card-list').addEventListener('mouseout', e => {
      if (!e.target.closest('.deck-card')) return;
      UI.hideCardPreview();
    });

    // Phase + life
    document.getElementById('phase-bar').addEventListener('click', handlePhaseClick);
    document.getElementById('next-turn-btn').addEventListener('click', () => {
      State.nextTurn();
      showToast(`Turn ${State.get().turn} — Untap`);
      render();
    });
    document.getElementById('life-controls').addEventListener('click', e => {
      const btn = e.target.closest('[data-life]');
      if (!btn) return;
      State.adjustLife(parseInt(btn.dataset.life));
      render();
    });
    document.getElementById('life-display').addEventListener('dblclick', () => {
      const val = prompt('Set life total:', State.get().life);
      if (val !== null) { State.setLife(val); render(); }
    });

    // Tabs
    document.getElementById('tabs').addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      activeTab = btn.dataset.tab;
      syncTabVisibility();
    });

    // Play area (card actions + tokens)
    document.getElementById('play-area').addEventListener('click', e => {
      handleCardAction(e);
      if (e.target.id === 'add-token-btn') handleAddToken();
      if (e.target.id === 'add-custom-token-btn') handleAddCustomToken();
    });

    // Card image preview on hover
    document.getElementById('play-area').addEventListener('mouseover', e => {
      const img = e.target.closest('.card-thumb, .token-thumb');
      if (img?.dataset.fullimg) {
        document.getElementById('card-preview').innerHTML = `<img src="${img.dataset.fullimg}" alt="">`;
        document.getElementById('card-preview').classList.remove('hidden');
      }
    });
    document.getElementById('play-area').addEventListener('mouseout', e => {
      if (!e.target.closest('.card-thumb, .token-thumb')) return;
      UI.hideCardPreview();
    });

    // Effect modal
    document.getElementById('effect-modal').addEventListener('click', e => {
      if (e.target.id === 'close-effect-modal') UI.hideEffectModal();
      if (e.target.dataset.action === 'apply-life') {
        State.adjustLife(parseInt(e.target.dataset.amount));
        render();
        UI.hideEffectModal();
      }
    });
  }

  function buildPhaseBar() {
    document.getElementById('phase-bar').innerHTML = Effects.PHASES.map(p =>
      `<button class="phase-btn" data-phase="${p.id}">${p.label}</button>`
    ).join('');
  }

  function init() {
    State.load();
    buildPhaseBar();
    bindEvents();

    // Resume active game if one exists, otherwise go home
    if (State.get().library.length > 0) {
      showGame();
    } else {
      showHome();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
