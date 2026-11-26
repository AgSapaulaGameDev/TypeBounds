// Leaderboard: shared online board (Supabase) with a local fallback.
// The publishable key is meant to be public. Supabase row-level security only lets
// players READ scores and ADD new ones; nobody can edit or delete. Never put a secret key here.
(function () {
  const TD = (window.TD = window.TD || {});

  const SUPABASE_URL = 'https://jkveiazgyacnocvctkig.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_U671HnqTCfxlTTFhMi35vw_i7RyQ_t2';
  const API = SUPABASE_URL + '/rest/v1/scores';
  const HEADERS = { apikey: SUPABASE_KEY };
  const TOP = 10;

  const LOCAL_KEY = 'td_scores', QUEUE_KEY = 'td_score_queue', NAME_KEY = 'td_name';

  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const byScore = (a, b) => b.score - a.score || b.wave - a.wave;

  // One row per player name: keep only each name's best run.
  function bestPerName(list) {
    const seen = new Set(), out = [];
    for (const e of list.slice().sort(byScore)) {
      if (seen.has(e.name)) continue;
      seen.add(e.name);
      out.push(e);
    }
    return out;
  }

  function saveLocal(entry) {
    const list = ls.get(LOCAL_KEY, []);
    if (!Array.isArray(list)) return;
    list.push(entry);
    ls.set(LOCAL_KEY, bestPerName(list).slice(0, TOP));
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  }

  async function fetchTop() {
    // Fetch extra rows so older duplicate rows (from before the database kept one row per
    // name) can't push real players out of the top 10.
    const url = API + '?select=name,score,wave&order=score.desc,wave.desc&limit=200';
    const res = await withTimeout(fetch(url, { headers: HEADERS }), 8000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return bestPerName(await res.json()).slice(0, TOP);
  }

  async function postScore(e) {
    const res = await withTimeout(fetch(API, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, HEADERS),
      body: JSON.stringify({ name: e.name, score: e.score, wave: e.wave }),
    }), 8000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
  }

  // Scores that failed to send (offline) are kept and retried on the next refresh.
  async function flushQueue() {
    const q = ls.get(QUEUE_KEY, []);
    if (!Array.isArray(q) || !q.length) return;
    const left = [];
    for (const e of q) { try { await postScore(e); } catch (err) { left.push(e); } }
    ls.set(QUEUE_KEY, left);
  }

  TD.Leaderboard = {
    status: 'idle',   // idle | loading | online | offline
    entries: [],      // what the board shows
    mine: null,       // { name, score } of this session's last run, for highlighting
    improved: true,   // did the last run beat that name's best on the board?
    bestScore: 0,     // that name's best score on the board after the last run

    list() { return this.entries; },
    top() { return this.entries[0] || null; },

    async refresh() {
      if (this.status === 'loading') return;
      this.status = 'loading';
      try {
        await flushQueue();
        this.entries = await fetchTop();
        this.status = 'online';
      } catch (err) {
        this.entries = ls.get(LOCAL_KEY, []);
        this.status = 'offline';
      }
    },

    // Save a finished run. The board keeps one row per name (their best run).
    // Resolves to that name's rank (1-10), or 0 if the name is not in the top 10.
    async submit(name, score, wave) {
      const entry = { name, score, wave };
      this.mine = { name, score };
      saveLocal(entry);
      try {
        await flushQueue();
        await postScore(entry);
      } catch (err) {
        const q = ls.get(QUEUE_KEY, []);
        ls.set(QUEUE_KEY, (Array.isArray(q) ? q : []).concat([entry]));
      }
      this.status = 'idle';
      await this.refresh();
      const i = this.entries.findIndex((e) => e.name === name);
      const best = i >= 0 ? this.entries[i].score : score;
      this.bestScore = Math.max(best, score);
      this.improved = score >= best;
      return i + 1;
    },

    isMine(e) { return !!this.mine && e.name === this.mine.name; },

    lastName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } },
    setName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} },
  };

  TD.Leaderboard.refresh();
})();
