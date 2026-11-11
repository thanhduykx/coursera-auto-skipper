/**
 * Background Service Worker
 * Coursera Auto Skipper - Dev by thanh duyvp
 */
importScripts(
  "../shared/options-schema.js",
  "../shared/peer-settings.js",
  "../shared/peer-progress.js",
  "video-batch.js",
  "lesson-batch.js",
  "submission-link.js"
);

const ready = chrome.storage.local
  .setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  .catch(() => {})
  .then(() => self.SkipperOptions.readAll());

const jobs = new Map();
const queues = new Map();

function validUrl(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      (u.hostname === "coursera.org" || u.hostname.endsWith(".coursera.org"))
    );
  } catch {
    return false;
  }
}

function runDefault(slug = "") {
  return {
    running: false,
    items: [],
    index: -1,
    done: [],
    visited: [],
    startedAt: 0,
    updatedAt: 0,
    courseSlug: slug,
    runId: "",
  };
}

function enqueue(key, fn) {
  const result = (queues.get(key) || Promise.resolve())
    .catch(() => {})
    .then(fn);
  queues.set(key, result);
  result
    .finally(() => {
      if (queues.get(key) === result) queues.delete(key);
    })
    .catch(() => {});
  return result;
}

function cancelTab(tabId) {
  for (const [key, job] of jobs) {
    if (key.startsWith(`${tabId}:`)) {
      job.abort();
      jobs.delete(key);
    }
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  self.SkipperLessonBatch?.removed(tabId).catch(() => {});
  self.SkipperVideoBatch?.removed(tabId).catch(() => {});
  cancelTab(tabId);
  chrome.storage.session?.remove(`runOwner:${tabId}`).catch(() => {});
  chrome.storage.local.remove(`runState:${tabId}`).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.id !== chrome.runtime.id) return false;
  const page = [
    chrome.runtime.getURL("options/options.html"),
    chrome.runtime.getURL("popup/popup.html"),
  ].includes(sender.url);
  const course = !!sender.tab && sender.frameId === 0 && validUrl(sender.url);

  const respond = (fn) => {
    Promise.resolve()
      .then(() => ready)
      .then(fn)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message,
          retryable: error.retryable === true,
          status: error.status,
        })
      );
    return true;
  };

  if (msg.type === "GET_SUBMISSION_LINK" && course)
    return respond(async () => ({
      ok: true,
      url: await self.SkipperSubmissionLink.get(sender.tab.id, sender.url),
    }));

  if (msg.type === "GET_TAB_ROLE" && course)
    return respond(async () => ({
      ok: true,
      backgroundWorker: await self.SkipperVideoBatch.isWorker(sender.tab.id),
    }));

  if (msg.type === "LESSON_BG_START" && course)
    return respond(async () => ({
      ok: true,
      job: await self.SkipperLessonBatch.start(
        sender.tab.id,
        msg.course,
        msg.options,
        msg.id
      ),
    }));

  if (msg.type === "LESSON_BG_STATUS" && course)
    return respond(async () => ({
      ok: true,
      job: await self.SkipperLessonBatch.status(sender.tab.id, msg.id),
    }));

  if (msg.type === "LESSON_BG_CANCEL" && course)
    return respond(async () => ({
      ok: true,
      job: await self.SkipperLessonBatch.cancel(sender.tab.id, msg.id),
    }));

  if (msg.type === "LESSON_BG_AUDIT" && course)
    return respond(async () => ({
      ok: true,
      audit: await self.SkipperLessonBatch.audit(sender.tab.id, msg.course),
    }));

  if (msg.type === "VIDEO_BG_START" && course)
    return respond(async () => ({
      ok: true,
      job: await self.SkipperVideoBatch.start(
        sender.tab.id,
        msg.course,
        msg.items
      ),
    }));

  if (msg.type === "VIDEO_BG_STATUS" && course)
    return respond(async () => ({
      ok: true,
      job: await self.SkipperVideoBatch.status(sender.tab.id, msg.id),
    }));

  if (msg.type === "VIDEO_BG_CANCEL" && course)
    return respond(async () => ({
      ok: true,
      job: await self.SkipperVideoBatch.cancel(sender.tab.id),
    }));

  if (msg.type === "PEER_PROGRESS" && course)
    return respond(async () => {
      const scope = self.SkipperPeerProgress.scope(msg.url || sender.url);
      if (!scope) throw new Error("Chưa mở bài Peer Review");
      if (msg.url !== undefined) {
        const tab = await chrome.tabs.get(sender.tab.id);
        if (self.SkipperPeerProgress.scope(tab.url) !== scope)
          throw new Error("Tab đã chuyển khỏi bài Peer Review đang theo dõi");
      }
      return enqueue(`peer-progress:${scope}`, async () => {
        const key = `peerProgress:${scope}`;
        let progress = (await chrome.storage.local.get(key))[key] || null;
        if (msg.observed !== null && msg.observed !== undefined) {
          const observed = msg.observed;
          if (
            !Number.isInteger(observed.remaining) ||
            observed.remaining < 0 ||
            observed.remaining > 100 ||
            (observed.total !== undefined &&
              (!Number.isInteger(observed.total) ||
                !Number.isInteger(observed.completed) ||
                observed.total < 0 ||
                observed.total > 100 ||
                observed.completed < 0 ||
                observed.completed > observed.total ||
                observed.total - observed.completed !== observed.remaining))
          )
            throw new Error("Số lượt Peer Review không hợp lệ");
          const initialRemaining = Math.max(
            progress?.initialRemaining || 0,
            observed.remaining
          );
          progress = {
            remaining: observed.remaining,
            initialRemaining,
            confirmed: Math.max(0, initialRemaining - observed.remaining),
            total: observed.total ?? null,
            completed: observed.completed ?? null,
            updatedAt: Date.now(),
          };
          await chrome.storage.local.set({ [key]: progress });
        }
        return { ok: true, progress };
      });
    });

  if (msg.type === "GET_PEER_SETTINGS" && (page || course))
    return respond(async () => ({
      ok: true,
      settings: await self.SkipperPeerSettings.read(),
    }));

  if (msg.type === "SAVE_PEER_SETTINGS" && (page || course))
    return respond(async () => ({
      ok: true,
      settings: await self.SkipperPeerSettings.write(msg.settings),
    }));

  if (msg.type === "GET_SETTINGS" && (page || course))
    return respond(async () => ({
      ok: true,
      settings: await self.SkipperOptions.readAll(),
    }));

  if (msg.type === "SAVE_SETTINGS" && (page || course))
    return respond(async () => ({
      ok: true,
      settings: await self.SkipperOptions.writeAll(msg.settings || {}),
    }));

  if (msg.type === "UPDATE_OPTIONS" && (page || course))
    return respond(async () => ({
      ok: true,
      options: await self.SkipperOptions.writeOptions(msg.patch || {}),
    }));

  if (
    (msg.type === "OPEN_OPTIONS" || msg.action === "OPEN_OPTIONS") &&
    (page || course)
  )
    return respond(async () => {
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    });

  if (!course) return false;
  const tabId = sender.tab.id;

  if (/^RUN_(GET|SAVE|RESET)$/.test(msg.type || ""))
    return respond(() =>
      enqueue(`run:${tabId}`, async () => {
        const slug =
          typeof msg.courseSlug === "string" &&
          /^[a-zA-Z0-9._-]{1,200}$/.test(msg.courseSlug)
            ? msg.courseSlug
            : "";
        const key = `runState:${tabId}`;
        const stored = (await chrome.storage.local.get(key))[key];
        const owner = (await chrome.storage.session?.get(`runOwner:${tabId}`))?.[
          `runOwner:${tabId}`
        ];
        const run =
          stored && stored.courseSlug === slug && owner === stored.runId
            ? stored
            : runDefault(slug);
        let next = run;
        if (msg.type === "RUN_RESET") next = runDefault(slug);
        if (msg.type === "RUN_SAVE") {
          const patch = msg.patch || {};
          if (patch.runId && patch.running === true && patch.startedAt) {
            if (
              typeof patch.runId !== "string" ||
              patch.runId.length > 100 ||
              !Number.isFinite(patch.startedAt)
            )
              throw new Error("Mã lượt chạy không hợp lệ");
            if (patch.startedAt < run.startedAt) return { ok: true, run };
            await chrome.storage.session?.set({
              [`runOwner:${tabId}`]: patch.runId,
            });
            next = { ...runDefault(slug), ...patch };
          } else if (patch.runId && patch.runId !== run.runId)
            return { ok: true, run };
          else next = { ...run, ...patch };
          next.courseSlug = slug;
          next.updatedAt = Date.now();
          for (const field of ["items", "done", "visited"]) {
            if (
              !Array.isArray(next[field]) ||
              next[field].length > 5000 ||
              !next[field].every((v) => typeof v === "string" && v.length < 400)
            )
              throw new Error("Trạng thái bài học không hợp lệ");
          }
          if (next.running && (!slug || !next.runId))
            throw new Error("Không xác định được khóa học");
          if (next.running === false) cancelTab(tabId);
        }
        if (msg.type !== "RUN_GET")
          await chrome.storage.local.set({ [key]: next });
        return { ok: true, run: next };
      })
    );

  return false;
});
