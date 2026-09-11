/* Key capture rules. Exposes globalThis.TVSC_Keys */
(function () {
  'use strict';

  function isEditableTarget(t) {
    if (!t || !(t instanceof Element)) return false;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (t.isContentEditable) return true;
    if (t.closest && t.closest('[contenteditable="true"], [role="textbox"], [data-name="symbol-search-dialog"], [data-dialog-name*="search" i]')) return true;
    return false;
  }

  function isDialogOpen() {
    // If TradingView symbol search / dialogs with a focused input are open, suppress single-keys
    try {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return true;
      const dlg = document.querySelector('[data-name="symbol-search-dialog"], [role="dialog"] input:focus, [role="dialog"] textarea:focus');
      if (dlg) return true;
    } catch (_) {}
    return false;
  }

  function shouldHandle(e, combo) {
    if (!combo) return false;
    if (combo === 'escape' || combo === 'tab') return false;
    const hasMod = combo.includes('+');
    if (isEditableTarget(e.target) || isDialogOpen()) {
      // While typing: only allow explicit ctrl/meta combos, never bare single keys
      if (!hasMod) return false;
      if (!(combo.startsWith('ctrl+') || combo.startsWith('meta+'))) return false;
    }
    return true;
  }

  globalThis.TVSC_Keys = { isEditableTarget, isDialogOpen, shouldHandle };
})();
