/**
 * First-party Coursera Peer Submission Link Lookup
 * Dev by thanh duyvp
 */
(() => {
  const pending = new Map();
  const token = (value) =>
    typeof value === "string" && /^[\w-]{1,200}$/.test(value);

  async function lookup(tabId, expectedUrl) {
    const url = new URL(expectedUrl);
    const parts = url.pathname.split("/");
    if (
      url.origin !== "https://www.coursera.org" ||
      parts[1] !== "learn" ||
      parts[3] !== "peer" ||
      !token(parts[2]) ||
      !token(parts[4])
    )
      throw new Error("Hãy mở bài Peer Review cần lấy link bài nộp.");

    async function owner() {
      const tab = await chrome.tabs.get(tabId);
      if (
        tab.incognito ||
        new URL(tab.url).origin !== url.origin ||
        new URL(tab.url).pathname !== url.pathname
      )
        throw new Error("Trang đã đổi; hãy lấy lại link tại bài cần chia sẻ.");
    }

    async function get(path) {
      await owner();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url.origin + "/api/" + path, {
          credentials: "include",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(
            `Coursera HTTP ${response.status}; hãy kiểm tra phiên đăng nhập hoặc thử lại sau.`
          );
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Coursera trả dữ liệu rỗng.");
        const decoder = new TextDecoder();
        let text = "",
          size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2 * 1024 * 1024) {
            await reader.cancel();
            throw new Error("Dữ liệu bài nộp vượt giới hạn.");
          }
          text += decoder.decode(value, { stream: true });
        }
        await owner();
        try {
          return JSON.parse(text + decoder.decode());
        } catch {
          throw new Error("Coursera trả dữ liệu không hợp lệ.");
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    const auth = await get("adminUserPermissions.v1?q=my");
    const user = String(auth.elements?.[0]?.id || "");
    if (!/^[1-9]\d{0,14}$/.test(user))
      throw new Error("Không xác định được tài khoản Coursera.");
    const course = await get(
      "onDemandCourseMaterials.v2/?q=slug&slug=" + parts[2]
    );
    const courseId = course.elements?.[0]?.id;
    if (course.elements?.length !== 1 || !token(courseId))
      throw new Error("Không xác định được khóa học.");
    const key = `${user}~${courseId}~${parts[4]}`;
    const data = await get(
      "onDemandPeerAssignmentPermissions.v1/" +
        key +
        "/?includes=submissionProgress&fields=onDemandPeerSubmissionProgresses.v1(latestSubmissionSummary)"
    );
    const rows = data.linked?.["onDemandPeerSubmissionProgresses.v1"];
    const row = Array.isArray(rows)
      ? rows.find((entry) => entry.id === key)
      : null;
    const id = row?.latestSubmissionSummary?.computed?.id;
    if (!token(id))
      throw new Error(
        "Chưa tìm thấy bài đã nộp của bạn; bản nháp chưa có link chia sẻ."
      );
    return `${url.origin}/learn/${parts[2]}/peer/${parts[4]}/course-project/review/${id}`;
  }

  self.SkipperSubmissionLink = {
    get(tabId, url) {
      if (pending.has(tabId))
        return Promise.reject(new Error("Đang lấy link, vui lòng đợi."));
      const job = lookup(tabId, url).finally(() => pending.delete(tabId));
      pending.set(tabId, job);
      return job;
    },
  };
})();
