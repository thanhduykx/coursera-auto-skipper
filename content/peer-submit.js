// Submission is opt-in. Only Coursera receipts/counters confirm a review.
(() => {
  const ROOT = globalThis.Skipper;
  const submitted = new WeakSet();
  const submittedIdentities = new Set();
  const visible = (node) =>
    node.getClientRects().length && !ROOT.dom.inPanel(node);
  const text = (node) => (node?.innerText || "").replace(/\s+/g, " ").trim();
  function identity() {
    const main = document.querySelector("#main-container,.main-container,main");
    return JSON.stringify([
      main?.querySelector('textarea[aria-label="Enter Peer Review comments"]')
        ?.id || "",
      [...(main?.querySelectorAll("h2") || [])].filter(visible).map(text),
    ]);
  }
  function control(pattern, scope) {
    return [...document.querySelectorAll('button,a,[role="button"]')].find(
      (node) => {
        if (
          !visible(node) ||
          node.matches(":disabled") ||
          node.getAttribute("aria-disabled") === "true" ||
          !pattern.test(text(node))
        )
          return false;
        return (
          node.tagName !== "A" ||
          globalThis.SkipperPeerProgress.scope(node.href) === scope
        );
      },
    );
  }
  function verify(plan) {
    const inputs = [
      ...document.querySelectorAll('.rc-FormPart input[type="radio"]'),
    ].filter((input) => visible(input.closest(".rc-FormPart")));
    const expected = new Set(plan.parts.flatMap((part) => part.inputs));
    const groups = new Map();
    for (const input of inputs) {
      if (!expected.has(input) || !input.name)
        throw new Error("Rubric có trường chưa được hỗ trợ; chưa tự nộp.");
      if (!groups.has(input.name)) groups.set(input.name, []);
      groups.get(input.name).push(input);
    }
    if (
      !groups.size ||
      [...groups.values()].some(
        (group) => group.filter((input) => input.checked).length !== 1,
      ) ||
      plan.choices.some(({ input }) => !input.isConnected || !input.checked)
    )
      throw new Error("Chưa điền đủ hoặc lựa chọn đã thay đổi; chưa tự nộp.");
    if (
      [
        ...document.querySelectorAll(
          ".rc-FormPart input,.rc-FormPart textarea",
        ),
      ].some(
        (field) =>
          visible(field.closest(".rc-FormPart")) &&
          !field.disabled &&
          !field.checkValidity(),
      )
    )
      throw new Error("Biểu mẫu còn trường không hợp lệ; chưa tự nộp.");
    if (
      plan.fields.some(
        (field) => !field.isConnected || field.value !== plan.comment,
      )
    )
      throw new Error("Nhận xét đã thay đổi; chưa tự nộp.");
  }
  async function submitAndNext(plan, context = {}) {
    const scope = globalThis.SkipperPeerProgress.scope(location.href);
    const url = location.href;
    const before = await ROOT.peerTracker.refresh();
    const check = () => {
      ROOT.dom.assertActive({ ...context, path: undefined });
      if (
        !scope ||
        globalThis.SkipperPeerProgress.scope(location.href) !== scope
      )
        throw new DOMException("Đã chuyển bài tập", "AbortError");
    };
    const cfg = {
      ...context,
      path: undefined,
      assertActive: check,
      interval: 100,
    };
    check();
    if (!Number.isInteger(before?.remaining) || before.remaining <= 0)
      throw new Error(
        "Chưa xác định được số lượt còn thiếu từ Coursera; chưa tự nộp.",
      );
    const button = await ROOT.dom.waitFor(
      () =>
        control(/^Submit Review$|^Nộp (?:bài )?(?:đánh giá|nhận xét)$/i, scope),
      { ...cfg, timeout: 3000 },
    );
    check();
    if (location.href !== url || !button)
      throw new Error("Không thấy nút Submit Review khả dụng; chưa tự nộp.");
    if (submitted.has(button))
      throw new Error("Đã gửi yêu cầu nộp cho biểu mẫu này; không bấm lặp.");
    verify(plan);
    const oldIdentity = identity();
    const submissionKey = JSON.stringify([
      scope,
      oldIdentity,
      before.remaining,
    ]);
    if (submittedIdentities.has(submissionKey))
      throw new Error(
        "Đã gửi lượt này; chưa xác nhận thay đổi nên không nộp lặp.",
      );
    const oldPart = plan.parts[0].part;
    submitted.add(button);
    submittedIdentities.add(submissionKey);
    button.click();
    let progress = before;
    // Read asynchronous storage separately; the DOM wait predicate stays sync.
    const deadline = Date.now() + 15000;
    let confirmed = false;
    let returnedToList = false;
    while (Date.now() < deadline) {
      check();
      // A Practice submission may jump directly to another learner, with no
      // quota in that view. Read the list before another review can be filled.
      if (
        !returnedToList &&
        ROOT.peerPractice.isPractice() &&
        (location.href !== url || identity() !== oldIdentity) &&
        ROOT.peerPractice.returnToList(cfg)
      )
        returnedToList = true;
      progress = await ROOT.peerTracker.refresh();
      check();
      const main =
        document.querySelector("#main-container,.main-container,main") ||
        document.body;
      const receipt =
        /(?:your review (?:has been |was )?submitted|review submitted|thank you for (?:your review|reviewing)|thanks for reviewing|đã nộp (?:bài )?đánh giá)/i.test(
          text(main),
        );
      if (
        (Number.isInteger(progress?.remaining) &&
          progress.remaining < before.remaining) ||
        (receipt && !button.isConnected)
      ) {
        confirmed = true;
        break;
      }
      await ROOT.dom.sleep(200, cfg);
    }
    if (!confirmed)
      throw new Error(
        "Chưa có xác nhận nộp từ Coursera. Đã dừng, không bấm lại hoặc chuyển người khác.",
      );
    if (progress?.remaining === 0)
      return {
        message: "Coursera đã xác nhận đủ lượt Peer Review. Đã dừng tự động.",
      };
    if (returnedToList)
      return {
        message:
          "Đã xác nhận lượt Practice; đã quay về danh sách để đọc số lượt còn thiếu.",
      };
    const nextPattern =
      /^(?:Review (?:the )?next(?: (?:submission|assignment))?|Review another (?:submission|assignment|learner)|Review more|Continue reviewing|Chấm bài tiếp theo)$/i;
    const next = await ROOT.dom.waitFor(
      () => {
        if (!oldPart.isConnected || identity() !== oldIdentity) {
          const loaded = document.querySelector(
            '.rc-FormPart input[type="radio"]',
          );
          if (loaded) return { loaded: true };
        }
        const node = control(nextPattern, scope);
        return node ? { node } : null;
      },
      { ...cfg, timeout: 8000 },
    );
    check();
    if (!next)
      throw new Error(
        "Đã xác nhận nộp nhưng chưa thấy lượt chấm tiếp theo trong bài tập này.",
      );
    if (next.node) next.node.click();
    return {
      message:
        "Đã xác nhận nộp review; đang chờ lượt chấm tiếp theo trong cùng bài tập.",
    };
  }
  ROOT.peerSubmit = { identity, submitAndNext };
})();
