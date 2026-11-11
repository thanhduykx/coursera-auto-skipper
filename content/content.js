/**
 * Content Script Entrypoint
 * Coursera Auto Skipper - Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const { dom, log, state, panel, runner, courseMap } = ROOT;

  const PANEL_ID = "skipper-auto-panel";
  const MOUNT_DELAY = 1000;
  let mounted = false;

  function safeItems() {
    try {
      return courseMap.harvest();
    } catch {
      return [];
    }
  }

  function watchPanel() {
    const observer = new MutationObserver(() => {
      if (ROOT.instance?.signal.aborted) return;
      if (!document.getElementById(PANEL_ID) && mounted) {
        mounted = false;
        panel
          .mount()
          .then(() => {
            mounted = true;
          })
          .catch(() => {});
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    ROOT.instance?.addCleanup(() => {
      mounted = false;
      observer.disconnect();
    });
  }

  async function maybeAutoStart() {
    const schema = globalThis.SkipperOptions;
    if (!schema) return;
    try {
      const settings = await schema.readAll();
      if (!settings.autoStart) return;
      if (!courseMap.parse(courseMap.currentPath())) return;
      log.log("Khởi động tự động theo cài đặt...", "info");
      await runner.start(settings.options);
    } catch {}
  }

  async function init() {
    if (
      !(
        window.location.hostname === "coursera.org" ||
        window.location.hostname.endsWith(".coursera.org")
      )
    )
      return;
    if (mounted) return;

    await dom.waitFor(() => document.body, { timeout: 15000 });
    await panel.mount();
    mounted = true;
    watchPanel();

    panel.setStatus("Sẵn sàng", "idle");

    let lastProgress = "";
    const progressWatch = setInterval(() => {
      if (!document.getElementById(PANEL_ID)) return;
      const items = safeItems();
      const done = [
        ...courseMap.completedKeys(),
        ...(ROOT.videoBackground?.confirmed || []),
        ...(ROOT.lessonBackground?.confirmed || []),
      ];
      const signature = JSON.stringify([
        location.pathname,
        items.map((item) => item.key),
        done,
      ]);
      if (signature !== lastProgress) {
        lastProgress = signature;
        state
          .getRun()
          .then((run) => {
            if (!ROOT.instance.signal.aborted)
              panel.setProgress(runner.progressPercent(safeItems(), run.done));
          })
          .catch(() => {});
      }
    }, 900);
    ROOT.instance.addCleanup(() => clearInterval(progressWatch));

    const resumed = await runner.resume();
    if (!resumed) {
      const run = await state.getRun();
      runner.updateProgress(safeItems(), run.done);
      await maybeAutoStart();
    }
  }

  const onMessage = (message, sender, sendResponse) => {
    if (!message || !message.action) return undefined;
    if (ROOT.instance.backgroundWorker && message.action !== "PING")
      return undefined;

    if (message.action === "START") {
      runner
        .start(message.options || {})
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message.action === "STOP") {
      runner
        .stop()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message.action === "GET_LOG") {
      sendResponse({ ok: true, lines: log.history() });
      return true;
    }

    if (message.action === "GET_STATE") {
      state
        .getRun()
        .then((run) => {
          let percent = 0;
          try {
            percent = runner.progressPercent(courseMap.harvest(), run.done);
          } catch {
            percent = 0;
          }
          sendResponse({
            ok: true,
            running: run.running,
            done: run.done.length,
            percent,
          });
        })
        .catch(() => {
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.action === "PING") {
      sendResponse({
        ok: true,
        version: chrome.runtime.getManifest().version,
        title: "Coursera Auto Skipper",
      });
      return false;
    }

    return undefined;
  };

  chrome.runtime.onMessage.addListener(onMessage);
  ROOT.instance?.addCleanup(() =>
    chrome.runtime.onMessage.removeListener(onMessage),
  );

  async function scheduleInit() {
    try {
      if (await ROOT.instance.role) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      init().catch((err) => {
        log.log("Khởi tạo lỗi: " + err.message, "error");
      });
    }, MOUNT_DELAY);
    ROOT.instance?.addCleanup(() => clearTimeout(timer));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInit);
    ROOT.instance?.addCleanup(() =>
      document.removeEventListener("DOMContentLoaded", scheduleInit),
    );
  } else {
    scheduleInit();
  }
})();
