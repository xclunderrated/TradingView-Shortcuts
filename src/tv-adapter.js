/* TradingView DOM automation. No chrome.* APIs here — pure DOM. Exposes globalThis.TVSC_Adapter */
(function () {
  'use strict';

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) {
      // menu items can be tiny but still valid; check style instead
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    if (el.closest('[hidden]')) return false;
    return true;
  }

  function getAccessibleText(el) {
    if (!el) return '';
    const parts = [
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('data-tooltip'),
      el.getAttribute && el.getAttribute('title'),
      el.getAttribute && el.getAttribute('data-name'),
      el.getAttribute && el.getAttribute('data-value'),
      el.textContent
    ].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').replace(/Click to learn more/gi, '').trim().slice(0, 220);
  }

  function realClick(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    const opts = { bubbles: true, cancelable: true, composed: true, view: window, buttons: 1, button: 0 };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    } catch (_) { /* PointerEvent may not exist — fall through to .click() */ }
    try { el.click(); } catch (_) {}
    try { el.focus({ preventScroll: true }); } catch (_) {}
    return true;
  }

  function allClickables(root) {
    const doc = root || document;
    try {
      return Array.from(doc.querySelectorAll(
        'button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="option"], [data-name], a[href]'
      ));
    } catch (_) { return []; }
  }

  function matchScore(text, keywords) {
    const t = (text || '').toLowerCase();
    let best = 0;
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      if (!k) continue;
      if (t === k) return 100;
      if (t.startsWith(k)) best = Math.max(best, 70);
      else if (t.includes(k)) best = Math.max(best, 50);
    }
    return best;
  }

  function findByKeywords(keywords, scope) {
    if (!keywords || !keywords.length) return null;
    const cands = allClickables(scope).filter(isVisible);
    let best = null, bestScore = 0;
    for (const el of cands) {
      const s = matchScore(getAccessibleText(el), keywords);
      if (s > bestScore) { bestScore = s; best = el; if (s >= 100) break; }
    }
    return bestScore > 0 ? best : null;
  }

  function dispatchNative(native) {
    if (!native) return false;
    const target = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : document.body || document.documentElement;
    const init = {
      bubbles: true, cancelable: true, composed: true,
      key: native.key || '', code: native.code || '',
      altKey: !!native.alt, ctrlKey: !!native.ctrl, shiftKey: !!native.shift, metaKey: !!native.meta,
      location: 0, repeat: false, isComposing: false
    };
    try {
      window.__tvsc_synthetic = true;
      target.dispatchEvent(new KeyboardEvent('keydown', init));
      // keypress for printable
      if ((native.key || '').length === 1) {
        try { target.dispatchEvent(new KeyboardEvent('keypress', init)); } catch (_) {}
      }
      target.dispatchEvent(new KeyboardEvent('keyup', init));
      return true;
    } catch (_) { return false; }
    finally { setTimeout(() => { window.__tvsc_synthetic = false; }, 0); }
  }

  function escapeMenu() {
    try {
      (document.activeElement || document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    } catch (_) {}
  }

  // ---------- Interval (timeframe) ----------
  function intervalButtonSelectors() {
    return [
      '#header-toolbar-intervals',
      'button#header-toolbar-intervals',
      '[data-name="time-interval"]',
      'button[aria-label*="time interval" i]',
      'button[title*="time interval" i]',
      'button[data-tooltip*="time interval" i]'
    ];
  }

  function findIntervalButton() {
    for (const sel of intervalButtonSelectors()) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el.closest('button, [role="button"]') || el;
      } catch (_) {}
    }
    // Fallback: header area button whose text looks like an interval (1m, 5m, 1H, D, W)
    const header = document.querySelector('div[class*="toolbar"]') || document;
    const cands = Array.from(header.querySelectorAll('button')).filter(isVisible);
    const re = /^\s*(\d+\s*[smhdw]|1\s*(second|minute|hour|day|week|month)|[smhdw]|daily)\s*$/i;
    for (const b of cands) {
      const t = (b.textContent || '').trim().slice(0, 12);
      if (re.test(t)) return b;
    }
    return null;
  }

  function findMenuRoot() {
    const sels = [
      '[data-name="menu-inner"]',
      '[role="menu"]',
      'div[class*="menuBox"]',
      'div[class*="dropdownMenu"]'
    ];
    for (const s of sels) {
      try {
        const els = Array.from(document.querySelectorAll(s)).filter(isVisible);
        if (els.length) return els[els.length - 1];
      } catch (_) {}
    }
    return null;
  }

  function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function menuItemMatches(el, action) {
    const text = norm(getAccessibleText(el));
    const dv = norm(el.getAttribute && el.getAttribute('data-value'));
    for (const a of (action.aliases || [])) {
      const na = norm(a);
      if (!na) continue;
      if (dv === na) return true;
      if (text === na) return true;
    }
    // Interval numeric equivalence: data-value "60" == "1h"
    const id = (action.intervalId || '').toUpperCase();
    if (dv && dv.toUpperCase() === id) return true;
    // Text contains full label, e.g. "1 minute"
    if (text.includes(norm(action.label))) return true;
    return false;
  }

  function findFavoriteIntervalButton(action) {
    // Favorited intervals appear as small buttons in the top toolbar with text like "1m".
    // Compare case-sensitively: "1m" (minute) vs "1M" (month range) must not collide.
    const top = document.querySelector('#header-toolbar-intervals')?.parentElement?.parentElement || document;
    const btns = Array.from(top.querySelectorAll('button')).filter(isVisible);
    const aliases = new Set((action.aliases || []).map(a => (a || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    const lower = new Set(Array.from(aliases).map(a => a.toLowerCase()));
    for (const b of btns) {
      const t = ((b.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 10);
      if (!t || t.length > 10) continue;
      if (aliases.has(t)) return b;
    }
    // Fallback: case-insensitive full-label match only (avoids "1m" minute/month clash)
    for (const b of btns) {
      const t = ((b.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 10);
      if (!t) continue;
      if (lower.has(t.toLowerCase()) && /second|minute|hour|month|week|day/i.test(getAccessibleText(b))) return b;
    }
    return null;
  }

  async function setTimeframe(action) {
    // 1) direct favorite button
    try {
      const fav = findFavoriteIntervalButton(action);
      if (fav) { realClick(fav); return { ok: true, via: 'favorite' }; }
    } catch (_) {}

    // 2) open interval menu and pick
    const btn = findIntervalButton();
    if (!btn) return { ok: false, reason: 'interval-button-not-found' };
    realClick(btn);
    await sleep(350);

    for (let attempt = 0; attempt < 3; attempt++) {
      const menu = findMenuRoot();
      if (menu) {
        const items = Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [data-value], button, [role="option"]'));
        for (const it of items) {
          if (!isVisible(it)) continue;
          if (menuItemMatches(it, action)) {
            realClick(it);
            await sleep(250);
            return { ok: true, via: 'menu' };
          }
        }
        // Menu open but item not found — maybe needs scroll; scroll menu and retry once
        try { menu.scrollTop = menu.scrollHeight; } catch (_) {}
        await sleep(250);
        const items2 = Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [data-value], button'));
        for (const it of items2) {
          if (!isVisible(it)) continue;
          if (menuItemMatches(it, action)) { realClick(it); await sleep(250); return { ok: true, via: 'menu-scroll' }; }
        }
        escapeMenu();
        return { ok: false, reason: 'interval-not-in-menu' };
      }
      await sleep(300);
    }
    escapeMenu();
    return { ok: false, reason: 'menu-not-open' };
  }

  // ---------- Range ----------
  async function setRange(action) {
    const want = (action.rangeId || '').toUpperCase();
    const btns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(isVisible);
    const inBottom = (el) => {
      try { return el.getBoundingClientRect().top > window.innerHeight * 0.5; } catch (_) { return false; }
    };
    // Prefer exact short text match in the BOTTOM half (ranges live there;
    // "1M" also exists in the top interval toolbar and must not win).
    const sorted = btns.slice().sort((a, b) => (inBottom(b) ? 1 : 0) - (inBottom(a) ? 1 : 0));
    for (const b of sorted) {
      const t = (b.textContent || '').trim().toUpperCase();
      if (t === want && t.length <= 4) { realClick(b); return { ok: true, via: 'button' }; }
    }
    // YTD / ALL can be longer
    const found = findByKeywords([action.rangeId], document);
    if (found) { realClick(found); return { ok: true, via: 'keyword' }; }
    return { ok: false, reason: 'range-not-found' };
  }

  // ---------- Favorites cycling ----------
  function collectFavIntervals() {
    const top = document.querySelector('#header-toolbar-intervals')?.parentElement?.parentElement || document;
    const btns = Array.from(top.querySelectorAll('button')).filter(isVisible)
      .map(b => ({ el: b, t: (b.textContent || '').trim() }))
      .filter(x => x.t && x.t.length <= 8 && /^[\d\w]+$/.test(x.t.replace(/\s/g, '')));
    // Dedupe, keep order
    const seen = new Set(); const out = [];
    for (const x of btns) { if (!seen.has(x.t)) { seen.add(x.t); out.push(x); } }
    return out;
  }

  function currentIntervalLabel() {
    const btn = findIntervalButton();
    return btn ? (btn.textContent || '').trim() : '';
  }

  async function cycleFav(direction) {
    const favs = collectFavIntervals();
    if (favs.length < 2) {
      // Fallback: open menu so user can see intervals
      const btn = findIntervalButton();
      if (btn) realClick(btn);
      return { ok: false, reason: 'need-2-favorites' };
    }
    const cur = currentIntervalLabel().toLowerCase().replace(/\s/g, '');
    let idx = favs.findIndex(f => f.t.toLowerCase().replace(/\s/g, '') === cur);
    if (idx < 0) idx = direction > 0 ? -1 : 0;
    const next = favs[(idx + direction + favs.length) % favs.length];
    realClick(next.el);
    return { ok: true, via: 'cycle', label: next.t };
  }

  // ---------- Drawings ----------
  function drawingToolbarRoot() {
    const sels = ['#drawing-toolbar', '[data-name="left-toolbar"]', '[class*="leftToolbar"]', '[class*="drawingToolbar"]'];
    for (const s of sels) {
      try { const el = document.querySelector(s); if (el && isVisible(el)) return el; } catch (_) {}
    }
    return document;
  }

  async function activateDrawing(action) {
    const root = drawingToolbarRoot();
    // 1) click toolbar button
    let btn = findByKeywords(action.keywords || [], root);
    if (!btn && root !== document) btn = findByKeywords(action.keywords || [], document);
    if (btn) {
      realClick(btn);
      await sleep(300);
      // If a flyout menu opened (group tools), pick the exact tool inside it
      const menu = findMenuRoot();
      if (menu) {
        const items = Array.from(menu.querySelectorAll('[role="menuitem"], button, [data-name]'));
        let best = null, bestScore = 0;
        for (const it of items) {
          if (!isVisible(it)) continue;
          const s = matchScore(getAccessibleText(it), action.keywords || []);
          if (s > bestScore) { bestScore = s; best = it; }
        }
        if (best && bestScore >= 50) { realClick(best); await sleep(150); }
      }
      return { ok: true, via: 'toolbar' };
    }
    // 2) native hotkey fallback
    if (action.native) {
      dispatchNative(action.native);
      await sleep(150);
      return { ok: true, via: 'native-fallback' };
    }
    return { ok: false, reason: 'tool-not-found' };
  }

  // ---------- Chart actions ----------
  function largestChartCanvas() {
    try {
      const cs = Array.from(document.querySelectorAll('canvas')).filter(isVisible);
      cs.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (rb.width * rb.height) - (ra.width * ra.height);
      });
      return cs[0] || null;
    } catch (_) { return null; }
  }

  async function resetViaContextMenu() {
    // Open TradingView's own chart context menu (synthetic contextmenu does not
    // trigger the browser's native menu) and click its real "Reset chart view" item.
    const surface = largestChartCanvas() || document.body;
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    try {
      const r = surface.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    } catch (_) {}
    try {
      const press = { bubbles: true, cancelable: true, composed: true, view: window, button: 2, buttons: 2, clientX: x, clientY: y };
      surface.dispatchEvent(new PointerEvent('pointerdown', press));
      surface.dispatchEvent(new MouseEvent('mousedown', press));
      surface.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, press, { buttons: 0, button: 2 })));
      surface.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, view: window, button: 2, buttons: 0, clientX: x, clientY: y }));
    } catch (_) { return { ok: false, reason: 'ctx-dispatch-failed' }; }
    await sleep(500);
    const menu = findMenuRoot();
    if (!menu) return { ok: false, reason: 'ctx-menu-not-open' };
    const items = Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], button, [data-name]')).filter(isVisible);
    const hit = items.find(el => /reset\s+(chart|price|scale|view)/i.test(getAccessibleText(el)));
    if (!hit) { escapeMenu(); return { ok: false, reason: 'reset-not-in-menu' }; }
    realClick(hit);
    await sleep(250);
    return { ok: true, via: 'context-menu' };
  }

  async function resetViaNative() {
    // Alt+R dispatched at several targets (reset is idempotent, so multi-target is safe).
    // Blind: returns ok, caller tries this only after clickable strategies fail.
    const init = { bubbles: true, cancelable: true, composed: true, key: 'r', code: 'KeyR', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, repeat: false, isComposing: false };
    const targets = [];
    try {
      if (document.activeElement) targets.push(document.activeElement);
      const c = largestChartCanvas();
      if (c && targets.indexOf(c) < 0) targets.push(c);
      if (document.body) targets.push(document.body);
      targets.push(document.documentElement);
      targets.push(document);
    } catch (_) {}
    try {
      window.__tvsc_synthetic = true;
      for (const t of targets) {
        try {
          t.dispatchEvent(new KeyboardEvent('keydown', init));
          t.dispatchEvent(new KeyboardEvent('keyup', init));
        } catch (_) {}
        await sleep(60);
      }
      return { ok: true, via: 'native-multi' };
    } catch (_) { return { ok: false, reason: 'native-failed' }; }
    finally { setTimeout(() => { window.__tvsc_synthetic = false; }, 0); }
  }

  async function resetChartScale() {
    const direct = findByKeywords(['reset chart', 'reset scale', 'reset view', 'reset price scale'], document);
    if (direct) { realClick(direct); return { ok: true, via: 'toolbar' }; }
    const ctx = await resetViaContextMenu();
    if (ctx.ok) return ctx;
    if (window.__tvsc_debug) console.warn('[TVSC] reset via context menu failed', ctx);
    return await resetViaNative();
  }

  async function removeAllDrawings() {
    // 1) direct button if present
    const direct = findByKeywords(['remove drawing', 'remove all drawing', 'delete all drawing'], document);
    if (direct) { realClick(direct); return { ok: true, via: 'toolbar' }; }
    // 2) via Object Tree: open it, then click a delete/trash control inside the panel/dialog
    const treeBtn = findByKeywords(['object tree', 'data window'], document);
    if (treeBtn) {
      realClick(treeBtn);
      await sleep(450);
      const panel = findMenuRoot() || document;
      const trash = (function () {
        const cands = Array.from(panel.querySelectorAll('button, [role="button"]')).filter(isVisible);
        const scored = cands.map(el => ({ el, s: matchScore(getAccessibleText(el), ['delete all', 'remove all', 'trash', 'delete']) }));
        scored.sort((a, b) => b.s - a.s);
        return scored.length && scored[0].s > 0 ? scored[0].el : null;
      })();
      if (trash) { realClick(trash); await sleep(300); return { ok: true, via: 'object-tree' }; }
    }
    return { ok: false, reason: 'control-not-found' };
  }

  async function runChartAction(action) {
    if (action.id === 'chart.reset-scale') return await resetChartScale();
    if (action.id === 'chart.remove-drawings') return await removeAllDrawings();
    if (action.special === 'symbol-search') {
      const sels = ['#header-toolbar-symbol-search', 'button[aria-label*="symbol search" i]', 'button[title*="symbol search" i]'];
      for (const s of sels) {
        try { const el = document.querySelector(s); if (el && isVisible(el)) { realClick(el); return { ok: true, via: 'symbol-btn' }; } } catch (_) {}
      }
      const b = findByKeywords(['symbol search'], document);
      if (b) { realClick(b); return { ok: true, via: 'symbol-kw' }; }
      return { ok: false, reason: 'symbol-search-not-found' };
    }
    // Native-backed actions first (most reliable)
    if (action.id === 'chart.hide-drawings' && action.native) {
      // Try click first so magnet/lock state UI updates, fallback to native
      const b = findByKeywords(action.keywords, document);
      if (b) { realClick(b); return { ok: true, via: 'toolbar' }; }
      dispatchNative(action.native);
      return { ok: true, via: 'native' };
    }
    if ((action.id === 'chart.quick-search' || action.id === 'chart.screenshot') && action.native) {
      dispatchNative(action.native);
      return { ok: true, via: 'native' };
    }
    const b = findByKeywords(action.keywords || [], document);
    if (b) { realClick(b); return { ok: true, via: 'toolbar' }; }
    if (action.native) { dispatchNative(action.native); return { ok: true, via: 'native-fallback' }; }
    return { ok: false, reason: 'control-not-found' };
  }

  async function execute(action) {
    if (!action) return { ok: false, reason: 'unknown-action' };
    try {
      if (action.kind === 'interval') return await setTimeframe(action);
      if (action.kind === 'range') return await setRange(action);
      if (action.kind === 'cycle') return await cycleFav(action.direction || 1);
      if (action.kind === 'drawing') return await activateDrawing(action);
      if (action.kind === 'chart') return await runChartAction(action);
      return { ok: false, reason: 'unsupported-kind' };
    } catch (err) {
      return { ok: false, reason: String((err && err.message) || err) };
    }
  }

  globalThis.TVSC_Adapter = { execute, dispatchNative, findByKeywords, realClick, isVisible };
  // Console debug hook: run `await __tvsc_resetScale()` on a chart page to test reset directly.
  globalThis.__tvsc_resetScale = resetChartScale;
})();
