/**
 * Log Bus: in-memory ring buffer, popup forwarder & listener dispatcher
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});

  const MAX_LINES = 200;
  const LEVELS = ["info", "success", "error", "warning"];

  let lines = [];
  const listeners = new Set();

  function now() {
    return new Date().toLocaleTimeString("vi-VN", { hour12: false });
  }

  function emit(entry) {
    listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (err) {
        /* a broken listener must never break automation */
      }
    });
  }

  function forwardToPopup(type, payload) {
    try {
      chrome.runtime.sendMessage(Object.assign({ type }, payload), () => {
        void chrome.runtime.lastError;
      });
    } catch (err) {
      /* popup is closed */
    }
  }

  function log(text, level) {
    const safeLevel = LEVELS.indexOf(level) === -1 ? "info" : level;
    const entry = { text, level: safeLevel, stamp: now() };
    lines.push(entry);
    if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
    emit(entry);
    forwardToPopup("LOG", entry);
    return entry;
  }

  function progress(percent, label) {
    const safe = Math.max(0, Math.min(100, Math.round(percent) || 0));
    forwardToPopup("PROGRESS", { percent: safe, label: label || "" });
  }

  function status(text, level) {
    forwardToPopup("STATUS", { text, level: level || "info" });
  }

  function history() {
    return lines.slice();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  ROOT.log = { log, progress, status, history, subscribe };
})();
