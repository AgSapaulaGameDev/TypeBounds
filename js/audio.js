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

  // ---- Music: 4-bar loop (Am - F - G - Em), 16 steps per bar ----
  const BPM = 96, STEP = 60 / BPM / 4, STEPS = 64;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const BARS = [
    { root: 45, chord: [57, 60, 64] }, // Am
    { root: 41, chord: [53, 57, 60] }, // F
    { root: 43, chord: [55, 59, 62] }, // G
    { root: 40, chord: [52, 55, 59] }, // Em
  ];
  // [step, midi note, length in steps]
  const MELODY = [
    [0, 76, 4], [4, 72, 2], [6, 74, 2], [8, 72, 4], [12, 69, 4],
    [16, 77, 4], [20, 76, 2], [22, 74, 2], [24, 72, 8],
    [32, 74, 4], [36, 71, 2], [38, 72, 2], [40, 74, 4], [44, 79, 4],
    [48, 76, 6], [54, 74, 2], [56, 71, 4], [60, 67, 4],
  ];
  const ARP = [0, 1, 2, 1];

  let musicTimer = null, nextT = 0, step = 0;

  function playStep(s, t) {
    const bar = BARS[Math.floor(s / 16)], inBar = s % 16;
    if (inBar === 0 || inBar === 3 || inBar === 8 || inBar === 11) voice(musicBus, midi(bar.root), t, STEP * 2.5, 'triangle', 0.55);
    if (inBar % 2 === 0) voice(musicBus, midi(bar.chord[ARP[(inBar / 2) % 4]] + 12), t, STEP * 0.9, 'square', 0.09);
    if (inBar % 4 === 2) noiseHit(musicBus, t, 0.04, 0.12, 'highpass', 6000);
    for (const [ms, note, len] of MELODY) if (ms === s) voice(musicBus, midi(note), t, STEP * len * 0.95, 'triangle', 0.32);
  }

  function schedule() {
    while (nextT < ac.currentTime + 0.15) {
      playStep(step, nextT);
      nextT += STEP;
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

  TD.Audio = {
    unlock() {
      ensure();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();
      startMusic();
    },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    setSfx(on) {
      sfxOn = on; write('td_sfx', on);
      if (sfxBus) sfxBus.gain.value = on ? SFX_VOL : 0;
    },
    setMusic(on) {
      musicOn = on; write('td_music', on);
      if (musicBus) musicBus.gain.value = on ? MUSIC_VOL : 0;
      if (on) startMusic(); else stopMusic();
    },

    lock() { tone(880, 0.04, 'square', 0.15); },
    type(p) { tone(520 + Math.min(p, 12) * 35, 0.05, 'square', 0.2); },
    typo() { tone(110, 0.16, 'sawtooth', 0.35, -40); },
    cancel() { tone(300, 0.08, 'triangle', 0.25, -120); },
    kill() { noise(0.18, 0.45); tone(660, 0.12, 'square', 0.25, -400); },
    wood() { tone(160, 0.1, 'square', 0.3, -60); noise(0.06, 0.25); },
    hit() { tone(90, 0.22, 'triangle', 0.6, -40); noise(0.1, 0.3); },
    wave() { [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.22, 0, i * 0.1)); },
    clear() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.22, 0, i * 0.09)); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.4, 0, i * 0.2)); },
  };
})();
