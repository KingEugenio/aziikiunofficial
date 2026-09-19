// Boot watchdog: if the app never draws anything (a script failed to load, a
// stale cached bundle, a crash before React mounted), the page used to stay a
// blank white screen with no explanation. This shows a plain message with a
// reload button instead. Lives in its own file (not inline in index.html)
// because the production Content-Security-Policy only allows scripts from
// this origin.
(function () {
  var shown = false;

  function rootIsEmpty() {
    var root = document.getElementById("root");
    return !root || root.childElementCount === 0;
  }

  function show() {
    if (shown || !rootIsEmpty()) return;
    shown = true;
    var root = document.getElementById("root") || document.body;

    var wrap = document.createElement("div");
    wrap.style.cssText =
      "font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#0f172a;padding:24px;text-align:center";
    var box = document.createElement("div");
    box.style.maxWidth = "420px";

    var h = document.createElement("h2");
    h.textContent = "Aziiki didn't finish loading";
    h.style.margin = "0 0 8px";
    var p = document.createElement("p");
    p.textContent =
      "This is usually a slow connection or an out-of-date saved copy of the app. Reloading normally fixes it. If it keeps happening, use 'Clear saved data & reload' - your account and cloud data are not affected.";
    p.style.cssText = "color:#475569;line-height:1.5;margin:0 0 16px";

    var reload = document.createElement("button");
    reload.textContent = "Reload";
    reload.style.cssText =
      "padding:10px 18px;background:#059669;color:#fff;border:0;border-radius:10px;font-weight:600;cursor:pointer;margin-right:8px";
    reload.onclick = function () {
      location.reload();
    };

    var clear = document.createElement("button");
    clear.textContent = "Clear saved data & reload";
    clear.style.cssText =
      "padding:10px 18px;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:10px;font-weight:600;cursor:pointer";
    clear.onclick = function () {
      try {
        // Only this browser's cached copies (the sign-in itself lives in
        // localStorage and is left alone) - cloud data lives on the server.
        sessionStorage.clear();
        if (window.indexedDB && indexedDB.deleteDatabase) indexedDB.deleteDatabase("aziiki-offline");
        if (window.caches && caches.keys) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
        }
      } catch (e) {}
      setTimeout(function () { location.reload(); }, 300);
    };

    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(reload);
    box.appendChild(clear);
    wrap.appendChild(box);
    root.appendChild(wrap);
  }

  // A hard script error before mount: check shortly after.
  window.addEventListener("error", function () {
    setTimeout(show, 1500);
  });
  window.addEventListener("unhandledrejection", function () {
    setTimeout(show, 1500);
  });
  // Nothing drawn at all after a generous wait (slow network / dead server).
  setTimeout(show, 12000);
})();
