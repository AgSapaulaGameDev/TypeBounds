# TypeBounds: UI Design Reference

A reference for anyone (human or AI) designing UI for **TypeBounds**. It describes how the game looks today, the rules the UI follows, and the decisions the owner has already made, so new designs fit in.

- **Live game:** https://typebounds.vercel.app/
- **Genre:** pixel-art typing tower defense. A tower stands in the centre of the map and enemies walk in from every edge, each with a word under it. Typing the word kills that enemy.
- **Platform:** web browser (HTML/JS). A desktop .exe is on hold, so design for the web only.

---

## 1. Canvas and scale

- **The play area is 320 × 180 units.** It is scaled up by a whole number with no smoothing, so all art is crisp pixel art.
- **One unit is one art pixel.** Every coordinate in this document is in these units.
- **Menus are an HTML overlay** (`#ui`) laid over the canvas, using the same 320 × 180 grid.
- **Art is pixel canvases**, drawn in code one pixel per unit. Nothing is a vector or a smooth gradient.
- **Text is live HTML text** set in the **Pixelify Sans** web font, weight 700.
- **The HUD uses a custom 5px bitmap font.** Pixelify Sans becomes hard to read that small (2 looks like 8, C looks like O).
- **Snap everything to the pixel grid.** A half-pixel offset shows up as a 1px misalignment, and the owner notices that.

## 2. Visual language

- **Overall style:** a chunky medieval fantasy kingdom, in the mobile-game tradition of gold-framed, beveled buttons. Bright and warm, not spooky.
- **Dominant materials:** a **gold frame** around a **maroon / crimson inside**, on a near-black brown outline.
- **Every pixel shape has the same layers**, outside to inside:
  1. Drop shadow: `rgba(0,0,0,.55)`, offset 1px down.
  2. Dark outline: `#1e0a06`, `#2a1404` or `#140a04`.
  3. Gold trim: `#e0a640`, with a `#ffe27a` / `#ffd36a` highlight on the top and left edges and a `#a86a14` / `#c98a2a` shade on the bottom and right edges.
  4. Face: three horizontal bands (light top, mid, dark bottom), a 1px highlight line on top and a 1px shade line at the bottom.
  5. Small details such as gold rivets or studs at the corners or on the pointed ends.
- **Corners are pixel steps**, never smooth curves. Buttons cut 1–2px off each corner. Big panels have chunky stair-step notched corners with an inner "echo" step in gold.
- **Text:** light cream (`#fbe9d0`) with a 1px dark drop shadow below. On gold buttons the text is dark brown (`#3a1e06`) with a light highlight shadow.
- **Icons are tiny pixel sprites**, 6–12px. Each sprite uses a main colour, a shade, a highlight and an outline. Icons are gold (`#ffcd4a` / `#d98a1c` / `#fff3b0`, outline `#2a1404`) or cream when they sit on crimson.

### Colour tokens

**Gold:**

| Role | Hex |
|---|---|
| Trim | `#e0a640` |
| Highlight | `#ffe27a`, `#ffd36a`, `#fff3b0` |
| Shade | `#c98a2a`, `#a86a14` |

**Outlines:** `#1e0a06`, `#2a1404`, `#140a04`.

**Maroon panel insides:**

| Role | Hex |
|---|---|
| Fill | `#2a0f16` |
| Top band | `#36141e` |
| Inner edge | `#3a1408` |

**Settings rows (inside panels):**

| Role | Hex |
|---|---|
| Row fills | `#4a1a26`, `#3a1420` |
| Row dark edges | `#200a10`, `#140508` |
| Slider track | `#120408`, `#3a1420`, `#4a1a28` |

**Ribbon:**

| Role | Hex |
|---|---|
| Face | `#9c2b3f` |
| Top band | `#b8394c` |
| Bottom band | `#7a2032` |
| Ends | `#6a1b2b` |
| Folds | `#2a0810` |

**Text:**

| Role | Hex |
|---|---|
| Cream | `#fbe9d0` |
| Ribbon title | `#fff4dc` |
| Dark text shadow | `#2a0a10` |
| Selected or hover label | `#ffe066` |

**Selected outline:** `#fff1b0`. When a button is selected, its dark outline turns bright cream.

