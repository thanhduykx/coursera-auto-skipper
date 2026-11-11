/**
 * DOM Utilities for Coursera Auto Skipper
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});

  /** The floating panel & pill live on the page; automation must never touch them. */
  const PANEL_ID = "skipper-auto-panel";
  const PILL_ID = "skipper-auto-pill";

  function assertActive(context = {}) {
    const signal = context.signal || ROOT.instance?.signal;
    if (signal?.aborted) throw new DOMException("Tác vụ đã dừng", "AbortError");
    if (context.path && context.path !== location.pathname)
      throw new DOMException("Đã chuyển bài", "AbortError");
    context.assertActive?.();
  }
  function sleep(ms, context = {}) {
    assertActive(context);
    const signal = context.signal || ROOT.instance?.signal;
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Tác vụ đã dừng", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        try {
          assertActive(context);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, ms);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  }

  function awaitTask(task, context = {}, timeout = 8000) {
    assertActive(context);
    const signal = context.signal || ROOT.instance?.signal;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Tác vụ đã dừng", "AbortError"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Thao tác không phản hồi đúng hạn"));
      }, timeout);
      signal?.addEventListener("abort", abort, { once: true });
      Promise.resolve(task).then(
        (value) => {
          cleanup();
          try {
            assertActive(context);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          cleanup();
          reject(error);
        },
      );
      if (signal?.aborted) abort();
    });
  }

  function inPanel(el) {
    return Boolean(
      el &&
      el.closest &&
      (el.closest("#" + PANEL_ID) || el.closest("#" + PILL_ID))
    );
  }

  function queryAll(selectors, scope) {
    const host = scope || document;
    const found = [];
    selectors.forEach((selector) => {
      let nodes = [];
      try {
        nodes = host.querySelectorAll(selector);
      } catch (err) {
        return;
      }
      nodes.forEach((node) => {
        if (found.indexOf(node) !== -1) return;
        if (inPanel(node)) return;
        found.push(node);
      });
    });
    return found;
  }

  function query(selectors, scope) {
    const list = queryAll(selectors, scope);
    return list.length ? list[0] : null;
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hidden) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function enabled(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    return true;
  }

  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function textOf(el) {
    if (!el) return "";
    return String(el.innerText || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * React (and most SPAs) attach their listeners at the root, so a plain
   * element.click() is usually enough - but a full pointer sequence is more
   * faithful for components that listen for pointerdown/mouseup themselves.
   */
  function click(el) {
    if (!el || !el.isConnected || !enabled(el) || inPanel(el)) return false;
    try {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (err) {
      /* non-scrollable ancestors are fine */
    }
    const rect = el.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
    const pointerOpts = Object.assign(
      { pointerId: 1, isPrimary: true, pointerType: "mouse" },
      opts,
    );
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", pointerOpts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", pointerOpts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.click();
      return true;
    } catch (err) {
      try {
        el.click();
        return true;
      } catch (inner) {
        return false;
      }
    }
  }

  /** Waits for predicate() to return a truthy value. */
  async function waitFor(predicate, options) {
    const cfg = options || {};
    const timeout = cfg.timeout === undefined ? 8000 : cfg.timeout;
    const interval = cfg.interval === undefined ? 200 : cfg.interval;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      assertActive(cfg);
      let value = null;
      try {
        value = predicate();
      } catch (err) {
        value = null;
      }
      if (value) {
        assertActive(cfg);
        return value;
      }
      await sleep(interval, cfg);
    }
    return null;
  }

  /** Waits for the first visible element matching any selector. */
  function waitForElement(selectors, options) {
    return waitFor(() => {
      const el = query(selectors);
      return el && visible(el) ? el : null;
    }, options);
  }

  /** First visible, enabled element whose text matches `pattern`. */
  function byText(selectors, pattern, scope) {
    const candidates = queryAll(selectors, scope);
    for (let i = 0; i < candidates.length; i += 1) {
      const el = candidates[i];
      if (!visible(el) || !enabled(el)) continue;
      if (pattern.test(textOf(el))) return el;
    }
    return null;
  }

  ROOT.dom = {
    assertActive,
    awaitTask,
    sleep,
    inPanel,
    query,
    queryAll,
    visible,
    enabled,
    normalize,
    textOf,
    click,
    waitFor,
    waitForElement,
    byText,
  };
})();
