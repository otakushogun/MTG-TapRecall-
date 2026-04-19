const Effects = (() => {
  const PHASES = [
    { id: 'untap',     label: 'Untap' },
    { id: 'upkeep',    label: 'Upkeep' },
    { id: 'draw',      label: 'Draw' },
    { id: 'main1',     label: 'Main 1' },
    { id: 'begin_combat', label: 'Begin Combat' },
    { id: 'attackers', label: 'Attackers' },
    { id: 'blockers',  label: 'Blockers' },
    { id: 'damage',    label: 'Damage' },
    { id: 'end_combat',label: 'End Combat' },
    { id: 'main2',     label: 'Main 2' },
    { id: 'end_step',  label: 'End Step' },
    { id: 'cleanup',   label: 'Cleanup' },
  ];

  const PHASE_PATTERNS = {
    untap:        [/at the beginning of your untap step/i],
    upkeep:       [/at the beginning of your upkeep/i, /at the beginning of each upkeep/i],
    draw:         [/at the beginning of your draw step/i],
    begin_combat: [/at the beginning of (your )?combat/i],
    end_combat:   [/at the end of combat/i],
    end_step:     [/at the beginning of (your |the )?end step/i, /at the end of (your )?turn/i],
    cleanup:      [], // handled specially for "until end of turn" expiry
  };

  const KEYWORDS = [
    'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
    'first strike', 'double strike', 'hexproof', 'shroud', 'indestructible',
    'menace', 'reach', 'flash', 'protection', 'ward', 'prowess',
  ];

  function getOracleText(card) {
    if (!card) return '';
    if (card.card_faces) {
      return card.card_faces.map(f => f.oracle_text || '').join('\n');
    }
    return card.oracle_text || '';
  }

  function getKeywords(card) {
    const text = getOracleText(card).toLowerCase();
    const found = [];
    for (const kw of KEYWORDS) {
      if (text.includes(kw)) found.push(kw);
    }
    if (card.keywords) {
      for (const kw of card.keywords) {
        if (!found.includes(kw.toLowerCase())) found.push(kw.toLowerCase());
      }
    }
    return found;
  }

  function getPhaseTriggers(card) {
    const text = getOracleText(card);
    const triggers = [];

    for (const [phase, patterns] of Object.entries(PHASE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const sentence = extractSentence(text, pattern);
          triggers.push({ phase, text: sentence });
          break;
        }
      }
    }

    // "until end of turn" → expires at cleanup
    if (/until end of turn/i.test(text)) {
      triggers.push({ phase: 'cleanup', text: 'Effects that last until end of turn expire.' });
    }

    return triggers;
  }

  function extractSentence(text, pattern) {
    const match = text.match(pattern);
    if (!match) return text.substring(0, 120);
    const start = Math.max(0, match.index);
    const end = text.indexOf('.', start);
    return text.substring(start, end > 0 ? end + 1 : start + 120).trim();
  }

  function getLifeEffects(text) {
    const effects = [];
    const gainMatch = text.match(/you gain (\d+) life/gi);
    const lossMatch = text.match(/you lose (\d+) life/gi);
    const lifelink = /lifelink/i.test(text);

    if (gainMatch) gainMatch.forEach(m => {
      const amt = parseInt(m.match(/(\d+)/)[1]);
      effects.push({ type: 'gain', amount: amt, text: m });
    });
    if (lossMatch) lossMatch.forEach(m => {
      const amt = parseInt(m.match(/(\d+)/)[1]);
      effects.push({ type: 'lose', amount: amt, text: m });
    });
    if (lifelink) effects.push({ type: 'lifelink', text: 'Lifelink — gain life equal to damage dealt' });

    return effects;
  }

  function getPhaseEffectsForCards(battlefieldCards, phase) {
    const triggered = [];
    for (const card of battlefieldCards) {
      if (!card.scryfall) continue;
      const triggers = getPhaseTriggers(card.scryfall);
      const matching = triggers.filter(t => t.phase === phase);
      if (matching.length) {
        triggered.push({
          card,
          triggers: matching,
          lifeEffects: matching.flatMap(t => getLifeEffects(t.text)),
        });
      }
    }
    return triggered;
  }

  function shouldUntapOnUntap(card) {
    const text = getOracleText(card?.scryfall);
    return !/doesn't untap/i.test(text);
  }

  return { PHASES, getKeywords, getPhaseTriggers, getPhaseEffectsForCards, getOracleText, getLifeEffects, shouldUntapOnUntap };
})();
