(function () {
  const paperSelectors = ['#paper', '.dialogue-strip', '#responseArea', '#choiceArea', '.paper-tools', '.physical-tools', '#notebookCloseup', '#ledgerOverlay'];
  let snapshot = null;
  let state = 'closed';
  const root = document.documentElement;
  const body = document.body;
  const windowEl = () => document.getElementById('petersburgWindow');

  function setInert(hidden) {
    for (const selector of paperSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      if (hidden) {
        element.setAttribute('aria-hidden', 'true');
        element.inert = true;
      } else {
        element.removeAttribute('aria-hidden');
        element.inert = false;
      }
    }
  }

  function change(open) {
    const desired = open ? 'open' : 'closed';
    if (state === desired || state === (open ? 'opening' : 'closing')) return;
    state = open ? 'opening' : 'closing';
    if (open) {
      snapshot = { scrollTop: document.querySelector('#paperColumns')?.scrollTop || 0, className: body.className, main20: window.__main20?.getWindowSnapshot?.() || null };
      window.__main20?.setWindowView?.(true);
      body.dataset.windowView = 'open';
      body.classList.add('window-view');
      setInert(true);
    } else {
      body.dataset.windowView = 'closed';
      body.classList.remove('window-view');
      setInert(false);
    }
    window.dispatchEvent(new CustomEvent('window-view-change', { detail: { state: desired, open } }));
    window.dispatchEvent(new CustomEvent('window-focus', { detail: { source: 'window-controller', open } }));
    window.setTimeout(() => {
      state = desired;
      if (!open && snapshot) {
        const columns = document.querySelector('#paperColumns');
        if (columns) columns.scrollTop = snapshot.scrollTop;
        if (snapshot.main20) window.__main20?.restoreWindowSnapshot?.(snapshot.main20);
      }
      window.dispatchEvent(new CustomEvent('window-view-settled', { detail: { state } }));
    }, 220);
  }

  function openWindow() { change(true); }
  function closeWindow() { change(false); }
  function toggleWindow() { if (state === 'open' || state === 'opening') closeWindow(); else openWindow(); }

  window.__windowController = { openWindow, closeWindow, toggleWindow, getState: () => state };
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && (state === 'open' || state === 'opening')) { event.preventDefault(); closeWindow(); } });
  window.addEventListener('DOMContentLoaded', () => {
    const element = windowEl();
    if (!element) return;
    element.addEventListener('click', (event) => { event.preventDefault(); toggleWindow(); });
    element.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleWindow(); } });
  });
})();
