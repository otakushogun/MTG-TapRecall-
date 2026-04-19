const State = (() => {
  const STORAGE_KEY = 'mtg_taprecall_v1';
  let state = null;

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function defaultState() {
    return {
      deckName: '',
      isCommander: false,
      life: 20,
      turn: 1,
      phase: 'untap',
      library: [],        // { name, quantity, remaining, scryfall }
      hand: [],           // card instances
      battlefield: [],    // card instances
      graveyard: [],      // card instances
      exile: [],          // card instances
      tokens: [],         // token instances on battlefield
      availableTokens: [], // token templates from scryfall
      temporaryEffects: [], // { instanceId, description, expiresPhase }
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

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (_) {}
    if (!state) state = defaultState();
    return state;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function get() { return state; }

  function initDeck(deckData) {
    state = defaultState();
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
      if (idx !== -1) {
        card = state[z].splice(idx, 1)[0];
        break;
      }
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

  function nextPhase() {
    const phases = Effects.PHASES.map(p => p.id);
    const idx = phases.indexOf(state.phase);
    if (idx === phases.length - 1) {
      nextTurn();
    } else {
      state.phase = phases[idx + 1];
      applyPhaseTransition(state.phase);
      save();
    }
  }

  function setPhase(phaseId) {
    state.phase = phaseId;
    applyPhaseTransition(phaseId);
    save();
  }

  function applyPhaseTransition(phase) {
    if (phase === 'untap') {
      state.battlefield.forEach(c => {
        if (Effects.shouldUntapOnUntap(c)) c.isTapped = false;
      });
      state.tokens.forEach(t => { t.isTapped = false; });
    }
    if (phase === 'cleanup') {
      state.temporaryEffects = [];
    }
  }

  function nextTurn() {
    state.turn++;
    state.phase = 'untap';
    applyPhaseTransition('untap');
    save();
  }

  function addToken(tokenData, count = 1) {
    for (let i = 0; i < count; i++) {
      state.tokens.push({
        instanceId: uid(),
        name: tokenData.name,
        scryfall: tokenData,
        count: 1,
        power: tokenData.power || '*',
        toughness: tokenData.toughness || '*',
        isTapped: false,
        counters: {},
      });
    }
    save();
  }

  function addCustomToken(name, power, toughness) {
    state.tokens.push({
      instanceId: uid(),
      name,
      scryfall: null,
      power,
      toughness,
      isTapped: false,
      counters: {},
    });
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

  function clearGame() {
    state = defaultState();
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    load, save, get, initDeck, drawToHand, moveCard, tapCard,
    addCounter, removeCounter, adjustLife, setLife,
    nextPhase, setPhase, nextTurn,
    addToken, addCustomToken, removeToken, tapToken, addTokenCounter,
    clearGame,
  };
})();
