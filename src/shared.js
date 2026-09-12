/* Shared catalog + helpers. Loaded in BOTH content script and popup (no modules). */
(function () {
  'use strict';

  const GROUPS = [
    { id: 'tf-sec', label: 'Timeframes · Seconds' },
    { id: 'tf-min', label: 'Timeframes · Minutes' },
    { id: 'tf-hour', label: 'Timeframes · Hours' },
    { id: 'tf-daily', label: 'Timeframes · Daily +' },
    { id: 'range', label: 'Ranges (bottom bar)' },
    { id: 'cycle', label: 'Timeframe cycling' },
    { id: 'draw-trend', label: 'Drawings · Trend lines' },
    { id: 'draw-fib', label: 'Drawings · Fib / Gann' },
    { id: 'draw-shape', label: 'Drawings · Shapes' },
    { id: 'draw-pos', label: 'Drawings · Positions / Measure' },
    { id: 'draw-text', label: 'Drawings · Text / Marks' },
    { id: 'draw-pattern', label: 'Drawings · Patterns / Pitchfork' },
    { id: 'draw-util', label: 'Drawings · Utilities' },
    { id: 'chart', label: 'Chart actions' }
  ];

  // kind: 'interval' | 'range' | 'drawing' | 'chart' | 'cycle'
  // intervalId: TradingView menu data-value style id used for matching
  const ACTIONS = [
    // ---- Seconds ----
    { id: 'timeframe.1S', group: 'tf-sec', kind: 'interval', label: '1 second', intervalId: '1S', aliases: ['1s', '1 second', '1 sec'], keywords: [] },
    { id: 'timeframe.5S', group: 'tf-sec', kind: 'interval', label: '5 seconds', intervalId: '5S', aliases: ['5s', '5 seconds', '5 sec'], keywords: [] },
    { id: 'timeframe.15S', group: 'tf-sec', kind: 'interval', label: '15 seconds', intervalId: '15S', aliases: ['15s', '15 seconds', '15 sec'], keywords: [] },
    { id: 'timeframe.30S', group: 'tf-sec', kind: 'interval', label: '30 seconds', intervalId: '30S', aliases: ['30s', '30 seconds', '30 sec'], keywords: [] },

    // ---- Minutes ----
    { id: 'timeframe.1', group: 'tf-min', kind: 'interval', label: '1 minute', intervalId: '1', aliases: ['1', '1m', '1 minute', '1 min'], keywords: [] },
    { id: 'timeframe.2', group: 'tf-min', kind: 'interval', label: '2 minutes', intervalId: '2', aliases: ['2', '2m', '2 minutes', '2 min'], keywords: [] },
    { id: 'timeframe.3', group: 'tf-min', kind: 'interval', label: '3 minutes', intervalId: '3', aliases: ['3', '3m', '3 minutes', '3 min'], keywords: [] },
    { id: 'timeframe.5', group: 'tf-min', kind: 'interval', label: '5 minutes', intervalId: '5', aliases: ['5', '5m', '5 minutes', '5 min'], keywords: [] },
    { id: 'timeframe.10', group: 'tf-min', kind: 'interval', label: '10 minutes', intervalId: '10', aliases: ['10', '10m', '10 minutes', '10 min'], keywords: [] },
    { id: 'timeframe.15', group: 'tf-min', kind: 'interval', label: '15 minutes', intervalId: '15', aliases: ['15', '15m', '15 minutes', '15 min'], keywords: [] },
    { id: 'timeframe.30', group: 'tf-min', kind: 'interval', label: '30 minutes', intervalId: '30', aliases: ['30', '30m', '30 minutes', '30 min'], keywords: [] },
    { id: 'timeframe.45', group: 'tf-min', kind: 'interval', label: '45 minutes', intervalId: '45', aliases: ['45', '45m', '45 minutes', '45 min'], keywords: [] },

    // ---- Hours ----
    { id: 'timeframe.60', group: 'tf-hour', kind: 'interval', label: '1 hour', intervalId: '60', aliases: ['60', '1h', '1 hour', '60m', '60 min'], keywords: [] },
    { id: 'timeframe.120', group: 'tf-hour', kind: 'interval', label: '2 hours', intervalId: '120', aliases: ['120', '2h', '2 hours', '2 hour'], keywords: [] },
    { id: 'timeframe.180', group: 'tf-hour', kind: 'interval', label: '3 hours', intervalId: '180', aliases: ['180', '3h', '3 hours', '3 hour'], keywords: [] },
    { id: 'timeframe.240', group: 'tf-hour', kind: 'interval', label: '4 hours', intervalId: '240', aliases: ['240', '4h', '4 hours', '4 hour'], keywords: [] },
    { id: 'timeframe.360', group: 'tf-hour', kind: 'interval', label: '6 hours', intervalId: '360', aliases: ['360', '6h', '6 hours'], keywords: [] },
    { id: 'timeframe.480', group: 'tf-hour', kind: 'interval', label: '8 hours', intervalId: '480', aliases: ['480', '8h', '8 hours'], keywords: [] },
    { id: 'timeframe.720', group: 'tf-hour', kind: 'interval', label: '12 hours', intervalId: '720', aliases: ['720', '12h', '12 hours'], keywords: [] },

    // ---- Daily+ ----
    { id: 'timeframe.1D', group: 'tf-daily', kind: 'interval', label: '1 day', intervalId: 'D', aliases: ['d', '1d', '1 day', 'daily'], keywords: [] },
    { id: 'timeframe.3D', group: 'tf-daily', kind: 'interval', label: '3 days', intervalId: '3D', aliases: ['3d', '3 days', '3 day'], keywords: [] },
    { id: 'timeframe.1W', group: 'tf-daily', kind: 'interval', label: '1 week', intervalId: 'W', aliases: ['w', '1w', '1 week', 'weekly'], keywords: [] },
    { id: 'timeframe.1M', group: 'tf-daily', kind: 'interval', label: '1 month', intervalId: 'M', aliases: ['M', '1mo', '1 mon', '1 month', 'monthly'], keywords: [] },
    { id: 'timeframe.3M', group: 'tf-daily', kind: 'interval', label: '3 months', intervalId: '3M', aliases: ['3mo', '3 mon', '3 months'], keywords: [] },
    { id: 'timeframe.6M', group: 'tf-daily', kind: 'interval', label: '6 months', intervalId: '6M', aliases: ['6mo', '6 mon', '6 months'], keywords: [] },
    { id: 'timeframe.12M', group: 'tf-daily', kind: 'interval', label: '12 months', intervalId: '12M', aliases: ['12mo', '12 mon', '12 months', '1 year'], keywords: [] },

    // ---- Ranges (TradingView data-name tabs: 1Y=12M, 5Y=60M) ----
    { id: 'range.5D', group: 'range', kind: 'range', label: 'Range 5D', rangeId: '5D', tab: 'date-range-tab-5D', aliases: ['5d'], keywords: [] },
    { id: 'range.1M', group: 'range', kind: 'range', label: 'Range 1M', rangeId: '1M', tab: 'date-range-tab-1M', aliases: ['1m'], keywords: [] },
    { id: 'range.3M', group: 'range', kind: 'range', label: 'Range 3M', rangeId: '3M', tab: 'date-range-tab-3M', aliases: ['3m'], keywords: [] },
    { id: 'range.6M', group: 'range', kind: 'range', label: 'Range 6M', rangeId: '6M', tab: 'date-range-tab-6M', aliases: ['6m'], keywords: [] },
    { id: 'range.YTD', group: 'range', kind: 'range', label: 'Range YTD', rangeId: 'YTD', tab: 'date-range-tab-YTD', aliases: ['ytd'], keywords: [] },
    { id: 'range.1Y', group: 'range', kind: 'range', label: 'Range 1Y', rangeId: '1Y', tab: 'date-range-tab-12M', aliases: ['1y'], keywords: [] },
    { id: 'range.5Y', group: 'range', kind: 'range', label: 'Range 5Y', rangeId: '5Y', tab: 'date-range-tab-60M', aliases: ['5y'], keywords: [] },
    { id: 'range.ALL', group: 'range', kind: 'range', label: 'Range ALL', rangeId: 'ALL', tab: 'date-range-tab-ALL', aliases: ['all'], keywords: [] },

    // ---- Cycling ----
    { id: 'cycle.next-fav', group: 'cycle', kind: 'cycle', label: 'Next favorite interval', direction: 1, keywords: [] },
    { id: 'cycle.prev-fav', group: 'cycle', kind: 'cycle', label: 'Previous favorite interval', direction: -1, keywords: [] },

    // ---- Drawings: trend (group linetool-group-trend-line) ----
    { id: 'tool.trend-line', group: 'draw-trend', kind: 'drawing', label: 'Trend line', keywords: ['trend line'], groupDn: 'linetool-group-trend-line', tool: 'trendline', native: { key: 't', code: 'KeyT', alt: true } },
    { id: 'tool.trend-angle', group: 'draw-trend', kind: 'drawing', label: 'Trend angle', keywords: ['trend angle'], groupDn: 'linetool-group-trend-line', tool: 'trend angle', native: null },
    { id: 'tool.horizontal-line', group: 'draw-trend', kind: 'drawing', label: 'Horizontal line', keywords: ['horizontal line'], groupDn: 'linetool-group-trend-line', tool: 'horizontal line', native: { key: 'h', code: 'KeyH', alt: true } },
    { id: 'tool.horizontal-ray', group: 'draw-trend', kind: 'drawing', label: 'Horizontal ray', keywords: ['horizontal ray'], groupDn: 'linetool-group-trend-line', tool: 'horizontal ray', native: { key: 'j', code: 'KeyJ', alt: true } },
    { id: 'tool.vertical-line', group: 'draw-trend', kind: 'drawing', label: 'Vertical line', keywords: ['vertical line'], groupDn: 'linetool-group-trend-line', tool: 'vertical line', native: { key: 'v', code: 'KeyV', alt: true } },
    { id: 'tool.cross-line', group: 'draw-trend', kind: 'drawing', label: 'Cross line', keywords: ['cross line', 'crossline'], groupDn: 'linetool-group-trend-line', tool: 'cross line', native: { key: 'c', code: 'KeyC', alt: true } },
    { id: 'tool.parallel-channel', group: 'draw-trend', kind: 'drawing', label: 'Parallel channel', keywords: ['parallel channel'], groupDn: 'linetool-group-trend-line', tool: 'parallel channel', native: null },
    { id: 'tool.regression-trend', group: 'draw-trend', kind: 'drawing', label: 'Regression trend', keywords: ['regression trend'], groupDn: 'linetool-group-trend-line', tool: 'regression trend', native: null },
    { id: 'tool.arrow', group: 'draw-trend', kind: 'drawing', label: 'Arrow', keywords: ['arrow'], groupDn: 'linetool-group-trend-line', tool: 'arrow', match: 'is', native: null },
    { id: 'tool.ray', group: 'draw-trend', kind: 'drawing', label: 'Ray', keywords: ['ray'], groupDn: 'linetool-group-trend-line', tool: 'ray', match: 'is', native: null },

    // ---- Fib / Gann (group linetool-group-gann-and-fibonacci) ----
    { id: 'tool.fib-retracement', group: 'draw-fib', kind: 'drawing', label: 'Fib retracement', keywords: ['fib retracement', 'fibonacci retracement'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'fib retracement', native: { key: 'f', code: 'KeyF', alt: true } },
    { id: 'tool.fib-extension', group: 'draw-fib', kind: 'drawing', label: 'Trend-based Fib extension', keywords: ['trend-based fib extension', 'fib extension'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'fib extension', native: null },
    { id: 'tool.fib-channel', group: 'draw-fib', kind: 'drawing', label: 'Fib channel', keywords: ['fib channel'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'fib channel', native: null },
    { id: 'tool.fib-timezone', group: 'draw-fib', kind: 'drawing', label: 'Fib time zone', keywords: ['fib time zone', 'fib timezone'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'fib time zone', native: null },
    { id: 'tool.fib-fan', group: 'draw-fib', kind: 'drawing', label: 'Fib fan', keywords: ['fib fan'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'fib fan', native: null },
    { id: 'tool.fib-spiral', group: 'draw-fib', kind: 'drawing', label: 'Fib spiral', keywords: ['fib spiral'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'fib spiral', native: null },
    { id: 'tool.gann-box', group: 'draw-fib', kind: 'drawing', label: 'Gann box', keywords: ['gann box'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'gann box', native: null },
    { id: 'tool.gann-fan', group: 'draw-fib', kind: 'drawing', label: 'Gann fan', keywords: ['gann fan'], groupDn: 'linetool-group-gann-and-fibonacci', tool: 'gann fan', native: null },

    // ---- Shapes (group linetool-group-geometric-shapes) ----
    { id: 'tool.rectangle', group: 'draw-shape', kind: 'drawing', label: 'Rectangle', keywords: ['rectangle'], groupDn: 'linetool-group-geometric-shapes', tool: 'rectangle', native: { key: 'R', code: 'KeyR', alt: true, shift: true } },
    { id: 'tool.rotated-rectangle', group: 'draw-shape', kind: 'drawing', label: 'Rotated rectangle', keywords: ['rotated rectangle'], groupDn: 'linetool-group-geometric-shapes', tool: 'rotated rectangle', native: null },
    { id: 'tool.ellipse', group: 'draw-shape', kind: 'drawing', label: 'Ellipse / Circle', keywords: ['ellipse', 'circle'], groupDn: 'linetool-group-geometric-shapes', tool: 'ellipse', native: null },
    { id: 'tool.triangle', group: 'draw-shape', kind: 'drawing', label: 'Triangle', keywords: ['triangle'], groupDn: 'linetool-group-geometric-shapes', tool: 'triangle', native: null },
    { id: 'tool.polyline', group: 'draw-shape', kind: 'drawing', label: 'Path / Polyline', keywords: ['path', 'polyline'], groupDn: 'linetool-group-geometric-shapes', tool: 'path', native: null },
    { id: 'tool.brush', group: 'draw-shape', kind: 'drawing', label: 'Brush', keywords: ['brush'], groupDn: 'linetool-group-geometric-shapes', tool: 'brush', native: null },
    { id: 'tool.highlighter', group: 'draw-shape', kind: 'drawing', label: 'Highlighter', keywords: ['highlighter'], groupDn: 'linetool-group-geometric-shapes', tool: 'highlighter', native: null },

    // ---- Positions / measure (group linetool-group-prediction-and-measurement) ----
    { id: 'tool.long-position', group: 'draw-pos', kind: 'drawing', label: 'Long position', keywords: ['long position'], groupDn: 'linetool-group-prediction-and-measurement', tool: 'long position', native: null },
    { id: 'tool.short-position', group: 'draw-pos', kind: 'drawing', label: 'Short position', keywords: ['short position'], groupDn: 'linetool-group-prediction-and-measurement', tool: 'short position', native: null },
    { id: 'tool.forecast', group: 'draw-pos', kind: 'drawing', label: 'Forecast', keywords: ['forecast'], groupDn: 'linetool-group-prediction-and-measurement', tool: 'forecast', native: null },
    { id: 'tool.measure', group: 'draw-pos', kind: 'drawing', label: 'Measure', keywords: ['measure'], groupDn: null, tool: 'measure', native: null },
    { id: 'tool.price-range', group: 'draw-pos', kind: 'drawing', label: 'Price range', keywords: ['price range'], groupDn: 'linetool-group-prediction-and-measurement', tool: 'price range', native: null },
    { id: 'tool.date-range', group: 'draw-pos', kind: 'drawing', label: 'Date range', keywords: ['date range'], groupDn: 'linetool-group-prediction-and-measurement', tool: 'date range', native: null },
    { id: 'tool.fixed-volume-profile', group: 'draw-pos', kind: 'drawing', label: 'Fixed range volume profile', keywords: ['fixed range volume', 'volume profile'], groupDn: 'linetool-group-prediction-and-measurement', tool: 'volume profile', native: null },

    // ---- Text / marks (group linetool-group-annotation, icons in linetool-group-font-icons) ----
    { id: 'tool.text', group: 'draw-text', kind: 'drawing', label: 'Text', keywords: ['text'], groupDn: 'linetool-group-annotation', tool: 'text', match: 'is', native: null },
    { id: 'tool.anchored-text', group: 'draw-text', kind: 'drawing', label: 'Anchored text', keywords: ['anchored text'], groupDn: 'linetool-group-annotation', tool: 'anchored text', native: null },
    { id: 'tool.callout', group: 'draw-text', kind: 'drawing', label: 'Callout', keywords: ['callout'], groupDn: 'linetool-group-annotation', tool: 'callout', native: null },
    { id: 'tool.comment', group: 'draw-text', kind: 'drawing', label: 'Comment', keywords: ['comment'], groupDn: 'linetool-group-annotation', tool: 'comment', native: null },
    { id: 'tool.arrow-marker', group: 'draw-text', kind: 'drawing', label: 'Arrow marker', keywords: ['arrow marker'], groupDn: 'linetool-group-annotation', tool: 'arrow marker', native: null },
    { id: 'tool.flag', group: 'draw-text', kind: 'drawing', label: 'Flag mark', keywords: ['flag'], groupDn: 'linetool-group-annotation', tool: 'flag', native: null },
    { id: 'tool.emoji', group: 'draw-text', kind: 'drawing', label: 'Emoji / Icon', keywords: ['emoji', 'icon'], groupDn: 'linetool-group-font-icons', tool: 'icon', native: null },

    // ---- Patterns (group linetool-group-patterns) ----
    { id: 'tool.xabcd', group: 'draw-pattern', kind: 'drawing', label: 'XABCD pattern', keywords: ['xabcd'], groupDn: 'linetool-group-patterns', tool: 'xabcd', native: null },
    { id: 'tool.elliott-impulse', group: 'draw-pattern', kind: 'drawing', label: 'Elliott impulse', keywords: ['elliott impulse', 'elliott wave'], groupDn: 'linetool-group-patterns', tool: 'elliott', native: null },
    { id: 'tool.head-shoulders', group: 'draw-pattern', kind: 'drawing', label: 'Head and shoulders', keywords: ['head and shoulders'], groupDn: 'linetool-group-patterns', tool: 'head and shoulders', native: null },
    { id: 'tool.pitchfork', group: 'draw-pattern', kind: 'drawing', label: 'Pitchfork', keywords: ['pitchfork'], groupDn: 'linetool-group-patterns', tool: 'pitchfork', native: null },
    { id: 'tool.schiff-pitchfork', group: 'draw-pattern', kind: 'drawing', label: 'Schiff pitchfork', keywords: ['schiff pitchfork', 'schiff'], groupDn: 'linetool-group-patterns', tool: 'schiff', native: null },

    // ---- Drawing utils ----
    { id: 'tool.eraser', group: 'draw-util', kind: 'drawing', label: 'Eraser', keywords: ['eraser'], groupDn: 'linetool-group-cursors', tool: 'eraser', native: null },
    { id: 'tool.zoom', group: 'draw-util', kind: 'drawing', label: 'Zoom', keywords: ['zoom'], groupDn: null, tool: 'zoom', native: null },
    { id: 'tool.magnet-weak-strong', group: 'draw-util', kind: 'drawing', label: 'Magnet (cycle weak/strong)', keywords: ['magnet'], groupDn: null, tool: 'magnet', native: null },

    // ---- Chart actions ----
    { id: 'chart.magnet', group: 'chart', kind: 'chart', label: 'Toggle magnet', keywords: ['magnet'], native: null },
    { id: 'chart.lock-drawings', group: 'chart', kind: 'chart', label: 'Lock all drawings', keywords: ['lock all', 'lock drawing'], native: null },
    { id: 'chart.hide-drawings', group: 'chart', kind: 'chart', label: 'Hide all drawings', keywords: ['hide all', 'hide drawing'], native: { key: 'h', code: 'KeyH', ctrl: true, alt: true } },
    { id: 'chart.remove-drawings', group: 'chart', kind: 'chart', label: 'Remove drawings', keywords: ['remove drawing', 'remove all drawing', 'delete all drawing', 'remove all'], native: null },
    { id: 'chart.remove-indicators', group: 'chart', kind: 'chart', label: 'Remove indicators', keywords: ['remove indicator'], native: null },
    { id: 'chart.symbol-search', group: 'chart', kind: 'chart', label: 'Symbol search', keywords: ['symbol search'], native: null, special: 'symbol-search' },
    { id: 'chart.quick-search', group: 'chart', kind: 'chart', label: 'Quick search', keywords: ['quick search'], native: { key: 'k', code: 'KeyK', ctrl: true } },
    { id: 'chart.object-tree', group: 'chart', kind: 'chart', label: 'Object tree & data window', keywords: ['object tree', 'data window'], native: null },
    { id: 'chart.autoscale', group: 'chart', kind: 'chart', label: 'Toggle auto scale', keywords: ['auto scale', 'auto-scale'], native: null },
    { id: 'chart.log-scale', group: 'chart', kind: 'chart', label: 'Toggle log scale', keywords: ['log scale', 'logarithmic'], native: null },
    { id: 'chart.crosshair', group: 'chart', kind: 'chart', label: 'Cross / cursor mode', keywords: ['crosshair', 'cursor mode', 'dot cursor', 'arrow cursor', 'cursor'], groupDn: 'linetool-group-cursors', tool: 'cross|cursor|dot|arrow', match: 'any', native: null },
    { id: 'chart.stay-in-draw', group: 'chart', kind: 'chart', label: 'Stay in drawing mode', keywords: ['stay in drawing', 'keep drawing'], native: null },
    { id: 'chart.scroll-realtime', group: 'chart', kind: 'chart', label: 'Scroll to realtime', keywords: ['go to realtime', 'scroll to the most'], native: null },
    { id: 'chart.reset-scale', group: 'chart', kind: 'chart', label: 'Reset chart scale', keywords: ['reset chart', 'reset scale', 'reset view', 'reset price scale'], native: { key: 'r', code: 'KeyR', alt: true } },
    { id: 'chart.fullscreen', group: 'chart', kind: 'chart', label: 'Fullscreen chart', keywords: ['fullscreen'], native: null }
  ];

  const DEFAULT_BINDINGS = {
    'timeframe.1': 'a',
    'timeframe.5': 's',
    'timeframe.15': 'd',
    'timeframe.60': 'f',
    'timeframe.240': 'g',
    'timeframe.1D': 'h',
    'tool.rectangle': 'q',
    'tool.trend-line': 'w',
    'tool.fib-retracement': 'e',
    'tool.horizontal-line': 'r',
    'tool.long-position': 't',
    'tool.short-position': 'y',
    'chart.magnet': 'm',
    'chart.hide-drawings': 'x',
    'chart.lock-drawings': 'l',
    'chart.remove-drawings': 'shift+x',
    'chart.reset-scale': '0',
    'cycle.next-fav': 'arrowright',
    'cycle.prev-fav': 'arrowleft'
  };

  const DEFAULT_SETTINGS = { enabled: true, showToast: true };

  function baseKeyFromEvent(e) {
    const k = e.key;
    if (k === undefined || k === null) return '';
    if (k === ' ') return 'space';
    if (k.length === 1) return k.toLowerCase();
    return k.toLowerCase();
  }

  // Returns combo string like "a", "shift+a", "ctrl+alt+h". Null for modifier-only.
  function normalizeComboFromEvent(e) {
    const raw = e.key;
    if (raw === 'Control' || raw === 'Shift' || raw === 'Alt' || raw === 'Meta' ||
        raw === 'Dead' || raw === undefined) return null;
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    let base = baseKeyFromEvent(e);
    // Normalize common names
    if (base === 'arrowleft' || base === 'arrowright' || base === 'arrowup' || base === 'arrowdown') { /* keep */ }
    else if (base === 'escape') base = 'escape';
    else if (base === 'enter') base = 'enter';
    else if (base === 'tab') base = 'tab';
    else if (base === 'backspace') base = 'backspace';
    else if (base === 'delete') base = 'delete';
    else if (base === ' ') base = 'space';
    parts.push(base);
    return parts.join('+');
  }

  function formatCombo(combo) {
    if (!combo) return '—';
    return combo.split('+').map(p => {
      if (p === 'ctrl') return 'Ctrl';
      if (p === 'alt') return 'Alt';
      if (p === 'shift') return 'Shift';
      if (p === 'meta') return 'Cmd';
      if (p === 'space') return 'Space';
      if (p === 'arrowleft') return '←';
      if (p === 'arrowright') return '→';
      if (p === 'arrowup') return '↑';
      if (p === 'arrowdown') return '↓';
      if (p === 'backspace') return '⌫';
      if (p === 'delete') return 'Del';
      if (p === 'escape') return 'Esc';
      if (p.length === 1) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' + ');
  }

  function actionById(id) {
    return ACTIONS.find(a => a.id === id) || null;
  }

  globalThis.TVSC = { GROUPS, ACTIONS, DEFAULT_BINDINGS, DEFAULT_SETTINGS, normalizeComboFromEvent, formatCombo, actionById };
})();
