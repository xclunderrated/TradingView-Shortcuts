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

  function normKey(s) {
    // 'lock-all' -> 'lock all', 'removeAllDrawingTools' -> 'remove all drawing tools'
    return (s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function realClickTarget(el) {
    // Never click wrapper divs: events bubble UP, so a click on a wrapper never
    // reaches the inner button's handler. Always resolve to the inner button.
    if (!el || !(el instanceof Element)) return null;
    if (el.tagName === 'BUTTON') return el;
    try {
      const inner = el.querySelector('button');
      if (inner && isVisible(inner)) return inner;
    } catch (_) {}
    return el;
  }

  function realClick(el) {
    // Single activation only: exactly one click event (toggle-safe).
    const t = realClickTarget(el);
    if (!t) return false;
    try { t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    const o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 0 };
    const down = Object.assign({}, o, { buttons: 1 });
    try {
      t.dispatchEvent(new PointerEvent('pointerdown', down));
      t.dispatchEvent(new MouseEvent('mousedown', down));
      t.dispatchEvent(new PointerEvent('pointerup', o));
      t.dispatchEvent(new MouseEvent('mouseup', o));
      t.dispatchEvent(new MouseEvent('click', o));
    } catch (_) {
      try { t.click(); } catch (_) { return false; }
    }
    try { t.focus({ preventScroll: true }); } catch (_) {}
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
    const t = normKey(text);
    let best = 0;
    for (const kwRaw of keywords) {
      const k = normKey(kwRaw);
      if (!k) continue;
      if (t === k) return 100;
      if (t.startsWith(k)) best = Math.max(best, 70);
      else if (t.includes(k)) best = Math.max(best, 50);
    }
    return best;
  }

  function depth(el) {
    let d = 0;
    while (el && el !== document.body && d < 60) { d++; el = el.parentElement; }
    return d;
  }

  function findByKeywords(keywords, scope) {
    if (!keywords || !keywords.length) return null;
    const cands = allClickables(scope).filter(isVisible);
    // score desc, then real BUTTONs first, then deepest (innermost) first:
    // TradingView toolbar controls are icon-only div[data-name] wrappers around
    // the actual <button> — clicking the wrapper never fires the button handler.
    let best = null, bestScore = 0, bestBtn = -1, bestDepth = -1;
    for (const el of cands) {
      const s = matchScore(getAccessibleText(el), keywords);
      if (s <= 0) continue;
      const isBtn = el.tagName === 'BUTTON' ? 1 : 0;
      const dep = depth(el);
      if (s > bestScore || (s === bestScore && (isBtn > bestBtn || (isBtn === bestBtn && dep > bestDepth)))) {
        bestScore = s; best = el; bestBtn = isBtn; bestDepth = dep;
      }
      if (s >= 100 && isBtn) break;
    }
    return bestScore > 0 ? best : null;
  }

  function isFloating(el) {
    try {
      let p = el;
      for (let i = 0; i < 6 && p && p !== document.body; i++) {
        const cs = getComputedStyle(p);
        if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky') return true;
        p = p.parentElement;
      }
    } catch (_) {}
    return false;
  }

  function collectMatches(root, predicate) {
    // Visible matches anywhere, floating (menu/flyout) ones first.
    const out = [];
    const els = (root || document).querySelectorAll('div[role="row"][data-value], [data-value], [role="menuitem"], [role="menuitemradio"], [role="option"], button');
    for (const el of els) {
      try {
        if (!isVisible(el)) continue;
        const score = predicate(el);
        if (score > 0) out.push({ el, score, floating: isFloating(el) ? 1 : 0 });
      } catch (_) {}
    }
    out.sort((a, b) => (b.floating - a.floating) || (b.score - a.score));
    return out;
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

  // Every interval we support, in TradingView's own resolution format.
  // Written to tradingview.IntervalWidget.quicks so each one gets a direct
  // favorite button (one click, no menu). Same-origin localStorage is shared
  // between the page and this content script. Verified live: seed + reload
  // renders all 26 as header buttons.
  const QUICKS_KEY = 'tradingview.IntervalWidget.quicks';
  const QUICKS_SEED = ['1S', '5S', '15S', '30S', '1', '2', '3', '5', '10', '15', '30', '45', '60', '120', '180', '240', '360', '480', '720', 'D', '3D', 'W', 'M', '3M', '6M', '12M'];

  function readQuicks() {
    try {
      const raw = localStorage.getItem(QUICKS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch (_) { return []; }
  }

  // Merges every supported resolution into favorites. Returns 'ready' when all
  // are present, 'seeded' when we just added missing ones (page reload needed
  // once for the new buttons to render).
  function ensureFavorites() {
    try {
      const have = new Set(readQuicks());
      const missing = QUICKS_SEED.filter(v => !have.has(v));
      if (!missing.length) return 'ready';
      localStorage.setItem(QUICKS_KEY, JSON.stringify(readQuicks().concat(missing)));
      return 'seeded';
    } catch (_) { return 'error'; }
  }

  // What the header button shows after a successful switch (lowercased).
  const EXPECT_TEXT = {
    '1S': '1s', '5S': '5s', '15S': '15s', '30S': '30s',
    '1': '1m', '2': '2m', '3': '3m', '5': '5m', '10': '10m', '15': '15m', '30': '30m', '45': '45m',
    '60': '1h', '120': '2h', '180': '3h', '240': '4h', '360': '6h', '480': '8h', '720': '12h',
    'D': 'd', '3D': '3d', 'W': 'w', 'M': '1m', '3M': '3m', '6M': '6m', '12M': '12m'
  };

  function currentIntervalText() {
    try {
      const b = document.querySelector('#header-toolbar-intervals button') || document.querySelector('#header-toolbar-intervals');
      return normKey(b ? b.textContent : '').split(' ')[0];
    } catch (_) { return ''; }
  }

  function findFavoriteIntervalButton(action) {
    // Favorited intervals are sibling buttons of the interval button.
    // Strict text shape only ("1m", "4H", "D", "1W") — never loose matching,
    // so watchlist/symbol buttons (e.g. "BTCUSD") can never match.
    // The interval button itself is excluded (clicking it opens the menu).
    const anchor = document.querySelector('#header-toolbar-intervals');
    if (!anchor) return null;
    const scope = anchor.parentElement || document;
    // The menu-opener button lives inside the anchor alongside the favorites —
    // exclude exactly that one node (by identity, not by subtree).
    const opener = anchor.tagName === 'BUTTON' ? anchor : anchor.querySelector('button');
    const btns = Array.from(scope.querySelectorAll('button')).filter(isVisible)
      .filter(b => b !== opener);
    const aliases = new Set((action.aliases || []).map(a => (a || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    const SHAPE = /^(\d{1,3}\s*[smhdwSMHDW]|1\s*(second|minute|hour|day|week|month)s?|daily|[dDwWmM])$/;
    for (const b of btns) {
      const t = ((b.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 12);
      if (!t || !SHAPE.test(t)) continue;
      if (aliases.has(t)) return b;
    }
    // Case-insensitive full-label fallback ("1 Minute"), still shape-gated.
    const lower = new Set(Array.from(aliases).map(a => a.toLowerCase()));
    for (const b of btns) {
      const t = ((b.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 12);
      if (!t || !SHAPE.test(t) || t.length <= 2) continue;
      if (lower.has(t.toLowerCase())) return b;
    }
    return null;
  }

  async function setTimeframe(action) {
    // Favorite buttons only: every supported interval is seeded into
    // tradingview.IntervalWidget.quicks (see ensureFavorites), so each one
    // has a direct one-click button. No dropdown menus involved.
    const want = EXPECT_TEXT[action.intervalId] || '';
    try {
      const fav = findFavoriteIntervalButton(action);
      if (fav) {
        realClick(fav);
        // Interval data loads async — poll for the header change.
        for (let i = 0; i < 8; i++) {
          await sleep(300);
          if (!want || currentIntervalText() === want) return { ok: true, via: 'favorite' };
        }
        return { ok: false, reason: 'pick-not-applied' };
      }
    } catch (_) {}
    // Button not rendered yet: seed favorites (first run) and ask for one reload.
    const st = ensureFavorites();
    if (st === 'seeded') return { ok: false, reason: 'reload-needed' };
    return { ok: false, reason: 'interval-not-found' };
  }

  // ---------- Range ----------
  async function setRange(action) {
    // Exact tab button first (stable data-name), text fallback second.
    if (action.tab) {
      try {
        const tab = document.querySelector('[data-name="' + action.tab + '"]');
        if (tab && isVisible(tab)) { realClick(tab); await sleep(300); return { ok: true, via: 'tab' }; }
      } catch (_) {}
    }
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
  const FAV_SHAPE = /^(\d{1,3}\s*[smhdwSMHDW]|1\s*(second|minute|hour|day|week|month)s?|daily|[dDwWmM])$/;
  function collectFavIntervals() {
    // Buttons in the interval strip, strict interval text shape, opener excluded.
    // (The old broad scope once matched the "BTCUSD" symbol button.)
    const anchor = document.querySelector('#header-toolbar-intervals');
    const scope = (anchor && anchor.parentElement) || document;
    const opener = anchor ? (anchor.tagName === 'BUTTON' ? anchor : anchor.querySelector('button')) : null;
    const btns = Array.from(scope.querySelectorAll('button')).filter(isVisible)
      .filter(b => b !== opener)
      .map(b => ({ el: b, t: ((b.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 12) }))
      .filter(x => x.t && FAV_SHAPE.test(x.t));
    const seen = new Set(); const out = [];
    for (const x of btns) { if (!seen.has(x.t)) { seen.add(x.t); out.push(x); } }
    return out;
  }

  function currentIntervalLabel() {
    try {
      const b = document.querySelector('#header-toolbar-intervals button') || findIntervalButton();
      return b ? ((b.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 12) : '';
    } catch (_) { return ''; }
  }

  async function cycleFav(direction) {
    const favs = collectFavIntervals();
    if (favs.length < 2) return { ok: false, reason: 'need-2-favorites' };
    const cur = currentIntervalLabel().toLowerCase().replace(/\s/g, '');
    let idx = favs.findIndex(f => f.t.toLowerCase().replace(/\s/g, '') === cur);
    if (idx < 0) idx = direction > 0 ? -1 : 0;
    const next = favs[(idx + direction + favs.length) % favs.length];
    realClick(next.el);
    const wantT = next.t.toLowerCase().replace(/\s/g, '');
    for (let i = 0; i < 8; i++) {
      await sleep(300);
      if (currentIntervalLabel().toLowerCase().replace(/\s/g, '') === wantT) {
        return { ok: true, via: 'cycle', label: next.t };
      }
    }
    return { ok: false, reason: 'pick-not-applied' };
  }

  // ---------- Drawings ----------
  function drawingToolbarRoot() {
    const sels = ['#drawing-toolbar', '[data-name="left-toolbar"]', '[class*="leftToolbar"]', '[class*="drawingToolbar"]'];
    for (const s of sels) {
      try { const el = document.querySelector(s); if (el && isVisible(el)) return el; } catch (_) {}
    }
    return document;
  }

  function groupEl(dn) {
    try {
      const g = document.querySelector('[data-name="' + dn + '"]');
      return (g && isVisible(g)) ? g : null;
    } catch (_) { return null; }
  }

  function groupMainButton(g) {
    try {
      const btns = Array.from(g.querySelectorAll('button')).filter(isVisible);
      return btns.length ? btns[0] : null;
    } catch (_) { return null; }
  }

  function groupArrowButton(g) {
    try {
      const btns = Array.from(g.querySelectorAll('button')).filter(isVisible);
      return btns.length > 1 ? btns[btns.length - 1] : null;
    } catch (_) { return null; }
  }

  function groupCurrentTool(g) {
    try {
      const b = groupMainButton(g);
      return normKey(b ? (b.getAttribute('aria-label') || b.getAttribute('data-tooltip') || '') : '');
    } catch (_) { return ''; }
  }

  function toolVerified(action, aria) {
    const want = normKey(action.tool || '');
    if (!want || !aria) return false;
    if (action.match === 'is') return aria === want;
    if (action.match === 'any') return want.split('|').some(w => aria.includes(w));
    return aria.includes(want);
  }

  async function activateDrawing(action) {
    const kws = action.keywords || [];
    // 1) exact tool button (e.g. user-starred favorite): the label IS the tool.
    const exact = collectMatches(document, (el) => {
      const s = matchScore(getAccessibleText(el), kws);
      return s >= 80 ? s : 0;
    })[0];
    if (exact && !action.groupDn) { realClick(exact.el); await sleep(200); return { ok: true, via: 'favorite' }; }

    // 2) group path with post-click verification (the group button's aria-label
    // always names its current tool, e.g. "Brush", "Trendline").
    if (action.groupDn) {
      const g = groupEl(action.groupDn);
      if (!g) return { ok: false, reason: 'toolbar-not-found' };
      const main = groupMainButton(g);
      if (!main) return { ok: false, reason: 'toolbar-not-found' };
      if (toolVerified(action, groupCurrentTool(g))) {
        realClick(main);
        await sleep(200);
        return { ok: true, via: 'toolbar' };
      }
      // Need a different tool than the group shows: open the variants flyout
      // via the group's arrow button, then pick the exact tool.
      const arrow = groupArrowButton(g);
      if (arrow && arrow !== main) { realClick(arrow); await sleep(500); }
      else {
        try {
          const r = main.getBoundingClientRect();
          const hov = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
          main.dispatchEvent(new MouseEvent('mousemove', hov));
          main.dispatchEvent(new MouseEvent('mouseover', hov));
        } catch (_) {}
        await sleep(400);
      }
      const picks = collectMatches(document, (el) => {
        try { if (g.contains(el)) return 0; } catch (_) {}
        const txt = getAccessibleText(el);
        const a = normKey(txt);
        const want = normKey(action.tool || '');
        if (want && a === want) return 90;
        const s = matchScore(txt, kws);
        if (s >= 50) return s;
        if (want && a.includes(want)) return 70;
        return 0;
      }).filter(h => h.floating);
      if (picks.length) {
        realClick(picks[0].el);
        await sleep(300);
        if (toolVerified(action, groupCurrentTool(g))) return { ok: true, via: 'flyout' };
        return { ok: false, reason: 'tool-not-exact' };
      }
      return { ok: false, reason: 'tool-not-exact' };
    }

    // 3) standalone controls (measure, zoom, magnet cycle): exact match click.
    if (exact) { realClick(exact.el); await sleep(200); return { ok: true, via: 'toolbar' }; }
    const btn = findByKeywords(kws, drawingToolbarRoot()) || findByKeywords(kws, document);
    if (!btn) return { ok: false, reason: 'tool-not-found' };
    realClick(btn);
    await sleep(200);
    return { ok: true, via: 'toolbar' };
  }

  // ---------- Chart actions ----------
  async function tryConfirmDialog() {
    // Some destructive actions pop a confirmation — approve it so the bind
    // stays instant (best effort, harmless when no dialog is present).
    await sleep(500);
    try {
      const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(isVisible);
      for (const d of dlgs) {
        const btns = Array.from(d.querySelectorAll('button')).filter(isVisible);
        const okBtn = btns.find(b => /^(yes|confirm|remove|delete|ok|apply|remove all|delete all)$/i.test((b.textContent || '').trim()));
        if (okBtn) { realClick(okBtn); await sleep(250); return true; }
      }
    } catch (_) {}
    return false;
  }

  function findTimeAxis() {
    // Time scale: wide, short canvas strip at the bottom of the chart.
    try {
      const cs = Array.from(document.querySelectorAll('canvas')).filter(isVisible)
        .map(c => ({ c, r: c.getBoundingClientRect() }))
        .filter(x => x.r.width > 400 && x.r.height >= 10 && x.r.height <= 80)
        .sort((a, b) => b.r.y - a.r.y);
      return cs.length ? cs[0] : null;
    } catch (_) { return null; }
  }

  async function resetChartScale() {
    // Double-clicking the time axis resets the chart view (same end state as
    // the native Alt+R, verified pixel-for-pixel). Pure DOM mouse events —
    // synthetic keyboard/contextmenu events are ignored by TradingView.
    const axis = findTimeAxis();
    if (!axis) return { ok: false, reason: 'time-axis-not-found' };
    const x = axis.r.left + axis.r.width / 2, y = axis.r.top + axis.r.height / 2;
    let el = null;
    try { el = document.elementFromPoint(x, y) || axis.c; } catch (_) { el = axis.c; }
    if (!el) return { ok: false, reason: 'time-axis-not-found' };
    const mk = (buttons) => ({ bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons, clientX: x, clientY: y });
    try {
      for (let k = 0; k < 2; k++) {
        try { el.dispatchEvent(new PointerEvent('pointerdown', mk(1))); } catch (_) {}
        el.dispatchEvent(new MouseEvent('mousedown', mk(1)));
        try { el.dispatchEvent(new PointerEvent('pointerup', mk(0))); } catch (_) {}
        el.dispatchEvent(new MouseEvent('mouseup', mk(0)));
        el.dispatchEvent(new MouseEvent('click', mk(0)));
        await sleep(60);
      }
      el.dispatchEvent(new MouseEvent('dblclick', mk(0)));
    } catch (_) { return { ok: false, reason: 'dblclick-failed' }; }
    await sleep(400);
    return { ok: true, via: 'time-axis-dblclick' };
  }

  async function removeAllDrawings() {
    const direct = findByKeywords(['remove all', 'remove drawing', 'delete all drawing'], document);
    if (!direct) return { ok: false, reason: 'control-not-found' };
    realClick(direct);
    await tryConfirmDialog();
    return { ok: true, via: 'toolbar' };
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
    // Every success below means a real click landed. Synthetic keyboard events
    // are ignored by TradingView, so there are no blind "native" successes.
    const b = findByKeywords(action.keywords || [], document);
    if (b) { realClick(b); return { ok: true, via: 'toolbar' }; }
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

  globalThis.TVSC_Adapter = { execute, dispatchNative, findByKeywords, realClick, isVisible, ensureFavorites };
  // Console debug hook: run `await __tvsc_resetScale()` on a chart page to test reset directly.
  globalThis.__tvsc_resetScale = resetChartScale;
})();
