// Sound effects + a small looping chiptune, all generated with WebAudio. No audio files.
// SFX and music have separate on/off settings (saved in localStorage).
(function () {
  const TD = (window.TD = window.TD || {});
  let ac = null, sfxBus = null, musicBus = null, noiseBuf = null;

  const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
  let sfxOn = read('td_sfx', true);
  let musicOn = read('td_music', true);

  const SFX_VOL = 0.22, MUSIC_VOL = 0.11;

  function ensure() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    sfxBus = ac.createGain();
    sfxBus.gain.value = sfxOn ? SFX_VOL : 0;
    sfxBus.connect(ac.destination);
    musicBus = ac.createGain();
    musicBus.gain.value = musicOn ? MUSIC_VOL : 0;
    musicBus.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return ac;
  }

  function voice(dest, freq, t, dur, type, vol, slide) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseHit(dest, t, dur, vol, filterType, freq) {
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = noiseBuf;
    f.type = filterType || 'lowpass'; f.frequency.value = freq || 1800;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ---- SFX ----
  function tone(freq, dur, type, vol, slide, delay) {
    if (!ac || !sfxOn) return;
    voice(sfxBus, freq, ac.currentTime + (delay || 0), dur, type, vol || 0.3, slide);
  }
  function noise(dur, vol, delay) {
    if (!ac || !sfxOn) return;
    noiseHit(sfxBus, ac.currentTime + (delay || 0), dur, vol || 0.3);
  }

  // ---- Music: two 4-bar loops, 16 steps per bar ----
  // menu   = calm (Am - F - G - Em, 96 BPM)
  // battle = driving (Dm - Bb - C - A, 140 BPM) with kick, snare and a pumping bass
  const STEPS = 64;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ARP = [0, 1, 2, 1];

  const TRACKS = {
    menu: {
      bpm: 96,
      bars: [
        { root: 45, chord: [57, 60, 64] }, // Am
        { root: 41, chord: [53, 57, 60] }, // F
        { root: 43, chord: [55, 59, 62] }, // G
        { root: 40, chord: [52, 55, 59] }, // Em
      ],
      // [step, midi note, length in steps]
      melody: [
        [0, 76, 4], [4, 72, 2], [6, 74, 2], [8, 72, 4], [12, 69, 4],
        [16, 77, 4], [20, 76, 2], [22, 74, 2], [24, 72, 8],
        [32, 74, 4], [36, 71, 2], [38, 72, 2], [40, 74, 4], [44, 79, 4],
        [48, 76, 6], [54, 74, 2], [56, 71, 4], [60, 67, 4],
      ],
      play(s, t, st, bar, inBar) {
        if (inBar === 0 || inBar === 3 || inBar === 8 || inBar === 11) voice(musicBus, midi(bar.root), t, st * 2.5, 'triangle', 0.55);
        if (inBar % 2 === 0) voice(musicBus, midi(bar.chord[ARP[(inBar / 2) % 4]] + 12), t, st * 0.9, 'square', 0.09);
        if (inBar % 4 === 2) noiseHit(musicBus, t, 0.04, 0.12, 'highpass', 6000);
      },
    },
    battle: {
      bpm: 140,
      bars: [
        { root: 38, chord: [62, 65, 69] }, // Dm
        { root: 34, chord: [58, 62, 65] }, // Bb
        { root: 36, chord: [60, 64, 67] }, // C
        { root: 33, chord: [57, 61, 64] }, // A
      ],
      melody: [
        [0, 74, 2], [2, 74, 1], [3, 77, 2], [6, 76, 2], [8, 74, 2], [10, 72, 2], [12, 69, 4],
        [16, 70, 2], [18, 70, 1], [19, 74, 2], [22, 72, 2], [24, 70, 2], [26, 69, 2], [28, 65, 4],
        [32, 72, 2], [34, 72, 1], [35, 76, 2], [38, 74, 2], [40, 72, 2], [42, 70, 2], [44, 67, 4],
        [48, 69, 3], [51, 73, 3], [54, 76, 2], [56, 81, 4], [60, 79, 2], [62, 76, 2],
      ],
      play(s, t, st, bar, inBar) {
        // pumping bass: root on every 8th, octave up on the off-8ths
        if (inBar % 2 === 0) voice(musicBus, midi(bar.root + (inBar % 4 === 2 ? 12 : 0)), t, st * 1.6, 'square', 0.22);
        // fast arpeggio on 16ths
        voice(musicBus, midi(bar.chord[ARP[inBar % 4]] + 12), t, st * 0.7, 'square', 0.05);
        // kick on the beat, snare on 2 and 4, hats on the off-beats
        if (inBar % 4 === 0) voice(musicBus, 150, t, 0.12, 'sine', 0.9, -110);
        if (inBar === 4 || inBar === 12) noiseHit(musicBus, t, 0.12, 0.35, 'bandpass', 1800);
        if (inBar % 2 === 1) noiseHit(musicBus, t, 0.03, 0.1, 'highpass', 7000);
      },
    },
  };

  let musicTimer = null, nextT = 0, step = 0, track = TRACKS.menu;

  function playStep(s, t) {
    const st = 60 / track.bpm / 4;
    const bar = track.bars[Math.floor(s / 16)], inBar = s % 16;
    track.play(s, t, st, bar, inBar);
    for (const [ms, note, len] of track.melody) if (ms === s) voice(musicBus, midi(note), t, st * len * 0.95, 'triangle', 0.32);
  }

  function schedule() {
    while (nextT < ac.currentTime + 0.15) {
      playStep(step, nextT);
      nextT += 60 / track.bpm / 4;
      step = (step + 1) % STEPS;
    }
  }

  function startMusic() {
    if (!ac || !musicOn || musicTimer) return;
    nextT = ac.currentTime + 0.05;
    step = 0;
    musicTimer = setInterval(schedule, 30);
  }
  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  // Browsers only let sound start after the player's first click/tap/key on the page.
  // We create the audio and queue the music right away (it starts instantly if the browser
  // allows autoplay), and listen on the whole page for the first gesture to unmute it.
  const GESTURES = ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'keydown', 'click'];
  function onGesture() {
    TD.Audio.unlock();
    if (ac && ac.state === 'running') GESTURES.forEach((g) => window.removeEventListener(g, onGesture, true));
  }
  GESTURES.forEach((g) => window.addEventListener(g, onGesture, true));

  TD.Audio = {
    unlock() {
      ensure();
      if (!ac) return;
      if (ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
      startMusic();
    },
    // 'menu' or 'battle'. Switching restarts the loop from bar 1 of the new song.
    setTrack(name) {
      const next = TRACKS[name];
      if (!next || next === track) return;
      track = next;
      step = 0;
      if (ac) nextT = ac.currentTime + 0.05;
    },
    get track() { return track === TRACKS.battle ? 'battle' : 'menu'; },
    // true until the browser lets sound play (no click/key yet)
    get blocked() { return !ac || ac.state !== 'running'; },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    setSfx(on) {
      sfxOn = on; write('td_sfx', on);
      if (sfxBus) sfxBus.gain.value = on ? SFX_VOL : 0;
    },
    setMusic(on) {
      musicOn = on; write('td_music', on);
      if (musicBus) { musicBus.gain.cancelScheduledValues(0); musicBus.gain.value = on ? MUSIC_VOL : 0; }
      if (on) startMusic(); else stopMusic();
    },

    hover() { tone(1320, 0.03, 'square', 0.08); tone(1760, 0.03, 'square', 0.06, 0, 0.025); },
    lock() { tone(880, 0.04, 'square', 0.15); },
    type(p) { tone(520 + Math.min(p, 12) * 35, 0.05, 'square', 0.2); },
    typo() { tone(110, 0.16, 'sawtooth', 0.35, -40); },
    cancel() { tone(300, 0.08, 'triangle', 0.25, -120); },
    kill() { noise(0.18, 0.45); tone(660, 0.12, 'square', 0.25, -400); },
    wood() { tone(160, 0.1, 'square', 0.3, -60); noise(0.06, 0.25); },
    hit() { tone(90, 0.22, 'triangle', 0.6, -40); noise(0.1, 0.3); },
    wave() { [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.22, 0, i * 0.1)); },
    clear() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.22, 0, i * 0.09)); },
    // Tower falls: big thud + crumbling rubble, then a slow sad fall of notes and a low final chord.
    // The music fades out under it and comes back (calm menu song) a few seconds later.
    over() {
      if (!ac || !sfxOn) return;
      const t = ac.currentTime;
      if (musicOn && musicBus) {
        const g = musicBus.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.0001, t + 0.15);
        g.setValueAtTime(0.0001, t + 3.2);
        g.linearRampToValueAtTime(MUSIC_VOL, t + 4.5);
      }
      voice(sfxBus, 110, t, 0.5, 'sine', 0.9, -80);                 // thud
      noiseHit(sfxBus, t, 0.9, 0.55, 'lowpass', 500);               // rumble
      for (let i = 0; i < 6; i++) noiseHit(sfxBus, t + 0.12 + i * 0.11, 0.08, 0.25, 'lowpass', 1400 - i * 150); // falling stones
      [[587, 0.55], [523, 0.85], [466, 1.15], [440, 1.45]].forEach(([f, d]) => {
        voice(sfxBus, f, t + d, 0.32, 'square', 0.14);
        voice(sfxBus, f / 2, t + d, 0.32, 'triangle', 0.3);
      });
      [147, 175, 220].forEach((f) => voice(sfxBus, f, t + 1.8, 1.4, 'triangle', 0.28)); // D minor, held
      voice(sfxBus, 294, t + 1.8, 1.4, 'square', 0.06, -12);        // slightly sagging top note
    },  };

  // Try to start straight away on page load.
  TD.Audio.unlock();
})();
