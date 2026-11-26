# TypeBounds — Design

Pixel-art typing tower defense. Protect the tower in the center. Enemies walk in from every edge with words under them. Type a word to kill its enemy.

## How to run
Double-click `index.html`. No build step, no server. Scripts are classic `<script>` tags (not ES modules) so `file://` works.

## Core rules
- Typing the first letter of a word locks that enemy. Further keys go to the locked enemy.
- **Typo:** combo resets to 0. The lock stays. No enemy takes damage until the correct next letter is typed.
- Backspace / Esc drops the lock and resets that word's progress.
- Enemies that reach the tower stop and attack it on a timer. Tower HP 0 = game over.
- Score per kill = word length × 10 × combo multiplier (+0.25 per 10 combo, max ×3).
- A wave with zero typos gives a PERFECT bonus (50 × wave).

## Enemies
| Enemy | Word | Status |
|---|---|---|
| Runner | 3 letters, fast | Built (step 1) |
| Tank | 7–12 letters, slow, hits hard | Built (step 1) |
| Mathematician | `7+5` → type `12` | Wave 4 — step 3 |
| Word Color | type the written word | Wave 6 — step 3 |
| Ink Color | type the ink color; must look clearly different from Word Color | Wave TBD (not 9) — step 3 |
| Boss | long phrase, fires 1-letter projectiles | Every 5th wave — step 4 |
| Rainbow Boss | `red + blue` → `purple` | Every 10th wave — step 6 |

## Gold and shop (step 2 — built)
- Gold: Runner 2, Tank 5. Wave clear +5 + 2×wave. PERFECT wave +10 more.
- Shop opens after every wave as **3 random upgrade cards** that spin like a slot machine and land one by one (Enter skips the spin). Only items you can use right now are offered (e.g. no `repair` when nothing is damaged).
- **Buy a card by typing its word.** Bought cards show SOLD. A typo clears the typed word. Backspace deletes one letter.
- `reroll` = spin 3 new cards: 10 gold, +5 each time in the same shop. `fight` or Enter = start the next wave.

| Word | Effect | Cost |
|---|---|---|
| `armor` | +5 max HP (and +5 HP). Max level 8 | 30 + 20 × level |
| `repair` | +10 HP and fully rebuild the wall | 20 |
| `barricade` | Build / upgrade the wall. HP 12 → 20 → 30 → 42 → 56. Iron look from level 3 | 40 + 35 × level |
| `frost` | Enemies 20% slower next wave | 25 |
| `bounty` | 2× gold from kills next wave | 30 |
| `focus` | Start next wave with 20 combo (×1.5) | 20 |

- One-wave buffs (frost, bounty, focus) show under WAVE/LEFT in the HUD and run out when the wave is cleared.
- Later cards (step 5): cannon workers, Keyboard Smash.

- Barricade = ring of stakes around the tower. Enemies stop at the ring and attack it. When its HP hits 0 it breaks and they walk on to the tower. It stays broken until repaired.

## Screen
- Fills the whole browser window. The view is always 180 px tall; its width follows the window shape (320-640 px), so wide screens show more forest instead of black bars. Gameplay stays in the centre 320 px; enemies spawn from the visible edges.

## Pause and settings
- Esc in game opens PAUSE: Resume, Settings, Main Menu (quits the run, no score saved). Esc again resumes. Losing window focus also pauses.
- Backspace drops the current target (Esc no longer does). In the shop, Backspace deletes a letter.
- SETTINGS (from main menu or pause): compact rows, label left and control right. MUSIC / SFX = small volume sliders 0-10 ([-] 10 orange segments [+]; click -, +, or a segment; Left/Right; Enter mutes). FULLSCREEN = ON/OFF pill (click a side, or Left = ON / Right = OFF). Saved in the browser.
- Main menu: castle gets a warm glow and is drawn above the dim; buttons sit below it.
- Music: two looping chiptunes made in code. Menu = calm (Am-F-G-Em, 96 BPM). In game (playing, shop, paused) = battle track (Dm-Bb-C-A, 140 BPM, kick/snare/pumping bass). Game over goes back to the calm track. Audio starts on page load; if the browser blocks autoplay (most do until the first click/tap/key anywhere on the page), the menu shows "CLICK OR PRESS ANY KEY FOR SOUND".

## Main menu, name, leaderboard
- Main menu: TYPEBOUNDS logo (chunky gold pixel letters), PLAY, LEADERBOARD, SETTINGS. Arrows + Enter, mouse click, or press P / L / S.
- PLAY asks for a name first (max 10 letters/digits, remembered for next time). Enter starts, Esc goes back.
- Game over saves name, score and wave to the leaderboard and shows the rank. Enter = play again, Esc = main menu.
- Leaderboard = shared online top 10 (Supabase table `scores`), ONE row per name = that name's best run. The game also merges duplicates when it reads the board; `supabase/one-row-per-name.sql` makes the database itself keep one row per name (unique name + trigger that only raises a row when the new run is better). Uses only the publishable key; row-level security allows read + insert, no edit/delete. DB checks: name 1-10 chars A-Z0-9, score 0-1,000,000, wave 1-999.
- Offline fallback: shows this device's scores; unsent scores are queued and sent on the next refresh.
- Free Supabase projects pause after ~1 week idle — restore from the dashboard if the board shows OFFLINE.

## Later upgrades
- Cannon workers: shoot a random enemy, remove 1 letter
- Keyboard Smash: combo-charged; for ~5 s every key removes that letter from all enemies
- Editable base: out of scope for v1

## Art
- 320×180 internal resolution, integer-scaled with sharp pixels.
- Every sprite, tile, tree and the font are drawn in code (`js/sprites.js`, `js/font.js`). No image files.
- Word labels sit on dark plates and push apart so they never overlap.

## Files
- `js/words.js` word lists
- `js/font.js` 5px-tall pixel font (3 wide; M and W 5 wide, N 4 wide so they are easy to tell apart)
- `js/title.js` TYPEBOUNDS pixel logo
- `js/sprites.js` sprites, castle, background, base position
- `js/audio.js` WebAudio bleeps
- `js/enemies.js` enemy types + behaviour
- `js/waves.js` wave spawning
- `js/barricade.js` wall ring, HP levels, stake drawing
- `js/shop.js` typed shop between waves
- `js/leaderboard.js` local top-10 scores + last player name
- `js/input.js` keyboard
- `js/main.js` game state, update, render

Note: separate files make editing easier. They do not stop copying — the browser downloads every file it runs.

## Build order
1. ✅ Map, base, Runner, Tank, typing + lock-on, HP, game over, basic waves
2. ✅ Gold + shop (Armor, Repair, Barricade) + loading screen
3. Mathematician, Word Color, Ink Color
4. Boss + projectiles
5. Cannons, Keyboard Smash
6. Rainbow Boss, sound polish, title polish
