// Peer Review assistance inspired by Coursera Auto Grade (see third-party/).
// Manual preview or saved automatic policy; submission is separately opt-in.
(() => {
  const ROOT = globalThis.Skipper;
  function text(element) {
    return (element?.innerText || element?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function assertActive(context = {}) {
    ROOT.dom.assertActive(context);
    if (ROOT.instance.signal.aborted)
      throw new Error("Panel đã được thay thế. Hãy mở lại bản xem trước.");
    if (!context.automatic && document.getElementById("sp-start")?.disabled)
      throw new Error("Hãy Dừng Auto trước khi xử lý Peer Review.");
  }
  function label(input) {
    return (
      [...(input.labels || [])].map(text).join(" / ") ||
      text(input.closest("label")) ||
      input.value
    );
  }
  function scan() {
    const parts = [...document.querySelectorAll(".rc-FormPart")].filter(
      (part) =>
        !part.closest("#skipper-pro-panel") && part.getClientRects().length,
    );
    if (parts.length > 100) throw new Error("Biểu mẫu vượt giới hạn 100 phần.");
    return parts
      .map((part, index) => {
        const inputs = [
          ...part.querySelectorAll(
            'input[type="radio"][name^="peer-options"],input[type="radio"][name^="peer-yes-no-"]',
          ),
        ].filter((input) => input.closest(".rc-FormPart") === part);
        const fields = [...part.querySelectorAll("textarea")].filter(
          (field) => field.closest(".rc-FormPart") === part,
        );
        if (inputs.length + fields.length > 100)
          throw new Error("Một tiêu chí có quá nhiều trường.");
        return {
          part,
          title:
            text(
              part.querySelector(
                "legend,h2,h3,h4,[role=heading],.options-prompt",
              ),
            ) || `Tiêu chí ${index + 1}`,
          inputs,
          fields,
          signature: JSON.stringify({
            text: text(part),
            inputs: inputs.map((input) => [
              input.name,
              input.value,
              input.checked,
              input.matches(":disabled"),
              label(input),
            ]),
            fields: fields.map((field) => [
              field.value,
              field.matches(":disabled"),
              field.readOnly,
              field.maxLength,
            ]),
          }),
        };
      })
      .filter((part) => part.inputs.length || part.fields.length);
  }
  function prepare(comment, mode, context = {}) {
    assertActive(context);
    if (
      typeof comment !== "string" ||
      comment.length > 10000 ||
      !["highest", "last", "keep"].includes(mode)
    )
      throw new Error("Cấu hình nhận xét không hợp lệ.");
    const parts = scan();
    if (!parts.length || !parts.some((part) => part.inputs.length))
      throw new Error(
        "Chưa tìm thấy biểu mẫu Peer Review được hỗ trợ trên trang này.",
      );
    if (
      parts.reduce(
        (total, part) => total + part.inputs.length + part.fields.length,
        0,
      ) > 300
    )
      throw new Error("Biểu mẫu vượt giới hạn 300 trường.");
    const choices = [],
      fields = [],
      preview = [];
    for (const part of parts) {
      const groups = new Map();
      for (const input of part.inputs) {
        if (!input.name) continue;
        if (!groups.has(input.name)) groups.set(input.name, []);
        groups.get(input.name).push(input);
      }
      for (const inputs of groups.values()) {
        const input =
          mode === "highest"
            ? inputs[
                globalThis.SkipperPeerScore.highest(
                  inputs.map((input) => ({
                    label: label(input),
                    points: input.getAttribute("data-points"),
                  })),
                )
              ]
            : mode === "last"
              ? inputs.at(-1)
              : inputs.find((input) => input.checked);
        if (input?.matches(":disabled"))
          throw new Error(`${part.title}: lựa chọn đang bị khóa.`);
        if (input) choices.push({ input, inputs, name: label(input) });
        preview.push(
          `${part.title}: ${input ? label(input) : "chưa chọn điểm (giữ nguyên)"}`,
        );
      }
      for (const field of part.fields) {
        if (field.value.trim()) {
          preview.push(`${part.title}: giữ nhận xét đã có`);
          continue;
        }
        if (field.matches(":disabled") || field.readOnly) {
          preview.push(`${part.title}: ô nhận xét bị khóa, bỏ qua`);
          continue;
        }
        if (!comment.trim()) {
          preview.push(`${part.title}: để trống nhận xét`);
          continue;
        }
        if (field.maxLength >= 0 && comment.trim().length > field.maxLength)
          throw new Error(
            `${part.title}: nhận xét vượt giới hạn ${field.maxLength} ký tự.`,
          );
        fields.push(field);
        preview.push(`${part.title}: điền nhận xét chung vào ô trống`);
      }
    }
    return {
      url: location.href,
      context,
      parts,
      choices,
      fields,
      comment: comment.trim(),
      preview,
    };
  }
  async function apply(plan) {
    assertActive(plan?.context);
    if (!plan || plan.url !== location.href)
      throw new Error("Trang đã thay đổi. Hãy xem trước lại.");
    const current = scan();
    if (
      current.length !== plan.parts.length ||
      current.some(
        (part, index) =>
          part.part !== plan.parts[index].part ||
          part.signature !== plan.parts[index].signature ||
          part.inputs.some(
            (input, i) => input !== plan.parts[index].inputs[i],
          ) ||
          part.fields.some((field, i) => field !== plan.parts[index].fields[i]),
      )
    )
      throw new Error(
        "Điểm, nhận xét hoặc tiêu chí đã thay đổi. Hãy xem trước lại.",
      );
    const assertPlanActive = () => {
      assertActive(plan.context);
      if (plan.url !== location.href)
        throw new Error("Trang đã thay đổi. Hãy xem trước lại.");
    };
    for (const { input, name } of plan.choices) {
      assertPlanActive();
      if (label(input) !== name)
        throw new Error("Tiêu chí đã thay đổi. Hãy xem trước lại.");
      if (!input.isConnected || input.matches(":disabled"))
        throw new Error(
          "Biểu mẫu vừa thay đổi; một số trường có thể đã được điền. Hãy xem trước lại.",
        );
      if (!input.checked) input.click();
      assertPlanActive();
      // Controlled radios may commit after the click handler returns. Never
      // force checked=true: wait for the page to acknowledge the selection.
      if (input.isConnected && !input.checked)
        await ROOT.dom.waitFor(
          () => {
            assertPlanActive();
            return input.isConnected && input.checked;
          },
          { ...plan.context, timeout: 2000, interval: 50 },
        );
      assertPlanActive();
      if (!input.isConnected || !input.checked)
        throw new Error(
          "Trang không nhận lựa chọn điểm. Hãy kiểm tra lại trên biểu mẫu.",
        );
    }
    for (const field of plan.fields) {
      assertPlanActive();
      if (
        !field.isConnected ||
        field.value.trim() ||
        field.matches(":disabled") ||
        field.readOnly
      )
        throw new Error(
          "Ô nhận xét vừa thay đổi; nội dung đã nhập được giữ nguyên. Hãy xem trước lại.",
        );
      field.focus();
      field.select();
      assertPlanActive();
      // Browser editing dispatches the native input event expected by the
      // page's controlled textarea. Setting value alone is not an acknowledgement.
      if (!document.execCommand("insertText", false, plan.comment))
        throw new Error(
          "Trang không nhận thao tác nhập nhận xét; chưa tự nộp.",
        );
      assertPlanActive();
      field.blur();
      await ROOT.dom.sleep(150, plan.context);
      assertPlanActive();
      if (!field.isConnected || field.value !== plan.comment)
        throw new Error(
          "Trang chưa nhận nội dung nhận xét. Hãy kiểm tra lại biểu mẫu.",
        );
    }
    if (
      plan.url !== location.href ||
      plan.choices.some(
        ({ input, inputs }) =>
          !input.isConnected ||
          !input.checked ||
          inputs.some((other) => other !== input && other.checked),
      )
    )
      throw new Error(
        "Trang thay đổi trong khi điền. Hãy kiểm tra lại điểm và nhận xét.",
      );
    return { choices: plan.choices.length, comments: plan.fields.length };
  }
  let settings = { ...globalThis.SkipperPeerSettings.defaults };
  let paused = false,
    task = null,
    controller = null;
  let lastReport = "";
  function report(message, level = "info") {
    const status = document.getElementById("sp-peer-status");
    if (status) status.textContent = message;
    const key = `${level}:${message}`;
    if (key !== lastReport) ROOT.log.log(message, level);
    lastReport = key;
  }
  function marker(parts) {
    const shape = JSON.stringify(
      parts.map((part) => ({
        title: part.title,
        options: part.inputs.map((input) => [
          input.name,
          input.value,
          label(input),
          input.disabled,
        ]),
        fields: part.fields.map((field) => [
          field.id,
          field.maxLength,
          field.disabled,
          field.readOnly,
        ]),
      })),
    );
    let hash = 2166136261;
    for (let index = 0; index < shape.length; index++)
      hash = Math.imul(hash ^ shape.charCodeAt(index), 16777619);
    return JSON.stringify([
      location.href,
      ROOT.peerSubmit.identity(),
      settings.revision,
      shape.length,
      hash >>> 0,
    ]);
  }
  const openedReviewButtons = new WeakSet();
  function startReviewButton() {
    if (
      !/^\/learn\/[^/]+\/peer\/[^/]+\/[^/]+\/(?:give-feedback|review-next)\/?$/.test(
        location.pathname,
      )
    )
      return null;
    return [...document.querySelectorAll('button,[role="button"]')].find(
      (button) =>
        !button.closest("#skipper-pro-panel") &&
        button.getClientRects().length &&
        !button.matches(":disabled") &&
        button.getAttribute("aria-disabled") !== "true" &&
        /^(Start Reviewing|Bắt đầu (?:chấm|đánh giá))$/i.test(text(button)),
    );
  }
  async function attempt(context = {}) {
    if (!settings.enabled || paused) return { status: "skipped" };
    const progress = await ROOT.peerTracker.refresh();
    if (progress?.remaining === 0) return { status: "review" };
    const parts = scan();
    if (
      ROOT.peerPractice.isPractice() &&
      !Number.isInteger(progress?.remaining) &&
      ROOT.peerPractice.returnToList(context)
    )
      return { status: "skipped" };
    if (!parts.some((part) => part.inputs.length)) {
      if (ROOT.peerPractice.openNext(progress, context)) {
        report("Đang mở một bài Practice chưa chấm trong danh sách…");
        return { status: "skipped" };
      }
      const prerequisite = prerequisiteReason();
      if (prerequisite) {
        report(prerequisite);
        return { status: "review", message: prerequisite };
      }
      const button = startReviewButton();
      // Opening a review is separate from submitting it. Require Coursera's
      // positive quota and act once per rendered button to avoid click loops.
      if (
        button &&
        progress?.remaining > 0 &&
        !openedReviewButtons.has(button)
      ) {
        assertActive(context);
        openedReviewButtons.add(button);
        report("Đang mở bài của bạn học; chờ biểu mẫu chấm điểm tải xong…");
        button.click();
      }
      return { status: "skipped" };
    }
    const owner = parts[0].part.closest("form") || parts[0].part;
    const key = marker(parts);
    if (owner.dataset.skipperPeerAuto === key) return { status: "review" };
    const url = location.href;
    await ROOT.dom.sleep(500, context);
    if (paused || !settings.enabled || location.href !== url)
      throw new DOMException("Đã dừng hoặc đổi bài", "AbortError");
    // A changing rubric gets another attempt after it has settled.
    if (!owner.isConnected || marker(scan()) !== key)
      return { status: "skipped" };
    if ((await ROOT.peerTracker.refresh())?.remaining === 0)
      return { status: "review" };
    owner.dataset.skipperPeerAuto = key;
    try {
      const plan = prepare(settings.comment, settings.mode, {
        ...context,
        automatic: true,
      });
      const result = await apply(plan);
      if (settings.autoSubmit) {
        report(
          `Đã điền ${result.choices} tiêu chí; đang nộp và chờ Coursera xác nhận…`,
        );
        const submitted = await ROOT.peerSubmit.submitAndNext(plan, context);
        report(submitted.message, "success");
      } else {
        report(
          `Peer Review tự động: đã điền ${result.choices} lựa chọn điểm, ${result.comments} nhận xét. Bạn kiểm tra rồi tự nộp.`,
          "success",
        );
      }
      return { status: "review" };
    } catch (error) {
      if (error.name === "AbortError") throw error;
      paused = true;
      report("Peer Review dừng: " + error.message, "error");
      return { status: "failed" };
    }
  }
  function run(context = {}) {
    if (task) return task;
    controller = new AbortController();
    const abort = () => controller?.abort();
    context.signal?.addEventListener("abort", abort, { once: true });
    if (context.signal?.aborted) abort();
    const signal = controller.signal;
    task = attempt({ ...context, signal, automatic: true }).finally(() => {
      context.signal?.removeEventListener("abort", abort);
      task = null;
      controller = null;
    });
    return task;
  }
  function pauseAuto() {
    ROOT.peerScan.stop();
    paused = true;
    controller?.abort();
  }
  function resumeAuto() {
    ROOT.peerScan.reset();
    paused = false;
  }
  function configure(next) {
    ROOT.peerScan.reset();
    controller?.abort();
    settings = globalThis.SkipperPeerSettings.normalize(next);
    paused = false;
  }
  function prerequisiteReason() {
    const pageText = text(document.body).replace(
      text(document.getElementById("skipper-pro-panel")),
      "",
    );
    if (
      /submit your (?:project|assignment) before reviewing (?:classmates|peers)|nộp (?:bài|dự án).{0,30}trước khi.{0,20}(?:chấm|đánh giá)/i.test(
        pageText,
      )
    )
      return "Peer Review đang bị Coursera khóa: bạn cần tự nộp project trước khi chấm bài của bạn học.";
    const heading = text(document.querySelector("h1"));
    if (
      /^Practice Peer-graded Assignment/i.test(heading) &&
      !ROOT.peerPractice.reviewContext() &&
      !scan().some((part) => part.inputs.length)
    )
      return "Bài Practice cần sản phẩm portfolio của bạn: website và bản mô tả/video demo. Đây không phải biểu mẫu chấm điểm; hãy chuẩn bị bản nộp rồi mở My submission.";
    if (
      /\/peer\//.test(location.pathname) &&
      document.querySelector('input[placeholder*="descriptive title"]') &&
      /Coursera Honor Code/i.test(pageText)
    )
      return "Bạn đang ở phần nộp project của mình. Hãy tự nộp project rồi mở Review Your Peers để chấm bài.";
    return null;
  }
  async function process(context = {}) {
    const prerequisite = prerequisiteReason();
    if (prerequisite) return { status: "review", message: prerequisite };
    if (!settings.enabled || paused) return { status: "skipped" };
    if ((await ROOT.peerTracker.refresh())?.remaining === 0)
      return { status: "review" };
    const available = await ROOT.dom.waitFor(
      () =>
        scan().some((part) => part.inputs.length) ||
        startReviewButton() ||
        ROOT.peerPractice.links().length ||
        prerequisiteReason(),
      { ...context, timeout: 10000 },
    );
    const blocked = prerequisiteReason();
    if (blocked) return { status: "review", message: blocked };
    if (!available)
      return {
        status: "review",
        message: context.scanning
          ? "Coursera chưa cung cấp biểu mẫu chấm khả dụng sau khi tự mở Review Your Peers; chưa tính hoàn thành."
          : "Chưa thấy biểu mẫu chấm bài. Hãy mở Review Your Peers; chưa có lượt chấm nào được tính hoàn thành.",
      };
    return run(context);
  }
  const ready = ROOT.instance.role
    .then((worker) =>
      worker
        ? { ...globalThis.SkipperPeerSettings.defaults }
        : globalThis.SkipperPeerSettings.read(),
    )
    .then(configure)
    .catch((error) => report(error.message, "error"));
  const interval = setInterval(() => {
    if (ROOT.instance.backgroundWorker) return;
    ROOT.peerTracker.refresh().catch(() => {});
    if (
      !settings.enabled ||
      paused ||
      task ||
      document.getElementById("sp-start")?.disabled
    )
      return;
    const operation = settings.scanCourse
      ? ROOT.peerScan.start(settings)
      : run();
    operation.catch((error) => {
      if (error.name !== "AbortError") report(error.message, "error");
    });
  }, 800);
  const changed = (changes, area) => {
    if (
      !ROOT.instance.backgroundWorker &&
      area === "local" &&
      changes.peerReview
    )
      configure(changes.peerReview.newValue);
  };
  chrome.storage.onChanged.addListener(changed);
  ROOT.instance.addCleanup(() => {
    pauseAuto();
    clearInterval(interval);
    chrome.storage.onChanged.removeListener(changed);
  });
  ROOT.peerReview = {
    prepare,
    apply,
    configure,
    pauseAuto,
    resumeAuto,
    process: async (context) => {
      await ready;
      return process(context);
    },
  };
})();
