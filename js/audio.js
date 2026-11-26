// Retro bleeps generated with WebAudio. No audio files.
(function () {
  const TD = (window.TD = window.TD || {});
  let ac = null, master = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('td_muted') === '1'; } catch (e) {}

  const VOL = 0.22;

  function ensure() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : VOL;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return ac;
  }

  function tone(freq, dur, type, vol, slide, delay) {
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, delay) {
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = noiseBuf;
    f.type = 'lowpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  TD.Audio = {
    unlock() { ensure(); if (ac && ac.state === 'suspended') ac.resume(); },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : VOL;
      try { localStorage.setItem('td_muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    get muted() { return muted; },
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
