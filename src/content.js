/* Content entry: loads bindings, intercepts keys, runs adapter, shows toast. */
(function () {
  'use strict';

  const store = {
    enabled: true,
    showToast: true,
    bindings: {} // actionId -> combo
  };
  let comboToAction = new Map();
  let toastEl = null;
  let toastTimer = 0;
  let lastCombo = '', lastAt = 0;

  function rebuildIndex() {
    comboToAction = new Map();
    for (const [actionId, combo] of Object.entries(store.bindings || {})) {
      if (!combo) continue;
      const key = combo.toLowerCase();
      if (!comboToAction.has(key)) comboToAction.set(key, actionId);
    }
  }

  async function loadSettings() {
    try {
      const d = globalThis.TVSC.DEFAULT_BINDINGS;
      const s = globalThis.TVSC.DEFAULT_SETTINGS;
      const got = await chrome.storage.sync.get({ enabled: s.enabled, showToast: s.showToast, bindings: d });
      store.enabled = got.enabled !== false;
      store.showToast = got.showToast !== false;
      store.bindings = Object.assign({}, d, got.bindings || {});
      rebuildIndex();
    } catch (_) {
      store.bindings = Object.assign({}, globalThis.TVSC.DEFAULT_BINDINGS);
      rebuildIndex();
    }
  }

  function ensureToast() {
    if (toastEl && document.contains(toastEl)) return toastEl;
    toastEl = document.createElement('div');
    toastEl.id = 'tvsc-toast';
    toastEl.setAttribute('aria-live', 'polite');
    (document.body || document.documentElement).appendChild(toastEl);
    return toastEl;
  }

  function toast(msg, isErr) {
    if (!store.showToast && !isErr) return;
    try {
      const el = ensureToast();
      el.textContent = msg;
      el.classList.toggle('tvsc-show', true);
      el.classList.toggle('tvsc-err', !!isErr);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.toggle('tvsc-show', false), isErr ? 2200 : 900);
    } catch (_) {}
  }

  function onKeydown(e) {
    try {
      if (!store.enabled) return;
      if (e.repeat) return;
      if (e.isTrusted === false) return; // ignore our own synthetic redispatch
      if (window.__tvsc_synthetic) return;
      if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return;

      const combo = globalThis.TVSC.normalizeComboFromEvent(e);
      if (!combo) return;
      if (!globalThis.TVSC_Keys.shouldHandle(e, combo)) return;

      // Dedupe: we listen on both window+document capture; handle once per press
      const now = (e.timeStamp || performance.now());
      if (combo.toLowerCase() === lastCombo && (now - lastAt) < 60) return;
      lastCombo = combo.toLowerCase(); lastAt = now;

      const actionId = comboToAction.get(combo.toLowerCase());
      if (!actionId) return;

      const action = globalThis.TVSC.actionById(actionId);
      if (!action) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      globalThis.TVSC_Adapter.execute(action).then(res => {
        if (res && res.ok) {
          const extra = res.label ? ' · ' + res.label : '';
          toast(action.label + extra, false);
        } else {
          const reason = res && res.reason ? res.reason : 'failed';
          if (reason === 'need-2-favorites') {
            toast('Add 2+ intervals to favorites bar to cycle', true);
          } else {
            toast(action.label + ' — unavailable', true);
          }
          if (window.__tvsc_debug) console.warn('[TVSC] action failed', actionId, res);
        }
      });
    } catch (_) {}
  }

  function attach() {
    window.addEventListener('keydown', onKeydown, true);
    document.addEventListener('keydown', onKeydown, true);
  }

  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      let dirty = false;
      if (changes.enabled) { store.enabled = changes.enabled.newValue !== false; }
      if (changes.showToast) { store.showToast = changes.showToast.newValue !== false; }
      if (changes.bindings) { store.bindings = Object.assign({}, globalThis.TVSC.DEFAULT_BINDINGS, changes.bindings.newValue || {}); dirty = true; }
      if (dirty) rebuildIndex();
    });
  }

  loadSettings().then(attach);
  // Guard for SPA remounts: drop stale toast handle if TradingView replaces DOM
  try {
    const reset = () => { if (toastEl && !document.contains(toastEl)) toastEl = null; };
    const obs = new MutationObserver(reset);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
})();
