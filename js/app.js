(() => {
  let activeTab = 'hand';
  let searchQuery = '';

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
  }

  function syncTabVisibility() {
    document.querySelectorAll('.zone-panel').forEach(el => {
      el.classList.toggle('hidden', el.dataset.zone !== activeTab);
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === activeTab);
    });
    const s = State.get();
    document.querySelectorAll('.tab-btn').forEach(b => {
      const zone = b.dataset.tab;
      const count = zone === 'hand' ? s.hand.length
        : zone === 'battlefield' ? s.battlefield.length
        : zone === 'graveyard' ? s.graveyard.length
        : zone === 'exile' ? s.exile.length : 0;
      b.querySelector('.tab-count').textContent = count > 0 ? ` (${count})` : '';
    });
  }

  function handleDeckCardClick(e) {
    const card = e.target.closest('.deck-card');
    if (!card) return;
    const name = decodeURIComponent(card.dataset.name);
    const inst = State.drawToHand(name);
    if (inst) {
      activeTab = 'hand';
      render();
      showToast(`${name} drawn to hand`);
    }
  }

  function handleDeckCardHover(e) {
    const card = e.target.closest('.deck-card');
    if (!card) return;
    const name = decodeURIComponent(card.dataset.name);
    const s = State.get();
    const lib = s.library.find(c => c.name === name);
    if (lib?.scryfall) {
      const img = UI.cardImageUrl(lib.scryfall, 'normal');
      UI.showCardPreview(img, name);
    }
  }

  function handleDeckCardLeave(e) {
    if (!e.target.closest('.deck-card')) return;
    UI.hideCardPreview();
  }

  function handleCardAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const ctype = btn.dataset.ctype;

    switch (action) {
      case 'play':
        State.moveCard(id, 'battlefield');
        activeTab = 'battlefield';
        break;
      case 'discard':
        State.moveCard(id, 'graveyard');
        activeTab = 'graveyard';
        break;
      case 'hand-exile':
        State.moveCard(id, 'exile');
        activeTab = 'exile';
        break;
      case 'tap':
        State.tapCard(id);
        break;
      case 'to-graveyard':
        State.moveCard(id, 'graveyard');
        activeTab = 'graveyard';
        break;
      case 'to-exile':
        State.moveCard(id, 'exile');
        activeTab = 'exile';
        break;
      case 'return-hand':
      case 'exile-hand':
        State.moveCard(id, 'hand');
        activeTab = 'hand';
        break;
      case 'return-play':
        State.moveCard(id, 'battlefield');
        activeTab = 'battlefield';
        break;
      case 'grave-exile':
        State.moveCard(id, 'exile');
        activeTab = 'exile';
        break;
      case 'add-counter':
        State.addCounter(id, ctype);
        break;
      case 'tap-token':
        State.tapToken(id);
        break;
      case 'remove-token':
        State.removeToken(id);
        break;
      case 'token-counter':
        State.addTokenCounter(id, ctype);
        break;
      case 'apply-life':
        const delta = parseInt(btn.dataset.amount);
        State.adjustLife(delta);
        showToast(`Life ${delta > 0 ? '+' : ''}${delta} → ${State.get().life}`);
        break;
      default:
        return;
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
    const phaseLabel = Effects.PHASES.find(p => p.id === phase)?.label || phase;

    if (triggered.length) {
      UI.showEffectModal(triggered, phaseLabel);
    }

    render();
  }

  function handleLifeClick(e) {
    const btn = e.target.closest('[data-life]');
    if (!btn) return;
    State.adjustLife(parseInt(btn.dataset.life));
    render();
  }

  function handleTabClick(e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    syncTabVisibility();
  }

  function handleNextTurn() {
    State.nextTurn();
    const s = State.get();
    showToast(`Turn ${s.turn} — Untap`);
    render();
  }

  function handleAddToken() {
    const select = document.getElementById('token-select');
    if (!select?.value) return;
    const s = State.get();
    const token = s.availableTokens.find(t => t.id === select.value);
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

  function handleLifeEdit() {
    const input = document.getElementById('life-input');
    if (!input) return;
    State.setLife(input.value);
    render();
  }

  async function handleImport(e) {
    e.preventDefault();
    const urlInput = document.getElementById('deck-url').value.trim();
    const textInput = document.getElementById('deck-text').value.trim();

    if (!urlInput && !textInput) {
      showError('Enter a Moxfield URL/ID or paste a decklist.');
      return;
    }

    const btn = document.getElementById('import-btn');
    btn.disabled = true;
    btn.textContent = 'Importing…';
    showError('');

    try {
      const data = await API.loadDeck(urlInput || textInput, !urlInput);
      State.initDeck(data);
      showGame();
      render();
    } catch (err) {
      showError(`Import failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Import Deck';
    }
  }

  function showGame() {
    document.getElementById('import-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    const s = State.get();
    document.getElementById('deck-title').textContent = s.deckName;
  }

  function showImport() {
    if (!confirm('Reset game and import a new deck?')) return;
    State.clearGame();
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('import-screen').classList.remove('hidden');
  }

  function showError(msg) {
    const el = document.getElementById('import-error');
    if (el) el.textContent = msg;
  }

  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function bindEvents() {
    document.getElementById('import-form').addEventListener('submit', handleImport);
    document.getElementById('new-deck-btn').addEventListener('click', showImport);
    document.getElementById('next-turn-btn').addEventListener('click', handleNextTurn);
    document.getElementById('card-search').addEventListener('input', e => {
      searchQuery = e.target.value;
      UI.renderDeckList(State.get().library, searchQuery);
    });

    document.getElementById('card-list').addEventListener('click', handleDeckCardClick);
    document.getElementById('card-list').addEventListener('mouseover', handleDeckCardHover);
    document.getElementById('card-list').addEventListener('mouseout', handleDeckCardLeave);

    document.getElementById('phase-bar').addEventListener('click', handlePhaseClick);
    document.getElementById('life-controls').addEventListener('click', handleLifeClick);
    document.getElementById('tabs').addEventListener('click', handleTabClick);

    document.getElementById('play-area').addEventListener('click', e => {
      handleCardAction(e);
      // Handle dynamic token buttons
      if (e.target.id === 'add-token-btn') handleAddToken();
      if (e.target.id === 'add-custom-token-btn') handleAddCustomToken();
      if (e.target.id === 'close-effect-modal') UI.hideEffectModal();
      if (e.target.dataset.action === 'apply-life') {
        const delta = parseInt(e.target.dataset.amount);
        State.adjustLife(delta);
        render();
      }
    });

    document.getElementById('effect-modal').addEventListener('click', e => {
      if (e.target.id === 'close-effect-modal') UI.hideEffectModal();
      if (e.target.dataset.action === 'apply-life') {
        const delta = parseInt(e.target.dataset.amount);
        State.adjustLife(delta);
        render();
        UI.hideEffectModal();
      }
    });

    document.getElementById('life-display').addEventListener('dblclick', () => {
      const s = State.get();
      const val = prompt('Set life total:', s.life);
      if (val !== null) { State.setLife(val); render(); }
    });

    // Card image preview on hover for in-play cards
    document.getElementById('play-area').addEventListener('mouseover', e => {
      const img = e.target.closest('.card-thumb, .token-thumb');
      if (img?.dataset.fullimg) {
        document.getElementById('card-preview').innerHTML =
          `<img src="${img.dataset.fullimg}" alt="">`;
        document.getElementById('card-preview').classList.remove('hidden');
      }
    });
    document.getElementById('play-area').addEventListener('mouseout', e => {
      if (!e.target.closest('.card-thumb, .token-thumb')) return;
      UI.hideCardPreview();
    });
  }

  function buildPhaseBar() {
    const bar = document.getElementById('phase-bar');
    bar.innerHTML = Effects.PHASES.map(p =>
      `<button class="phase-btn" data-phase="${p.id}">${p.label}</button>`
    ).join('');
  }

  function init() {
    State.load();
    buildPhaseBar();
    bindEvents();

    const s = State.get();
    if (s.library.length > 0) {
      showGame();
      render();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
