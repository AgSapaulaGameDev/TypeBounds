// Keyboard input. Letters/digits go to the game; Enter starts/resumes; Backspace/Esc drops target.
(function () {
  const TD = (window.TD = window.TD || {});

  TD.Input = {
    attach(h) {
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        TD.Audio.unlock();
        const k = e.key;
        if (k === 'Enter') { e.preventDefault(); h.onEnter(); return; }
        if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); h.onCancel(k); return; }
        if (k === ' ') { e.preventDefault(); return; }
        if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); h.onNav(k === 'ArrowUp' ? -1 : 1); return; }
        if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); h.onAdjust(k === 'ArrowLeft' ? -1 : 1); return; }
        if (k.length === 1) {
          const ch = k.toLowerCase();
          if (/^[a-z0-9]$/.test(ch)) {
            e.preventDefault();
            if (!e.repeat) h.onChar(ch); // holding a key does not spam typos
          }
        }
      });
      window.addEventListener('blur', () => h.onBlur());

      // Mouse / touch in menus: convert page coords to the 320x180 game coords.
      const canvas = document.getElementById('game');
      const toGame = (ev) => {
        const r = canvas.getBoundingClientRect();
        return [((ev.clientX - r.left) / r.width) * canvas.width, ((ev.clientY - r.top) / r.height) * canvas.height];
      };
      canvas.addEventListener('pointerdown', (ev) => { const [x, y] = toGame(ev); h.onClick(x, y); });
      canvas.addEventListener('pointermove', (ev) => { const [x, y] = toGame(ev); h.onHover(x, y); });
    },
  };
})();
