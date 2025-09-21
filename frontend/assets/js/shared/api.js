// api.js - Helper para chamadas à API com JWT

(function () {
  const STORAGE_KEYS = {
    token: 'pizzaria_token',
    user: 'pizzaria_user',
  };

  const API_BASE = '/api'; // mesmo domínio do frontend

  function getToken() {
    try { return localStorage.getItem(STORAGE_KEYS.token) || null; } catch { return null; }
  }

  function setToken(token) {
    try { localStorage.setItem(STORAGE_KEYS.token, token || ''); } catch {}
  }

  function clearToken() {
    try {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
    } catch {}
  }

  function saveUser(user) {
    try { localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user || null)); } catch {}
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || 'null'); } catch { return null; }
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const isJson = (resp.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await resp.json().catch(() => ({})) : await resp.text();
    if (!resp.ok) {
      const message = (isJson && data && (data.error || data.message)) || `Erro ${resp.status}`;
      const err = new Error(message);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.API = {
    apiFetch,
    getToken,
    setToken,
    clearToken,
    saveUser,
    getUser,
    isAuthenticated: () => !!getToken(),
  };
})();
