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
        if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); h.onCancel(); return; }
        if (k === ' ') { e.preventDefault(); return; }
        if (k.length === 1) {
          const ch = k.toLowerCase();
          if (/^[a-z0-9]$/.test(ch)) {
            e.preventDefault();
            if (!e.repeat) h.onChar(ch); // holding a key does not spam typos
          }
        }
      });
      window.addEventListener('blur', () => h.onBlur());
    },
  };
})();
