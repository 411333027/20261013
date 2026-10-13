// 聊天畫面：訊息區、自動捲動、輸入區、連線狀態、只有你一個人的提示。
// 不知道訊息是怎麼送出去的，只透過 onSend / onLeave 跟外面講話。

import { MESSAGE_MAX, inspectMessage } from "../core/rules.js";
import { SEND_LIMIT, createRateLimiter } from "../core/rate-limit.js";
import { createAvatar, createTag } from "./person.js";

const MAX_MESSAGES_ON_SCREEN = 500;
const NEAR_BOTTOM_PX = 48;
const INPUT_MAX_HEIGHT = 140;
const prefersTouch = () => matchMedia("(pointer: coarse)").matches;

const WIFI_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5.5 12.3a10 10 0 0 1 13 0"/><path d="M9 15.8a5 5 0 0 1 6 0"/><path d="M12 19.5h.01"/></svg>';

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // 一律當純文字，不解讀 HTML
  return node;
}

function createLine(text) {
  const line = el("div", "msg__line");
  line.append(el("div", "bubble", text), el("span", "msg__time", formatTime(new Date())));
  return line;
}

export function createChatScreen(els, { onlineList, onSend, onLeave }) {
  const { root, statusBar, statusText, messages, alone, newMessages, composer, hint, input, sendButton, leaveButton } = els;

  let state;

  function freshState(myId) {
    return {
      myId,
      status: "connecting",
      hasBeenOnline: false,
      droppedSinceOnline: false,
      memberCount: 0,
      messageCount: 0,
      limiter: createRateLimiter(SEND_LIMIT),
      rateLimited: false,
      rateTimer: null,
    };
  }

  // ---------- 捲動 ----------

  const isNearBottom = () => messages.scrollHeight - messages.scrollTop - messages.clientHeight < NEAR_BOTTOM_PX;

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
    newMessages.hidden = true;
  }

  function append(node, { forceScroll = false, countsAsMessage = true } = {}) {
    const stick = forceScroll || isNearBottom();
    messages.append(node);
    while (messages.childElementCount > MAX_MESSAGES_ON_SCREEN) messages.firstElementChild.remove();
    if (countsAsMessage) state.messageCount++;
    if (stick) scrollToBottom();
    else newMessages.hidden = false;
    updateAlone();
  }

  messages.addEventListener("scroll", () => {
    if (isNearBottom()) newMessages.hidden = true;
  });

  newMessages.addEventListener("click", scrollToBottom);

  // ---------- 畫訊息 ----------

  function renderIncoming(msg) {
    const node = el("div", "msg");
    const body = el("div", "msg__body");
    const who = el("div", "msg__who");
    who.append(el("span", "msg__name", msg.name), createTag(msg.senderId));
    body.append(who, createLine(msg.text));
    node.append(createAvatar(msg.senderId, msg.name), body);
    return node;
  }

  function renderOwn(text) {
    const node = el("div", "msg msg--own");
    node.append(createLine(text));
    return node;
  }

  function markFailed(node) {
    node.classList.add("msg--failed");
    node.append(el("span", "failed-tag", "! 沒有送出"));
  }

  function appendSystem(text) {
    const node = el("div", "system");
    node.innerHTML = WIFI_ICON; // 固定的圖示，不含任何別人送來的內容
    node.append(el("span", "", text));
    append(node, { forceScroll: true, countsAsMessage: false });
  }

  // ---------- 只有你一個人 ----------

  function updateAlone() {
    alone.hidden = !(state.status === "online" && state.memberCount <= 1 && state.messageCount === 0);
  }

  // ---------- 輸入區 ----------

  function setHint(kind, content) {
    if (!kind) {
      hint.hidden = true;
      return;
    }
    hint.className = `composer__hint composer__hint--${kind}`;
    hint.replaceChildren(...content);
    hint.hidden = false;
  }

  function refreshComposer() {
    const info = inspectMessage(input.value);
    const online = state.status === "online";

    if (state.status === "offline") {
      setHint("info", ["連上之後才能送出，打好的字會留著"]);
    } else if (info.tooLong) {
      setHint("error", [el("span", "", `超過 ${MESSAGE_MAX} 字`), el("span", "", `${info.length}/${MESSAGE_MAX}`)]);
    } else if (state.rateLimited) {
      setHint("warn", ["你送太快了，請稍等幾秒"]);
    } else {
      setHint(null);
    }

    input.classList.toggle("is-invalid", info.tooLong);
    sendButton.disabled = !online || info.empty || info.tooLong || state.rateLimited;
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight + 4, INPUT_MAX_HEIGHT)}px`;
  }

  async function submit() {
    const info = inspectMessage(input.value);
    if (state.status !== "online" || info.empty || info.tooLong || state.rateLimited) return;

    const verdict = state.limiter.check();
    if (!verdict.ok) {
      state.rateLimited = true;
      refreshComposer();
      const current = state;
      current.rateTimer = setTimeout(() => {
        current.rateLimited = false;
        current.rateTimer = null;
        if (current === state) refreshComposer();
      }, verdict.retryInMs);
      return;
    }

    state.limiter.record();
    const node = renderOwn(info.value);
    append(node, { forceScroll: true });
    input.value = "";
    autosize();
    refreshComposer();

    const result = await onSend(info.value);
    if (!result.ok) markFailed(node);
  }

  input.addEventListener("input", () => {
    autosize();
    refreshComposer();
  });

  input.addEventListener("keydown", (event) => {
    // 打中文選字時按的 Enter 是「確定選字」，不能送出
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  });

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });

  leaveButton.addEventListener("click", () => onLeave());

  // ---------- 對外 ----------

  return {
    show({ myId }) {
      if (state?.rateTimer) clearTimeout(state.rateTimer);
      state = freshState(myId);
      messages.replaceChildren();
      newMessages.hidden = true;
      alone.hidden = true;
      input.value = "";
      input.style.height = "";
      onlineList.reset();
      this.setStatus("connecting");
      root.hidden = false;
      if (!prefersTouch()) input.focus();
    },

    hide() {
      if (state?.rateTimer) clearTimeout(state.rateTimer);
      root.hidden = true;
    },

    setStatus(status) {
      if (status === "offline" && state.hasBeenOnline) state.droppedSinceOnline = true;
      state.status = status;

      root.classList.toggle("is-offline", status === "offline");
      statusBar.hidden = status === "online";
      statusText.textContent = status === "offline" ? "連線中斷，正在重新連線…" : "連線中…";

      if (status === "online") {
        state.hasBeenOnline = true;
        if (state.droppedSinceOnline) {
          state.droppedSinceOnline = false;
          appendSystem("你剛剛斷線了，期間的訊息沒有收到");
        }
      }
      refreshComposer();
      updateAlone();
    },

    addIncoming(msg) {
      append(renderIncoming(msg));
    },

    setMembers(members) {
      state.memberCount = members.length;
      onlineList.render(members, state.myId);
      updateAlone();
    },
  };
}
