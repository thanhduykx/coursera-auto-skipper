/**
 * Discussion Prompt Helper & Auto-Reply
 * Dev by thanh duyvp
 */
(() => {
  const ROOT = (globalThis.Skipper = globalThis.Skipper || {});
  const { dom, log } = ROOT;
  const attempts = new Set();

  const PROMPT_SELECTORS = [
    '[data-testid="discussion-prompt"]',
    ".rc-DiscussionPrompt__prompt",
    ".discussion-prompt",
    '[data-testid="prompt-body"]',
    ".rc-ItemPage__content",
  ];

  const EDITOR_SELECTORS = [
    '[role="textbox"][contenteditable="true"][aria-label="Your Reply"]',
    '[data-slate-editor="true"][contenteditable="true"]',
    "textarea",
    'form [contenteditable="true"]',
    '[contenteditable="true"]',
    '[data-testid="discussion-editor"] [contenteditable="true"]',
  ];

  const DEFAULT_DRAFT = "Thank you for sharing! Very insightful and well presented.";

  async function getDraftText() {
    try {
      const config = await ROOT.state?.getOptions?.();
      if (config?.discussionComment && typeof config.discussionComment === "string" && config.discussionComment.trim()) {
        return config.discussionComment.trim();
      }
    } catch {}
    return DEFAULT_DRAFT;
  }

  function findEditor() {
    const main = document.querySelector(
      "#main-container, .main-container, main",
    );
    return dom
      .queryAll(EDITOR_SELECTORS, main || document)
      .find(
        (editor) =>
          dom.visible(editor) &&
          dom.enabled(editor) &&
          !editor.readOnly &&
          !editor.closest('[hidden], [aria-hidden="true"]') &&
          !dom.inPanel(editor),
      );
  }

  function readPrompt() {
    const node = dom.query(PROMPT_SELECTORS);
    if (node && dom.textOf(node)) return dom.textOf(node).slice(0, 2000);
    const heading = dom.byText(
      ["h1", "h2", "h3", '[role="heading"]'],
      /discussion|thảo luận|reflect|chia sẻ/i,
    );
    if (heading) return dom.textOf(heading).slice(0, 2000);
    if (!location.pathname.includes("/discussionPrompt/")) return "";
    const title = dom.query(["main h1", '[class*="main-container"] h1', "h1"]);
    const editor = findEditor();
    if (
      !title ||
      !editor ||
      !(
        title.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    )
      return "";
    const range = document.createRange();
    range.setStartBefore(title);
    range.setEndBefore(editor);
    return range
      .toString()
      .replace(/Participation is optional/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  }

  async function fillTextarea(editor, text, context = {}) {
    if (!editor || !text) return false;
    if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      );
      if (editor.tagName === "TEXTAREA" && setter && setter.set) {
        setter.set.call(editor, text);
      } else {
        editor.value = text;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    editor.focus();
    if (editor.matches('[data-slate-editor="true"]')) {
      const transfer = new DataTransfer();
      transfer.setData("text/plain", text);
      const paste = new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      editor.dispatchEvent(paste);
      if (!paste.defaultPrevented) return false;
      await dom.sleep(150, context);
      return !!(await dom.waitFor(
        () =>
          editor.isConnected &&
          editorText(editor) === text.trim() &&
          !!editor.querySelector("[data-slate-string]"),
        { ...context, timeout: 2000, interval: 100 },
      ));
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    const inserted = document.execCommand("insertText", false, text);
    return inserted && editorText(editor) === text.trim();
  }

  function editorText(editor) {
    if (!editor) return "";
    if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT")
      return editor.value.trim();
    const clone = editor.cloneNode(true);
    clone
      .querySelectorAll("[data-slate-placeholder]")
      .forEach((node) => node.remove());
    return clone.textContent.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  }

  async function draftDiscussion(context = {}) {
    dom.assertActive(context);
    const promptText = readPrompt();
    if (!promptText) {
      log.log("Không tìm thấy đề bài thảo luận trên trang này", "error");
      return false;
    }

    const editor = findEditor();
    if (!editor) {
      log.log("Không tìm thấy ô nhập nội dung thảo luận", "error");
      return false;
    }

    const before = editorText(editor);
    if (String(before || "").trim()) {
      log.log(
        "Ô thảo luận đã có nội dung; giữ nguyên để bạn kiểm tra.",
        "info",
      );
      return true;
    }

    const draft = await getDraftText();

    dom.assertActive(context);
    if (!editor.isConnected || editorText(editor) !== before) {
      log.log("Nội dung đã thay đổi; giữ nguyên.", "info");
      return false;
    }
    const filled = await fillTextarea(editor, draft, context);
    if (!filled) {
      log.log("Không điền được nội dung vào ô thảo luận", "error");
      return false;
    }

    const submit = dom.query(['button[id^="thread_reply_button"]']);
    if (
      submit &&
      !(await dom.waitFor(() => dom.enabled(submit), {
        ...context,
        timeout: 2500,
        interval: 100,
      }))
    ) {
      log.log(
        "Bản nháp đã hiển thị nhưng Coursera chưa bật Reply. Hãy gõ vào ô để editor nhận nội dung; chưa được tính là đã gửi.",
        "error",
      );
      return false;
    }
    log.log(`Đã điền phản hồi thảo luận: "${draft.slice(0, 40)}..."`, "success");
    await dom.sleep(400, context);
    return true;
  }

  function submittedReceipt() {
    const main = document.querySelector(
      "#main-container, .main-container, main",
    );
    return (
      main &&
      dom
        .queryAll(
          [
            '[aria-label="Success: Response submitted"]',
            '[data-testid="discussion-submission-success"]',
          ],
          main,
        )
        .some(
          (node) =>
            dom.visible(node) &&
            /response submitted|đã gửi phản hồi/i.test(dom.textOf(node)),
        )
    );
  }

  async function processDiscussion(context = {}) {
    dom.assertActive(context);
    if (!/\/discussionPrompt\//.test(location.pathname))
      return { status: "skipped" };
    const path = location.pathname;
    const success = {
      status: "submitted",
      message: "Coursera đã xác nhận gửi phản hồi thảo luận.",
    };
    if (submittedReceipt()) return success;
    if (attempts.has(path))
      return {
        status: "review",
        message: "Lượt gửi trước chưa được xác nhận; dừng để tránh gửi trùng.",
      };
    if (!(await draftDiscussion(context))) return { status: "failed" };
    dom.assertActive(context);

    const editor = findEditor();
    const currentText = editorText(editor);
    const expectedDraft = await getDraftText();
    if (!editor || (currentText !== expectedDraft && currentText !== "No comment" && !currentText))
      return {
        status: "review",
        message: "Giữ nguyên bản nháp bạn đã viết; chưa tự gửi nội dung này.",
      };

    const main = document.querySelector(
      "#main-container, .main-container, main",
    );
    const buttons = dom
      .queryAll(['button[id^="thread_reply_button"]'], main || document)
      .filter(dom.visible);
    if (buttons.length !== 1 || !dom.enabled(buttons[0]))
      return {
        status: "review",
        message: "Chưa xác định được nút Reply sẵn sàng; chưa gửi.",
      };
    attempts.add(path);
    if (!dom.click(buttons[0]))
      return {
        status: "review",
        message: "Chưa bấm được Reply; dừng để bạn kiểm tra.",
      };
    log.log("Đã bấm Reply, đang chờ Coursera xác nhận…");
    const confirmed = await dom.waitFor(submittedReceipt, {
      ...context,
      timeout: 12000,
      interval: 200,
    });
    if (!confirmed)
      return {
        status: "review",
        message: "Chưa có xác nhận gửi phản hồi; không gửi lại tự động.",
      };
    log.log(success.message, "success");
    return success;
  }

  ROOT.discussion = {
    draftDiscussion,
    processDiscussion,
    readPrompt,
    editorText,
  };
})();
