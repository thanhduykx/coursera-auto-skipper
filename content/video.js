/**
 * Auto Skip Video (In-page 16x speed booster & seek end)
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const { dom, log } = ROOT;

  const FIND_TIMEOUT = 15000;
  const METADATA_TIMEOUT = 20000;
  const END_TIMEOUT = 45000;
  const MAX_RATE = 16;
  const END_TOLERANCE = 0.75;
  const MIN_WIDTH = 120;
  const MIN_HEIGHT = 80;

  const PLAY_BUTTONS = [
    '[data-testid="play-button"]',
    'button[aria-label="Play"]',
    'button[aria-label="Phát"]',
    ".vjs-big-play-button",
    ".rc-VideoPlayer__playButton",
  ];

  function sized(video) {
    const rect = video.getBoundingClientRect();
    return rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT;
  }

  function findVisibleVideos() {
    const videos = dom.queryAll(["video"]);
    return videos.filter(
      (video) => video.isConnected && dom.visible(video) && sized(video),
    );
  }

  async function findVideo(context = {}) {
    return dom.waitFor(
      () => {
        const videos = findVisibleVideos();
        return videos.length ? videos[0] : null;
      },
      { ...context, timeout: FIND_TIMEOUT, interval: 300 },
    );
  }

  async function ensurePlaying(video, context = {}) {
    dom.assertActive(context);
    if (!video.paused && !video.ended) return true;
    try {
      await dom.awaitTask(video.play(), context);
      return true;
    } catch (err) {
      dom.assertActive(context);
      /* autoplay was refused - fall through to clicking a UI control */
    }
    const overlay = dom.query(PLAY_BUTTONS);
    if (overlay) dom.click(overlay);
    dom.click(video);
    await dom.sleep(400, context);
    try {
      await dom.awaitTask(video.play(), context);
      return true;
    } catch (err) {
      dom.assertActive(context);
      return false;
    }
  }

  /** Coursera's player resets playbackRate, so re-apply it a few times. */
  async function boostPlaybackRate(video, context = {}) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      dom.assertActive(context);
      try {
        video.muted = true;
        video.volume = 0;
        video.playbackRate = MAX_RATE;
      } catch (err) {
        /* non-fatal: some players lock these properties */
      }
      await dom.sleep(300, context);
    }
    return video.playbackRate;
  }

  function seekToEnd(video) {
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return null;
    const target = Math.max(duration - END_TOLERANCE, 0);
    if (video.currentTime >= target) return target;
    try {
      video.currentTime = target;
      return target;
    } catch (err) {
      return null;
    }
  }

  function hasReachedEnd(video) {
    return video.ended === true;
  }

  async function waitForEnd(video, context = {}) {
    const reached = await dom.waitFor(() => hasReachedEnd(video), {
      ...context,
      timeout: END_TIMEOUT,
      interval: 400,
    });
    if (!reached) return false;
    // Give Coursera a moment to persist the progress before we navigate away.
    await dom.sleep(1200, context);
    return true;
  }

  async function skipOne(video, index, context = {}) {
    const original = {
      muted: video.muted,
      volume: video.volume,
      playbackRate: video.playbackRate,
      paused: video.paused,
    };
    try {
      const label = index === 0 ? "video" : "video " + (index + 1);
      if (video.readyState < 1) {
        await dom.waitFor(() => video.readyState >= 1, {
          ...context,
          timeout: METADATA_TIMEOUT,
          interval: 250,
        });
      }

      video.muted = true;
      video.volume = 0;
      if (!(await ensurePlaying(video, context))) return false;
      dom.assertActive(context);
      const rate = await boostPlaybackRate(video, context);

      const duration = Number(video.duration);
      dom.assertActive(context);
      const target = seekToEnd(video);

      if (target === null) {
        log.log(
          "Không đọc được thời lượng của " + label + ", chỉ tăng tốc độ phát",
          "error",
        );
      } else {
        log.log(
          "Đã tua " +
            label +
            " tới " +
            Math.round(target) +
            "s / " +
            Math.round(duration) +
            "s (x" +
            rate +
            ")",
          "success",
        );
      }

      if (!(await ensurePlaying(video, context))) return false;
      dom.assertActive(context);
      const finished = await waitForEnd(video, context);
      if (finished) {
        log.log("Đã phát xong " + label, "success");
        return true;
      }
      log.log("Chưa xác nhận được " + label + " đã kết thúc", "error");
      return false;
    } finally {
      video.muted = original.muted;
      video.volume = original.volume;
      video.playbackRate = original.playbackRate;
      if (context.signal?.aborted && original.paused) video.pause();
    }
  }

  /**
   * Skips every visible video on the current page.
   * Returns true only when every visible video emitted an ended state.
   */
  async function skipVideos(context = {}) {
    log.log("Đang tìm video...");
    const first = await findVideo(context);
    if (!first) {
      log.log("Trang này không có video", "error");
      return false;
    }

    const videos = findVisibleVideos();
    let completed = 0;
    for (let i = 0; i < videos.length; i += 1) {
      const ok = await skipOne(videos[i], i, context);
      if (ok) completed += 1;
      if (videos.length > 1) await dom.sleep(400, context);
    }
    return completed === videos.length && completed > 0;
  }

  ROOT.video = { skipVideos, findVideo, hasReachedEnd };
})();
