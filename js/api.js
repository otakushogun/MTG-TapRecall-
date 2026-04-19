const API = (() => {
  const SCRYFALL_BASE = 'https://api.scryfall.com';
  const MOXFIELD_PROXY = '/api/moxfield';

  async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function extractDeckId(input) {
    input = input.trim();
    // Full URL: https://www.moxfield.com/decks/DECKID  (ignore trailing /edit etc.)
    const urlMatch = input.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];
    // Bare ID: only alphanumeric + _ -
    if (/^[a-zA-Z0-9_-]{6,}$/.test(input)) return input;
    return null;
  }

  async function fetchMoxfieldDeck(input) {
    const deckId = extractDeckId(input);
    if (!deckId) {
      throw new Error(
        'Could not find a deck ID in that input.\n' +
        'Paste the full URL from your browser, e.g.:\n' +
        'https://www.moxfield.com/decks/MkwJl0PJMEK0C8w_TZVhgw'
      );
    }

    let res;
    try {
      res = await fetch(`${MOXFIELD_PROXY}/v3/decks/all/${deckId}`);
    } catch (_) {
      throw new Error(
        'Cannot reach Moxfield. The nginx proxy is not running.\n' +
        'Either start nginx (see README) or paste your decklist as text instead.'
      );
    }

    if (res.status === 403 || res.status === 401) {
      throw new Error(
        'Deck is private. On Moxfield go to Edit Deck → Visibility and set it to Public, then try again.'
      );
    }
    if (res.status === 404) {
      throw new Error(
        'Deck not found (404). Check the URL is correct and the deck is set to Public on Moxfield.'
      );
    }
    if (!res.ok) {
      throw new Error(`Moxfield returned an error (HTTP ${res.status}). Try again or paste your decklist as text.`);
    }

    return res.json();
  }

  function parseMoxfieldDeck(data) {
    const cards = [];
    const sections = ['mainboard', 'sideboard', 'commanders', 'companions'];
    for (const section of sections) {
      if (!data[section]) continue;
      for (const [name, entry] of Object.entries(data[section])) {
        cards.push({
          name: entry.card?.name || name,
          quantity: entry.quantity || 1,
          section,
        });
      }
    }
    const isCommander = !!(data.commanders && Object.keys(data.commanders).length > 0)
      || cards.reduce((s, c) => s + c.quantity, 0) >= 98;
    return { cards, isCommander, deckName: data.name || 'My Deck' };
  }

  function parseTextDecklist(text) {
    const lines = text.trim().split('\n');
    const cards = [];
    let isCommander = false;
    let section = 'mainboard';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) {
        if (/commander/i.test(trimmed)) { section = 'commanders'; isCommander = true; }
        else if (/sideboard/i.test(trimmed)) section = 'sideboard';
        else if (/mainboard|main/i.test(trimmed)) section = 'mainboard';
        continue;
      }
      const match = trimmed.match(/^(\d+)x?\s+(.+)$/);
      if (match) {
        cards.push({ name: match[2].trim(), quantity: parseInt(match[1]), section });
      }
    }
    const total = cards.reduce((s, c) => s + c.quantity, 0);
    if (total >= 98) isCommander = true;
    return { cards, isCommander, deckName: 'Imported Deck' };
  }

  async function fetchScryfallCollection(names) {
    const results = [];
    const chunks = [];
    for (let i = 0; i < names.length; i += 75) chunks.push(names.slice(i, i + 75));

    for (const chunk of chunks) {
      await sleep(100);
      const res = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map(n => ({ name: n })) }),
      });
      if (!res.ok) throw new Error('Scryfall collection fetch failed');
      const data = await res.json();
      results.push(...(data.data || []));
    }
    return results;
  }

  async function fetchScryfallTokens(tokenIds) {
    const tokens = [];
    for (const id of tokenIds) {
      await sleep(80);
      try {
        const res = await fetch(`${SCRYFALL_BASE}/cards/${id}`);
        if (res.ok) tokens.push(await res.json());
      } catch (_) {}
    }
    return tokens;
  }

  async function loadDeck(input, isText = false) {
    let parsed;
    if (isText) {
      parsed = parseTextDecklist(input);
    } else {
      const raw = await fetchMoxfieldDeck(input);
      parsed = parseMoxfieldDeck(raw);
    }

    const uniqueNames = [...new Set(parsed.cards.map(c => c.name))];
    const scryfallCards = await fetchScryfallCollection(uniqueNames);

    const cardMap = {};
    for (const sc of scryfallCards) cardMap[sc.name] = sc;

    const tokenIds = new Set();
    for (const sc of scryfallCards) {
      if (sc.all_parts) {
        for (const part of sc.all_parts) {
          if (part.component === 'token') tokenIds.add(part.id);
        }
      }
    }

    const tokens = tokenIds.size > 0 ? await fetchScryfallTokens([...tokenIds]) : [];

    const enriched = parsed.cards.map(c => ({
      ...c,
      scryfall: cardMap[c.name] || null,
    }));

    return {
      deckName: parsed.deckName,
      isCommander: parsed.isCommander,
      cards: enriched,
      availableTokens: tokens,
    };
  }

  return { loadDeck, parseTextDecklist };
})();
