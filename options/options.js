/**
 * Options Page Controller for Coursera Auto Skipper
 * Dev by thanh duyvp
 */

document.addEventListener("DOMContentLoaded", async () => {
  const cfgVideoMode = document.getElementById("cfg-video-mode");
  const cfgVideoSpeed = document.getElementById("cfg-video-speed");
  const cfgPeerMode = document.getElementById("cfg-peer-mode");
  const cfgPeerComment = document.getElementById("cfg-peer-comment");
  const cfgPeerAutosubmit = document.getElementById("cfg-peer-autosubmit");
  const cfgPeerScan = document.getElementById("cfg-peer-scan");
  const cfgDiscComment = document.getElementById("cfg-disc-comment");
  const cfgDiscAutosubmit = document.getElementById("cfg-disc-autosubmit");
  const cfgTheme = document.getElementById("cfg-theme");
  const cfgAutostart = document.getElementById("cfg-autostart");
  const btnSave = document.getElementById("btn-save");
  const toast = document.getElementById("toast");
  const saveStatusText = document.getElementById("save-status-text");

  function showToast(message = "Đã lưu cài đặt thành công!") {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  function applyTheme(theme) {
    if (theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }

  async function loadSettings() {
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
      const peerRes = await chrome.runtime.sendMessage({ type: "GET_PEER_SETTINGS" });
      
      if (res?.ok && res.settings) {
        const s = res.settings;
        if (s.videoMode) cfgVideoMode.value = s.videoMode;
        if (s.videoSpeed) cfgVideoSpeed.value = String(s.videoSpeed);
        if (s.discussionComment !== undefined) cfgDiscComment.value = s.discussionComment;
        if (s.discussionAutoSubmit !== undefined) cfgDiscAutosubmit.checked = s.discussionAutoSubmit;
        if (s.theme) cfgTheme.value = s.theme;
        if (s.autoStart !== undefined) cfgAutostart.checked = s.autoStart;
        applyTheme(s.theme || "auto");
      }

      if (peerRes?.ok && peerRes.settings) {
        const p = peerRes.settings;
        if (p.mode) cfgPeerMode.value = p.mode;
        if (p.comment !== undefined) cfgPeerComment.value = p.comment;
        if (p.autoSubmit !== undefined) cfgPeerAutosubmit.checked = p.autoSubmit;
        if (p.scanCourse !== undefined) cfgPeerScan.checked = p.scanCourse;
      }
    } catch (err) {
      saveStatusText.textContent = "Không tải được cài đặt";
    }
  }

  cfgTheme?.addEventListener("change", () => {
    applyTheme(cfgTheme.value);
  });

  btnSave?.addEventListener("click", async () => {
    btnSave.disabled = true;
    try {
      const generalPatch = {
        videoMode: cfgVideoMode.value,
        videoSpeed: Number(cfgVideoSpeed.value),
        discussionComment: cfgDiscComment ? cfgDiscComment.value.trim() : "",
        discussionAutoSubmit: cfgDiscAutosubmit.checked,
        theme: cfgTheme.value,
        autoStart: cfgAutostart.checked,
      };

      const peerPatch = {
        mode: cfgPeerMode.value,
        comment: cfgPeerComment.value,
        autoSubmit: cfgPeerAutosubmit.checked,
        scanCourse: cfgPeerScan.checked,
      };

      await chrome.runtime.sendMessage({
        type: "SAVE_SETTINGS",
        settings: generalPatch,
      });

      await chrome.runtime.sendMessage({
        type: "SAVE_PEER_SETTINGS",
        settings: peerPatch,
      });

      showToast("Đã lưu tất cả cài đặt thành công!");
      saveStatusText.textContent = "Đã lưu cài đặt lúc " + new Date().toLocaleTimeString();
    } catch (err) {
      showToast("Lỗi: " + err.message);
    } finally {
      btnSave.disabled = false;
    }
  });

  await loadSettings();
});
