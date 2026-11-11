// Parent-tab controller. The background worker owns and closes its media tab.
(() => {
  const ROOT = globalThis.Skipper;
  const confirmed = new Set();
  function sync(job) {
    const before = confirmed.size;
    for (const key of job.confirmed) confirmed.add(key);
    if (confirmed.size !== before)
      ROOT.runner.updateProgress(ROOT.courseMap.harvest(), [...confirmed]);
  }
  let running = false,
    controller = null,
    jobId = "";
  function report(message, level = "info") {
    ROOT.log.log(message, level);
  }
  async function request(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok)
      throw new Error(result?.error || "Không kết nối được tác vụ video nền.");
    return result.job;
  }
  async function stop() {
    if (!running) return;
    controller?.abort();
    await request({ type: "VIDEO_BG_CANCEL" }).catch(() => {});
  }
  async function start({ integrated = false, signal } = {}) {
    if (
      running ||
      (!integrated && document.getElementById("sp-start")?.disabled)
    )
      throw new Error("Hãy dừng tác vụ hiện tại trước.");
    const course = ROOT.courseMap.courseSlug();
    if (!course) throw new Error("Hãy mở khóa học Coursera.");
    const path = location.pathname;
    controller = new AbortController();
    const abort = () => controller?.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const context = { signal: controller.signal, path };
    running = true;
    ROOT.peerReview.pauseAuto();
    if (!integrated) ROOT.panel.setRunning(true);
    try {
      report("Đang tìm video chưa hoàn thành trong mục lục…");
      await ROOT.courseMap.expandAllGroups(context);
      await ROOT.courseMap.expandAllGroups(context);
      ROOT.dom.assertActive(context);
      const done = new Set([...ROOT.courseMap.completedKeys(), ...confirmed]);
      const items = ROOT.courseMap
        .harvest()
        .filter((item) => item.kind === "video" && !done.has(item.key))
        .map(({ url, key, title }) => ({ url, key, title }));
      if (!items.length) {
        report("Không tìm thấy video chưa hoàn thành trong mục lục đã tải.");
        return true;
      }
      let job = await request({ type: "VIDEO_BG_START", course, items });
      jobId = job.id;
      let last = "";
      while (job.running) {
        ROOT.dom.assertActive(context);
        const message =
          `Video nền: ${job.confirmed.length}/${job.total} đã xác nhận` +
          (job.current ? ` · ${job.current}` : "");
        if (message !== last) {
          report(message);
          last = message;
        }
        await ROOT.dom.sleep(1000, context);
        job = await request({ type: "VIDEO_BG_STATUS", id: jobId });
        sync(job);
      }
      ROOT.dom.assertActive(context);
      for (const item of job.failed)
        report(`${item.title}: ${item.error}`, "error");
      report(
        `Video nền đã dừng: ${job.confirmed.length}/${job.total} được xác nhận sau tải lại; ${job.failed.length} chưa hoàn thành.` +
          (job.error ? ` ${job.error}` : ""),
        job.error || job.failed.length ? "error" : "success",
      );
      return !job.error && !job.failed.length;
    } catch (error) {
      await request({ type: "VIDEO_BG_CANCEL" }).catch(() => {});
      report(
        error.name === "AbortError" ? "Đã dừng video nền." : error.message,
        error.name === "AbortError" ? "info" : "error",
      );
      return false;
    } finally {
      running = false;
      jobId = "";
      controller = null;
      signal?.removeEventListener("abort", abort);
      if (!integrated) ROOT.panel.setRunning(false);
    }
  }
  const leave = () => {
    stop().catch(() => {});
  };
  window.addEventListener("pagehide", leave);
  ROOT.instance.addCleanup(() => {
    leave();
    window.removeEventListener("pagehide", leave);
  });
  ROOT.videoBackground = {
    start,
    stop,
    get confirmed() {
      return [...confirmed];
    },
    get running() {
      return running;
    },
  };
})();
