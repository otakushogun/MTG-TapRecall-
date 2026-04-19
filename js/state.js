const State = (() => {
  const SESSION_KEY = 'mtg_taprecall_v1';
  const DECKS_KEY   = 'mtg_decks_v1';
  const GAMES_KEY   = 'mtg_games_v1';
  let state = null;

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function defaultState() {
    return {
      deckId: null,
      gameId: null,
      gameName: null,
      deckName: '',
      isCommander: false,
      life: 20,
      turn: 1,
      phase: 'untap',
      library: [],
      hand: [],
      battlefield: [],
      graveyard: [],
      exile: [],
      tokens: [],
      availableTokens: [],
      temporaryEffects: [],
    };
  }

  function makeInstance(libraryEntry) {
    return {
      instanceId: uid(),
      name: libraryEntry.name,
      scryfall: libraryEntry.scryfall,
      isTapped: false,
      counters: {},
      zone: 'hand',
    };
  }

  // ── Session (auto-save) ──────────────────────────────────────
  function load() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (_) {}
    if (!state) state = defaultState();
    return state;
  }

  function save() {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  }

  function get() { return state; }

  function hasActiveSession() {
    return state.library.length > 0 &&
      (state.hand.length > 0 || state.battlefield.length > 0 || state.turn > 1);
  }

  // ── Deck Library ─────────────────────────────────────────────
  function loadDecks() {
    try { return JSON.parse(localStorage.getItem(DECKS_KEY)) || []; } catch { return []; }
  }

  function _saveDecks(decks) {
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
  }

  function upsertDeck(deckData, existingId) {
    const decks = loadDecks();
    const id = existingId || uid();
    const deck = {
      id,
      name: deckData.deckName,
      isCommander: deckData.isCommander,
      cardCount: deckData.cards.reduce((s, c) => s + c.quantity, 0),
      cards: deckData.cards,
      availableTokens: deckData.availableTokens || [],
      importedAt: Date.now(),
    };
    const idx = decks.findIndex(d => d.id === id);
    if (idx >= 0) decks[idx] = deck; else decks.unshift(deck);
    _saveDecks(decks);
    return id;
  }

  function deleteDeck(deckId) {
    _saveDecks(loadDecks().filter(d => d.id !== deckId));
  }

  function getDeck(deckId) {
    return loadDecks().find(d => d.id === deckId) || null;
  }

  // ── Game Library ─────────────────────────────────────────────
  function loadGames() {
    try { return JSON.parse(localStorage.getItem(GAMES_KEY)) || []; } catch { return []; }
  }

  function _saveGames(games) {
    localStorage.setItem(GAMES_KEY, JSON.stringify(games));
  }

  function saveGameSnapshot(name) {
    const games = loadGames();
    const gameId = state.gameId || uid();
    state.gameId = gameId;
    state.gameName = name;
    const entry = {
      id: gameId,
      name,
      deckId: state.deckId,
      deckName: state.deckName,
      turn: state.turn,
      life: state.life,
      savedAt: Date.now(),
      snapshot: JSON.parse(JSON.stringify(state)),
    };
    const idx = games.findIndex(g => g.id === gameId);
    if (idx >= 0) games[idx] = entry; else games.unshift(entry);
    _saveGames(games);
    save();
    return gameId;
  }

  function loadGameSnapshot(gameId) {
    const entry = loadGames().find(g => g.id === gameId);
    if (!entry) return false;
    state = { ...entry.snapshot };
    save();
    return true;
  }

  function deleteGame(gameId) {
    _saveGames(loadGames().filter(g => g.id !== gameId));
  }

  // ── Deck Init ─────────────────────────────────────────────────
  function initDeck(deckData) {
    const deckId = upsertDeck(deckData);
    state = defaultState();
    state.deckId = deckId;
    state.deckName = deckData.deckName;
    state.isCommander = deckData.isCommander;
    state.life = deckData.isCommander ? 40 : 20;
    state.library = deckData.cards.map(c => ({
      name: c.name,
      quantity: c.quantity,
      remaining: c.quantity,
      section: c.section,
      scryfall: c.scryfall,
    }));
    state.availableTokens = deckData.availableTokens || [];
    save();
  }

  function startGameFromDeck(deckId) {
    const deck = getDeck(deckId);
    if (!deck) return false;
    state = defaultState();
    state.deckId = deckId;
    state.deckName = deck.name;
    state.isCommander = deck.isCommander;
    state.life = deck.isCommander ? 40 : 20;
    state.library = deck.cards.map(c => ({
      name: c.name,
      quantity: c.quantity,
      remaining: c.quantity,
      section: c.section,
      scryfall: c.scryfall,
    }));
    state.availableTokens = deck.availableTokens || [];
    save();
    return true;
  }

  // ── Card Actions ──────────────────────────────────────────────
  function drawToHand(cardName) {
    const lib = state.library.find(c => c.name === cardName && c.remaining > 0);
    if (!lib) return null;
    lib.remaining--;
    const inst = makeInstance(lib);
    inst.zone = 'hand';
    state.hand.push(inst);
    save();
    return inst;
  }

  function moveCard(instanceId, toZone) {
    const zones = ['hand', 'battlefield', 'graveyard', 'exile'];
    let card = null;
    for (const z of zones) {
      const idx = state[z].findIndex(c => c.instanceId === instanceId);
      if (idx !== -1) { card = state[z].splice(idx, 1)[0]; break; }
    }
    if (!card) return;
    if (toZone === 'library') {
      const lib = state.library.find(c => c.name === card.name);
      if (lib) lib.remaining = Math.min(lib.remaining + 1, lib.quantity);
    } else {
      card.zone = toZone;
      if (toZone === 'battlefield') card.isTapped = false;
      state[toZone].push(card);
    }
    save();
  }

  function tapCard(instanceId) {
    const card = state.battlefield.find(c => c.instanceId === instanceId);
    if (card) { card.isTapped = !card.isTapped; save(); }
  }

  function addCounter(instanceId, type) {
    const card = state.battlefield.find(c => c.instanceId === instanceId);
    if (!card) return;
    card.counters[type] = (card.counters[type] || 0) + 1;
    save();
  }

  function removeCounter(instanceId, type) {
    const card = state.battlefield.find(c => c.instanceId === instanceId);
    if (!card || !card.counters[type]) return;
    card.counters[type]--;
    if (card.counters[type] === 0) delete card.counters[type];
    save();
  }

  function adjustLife(delta) {
    state.life = Math.max(0, state.life + delta);
    save();
  }

  function setLife(val) {
    state.life = Math.max(0, parseInt(val) || 0);
    save();
  }

  // ── Phase / Turn ──────────────────────────────────────────────
  function setPhase(phaseId) {
    state.phase = phaseId;
    _applyPhaseTransition(phaseId);
    save();
  }

  function _applyPhaseTransition(phase) {
    if (phase === 'untap') {
      state.battlefield.forEach(c => { if (Effects.shouldUntapOnUntap(c)) c.isTapped = false; });
      state.tokens.forEach(t => { t.isTapped = false; });
    }
    if (phase === 'cleanup') {
      state.temporaryEffects = [];
    }
  }

  function nextTurn() {
    state.turn++;
    state.phase = 'untap';
    _applyPhaseTransition('untap');
    save();
  }

  // ── Tokens ────────────────────────────────────────────────────
  function addToken(tokenData, count = 1) {
    for (let i = 0; i < count; i++) {
      state.tokens.push({
        instanceId: uid(),
        name: tokenData.name,
        scryfall: tokenData,
        power: tokenData.power || '*',
        toughness: tokenData.toughness || '*',
        isTapped: false,
        counters: {},
      });
    }
    save();
  }

  function addCustomToken(name, power, toughness) {
    state.tokens.push({ instanceId: uid(), name, scryfall: null, power, toughness, isTapped: false, counters: {} });
    save();
  }

  function removeToken(instanceId) {
    state.tokens = state.tokens.filter(t => t.instanceId !== instanceId);
    save();
  }

  function tapToken(instanceId) {
    const t = state.tokens.find(t => t.instanceId === instanceId);
    if (t) { t.isTapped = !t.isTapped; save(); }
  }

  function addTokenCounter(instanceId, type) {
    const t = state.tokens.find(t => t.instanceId === instanceId);
    if (!t) return;
    t.counters[type] = (t.counters[type] || 0) + 1;
    save();
  }

  function clearSession() {
    state = defaultState();
    localStorage.removeItem(SESSION_KEY);
  }

  return {
    load, save, get, hasActiveSession,
    loadDecks, upsertDeck, deleteDeck, getDeck,
    loadGames, saveGameSnapshot, loadGameSnapshot, deleteGame,
    initDeck, startGameFromDeck,
    drawToHand, moveCard, tapCard, addCounter, removeCounter,
    adjustLife, setLife, setPhase, nextTurn,
    addToken, addCustomToken, removeToken, tapToken, addTokenCounter,
    clearSession,
  };
})();
