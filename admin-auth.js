// Shared admin sign-in helper for 559eats admin pages.
// Talks to /api/admin. No passwords or secret keys live in the browser.
(function () {
  const TOKEN = '559eats-admin-token';
  const INFO = '559eats-admin-info';

  async function call(payload, withToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (withToken) headers.Authorization = 'Bearer ' + (sessionStorage.getItem(TOKEN) || '');
    return fetch('/api/admin', { method: 'POST', headers, body: JSON.stringify(payload) });
  }

  window.Admin = {
    isSignedIn() { return !!sessionStorage.getItem(TOKEN); },
    info() {
      try { return JSON.parse(sessionStorage.getItem(INFO)); } catch { return null; }
    },
    async list() {
      const r = await call({ action: 'admins' });
      return r.ok ? r.json() : [];
    },
    // name is optional: pages with a single password box just send the password
    async login(password, name) {
      const r = await call({ action: 'login', password, name });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Sign in failed');
      sessionStorage.setItem(TOKEN, j.token);
      sessionStorage.setItem(INFO, JSON.stringify(j.admin));
      return j.admin;
    },
    async check() {
      if (!this.isSignedIn()) return false;
      const r = await call({ action: 'whoami' }, true);
      if (!r.ok) { this.logout(); return false; }
      return true;
    },
    logout() {
      sessionStorage.removeItem(TOKEN);
      sessionStorage.removeItem(INFO);
    },
    // Drop-in for fetch(`${SUPABASE_URL}/rest/v1/<table>`, { method, body }) on admin pages.
    // Returns the real Response, so res.ok / res.text() / res.json() keep working.
    fetch(path, opts = {}) {
      return call({
        action: 'db', path, method: opts.method || 'GET',
        data: opts.body ? JSON.parse(opts.body) : null,
      }, true);
    },
    // Same shape as the old api(path, method, body) helpers: returns parsed JSON or null
    async api(path, method = 'GET', data = null) {
      const r = await call({ action: 'db', path, method, data }, true);
      if (r.status === 401) {
        this.logout();
        alert('Your admin session expired. Please sign in again.');
        location.reload();
        return null;
      }
      const text = await r.text();
      if (!r.ok) console.error('Admin API error', r.status, text);
      return text ? JSON.parse(text) : null;
    },
  };
})();
