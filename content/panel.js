/**
 * Floating UI Control Panel for Coursera Auto Skipper
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const { dom, log, state } = ROOT;

  const PANEL_ID = "skipper-auto-panel";
  const PILL_ID = "skipper-auto-pill";
  const MAX_LOG_ROWS = 40;

  const ICONS = {
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    stop: '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    fast: '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
  };

  function svg(name, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }

  function featureRow(id, icon, title, desc, checked = true) {
    return `
      <div class="sp-feature-item">
        <div class="sp-feature-left">
          <span class="sp-feat-icon feat-${id}">${svg(icon, 15)}</span>
          <div class="sp-feat-text">
            <span class="sp-feat-title">${title}</span>
            <span class="sp-feat-desc">${desc}</span>
          </div>
        </div>
        <label class="sp-toggle-switch">
          <input type="checkbox" id="sp-opt-${id}" ${checked ? "checked" : ""}>
          <span class="sp-slider"></span>
        </label>
      </div>`;
  }

  function skeleton() {
    return `
      <div class="sp-panel-inner">
        <!-- Header -->
        <div class="sp-header">
          <div class="sp-header-left">
            <div class="sp-logo-badge">${svg("bolt", 18)}</div>
            <div>
              <div class="sp-app-title">
                Coursera Auto Skipper
                <span class="sp-dev-tag">dev by thanh duyvp</span>
              </div>
              <div class="sp-status" id="sp-status">
                <span class="sp-status-dot"></span>
                <span id="sp-status-text">Đang kiểm tra...</span>
              </div>
            </div>
          </div>
          <div class="sp-header-actions">
            <button id="sp-theme-btn" type="button" title="Chuyển chế độ Sáng / Tối" aria-label="Đổi theme">${svg("moon", 15)}</button>
            <button id="sp-options-btn" type="button" title="Mở trang Cài đặt" aria-label="Cài đặt">${svg("gear", 15)}</button>
            <button id="sp-minimize-btn" type="button" title="Thu nhỏ" aria-label="Thu nhỏ">${svg("minus", 15)}</button>
            <button id="sp-close-btn" type="button" title="Đóng panel" aria-label="Đóng">${svg("close", 15)}</button>
          </div>
        </div>

        <!-- Body -->
        <div class="sp-body">
          <!-- Progress Card -->
          <div class="sp-progress-card">
            <div class="sp-progress-header">
              <span>Tiến độ hoàn thành khóa học</span>
              <strong id="sp-progress-text">0%</strong>
            </div>
            <div class="sp-progress-track">
              <div class="sp-progress-fill" id="sp-progress-fill" style="width: 0%"></div>
            </div>
          </div>

          <!-- Main CTA Controls -->
          <div class="sp-main-controls">
            <button id="sp-start" class="sp-btn sp-btn-primary" type="button">
              ${svg("play", 14)} Bắt đầu Auto Skip
            </button>
            <button id="sp-stop" class="sp-btn sp-btn-danger" type="button" disabled>
              ${svg("stop", 14)} Dừng
            </button>
          </div>

          <!-- Quick Action Buttons -->
          <div class="sp-quick-actions">
            <button id="sp-fast-skip-btn" class="sp-chip-btn" type="button" title="Xử lý Video & Reading siêu tốc qua API">
              ${svg("fast", 12)} Skip Video + Reading (API)
            </button>
            <button id="sp-quick-peer-btn" class="sp-chip-btn" type="button" title="Chấm bài Peer Review hiện tại">
              ${svg("users", 12)} Chấm Peer Review
            </button>
            <button id="sp-quick-disc-btn" class="sp-chip-btn" type="button" title="Gửi phản hồi Thảo Luận">
              ${svg("chat", 12)} Gửi Thảo luận
            </button>
          </div>

          <!-- Activity Banner -->
          <div id="sp-activity" class="sp-activity-banner" role="status" aria-live="polite">
            Sẵn sàng. Chọn các tính năng rồi nhấn Bắt đầu.
          </div>

          <!-- Navigation Tabs -->
          <div class="sp-tabs">
            <button class="sp-tab-btn active" data-tab="auto">${svg("bolt", 13)} Tự động</button>
            <button class="sp-tab-btn" data-tab="peer">${svg("users", 13)} Peer Review</button>
            <button class="sp-tab-btn" data-tab="log">${svg("chat", 13)} Nhật ký</button>
          </div>

          <!-- Tab 1: Auto Controls -->
          <div class="sp-tab-content active" id="sp-tab-auto">
            <div class="sp-features-list">
              ${featureRow("video", "video", "Auto Skip Video", "Tăng tốc player 16x hoặc hoàn thành nhanh qua API")}
              ${featureRow("reading", "book", "Auto Skip Reading", "Tự động bấm Mark as complete và xác nhận")}
              ${featureRow("peer", "users", "Peer to Peer Review", "Tự động chấm điểm rubric, điền nhận xét và nộp")}
              ${featureRow("discussion", "chat", "Discussion Prompt", "Tự soạn và gửi phản hồi thảo luận")}
            </div>
          </div>

          <!-- Tab 2: Peer Review Workspace -->
          <div class="sp-tab-content" id="sp-tab-peer">
            <div class="sp-peer-card">
              <div class="sp-peer-badge-info" id="sp-peer-progress">
                Đang kiểm tra chỉ tiêu Peer Review...
              </div>

              <div class="sp-form-group">
                <label class="sp-label" for="sp-peer-mode">Chiến lược chấm điểm:</label>
                <select id="sp-peer-mode" class="sp-select">
                  <option value="highest">Điểm cao nhất (Max Rubric Points)</option>
                  <option value="last">Mục cuối cùng mỗi tiêu chí</option>
                  <option value="keep">Giữ nguyên điểm đã chọn</option>
                </select>
              </div>

              <div class="sp-form-group">
                <label class="sp-label" for="sp-peer-comment">Nội dung nhận xét đánh giá:</label>
                <textarea id="sp-peer-comment" class="sp-textarea" rows="2" placeholder="Nhập mẫu nhận xét..."></textarea>
              </div>

              <div class="sp-peer-toggles">
                <label class="sp-checkbox-label">
                  <input type="checkbox" id="sp-peer-submit" checked>
                  <span>Tự động nộp và mở bài tiếp theo</span>
                </label>
                <label class="sp-checkbox-label">
                  <input type="checkbox" id="sp-peer-scan" checked>
                  <span>Tự động quét toàn bộ bài Peer Review trong khóa</span>
                </label>
              </div>

              <div class="sp-peer-actions">
                <button id="sp-peer-scan-btn" class="sp-btn sp-btn-secondary" type="button">
                  ${svg("users", 13)} Quét & Chấm toàn khóa
                </button>
                <button id="sp-get-link-btn" class="sp-btn sp-btn-outline" type="button">
                  ${svg("link", 13)} Lấy link bài nộp
                </button>
              </div>
              <div id="sp-peer-status" class="sp-subtext"></div>
            </div>
          </div>

          <!-- Tab 3: Logs -->
          <div class="sp-tab-content" id="sp-tab-log">
            <div class="sp-log-header">
              <span>Hoạt động gần đây</span>
              <button id="sp-clear-log" class="sp-btn-link" type="button">Xóa nhật ký</button>
            </div>
            <div class="sp-log-container" id="sp-log"></div>
          </div>
        </div>

        <!-- Footer -->
        <div class="sp-footer">
          <span>Coursera Auto Skipper v1.0.0</span>
          <a href="https://github.com/thanhduykx/coursera-auto-skipper" target="_blank" rel="noopener noreferrer">dev by thanh duyvp</a>
        </div>
      </div>
    `;
  }

  function pillSkeleton() {
    return `
      <div id="${PILL_ID}" class="sp-floating-pill" title="Mở Coursera Auto Skipper (dev by thanh duyvp)">
        <span class="sp-pill-icon">${svg("bolt", 16)}</span>
        <span class="sp-pill-text" id="sp-pill-text">Skipper</span>
        <span class="sp-pill-pct" id="sp-pill-pct">0%</span>
      </div>
    `;
  }

  let mounted = false;

  async function mount() {
    if (document.getElementById(PANEL_ID)) return;
    const container = document.createElement("aside");
    container.id = PANEL_ID;
    container.innerHTML = skeleton();
    document.body.appendChild(container);

    const pill = document.createElement("div");
    pill.innerHTML = pillSkeleton();
    document.body.appendChild(pill.firstElementChild);

    initEvents();
    await applyStoredPreferences();
    mounted = true;
  }

  function initEvents() {
    const panel = document.getElementById(PANEL_ID);
    const pill = document.getElementById(PILL_ID);
    if (!panel) return;

    // Minimize / Expand
    panel.querySelector("#sp-minimize-btn")?.addEventListener("click", () => {
      panel.classList.add("minimized");
      if (pill) pill.classList.add("visible");
    });

    panel.querySelector("#sp-close-btn")?.addEventListener("click", () => {
      panel.classList.add("minimized");
      if (pill) pill.classList.add("visible");
    });

    pill?.addEventListener("click", () => {
      panel.classList.remove("minimized");
      pill.classList.remove("visible");
    });

    // Theme toggle
    panel.querySelector("#sp-theme-btn")?.addEventListener("click", toggleTheme);

    // Options page button
    panel.querySelector("#sp-options-btn")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    });

    // Tabs
    panel.querySelectorAll(".sp-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        panel.querySelectorAll(".sp-tab-btn").forEach((b) => b.classList.remove("active"));
        panel.querySelectorAll(".sp-tab-content").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        const target = panel.querySelector(`#sp-tab-${btn.dataset.tab}`);
        if (target) target.classList.add("active");
      });
    });

    // Start / Stop
    panel.querySelector("#sp-start")?.addEventListener("click", async () => {
      const options = gatherOptions();
      try {
        await ROOT.runner.start(options);
      } catch (err) {
        log.log("Không thể bắt đầu: " + err.message, "error");
      }
    });

    panel.querySelector("#sp-stop")?.addEventListener("click", async () => {
      await ROOT.runner.stop("Đã dừng theo yêu cầu của bạn.");
    });

    // Quick Actions
    panel.querySelector("#sp-fast-skip-btn")?.addEventListener("click", async () => {
      try {
        log.log("Đang bắt đầu xử lý Video & Reading qua API...", "info");
        await ROOT.lessonBackground.start({ video: true, reading: true });
      } catch (err) {
        log.log(err.message, "error");
      }
    });

    panel.querySelector("#sp-quick-peer-btn")?.addEventListener("click", async () => {
      try {
        log.log("Đang xử lý bài Peer Review...", "info");
        await ROOT.peerReview.process();
      } catch (err) {
        log.log(err.message, "error");
      }
    });

    panel.querySelector("#sp-quick-disc-btn")?.addEventListener("click", async () => {
      try {
        log.log("Đang gửi phản hồi thảo luận...", "info");
        await ROOT.discussion.processDiscussion();
      } catch (err) {
        log.log(err.message, "error");
      }
    });

    panel.querySelector("#sp-peer-scan-btn")?.addEventListener("click", async () => {
      try {
        const settings = await globalThis.SkipperPeerSettings.read();
        await ROOT.peerScan?.start(settings);
      } catch (err) {
        log.log(err.message, "error");
      }
    });

    panel.querySelector("#sp-get-link-btn")?.addEventListener("click", async () => {
      try {
        log.log("Đang lấy link bài nộp...", "info");
        const res = await chrome.runtime.sendMessage({ type: "GET_SUBMISSION_LINK" });
        if (res?.ok && res.url) {
          await navigator.clipboard.writeText(res.url);
          log.log("Đã copy link bài nộp vào Clipboard: " + res.url, "success");
        } else {
          log.log(res?.error || "Không lấy được link bài nộp.", "error");
        }
      } catch (err) {
        log.log(err.message, "error");
      }
    });

    // Clear log
    panel.querySelector("#sp-clear-log")?.addEventListener("click", () => {
      const box = panel.querySelector("#sp-log");
      if (box) box.innerHTML = "";
    });

    // Option switches save on change
    panel.querySelectorAll('.sp-toggle-switch input[type="checkbox"]').forEach((input) => {
      input.addEventListener("change", () => {
        saveOptions();
      });
    });

    // Peer settings save on change
    panel.querySelector("#sp-peer-mode")?.addEventListener("change", savePeerSettings);
    panel.querySelector("#sp-peer-comment")?.addEventListener("blur", savePeerSettings);
    panel.querySelector("#sp-peer-submit")?.addEventListener("change", savePeerSettings);
    panel.querySelector("#sp-peer-scan")?.addEventListener("change", savePeerSettings);

    // Subscribe to logs
    log.subscribe((entry) => {
      renderLogEntry(entry);
    });
  }

  function renderLogEntry(entry) {
    const box = document.getElementById("sp-log");
    if (!box) return;
    const row = document.createElement("div");
    row.className = `sp-log-row sp-log-${entry.level}`;
    row.innerHTML = `<span class="sp-log-time">${entry.stamp}</span><span class="sp-log-text">${entry.text}</span>`;
    box.appendChild(row);
    if (box.children.length > MAX_LOG_ROWS) {
      box.removeChild(box.firstChild);
    }
    box.scrollTop = box.scrollHeight;
  }

  function gatherOptions() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return { video: true, reading: true, peer: true, discussion: true };
    return {
      video: panel.querySelector("#sp-opt-video")?.checked !== false,
      reading: panel.querySelector("#sp-opt-reading")?.checked !== false,
      peer: panel.querySelector("#sp-opt-peer")?.checked !== false,
      discussion: panel.querySelector("#sp-opt-discussion")?.checked !== false,
    };
  }

  async function saveOptions() {
    try {
      await state.saveOptions(gatherOptions());
    } catch {}
  }

  async function savePeerSettings() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel || !globalThis.SkipperPeerSettings) return;
    try {
      await globalThis.SkipperPeerSettings.write({
        mode: panel.querySelector("#sp-peer-mode")?.value || "highest",
        comment: panel.querySelector("#sp-peer-comment")?.value || "",
        autoSubmit: panel.querySelector("#sp-peer-submit")?.checked !== false,
        scanCourse: panel.querySelector("#sp-peer-scan")?.checked !== false,
      });
    } catch {}
  }

  async function applyStoredPreferences() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    try {
      const opts = await state.getOptions();
      const featureOpts = opts?.options || opts;
      if (featureOpts) {
        for (const [key, val] of Object.entries(featureOpts)) {
          const el = panel.querySelector(`#sp-opt-${key}`);
          if (el) el.checked = val === true;
        }
      }
      const allSettings = await globalThis.SkipperOptions?.readAll().catch(() => null);
      const currentTheme = allSettings?.theme || "auto";
      if (currentTheme === "dark" || (currentTheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        panel.classList.add("dark");
      } else {
        panel.classList.remove("dark");
      }

      if (globalThis.SkipperPeerSettings) {
        const peer = await globalThis.SkipperPeerSettings.read();
        const modeEl = panel.querySelector("#sp-peer-mode");
        if (modeEl && peer.mode) modeEl.value = peer.mode;
        const commentEl = panel.querySelector("#sp-peer-comment");
        if (commentEl && peer.comment) commentEl.value = peer.comment;
        const submitEl = panel.querySelector("#sp-peer-submit");
        if (submitEl) submitEl.checked = peer.autoSubmit !== false;
        const scanEl = panel.querySelector("#sp-peer-scan");
        if (scanEl) scanEl.checked = peer.scanCourse !== false;
      }
    } catch {}
  }

  function toggleTheme() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const isDark = panel.classList.toggle("dark");
    chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      settings: { theme: isDark ? "dark" : "light" },
    }).catch(() => {});
  }

  function setProgress(percent) {
    const pct = Math.max(0, Math.min(100, Math.round(percent) || 0));
    const fill = document.getElementById("sp-progress-fill");
    const text = document.getElementById("sp-progress-text");
    const pillPct = document.getElementById("sp-pill-pct");
    if (fill) fill.style.width = pct + "%";
    if (text) text.textContent = pct + "%";
    if (pillPct) pillPct.textContent = pct + "%";
  }

  function setStatus(text, level = "info") {
    const statusText = document.getElementById("sp-status-text");
    const statusBox = document.getElementById("sp-status");
    const pillText = document.getElementById("sp-pill-text");
    if (statusText) statusText.textContent = text;
    if (statusBox) statusBox.className = "sp-status " + level;
    if (pillText) pillText.textContent = text;
  }

  function setRunning(running) {
    const startBtn = document.getElementById("sp-start");
    const stopBtn = document.getElementById("sp-stop");
    const pill = document.getElementById(PILL_ID);
    if (startBtn) startBtn.disabled = running;
    if (stopBtn) stopBtn.disabled = !running;
    if (running) {
      setStatus("Đang chạy...", "online");
      pill?.classList.add("running");
    } else {
      setStatus("Sẵn sàng", "idle");
      pill?.classList.remove("running");
    }
  }

  function setActivity(text) {
    const el = document.getElementById("sp-activity");
    if (el) el.textContent = text;
  }

  ROOT.panel = {
    PANEL_ID,
    PILL_ID,
    mount,
    setProgress,
    setStatus,
    setRunning,
    setActivity,
  };
})();
