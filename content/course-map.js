/**
 * Course Map: sidebar navigation & course structure harvester
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const { dom } = ROOT;

  const PATH_PREFIX = "/learn/";
  const NAV_SELECTOR =
    'nav, [role="navigation"], [class*="NavigationDrawer"], [class*="ItemRow"], [data-testid*="nav"]';

  /** pathname segment -> item kind */
  const SEGMENT_KIND = {
    lecture: "video",
    supplement: "reading",
    readingItem: "reading",
    exam: "quiz",
    quiz: "quiz",
    "assignment-submission": "quiz",
    discussionPrompt: "discussion",
    peer: "peer",
    staffGraded: "peer",
    programming: "programming",
    ungradedWidget: "widget",
    gradedWidget: "widget",
    ungradedLab: "lab",
    ungradedLti: "lab",
    gradedLti: "lab",
    interactivePlugin: "widget",
    dialogue: "widget",
    coach: "widget",
  };

  const KIND_LABEL = {
    video: "Video",
    reading: "Reading",
    quiz: "Quiz",
    discussion: "Thảo luận",
    peer: "Peer review",
    programming: "Lập trình",
    widget: "Widget",
    unknown: "Không rõ",
  };

  /** Only real content groups - never the nav drawer's own toggle. */
  const GROUP_PATTERN =
    /(week\s*\d|tuần\s*\d|module\s*\d|chương\s*\d|introduction|getting started|giới thiệu)/i;

  const READY_MARKERS = [
    '[data-testid="video-player"]',
    "video",
    'button[data-testid*="complete"]',
    '[data-testid*="question-container"]',
    '[data-testid*="quiz"]',
    '[data-testid*="Question"]',
    ".rc-FormPartsQuestion",
    "fieldset",
    "textarea",
    '[contenteditable="true"]',
    '[aria-label="Reading completed"]',
    "main h1",
    "#main-container h1",
    '[class*="main-container"] h1',
    '[data-testid="item-page"]',
    '[data-testid*="item-viewer"]',
  ];

  function currentPath() {
    return window.location.pathname.replace(/\/+$/, "");
  }

  function parse(href) {
    let url;
    try {
      url = new URL(href, window.location.origin);
    } catch (err) {
      return null;
    }
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "coursera.org" ||
        url.hostname.endsWith(".coursera.org")
      )
    )
      return null;
    if (url.pathname.indexOf(PATH_PREFIX) !== 0) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    // /learn/<slug>/<segment>/<id>/<name>
    if (parts.length < 4) return null;

    const segment = parts[2];
    const kind = SEGMENT_KIND[segment];
    if (!kind) return null;

    return {
      url: url.origin + url.pathname,
      path: url.pathname,
      slug: parts[1],
      segment,
      kind,
      id: parts[3],
      key: parts[1] + ":" + segment + ":" + parts[3],
    };
  }

  function currentItem() {
    const item = parse(currentPath());
    if (item && !item.title) {
      let title = "";
      if (typeof document !== "undefined") {
        if (dom?.queryAll) {
          const headings = dom.queryAll([
            "h1",
            '[class*="main-container"] h1',
            '[role="main"] h1',
            "main h1",
          ]);
          const found = headings.find((h) => {
            if (dom.visible && !dom.visible(h)) return false;
            const txt = (
              dom.textOf ? dom.textOf(h) : h.innerText || h.textContent || ""
            ).trim();
            if (!txt || /^(coursera|back|quay lại|<- back|← back)$/i.test(txt))
              return false;
            return true;
          });
          if (found) {
            title = (
              dom.textOf ? dom.textOf(found) : found.innerText || found.textContent || ""
            )
              .trim()
              .slice(0, 90);
          }
        } else if (document.querySelectorAll) {
          const list = document.querySelectorAll(
            'h1, [class*="main-container"] h1, [role="main"] h1, main h1',
          );
          for (let i = 0; i < list.length; i += 1) {
            const txt = (list[i].innerText || list[i].textContent || "").trim();
            if (txt && !/^(coursera|back|quay lại|<- back|← back)$/i.test(txt)) {
              title = txt.slice(0, 90);
              break;
            }
          }
        }
        if (!title && typeof document.title === "string") {
          const docTitle = document.title
            .replace(/\s*\|\s*Coursera.*$/i, "")
            .trim();
          if (docTitle && !/^(coursera|back)$/i.test(docTitle)) {
            title = docTitle.slice(0, 90);
          }
        }
      }
      item.title = title || item.id;
    }
    return item;
  }

  function isItemPage() {
    return Boolean(currentItem());
  }

  function courseSlug() {
    const item = currentItem();
    return item
      ? item.slug
      : currentPath().match(/^\/learn\/([a-zA-Z0-9._-]+)(?:\/|$)/)?.[1] || "";
  }

  /**
   * Opens collapsed week groups so their items are rendered in the DOM.
   * Coursera renders collapsed groups lazily, so a fresh page load may only
   * expose the current week. Only elements that look like a week header are
   * clicked, so the drawer's own toggle is never touched.
   */
  async function expandAllGroups(context = {}) {
    const toggles = dom.queryAll([
      'nav button[aria-expanded="false"]',
      '[class*="NavigationDrawer"] button[aria-expanded="false"]',
      '[role="navigation"] button[aria-expanded="false"]',
      'button[aria-expanded="false"]',
    ]);

    const targets = toggles.filter(
      (toggle) =>
        !dom.inPanel(toggle) &&
        /(?:module\s*\d|week\s*(?:\d|one|two|three|four|five|six)|lesson\s*\d|tuần\s*\d|chương\s*\d)/i.test(
          dom.textOf(toggle),
        ),
    );
    const limit = Math.min(targets.length, 40);

    for (let i = 0; i < limit; i += 1) {
      dom.assertActive(context);
      dom.click(targets[i]);
      await dom.sleep(80, context);
    }
    if (limit) await dom.sleep(400, context);
    return limit;
  }

  function collectAnchors() {
    const anchors = Array.prototype.slice.call(
      document.querySelectorAll('a[href*="' + PATH_PREFIX + '"]'),
    );
    const inNav = anchors.filter(
      (anchor) =>
        Boolean(anchor.closest(NAV_SELECTOR)) &&
        !!parse(anchor.getAttribute("href")),
    );
    if (inNav.length) return inNav;

    const valid = anchors.filter((anchor) => {
      const info = parse(anchor.getAttribute("href"));
      if (!info) return false;
      const txt = (anchor.innerText || anchor.textContent || "")
        .trim()
        .toLowerCase();
      if (/^(back|quay lại|home|trang chủ|<- back|← back)$/i.test(txt))
        return false;
      return true;
    });

    return valid.length >= 2 ? valid : [];
  }

  /** Ordered, de-duplicated list of course items found in the sidebar. */
  function harvest() {
    const seen = Object.create(null);
    const items = [];

    collectAnchors().forEach((anchor) => {
      const info = parse(anchor.getAttribute("href"));
      if (!info || info.slug !== courseSlug() || seen[info.key]) return;
      seen[info.key] = true;
      info.title =
        (anchor.innerText || anchor.textContent || "")
          .split(/\n/)
          .map((line) => line.trim())
          .find(Boolean)
          ?.slice(0, 90) || info.id;
      info.anchor = anchor;
      items.push(info);
    });

    return items;
  }

  function indexOfKey(items, key) {
    if (!key) return -1;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].key === key) return i;
    }
    return -1;
  }

  function indexOfCurrent(items) {
    const item = currentItem();
    if (!item) return -1;
    const direct = indexOfKey(items, item.key);
    if (direct !== -1) return direct;
    for (let i = 0; i < items.length; i += 1) {
      const candidate = items[i];
      if (
        candidate &&
        candidate.id === item.id &&
        candidate.kind === "quiz" &&
        item.kind === "quiz"
      ) {
        return i;
      }
    }
    return -1;
  }

  /** Finds the sidebar link for `item` and clicks it; falls back to assignment. */
  async function navigateTo(item, context = {}) {
    dom.assertActive(context);
    if (!item || item.slug !== courseSlug() || !parse(item.url)) return false;

    let anchor = item.anchor && item.anchor.isConnected ? item.anchor : null;
    if (!anchor) {
      const fresh = harvest();
      const index = indexOfKey(fresh, item.key);
      anchor = index === -1 ? null : fresh[index].anchor;
    }

    if (anchor && dom.click(anchor)) return true;
    if (item.url) {
      window.location.assign(item.url);
      return true;
    }
    return false;
  }

  /** Waits for the SPA to land on `item` and for the item body to render. */
  async function waitForItemReady(item, context = {}) {
    const arrived = await dom.waitFor(
      () => {
        const here = currentItem();
        return Boolean(here && here.key === item.key);
      },
      { ...context, timeout: 20000, interval: 250 },
    );

    if (!arrived) return false;

    const body = await dom.waitFor(
      () => {
        if (!dom.queryAll(READY_MARKERS).some(dom.visible)) return null;
        const title = dom.normalize(item.title || "");
        const headings = dom
          .queryAll([
            "main h1",
            '[role="main"] h1',
            '[class*="main-container"] h1',
            "h1",
          ])
          .filter(dom.visible);
        if (
          title &&
          headings.length &&
          !headings.some((heading) => {
            const actual = dom.normalize(dom.textOf(heading));
            return actual && (actual.includes(title) || title.includes(actual));
          })
        )
          return null;
        return true;
      },
      { ...context, timeout: 8000, interval: 250 },
    );
    if (!body) return false;
    await dom.sleep(700, context);
    return true;
  }

  /** Best-effort detection of completed rows in the sidebar. */
  function completedKeys() {
    const done = Object.create(null);
    collectAnchors().forEach((anchor) => {
      const info = parse(anchor.getAttribute("href"));
      if (!info || info.slug !== courseSlug() || done[info.key]) return;
      const row =
        anchor.closest('li, [role="listitem"], [class*="ItemRow"]') ||
        anchor.parentElement;
      if (!row) return;
      const ownLabel = anchor.getAttribute("aria-label") || "";
      const explicitLabel =
        /(?:^|,)\s*(completed|complete|đã hoàn thành)\s*(?:,|$)/i.test(
          ownLabel,
        );
      const explicitIcon = !!anchor.querySelector(
        '[data-testid="learn-item-success-icon"], [data-testid="completed"], [data-testid="item-completed"], [aria-label="Completed"], [aria-label="Complete"]',
      );
      // A module container may contain other completed items; only inspect a
      // legacy row when it owns this one course link.
      const singleRow = row.querySelectorAll('a[href*="/learn/"]').length <= 1;
      const flagged =
        explicitLabel ||
        explicitIcon ||
        (singleRow &&
          (/(?:^|\s)completed(?:\s|$)/i.test(String(row.className || "")) ||
            !!row.querySelector(
              '[data-testid="completed"], [data-testid="item-completed"], [aria-label="Completed"], [aria-label="Complete"]',
            ) ||
            /^(completed|đã hoàn thành)$/i.test(
              row.getAttribute("aria-label") || "",
            )));
      if (flagged) done[info.key] = true;
    });
    return Object.keys(done);
  }

  function kindLabel(kind) {
    return KIND_LABEL[kind] || KIND_LABEL.unknown;
  }

  ROOT.courseMap = {
    harvest,
    indexOfKey,
    indexOfCurrent,
    currentItem,
    isItemPage,
    currentPath,
    navigateTo,
    waitForItemReady,
    expandAllGroups,
    completedKeys,
    courseSlug,
    kindLabel,
    parse,
  };
})();
