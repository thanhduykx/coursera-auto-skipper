/**
 * Coursera Lesson Batch Processor (Video & Reading API Automation)
 * Dev by thanh duyvp
 */
(() => {
  const BASE = "https://www.coursera.org/api/";
  const ORIGIN = "https://www.coursera.org";
  // Ungraded items carry their own completion record; none of them has a grade.
  const LAB_ROUTES = {
    ungradedWidget: "widget",
    ungradedLti: "lti",
    ungradedLab: "lab",
    interactivePlugin: "record",
    dialogue: "record",
  };
  const batches = new Map();
  const token = (value) =>
    typeof value === "string" && /^[a-zA-Z0-9._~-]{1,200}$/.test(value);
  const aborted = () => new DOMException("Đã dừng Reading/Video", "AbortError");
  function check(job) {
    if (job.controller.signal.aborted) throw aborted();
  }
  async function owner(job) {
    check(job);
    const tab = await chrome.tabs.get(job.owner).catch(() => null);
    if (
      !tab ||
      tab.incognito ||
      new URL(tab.url || "about:blank").origin !== "https://www.coursera.org" ||
      new URL(tab.url).pathname !== job.path
    ) {
      job.controller.abort();
      throw aborted();
    }
    check(job);
  }
  function delay(job, ms) {
    check(job);
    return new Promise((resolve, reject) => {
      const signal = job.controller.signal;
      const cancel = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        reject(aborted());
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", cancel);
        resolve();
      }, ms);
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
    });
  }
  async function request(job, path, method = "GET", body) {
    await owner(job);
    const headers = {
      Accept: "application/json",
      "x-coursera-application": "ondemand",
      "x-requested-with": "XMLHttpRequest",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") {
      for (const [name, header] of [
        ["CSRF3-Token", "x-csrf3-token"],
        ["CSRF2-Token", "x-csrf2-token"],
        ["csrftoken", "x-csrftoken"],
      ]) {
        const cookie = await chrome.cookies.get({ url: BASE, name });
        if (cookie?.value) headers[header] = cookie.value;
      }
      if (!Object.keys(headers).some((key) => key.startsWith("x-csrf")))
        throw new Error(
          "Thiếu CSRF của phiên Coursera. Hãy đăng nhập và tải lại trang.",
        );
    }
    await owner(job);
    const controller = new AbortController();
    const abort = () => controller.abort();
    job.controller.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 20000);
    try {
      const response = await fetch(
        path.startsWith("/") ? ORIGIN + path : BASE + path,
        {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        const description =
          response.status === 429
            ? "Coursera giới hạn yêu cầu; đã dừng, hãy đợi rồi thử lại."
            : [401, 403].includes(response.status)
              ? "Coursera từ chối phiên/quyền truy cập; hãy kiểm tra đăng nhập."
              : "Coursera chưa chấp nhận yêu cầu.";
        const error = new Error(`HTTP ${response.status}: ${description}`);
        error.status = response.status;
        error.fatal = true;
        throw error;
      }
      if (method !== "GET") {
        const type = response.headers.get("content-type") || "";
        if (!/application\/json/i.test(type)) {
          await response.body?.cancel();
          check(job);
          return;
        }
      }
      if (Number(response.headers.get("content-length")) > 8 * 1024 * 1024)
        throw new Error("Dữ liệu khóa học vượt giới hạn.");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Coursera trả dữ liệu rỗng.");
      const decoder = new TextDecoder();
      let text = "",
        size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 8 * 1024 * 1024) {
            await reader.cancel();
            throw new Error("Dữ liệu khóa học vượt giới hạn.");
          }
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      check(job);
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Coursera trả dữ liệu không hợp lệ.");
      }
    } catch (error) {
      if (job.controller.signal.aborted) throw aborted();
      if (controller.signal.aborted)
        throw new Error(
          "Coursera không phản hồi trong 20 giây; chưa xác nhận hoàn thành.",
        );
      if (error instanceof TypeError)
        throw new Error(
          "Không kết nối được API Coursera; chưa xác nhận hoàn thành.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
      job.controller.signal.removeEventListener("abort", abort);
    }
  }
  async function materials(job) {
    const data = await request(
      job,
      "onDemandCourseMaterials.v2/?q=slug&slug=" +
        encodeURIComponent(job.course) +
        "&includes=items&fields=onDemandCourseMaterialItems.v2(name,slug,timeCommitment,contentSummary,isLocked,lockedStatus)&showLockedItems=true",
    );
    const courseId = data?.elements?.length === 1 && data.elements[0].id;
    const rows = data?.linked?.["onDemandCourseMaterialItems.v2"];
    if (
      !token(courseId) ||
      !Array.isArray(rows) ||
      rows.length > 2000 ||
      (job.courseId && job.courseId !== courseId)
    )
      throw new Error("Không đọc được danh sách bài của đúng khóa học.");
    job.courseId = courseId;
    const seen = new Set();
    const items = rows.map((row) => {
      const type = row?.contentSummary?.typeName;
      if (!token(row?.id) || !token(type) || seen.has(row.id))
        throw new Error("Danh sách bài có dữ liệu trùng hoặc không hợp lệ.");
      seen.add(row.id);
      const status = String(row.lockedStatus || "").toLowerCase();
      const locked =
        row.isLocked === true ||
        /^(locked|blocked)/.test(status) ||
        status.startsWith("hard_locked");
      return {
        id: row.id,
        key: `${job.course}:${type}:${row.id}`,
        kind:
          type === "lecture"
            ? "video"
            : type === "supplement"
              ? "reading"
              : LAB_ROUTES[type]
                ? "lab"
                : type,
        route: LAB_ROUTES[type] || "",
        title: String(row.name || row.id).slice(0, 300),
        duration: row.timeCommitment,
        locked,
      };
    });
    job.items = items;
    return items;
  }
  async function progress(job) {
    const data = await request(
      job,
      `onDemandCoursesProgress.v1/${job.userId}~${job.courseId}?fields=gradedAssignmentGroupProgress`,
    );
    const record = data?.elements?.length === 1 && data.elements[0];
    if (
      !record ||
      !record.items ||
      typeof record.items !== "object" ||
      Array.isArray(record.items) ||
      (record.id && record.id !== `${job.userId}~${job.courseId}`)
    )
      throw new Error(
        "Chưa đọc được tiến độ Coursera; không ghi nhận hoàn thành.",
      );
    const done = new Set(
      Object.entries(record.items)
        .filter(([, value]) => value?.progressState === "Completed")
        .map(([id]) => id),
    );
    job.confirmed = new Set([
      ...job.items.filter((item) => done.has(item.id)).map((item) => item.key),
      ...(job.extraConfirmed || []),
    ]);
    return done;
  }
  function recordKey(job, item) {
    return encodeURIComponent(`${job.userId}~${job.courseId}~${item.id}`);
  }
  async function widgetSession(job, item) {
    if (job.sessionId !== undefined) return job.sessionId;
    const data = await request(
      job,
      "onDemandSessionMemberships.v1?courseId=" +
        encodeURIComponent(job.courseId) +
        "&userId=" +
        encodeURIComponent(job.userId) +
        "&q=activeByUserAndCourse&fields=id,createdAt,sessionId,userId",
    );
    job.sessionId = String(data?.elements?.[0]?.sessionId || "");
    if (!job.sessionId) {
      const row = await request(
        job,
        "onDemandWidgetSessions.v1/" +
          recordKey(job, item) +
          "?fields=session,sessionId",
      );
      job.sessionId = String(
        row?.elements?.[0]?.sessionId ||
          row?.elements?.[0]?.session?.id ||
          "",
      );
    }
    return job.sessionId;
  }
  async function labBranchId(job) {
    if (job.branchId !== undefined) return job.branchId;
    const data = await request(
      job,
      "onDemandSessionMemberships.v1?courseId=" +
        encodeURIComponent(job.courseId) +
        "&userId=" +
        encodeURIComponent(job.userId) +
        "&q=activeByUserAndCourse&includes=sessions&fields=onDemandSessions.v1(branchId)",
    );
    job.branchId =
      String(data?.linked?.["onDemandSessions.v1"]?.[0]?.branchId || "") ||
      job.courseId;
    return job.branchId;
  }
  async function completeWidget(job, item) {
    const sessionId = await widgetSession(job, item);
    const body = { progressState: "Completed" };
    if (sessionId) body.sessionId = sessionId;
    await request(job, "onDemandWidgetProgress.v1/" + recordKey(job, item), "PUT", body);
    await request(job, "onDemandCompletedItems.v1", "POST", {
      userId: job.userId,
      courseId: job.courseId,
      itemId: item.id,
    });
  }
  async function completeRecord(job, item) {
    await request(job, "onDemandCompletedItems.v1", "POST", {
      userId: job.userId,
      courseId: job.courseId,
      itemId: item.id,
    });
  }
  async function launchLti(job, item) {
    if (!/^\d+$/.test(job.userId))
      throw new Error("Tài khoản không phải ID số; không gửi được launch LTI.");
    const body = {
      courseId: job.courseId,
      itemId: item.id,
      learnerId: Number(job.userId),
      recaptchaToken: "token-not-required",
      launchAs: "LEARNER",
      markItemCompleted: true,
    };
    try {
      await request(job, "rest/v1/lti/ungradedLaunches", "POST", body);
    } catch (error) {
      if (![404, 405].includes(error.status)) throw error;
      await request(
        job,
        "onDemandLtiUngradedLaunches.v1/?fields=endpointUrl%2CauthRequestUrl%2CsignedProperties",
        "POST",
        {
          courseId: job.courseId,
          itemId: item.id,
          learnerId: Number(job.userId),
          markItemCompleted: true,
        },
      );
    }
  }
  async function markLabMutation(job, opname, mutation, input) {
    const data = await request(
      job,
      "/graphql-gateway?opname=" + opname,
      "POST",
      { operationName: opname, variables: { input }, query: mutation },
    );
    return Boolean(data?.data?.[`UngradedLabProgress_${opname.replace("MarkUngradedLab", "MarkItem")}`]);
  }
  async function completeLab(job, item) {
    const branchId = await labBranchId(job);
    const input = { courseId: job.courseId, branchId, itemId: item.id };
    await markLabMutation(
      job,
      "MarkUngradedLabStarted",
      "mutation MarkUngradedLabStarted($input: UngradedLabProgress_MarkItemStartedInput!) { UngradedLabProgress_MarkItemStarted(input: $input) { _ } }",
      input,
    ).catch(() => false);
    const data = await request(
      job,
      "/graphql-gateway?opname=MarkUngradedLabComplete",
      "POST",
      {
        operationName: "MarkUngradedLabComplete",
        variables: { input },
        query:
          "mutation MarkUngradedLabComplete($input: UngradedLabProgress_MarkItemCompleteInput!) { UngradedLabProgress_MarkItemComplete(input: $input) { _ } }",
      },
    ).catch((error) => {
      if ([404, 405].includes(error.status)) return null;
      throw error;
    });
    if (!data) return completeRecord(job, item);
    if (!data?.data?.UngradedLabProgress_MarkItemComplete)
      throw new Error("Coursera từ chối ghi hoàn thành lab.");
  }
  async function processLabItem(job, item) {
    try {
      if (item.route === "widget") await completeWidget(job, item);
      else if (item.route === "lti") await launchLti(job, item);
      else if (item.route === "lab") await completeLab(job, item);
      else await completeRecord(job, item);
    } catch (error) {
      if (error.name === "AbortError") throw error;
      // One refused lab must not stop the rest of the batch.
      error.fatal = false;
      throw error;
    }
  }
  async function readBackExtra(job, item) {
    const key = recordKey(job, item);
    try {
      const data = await request(
        job,
        "onDemandWidgetProgress.v1/" + key + "?fields=progressState",
      );
      if (data?.elements?.[0]?.progressState === "Completed") {
        job.extraConfirmed.add(item.key);
        return true;
      }
    } catch (error) {
      if (error.name === "AbortError") throw error;
    }
    try {
      const data = await request(job, "onDemandCompletedItems.v1/" + key);
      if ((data?.elements || []).length > 0 || data?.id) {
        job.extraConfirmed.add(item.key);
        return true;
      }
    } catch (error) {
      if (error.name === "AbortError") throw error;
    }
    return false;
  }
  async function processItem(job, item) {
    if (item.route) return processLabItem(job, item);
    if (item.kind === "reading") {
      await request(job, "onDemandSupplementCompletions.v1", "POST", {
        courseId: job.courseId,
        itemId: item.id,
        userId: Number(job.userId),
      });
      return;
    }
    const data = await request(
      job,
      `onDemandLectureVideos.v1/${job.courseId}~${item.id}?includes=video&fields=disableSkippingForward,startMs,endMs`,
    );
    const metadata = data?.elements?.length === 1 && data.elements[0];
    if (
      !metadata ||
      typeof metadata.disableSkippingForward !== "boolean" ||
      (metadata.id && metadata.id !== `${job.courseId}~${item.id}`)
    )
      throw new Error(
        "Không đọc được metadata video; chưa gửi sự kiện hoàn thành.",
      );
    const eventPath = `opencourse.v1/user/${job.userId}/course/${job.course}/item/${item.id}/lecture/videoEvents/`;
    if (metadata.disableSkippingForward) {
      const videos = data.linked?.["onDemandVideos.v1"];
      const video =
        Array.isArray(videos) &&
        (metadata.videoId
          ? videos.find((v) => v.id === metadata.videoId)
          : videos.length === 1
            ? videos[0]
            : null);
      if (
        !token(video?.id) ||
        !Number.isSafeInteger(item.duration) ||
        item.duration < 0 ||
        item.duration > 86400000
      )
        throw new Error("Thiếu thời lượng hoặc tracking ID của video.");
      await request(job, eventPath + "play?autoEnroll=false", "POST", {
        contentRequestBody: {},
      });
      const videoProgressId = `${job.userId}~${job.courseId}~${video.id}`;
      await request(
        job,
        "onDemandVideoProgresses.v1/" + videoProgressId,
        "PUT",
        { videoProgressId, viewedUpTo: item.duration + 2000 },
      );
      await delay(job, 1000);
    }
    await request(job, eventPath + "ended?autoEnroll=false", "POST", {
      contentRequestBody: {},
    });
  }
  function selected(job, item) {
    if (item.kind === "video" || item.kind === "reading")
      return job.options[item.kind] === true;
    return item.kind === "lab" && job.options.lab === true;
  }
  function snapshot(job) {
    return {
      id: job.id,
      course: job.course,
      running: job.running,
      items: job.items.map(({ key, kind, title }) => ({ key, kind, title })),
      total: job.items.filter((i) => selected(job, i)).length,
      completed: job.items.filter(
        (i) => selected(job, i) && job.confirmed.has(i.key),
      ).length,
      confirmed: [...job.confirmed],
      current: [...job.current],
      failed: [...job.failed.values()],
      locked: job.items.filter(
        (i) => selected(job, i) && i.locked && !job.confirmed.has(i.key),
      ).length,
      error: job.error || "",
    };
  }
  async function run(job) {
    const auth = await request(job, "adminUserPermissions.v1?q=my");
    const userId = String(auth?.elements?.[0]?.id ?? "");
    if (
      !/^\d{1,15}$/.test(userId) ||
      !Number.isSafeInteger(Number(userId)) ||
      Number(userId) <= 0
    )
      throw new Error("Không xác minh được phiên đăng nhập Coursera.");
    job.userId = userId;
    await materials(job);
    await progress(job);
    const attempted = new Set();
    while (true) {
      check(job);
      const pending = job.items
        .filter(
          (i) =>
            selected(job, i) &&
            !i.locked &&
            !job.confirmed.has(i.key) &&
            !attempted.has(i.id),
        )
        .slice(0, 12);
      if (!pending.length) break;
      if (attempted.size + pending.length > 2000)
        throw new Error(
          "Danh sách khóa học thay đổi quá nhiều; đã dừng để đọc lại ở lượt sau.",
        );
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, pending.length) }, async () => {
          while (cursor < pending.length) {
            check(job);
            const item = pending[cursor++];
            attempted.add(item.id);
            job.current.add(item.title);
            try {
              await processItem(job, item);
            } catch (error) {
              if (error.name === "AbortError") throw error;
              job.failed.set(item.id, {
                title: item.title,
                error: error.message,
              });
              if (error.fatal) {
                job.error = error.message;
                job.controller.abort();
                throw error;
              }
            } finally {
              job.current.delete(item.title);
            }
          }
        }),
      );
      for (let poll = 0; poll < 3; poll++) {
        if (poll) await delay(job, 1000);
        await progress(job);
        for (const item of pending) {
          if (job.confirmed.has(item.key)) continue;
          if (item.route === "widget" || item.route === "record")
            await readBackExtra(job, item);
          if (job.confirmed.has(item.key)) job.failed.delete(item.id);
        }
        if (
          pending.every((i) => job.confirmed.has(i.key) || job.failed.has(i.id))
        )
          break;
      }
      // Some course variants register the completed item separately. Only use
      // this once after a successful lesson request; never infer success from it.
      const unconfirmed = pending.filter(
        (item) => !job.confirmed.has(item.key) && !job.failed.has(item.id),
      );
      if (unconfirmed.length) {
        await materials(job);
        const unlocked = new Set(
          job.items
            .filter((item) => !item.locked && selected(job, item))
            .map((item) => item.id),
        );
        const registered = unconfirmed.filter((item) => unlocked.has(item.id));
        for (const item of registered) {
          await request(job, "onDemandCompletedItems.v1", "POST", {
            userId: job.userId,
            courseId: job.courseId,
            itemId: item.id,
          });
        }
        for (let poll = 0; registered.length && poll < 3; poll++) {
          if (poll) await delay(job, 1000);
          await progress(job);
          if (registered.every((item) => job.confirmed.has(item.key))) break;
        }
      }
      for (const item of pending) {
        if (job.confirmed.has(item.key)) job.failed.delete(item.id);
        else if (!job.failed.has(item.id))
          job.failed.set(item.id, {
            title: item.title,
            error:
              "Coursera chưa trả trạng thái Completed sau yêu cầu; chưa tính hoàn thành.",
          });
      }
      await materials(job); // Prerequisites may unlock more lessons after a wave.
      await progress(job);
    }
  }
  async function start(ownerId, course, options, id) {
    if (
      !token(course) ||
      typeof id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(id) ||
      !options ||
      typeof options.video !== "boolean" ||
      typeof options.reading !== "boolean" ||
      (options.lab !== undefined && typeof options.lab !== "boolean") ||
      (!options.video && !options.reading && options.lab !== true)
    )
      throw new Error("Cấu hình Reading/Video/Lab không hợp lệ.");
    const tab = await chrome.tabs.get(ownerId);
    const url = new URL(tab.url || "about:blank");
    if (
      tab.incognito ||
      url.origin !== "https://www.coursera.org" ||
      url.pathname.split("/")[1] !== "learn" ||
      url.pathname.split("/")[2] !== course
    )
      throw new Error("Chỉ xử lý khóa học đang mở trong tab Coursera thường.");
    if (
      [...batches.values()].some(
        (job) =>
          job.running && (job.owner === ownerId || job.course === course),
      )
    )
      throw new Error("Khóa học này đã có tác vụ Reading/Video đang chạy.");
    const job = {
      owner: ownerId,
      course,
      path: url.pathname,
      id,
      options: {
        video: options.video,
        reading: options.reading,
        lab: options.lab,
      },
      controller: new AbortController(),
      running: true,
      items: [],
      confirmed: new Set(),
      extraConfirmed: new Set(),
      failed: new Map(),
      current: new Set(),
      error: "",
    };
    batches.set(ownerId, job);
    job.task = run(job)
      .catch((error) => {
        job.error ||=
          error.name === "AbortError"
            ? "Đã dừng Reading/Video; các bài chưa xác minh không được tính hoàn thành."
            : error.message;
      })
      .finally(() => {
        job.running = false;
        job.current.clear();
      });
    return snapshot(job);
  }
  async function status(ownerId, id) {
    const job = batches.get(ownerId);
    if (!job || job.id !== id)
      throw new Error(
        "Tác vụ Reading/Video đã gián đoạn. Chạy lại để đọc tiến độ mới từ Coursera.",
      );
    if (job.running) await owner(job).catch(() => {});
    return snapshot(job);
  }
  async function cancel(ownerId, id) {
    const job = batches.get(ownerId);
    if (job && job.id === id) {
      job.controller.abort();
      await job.task;
    }
    return { cancelled: true };
  }
  async function removed(ownerId) {
    const job = batches.get(ownerId);
    if (job) {
      job.controller.abort();
      await job.task;
      batches.delete(ownerId);
    }
  }
  async function audit(ownerId, course) {
    if (!token(course)) throw new Error("Khóa học không hợp lệ.");
    const tab = await chrome.tabs.get(ownerId);
    const url = new URL(tab.url || "about:blank");
    if (url.origin !== "https://www.coursera.org" || url.pathname.split("/")[2] !== course)
      throw new Error("Tab không còn ở khóa học cần kiểm tra.");
    const job = {
      owner: ownerId,
      course,
      path: url.pathname,
      controller: new AbortController(),
      items: [],
      confirmed: new Set(),
      failed: new Map(),
      current: new Set(),
      options: { video: true, reading: true },
    };
    const auth = await request(job, "adminUserPermissions.v1?q=my");
    const userId = String(auth?.elements?.[0]?.id ?? "");
    if (!/^\d{1,15}$/.test(userId))
      throw new Error("Không xác minh được phiên đăng nhập Coursera.");
    job.userId = userId;
    await materials(job);
    const done = await progress(job);
    return {
      items: job.items.map(({ key, kind, title }) => ({ key, kind, title })),
      completed: job.items
        .filter((item) => done.has(item.id))
        .map((item) => item.key),
    };
  }
  self.SkipperLessonBatch = { start, status, cancel, removed, audit };
})();
