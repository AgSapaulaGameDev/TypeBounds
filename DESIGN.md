# Typing Defense — Design

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
- Shop opens after every wave. **Buy by typing the item's word.** A typo clears the typed word. Backspace deletes one letter, Esc clears. Enter (or typing `fight`) starts the next wave.

| Word | Effect | Cost |
|---|---|---|
| `armor` | +5 max HP (and +5 HP). Max level 8 | 30 + 20 × level |
| `repair` | +10 HP and fully rebuild the wall | 20 |
| `barricade` | Build / upgrade the wall. HP 12 → 20 → 30 → 42 → 56. Iron look from level 3 | 40 + 35 × level |
| `fight` | Start next wave | free |

- Barricade = ring of stakes around the tower. Enemies stop at the ring and attack it. When its HP hits 0 it breaks and they walk on to the tower. It stays broken until repaired.

## Main menu, name, leaderboard
- Main menu: PLAY and LEADERBOARD. Arrows + Enter, mouse click, or press P / L.
- PLAY asks for a name first (max 10 letters/digits, remembered for next time). Enter starts, Esc goes back.
- Game over saves name, score and wave to the leaderboard and shows the rank. Enter = play again, Esc = main menu.
- Leaderboard = shared online top 10 (Supabase table `scores`). Uses only the publishable key; row-level security allows read + insert, no edit/delete. DB checks: name 1-10 chars A-Z0-9, score 0-1,000,000, wave 1-999.
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
- `js/font.js` 3×5 pixel font
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
