/**
 * Cấu hình tiện ích Coursera Auto Skipper
 * Dev by thanh duyvp
 */
(() => {
  const DEFAULTS = {
    autoStart: false,
    theme: "auto",
    videoSpeed: 16,
    videoMode: "batch", // 'batch' (API siêu tốc) | 'player' (Tua player 16x)
    peerMode: "highest", // 'highest' | 'last' | 'keep'
    peerComment: "Great work! Clear explanations, well structured and meets all requirements.",
    peerAutoSubmit: true,
    discussionComment: "Thank you for sharing! Very insightful and well presented.",
    discussionAutoSubmit: true,
    options: {
      video: true,
      reading: true,
      peer: true,
      discussion: true,
    },
  };

  const FEATURE_KEYS = Object.keys(DEFAULTS.options);
  const STORAGE_KEY = "skipperConfig";
  const worker = typeof document === "undefined";
  let queue = Promise.resolve();

  function serial(fn) {
    const result = queue.catch(() => {}).then(fn);
    queue = result;
    return result;
  }

  function mergeOptions(raw = {}) {
    return Object.fromEntries(
      FEATURE_KEYS.map((key) => [
        key,
        Object.hasOwn(raw || {}, key)
          ? raw[key] === true
          : DEFAULTS.options[key],
      ])
    );
  }

  function normalize(raw = {}) {
    return {
      autoStart: raw?.autoStart === true,
      theme: ["auto", "dark", "light"].includes(raw?.theme)
        ? raw.theme
        : DEFAULTS.theme,
      videoSpeed: [2, 4, 8, 16].includes(Number(raw?.videoSpeed))
        ? Number(raw.videoSpeed)
        : DEFAULTS.videoSpeed,
      videoMode: ["batch", "player"].includes(raw?.videoMode)
        ? raw.videoMode
        : DEFAULTS.videoMode,
      peerMode: ["highest", "last", "keep"].includes(raw?.peerMode)
        ? raw.peerMode
        : DEFAULTS.peerMode,
      peerComment:
        typeof raw?.peerComment === "string" && raw.peerComment.length <= 5000
          ? raw.peerComment
          : DEFAULTS.peerComment,
      peerAutoSubmit: raw?.peerAutoSubmit !== false,
      discussionComment:
        typeof raw?.discussionComment === "string" &&
        raw.discussionComment.length <= 5000
          ? raw.discussionComment
          : DEFAULTS.discussionComment,
      discussionAutoSubmit: raw?.discussionAutoSubmit !== false,
      options: mergeOptions(raw?.options),
    };
  }

  async function readLocal() {
    const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    return normalize(stored);
  }

  async function writeLocal(patch = {}) {
    return serial(async () => {
      const current = await readLocal();
      const next = normalize({
        ...current,
        ...patch,
        options: {
          ...current.options,
          ...(patch.options || {}),
        },
      });
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      return next;
    });
  }

  async function readAll() {
    if (worker) return readLocal();
    const result = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (!result?.ok) throw new Error(result?.error || "Không đọc được cài đặt");
    return normalize(result.settings);
  }

  async function writeAll(patch) {
    if (worker) return writeLocal(patch);
    const result = await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      settings: patch,
    });
    if (!result?.ok) throw new Error(result?.error || "Không lưu được cài đặt");
    return normalize(result.settings);
  }

  async function readOptions() {
    const all = await readAll();
    return all.options;
  }

  async function writeOptions(patch = {}) {
    if (worker) {
      const current = await readLocal();
      const updated = await writeLocal({
        options: { ...current.options, ...patch },
      });
      return updated.options;
    }
    const result = await chrome.runtime.sendMessage({
      type: "UPDATE_OPTIONS",
      patch,
    });
    if (!result?.ok) throw new Error(result?.error || "Không cập nhật được tùy chọn");
    return mergeOptions(result.options);
  }

  self.SkipperOptions = {
    DEFAULTS,
    FEATURE_KEYS,
    normalize,
    mergeOptions,
    readAll,
    writeAll,
    readOptions,
    writeOptions,
  };
})();
