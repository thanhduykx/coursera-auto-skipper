/**
 * Coursera Peer Review Progress & Scoping
 * Dev by thanh duyvp
 */
(() => {
  function scope(url) {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        !(
          parsed.hostname === "coursera.org" ||
          parsed.hostname.endsWith(".coursera.org")
        )
      )
        return null;
      const match = parsed.pathname.match(
        /^\/learn\/([a-zA-Z0-9._-]+)\/peer\/([a-zA-Z0-9._-]+)(?:\/|$)/,
      );
      return match ? `${match[1]}:${match[2]}` : null;
    } catch {
      return null;
    }
  }

  function parse(text) {
    if (typeof text !== "string" || text.length > 1000) return null;
    const normalized = text.replace(/\s+/g, " ").trim();
    const pair = normalized.match(
      /(\d+)\s*(?:of|\/)\s*(\d+)\s*(?:peer\s+)?reviews?\s*(?:completed|submitted)/i,
    );
    if (pair) {
      const completed = Number(pair[1]),
        total = Number(pair[2]);
      return total <= 100 && completed <= total
        ? { remaining: total - completed, total, completed }
        : null;
    }
    const complete = normalized.match(/^(\d+)\s+complete(?:d)?$/i);
    if (complete && Number(complete[1]) <= 100)
      return {
        remaining: 0,
        total: Number(complete[1]),
        completed: Number(complete[1]),
      };
    const left =
      normalized.match(/(?:^|\b)(\d+)\s+(?:reviews?\s+)?left to complete\b/i) ||
      normalized.match(
        /còn\s+(\d+)\s+(?:lượt|bài)(?:\s+cần)?\s+(?:chấm|đánh giá)/i,
      );
    if (left && Number(left[1]) <= 100) return { remaining: Number(left[1]) };
    return null;
  }

  globalThis.SkipperPeerProgress = { scope, parse };
})();
