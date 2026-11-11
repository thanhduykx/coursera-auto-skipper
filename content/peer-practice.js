// Practice assignments expose a review list; their detail page hides the quota.
(() => {
  const ROOT = globalThis.Skipper;
  const opened = new Set();
  const main = () =>
    document.querySelector("#main-container,.main-container,main");
  const text = (node) => (node?.innerText || "").replace(/\s+/g, " ").trim();
  function isPractice() {
    return /^Practice Peer-graded Assignment/i.test(
      text(document.querySelector("h1")),
    );
  }
  function reviewContext() {
    return /\/(?:give-feedback|review\/[^/]+)\/?$/.test(location.pathname);
  }
  function listTab() {
    return [...(main()?.querySelectorAll('[role="tab"],button') || [])].find(
      (node) =>
        node.getClientRects().length &&
        !node.disabled &&
        /^Peers to review$/i.test(text(node)),
    );
  }
  function links() {
    if (!isPractice() || !/\/give-feedback\/?$/.test(location.pathname))
      return [];
    // Only consume the list explicitly filtered to unreviewed projects.
    if (
      !/Submissions filtered by projects I have not reviewed/i.test(
        text(main()),
      )
    )
      return [];
    const scope = globalThis.SkipperPeerProgress.scope(location.href);
    return [...(main()?.querySelectorAll('a[href*="/review/"]') || [])].filter(
      (anchor) =>
        anchor.getClientRects().length &&
        anchor.origin === location.origin &&
        /\/review\/[^/]+\/?$/.test(anchor.pathname) &&
        globalThis.SkipperPeerProgress.scope(anchor.href) === scope,
    );
  }
  function openNext(progress, context) {
    if (!Number.isInteger(progress?.remaining) || progress.remaining <= 0)
      return false;
    const anchor = links().find((link) => !opened.has(link.href));
    if (!anchor) return false;
    ROOT.dom.assertActive(context);
    opened.add(anchor.href);
    anchor.click();
    return true;
  }
  function returnToList(context) {
    const tab = listTab();
    if (!isPractice() || !tab) return false;
    ROOT.dom.assertActive({ ...context, path: undefined });
    tab.click();
    return true;
  }
  ROOT.peerPractice = {
    isPractice,
    reviewContext,
    listTab,
    links,
    openNext,
    returnToList,
  };
})();
