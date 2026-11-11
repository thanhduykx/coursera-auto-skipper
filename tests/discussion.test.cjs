const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../content/discussion.js"),
  "utf8"
);

function setupContext(options = {}) {
  const root = {
    dom: {
      assertActive: () => {},
      sleep: async () => {},
      waitFor: async (fn) => fn(),
      click: () => true,
      query: (sel) => null,
      queryAll: () => [],
      textOf: (node) => node?.textContent || "",
      byText: () => null,
    },
    log: {
      log: () => {},
    },
    state: {
      getOptions: async () => ({ discussionComment: options.customComment || "" }),
    },
  };

  const windowMock = {
    location: { pathname: options.pathname || "/learn/course/discussionPrompt/abc" },
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      createRange: () => ({
        selectNodeContents: () => {},
      }),
      getSelection: () => ({
        removeAllRanges: () => {},
        addRange: () => {},
      }),
      execCommand: () => true,
    },
  };

  const context = vm.createContext({
    globalThis: { Skipper: root },
    location: windowMock.location,
    document: windowMock.document,
    window: windowMock,
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    Event: class {},
    ClipboardEvent: class {},
    DataTransfer: class {
      setData() {}
    },
  });

  vm.runInContext(source, context);
  return context.globalThis.Skipper.discussion;
}

test("discussion module exports expected methods", () => {
  const discussion = setupContext();
  assert.equal(typeof discussion.draftDiscussion, "function");
  assert.equal(typeof discussion.processDiscussion, "function");
  assert.equal(typeof discussion.readPrompt, "function");
  assert.equal(typeof discussion.editorText, "function");
});

test("editorText returns trimmed plain text or value", () => {
  const discussion = setupContext();
  assert.equal(discussion.editorText(null), "");
  assert.equal(discussion.editorText({ tagName: "TEXTAREA", value: "  hello world  " }), "hello world");
  assert.equal(discussion.editorText({
    tagName: "DIV",
    cloneNode: () => ({
      querySelectorAll: () => [],
      textContent: "  rich text reply  ",
    }),
  }), "rich text reply");
});

test("processDiscussion skips non-discussion paths gracefully", async () => {
  const discussion = setupContext({ pathname: "/learn/course/lecture/xyz" });
  const result = await discussion.processDiscussion();
  assert.equal(result.status, "skipped");
});
