// Discover review links independently of the learner's own submission status.
(() => {
  const ROOT = globalThis.Skipper;
  let active = null;
  let scanned = "";
  function stop() {
    active?.abort();
  }
  function reset() {
    stop();
    scanned = "";
  }
  function report(message) {
    const output = document.getElementById("sp-peer-status");
    if (output) output.textContent = message;
    ROOT.log.log(message);
  }
  function candidates() {
    const seen = new Set();
    return [...document.querySelectorAll('a[href*="/peer/"]')].flatMap(
      (anchor) => {
        if (anchor.closest("#skipper-pro-panel")) return [];
        const item = ROOT.courseMap.parse(anchor.href);
        const label = anchor.getAttribute("aria-label") || "";
        const practice = /Practice Peer-graded Assignment/i.test(label);
        if (
          !item ||
          item.slug !== ROOT.courseMap.courseSlug() ||
          (!/\/give-feedback\/?$/.test(item.path) && !practice) ||
          seen.has(item.key)
        )
          return [];
        seen.add(item.key);
        if (practice) {
          item.path =
            new URL(anchor.href).pathname.split("/").slice(0, 6).join("/") +
            "/give-feedback";
          item.url = location.origin + item.path;
        }
        const completed =
          !practice &&
          (/(?:^|,)\s*(?:completed|complete|đã hoàn thành)\s*(?:,|$)/i.test(
            label,
          ) ||
            !!anchor.querySelector(
              '[data-testid="learn-item-success-icon"],[aria-label="Completed"]',
            ));
        const notSubmitted = /not submitted|chưa nộp/i.test(label);
        const title = (
          practice
            ? label
                .replace(/^.*?Practice Peer-graded Assignment,\s*/i, "")
                .replace(
                  /,\s*(?:Not submitted|Completed|\d+\s*(?:min|h)).*$/i,
                  "",
                )
            : label
        )
          .split(",")
          .slice(practice ? 0 : 1)
          .filter(
            (part) => !/^\s*(completed|complete|đã hoàn thành)\s*$/i.test(part),
          )
          .join(",")
          .trim();
        return [{ ...item, anchor, completed, title, practice, notSubmitted }];
      },
    );
  }
  async function sweep(settings, signal, course) {
    const check = () => {
      ROOT.dom.assertActive({ signal });
      if (ROOT.courseMap.courseSlug() !== course)
        throw new DOMException("Đã chuyển khóa học", "AbortError");
    };
    const context = { signal, assertActive: check, scanning: true };
    report("Đang chờ mục lục Coursera tải xong…");
    const outlineReady = await ROOT.dom.waitFor(
      () => {
        if (
          /^\s*(Loading|Đang tải)/i.test(
            document.querySelector("h1")?.textContent || "",
          )
        )
          return false;
        const main = document.querySelector(
          "#main-container,.main-container,main",
        );
        const links = [...document.querySelectorAll('a[href*="/learn/"]')].some(
          (anchor) => {
            if (main?.contains(anchor) || anchor.closest("#skipper-pro-panel"))
              return false;
            const item = ROOT.courseMap.parse(anchor.href);
            return (
              item?.slug === course ||
              anchor.pathname.startsWith(`/learn/${course}/home/module/`)
            );
          },
        );
        return (
          links ||
          [...document.querySelectorAll("button[aria-expanded]")].some(
            (button) =>
              !button.closest("#skipper-pro-panel") &&
              button.getClientRects().length &&
              /module\s*\d|week\s*(?:\d|one|two)|lesson\s*\d/i.test(
                button.innerText,
              ),
          )
        );
      },
      { ...context, timeout: 15000, interval: 200 },
    );
    if (!outlineReady) {
      report(
        "Coursera chưa tải mục lục; chưa thể kết luận số bài Peer Review. Lưu cấu hình để thử lại.",
      );
      return;
    }
    await ROOT.courseMap.expandAllGroups(context);
    // Expanded modules may lazily insert collapsed lesson groups.
    await ROOT.courseMap.expandAllGroups(context);
    check();
    // Overview pages sometimes expose only module cards. Open an observed
    // module/lesson link to load the full course outline before harvesting.
    for (let pass = 0; pass < 2 && !candidates().length; pass++) {
      const lesson = ROOT.courseMap
        .harvest()
        .find((item) => ["reading", "video", "peer"].includes(item.kind));
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
      const anchor = lesson?.anchor || module;
      if (!anchor || anchor.pathname === location.pathname) break;
      const path = anchor.pathname;
      report("Đang mở module/bài học để tải danh sách Peer Review của khóa…");
      if (!ROOT.dom.click(anchor)) break;
      const arrived = await ROOT.dom.waitFor(() => location.pathname === path, {
        ...context,
        timeout: 10000,
      });
      if (!arrived) break;
      if (lesson) await ROOT.courseMap.waitForItemReady(lesson, context);
      else await ROOT.dom.sleep(800, context);
      await ROOT.courseMap.expandAllGroups(context);
      await ROOT.courseMap.expandAllGroups(context);
    }
    check();
    const items = candidates();
    let completed = 0,
      blocked = 0;
    report(
      `Đã quét thấy ${items.length} bài có Review Your Peers trong khóa hiện tại.`,
    );
    for (const item of items) {
      check();
      if (item.completed) {
        completed++;
        continue;
      }
      report(`Đang tìm lượt cần chấm: ${item.title || item.id}…`);
      if (location.pathname !== item.path) {
        // Never use the submission link sharing the same assignment key.
        const anchor = candidates().find(
          (candidate) => candidate.key === item.key,
        )?.anchor;
        if (!anchor || !ROOT.dom.click(anchor)) {
          blocked++;
          report(
            `Bỏ qua ${item.title || item.id}: link chấm bài chưa khả dụng.`,
          );
          continue;
        }
      }
      if (item.practice && location.pathname !== item.path) {
        const tab = await ROOT.dom.waitFor(
          () => {
            if (
              globalThis.SkipperPeerProgress.scope(location.href) !==
              globalThis.SkipperPeerProgress.scope(item.url)
            )
              return null;
            const heading = ROOT.dom.normalize(
              document.querySelector("h1")?.textContent || "",
            );
            if (item.title && !heading.includes(ROOT.dom.normalize(item.title)))
              return null;
            return ROOT.peerPractice.listTab();
          },
          {
            ...context,
            timeout: 10000,
          },
        );
        if (!tab) {
          blocked++;
          report(`Không tìm thấy Peers to review của ${item.title}.`);
          continue;
        }
        ROOT.dom.click(tab);
      }
      if (item.notSubmitted) {
        blocked += 1;
        report(
          `${item.title || item.id}: bài của bạn chưa nộp nên Coursera chưa cho chấm. Mở My submission và nộp project trước, rồi chạy lại Peer Review.`,
        );
        continue;
      }
      const ready = await ROOT.dom.waitFor(        () => {
          if (location.pathname !== item.path) return false;
          const main =
            document.querySelector("#main-container,.main-container,main") ||
            document.body;
          const heading = ROOT.dom.normalize(
            main.querySelector("h1")?.textContent || "",
          );
          if (item.title && !heading.includes(ROOT.dom.normalize(item.title)))
            return false;
          return (
            main.querySelector('[data-testid="review-count"]')?.getClientRects()
              .length ||
            /submit your (?:project|assignment) before reviewing|nộp (?:bài|dự án).{0,30}trước khi/i.test(
              main.innerText,
            )
          );
        },
        { ...context, timeout: 15000, interval: 200 },
      );
      check();
      if (!ready) {
        blocked++;
        report(
          `Bỏ qua ${item.title || item.id}: Coursera chưa tải chỉ tiêu hoặc biểu mẫu chấm.`,
        );
        continue;
      }
      let done = false;
      // Bounded by Coursera's maximum supported quota; no unbounded click loop.
      for (let round = 0; round < 102; round++) {
        check();
        const before = await ROOT.peerTracker.refresh();
        if (before?.remaining === 0) {
          completed++;
          done = true;
          break;
        }
        if (
          globalThis.SkipperPeerProgress.scope(location.href) !==
          globalThis.SkipperPeerProgress.scope(item.url)
        )
          throw new DOMException("Đã rời bài đang chấm", "AbortError");
        const oldIdentity = ROOT.peerSubmit.identity();
        const result = await ROOT.peerReview.process(context);
        check();
        const after = await ROOT.peerTracker.refresh();
        if (after?.remaining === 0) {
          completed++;
          done = true;
          break;
        }
        if (result.status === "failed") {
          stop();
          throw new Error(
            "Quét Peer Review đã dừng vì chưa xác nhận được thao tác nộp.",
          );
        }
        if (result.message) {
          blocked++;
          report(`${item.title || item.id}: ${result.message}`);
          done = true;
          break;
        }
        if (!settings.autoSubmit && result.status === "review") {
          report(
            "Đã tự mở và điền bài chấm. Bật tự nộp để quét tiếp các lượt còn lại.",
          );
          return;
        }
        if (result.status === "skipped") {
          await ROOT.dom.sleep(700, context);
        } else if (before?.remaining === after?.remaining) {
          // Allow a newly opened rubric to settle, but do not keep retrying an
          // unchanged or unacknowledged submission.
          const changed = await ROOT.dom.waitFor(
            () => ROOT.peerSubmit.identity() !== oldIdentity,
            { ...context, timeout: 3000 },
          );
          if (!changed) break;
        }
      }
      if (!done) {
        blocked++;
        report(`Tạm bỏ qua ${item.title || item.id}: chưa xác nhận đủ lượt.`);
      }
    }
    report(
      `Đã quét xong Peer Review: ${completed}/${items.length} bài đủ lượt; ${blocked} bài bị khóa hoặc chưa xử lý được.`,
    );
  }
  async function start(settings) {
    const course = ROOT.courseMap.courseSlug();
    const key = `${course}:${settings.revision}`;
    if (
      !course ||
      !document.getElementById("sp-start") ||
      active ||
      scanned === key
    )
      return;
    const controller = new AbortController();
    active = controller;
    scanned = key;
    try {
      await sweep(settings, controller.signal, course);
    } finally {
      if (active === controller) active = null;
    }
  }
  ROOT.instance.addCleanup(stop);
  ROOT.peerScan = { start, stop, reset, candidates };
})();
