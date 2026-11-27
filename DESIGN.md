# TypeBounds — Design

Pixel-art typing tower defense. Protect the tower in the center. Enemies walk in from every edge with words under them. Type a word to kill its enemy.

## How to run
Double-click `index.html`. No build step, no server. Scripts are classic `<script>` tags (not ES modules) so `file://` works.

**Temporary debug panel:** add `?debug` to the URL (e.g. `index.html?debug`). A box at the bottom left jumps to any wave and gives +500 gold. Those runs never post to the leaderboard. Remove `js/debug.js` when done testing.

## Core rules
- Typing the first letter of a word locks that enemy. Further keys go to the locked enemy.
- **Typo:** combo resets to 0. The lock stays. No enemy takes damage until the correct next letter is typed.
- Backspace / Esc drops the lock and resets that word's progress.
- Enemies that reach the tower stop and attack it on a timer. Tower HP 0 = game over.
- Score per kill = word length × 10 × combo multiplier (+0.25 per 10 combo, max ×3).
- A wave with zero typos gives a PERFECT bonus (50 × wave).

## Enemies
### Wave themes (repeat every 10 waves, faster each loop)
| Waves | Theme | Enemies |
|---|---|---|
| 1-2 | Maths | **Calculator** (fast, 3-4 letter number words: ONE, FOUR, ZERO) + **Chalkboard** tank (long number words: SEVENTEEN, THOUSAND) |
| 3-4 | Maths | Chalkboard tank + **maths imps** (the Mathematician's minions: `7+5=__`, type the answer). Banner: "MATHS IMPS: TYPE THE ANSWER!" |
| 5 | Maths | Mathematician boss |
| 6-7 | Colour | Word Color slime + **tank colour slime** (medium slime, slower, long colour word like CRIMSON in a different ink) |
| 8-9 | Colour | tank colour slime + **eyedropper slime** (type its ink colour). Easier mix: ~40% fewer enemies (13 instead of 22 on wave 8), spawns 1.4x further apart, eyedropper slimes at 75% speed |
| 10 | Colour | Rainbow Slime boss |

Runner and Tank below are **archived** (code and sprites kept, not spawned) for later use.

| Enemy | Word | Status |
|---|---|---|
| Runner | 3 letters, fast | Built (step 1) |
| Tank | 7–12 letters, slow, hits hard | Built (step 1) |
| Mathematician (BOSS) | Boss waves 5, 15, 25... See below | Built (step 3) |
| Word Color | slime in a random ink; its word is a colour name drawn in a DIFFERENT colour — type the word. Joins normal waves with runners and tanks | ✅ Wave 6+ (15% → 30% of spawns) |
| Ink Color | type the ink color; must look clearly different from Word Color | Wave TBD (not 9) — step 3 |
| Boss | long phrase, fires 1-letter projectiles | Every 5th wave — step 4 |
| Rainbow Slime (BOSS) | long colour words; summons Word Color slimes. See below | ✅ Waves 10, 20, 30... |

### Mathematician (boss)
- Word bank (`mathTerms`, 22, 7-10 letters): algebra, calculus, theorem, variable, equation, integer, fraction, decimal, geometry, polygon, diameter, tangent, parabola, symmetry, magnitude, logarithm, algorithm, numerical, hypotenuse, polynomial, derivative, irrational.
- Word length rule: tank and boss words are 6-10 letters (no 5-letter words on tanks, nothing over 10).
- Boss waves: 5, 15, 25, ... (10, 20, 30 are the Rainbow Slime). Banner "BOSS WAVE n". No runners or tanks in boss waves. Boss HP bar (5) at the bottom of the screen.
- Enters from the left or right edge, then roams around a wide oval around the tower (left side, over the top or bottom, right side and back), so it visits both sides. Never walks to the tower until its last life.
- Summons **3 minions on its 1st and 2nd life (HP 5 and 4), 5 minions on its 3rd and 4th (HP 3 and 2)**. Minions always appear at the far left and far right edges of the field (split between both sides, ~34 px apart, each a step further out), not next to the boss, so they arrive one after another. They walk to the tower and attack it. Each shows a sum like `7+5=__` or `14-6=_`; type the answer (digits). Answers start with different digits so lock-on is clear.
- While any of its minions are alive, its word is hidden (`???`) and it cannot be targeted.
- When all its minions are dead its long word shows, with a 5 s red countdown bar. Type the word = -1 HP and it summons again. If the countdown runs out it summons again anyway.
- At 1 HP it **charges the tower** and its word becomes a 10-digit number. Reaching the tower it hits for 4.
- Rewards: 5 gold per hit, 25 gold + 500 score on kill. Minions give 1 gold.

### Rainbow Slime (boss)
- Waves 10, 20, 30, ... Big crowned slime, 5 HP (boss HP bar). Enters and roams the same oval as the Mathematician.
- Summons **Word Color slimes** (slower than normal ones, 60% speed): 3 on lives 5 and 4, 4 on lives 3 and 2. Same far-left / far-right spawn spots.
- **Eyedropper slimes (Ink rule)**: the first slime of every summon and ~35% of the rest are marked: a small **eyedropper icon** (gold bulb, white tube, colour-cycling drip) at the start of the label, a gold border around the label, and a pulsing gold ring on the ground under the slime. For those you type the **ink colour**, not the word ("GREEN" written in red = type RED). Inks for these are only red, blue, green, purple, pink, orange (no white: it looks like plain text). Once you start typing one, its label shows your letters + blanks. Wave banner says "EYEDROPPER = TYPE THE INK COLOUR!".
- While they live its word is hidden and its body shimmers through the rainbow. When they're dead it holds one colour and shows a **long colour word** (crimson, turquoise, aquamarine, periwinkle, ...) with the 5 s countdown.
- **Any typo on its word**: it changes to a new colour and a new word, and you start over.
- **Last life**: it bursts into **4 medium slimes** (2 far left, 2 far right), slower than normal slimes (speed 9 vs 15). Their words are tertiary colours typed as one word: REDORANGE, YELLOWORANGE, YELLOWGREEN, BLUEGREEN, BLUEVIOLET, REDVIOLET. Each is drawn in a different tertiary ink; killing one re-inks the others. Kill all 4 = BOSS DEFEATED (500 score, 25 gold).
- Words that start the same (BLUEGREEN / BLUEVIOLET): if your next letter fits another enemy's word better, the lock moves to that one (no typo). Works for every enemy.

## UI style (js/overlay.js + css/ui.css)
- Main menu, settings, pause and game over are an HTML overlay in the Pixelify Sans font, laid out in play units (320 x 180) and scaled onto the canvas play area. The canvas still draws the world, castle glow and dim behind them; the in-game HUD stays canvas.
- Keyboard stays with the game (arrows + Enter move game.sel); the mouse sets game.sel and calls game.activate, so both share one selection.
- Art is real pixel art: small canvases drawn 1 pixel per play unit (stair-step corners, banded fills, outlined sprite icons) and scaled up unsmoothed; only the text is the web font.
- Ornate panels: dark fill, gold border, gold corner brackets. Titles sit on a crimson ribbon with folded tails and icons.
- Buttons: chamfered, gold (main action), crimson (secondary), green (resume), brown (restart), with icons (play, restart, gear, home, back arrow).
- Main menu: hanging crimson pennants with crowns, gold TYPEBOUNDS title, "PROTECT THE TOWER", castle glow, PLAY (gold) / LEADERBOARD / SETTINGS, chevrons beside the selected button.
- Settings: icon rows; gold slider track with a knob (click or drag); ON / OFF toggle.
- Pause: maroon panel, big gold icons pinned left: RESUME / RESTART (new run) / SETTINGS / MAIN MENU.
- Leaderboard: maroon panel, gold LEADERBOARD title with red shadow, # NAME WAVE SCORE under a red line, #1 and your own name in gold, online status + back hint.
- Game over: 6 stat rows with icons (score, wave, words, gold earned, accuracy, best score), rank note, PLAY AGAIN / MAIN MENU (live after 0.8 s).

## Tip cards
- Before a wave that brings new enemies (waves 1, 3, 5, 6, 8, 10), the game shows a tip card: each new enemy's sprite at 2x, name, tag, rules and a coloured example (e.g. PURPLE in green ink -> type GREEN). Text lives in `js/tips.js`.
- Shown once per run (not again on the second loop or after a No Spamming restart). Enter starts the wave.

## No Spamming
- **6 wrong keys within 1.5 s** during a fight = keyboard smash. Correct letters never count, so a fast typist who slips once or twice is safe.
- The game freezes and shows a **NO SPAMMING!** window ("KEYBOARD SMASH DETECTED / WAVE n STARTS OVER").
- After 1.5 s, **Enter** restarts the wave: HP, gold, score, armour, barricade and shop buffs go back to exactly what they were when the wave began. Banner says "NO SPAMMING THIS TIME!".

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

- One-wave buffs (frost) show under WAVE/LEFT in the HUD and run out when the wave is cleared.
- Later cards (step 5): cannon workers, Keyboard Smash.

- Barricade = fence around the tower: posts joined by plank rails (2 rails at L1, 3 at L2; iron fence with gold bands from L3, gold spikes at L5). Sections fall apart as HP drops (fallen planks, broken stumps). Enemies stop at the ring and attack it. When its HP hits 0 it breaks and they walk on to the tower. It stays broken until repaired.

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
- `js/barricade.js` fence ring, HP levels, post + rail drawing
- `js/shop.js` typed shop between waves
- `js/leaderboard.js` local top-10 scores + last player name
- `js/input.js` keyboard
- `js/tips.js` tip cards before waves with new enemies
- `js/overlay.js` + `css/ui.css` HTML menu screens (main, settings, pause, game over)
- `js/main.js` game state, update, render

Note: separate files make editing easier. They do not stop copying — the browser downloads every file it runs.

## Build order
1. ✅ Map, base, Runner, Tank, typing + lock-on, HP, game over, basic waves
2. ✅ Gold + shop (Armor, Repair, Barricade) + loading screen
3. ✅ Mathematician, ✅ Word Color, Ink Color
4. Boss + projectiles
5. Cannons, Keyboard Smash
6. ✅ Rainbow Slime, sound polish, title polish
