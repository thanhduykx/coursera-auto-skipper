/**
 * Background Video Tab Batch Processor
 * Dev by thanh duyvp
 */
(() => {
  const batches = new Map();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function check(job) {
    if (job.cancelled)
      throw new DOMException("Đã dừng video nền", "AbortError");
  }

  async function isWorker(tabId) {
    const key = `videoWorker:${tabId}`;
    const role = (await chrome.storage.local.get(key))[key];
    if (!role) return false;
    const tab = await chrome.tabs.get(tabId);
    return (
      new URL(tab.url || "about:blank").hash ===
      `#skipper-video-worker=${role.id}`
    );
  }

  async function cleanOrphans(owner) {
    const roles = await chrome.storage.local.get(null);
    for (const [key, role] of Object.entries(roles)) {
      if (
        !/^videoWorker:\d+$/.test(key) ||
        (owner !== undefined && role?.owner !== owner)
      )
        continue;
      const id = Number(key.split(":")[1]);
      const tab = await chrome.tabs.get(id).catch(() => null);
      if (
        tab &&
        new URL(tab.url || "about:blank").hash ===
          `#skipper-video-worker=${role.id}`
      )
        await chrome.tabs.remove(id).catch(() => {});
      await chrome.storage.local.remove(key);
      await chrome.storage.session.remove(key);
    }
  }

  const recovered = cleanOrphans().catch(() => {});

  function snapshot(job) {
    return {
      id: job.id,
      running: job.running,
      total: job.items.length,
      current: job.current,
      confirmed: [...job.confirmed],
      failed: [...job.failed],
      error: job.error || "",
    };
  }

  async function loaded(job, url) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      check(job);
      const tab = await chrome.tabs.get(job.workerId);
      const actual = new URL(tab.url || "about:blank");
      const expected = new URL(url);
      if (
        actual.origin === expected.origin &&
        actual.pathname.split("/").slice(0, 5).join("/") ===
          expected.pathname.split("/").slice(0, 5).join("/") &&
        tab.status === "complete"
      )
        return;
      await wait(200);
    }
    throw new Error("Video chưa tải xong trong tab nền.");
  }

  async function closeWorker(job) {
    const id = job.workerId;
    job.workerId = null;
    if (id !== null && id !== undefined) {
      await chrome.storage.session.remove(`videoWorker:${id}`);
      await chrome.storage.local.remove(`videoWorker:${id}`);
      await chrome.tabs.remove(id).catch(() => {});
    }
  }

  async function processVideo(key, verifyOnly) {
    const root = globalThis.Skipper;
    if (!root) throw new Error("Tiện ích chưa nạp trong tab nền.");
    await root.instance.role;
    if (!root.instance.backgroundWorker)
      throw new Error("Tab không thuộc tác vụ video nền.");
    const context = { signal: root.instance.signal, path: location.pathname };
    if (!verifyOnly && !(await root.video.skipVideos(context)))
      return {
        confirmed: false,
        error: "Trình phát chưa xác nhận kết thúc video.",
      };
    const confirmed = await root.dom.waitFor(
      () =>
        root.courseMap.currentItem()?.key === key &&
        root.courseMap.completedKeys().includes(key),
      { ...context, timeout: 10000, interval: 250 },
    );
    return {
      confirmed: !!confirmed,
      error: confirmed ? "" : "Coursera chưa xác nhận hoàn thành video.",
    };
  }

  async function run(job) {
    try {
      const tab = await chrome.tabs.create({
        url: "about:blank",
        active: false,
      });
      job.workerId = tab.id;
      await chrome.storage.session.set({
        [`videoWorker:${tab.id}`]: { owner: job.owner, id: job.id },
      });
      await chrome.storage.local.set({
        [`videoWorker:${tab.id}`]: { owner: job.owner, id: job.id },
      });
      check(job);
      for (const item of job.items) {
        check(job);
        job.current = item.title;
        try {
          await chrome.tabs.update(job.workerId, {
            url: item.url + `#skipper-video-worker=${job.id}`,
            muted: true,
          });
          await loaded(job, item.url);
          const results = await chrome.scripting.executeScript({
            target: { tabId: job.workerId },
            func: processVideo,
            args: [item.key, false],
          });
          check(job);
          if (!results[0]?.result?.confirmed)
            throw new Error(
              results[0]?.result?.error || "Chưa xác nhận video.",
            );
          await chrome.tabs.reload(job.workerId);
          await loaded(job, item.url);
          const verified = await chrome.scripting.executeScript({
            target: { tabId: job.workerId },
            func: processVideo,
            args: [item.key, true],
          });
          check(job);
          if (!verified[0]?.result?.confirmed)
            throw new Error("Trạng thái hoàn thành không còn sau khi tải lại.");
          job.confirmed.push(item.key);
        } catch (error) {
          check(job);
          job.failed.push({
            key: item.key,
            title: item.title,
            error: String(error.message).slice(0, 300),
          });
        }
      }
    } catch (error) {
      job.error =
        error.name === "AbortError"
          ? "Đã dừng video nền."
          : String(error.message).slice(0, 300);
    } finally {
      await closeWorker(job);
      job.running = false;
      job.current = "";
    }
  }

  async function start(owner, course, raw) {
    await recovered;
    if (batches.get(owner)?.running)
      throw new Error("Video nền đang chạy trong tab này.");
    if (
      typeof course !== "string" ||
      !/^[a-zA-Z0-9._-]{1,200}$/.test(course) ||
      !Array.isArray(raw) ||
      !raw.length ||
      raw.length > 500
    )
      throw new Error("Danh sách video không hợp lệ.");
    const tab = await chrome.tabs.get(owner);
    const origin = new URL(tab.url);
    if (
      origin.protocol !== "https:" ||
      !/^(?:www\.)?coursera\.org$/.test(origin.hostname) ||
      origin.pathname.split("/")[2] !== course
    )
      throw new Error("Tab đã chuyển khỏi khóa học.");
    const seen = new Set();
    const items = raw.map((item) => {
      const url = new URL(item.url);
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        url.origin !== origin.origin ||
        parts[0] !== "learn" ||
        parts[1] !== course ||
        parts[2] !== "lecture" ||
        !parts[3] ||
        url.search ||
        url.hash
      )
        throw new Error("Chỉ xử lý video trong khóa hiện tại.");
      const key = `${course}:lecture:${parts[3]}`;
      if (item.key !== key || seen.has(key))
        throw new Error("Video bị trùng hoặc sai mã bài.");
      seen.add(key);
      return {
        key,
        url: url.href,
        title:
          typeof item.title === "string" ? item.title.slice(0, 120) : parts[3],
      };
    });
    const job = {
      id: crypto.randomUUID(),
      owner,
      items,
      confirmed: [],
      failed: [],
      current: "",
      workerId: null,
      cancelled: false,
      running: true,
    };
    batches.set(owner, job);
    run(job).catch(() => {});
    return snapshot(job);
  }

  async function cancel(owner) {
    const job = batches.get(owner);
    if (job?.running) {
      job.cancelled = true;
      await closeWorker(job);
    }
    if (!job) await cleanOrphans(owner);
    return job ? snapshot(job) : null;
  }

  async function status(owner, id) {
    const job = batches.get(owner);
    if (!job || job.id !== id) {
      if (!job) await cleanOrphans(owner);
      throw new Error(
        "Tác vụ video nền đã gián đoạn. Hãy chạy lại; video đã hoàn thành sẽ được bỏ qua.",
      );
    }
    return snapshot(job);
  }

  async function removed(id) {
    if (batches.has(id)) {
      await cancel(id);
      batches.delete(id);
    } else await cleanOrphans(id);
    for (const job of batches.values())
      if (job.workerId === id) {
        job.cancelled = true;
        job.workerId = null;
      }
    await chrome.storage.session.remove(`videoWorker:${id}`);
    await chrome.storage.local.remove(`videoWorker:${id}`);
  }

  chrome.tabs.onUpdated?.addListener((id, change) => {
    if (change.url && batches.get(id)?.running) cancel(id).catch(() => {});
  });

  self.SkipperVideoBatch = { start, status, cancel, isWorker, removed };
})();
