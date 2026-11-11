const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../background/submission-link.js'), 'utf8');
const url = 'https://www.coursera.org/learn/course/peer/item/project/give-feedback';
function setup(options = {}) {
  const calls = [];
  let current = url;
  const ctx = vm.createContext({ URL, AbortController, TextDecoder, setTimeout, clearTimeout,
    chrome: { tabs: { get: async () => ({ url: current }) } },
    fetch: async (address, init) => {
      calls.push({ address, init });
      if (options.fail) return new Response('{}', { status: options.fail });
      if (options.move) current = url.replace('/item/', '/other/');
      if (address.includes('adminUser')) return Response.json({ elements: [{ id: 123 }] });
      if (address.includes('Materials')) return Response.json({ elements: [{ id: 'course-id' }] });
      return Response.json({ linked: { 'onDemandPeerSubmissionProgresses.v1': [{
        id: options.wrongOwner ? '999~course-id~item' : '123~course-id~item',
        latestSubmissionSummary: options.draft ? undefined : { computed: { id: options.badId ? '../evil' : 'submission-id' } },
      }] } });
    },
  });
  ctx.self = ctx; vm.runInContext(source, ctx);
  return { get: () => ctx.SkipperSubmissionLink.get(1, url), service: ctx.SkipperSubmissionLink, calls };
}
test('share link uses authenticated account, fixed first-party GET and validated submission', async () => {
  const s = setup();
  assert.equal(await s.get(), 'https://www.coursera.org/learn/course/peer/item/course-project/review/submission-id');
  assert.equal(s.calls.length, 3);
  for (const { address, init } of s.calls) {
    assert.equal(new URL(address).origin, 'https://www.coursera.org');
    assert.equal(init.body, undefined); assert.equal(init.method, undefined);
    assert.equal(init.credentials, 'include'); assert.equal(init.redirect, 'error');
  }
});
for (const [label, options] of Object.entries({ draft: { draft: true }, wrongOwner: { wrongOwner: true }, badId: { badId: true }, navigation: { move: true }, unauthorized: { fail: 403 }, quota: { fail: 429 } }))
  test('share link rejects ' + label, async () => { await assert.rejects(setup(options).get()); });
test('share lookup rejects unsupported and external routes without requests', async () => {
  const s = setup();
  for (const invalid of ['https://evil.example/learn/course/peer/item/x', 'https://www.coursera.org/learn/course/home/welcome'])
    await assert.rejects(s.service.get(1, invalid));
  assert.equal(s.calls.length, 0);
});
test('duplicate lookup is rejected and completion releases ownership', async () => {
  const s = setup(); const first = s.get(); await assert.rejects(s.get(), /Đang lấy/);
  await first; await s.get(); assert.equal(s.calls.length, 6);
});