### Button themes

Each theme lists its outline, border, highlight, the three face bands from top to bottom, and its text colour.

| Theme | Use | Outline | Border | Highlight | Face bands | Text |
|---|---|---|---|---|---|---|
| **gold** | Main actions (PLAY, START, LOG IN) | `#2a1404` | `#a8640c` | `#fff3a0` | `#ffe066` `#fbcd3a` `#eaa82a` | `#3a1e06` |
| **crimson** | Secondary actions, the X close button | `#1e0a06` | `#e0a640` | `#c4495c` | `#a93248` `#8e2639` `#721c2e` | `#fbe9d0` |
| **green** | Confirm or positive actions | `#0e2210` | `#e0a640` | `#8fe486` | `#62c75c` `#45a842` `#348a34` | `#fbfff0` |
| **brown** | Neutral | `#1a0e04` | `#e0a640` | `#a88040` | `#8e6428` `#7a5420` `#5e3e16` | `#ffe9b0` |
| **wine** | Inactive toggle state (muted) | `#140508` | `#6a2434` | `#52202c` | `#42161f` `#38121a` `#2e0e15` | `#cdbca6` |

The navy theme is retired. Don't use it.

## 3. Components

### Standard button
- **Layers:** outline, gold border, face with three bands, a 1px top highlight, a 1px bottom shade and four gold rivets inside the corners. The drop shadow takes up the bottom row.
- **Label and icon:** the label is centred and the icon sits to its left with a 4px gap. Font size is 8–9px.
- **States:**
  - Hover or keyboard select: the outline turns `#fff1b0` and the button lifts 1px.
  - Press: the button moves down 1px.
- **Main menu exception:** selection there shows as animated gold chevrons (‹ ›) beside the button instead of the bright outline.
- **Sound:** every button plays a hover sound.

### X close button (replaces every BACK button)
- **Size and theme:** 19 × 18, crimson, with an 8px cream X sprite drawn as a pixel pattern.
- **The X must be exactly centred** in the face, with equal space on each side. Its face is 15 × 13 and the X sits at (5, 4).
- **Position:** the top-right corner of a panel, slightly overlapping the frame.
- **Closing a screen:** settings, the account/login screen and the leaderboard close **only with the X**. Esc doesn't close them, because the owner decided Esc and the X conflicted. Enter still closes the leaderboard.

### Account pill (main menu, bottom-left)
- **Position:** (3, 160), 58 × 17.
- **Shape:** octagon-pointed ends, gold trim, maroon face with bands, and gold studs on both pointed ends.
- **Contents:** a pixel key icon on the left and the label "LOG IN".
- **When logged in:** it shows a crown icon and the player's name, and grows wider to fit the name.

### Notched panel (all screens)
- **Frame:** a big frame with stair-notched corners, a gold border with a light top/left edge and an inner gold echo step on each corner.
- **Inside:** dark maroon (`#2a0f16`).
- **Game over:** uses a charcoal version (`#1c1a22`) instead of maroon.
- **Every screen uses this one panel style.**

### Ribbon title
- **Shape:** a crimson banner with gold edges, notched tail ends and darker folds, centred above a panel and overlapping its top edge.
- **Title:** in caps, 11px, cream with a dark shadow, optionally with a small gold icon on each side.

### Settings row
- **Shape:** a maroon inset bar inside the panel, 24 units apart.
- **Contents:** an icon and label on the left, the control on the right.
- **Controls:**
  - **Sliders** (music, SFX): `[-] [10 segments] [+]`. Each segment is 6px wide with a 1px gap.
  - **Toggles** (fullscreen): the active state uses the gold theme and the inactive state uses wine.

### Pennants
- Two hanging crimson banners at the top of the main menu, at x = 14 and x = 280, each 26 × 66. Each has a gold top bar, a V-cut tail and a gold crown.

## 4. Screen layouts (units, 320 × 180)

