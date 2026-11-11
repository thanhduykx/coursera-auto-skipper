/**
 * Peer score parser and selector
 * Dev by thanh duyvp
 */
(() => {
  function score(label, explicit = null) {
    if (
      explicit !== null &&
      /^-?\d+(?:[.,]\d+)?$/.test(String(explicit).trim())
    ) {
      const number = Number(String(explicit).replace(",", "."));
      return Number.isFinite(number) && Math.abs(number) <= 1000000
        ? number
        : null;
    }
    if (
      typeof label !== "string" ||
      label.length > 12000 ||
      /\d\s*[-–—/]\s*\d/.test(label)
    )
      return null;
    const numbers = [];
    const patterns = [
      /(-?\d+(?:[.,]\d+)?)\s*(?:points?|pts?\.?|điểm)\b/gi,
      /(?:points?|pts?\.?|điểm)\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/gi,
    ];
    for (const pattern of patterns)
      for (const match of label.matchAll(pattern))
        numbers.push(Number(match[1].replace(",", ".")));
    const unique = [...new Set(numbers)];
    return unique.length === 1 &&
      Number.isFinite(unique[0]) &&
      Math.abs(unique[0]) <= 1000000
      ? unique[0]
      : null;
  }

  function highest(options) {
    const scores = options.map((option) => score(option.label, option.points));
    if (!scores.length || scores.some((value) => value === null))
      throw new Error(
        "Không đọc rõ điểm của mọi lựa chọn; không tự chọn theo vị trí.",
      );
    return scores.indexOf(Math.max(...scores));
  }

  globalThis.SkipperPeerScore = { score, highest };
})();
