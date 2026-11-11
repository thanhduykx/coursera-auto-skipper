/**
 * Auto Skip Reading
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const { dom, log } = ROOT;

  const SELECTORS = [
    'button[data-testid="mark-complete"]',
    'button[data-testid="markComplete"]',
    'button[data-testid="mark-complete-button"]',
    'button[data-testid="completed-button"]',
    'button[data-testid="complete-item-button"]',
  ];

  /** Strict: must be the completion control itself, not a nav "Continue" link. */
  const COMPLETE_TEXT =
    /^(mark as complete|mark complete|mark this item as complete|đánh dấu là đã hoàn thành|đánh dấu hoàn thành|đánh dấu bài học đã hoàn thành|hoàn thành bài học)$/i;

  const DONE_TEXT = /(completed|already complete|đã hoàn thành)/i;

  function findButton() {
    return dom.byText(
      SELECTORS.concat(["button", 'a[role="button"]']),
      COMPLETE_TEXT,
    );
  }

  function isAlreadyComplete(button) {
    if (!button) return false;
    if (!dom.enabled(button)) return false;
    return DONE_TEXT.test(dom.textOf(button));
  }

  /**
   * Clicks "Mark as complete" on the current reading item.
   */
  async function completeReading(context = {}) {
    dom.assertActive(context);
    const currentKey = ROOT.courseMap?.currentItem()?.key;
    if (currentKey && ROOT.courseMap.completedKeys().includes(currentKey)) {
      log.log("Coursera đã xác nhận bài đọc này hoàn thành", "success");
      return true;
    }
    log.log("Đang tìm nút hoàn thành bài đọc...");

    const done = () =>
      dom.byText(
        SELECTORS.concat(['[role="status"]']),
        /^(completed|already complete|đã hoàn thành)$/i,
      );
    if (done()) return true;
    const button = await dom.waitFor(findButton, {
      ...context,
      timeout: 8000,
      interval: 300,
    });
    dom.assertActive(context);
    if (!button) {
      log.log(
        "Không thấy nút hoàn thành bài đọc; chưa được tính là hoàn thành",
        "info",
      );
      return false;
    }

    if (isAlreadyComplete(button)) {
      log.log("Bài đọc này đã được đánh dấu hoàn thành", "success");
      return true;
    }

    const before = dom.textOf(button);
    dom.click(button);

    const changed = await dom.waitFor(
      () =>
        done() ||
        (ROOT.courseMap &&
          ROOT.courseMap
            .completedKeys()
            .includes(ROOT.courseMap.currentItem()?.key)),
      { ...context, timeout: 7000, interval: 300 },
    );

    if (changed) {
      log.log("Đã đánh dấu hoàn thành bài đọc", "success");
      await dom.sleep(900, context);
      return true;
    }

    log.log("Đã bấm nút hoàn thành nhưng chưa thấy trạng thái đổi", "error");
    return false;
  }

  ROOT.reading = { completeReading };
})();