| Screen | Panel (x, y, w, h) | Contents |
|---|---|---|
| **Main menu** | none | Logo at (67, 4), 186 × 75. Button column at x 104, starting at y 113, each 112 × 15, 17 apart: CONTINUE*, PLAY / NEW GAME, LEADERBOARD, SETTINGS. Account pill at the bottom-left. Pennants at the top corners. |
| **Settings** | (39, 40, 245, 104) | Ribbon "SETTINGS" at (82, 23, 159, 28). Rows at y = 59 + i·24 for MUSIC, SFX and FULLSCREEN. X at (272, 31). |
| **Account / login** | (58, 30, 204, 100) | Note at the top. NAME field at y 55 and PASSWORD field at y 74. Buttons LOG IN at (72, 103) and SIGN UP at (164, 103), each 84 × 18. X at (251, 22). When logged in, a single LOG OUT button at (118, 103). A hint line under the panel. **There's no BACK button on this screen; the owner asked for that.** |
| **Name entry** | (panel) | START button (gold, with a play icon) at (120, 112), 80 × 20. X at (253, 38). |
| **Leaderboard** | full-height panel | Score rows. X at (256, 3). There are no crown badges next to account names; the owner asked for them to be removed. |
| **Game over** | (62, 27, 198, 110), charcoal | Score summary and buttons. Hover state only. |
| **New-game confirm** | (panel) | START NEW at (86, 101) and KEEP SAVE at (162, 101), each 72 × 20. Esc cancels. |

\* CONTINUE only shows when there's a save; PLAY then becomes NEW GAME.

## 5. Design decisions the owner has made (follow these)

1. **All screens look like the account screen:** a maroon notched panel, gold trim and a crimson ribbon title.
2. **No BACK buttons.** Every screen closes with an X close button in the top-right corner. A corner-arrow idea was rejected in favour of the X.
3. **Esc doesn't close settings, account or the leaderboard.** Only the X closes them.
4. **Pixel-perfect centring matters.** Icons inside buttons must have equal space on every side.
5. **Leaderboard names have no crown badge.**
6. **The logo is about 93% of its original size,** at 186 × 75. It was made smaller, then a little bigger again.
7. **The login button is a compact pill** in the bottom-left, not a full-width bar.
8. **Settings rows are evenly spaced vertically** inside the panel, with room above and below.
9. **Every button has a hover sound.**
10. **The theme is bright and warm,** a fantasy kingdom. Avoid horror or spooky looks.

## 6. Constraints for new designs

- **Stay on the 320 × 180 grid with whole-pixel coordinates,** and give exact unit sizes and positions.
- **Use only the colour tokens and button themes above.** Add a new theme only if it's really needed, and define all its colours the same way.
- **Readable text sizes:** 8px minimum in menus, 11px for ribbon titles. The HUD uses the 5px bitmap font.
- **Design for mouse, touch and keyboard.** Menus use arrow keys and Enter, and the mouse sets the selection.
- **Icons must be pixel sprites** that can be drawn as small character grids (`#` = main, `+` = shade, `*` = highlight, `.` = empty, outline added automatically).
- **Send a mockup for approval first.** The owner prefers to see a proposed design before it's built.

## 7. Open UX items and ideas

- **Keyboard-only players can't leave the account screen,** because Esc no longer closes it. Possible fix: let Tab or the arrow keys reach the X.
- **Features still to come,** which will need UI:
  - Late-game difficulty changes.
  - A boss that fires projectiles.
  - Cannon workers.
  - A "Keyboard Smash" mode.

## 8. Gameplay context (for HUD and in-game UI)

- Typing the first letter of a word locks onto that enemy. A typo resets the combo.
- Backspace or Esc in-game drops the lock.
- **Score** = word length × 10 × combo multiplier. The multiplier rises by 0.25 per 10 combo, up to ×3.
- A wave with no typos earns a PERFECT bonus.
- **Wave themes repeat every 15 waves:**

  | Waves | Theme | Enemies | Boss |
  |---|---|---|---|
  | 1–5 | Maths | Calculators, Chalkboards, maths imps | Mathematician |
  | 6–10 | Colour | colour slimes, eyedropper slimes | Rainbow Slime |
  | 11–15 | Animals | Rabbits, Tortoises, Chameleons | Golden Goose |

- **In-game UI elements:** a tower HP bar, gold, score, combo, wave banners (for example "BOSS WAVE 5"), a boss HP bar at the bottom of the screen, and red countdown bars.
