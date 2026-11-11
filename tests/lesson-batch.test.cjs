const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(
  path.join(__dirname, "../background/lesson-batch.js"),
  "utf8",
);
const item = (id, kind = "lecture", locked = false) => ({
  id,
  name: id,
  timeCommitment: 30000,
  isLocked: locked,
  contentSummary: { typeName: kind },
});
function setup(config = {}) {
  const calls = [],
    done = new Set(config.done || []);
  let tabPath = "/learn/fixture/home/welcome";
  const rows = config.items || [
    item("read", "supplement"),
    item("skip"),
    item("full"),
  ];
  const context = vm.createContext({
    URL,
    AbortController,
    DOMException,
    Response,
    TextDecoder,
    clearTimeout,
    setTimeout: (fn, ms) => setTimeout(fn, ms >= 20000 ? ms : 0),
    chrome: {
      tabs: {
        get: async () => ({ url: "https://www.coursera.org" + tabPath }),
      },
      cookies: {
        get: async () =>
          config.noCsrf ? null : { value: "fixture-csrf-secret" },
      },
    },
    fetch: async (url, init) => {
      const u = new URL(url),
        p = u.pathname.slice(5);
      calls.push({
        path: p,
        method: init.method,
        body: init.body && JSON.parse(init.body),
        headers: init.headers,
        credentials: init.credentials,
      });
      if (config.intercept) {
        const result = await config.intercept(p, init);
        if (result) return result;
      }
      const json = (value) => new Response(JSON.stringify(value));
      if (p === "adminUserPermissions.v1")
        return json({ elements: [{ id: 123 }] });
      if (p === "onDemandCourseMaterials.v2/")
        return json({
          elements: [{ id: "course" }],
          linked: {
            "onDemandCourseMaterialItems.v2": rows.map((row) =>
              config.unlock && done.has("read") && row.id === "locked"
                ? { ...row, isLocked: false }
                : row,
            ),
          },
        });
      if (p.startsWith("onDemandCoursesProgress.v1/"))
        return json({
          elements: [
            {
              id: "123~course",
              items: Object.fromEntries(
                [...done].map((id) => [id, { progressState: "Completed" }]),
              ),
            },
          ],
        });
      if (p.startsWith("onDemandLectureVideos.v1/")) {
        const id = p.split("~")[1];
        return json({
          elements: [
            { id: "course~" + id, disableSkippingForward: id === "full" },
          ],
          linked: { "onDemandVideos.v1": [{ id: "tracking-" + id }] },
        });
      }
      if (init.method !== "GET") {
        if (p === "onDemandCompletedItems.v1" && config.requireCompletionRecord)
          done.add(JSON.parse(init.body).itemId);
        if (!config.neverConfirm) {
          if (p === "onDemandSupplementCompletions.v1")
            done.add(JSON.parse(init.body).itemId);
          if (p.includes("/ended")) done.add(p.match(/\/item\/([^/]+)/)[1]);
        }
        return new Response(null, { status: 204 });
      }
      throw new Error("Unexpected fixture endpoint: " + p);
    },
  });
  context.self = context;
  vm.runInContext(source, context);
  const api = context.SkipperLessonBatch;
  const start = (
    options = { video: true, reading: true },
    owner = 1,
    id = "job-1",
  ) => api.start(owner, "fixture", options, id);
  async function finish() {
    for (let i = 0; i < 300; i++) {
      const job = await api.status(1, "job-1");
      if (!job.running) return job;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    throw new Error("Fixture task did not settle");
  }
  return {
    api,
    start,
    finish,
    calls,
    done,
    navigate: () => {
      tabPath = "/learn/other/home/welcome";
    },
  };
}

test("Skipera API sequence: reading completion, ended-only, play/progress/ended; server verification", async () => {
  const x = setup();
  await x.start();
  const result = await x.finish();
  assert.equal(result.error, "");
  assert.equal(result.completed, 3);
  assert.equal(result.failed.length, 0);
  const writes = x.calls.filter((c) => c.method !== "GET");
  assert.equal(writes.length, 5);
  assert.deepEqual(
    writes.find((c) => c.path === "onDemandSupplementCompletions.v1").body,
    { courseId: "course", itemId: "read", userId: 123 },
  );
  assert.equal(writes.filter((c) => c.path.includes("/item/skip/")).length, 1);
  const full = writes.filter(
    (c) => c.path.includes("/item/full/") || c.path.includes("tracking-full"),
  );
  assert.ok(full[0].path.includes("/play"));
  assert.equal(full[1].method, "PUT");
  assert.equal(full[1].body.viewedUpTo, 32000);
  assert.ok(full[2].path.includes("/ended"));
  assert.ok(
    writes.every(
      (c) =>
        c.headers["x-csrf3-token"] === "fixture-csrf-secret" &&
        c.credentials === "include",
    ),
  );
  assert.ok(!JSON.stringify(result).includes("secret"));
});

test("successful write without server Completed never counts", async () => {
  const x = setup({ items: [item("read", "supplement")], neverConfirm: true });
  await x.start();
  const result = await x.finish();
  assert.equal(result.completed, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(x.calls.filter((c) => c.method === "POST").length, 2);
});

test("completion registration is a bounded fallback and still requires server verification", async () => {
  const x = setup({
    items: [item("read", "supplement")],
    neverConfirm: true,
    requireCompletionRecord: true,
  });
  await x.start();
  const result = await x.finish();
  assert.equal(result.completed, 1);
  assert.equal(result.failed.length, 0);
  const writes = x.calls.filter((c) => c.method !== "GET");
  assert.equal(writes.length, 2);
  assert.equal(writes[1].path, "onDemandCompletedItems.v1");
  assert.deepEqual(writes[1].body, {
    userId: "123",
    courseId: "course",
    itemId: "read",
  });
});

test("completed, locked, non-lesson and disabled types are not written", async () => {
  const x = setup({
    items: [
      item("done"),
      item("locked", "lecture", true),
      item("quiz", "ungradedAssignment"),
      item("read", "supplement"),
    ],
    done: ["done"],
  });
  await x.start({ video: true, reading: false });
  const result = await x.finish();
  assert.equal(result.locked, 1);
  assert.equal(result.completed, 1);
  assert.equal(x.calls.filter((c) => c.method !== "GET").length, 0);
});

test("refreshing materials picks up a newly unlocked lesson without replaying completed items", async () => {
  const x = setup({
    items: [item("read", "supplement"), item("locked", "lecture", true)],
    unlock: true,
  });
  await x.start();
  const result = await x.finish();
  assert.equal(result.completed, 2);
  assert.equal(result.locked, 0);
  assert.equal(x.calls.filter((c) => c.method !== "GET").length, 2);
});

for (const code of [401, 403, 429, 500])
  test(`HTTP ${code} stops without retries or exposing provider text`, async () => {
    const x = setup({
      intercept: async (p) =>
        p === "onDemandSupplementCompletions.v1"
          ? new Response("fixture-csrf-secret", { status: code })
          : null,
      items: [item("read", "supplement")],
    });
    await x.start();
    const result = await x.finish();
    assert.match(result.error, new RegExp(String(code)));
    assert.doesNotMatch(result.error, /secret/);
    assert.equal(result.completed, 0);
    assert.equal(x.calls.filter((c) => c.method === "POST").length, 1);
  });

test("missing CSRF cannot send completion requests", async () => {
  const x = setup({ noCsrf: true, items: [item("read", "supplement")] });
  await x.start();
  const result = await x.finish();
  assert.equal(result.completed, 0);
  assert.match(result.failed[0].error, /CSRF/);
  assert.equal(x.calls.filter((c) => c.method !== "GET").length, 0);
});

test("Stop aborts an in-flight request and prevents later writes", async () => {
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const x = setup({
    intercept: async (p, init) => {
      if (p !== "onDemandSupplementCompletions.v1") return;
      entered();
      return new Promise((resolve, reject) =>
        init.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Stopped", "AbortError")),
          { once: true },
        ),
      );
    },
    items: [item("read", "supplement")],
  });
  await x.start();
  await ready;
  await x.api.cancel(1, "job-1");
  const result = await x.finish();
  assert.equal(result.completed, 0);
  assert.match(result.error, /dừng/);
  assert.equal(x.calls.filter((c) => c.method !== "GET").length, 1);
});

test("wrong course and duplicate course jobs are rejected", async () => {
  const x = setup();
  await assert.rejects(
    x.api.start(1, "other", { video: true, reading: false }, "job-1"),
    /đang mở/,
  );
  await x.start();
  await assert.rejects(x.start(undefined, 2, "job-2"), /đang chạy/);
  await x.finish();
});

test("navigation cancels a pending job before another write", async () => {
  const x = setup({ items: [item("read", "supplement")] });
  await x.start();
  x.navigate();
  const result = await x.finish();
  assert.equal(result.completed, 0);
  assert.equal(x.calls.filter((c) => c.method !== "GET").length, 0);
});

test("malformed video metadata sends no guessed completion event", async () => {
  const x = setup({
    items: [item("skip")],
    intercept: async (p) =>
      p.startsWith("onDemandLectureVideos")
        ? new Response('{"elements":[{}]}')
        : null,
  });
  await x.start();
  const result = await x.finish();
  assert.equal(result.completed, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(x.calls.filter((c) => c.method !== "GET").length, 0);
});

test("larger courses use bounded concurrency and verify each wave", async () => {
  let active = 0,
    peak = 0;
  const x = setup({
    items: Array.from({ length: 18 }, (_, i) =>
      item("reading-" + i, "supplement"),
    ),
    intercept: async (p, init) => {
      if (init.method === "GET") return;
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active--;
    },
  });
  await x.start();
  const result = await x.finish();
  assert.equal(result.completed, 18);
  assert.ok(peak > 1 && peak <= 3);
  const paths = x.calls.map((c) => c.path);
  const first = paths.indexOf("onDemandSupplementCompletions.v1");
  const last = paths.lastIndexOf("onDemandSupplementCompletions.v1");
  assert.ok(
    paths
      .slice(first, last)
      .some((p) => p.startsWith("onDemandCoursesProgress")),
  );
});
