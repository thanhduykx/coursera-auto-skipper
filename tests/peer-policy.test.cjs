const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const c = vm.createContext({ URL });
for (const file of ["peer-score", "peer-progress"])
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../shared/" + file + ".js"), "utf8"),
    c,
  );
for (const [label, expected] of [
  ["Excellent: 4 points", 4],
  ["2,5 điểm", 2.5],
  ["Points: 10", 10],
  ["No evidence: -1 pt", -1],
  ["2 points, 5 points", null],
  ["0–4 points", null],
  ["2/4 points", null],
  ["Level 10 excellent", null],
]) {
  test(`explicit peer score: ${label}`, () =>
    assert.equal(c.SkipperPeerScore.score(label), expected));
}
test("highest score is independent of source order and option values", () => {
  assert.equal(
    c.SkipperPeerScore.highest([{ label: "4 points" }, { label: "0 points" }]),
    0,
  );
  assert.equal(
    c.SkipperPeerScore.highest([
      { label: "0 points" },
      { label: "10 points" },
      { label: "3 points" },
    ]),
    1,
  );
  assert.throws(() =>
    c.SkipperPeerScore.highest([{ label: "4 points" }, { label: "Excellent" }]),
  );
});
test("actual Coursera counter parses remaining without inventing total", () => {
  const parsed = c.SkipperPeerProgress.parse("4 left to complete");
  assert.equal(parsed.remaining, 4);
  assert.equal(parsed.total, undefined);
  assert.equal(c.SkipperPeerProgress.parse("0 left to complete").remaining, 0);
  assert.equal(
    c.SkipperPeerProgress.parse("2 of 4 reviews completed").remaining,
    2,
  );
  assert.equal(c.SkipperPeerProgress.parse("Review 4 classmates"), null);
});
test("peer ledger scope separates assignments and rejects lookalike domains", () => {
  assert.equal(
    c.SkipperPeerProgress.scope(
      "https://www.coursera.org/learn/javascript/peer/VHPfS/project/give-feedback",
    ),
    "javascript:VHPfS",
  );
  assert.equal(
    c.SkipperPeerProgress.scope(
      "https://coursera.org.evil.test/learn/javascript/peer/VHPfS/project",
    ),
    null,
  );
  assert.notEqual(
    c.SkipperPeerProgress.scope(
      "https://www.coursera.org/learn/one/peer/A/review/1",
    ),
    c.SkipperPeerProgress.scope(
      "https://www.coursera.org/learn/one/peer/B/review/1",
    ),
  );
});

test("Coursera final counter stops further reviews", () => {
  const p = c.SkipperPeerProgress.parse("4 complete");
  assert.equal(p.remaining, 0);
  assert.equal(p.completed, 4);
});
