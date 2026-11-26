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

## Upgrades (step 2+)
Gold from kills. Shop between waves.
- Armor: max HP + repair
- Barricade: ring around the tower; enemies must break it first
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
- `js/input.js` keyboard
- `js/main.js` game state, update, render

Note: separate files make editing easier. They do not stop copying — the browser downloads every file it runs.

## Build order
1. ✅ Map, base, Runner, Tank, typing + lock-on, HP, game over, basic waves
2. Gold + shop (Armor, Barricade)
3. Mathematician, Word Color, Ink Color
4. Boss + projectiles
5. Cannons, Keyboard Smash
6. Rainbow Boss, sound polish, title polish
