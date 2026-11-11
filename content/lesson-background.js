// One API batch for Reading/Video. No navigation, playback, or extra tab.
(() => {
  const ROOT = globalThis.Skipper;
  let active = null,
    course = "",
    items = [],
    confirmed = [];
  function sync(job) {
    course = job.course;
    items = job.items;
    confirmed = job.confirmed;
    ROOT.runner.updateProgress(ROOT.courseMap.harvest(), confirmed);
  }
  async function send(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok)
      throw new Error(
        response?.error || "Không kết nối được tác vụ Reading/Video.",
      );
    return response.job;
  }
  async function stop() {
    const task = active;
    if (!task) return;
    task.controller.abort();
    await send({ type: "LESSON_BG_CANCEL", id: task.id }).catch(() => {});
  }
  async function audit() {
    const response = await chrome.runtime.sendMessage({
      type: "LESSON_BG_AUDIT",
      course: ROOT.courseMap.courseSlug(),
    });
    if (!response?.ok)
      throw new Error(response?.error || "Không kiểm tra được tiến độ Coursera.");
    return response.audit;
  }
  async function start({ video, reading, lab, signal } = {}) {
    if (active) throw new Error("Reading/Video đang chạy.");
    const task = { id: crypto.randomUUID(), controller: new AbortController() };
    active = task;
    const abort = () => task.controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const context = { signal: task.controller.signal, path: location.pathname };
    ROOT.peerReview?.pauseAuto();
    try {
      ROOT.dom.assertActive(context);
      ROOT.log.log("Đang đọc danh sách và tiến độ Reading/Video/Lab từ Coursera…");
      let job = await send({
        type: "LESSON_BG_START",
        id: task.id,
        course: ROOT.courseMap.courseSlug(),
        options: {
          video: video === true,
          reading: reading === true,
          lab: lab === true,
        },
      });
      let last = "";
      while (true) {
        ROOT.dom.assertActive(context);
        sync(job);
        const text =
          `Reading/Video/Lab: ${job.completed}/${job.total} được Coursera xác nhận` +
          (job.current.length ? ` · ${job.current.join(" · ")}` : "");
        if (text !== last) {
          ROOT.log.log(text);
          last = text;
        }
        if (!job.running) break;
        await ROOT.dom.sleep(700, context);
        job = await send({ type: "LESSON_BG_STATUS", id: task.id });
      }
      for (const item of job.failed)
        ROOT.log.log(`${item.title}: ${item.error}`, "error");
      const message = `Reading/Video/Lab: ${job.completed}/${job.total} được Coursera xác nhận; ${job.locked} bài khóa; ${job.failed.length} bài chưa hoàn thành.`;
      ROOT.log.log(
        job.error || message,
        job.error || job.failed.length ? "error" : "success",
      );
      return {
        ok: !job.error && !job.failed.length,
        message: job.error || message,
      };
    } catch (error) {
      await send({ type: "LESSON_BG_CANCEL", id: task.id }).catch(() => {});
      const message =
        error.name === "AbortError" ? "Đã dừng Reading/Video." : error.message;
      ROOT.log.log(message, error.name === "AbortError" ? "info" : "error");
      return { ok: false, message };
    } finally {
      signal?.removeEventListener("abort", abort);
      if (active === task) active = null;
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
  ROOT.lessonBackground = {
    start,
    stop,
    audit,
    get running() {
      return !!active;
    },
    get items() {
      return course === ROOT.courseMap.courseSlug() ? items : [];
    },
    get confirmed() {
      return course === ROOT.courseMap.courseSlug() ? confirmed : [];
    },
  };
})();
