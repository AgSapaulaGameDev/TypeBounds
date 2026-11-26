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
    'maroon', 'emerald', 'amber', 'sapphire', 'burgundy', 'tangerine', 'periwinkle', 'chocolate', 'olive', 'navy', 'fuchsia', 'golden'];
  TD.Inks = {
    red: '#e83b3b', blue: '#4d9be6', green: '#5ac54f', purple: '#a884f3', pink: '#f68dbe',
    white: '#f4f4f4', cyan: '#73eff7', brown: '#b8794a', gray: '#9babb2',
  };
})();
