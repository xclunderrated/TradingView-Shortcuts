/* Popup editor: render catalog, record keys, conflict check, persist to chrome.storage.sync */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const groupsEl = $('#groups'), searchEl = $('#search'), conflictEl = $('#conflict'),
        enabledEl = $('#enabled'), toastEl = $('#showToast'), statusEl = $('#status'),
        recBar = $('#recordingBar');

  let bindings = {};       // actionId -> combo
  let recordingFor = null; // actionId
  let enabled = true, showToast = true;

  const norm = (c) => (c || '').toLowerCase();

  async function load() {
    const d = TVSC.DEFAULT_BINDINGS, s = TVSC.DEFAULT_SETTINGS;
    const got = await chrome.storage.sync.get({ enabled: s.enabled, showToast: s.showToast, bindings: d });
    enabled = got.enabled !== false;
    showToast = got.showToast !== false;
    bindings = Object.assign({}, d, got.bindings || {});
    enabledEl.checked = enabled;
    toastEl.checked = showToast;
    render();
    setStatus(Object.keys(bindings).filter(k => bindings[k]).length + ' binds active');
  }

  async function save() {
    await chrome.storage.sync.set({ enabled, showToast, bindings });
    setStatus('Saved ✓  ' + new Date().toLocaleTimeString());
  }

  function setStatus(t) { statusEl.textContent = t; }

  function duplicates() {
    const seen = new Map(), dups = new Set();
    for (const [id, combo] of Object.entries(bindings)) {
      if (!combo) continue;
      const k = norm(combo);
      if (seen.has(k)) { dups.add(k); } else seen.set(k, id);
    }
    return dups;
  }

  function render() {
    const q = (searchEl.value || '').toLowerCase().trim();
    const dups = duplicates();
    groupsEl.innerHTML = '';

    if (dups.size) {
      conflictEl.classList.remove('hidden');
      conflictEl.textContent = '⚠ Duplicate bind: ' + Array.from(dups).map(c => TVSC.formatCombo(c)).join(', ');
    } else conflictEl.classList.add('hidden');

    for (const g of TVSC.GROUPS) {
      const actions = TVSC.ACTIONS.filter(a => a.group === g.id)
        .filter(a => !q || a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
      if (!actions.length) continue;
      const gl = document.createElement('div');
      gl.className = 'glabel';
      const bound = actions.filter(a => bindings[a.id]).length;
      gl.innerHTML = '<span></span><span class="count"></span>';
      gl.firstChild.textContent = g.label;
      gl.lastChild.textContent = bound + '/' + actions.length;
      groupsEl.appendChild(gl);

      for (const a of actions) {
        const combo = bindings[a.id] || '';
        const isDup = combo && dups.has(norm(combo));
        const row = document.createElement('div');
        row.className = 'row' + (isDup ? ' dup' : '');
        row.dataset.action = a.id;

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = a.label;
        name.title = a.id;
        row.appendChild(name);

        const pill = document.createElement('div');
        pill.className = 'pill' + (combo ? '' : ' empty');
        pill.textContent = combo ? TVSC.formatCombo(combo) : '—';
        row.appendChild(pill);

        const rec = document.createElement('button');
        rec.className = 'ibtn' + (recordingFor === a.id ? ' rec' : '');
        rec.textContent = recordingFor === a.id ? '…' : 'Bind';
        rec.title = 'Click then press keys (e.g. A, or Ctrl+Shift+R)';
        rec.addEventListener('click', () => startRecording(a.id));
        row.appendChild(rec);

        const clr = document.createElement('button');
        clr.className = 'ibtn clear';
        clr.textContent = '✕';
        clr.title = 'Clear bind';
        clr.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          cancelRecording();
          bindings[a.id] = '';
          await save(); render();
        });
        row.appendChild(clr);
        groupsEl.appendChild(row);
      }
    }
    if (!groupsEl.children.length) {
      groupsEl.innerHTML = '<div class="status">No actions match.</div>';
    }
  }

  function startRecording(actionId) {
    recordingFor = actionId;
    try { document.activeElement && document.activeElement.blur(); } catch (_) {}
    recBar.classList.remove('hidden');
    render();
    setStatus('Press keys for: ' + (TVSC.actionById(actionId) || {}).label + ' …');
  }
  function cancelRecording() { recordingFor = null; recBar.classList.add('hidden'); }

  document.addEventListener('keydown', async (e) => {
    if (!recordingFor) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { cancelRecording(); render(); setStatus('Cancelled'); return; }
    if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return;
    const combo = TVSC.normalizeComboFromEvent(e);
    if (!combo || combo === 'escape' || combo === 'tab') return;
    bindings[recordingFor] = combo;
    const done = recordingFor;
    cancelRecording();
    await save(); render();
    setStatus('Bound ' + (TVSC.actionById(done) || {}).label + ' → ' + TVSC.formatCombo(combo));
  }, true);

  searchEl.addEventListener('input', render);
  enabledEl.addEventListener('change', async () => { enabled = enabledEl.checked; await save(); });
  toastEl.addEventListener('change', async () => { showToast = toastEl.checked; await save(); });

  $('#reset').addEventListener('click', async () => {
    if (!confirm('Reset all binds to defaults?')) return;
    bindings = Object.assign({}, TVSC.DEFAULT_BINDINGS);
    enabled = true; showToast = true;
    enabledEl.checked = true; toastEl.checked = true;
    cancelRecording(); await save(); render();
  });
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: 1, enabled, showToast, bindings }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tv-shortcuts.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.bindings && typeof data.bindings === 'object') {
        // keep only known action ids, normalize combos
        const clean = {};
        for (const a of TVSC.ACTIONS) {
          if (typeof data.bindings[a.id] === 'string') clean[a.id] = data.bindings[a.id].toLowerCase();
        }
        bindings = Object.assign({}, TVSC.DEFAULT_BINDINGS, clean);
        if (typeof data.enabled === 'boolean') { enabled = data.enabled; enabledEl.checked = enabled; }
        if (typeof data.showToast === 'boolean') { showToast = data.showToast; toastEl.checked = showToast; }
        await save(); render(); setStatus('Imported ✓');
      } else setStatus('Invalid file');
    } catch (_) { setStatus('Import failed'); }
    e.target.value = '';
  });

  load();
})();
