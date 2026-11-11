/**
 * Run State Manager
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const schema = globalThis.SkipperOptions;
  const EMPTY = {
    running: false,
    items: [],
    index: -1,
    done: [],
    visited: [],
    startedAt: 0,
    updatedAt: 0,
    courseSlug: "",
    runId: "",
  };

  function mergeRun(raw = {}) {
    return {
      ...EMPTY,
      ...raw,
      items: Array.isArray(raw.items) ? raw.items : [],
      done: Array.isArray(raw.done) ? raw.done : [],
      visited: Array.isArray(raw.visited) ? raw.visited : [],
    };
  }

  async function request(type, patch) {
    const response = await chrome.runtime.sendMessage({
      type,
      patch,
      courseSlug: ROOT.courseMap?.courseSlug() || "",
    });
    if (!response?.ok)
      throw new Error(response?.error || "Không đọc được trạng thái chạy");
    return mergeRun(response.run);
  }

  ROOT.state = {
    DEFAULT_OPTIONS: schema.DEFAULTS.options,
    getOptions: schema.readAll,
    saveOptions: schema.writeOptions,
    getRun: () => request("RUN_GET"),
    saveRun: (patch) => request("RUN_SAVE", patch),
    resetRun: () => request("RUN_RESET"),
    markDone: (run, key) => [...new Set([...run.done, key])],
  };
})();
