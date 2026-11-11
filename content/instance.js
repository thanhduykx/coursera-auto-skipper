/**
 * Instance Lifecycle Controller
 * Dev by thanh duyvp
 */
(() => {
  globalThis.Skipper?.instance?.dispose();
  const controller = new AbortController();
  const cleanups = new Set();

  globalThis.Skipper = {
    instance: {
      signal: controller.signal,
      addCleanup(fn) {
        cleanups.add(fn);
      },
      dispose() {
        controller.abort();
        for (const fn of cleanups) {
          try {
            fn();
          } catch {
            /* finish other cleanup */
          }
        }
        cleanups.clear();
      },
    },
  };

  const instance = globalThis.Skipper.instance;
  instance.role = chrome.runtime
    .sendMessage({ type: "GET_TAB_ROLE" })
    .then((result) => {
      if (!result?.ok) throw new Error("Không xác định được vai trò tab.");
      instance.backgroundWorker = result.backgroundWorker === true;
      return instance.backgroundWorker;
    })
    .catch(() => {
      instance.backgroundWorker = false;
      return false;
    });
})();
