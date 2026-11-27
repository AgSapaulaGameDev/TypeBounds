// Word lists. Runner = short (3 letters). Tank = long (7-12 letters).
(function () {
  const TD = (window.TD = window.TD || {});

  TD.Words = {
    short: (
      'cat dog run axe bat bow cup elf fog gem hex ice jam key log map nut oak owl pig ' +
      'rat sun tar urn van web yak zap ash bog cry den dig ear eel fin fly fox gum hat ' +
      'hog ink jet kit lid mud nap net orb ore paw pen pod ray rib rod rug saw sly sod ' +
      'spy tag tip toe tub vex vow wax wig yam yew zip arc bud cob dew dot quo'
    ).split(' '),

    long: (
      'monster lantern villain thunder fortress dungeon skeleton warlock gargoyle catapult ' +
      'crossbow werewolf goblins pumpkin graveyard twilight midnight sorcerer phantom blizzard ' +
      'hurricane avalanche nightmare cathedral labyrinth vengeance champion guardian treasure ' +
      'mountain wanderer scorpion mercenary trebuchet barricade lightning harvester ironclad ' +
      'juggernaut behemoth colossal stalwart obsidian quicksand rampart sentinel tempest ' +
      'undertow vanguard whirlwind zeppelin keyboard alphabet kingdom shoulder brimstone ' +
      'dragonfly executioner necromancer battlements thunderstorm candlelight scarecrow'
    ).split(' '),
    // Word Color enemy: you type the colour WORD (it is drawn in a different ink colour)
    colors: ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'white', 'brown', 'cyan', 'gray'],
  };

  // Ink colours (bright enough to read on the dark label plates). Yellow and orange are words
  // only, never inks, so the gold "already typed" letters stay easy to tell apart.
  // Rainbow Slime boss words: long colour names
  TD.Words.longColors = ['crimson', 'scarlet', 'magenta', 'lavender', 'turquoise', 'aquamarine', 'violet', 'indigo',
    'maroon', 'emerald', 'sapphire', 'burgundy', 'tangerine', 'periwinkle', 'chocolate', 'fuchsia', 'golden'];
  // inks used for "type the ink" slimes: only colours nobody argues about
  TD.ClearInks = ['red', 'blue', 'green', 'purple', 'pink', 'orange']; // no white: it looks like plain label text
// Rainbow Slime's last life: medium slimes named after tertiary colours (type them as one word)
  TD.Words.tertiary = ['redorange', 'yelloworange', 'yellowgreen', 'bluegreen', 'blueviolet', 'redviolet'];
  TD.TertiaryInks = {
    redorange: '#ff5a24', yelloworange: '#ffb12a', yellowgreen: '#9fd33b',
    bluegreen: '#1fa59a', blueviolet: '#7a4ee8', redviolet: '#d0307e',
  };
  TD.inkHex = (name) => TD.Inks[name] || TD.TertiaryInks[name];
// Math theme: fast Calculators get 3-4 letter number words, Chalkboard tanks get long ones
  TD.Words.numShort = ['one', 'two', 'six', 'ten', 'four', 'five', 'nine', 'zero'];
  TD.Words.numLong = ['eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
    'nineteen', 'twenty', 'thirty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million'];
// Mathematician boss: long maths terms
  TD.Words.mathTerms = ['algebra', 'calculus', 'theorem', 'variable', 'equation', 'integer', 'fraction', 'decimal',
    'geometry', 'polygon', 'diameter', 'tangent', 'parabola', 'symmetry', 'magnitude', 'logarithm', 'algorithm',
    'numerical', 'hypotenuse', 'polynomial', 'derivative', 'irrational'];
// Animal theme (waves 11-14): Rabbit = short animals, Tortoise = long, Chameleon = medium
  TD.Words.animalShort = ['cat', 'dog', 'owl', 'fox', 'bee', 'pig', 'emu', 'yak', 'cow', 'ant', 'bat', 'elk', 'hen',
    'ram', 'eel', 'ape', 'gnu', 'boa', 'mole', 'frog', 'crab', 'duck', 'goat', 'lion', 'seal', 'swan', 'toad', 'wolf',
    'deer', 'hawk', 'mouse', 'tiger'];
  TD.Words.animalLong = ['crocodile', 'kangaroo', 'flamingo', 'porcupine', 'alligator', 'armadillo', 'hedgehog',
    'elephant', 'antelope', 'platypus', 'wolverine', 'butterfly', 'scorpion', 'squirrel', 'reindeer', 'mosquito',
    'caterpillar', 'grasshopper', 'jellyfish', 'orangutan', 'salamander', 'woodpecker', 'hummingbird', 'dragonfly'];
  TD.Words.animalMed = ['panther', 'gecko', 'hamster', 'monkey', 'iguana', 'lizard', 'donkey', 'jaguar', 'walrus',
    'badger', 'beaver', 'falcon', 'otter', 'weasel', 'ferret', 'turtle', 'toucan', 'lobster', 'koala', 'zebra',
    'camel', 'llama', 'raccoon', 'buffalo', 'pelican', 'vulture'];
// Golden Goose (wave 15): white eggs (and the chicks that hatch) get short farm words,
// golden eggs get gold words
  TD.Words.eggWords = ['egg', 'hen', 'nest', 'corn', 'seed', 'hay', 'barn', 'coop', 'peck', 'yolk', 'farm', 'wing',
    'beak', 'chirp', 'quack', 'honk', 'mud', 'pond', 'grain', 'straw', 'down', 'tail', 'oats'];
  TD.Words.goldWords = ['golden', 'nugget', 'jewel', 'crown', 'riches', 'honey', 'amber', 'coins', 'shiny', 'treasure',
    'fortune', 'bullion', 'sparkle', 'glitter', 'wealth', 'ingot'];
  TD.Inks = {
    red: '#e83b3b', blue: '#4d9be6', green: '#5ac54f', purple: '#a884f3', pink: '#f68dbe',
    white: '#f4f4f4', cyan: '#73eff7', brown: '#b8794a', gray: '#9babb2', orange: '#f77622',
  };
})();
