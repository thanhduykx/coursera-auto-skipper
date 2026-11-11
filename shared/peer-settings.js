/**
 * Peer Review Settings
 * Dev by thanh duyvp
 */
(() => {
  const defaults = {
    enabled: true,
    autoSubmit: true,
    scanCourse: true,
    mode: "highest",
    comment: "Great work! Clear explanations, well structured and meets all requirements.",
    revision: 0,
  };
  const modes = ["highest", "last", "keep"];
  const worker = typeof document === "undefined";
  let queue = Promise.resolve();

  function normalize(raw = {}) {
    return {
      enabled: raw?.enabled !== false,
      autoSubmit: raw?.autoSubmit !== false,
      scanCourse: raw?.scanCourse !== false,
      mode: modes.includes(raw?.mode) ? raw.mode : "highest",
      comment:
        typeof raw?.comment === "string" ? raw.comment.slice(0, 10000) : defaults.comment,
      revision:
        Number.isSafeInteger(raw?.revision) && raw.revision >= 0
          ? raw.revision
          : 0,
    };
  }

  async function send(type, settings) {
    const result = await chrome.runtime.sendMessage({ type, settings });
    if (!result?.ok)
      throw new Error(result?.error || "Không đọc được cấu hình Peer Review");
    return result.settings;
  }

  async function read() {
    if (!worker) return send("GET_PEER_SETTINGS");
    const stored = (await chrome.storage.local.get("peerReview")).peerReview;
    return normalize(stored);
  }

  async function write(patch) {
    if (!worker) return send("SAVE_PEER_SETTINGS", patch);
    if (
      !patch ||
      typeof patch !== "object" ||
      Array.isArray(patch) ||
      (Object.hasOwn(patch, "enabled") && typeof patch.enabled !== "boolean") ||
      (Object.hasOwn(patch, "scanCourse") &&
        typeof patch.scanCourse !== "boolean") ||
      (Object.hasOwn(patch, "autoSubmit") &&
        typeof patch.autoSubmit !== "boolean") ||
      (Object.hasOwn(patch, "mode") && !modes.includes(patch.mode)) ||
      (Object.hasOwn(patch, "comment") &&
        (typeof patch.comment !== "string" || patch.comment.length > 10000))
    )
      throw new Error("Cấu hình Peer Review không hợp lệ");
    const task = queue
      .catch(() => {})
      .then(async () => {
        const current = await read();
        const next = normalize({
          ...current,
          ...patch,
          revision: Math.max(Date.now(), current.revision + 1),
        });
        await chrome.storage.local.set({ peerReview: next });
        return next;
      });
    queue = task;
    return task;
  }

  globalThis.SkipperPeerSettings = { defaults, normalize, read, write };
})();
