const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const readingSource = fs.readFileSync(path.join(__dirname, "../content/reading.js"), "utf8");
const videoSource = fs.readFileSync(path.join(__dirname, "../content/video.js"), "utf8");

test("reading module detects completeReading interface", () => {
  const root = { dom: {}, log: {} };
  const ctx = vm.createContext({ globalThis: { Skipper: root } });
  vm.runInContext(readingSource, ctx);
  assert.equal(typeof ctx.globalThis.Skipper.reading.completeReading, "function");
});

test("video module exports skipVideos method", () => {
  const root = { dom: {}, log: {} };
  const ctx = vm.createContext({ globalThis: { Skipper: root } });
  vm.runInContext(videoSource, ctx);
  assert.equal(typeof ctx.globalThis.Skipper.video.skipVideos, "function");
});
