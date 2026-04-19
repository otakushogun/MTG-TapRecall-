# MTG TapRecall

A browser-based Magic: The Gathering game tracker. Import any public Moxfield deck or paste a decklist, then track your hand, battlefield, graveyard, exile, tokens, life total, turn counter, and phase effects — all saved locally in your browser.

---

## Features

- **Deck import** via Moxfield URL or pasted text decklist
- **Deck library** — save and re-use decks across sessions
- **Saved games** — snapshot a game by name and come back to it later
- **Card zones** — Hand → Battlefield → Graveyard / Exile, with full recursion support
- **Phase tracker** — click any MTG phase to apply it; cards with matching oracle text triggers are surfaced automatically
- **Life counter** — auto-set to 20 (Standard) or 40 (Commander) based on deck size
- **Token panel** — Scryfall tokens from the deck plus custom token creation
- **Tap / counter tracking** — tap cards, add +1/+1 or −1/−1 counters
- **Card preview** — hover any card for a full-size image
- **Offline-friendly** — all state is stored in browser localStorage; no login required

---

## Installation

### Option A — Local file (quickest)

No server required. Open `index.html` directly in any modern browser.

> **Note:** Moxfield deck import requires the nginx proxy (Option B) due to CORS restrictions. Pasting a text decklist works without a server.

