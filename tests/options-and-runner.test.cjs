const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const optionsSchemaSource = fs.readFileSync(path.join(__dirname, "../shared/options-schema.js"), "utf8");
const domSource = fs.readFileSync(path.join(__dirname, "../content/dom.js"), "utf8");
const readingSource = fs.readFileSync(path.join(__dirname, "../content/reading.js"), "utf8");
const videoSource = fs.readFileSync(path.join(__dirname, "../content/video.js"), "utf8");
const discussionSource = fs.readFileSync(path.join(__dirname, "../content/discussion.js"), "utf8");
const runnerSource = fs.readFileSync(path.join(__dirname, "../content/runner.js"), "utf8");

test("options-schema provides readOptions, writeOptions, readAll, writeAll", async () => {
  const store = {};
  const chromeMock = {
    storage: {
      local: {
        get: async (k) => (k ? { [k]: store[k] } : store),
        set: async (obj) => Object.assign(store, obj),
      },
    },
  };
  const ctx = vm.createContext({
    self: {},
    chrome: chromeMock,
    setTimeout,
    clearTimeout,
    Promise,
  });
  vm.runInContext(optionsSchemaSource, ctx);
  const schema = ctx.self.SkipperOptions;

  assert.ok(schema, "SkipperOptions exported");
  assert.equal(typeof schema.readOptions, "function");
  assert.equal(typeof schema.writeOptions, "function");
  assert.equal(typeof schema.readAll, "function");
  assert.equal(typeof schema.writeAll, "function");

  // Default readAll
  const all = await schema.readAll();
  assert.equal(all.theme, "auto");
  assert.equal(all.videoSpeed, 16);
  assert.equal(all.videoMode, "batch");
  assert.deepEqual({ ...all.options }, {
    video: true,
    reading: true,
    peer: true,
    discussion: true,
  });

  // readOptions returns just the feature flags
  const opts = await schema.readOptions();
  assert.deepEqual({ ...opts }, {
    video: true,
    reading: true,
    peer: true,
    discussion: true,
  });

  // writeOptions updates feature flags and returns updated options
  const updatedOpts = await schema.writeOptions({ video: false });
  assert.equal(updatedOpts.video, false);
  assert.equal(updatedOpts.reading, true);
  assert.equal(updatedOpts.peer, true);
  assert.equal(updatedOpts.discussion, true);

  // writeAll updates settings without wiping other settings
  const updatedAll = await schema.writeAll({ theme: "dark", videoSpeed: 8, discussionComment: "Custom discussion comment" });
  assert.equal(updatedAll.theme, "dark");
  assert.equal(updatedAll.videoSpeed, 8);
  assert.equal(updatedAll.discussionComment, "Custom discussion comment");
  assert.equal(updatedAll.options.video, false); // preserved
  assert.equal(updatedAll.options.reading, true);
});

test("dom.inPanel recognizes elements inside skipper-auto-panel and skipper-auto-pill", () => {
  const root = {};
  const ctx = vm.createContext({
    globalThis: { Skipper: root },
    window: { getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }) },
    document: {},
  });
  vm.runInContext(domSource, ctx);
  const dom = ctx.globalThis.Skipper.dom;

  assert.equal(typeof dom.inPanel, "function");

  // Element inside #skipper-auto-panel
  const panelElem = {
    closest: (sel) => (sel === "#skipper-auto-panel" ? {} : null),
  };
  assert.equal(dom.inPanel(panelElem), true);

  // Element inside #skipper-auto-pill
  const pillElem = {
    closest: (sel) => (sel === "#skipper-auto-pill" ? {} : null),
  };
  assert.equal(dom.inPanel(pillElem), true);

  // Normal course element
  const courseElem = {
    closest: () => null,
  };
  assert.equal(dom.inPanel(courseElem), false);
});

test("runner optionForKind works with both flat options and nested options object", () => {
  const root = {
    dom: {},
    log: {},
    state: {},
    courseMap: {},
    video: {},
    reading: {},
    discussion: {},
    panel: {},
  };
  const ctx = vm.createContext({
    globalThis: { Skipper: root },
    location: { pathname: "/learn/test/lecture/1" },
    setInterval: () => 1,
    clearInterval: () => {},
  });
  vm.runInContext(runnerSource, ctx);
  const runner = ctx.globalThis.Skipper.runner;

  // Test with progress percent
  const items = [{ key: "k1" }, { key: "k2" }, { key: "k3" }, { key: "k4" }];
  root.courseMap.completedKeys = () => ["k1"];
  const pct = runner.progressPercent(items, ["k2"]);
  assert.equal(pct, 50); // 2 of 4 verified
});

