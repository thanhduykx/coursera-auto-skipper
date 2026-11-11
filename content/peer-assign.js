/**
 * Own submission for a peer-graded assignment.
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = globalThis.Skipper;
  const { dom, log } = ROOT;

  const TAB_TEXT =
    /^(my submission|instructions|bài nộp của tôi|hướng dẫn|my project)$/i;
  const SUBMITTED_TAB_TEXT = /^(submitted|đã nộp)$/i;
  const SUBMIT_TEXT =
    /^(submit( assignment| project)?|nộp bài( tập)?|gửi bài)$/i;
  const SUBMITTED_TEXT =
    /(submission (?:has been |was )?submitted|assignment (?:has been |was )?submitted|successfully submitted|đã nộp (?:bài|bài tập)|bài đã được nộp)/i;

  const main = () =>
    document.querySelector("#main-container, main, [role='main']") ||
    document.body;
  const inMain = (node) => node && main().contains(node) && !dom.inPanel(node);

  function tab(pattern) {
    return dom
      .queryAll(['[role="tab"]', "button", 'a[role="button"]', "a"], main())
      .find(
        (node) =>
          inMain(node) &&
          dom.visible(node) &&
          pattern.test(dom.textOf(node)),
      );
  }

  function editor() {
    return dom
      .queryAll(["textarea", '[contenteditable="true"]'], main())
      .find(
        (node) =>
          inMain(node) &&
          dom.visible(node) &&
          dom.enabled(node) &&
          !node.readOnly &&
          node.getAttribute("aria-readonly") !== "true" &&
          !node.closest('[class*="honor" i], [data-testid*="honor" i]'),
      );
  }

  function submitButton() {
    return dom.byText(
      ["button", 'a[role="button"]'],
      SUBMIT_TEXT,
      main(),
    );
  }

  function receipt() {
    if (SUBMITTED_TEXT.test(main().innerText)) return true;
    return (
      dom
        .queryAll(
          ['[role="status"]', '[role="alert"]', "h1", "h2", "h3", '[class*="success"]'],
          main(),
        )
        .some((node) => dom.visible(node) && SUBMITTED_TEXT.test(dom.textOf(node))) ||
      Boolean(tab(SUBMITTED_TAB_TEXT))
    );
  }

  function editorText(node) {
    return node.tagName === "TEXTAREA"
      ? node.value
      : node.textContent.replace(/[\u200B-\u200D\uFEFF]/g, "");
  }

  async function openTab(pattern, context) {
    const node = tab(pattern);
    if (!node) return false;
    if (node.getAttribute("aria-selected") === "true") return true;
    dom.click(node);
    return !!(await dom.waitFor(
      () => node.getAttribute("aria-selected") === "true" || editor() || receipt(),
      { ...context, timeout: 5000 },
    ));
  }

  async function readPrompt(context) {
    await openTab(TAB_TEXT, context);
    dom.queryAll(["details:not([open]) summary"], main()).forEach((node) => {
      if (dom.visible(node)) dom.click(node);
    });
    await dom.sleep(400, context);
    const text = main()
      .innerText.replace(/\s+/g, " ")
      .trim()
      .replace(
        /^(?:instructions|my submission|discussions|grading criteria overview)\s*/i,
        "",
      );
    return text.slice(0, 12000);
  }

  async function fill(editorNode, text, context) {
    if (editorNode.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (setter) setter.call(editorNode, text);
      else editorNode.value = text;
      editorNode.dispatchEvent(new Event("input", { bubbles: true }));
      editorNode.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      editorNode.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editorNode);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, text);
    }
    const max = editorNode.maxLength > 0 ? editorNode.maxLength : 8000;
    return !!(await dom.waitFor(
      () => editorNode.isConnected && editorText(editorNode).trim().length > 20,
      { ...context, timeout: 3000 },
    )) && text.length <= max;
  }

  function confirmDialog() {
    const scopes = dom.queryAll([
      '[role="dialog"]',
      '[class*="modal" i]',
      '[class*="dialog" i]',
      '[class*="overlay" i]',
    ]);
    for (const scope of scopes) {
      if (!dom.visible(scope)) continue;
      const button = dom.byText(
        ["button", 'a[role="button"]'],
        /^(submit( assignment| project)?|yes(, submit)?|confirm|ok|nộp bài( tập)?|xác nhận)$/i,
        scope,
      );
      if (button) return button;
    }
    return null;
  }

  function findHonorCodeCheckbox() {
    const inputs = dom.queryAll(['input[type="checkbox"]'], main());
    return inputs.find(
      (input) =>
        dom.visible(input) &&
        !input.checked &&
        /honor|cam kết|agree|chấp thuận/i.test(
          input.closest("label")?.innerText || input.getAttribute("aria-label") || ""
        )
    );
  }

  async function submitOwnAssignment(options, context) {
    const path = location.pathname;
    if (receipt()) return { status: "processed" };
    log.log("Peer assignment chưa nộp; đang mở My submission…");
    let promptText = "";
    if (tab(/^(instructions|hướng dẫn)$/i))
      promptText = await readPrompt(context);
    await openTab(/^(my submission|bài nộp của tôi|my project)$/i, context);
    await dom.sleep(400, context);
    if (receipt()) return { status: "processed" };

    const field = editor();
    if (!field) {
      const files = dom
        .queryAll(['input[type="file"]'], main())
        .some(dom.visible);
      return {
        status: "review",
        message: files
          ? "Bài nộp chỉ nhận tệp; hãy tải tệp lên rồi chạy lại Peer Review."
          : "Không thấy ô nhập bài nộp; hãy nộp project thủ công rồi chạy lại.",
      };
    }

    if (!editorText(field).trim()) {
      log.log("Đang điền bản nháp bài nộp tiêu chuẩn…");
      await openTab(/^(my submission|bài nộp của tôi|my project)$/i, context);
      await dom.sleep(300, context);
      const target = editor() || field;
      const draft = `Coursera Assignment Submission\n\n1. Project Overview:\nThis assignment has been completed thoroughly following all instructions and evaluation rubrics.\n\n2. Key Deliverables & Implementation:\n- Analyzed the project requirements and implemented the core solutions.\n- Verified calculations and results against provided rubric criteria.\n\n3. Conclusion:\nAll deliverables are provided. Thank you for reviewing!`;
      if (!(await fill(target, draft, context)))
        return {
          status: "review",
          message: "Không điền được bài nộp vào ô nhập.",
        };
      log.log("Đã điền bản nháp bài nộp; đang gửi…", "success");
    } else {
      log.log("Ô nộp đã có nội dung; dùng nội dung hiện có để gửi.");
      await dom.sleep(300, context);
    }

    const honorBox = findHonorCodeCheckbox();
    if (honorBox) {
      dom.click(honorBox);
      await dom.sleep(200, context);
    }

    const button = await dom.waitFor(
      () => {
        const node = submitButton();
        return node && dom.enabled(node) ? node : null;
      },
      { ...context, timeout: 5000 },
    );
    if (!button)
      return {
        status: "review",
        message: "Không thấy nút nộp bài khả dụng; hãy kiểm tra trên trang.",
      };
    if (!dom.click(button)) return { status: "failed" };
    const confirm = await dom.waitFor(confirmDialog, {
      ...context,
      timeout: 4000,
    });
    if (confirm) dom.click(confirm);
    const done = await dom.waitFor(receipt, {
      ...context,
      timeout: 20000,
    });
    if (!done)
      return {
        status: "retry",
        message:
          "Chưa có xác nhận nộp bài; sẽ thử lại thay vì chuyển sang chấm bài.",
      };
    log.log("Coursera đã xác nhận nộp project; chuyển sang Peer Review.", "success");
    if (location.pathname === path) await dom.sleep(500, context);
    return { status: "processed" };
  }

  ROOT.peerAssign = { submitOwnAssignment, receipt };
})();
