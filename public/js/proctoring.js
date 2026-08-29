const Proctoring = (() => {
  let currentContext = null; // { contextType, contextId }
  let hiddenAt = null;

  function send(eventType, meta) {
    if (!currentContext) return;
    api.post('/api/activity', {
      contextType: currentContext.contextType,
      contextId: currentContext.contextId,
      eventType,
      meta,
    }).catch(() => {});
  }

  function start(contextType, contextId) {
    currentContext = { contextType, contextId };
  }

  function stop() {
    currentContext = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      send('visibility_hidden');
    } else {
      const awaySeconds = hiddenAt ? Math.round((Date.now() - hiddenAt) / 1000) : null;
      send('visibility_visible', { awaySeconds });
      hiddenAt = null;
    }
  });

  window.addEventListener('blur', () => send('window_blur'));
  window.addEventListener('focus', () => send('window_focus'));
  document.addEventListener('fullscreenchange', () => {
    send(document.fullscreenElement ? 'fullscreen_enter' : 'fullscreen_exit');
  });
  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
      send('paste', { field: target.name || target.id || target.tagName });
    }
  });
  document.addEventListener('copy', () => send('copy'));

  return { start, stop };
})();
