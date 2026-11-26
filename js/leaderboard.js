// Leaderboard saved in this browser (localStorage). Top 10 by score.
(function () {
  const TD = (window.TD = window.TD || {});
  const KEY = 'td_scores', NAME_KEY = 'td_name', MAX = 10;

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }

  TD.Leaderboard = {
    list() { return load(); },
    top() { return load()[0] || null; },

    // Returns { rank, id }: rank is 1-10, or 0 when the score did not make the board.
    add(name, score, wave) {
      const id = Date.now() + '-' + Math.floor(Math.random() * 1e6);
      const list = load();
      list.push({ id, name, score, wave });
      list.sort((a, b) => b.score - a.score || b.wave - a.wave);
      const kept = list.slice(0, MAX);
      save(kept);
      const idx = kept.findIndex((e) => e.id === id);
      return { rank: idx + 1, id };
    },

    lastName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } },
    setName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} },
  };
})();
