// Save / CONTINUE. The run is saved at the start of every wave (the same snapshot "No Spamming"
// uses), so CONTINUE puts you at the start of the wave you were on.
// Guests: saved in this browser only. Accounts: saved online too, so it works on any device.
// Game over deletes the save. Debug runs never save. A save that doesn't match this version of
// the game (or is broken) is ignored, never loaded.
(function () {
  const TD = (window.TD = window.TD || {});
  const VERSION = 1;
  const GUEST_KEY = 'td_save_guest', ACCT_KEY = 'td_save_acct';

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const num = (v) => typeof v === 'number' && isFinite(v);

  // only a save written by this version, with sane numbers, is ever loaded
  function valid(d) {
    if (!d || typeof d !== 'object' || d.v !== VERSION) return false;
    if (!Number.isInteger(d.wave) || d.wave < 1 || d.wave > 999) return false;
    if (typeof d.name !== 'string' || !/^[A-Z0-9]{1,10}$/.test(d.name)) return false;
    const s = d.s;
    if (!s || typeof s !== 'object') return false;
    for (const k of ['hp', 'maxHp', 'gold', 'goldEarned', 'score', 'armorLv', 'kills', 'correct', 'typos', 'bestCombo']) if (!num(s[k]) || s[k] < 0) return false;
    if (s.hp <= 0 || s.hp > s.maxHp) return false;
    const w = s.wall;
    if (!w || !num(w.level) || !num(w.max) || !num(w.hp)) return false;
    if (s.buffs != null && typeof s.buffs !== 'object') return false;
    return true;
  }

  const user = () => (TD.Account && TD.Account.user) || null;

  // the save for whoever is playing now (account cache must belong to that account)
  function current() {
    const u = user();
    if (u) {
      const d = ls.get(ACCT_KEY);
      return valid(d) && d.uid === u.id ? d : null;
    }
    const d = ls.get(GUEST_KEY);
    return valid(d) ? d : null;
  }

  TD.Save = {
    VERSION, valid,
    current,
    has() { return !!current(); },
    syncing: false,

    // called at the start of every (non-debug) wave
    write(g) {
      const u = user();
      const d = {
        v: VERSION, t: Date.now(), wave: g.waves.wave, name: u ? u.name : g.playerName,
        s: JSON.parse(JSON.stringify(g.waveStart)), tipsSeen: Object.assign({}, g.tipsSeen),
      };
      if (!valid(d)) return;
      if (u) {
        d.uid = u.id;
        ls.set(ACCT_KEY, d);
        const { uid, ...data } = d;
        TD.Account.putSave(data).catch(() => { // offline: mark it, the next sync pushes it up
          const c = ls.get(ACCT_KEY);
          if (c && c.t === d.t) ls.set(ACCT_KEY, Object.assign(c, { pending: true }));
        });
      } else ls.set(GUEST_KEY, d);
    },

    clear() {
      if (user()) {
        ls.del(ACCT_KEY);
        TD.Account.deleteSave().catch(() => {});
      } else ls.del(GUEST_KEY);
    },

    // account: the online save is the real one when we can reach it.
    // If there is none online but you just played as a guest, that guest run moves to your account.
    async sync(adoptGuest) {
      const u = user();
      if (!u) return;
      this.syncing = true;
      try {
        let cloud = await TD.Account.getSave();
        if (cloud && !valid(cloud)) cloud = null;
        const cache = ls.get(ACCT_KEY), mine = valid(cache) && cache.uid === u.id ? cache : null;
        if (!cloud && adoptGuest) {
          const guest = ls.get(GUEST_KEY);
          if (valid(guest)) {
            cloud = Object.assign({}, guest, { name: u.name, t: Date.now() });
            delete cloud.uid;
            await TD.Account.putSave(cloud);
            ls.del(GUEST_KEY);
          }
        }
        if (mine && mine.pending && (!cloud || mine.t > cloud.t)) {
          // this device saved while offline and is newer: push it up
          const { uid, pending, ...data } = mine;
          await TD.Account.putSave(data);
          ls.set(ACCT_KEY, Object.assign({}, data, { uid: u.id }));
        } else if (cloud) ls.set(ACCT_KEY, Object.assign({}, cloud, { uid: u.id, name: u.name }));
        else ls.del(ACCT_KEY); // finished (game over) or deleted on another device
      } catch (e) {
        // offline / not set up yet: keep using this device's copy
      } finally { this.syncing = false; }
    },

    // logging out: forget this account's copy on this device (it stays online)
    forgetAccount() { ls.del(ACCT_KEY); },
  };

  // logged in from an earlier visit: fetch the online save (CONTINUE shows once it arrives)
  if (TD.Account && TD.Account.user) TD.Save.sync(false);
})();
