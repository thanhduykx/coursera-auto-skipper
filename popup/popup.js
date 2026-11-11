/**
 * Popup Script for Coursera Auto Skipper
 * Dev by thanh duyvp
 */

document.addEventListener("DOMContentLoaded", async () => {
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const btnTheme = document.getElementById("btn-theme");
  const btnOptions = document.getElementById("btn-open-options");

  const connBanner = document.getElementById("conn-banner");
  const connText = document.getElementById("conn-text");
  const progressVal = document.getElementById("progress-val");
  const progressFill = document.getElementById("progress-fill");
  const statusMessage = document.getElementById("status-message");

  const chipFastSkip = document.getElementById("chip-fast-skip");
  const chipPeer = document.getElementById("chip-peer");
  const chipDisc = document.getElementById("chip-disc");

  const toggles = {
    video: document.getElementById("toggle-video"),
    reading: document.getElementById("toggle-reading"),
    peer: document.getElementById("toggle-peer"),
    discussion: document.getElementById("toggle-discussion"),
  };

  let activeTab = null;

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  function isCourseraUrl(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      return u.hostname === "coursera.org" || u.hostname.endsWith(".coursera.org");
    } catch {
      return false;
    }
  }

  async function sendMessageToTab(message) {
    if (!activeTab || !activeTab.id) return { ok: false, error: "Không tìm thấy tab hoạt động" };
    try {
      return await chrome.tabs.sendMessage(activeTab.id, message);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // Load preferences
  async function loadConfig() {
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
      if (res?.ok && res.settings) {
        const s = res.settings;
        if (s.theme === "dark" || (s.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.body.classList.add("dark");
        }
        if (s.options) {
          for (const [key, el] of Object.entries(toggles)) {
            if (el && Object.hasOwn(s.options, key)) {
              el.checked = s.options[key] === true;
            }
          }
        }
      }
    } catch {}
  }

  async function saveToggles() {
    const patch = {};
    for (const [key, el] of Object.entries(toggles)) {
      if (el) patch[key] = el.checked;
    }
    await chrome.runtime.sendMessage({ type: "UPDATE_OPTIONS", patch }).catch(() => {});
  }

  for (const el of Object.values(toggles)) {
    el?.addEventListener("change", saveToggles);
  }

  // Check tab & connection
  async function checkTab() {
    activeTab = await getActiveTab();
    if (!activeTab || !isCourseraUrl(activeTab.url)) {
      connBanner.className = "conn-banner offline";
      connText.textContent = "Chưa mở trang Coursera. Mở khóa học để dùng.";
      btnStart.disabled = true;
      btnStop.disabled = true;
      return false;
    }

    const ping = await sendMessageToTab({ action: "PING" });
    if (ping?.ok) {
      connBanner.className = "conn-banner";
      connText.textContent = "Đã kết nối với khóa học Coursera";
      return true;
    } else {
      connBanner.className = "conn-banner offline";
      connText.textContent = "Đang tải tiện ích trên trang Coursera...";
      return false;
    }
  }

  async function refreshState() {
    const res = await sendMessageToTab({ action: "GET_STATE" });
    if (res?.ok) {
      const pct = Math.max(0, Math.min(100, Math.round(res.percent || 0)));
      progressVal.textContent = pct + "%";
      progressFill.style.width = pct + "%";
      btnStart.disabled = res.running;
      btnStop.disabled = !res.running;
    }
  }

  // Action Buttons
  btnStart?.addEventListener("click", async () => {
    btnStart.disabled = true;
    statusMessage.textContent = "Đang bắt đầu Auto Skip...";
    const options = {
      video: toggles.video?.checked !== false,
      reading: toggles.reading?.checked !== false,
      peer: toggles.peer?.checked !== false,
      discussion: toggles.discussion?.checked !== false,
    };
    const res = await sendMessageToTab({ action: "START", options });
    if (!res?.ok) {
      statusMessage.textContent = "Lỗi: " + (res?.error || "Không thể chạy");
      btnStart.disabled = false;
    } else {
      btnStop.disabled = false;
    }
  });

  btnStop?.addEventListener("click", async () => {
    btnStop.disabled = true;
    statusMessage.textContent = "Đang dừng...";
    await sendMessageToTab({ action: "STOP" });
    btnStart.disabled = false;
  });

  chipFastSkip?.addEventListener("click", async () => {
    statusMessage.textContent = "Đang chạy Skip Video & Reading qua API...";
    await sendMessageToTab({ action: "START", options: { video: true, reading: true, peer: false, discussion: false } });
  });

  chipPeer?.addEventListener("click", async () => {
    statusMessage.textContent = "Đang xử lý Peer Review...";
    await sendMessageToTab({ action: "START", options: { video: false, reading: false, peer: true, discussion: false } });
  });

  chipDisc?.addEventListener("click", async () => {
    statusMessage.textContent = "Đang xử lý Thảo luận...";
    await sendMessageToTab({ action: "START", options: { video: false, reading: false, peer: false, discussion: true } });
  });

  btnTheme?.addEventListener("click", async () => {
    const isDark = document.body.classList.toggle("dark");
    await chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      settings: { theme: isDark ? "dark" : "light" },
    }).catch(() => {});
  });

  btnOptions?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Listen for live updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === "LOG" && msg.text) {
      statusMessage.textContent = msg.text;
    }
    if (msg.type === "PROGRESS" && msg.percent !== undefined) {
      const pct = Math.max(0, Math.min(100, Math.round(msg.percent)));
      progressVal.textContent = pct + "%";
      progressFill.style.width = pct + "%";
    }
    if (msg.type === "STATUS" && msg.text) {
      statusMessage.textContent = msg.text;
    }
  });

  await loadConfig();
  const ok = await checkTab();
  if (ok) {
    await refreshState();
  }
});
