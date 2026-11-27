// Optional player accounts: username + password through Supabase Auth.
// Guests never need this. Supabase logs in with an email, so the username is turned into a
// hidden address (gelo -> gelo@typebounds.vercel.app); players only ever see the username.
// The password goes straight to Supabase over HTTPS and is never stored by the game.
// Only the publishable key lives here. Never put a secret key in this file.
(function () {
  const TD = (window.TD = window.TD || {});

  const BASE = 'https://jkveiazgyacnocvctkig.supabase.co';
  const KEY = 'sb_publishable_U671HnqTCfxlTTFhMi35vw_i7RyQ_t2';
  const DOMAIN = '@typebounds.vercel.app';
  const SESSION_KEY = 'td_session';
  const NAME_RE = /^[A-Z0-9]{1,10}$/;
  const PW_MIN = 6;

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  // a short, player-facing reason for anything that went wrong
  class AccountError extends Error { constructor(msg, status) { super(msg); this.status = status || 0; } }

  let session = ls.get(SESSION_KEY);
  if (!session || typeof session.at !== 'string' || typeof session.id !== 'string' || !NAME_RE.test(session.name || '')) session = null;

  function keep(j, name) {
    session = { at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, id: j.user.id, name };
    ls.set(SESSION_KEY, session);
  }
  function forget() { session = null; ls.del(SESSION_KEY); }

  async function authCall(path, body, bearer) {
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    let res;
    try { res = await withTimeout(fetch(BASE + '/auth/v1/' + path, { method: 'POST', headers, body: JSON.stringify(body || {}) }), 10000); }
    catch (e) { throw new AccountError('NO CONNECTION - TRY AGAIN'); }
    let j = {};
    try { j = await res.json(); } catch (e) {}
    if (!res.ok) throw new AccountError(String(j.msg || j.error_description || j.message || j.error || 'HTTP ' + res.status), res.status);
    return j;
  }

  // a fresh access token (refreshed a minute before it runs out). Only a rejected refresh logs you out,
  // a dropped connection keeps the session for later.
  async function token() {
    if (!session) return null;
    if (Date.now() < session.exp - 60000) return session.at;
    try {
      const j = await authCall('token?grant_type=refresh_token', { refresh_token: session.rt });
      keep(j, session.name);
    } catch (e) {
      if (e.status >= 400 && e.status < 500) forget();
      throw e;
    }
    return session ? session.at : null;
  }

  // database call (REST). Logged in: sent as that player, so the database knows who you are.
  async function rest(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ apikey: KEY }, opts.headers || {});
    if (opts.body != null) headers['Content-Type'] = 'application/json';
    const t = opts.anon ? null : await token().catch(() => null);
    if (t) headers.Authorization = 'Bearer ' + t;
    const res = await withTimeout(fetch(BASE + '/rest/v1/' + path, { method: opts.method || 'GET', headers, body: opts.body }), 8000);
    return res;
  }

  const cleanName = (n) => String(n || '').trim().toUpperCase();
  const emailOf = (n) => n.toLowerCase() + DOMAIN;

  TD.Account = {
    NAME_RE, PW_MIN, AccountError,
    get user() { return session ? { id: session.id, name: session.name } : null; },
    token, rest,

    // true = an account owns this name, false = free, null = couldn't check (offline / not set up yet)
    async nameTaken(name) {
      name = cleanName(name);
      if (session && session.name === name) return false;
      try {
        const res = await rest('profiles?select=id&name=eq.' + encodeURIComponent(name), { anon: true });
        if (!res.ok) return null;
        return (await res.json()).length > 0;
      } catch (e) { return null; }
    },

    async signUp(name, password) {
      name = cleanName(name);
      if (!NAME_RE.test(name)) throw new AccountError('NAME: 1-10 LETTERS OR NUMBERS');
      if (String(password).length < PW_MIN) throw new AccountError('PASSWORD: AT LEAST ' + PW_MIN + ' CHARACTERS');
      if (await this.nameTaken(name)) throw new AccountError('NAME TAKEN - PICK ANOTHER');
      let j;
      try { j = await authCall('signup', { email: emailOf(name), password, data: { name } }); }
      catch (e) {
        if (/registered|exists/i.test(e.message)) throw new AccountError('NAME TAKEN - PICK ANOTHER');
        if (/password/i.test(e.message)) throw new AccountError('PASSWORD TOO WEAK - TRY A LONGER ONE');
        if (/database error/i.test(e.message)) throw new AccountError('NAME TAKEN - PICK ANOTHER');
        throw e.status ? new AccountError('SIGN UP FAILED - TRY AGAIN LATER', e.status) : e;
      }
      if (!j.access_token) throw new AccountError('SIGN UP NEEDS "CONFIRM EMAIL" OFF IN SUPABASE');
      keep(j, name);
      return this.user;
    },

    async logIn(name, password) {
      name = cleanName(name);
      if (!NAME_RE.test(name) || !password) throw new AccountError('TYPE YOUR NAME AND PASSWORD');
      let j;
      try { j = await authCall('token?grant_type=password', { email: emailOf(name), password }); }
      catch (e) {
        if (e.status === 400) throw new AccountError('WRONG NAME OR PASSWORD');
        throw e.status ? new AccountError('LOG IN FAILED - TRY AGAIN LATER', e.status) : e;
      }
      const meta = (j.user && j.user.user_metadata && j.user.user_metadata.name) || name;
      keep(j, cleanName(meta));
      return this.user;
    },

    async logOut() {
      const t = session && session.at;
      forget();
      if (t) authCall('logout', {}, t).catch(() => {}); // best effort: this device forgets the session either way
    },

    // ---- cloud save (one row per account; the database only lets you touch your own) ----
    async getSave() {
      if (!session) return null;
      const res = await rest('saves?select=data,updated_at&user_id=eq.' + session.id);
      if (!res.ok) throw new AccountError('HTTP ' + res.status, res.status);
      const rows = await res.json();
      return rows.length ? rows[0].data : null;
    },
    async putSave(data) {
      if (!session) return;
      const res = await rest('saves?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: session.id, data, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new AccountError('HTTP ' + res.status, res.status);
    },
    async deleteSave() {
      if (!session) return;
      const res = await rest('saves?user_id=eq.' + session.id, { method: 'DELETE' });
      if (!res.ok) throw new AccountError('HTTP ' + res.status, res.status);
    },
  };
})();