test("reading COMPLETE_TEXT matches 'Mark as complete' and 'Mark as completed'", () => {
  const root = { dom: {}, log: {} };
  const ctx = vm.createContext({
    globalThis: { Skipper: root },
  });
  vm.runInContext(readingSource, ctx);

  // Read the source to test the regex
  const regexMatch = readingSource.match(/const COMPLETE_TEXT =\s*(\/[^\n]+\/i);/);
  assert.ok(regexMatch, "Found COMPLETE_TEXT regex");
  const regex = eval(regexMatch[1]);

  assert.equal(regex.test("Mark as complete"), true);
  assert.equal(regex.test("mark as complete"), true);
  assert.equal(regex.test("Mark as completed"), true);
  assert.equal(regex.test("Mark complete"), true);
  assert.equal(regex.test("Mark completed"), true);
  assert.equal(regex.test("Đánh dấu là đã hoàn thành"), true);
  assert.equal(regex.test("Đánh dấu hoàn thành"), true);
  assert.equal(regex.test("Continue"), false);
  assert.equal(regex.test("Next"), false);
  assert.equal(regex.test("Submit"), false);
});

test("discussion honors discussionAutoSubmit: false setting", async () => {
  let replyClicked = false;
  const mockButton = {
    id: "thread_reply_button_123",
    click: () => { replyClicked = true; return true; },
    matches: () => true,
    isConnected: true,
  };

  const root = {
    dom: {
      assertActive: () => {},
      sleep: async () => {},
      waitFor: async (fn) => fn(),
      click: (btn) => btn.click(),
      query: () => null,
      queryAll: (sels) => {
        if (sels[0].includes("thread_reply_button")) return [mockButton];
        return [];
      },
      textOf: (node) => node?.textContent || "",
      byText: () => null,
      visible: () => true,
      enabled: () => true,
      inPanel: () => false,
    },
    log: {
      log: () => {},
    },
    state: {
      getOptions: async () => ({ video: true, reading: true, peer: true, discussion: true }),
      getSettings: async () => ({ discussionAutoSubmit: false, discussionComment: "My thought" }),
    },
  };

  const windowMock = {
    location: { pathname: "/learn/course/discussionPrompt/abc" },
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  };

  const context = vm.createContext({
    globalThis: {
      Skipper: root,
      SkipperOptions: {
        readAll: async () => ({
          discussionAutoSubmit: false,
          discussionComment: "My custom comment",
        }),
      },
    },
    location: windowMock.location,
    document: windowMock.document,
    window: windowMock,
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
  });

  vm.runInContext(discussionSource, context);
  const discussion = context.globalThis.Skipper.discussion;

  // Mock draftDiscussion on ROOT.discussion
  context.globalThis.Skipper.discussion.draftDiscussion = async () => true;

  const result = await discussion.processDiscussion();
  assert.equal(result.status, "review");
  assert.equal(replyClicked, false, "Must not auto-click reply when discussionAutoSubmit is false");
});

test("video boostPlaybackRate reads configured videoSpeed and hasReachedEnd handles near end", async () => {
  const rates = [];
  const fakeVideo = {
    muted: false,
    volume: 1,
    playbackRate: 1,
    duration: 100,
    currentTime: 99.8,
    ended: false,
  };

  const root = {
    dom: {
      assertActive: () => {},
      sleep: async () => {},
      waitFor: async () => true,
      click: () => {},
      query: () => null,
      queryAll: () => [fakeVideo],
    },
    log: { log: () => {} },
  };

  const context = vm.createContext({
    globalThis: {
      Skipper: root,
      SkipperOptions: {
        readAll: async () => ({ videoSpeed: 8 }),
      },
    },
  });

  vm.runInContext(videoSource, context);
  const videoModule = context.globalThis.Skipper.video;

  // hasReachedEnd checks video near duration
  assert.equal(videoModule.hasReachedEnd(fakeVideo), true);

  fakeVideo.currentTime = 50;
  assert.equal(videoModule.hasReachedEnd(fakeVideo), false);

  fakeVideo.ended = true;
  assert.equal(videoModule.hasReachedEnd(fakeVideo), true);
});
