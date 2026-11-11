// Only Coursera's review counter advances this ledger. Filling is not submitting.
(() => {
  const ROOT = globalThis.Skipper;
  let current = null,
    lastObservation = "",
    pending = null;
  function show() {
    const output = document.getElementById("sp-peer-progress");
    if (!output) return;
    output.textContent =
      current?.remaining !== undefined
        ? (current.remaining === 0
            ? "Đã đủ lượt Peer Review theo Coursera."
            : `Còn ${current.remaining} lượt cần chấm theo Coursera.`) +
          (current.total !== null
            ? ` Đã nộp ${current.completed}/${current.total}.`
            : current.confirmed > 0
              ? ` Đã xác nhận thêm ${current.confirmed} lượt kể từ khi theo dõi.`
              : "")
        : "Số lượt: mở Review Your Peers để đọc chỉ tiêu của bài này.";
  }
  async function refresh() {
    const scope = globalThis.SkipperPeerProgress.scope(location.href);
    if (!scope) {
      current = null;
      lastObservation = "";
      show();
      return null;
    }
    const element = document.querySelector('[data-testid="review-count"]');
    const observed = element?.getClientRects().length
      ? globalThis.SkipperPeerProgress.parse(element.innerText)
      : null;
    const observation = JSON.stringify([scope, observed]);
    if (observation === lastObservation) {
      show();
      return current;
    }
    if (pending) {
      await pending;
      return refresh();
    }
    pending = chrome.runtime
      .sendMessage({ type: "PEER_PROGRESS", observed, url: location.href })
      .then((result) => {
        if (!result?.ok)
          throw new Error(
            result?.error || "Không đọc được số lượt Peer Review",
          );
        if (globalThis.SkipperPeerProgress.scope(location.href) !== scope)
          return null;
        lastObservation = observation;
        current = result.progress;
        show();
        return current;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }
  const changed = (changes, area) => {
    const scope = globalThis.SkipperPeerProgress.scope(location.href);
    if (area === "local" && scope && changes[`peerProgress:${scope}`]) {
      current = changes[`peerProgress:${scope}`].newValue || null;
      show();
    }
  };
  chrome.storage.onChanged.addListener(changed);
  ROOT.instance.addCleanup(() =>
    chrome.storage.onChanged.removeListener(changed),
  );
  ROOT.peerTracker = { refresh, show };
})();
