/**
 * Automation Runner: orchestrates reading, video, peer review, and discussion
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const {
    dom,
    log,
    state,
    courseMap,
    video,
    reading,
    discussion,
    panel,
  } = ROOT;
  let token = 0,
    controller = null,
    activeRunId = "",
    starting = false,
    activeContext = null;
  function cancelLocal() {
    token++;
    controller?.abort();
    controller = null;
    activeContext = null;
  }
  const navigationWatch = setInterval(() => {
    if (
      activeContext &&
      !activeContext.allowNavigation &&
      activeContext.path &&
      activeContext.path !== location.pathname
    ) {
      activeContext = null;
      finish("Đã dừng vì bạn chuyển bài.").catch((error) =>
        log.log(error.message, "error"),
      );
    }
  }, 200);
  ROOT.instance?.addCleanup(cancelLocal);
  ROOT.instance?.addCleanup(() => clearInterval(navigationWatch));
  function progressPercent(items, doneKeys = []) {
    if (ROOT.lessonBackground?.items.length)
      items = ROOT.lessonBackground.items;
    if (!items.length) return 0;
    const verified = new Set([
      ...doneKeys,
      ...courseMap.completedKeys(),
      ...(ROOT.videoBackground?.confirmed || []),
      ...(ROOT.lessonBackground?.confirmed || []),
    ]);
    return (
      (100 * items.filter((item) => verified.has(item.key)).length) /
      items.length
    );
  }
  function updateProgress(items, done) {
    const percent = progressPercent(items, done);
    panel.setProgress(percent);
    log.progress(percent);
  }
  async function stop(message = "Đã dừng", { pausePeer = true } = {}) {
    if (pausePeer) ROOT.peerReview?.pauseAuto();
    cancelLocal();
    await ROOT.videoBackground?.stop?.();
    await ROOT.lessonBackground?.stop?.();
    if (!starting) panel.setRunning(false);
    log.status("Đã dừng", "info");
    await state.saveRun({ running: false, runId: activeRunId });
    log.log(message, "info");
  }
  function finish(message) {
    return stop(message, { pausePeer: false });
  }
  function contextFor(myToken, path) {
    return {
      signal: controller.signal,
      path,
      assertActive() {
        if (myToken !== token)
          throw new DOMException("Tác vụ đã dừng", "AbortError");
      },
    };
  }
  function optionForKind(kind, options) {
    if (!options) return false;
    const opts = options.options || options;
    if (kind === "peer") return opts.peer === true;
    if (
      kind === "programming" ||
      kind === "widget" ||
      kind === "lab"
    )
      return opts.lab === true;
    return opts[kind] === true;
  }
  async function processPeer(options, context = {}, item = {}) {
    if (!options.peer) return { status: "skipped" };
    if (!ROOT.peerTracker || !ROOT.peerReview)
      return { status: "review", message: "Peer Review chưa sẵn sàng." };
    const ownPage =
      /\/peer\//.test(location.pathname) &&
      !/(give-feedback|review-next)/.test(location.pathname);
    const reviewPage = /(give-feedback|review-next)/.test(location.pathname);
    const blocked =
      reviewPage &&
      /submit your (?:project|assignment) before reviewing|nộp (?:bài|dự án).{0,30}trước khi/i.test(
        (document.querySelector("#main-container,main,[role='main']") || document.body)
          .innerText,
      );
    if ((ownPage || blocked) && ROOT.peerAssign) {
      const courseSlug = courseMap.courseSlug();
      if (blocked) {
        const submitPath = location.pathname.replace(
          /\/(give-feedback|review-next)\/?$/,
          "/submit",
        );
        const link = [...document.querySelectorAll('a[href*="/submit"]')].find(
          (node) => node.pathname === submitPath,
        );
        if (link) dom.click(link);
        else location.assign(submitPath);
        const atSubmit = await dom.waitFor(
          () => /\/submit\/?$/.test(location.pathname),
          { ...context, timeout: 15000 },
        );
        if (!atSubmit)
          return {
            status: "review",
            message: "Chưa mở được trang nộp project.",
          };
        await dom.sleep(400, context);
      }
      const own = await ROOT.peerAssign.submitOwnAssignment(
        options,
        context,
      );
      if (own.status !== "processed") return own;
      const base = location.pathname
        .replace(/\/+$/, "")
        .replace(/\/(submit|peer-review)$/, "");
      const reviewPath = base + "/give-feedback";
      if (!/give-feedback/.test(location.pathname)) {
        const anchor = [
          ...document.querySelectorAll('a[href*="give-feedback"]'),
        ].find((node) => {
          try {
            const url = new URL(node.href);
            return (
              url.origin === location.origin &&
              url.pathname.includes(courseSlug) &&
              (!item.id || url.pathname.includes(item.id))
            );
          } catch {
            return false;
          }
        });
        if (anchor) dom.click(anchor);
        else location.assign(reviewPath);
        const arrived = await dom.waitFor(
          () => /give-feedback/.test(location.pathname),
          { ...context, timeout: 15000 },
        );
        if (!arrived)
          return {
            status: "review",
            message:
              "Đã nộp project nhưng chưa mở được trang chấm bài; hãy mở Review Your Peers.",
          };
        await dom.sleep(500, context);
      }
    }
    const settings = await globalThis.SkipperPeerSettings.read();
    if (!settings.enabled)
      return {
        status: "review",
        message:
          "Peer Review tự động đang tắt; bật trong tab Peer Review rồi chạy lại.",
      };
    let last = null;
    for (let round = 0; round < 102; round += 1) {
      dom.assertActive(context);
      const before = await ROOT.peerTracker.refresh();
      dom.assertActive(context);
      if (before?.remaining === 0) return { status: "processed" };
      last = await ROOT.peerReview.process(context);
      dom.assertActive(context);
      if (last.status === "failed") return last;
      const after = await ROOT.peerTracker.refresh();
      if (after?.remaining === 0) return { status: "processed" };
      if (
        Number.isInteger(before?.remaining) &&
        Number.isInteger(after?.remaining) &&
        after.remaining < before.remaining
      )
        continue;
      if (last.status === "skipped") {
        await dom.sleep(700, context);
        continue;
      }
      return last;
    }
    return {
      status: "review",
      message: "Chưa xác nhận đủ số lượt Peer Review của bài này.",
    };
  }
  async function processItem(item, options, context = {}) {
    dom.assertActive?.(context);
    const opts = options?.options || options || {};
    if (!optionForKind(item.kind, opts)) return { status: "skipped" };
    if (item.kind === "peer") return processPeer(opts, context, item);
    const allSettings = await globalThis.SkipperOptions?.readAll().catch(() => null);
    const isPlayerVideo = allSettings?.videoMode === "player";
    if (
      ROOT.lessonBackground &&
      ["reading", "video", "lab"].includes(item.kind)
    ) {
      if (item.kind === "video" && isPlayerVideo) {
        return {
          status: (await video.skipVideos(context)) ? "processed" : "failed",
        };
      }
      return {
        status: ROOT.lessonBackground.confirmed.includes(item.key)
          ? "processed"
          : "failed",
      };
    }
    switch (item.kind) {
      case "video":
        if (ROOT.videoBackground && !isPlayerVideo)
          return {
            status: ROOT.videoBackground.confirmed.includes(item.key)
              ? "processed"
              : "failed",
          };
        return {
          status: (await video.skipVideos(context)) ? "processed" : "failed",
        };
      case "reading": {
        const completed = await reading.completeReading(context);
        if (!completed && /survey|khảo sát/i.test(item.title || item.url || ""))
          return {
            status: "review",
            message:
              "Khảo sát này cần bạn thao tác trên trang. Chưa được tính là hoàn thành.",
          };
        return { status: completed ? "processed" : "failed" };
      }
      case "quiz":
        log.log(`Bỏ qua ${item.title || "Quiz"}: Tiện ích tập trung hoàn thành Video, Reading, Peer Review và Thảo Luận.`, "info");
        return { status: "skipped" };
      case "programming":
      case "widget":
      case "lab":
        if (ROOT.lab) {
          const done = await ROOT.lab.completeLab(context);
          if (done) return { status: "processed" };
          return {
            status: "review",
            message:
              "Lab/lập trình cần thao tác trên công cụ ngoài; chưa được tính hoàn thành.",
          };
        }
        return { status: "skipped" };
      case "discussion":
        return discussion.processDiscussion(context);
      default:
        return { status: "skipped" };
    }
  }
  async function loadItems(context = {}) {
    await courseMap.expandAllGroups(context);
    return courseMap.harvest();
  }
  async function loop(myToken, initialPath = location.pathname) {
    const course = courseMap.courseSlug();
    let expectedPath = initialPath;
    let navigating = false;
    let lastSubmitted = "";
    const tally = new Map();
    const retries = new Map();
    const retryCounts = new Map();
    let retryRuns = 0;
    const check = () => {
      if (myToken !== token || controller?.signal.aborted)
        throw new DOMException("Đã dừng", "AbortError");
      if (courseMap.courseSlug() !== course)
        throw new DOMException("Đã chuyển khóa học", "AbortError");
      if (!navigating && location.pathname !== expectedPath)
        throw new DOMException("Đã chuyển bài thủ công", "AbortError");
    };
    const navFor = () => ({ signal: controller.signal, assertActive: check });
    check();
    if (!courseMap.isItemPage())
      throw new Error("Hãy mở một bài học trước khi bắt đầu");    let items = await loadItems({
      signal: controller.signal,
      assertActive: check,
    });
    check();
    if (initialPath !== location.pathname)
      throw new DOMException("Đã chuyển bài khi khởi động", "AbortError");
    let singleItemMode = false;
    if (courseMap.isItemPage() && items.length <= 1) {
      singleItemMode = true;
      items = [courseMap.currentItem()];
    }
    if (!items.length) throw new Error("Không tìm thấy danh sách bài học");
    while (true) {
      check();
      const run = await state.getRun();
      check();
      if (!run.running || run.runId !== activeRunId) return;
      const options = await state.getOptions();
      check();
      if (singleItemMode) {
        items = [courseMap.currentItem()];
      } else {
        const harvested = courseMap.harvest();
        if (harvested.length > 1) {
          items = harvested;
        } else if (courseMap.isItemPage()) {
          singleItemMode = true;
          items = [courseMap.currentItem()];
        } else {
          items = harvested;
        }
      }
      const index = courseMap.indexOfCurrent(items);
      if (index < 0)
        throw new Error("Bài hiện tại không thuộc danh sách khóa học");
      const item = items[index],
        context = contextFor(myToken, location.pathname);
      // Peer Review navigates inside the same assignment, so its context must
      // not pin one pathname.
      const peerContext = {
        signal: controller.signal,
        path: undefined,
        assertActive() {
          if (myToken !== token || controller?.signal.aborted)
            throw new DOMException("Tác vụ đã dừng", "AbortError");
          if (courseMap.courseSlug() !== course)
            throw new DOMException("Đã chuyển khóa học", "AbortError");
        },
      };
      const attemptPath =
        location.pathname.replace(/\/+$/, "").replace(/\/attempt$/, "") +
        "/attempt";
      context.acceptQuizNavigation = (path) => {
        if (
          item.kind !== "quiz" ||
          path !== attemptPath ||
          location.pathname.replace(/\/+$/, "") !== path
        )
          throw new DOMException(
            "Chuyển trang quiz không hợp lệ",
            "AbortError",
          );
        expectedPath = location.pathname;
      };
      activeContext = item.kind === "peer" ? peerContext : context;
      log.log(
        `Bài ${index + 1}/${items.length} · ${courseMap.kindLabel(item.kind)} · ${item.title}`,
      );
      let result;
      const alreadyDone = [
        ...courseMap.completedKeys(),
        ...(ROOT.videoBackground?.confirmed || []),
        ...(ROOT.lessonBackground?.confirmed || []),
      ].includes(item.key);
      if (alreadyDone) result = { status: "processed" };
      else {
        try {
          result = await processItem(
            item,
            options,
            item.kind === "peer" ? peerContext : context,
          );
        } catch (error) {
          if (error.name === "AbortError") throw error;
          result = { status: "failed", message: error.message };
        }
      }
      activeContext = null;
      // A Peer Review step may have moved within the assignment.
      expectedPath = location.pathname;
      check();
      dom.assertActive({ ...context, path: undefined });
      if (!result || result === false) result = { status: "failed" };
      const record = {
        title: String(item.title || item.id),
        kind: item.kind,
        status: result.status,
        message: result.message || "",
      };
      if (result.status === "failed")
        tally.set(item.key, { ...record, status: "failed" });
      else if (result.status === "review")
        tally.set(item.key, { ...record, status: "review" });
      else if (result.status === "retry") {
        const count = (retryCounts.get(item.key) || 0) + 1;
        retryCounts.set(item.key, count);
        if (count >= 3)
          tally.set(item.key, {
            ...record,
            status: "review",
            message:
              (result.message || "Lỗi tạm thời") +
              " Đã thử lại 3 lần nhưng chưa xong.",
          });
        else {
          retries.set(item.key, item);
          tally.set(item.key, { ...record, status: "retry" });
        }
      } else if (result.status === "skipped")
        tally.set(item.key, { ...record, status: "skipped" });
      else tally.delete(item.key);
      if (result.status === "failed")
        log.log(
          `Chưa xác nhận ${record.title}: ${result.message || "thao tác thất bại"}`,
          "error",
        );
      else if (result.status === "review")
        log.log(
          `${record.title}: ${result.message || "cần kiểm tra trên trang"}`,
          "info",
        );
      else if (result.status === "retry")
        log.log(
          `${record.title}: ${result.message || "lỗi tạm thời"}`,
          "info",
        );
      const completed = [
        ...courseMap.completedKeys(),
        ...(ROOT.videoBackground?.confirmed || []),
        ...(ROOT.lessonBackground?.confirmed || []),
      ].includes(item.key);
      const isDone =
        completed ||
        result.status === "submitted" ||
        result.status === "processed";
      let updatedDone = isDone ? state.markDone(run, item.key) : run.done;
      let targetIndex = index;
      if (singleItemMode && run.items?.length) {
        const matchIdx = run.items.findIndex(
          (k) => k === item.key || k.endsWith(":" + item.id),
        );
        if (matchIdx >= 0) {
          targetIndex = matchIdx;
          if (isDone) {
            updatedDone = state.markDone(
              { done: updatedDone },
              run.items[matchIdx],
            );
          }
        } else {
          targetIndex = run.index >= 0 ? run.index : index;
        }
      }
      const saved = await state.saveRun({
        runId: activeRunId,
        items:
          singleItemMode && run.items?.length
            ? run.items
            : items.map((e) => e.key),
        index: targetIndex,
        done: updatedDone,
        visited: [...new Set([...run.visited, item.key])],
      });
      check();
      updateProgress(
        singleItemMode && run.items?.length
          ? run.items.map((k) => ({ key: k }))
          : items,
        saved.done,
      );
      if (result.status === "submitted") {
        lastSubmitted = result.message || "Đã nộp bài.";
        log.log(lastSubmitted, "success");
      }
      const next = items
        .slice(index + 1)
        .find((nextItem) =>
          ROOT.lessonBackground
            ? !["video", "reading", "lab"].includes(nextItem.kind)
            : !ROOT.videoBackground || nextItem.kind !== "video",
        );
      if (!next) {
        if (retries.size && retryRuns < 15) {
          const [retryKey, retryItem] = retries.entries().next().value;
          retries.delete(retryKey);
          retryRuns += 1;
          log.log(
            `Tạm chờ rồi thử lại ${retryItem.title} (${retryRuns}/15)…`,
            "info",
          );
          await dom.sleep(3000, {
            signal: controller.signal,
            assertActive: check,
          });
          check();
          navigating = true;
          try {
            if (!(await courseMap.navigateTo(retryItem, navFor())))
              throw new Error("Không mở lại được bài cần thử");
            check();
            if (!(await courseMap.waitForItemReady(retryItem, navFor())))
              throw new Error("Bài cần thử lại chưa sẵn sàng");
            expectedPath = location.pathname;
          } finally {
            navigating = false;
          }
          continue;
        }
        const verified = new Set([
          ...saved.done,
          ...courseMap.completedKeys(),
          ...(ROOT.videoBackground?.confirmed || []),
          ...(ROOT.lessonBackground?.confirmed || []),
        ]);
        let audited = null;
        try {
          audited = (await ROOT.lessonBackground?.audit?.()) || null;
        } catch (error) {
          log.log(
            "Không đối chiếu được tiến độ máy chủ: " + error.message,
            "info",
          );
        }
        if (audited)
          for (const key of audited.completed) verified.add(key);
        const missing = items.filter((entry) => !verified.has(entry.key));
        const review = [...tally.values()].filter(
          (entry) => entry.status === "review" || entry.status === "retry",
        );
        const failed = [...tally.values()].filter(
          (entry) => entry.status === "failed",
        );
        const titles = (list) =>
          list
            .slice(0, 6)
            .map((entry) => entry.title)
            .join("; ") + (list.length > 6 ? "…" : "");
        let message =
          (lastSubmitted ? lastSubmitted + " " : "") +
          `Đã duyệt hết danh sách: ${items.length - missing.length}/${items.length} bài được xác nhận hoàn thành.`;
        if (audited) message += " Đã đối chiếu tiến độ từ Coursera.";
        if (review.length)
          message += ` ${review.length} bài cần bạn kiểm tra: ${titles(review)}.`;
        if (failed.length)
          message += ` ${failed.length} bài lỗi: ${titles(failed)}.`;
        await finish(message);
        return;
      }
      const nav = { signal: controller.signal, assertActive: check };
      check();
      navigating = true;
      try {
        if (!(await courseMap.navigateTo(next, nav)))
          throw new Error("Không điều hướng được tới bài tiếp theo");
        check();
        if (!(await courseMap.waitForItemReady(next, nav)))
          throw new Error("Nội dung bài tiếp theo chưa sẵn sàng");
        expectedPath = location.pathname;
      } finally {
        navigating = false;
      }
      await dom.sleep(600, nav);
    }
  }
  function launch(myToken, path = location.pathname) {
    loop(myToken, path).catch(async (error) => {
      if (myToken !== token) return;
      await finish(
        error.name === "AbortError"
          ? "Đã dừng hoặc chuyển bài"
          : "Dừng: " + error.message,
      ).catch((e) => log.log(e.message, "error"));
    });
  }
  async function start(options = {}) {
    if (ROOT.lessonBackground?.running)
      throw new Error("Reading/Video đang chạy; hãy Dừng trước.");
    if (ROOT.videoBackground?.running)
      throw new Error("Video nền đang chạy; hãy Dừng trước.");
    if (starting) throw new Error("Đang khởi động tác vụ");
    if (controller) throw new Error("Tác vụ đang chạy");
    if (!courseMap.courseSlug())
      throw new Error("Hãy mở một khóa học Coursera trước");
    let startPath = location.pathname;
    const course = courseMap.courseSlug();
    starting = true;
    controller = new AbortController();
    panel.setRunning(true);
    const myToken = ++token;
    const assert = () => {
      if (
        myToken !== token ||
        controller?.signal.aborted ||
        location.pathname !== startPath
      )
        throw new DOMException("Đã dừng", "AbortError");
    };
    activeRunId = crypto.randomUUID();
    try {
      const merged = await state.saveOptions(options);
      const opts = merged?.options || merged || {};
      assert();
      if (opts.peer && globalThis.SkipperPeerSettings) {
        const peer = await globalThis.SkipperPeerSettings.read();
        if (!peer.enabled)
          await globalThis.SkipperPeerSettings.write({ enabled: true });
        if (!peer.autoSubmit)
          log.log(
            "Peer Review đang không tự nộp; mỗi bài chỉ điền một lượt rồi chuyển tiếp.",
            "info",
          );
      }
      assert();
      const existingRun = await state.getRun().catch(() => null);
      const isSingleMode =
        courseMap.isItemPage() && courseMap.harvest().length <= 1;
      await state.saveRun({
        running: true,
        runId: activeRunId,
        items:
          isSingleMode && existingRun?.items?.length ? existingRun.items : [],
        index:
          isSingleMode && existingRun?.items?.length ? existingRun.index : -1,
        done: isSingleMode && existingRun?.done?.length ? existingRun.done : [],
        visited:
          isSingleMode && existingRun?.visited?.length
            ? existingRun.visited
            : [],
        startedAt: Date.now(),
      });
      assert();
      const allSettings = await globalThis.SkipperOptions?.readAll().catch(() => null);
      const isPlayerVideo = allSettings?.videoMode === "player";
      const runVideoApi = opts.video === true && !isPlayerVideo;
      if ((runVideoApi || opts.reading || opts.lab) && ROOT.lessonBackground) {
        const result = await ROOT.lessonBackground.start({
          video: runVideoApi,
          reading: opts.reading === true,
          lab: opts.lab === true,
          signal: controller.signal,
        });
        assert();
        await state.saveRun({
          runId: activeRunId,
          items: ROOT.lessonBackground.items.map((item) => item.key),
          done: ROOT.lessonBackground.confirmed,
        });
        assert();
        if (result.ok)
          log.log(result.message, "success");
        else {
          const more = ["peer", "discussion"].some(
            (key) => opts[key],
          ) || (opts.video && isPlayerVideo);
          if (!more) throw new Error(result.message);
          log.log(
            result.message + " Vẫn tiếp tục các bài còn lại của khóa.",
            "error",
          );
        }
        if (
          !["peer", "discussion"].some(
            (key) => opts[key],
          ) && !(opts.video && isPlayerVideo)
        ) {
          await finish(result.message + " Giữ nguyên trang hiện tại.");
          return;
        }
      } else if (opts.video && !isPlayerVideo && ROOT.videoBackground) {
        const success = await ROOT.videoBackground.start({
          integrated: true,
          signal: controller.signal,
        });
        assert();
        if (!success)
          throw new Error(
            "Video nền chưa hoàn thành; xem Nhật ký để kiểm tra.",
          );
        if (!["reading", "peer", "discussion"].some((key) => merged[key])) {
          await finish("Đã xử lý video nền; giữ nguyên trang hiện tại.");
          return;
        }
      }
      ROOT.peerReview?.resumeAuto();
      if (!courseMap.isItemPage()) {
        log.log("Đang tìm bài học trong trang tổng quan…");
        const entryContext = {
          signal: controller.signal,
          assertActive: () => {
            if (myToken !== token || controller?.signal.aborted)
              throw new DOMException("Đã dừng", "AbortError");
            if (courseMap.courseSlug() !== course)
              throw new DOMException("Đã chuyển khóa học", "AbortError");
          },
        };
        await courseMap.expandAllGroups(entryContext);
        entryContext.assertActive();
        const entries = courseMap.harvest();
        if (!entries.length) {
          // Overview pages often render only module cards; open one module so
          // the full outline is loaded before choosing the first item.
          const module = [
            ...document.querySelectorAll('a[href*="/home/module/"]'),
          ].find((anchor) => {
            try {
              const url = new URL(anchor.href);
              return (
                url.origin === location.origin &&
                url.pathname.startsWith(`/learn/${course}/home/module/`)
              );
            } catch {
              return false;
            }
          });
          if (module && dom.click(module)) {
            const path = module.pathname;
            await dom.waitFor(() => location.pathname === path, {
              ...entryContext,
              timeout: 10000,
            });
            await courseMap.expandAllGroups(entryContext);
            entryContext.assertActive();
            entries.push(...courseMap.harvest());
          }
        }
        const done = new Set([
          ...courseMap.completedKeys(),
          ...(ROOT.lessonBackground?.confirmed || []),
        ]);
        const pending = entries.filter(
          (item) => !done.has(item.key) && optionForKind(item.kind, merged),
        );
        const entry =
          pending.find(
            (item) => !["video", "reading", "lab"].includes(item.kind),
          ) ||
          pending[0] ||
          (!ROOT.lessonBackground &&
            (entries.find(
              (item) =>
                !done.has(item.key) &&
                (item.kind === "reading" ||
                  (!ROOT.videoBackground && item.kind === "video")),
            ) ||
              entries[0]));
        if (!entry && ROOT.lessonBackground) {
          await finish(
            "Reading/Video đã xử lý qua API. Chưa thấy bài khác phù hợp trong mục lục đã tải; giữ nguyên trang.",
          );
          return;
        }
        if (!entry)
          throw new Error(
            "Chưa thấy bài học trong module này. Hãy mở một module hoặc bài học rồi thử lại.",
          );
        if (!(await courseMap.navigateTo(entry, entryContext)))
          throw new Error("Không mở được bài học từ trang tổng quan");
        // From here navigation is ours; cancellation still tracks the run token.
        const navigation = {
          signal: controller.signal,
          assertActive: () => {
            if (myToken !== token || controller?.signal.aborted)
              throw new DOMException("Đã dừng", "AbortError");
          },
        };
        if (!(await courseMap.waitForItemReady(entry, navigation)))
          throw new Error("Bài học chưa tải xong sau khi rời tổng quan");
        startPath = location.pathname;
      }
      assert();
      assert();
      panel.applyOptions(merged);
      panel.setRunning(true);
      log.status("Đang chạy", "online");
      launch(myToken, startPath);
    } catch (error) {
      if (myToken === token) {
        cancelLocal();
        await state.saveRun({ running: false, runId: activeRunId });
      }
      throw error;
    } finally {
      starting = false;
      if (!controller) panel.setRunning(false);
    }
  }
  async function resume() {
    const run = await state.getRun();
    if (
      !run.running ||
      !courseMap.isItemPage() ||
      run.courseSlug !== courseMap.courseSlug()
    )
      return false;
    if (controller) return true;
    activeRunId = run.runId;
    controller = new AbortController();
    const myToken = ++token;
    panel.setRunning(true);
    launch(myToken);
    return true;
  }
  ROOT.runner = {
    start,
    stop,
    resume,
    loop,
    processItem,
    updateProgress,
    loadItems,
    progressPercent,
    cancelLocal,
  };
})();
