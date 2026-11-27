// Tip cards shown before a wave that brings new enemies (first time in a run only).
// Each line is a plain string (light grey) or a list of [text, colour] pieces.
(function () {
  const TD = (window.TD = window.TD || {});
  const GOLD = '#ffcd75', RED = '#e83b3b', WHITE = '#f4f4f4', DIM = '#94b0c2';

  // sprite(): the first frame to draw on the card
  const S = () => TD.Sprites;
  TD.Tips = {
    1: { title: 'NEW ENEMIES', enemies: [
      { name: 'CALCULATOR', tag: 'FAST', sprite: () => S().calc[0], lines: [
        'RUNS STRAIGHT AT YOUR TOWER. WEAK BUT QUICK.',
        'SHORT NUMBER WORDS SPELLED OUT.',
        [['EXAMPLE: ', DIM], ['FOUR  ZERO  NINE', WHITE]],
      ] },
      { name: 'CHALKBOARD', tag: 'TANK', sprite: () => S().board[0], lines: [
        'SLOW BUT HITS HARD: 3 DAMAGE. KILL IT EARLY.',
        'LONG NUMBER WORDS SPELLED OUT.',
        [['EXAMPLE: ', DIM], ['SEVENTEEN  THOUSAND', WHITE]],
      ] },
    ], foot: 'TYPE A FIRST LETTER TO LOCK ON / BACKSPACE TO LET GO' },

    3: { title: 'NEW ENEMY', enemies: [
      { name: 'MATHS IMP', tag: 'SUMS', sprite: () => S().minion[0], lines: [
        'CARRIES A SUM INSTEAD OF A WORD.',
        'SOLVE IT AND TYPE THE ANSWER IN DIGITS.',
        [['EXAMPLE: ', DIM], ['7+5=__', WHITE], ['  TYPE ', DIM], ['12', GOLD]],
        'SLOW - BUT THEY ADD UP IF YOU IGNORE THEM.',
      ] },
    ], foot: 'CHALKBOARDS STILL COME WITH THEM' },

    5: { title: 'BOSS', enemies: [
      { name: 'THE MATHEMATICIAN', sprite: () => S().math[0], lines: [
        'SUMMONS MATHS IMPS. HIS WORD IS ??? MEANWHILE.',
        'KILL EVERY IMP: HIS WORD SHOWS FOR 5 SECONDS.',
        'TYPE IT TO TAKE A LIFE. THEN HE SUMMONS AGAIN.',
        [['LAST LIFE: ', RED], ['HE CHARGES. TYPE A 10-DIGIT NUMBER!', WHITE]],
      ] },
    ], foot: 'NO OTHER ENEMIES ON BOSS WAVES' },

    6: { title: 'NEW ENEMIES', enemies: [
      { name: 'COLOUR SLIME', tag: 'TRICK', sprite: () => TD.Sprites.slime('#e83b3b')[0], lines: [
        'ITS WORD IS A COLOUR IN A DIFFERENT INK.',
        'TYPE THE WORD. IGNORE THE COLOUR YOU SEE.',
        [['EXAMPLE: ', DIM], ['BLUE', '#e83b3b'], ['  TYPE ', DIM], ['BLUE', GOLD]],
      ] },
      { name: 'TANK SLIME', tag: 'TANK', sprite: () => TD.Sprites.medSlime('#a884f3')[0], lines: [
        'BIG AND SLOW. HITS HARD: 3 DAMAGE.',
        'LONG COLOUR WORD - SAME RULE: TYPE THE WORD.',
        [['EXAMPLE: ', DIM], ['TURQUOISE', '#a884f3'], ['  TYPE ', DIM], ['TURQUOISE', GOLD]],
      ] },
    ] },

    8: { title: 'NEW ENEMY', enemies: [
      { name: 'EYEDROPPER SLIME', tag: 'INK!', dropper: true, sprite: () => TD.Sprites.slime('#5ac54f')[0], lines: [
        'HAS AN EYEDROPPER ICON AND A GOLD RING.',
        [['RULE FLIPS: ', RED], ['TYPE THE INK - NOT THE WORD.', WHITE]],
        [['EXAMPLE: ', DIM], ['PURPLE', '#5ac54f'], ['  TYPE ', DIM], ['GREEN', GOLD]],
        'INKS: RED BLUE GREEN PURPLE PINK ORANGE',
      ] },
    ], foot: 'TANK SLIMES STILL USE THE WORD' },

    10: { title: 'BOSS', enemies: [
      { name: 'THE RAINBOW SLIME', sprite: () => TD.Sprites.bigSlime('#4d9be6')[0], lines: [
        'SUMMONS SLIMES. EYEDROPPER ONES: TYPE THE INK.',
        'KILL THEM ALL: ITS LONG COLOUR WORD SHOWS.',
        [['ONE TYPO ', RED], ['= NEW COLOUR AND A NEW WORD.', WHITE]],
        [['LAST LIFE: ', RED], ['SPLITS INTO 4 SLIMES: REDORANGE...', WHITE]],
      ] },
    ], foot: 'TAKE YOUR TIME ON ITS WORD - ACCURACY WINS' },
  };
})();
