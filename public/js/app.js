const App = {
  user: null,

  setUser(user) {
    this.user = user;
    this.renderNav();
  },

  renderNav() {
    const nav = document.getElementById('navbar');
    if (!this.user) {
      nav.innerHTML = `
        <div class="brand">AI Research LMS</div>
        <div class="links"><a href="#/login">Log in</a></div>
      `;
      return;
    }
    nav.innerHTML = `
      <div class="brand">AI Research LMS <span class="badge">${this.user.role}</span></div>
      <div class="links">
        <span class="muted">${this.user.name}</span>
        <a href="#/${this.user.role === 'admin' ? 'admin' : 'dashboard'}">Dashboard</a>
        <button class="linklike" id="logoutBtn">Log out</button>
      </div>
    `;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api.post('/api/auth/logout');
      this.user = null;
      location.hash = '#/login';
      this.renderNav();
    });
  },

  async boot() {
    try {
      const { user } = await api.get('/api/auth/me');
      this.setUser(user);
    } catch (e) {
      this.user = null;
      this.renderNav();
    }
    this.route();
  },

  route() {
    const root = document.getElementById('app');
    let hash = location.hash.replace(/^#\//, '') || (this.user ? (this.user.role === 'admin' ? 'admin' : 'dashboard') : 'login');
    const parts = hash.split('/');
    const viewName = parts[0] === 'admin' && parts[1] ? `admin/${parts[1]}` : parts[0];
    const params = parts[0] === 'admin' ? parts.slice(2) : parts.slice(1);

    const publicViews = new Set(['login', 'register', 'register-admin']);
    if (!this.user && !publicViews.has(viewName)) {
      location.hash = '#/login';
      return;
    }
    if (this.user && viewName.startsWith('admin') && this.user.role !== 'admin') {
      root.innerHTML = '<div class="card error">Admins only.</div>';
      return;
    }

    const view = Views[viewName];
    if (!view) {
      root.innerHTML = '<div class="card">Not found.</div>';
      return;
    }
    Promise.resolve(view(root, params)).catch((err) => {
      root.innerHTML = `<div class="card error">${err.message}</div>`;
    });
  },
};

window.addEventListener('hashchange', () => App.route());
window.addEventListener('DOMContentLoaded', () => App.boot());
