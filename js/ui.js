const UI = (() => {
  function cardImageUrl(scryfall, size = 'small') {
    if (!scryfall) return '';
    if (scryfall.image_uris) return scryfall.image_uris[size] || scryfall.image_uris.small || '';
    if (scryfall.card_faces?.[0]?.image_uris) return scryfall.card_faces[0].image_uris[size] || '';
    return '';
  }

  function getManaCost(scryfall) {
    if (!scryfall) return '';
    const mc = scryfall.mana_cost || scryfall.card_faces?.[0]?.mana_cost || '';
    return mc.replace(/\{([^}]+)\}/g, (_, sym) => `<span class="mana mana-${sym.toLowerCase()}">${sym}</span>`);
  }

  function getPT(scryfall) {
    if (!scryfall) return null;
    const pt = scryfall.power !== undefined
      ? `${scryfall.power}/${scryfall.toughness}`
      : (scryfall.card_faces?.[0]?.power !== undefined
        ? `${scryfall.card_faces[0].power}/${scryfall.card_faces[0].toughness}`
        : null);
    return pt;
  }

  function counterBadges(counters) {
    return Object.entries(counters)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<span class="counter-badge">${k}×${v}</span>`)
      .join('');
  }

  function renderDeckList(library, searchQuery = '') {
    const el = document.getElementById('card-list');
    const q = searchQuery.toLowerCase();
    const visible = library.filter(c =>
      (!q || c.name.toLowerCase().includes(q)) && c.remaining > 0
    );

    if (!visible.length) {
      el.innerHTML = '<p class="empty-msg">No cards match.</p>';
      return;
    }

    el.innerHTML = visible.map(c => {
      const img = cardImageUrl(c.scryfall, 'small');
      const keywords = c.scryfall ? Effects.getKeywords(c.scryfall).slice(0, 3).join(', ') : '';
      return `
        <div class="deck-card" data-name="${encodeURIComponent(c.name)}" title="${c.name}">
          ${img ? `<img src="${img}" alt="${c.name}" class="deck-card-thumb" loading="lazy">` : '<div class="no-img">?</div>'}
          <div class="deck-card-info">
            <span class="deck-card-name">${c.name}</span>
            ${keywords ? `<span class="deck-card-keywords">${keywords}</span>` : ''}
            <span class="deck-card-count">${c.remaining}/${c.quantity}</span>
          </div>
        </div>`;
    }).join('');
  }

  function renderTracker(state) {
    document.getElementById('turn-num').textContent = state.turn;
    document.getElementById('life-display').textContent = state.life;

    const btns = document.querySelectorAll('.phase-btn');
    btns.forEach(b => {
      b.classList.toggle('active', b.dataset.phase === state.phase);
    });
  }

  function renderZone(zoneId, cards) {
    const el = document.getElementById(`zone-${zoneId}`);
    if (!el) return;

    if (!cards.length) {
      el.innerHTML = '<p class="empty-msg">Empty</p>';
      return;
    }

    el.innerHTML = cards.map(card => renderCardInstance(card, zoneId)).join('');
  }

  function renderCardInstance(card, zone) {
    const img = cardImageUrl(card.scryfall, 'normal');
    const thumb = cardImageUrl(card.scryfall, 'small');
    const pt = getPT(card.scryfall);
    const keywords = card.scryfall ? Effects.getKeywords(card.scryfall) : [];
    const oracleText = Effects.getOracleText(card.scryfall);
    const tappedClass = card.isTapped ? 'tapped' : '';
    const counters = counterBadges(card.counters || {});

    const zoneButtons = {
      hand: `
        <button class="btn btn-play" data-action="play" data-id="${card.instanceId}">Play</button>
        <button class="btn btn-danger" data-action="discard" data-id="${card.instanceId}">Discard</button>
        <button class="btn btn-exile" data-action="hand-exile" data-id="${card.instanceId}">Exile</button>`,
      battlefield: `
        <button class="btn btn-tap" data-action="tap" data-id="${card.instanceId}">${card.isTapped ? 'Untap' : 'Tap'}</button>
        <button class="btn btn-graveyard" data-action="to-graveyard" data-id="${card.instanceId}">⚰ Grave</button>
        <button class="btn btn-exile" data-action="to-exile" data-id="${card.instanceId}">⬡ Exile</button>
        <button class="btn btn-counter" data-action="add-counter" data-id="${card.instanceId}" data-ctype="+1/+1">+1/+1</button>
        <button class="btn btn-counter-neg" data-action="add-counter" data-id="${card.instanceId}" data-ctype="-1/-1">-1/-1</button>`,
      graveyard: `
        <button class="btn" data-action="return-hand" data-id="${card.instanceId}">Return to Hand</button>
        <button class="btn btn-play" data-action="return-play" data-id="${card.instanceId}">Return to Play</button>
        <button class="btn btn-exile" data-action="grave-exile" data-id="${card.instanceId}">Exile</button>`,
      exile: `
        <button class="btn" data-action="exile-hand" data-id="${card.instanceId}">Return to Hand</button>`,
    };

    return `
      <div class="card-instance ${tappedClass}" data-id="${card.instanceId}">
        <div class="card-img-wrap">
          ${thumb ? `<img src="${thumb}" alt="${card.name}" class="card-thumb" loading="lazy"
            data-fullimg="${img}">` : `<div class="no-img-card">${card.name}</div>`}
          ${card.isTapped ? '<span class="tapped-label">TAP</span>' : ''}
        </div>
        <div class="card-details">
          <div class="card-name">${card.name}</div>
          ${pt ? `<div class="card-pt">${pt}${counters}</div>` : counters ? `<div class="card-pt">${counters}</div>` : ''}
          ${keywords.length ? `<div class="card-keywords">${keywords.slice(0,4).join(' · ')}</div>` : ''}
          ${oracleText ? `<div class="card-oracle">${oracleText.substring(0, 140)}${oracleText.length > 140 ? '…' : ''}</div>` : ''}
          <div class="card-actions">${zoneButtons[zone] || ''}</div>
        </div>
      </div>`;
  }

  function renderTokens(tokens, availableTokens) {
    const el = document.getElementById('token-area');
    if (!el) return;

    const tokenHtml = tokens.map(t => {
      const img = cardImageUrl(t.scryfall, 'small');
      return `
        <div class="token-instance ${t.isTapped ? 'tapped' : ''}" data-id="${t.instanceId}">
          ${img ? `<img src="${img}" alt="${t.name}" class="token-thumb" loading="lazy">` : ''}
          <div class="token-info">
            <span class="token-name">${t.name}</span>
            <span class="token-pt">${t.power}/${t.toughness}</span>
          </div>
          <div class="token-actions">
            <button class="btn btn-tap" data-action="tap-token" data-id="${t.instanceId}">${t.isTapped ? 'Untap' : 'Tap'}</button>
            <button class="btn btn-counter" data-action="token-counter" data-id="${t.instanceId}" data-ctype="+1/+1">+</button>
            <button class="btn btn-danger" data-action="remove-token" data-id="${t.instanceId}">✕</button>
          </div>
          ${Object.entries(t.counters||{}).map(([k,v])=>`<span class="counter-badge">${k}×${v}</span>`).join('')}
        </div>`;
    }).join('');

    const availableHtml = availableTokens.length ? `
      <div class="token-picker">
        <select id="token-select">
          <option value="">Select token...</option>
          ${availableTokens.map(t => `<option value="${t.id}">${t.name} (${t.power||'*'}/${t.toughness||'*'})</option>`).join('')}
        </select>
        <button class="btn" id="add-token-btn">+ Add</button>
      </div>` : '';

    const customHtml = `
      <div class="token-custom">
        <input id="custom-token-name" placeholder="Token name" class="input-sm">
        <input id="custom-token-p" placeholder="P" class="input-xs">
        <input id="custom-token-t" placeholder="T" class="input-xs">
        <button class="btn" id="add-custom-token-btn">+ Custom</button>
      </div>`;

    el.innerHTML = `
      <div class="token-list">${tokenHtml || '<p class="empty-msg">No tokens</p>'}</div>
      ${availableHtml}
      ${customHtml}`;
  }

  function showEffectModal(phaseEffects, phaseName) {
    const modal = document.getElementById('effect-modal');
    const body = document.getElementById('effect-modal-body');
    if (!phaseEffects.length) return;

    body.innerHTML = `
      <h3>${phaseName} Triggers</h3>
      ${phaseEffects.map(pe => `
        <div class="effect-entry">
          <strong>${pe.card.name}</strong>
          ${pe.triggers.map(t => `<p class="effect-text">${t.text}</p>`).join('')}
          ${pe.lifeEffects.map(le => `
            <button class="btn btn-life ${le.type === 'gain' ? 'btn-gain' : 'btn-lose'}"
              data-action="apply-life" data-amount="${le.type === 'gain' ? le.amount : -le.amount}">
              ${le.type === 'gain' ? `+${le.amount} life` : `-${le.amount} life`}
            </button>`).join('')}
        </div>`).join('')}
      <button class="btn" id="close-effect-modal">Dismiss</button>`;

    modal.classList.remove('hidden');
  }

  function hideEffectModal() {
    document.getElementById('effect-modal').classList.add('hidden');
  }

  function showCardPreview(imgUrl, name) {
    const preview = document.getElementById('card-preview');
    if (!imgUrl) return;
    preview.innerHTML = `<img src="${imgUrl}" alt="${name}"><span class="preview-name">${name}</span>`;
    preview.classList.remove('hidden');
  }

  function hideCardPreview() {
    document.getElementById('card-preview').classList.add('hidden');
  }

  return {
    renderDeckList, renderTracker, renderZone, renderTokens,
    showEffectModal, hideEffectModal, showCardPreview, hideCardPreview,
    cardImageUrl,
  };
})();
