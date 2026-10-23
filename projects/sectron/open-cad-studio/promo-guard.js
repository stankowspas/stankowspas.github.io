"use strict";
// Block promotional external navigation, leaving local CAD operations intact.
(() => {
  const blocked = (url) => {
    try {
      const u = new URL(String(url), document.baseURI);
      if (!/^https?:$/.test(u.protocol) || u.origin === location.origin) return false;
      return /(^|\.)(patreon\.com|paypal\.com|ko-fi\.com|youtube\.com|youtu\.be|reddit\.com|open-aec\.com)$/.test(u.hostname)
        || (u.hostname === "github.com" && /\/(sponsors|HakanSeven12\/OpenCADStudio\/(discussions|releases))\b/i.test(u.pathname));
    } catch { return false; }
  };
  const originalOpen = window.open.bind(window);
  window.open = function(url, ...args) {
    if (blocked(url)) { console.info("Promotional navigation blocked"); return null; }
    return originalOpen(url, ...args);
  };
  document.addEventListener("click", e => {
    const link = e.target?.closest?.("a[href]");
    if (link && blocked(link.href)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
})();
