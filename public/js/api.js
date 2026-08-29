const api = {
  async _req(method, url, body) {
    const resp = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await resp.json(); } catch (e) { /* no body */ }
    if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    return data;
  },
  get(url) { return this._req('GET', url); },
  post(url, body) { return this._req('POST', url, body || {}); },
};