```bash
git clone https://github.com/otakushogun/MTG-TapRecall-.git
cd MTG-TapRecall-
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

---

### Option B — nginx (recommended for Moxfield import)

The included `nginx.conf` proxies Moxfield API requests through your local server to bypass browser CORS restrictions.

#### 1. Install nginx

| Platform | Command |
|----------|---------|
| Ubuntu / Debian | `sudo apt install nginx` |
| macOS (Homebrew) | `brew install nginx` |
| Windows | Download from [nginx.org](https://nginx.org/en/download.html) |

#### 2. Clone the repo

```bash
git clone https://github.com/otakushogun/MTG-TapRecall-.git
```

#### 3. Copy files to the web root

```bash
sudo mkdir -p /var/www/html/mtg-taprecall
sudo cp -r MTG-TapRecall-/* /var/www/html/mtg-taprecall/
```

#### 4. Install the nginx config

```bash
sudo cp /var/www/html/mtg-taprecall/nginx.conf /etc/nginx/sites-available/mtg-taprecall
sudo ln -s /etc/nginx/sites-available/mtg-taprecall /etc/nginx/sites-enabled/
sudo nginx -t          # verify config
sudo systemctl reload nginx
```

#### 5. Open the app

```
http://localhost
```

> If port 80 is already in use, edit `nginx.conf` and change `listen 80;` to another port (e.g. `listen 8080;`), then visit `http://localhost:8080`.

---

### Option C — Any static file server

If you just want Scryfall card data (no Moxfield URL import), any static server works:

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8080
```

Then open `http://localhost:8080`.

---

## Usage

### Home Screen

When you first open the app you'll see the home dashboard with two panels:

| Panel | Contents |
|-------|----------|
| **My Decks** | All previously imported decks |
| **Saved Games** | Named game snapshots you've saved |

A **▶ Continue** button appears at the bottom if you have an unsaved game in progress.

---

### Importing a Deck

Click **+ Import Deck** in the My Decks panel. You have two options:

---

#### Option 1 — Moxfield URL *(requires nginx proxy)*

**Step 1 — Make the deck public**

On Moxfield, open your deck, click **Edit Deck**, scroll to **Visibility**, and set it to **Public**. Private decks cannot be fetched.

**Step 2 — Copy the deck URL**

In your browser address bar the URL looks like:

```
https://www.moxfield.com/decks/MkwJl0PJMEK0C8w_TZVhgw
                                ^^^^^^^^^^^^^^^^^^^^^^^^
                                      this is the deck ID
```

Copy the full URL (or just the deck ID after `/decks/`) and paste it into the **Moxfield URL** field.

> If you get *"Cannot reach Moxfield"* it means the nginx proxy is not running. Either start nginx (see [Installation → Option B](#option-b--nginx-recommended-for-moxfield-import)) or use Option 2 below.

---

#### Option 2 — Paste decklist text *(works without nginx)*

Paste a standard MTG decklist directly into the text box:

```
4 Lightning Bolt
2 Island
12 Mountain

// Sideboard
2 Smash to Smithereens

// Commander
1 Atraxa, Praetors' Voice
```

Format rules:
- One card per line: `QUANTITY Card Name`
- `x` suffix is accepted: `4x Lightning Bolt`
- Lines starting with `//` are section headers — use `// Commander` to flag a Commander deck
- Blank lines are ignored

You can export this format from Moxfield via **Export → Text** on any deck page.

---

After import, card images and oracle text are fetched from Scryfall. The deck is saved to your library automatically and a new game starts immediately.

**Format detection:** decks with 98+ cards or a `// Commander` section start at 40 life; all others start at 20.

---

### Playing a Game

#### Left column — Decklist
- **Search** the card name field to filter your deck.
- **Click any card** to draw it to your hand.
- **Hover** a card for a full-size image preview.
- The count (`2/4`) shows cards remaining in library vs. total copies.

#### Top bar — Turn & Phase Tracker
| Control | Action |
|---------|--------|
| **Next Turn ▶** | Increments the turn counter, resets to Untap, and untaps all permanents |
| **Phase buttons** | Click to move to that phase; triggers a popup listing any cards in play with matching oracle text effects |
| **♥ − / +** | Adjust life by 1; double-click the number to type any value |
| **💾 Save** | Name and save the current game snapshot |
| **🏠** | Return to home screen (warns if the game is unsaved) |

#### Middle section — Card Zones (tabs)

| Tab | Contents |
|-----|----------|
| **Hand** | Cards drawn from the decklist |
| **Battlefield** | Cards in play |
| **Graveyard** | Discarded / destroyed cards |
| **Exile** | Exiled cards |

**Hand actions:** Play · Discard · Exile

**Battlefield actions:** Tap/Untap · ⚰ Grave · ⬡ Exile · +1/+1 counter · −1/−1 counter

**Graveyard actions:** Return to Hand · Return to Play · Exile

**Exile actions:** Return to Hand

#### Bottom section — Tokens
- **Select token** from the dropdown (populated from Scryfall token data in your deck) and click **+ Add**.
- Or click **+ Custom** and enter a name, power, and toughness.
- Each token can be tapped, given counters, or removed.

---

### Phase Effects

When you click a phase button the app scans every card on your battlefield for oracle text matching that phase:

| Phase | Triggers detected |
|-------|------------------|
| Untap | All permanents auto-untap (unless "doesn't untap" is in the oracle text) |
| Upkeep | "at the beginning of your upkeep…" |
| Draw | "at the beginning of your draw step…" |
| Begin Combat | "at the beginning of combat…" |
| End Combat | "at the end of combat…" |
| End Step | "at the beginning of your end step…" / "at the end of your turn…" |
| Cleanup | "until end of turn" effects expire |

A popup lists each triggered card with its relevant oracle text. If a life gain or loss is detected you can click **+N life** / **−N life** to apply it directly.

---

### Saving & Loading Games

**Save:** Click **💾 Save** in the tracker bar, enter a name (e.g. "vs Sarah – Game 2"), and confirm. Re-saving a game you've already named overwrites the same entry.

**Load:** From the home screen, click **▶ Load** next to any saved game. If you have unsaved progress you'll be asked to confirm before overwriting.

**Delete:** Click **✕** on any deck or game entry. Decks and games are stored independently — deleting a deck does not delete games played with it.

---

### Data Storage

Everything is stored in your browser's `localStorage` — no account or internet connection is needed to play (card images are fetched from Scryfall on first import and cached by the browser).

| Key | Contents |
|-----|----------|
| `mtg_decks_v1` | Saved deck library |
| `mtg_games_v1` | Named game snapshots |
| `mtg_taprecall_v1` | Current session auto-save |

To reset all data: open your browser's DevTools → Application → Local Storage → clear the keys above.

---

## Browser Compatibility

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. JavaScript must be enabled.

---

## License

See [LICENSE](LICENSE).
