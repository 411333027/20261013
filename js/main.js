// 程式的起點：決定用哪個聊天服務，串起進入畫面和聊天畫面。

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import { createDemoChat } from "./chat/demo-chat.js";
import { newId } from "./core/identity.js";
import { buildMessage, parseIncomingMessage, parsePresence } from "./core/rules.js";
import { createSenderFilter } from "./core/rate-limit.js";
import { loadLastName, saveLastName } from "./core/storage.js";
import { createJoinScreen } from "./ui/join-screen.js";
import { createChatScreen } from "./ui/chat-screen.js";
import { createOnlineList } from "./ui/online-list.js";

const params = new URLSearchParams(location.search);
const isDemo = params.has("demo") || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY;
const demoBots = params.get("bots") !== "0"; // 網址加 ?bots=0：不要假的使用者

/** 選插頭：示範模式，或 Supabase（階段二才有 supabase-chat.js）。 */
async function loadChatFactory() {
  if (isDemo) return (handlers) => createDemoChat(handlers, { bots: demoBots });
  const { createSupabaseChat } = await import("./chat/supabase-chat.js");
  return (handlers) => createSupabaseChat(handlers, { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY });
}

const $ = (id) => document.getElementById(id);

const demoBar = $("demo-bar");
const offlineSwitch = $("offline-switch");

const onlineList = createOnlineList({
  toggle: $("online-toggle"),
  panel: $("online-panel"),
  list: $("online-list"),
  counts: document.querySelectorAll(".online-count"),
});

const chatScreen = createChatScreen(
  {
    root: $("chat-screen"),
    statusBar: $("status-bar"),
    statusText: $("status-text"),
    messages: $("messages"),
    alone: $("alone"),
    newMessages: $("new-messages"),
    composer: $("composer"),
    hint: $("composer-hint"),
    input: $("message-input"),
    sendButton: $("send-button"),
    leaveButton: $("leave-button"),
  },
  { onlineList, onSend: sendMessage, onLeave: leave },
);

const joinScreen = createJoinScreen(
  {
    root: $("join-screen"),
    form: $("join-form"),
    input: $("nick"),
    help: $("nick-help"),
    count: $("nick-count"),
    error: $("nick-error"),
  },
  { onEnter: enter },
);

let chatFactory = null;
let session = null; // { me, service, seen, senderFilter }

async function enter(name) {
  saveLastName(name);
  chatFactory ??= await loadChatFactory();

  const me = { id: newId(), name, joinedAt: new Date().toISOString() };
  const current = { me, seen: new Set(), senderFilter: createSenderFilter() };

  joinScreen.hide();
  chatScreen.show({ myId: me.id });
  setOfflineSwitch(false);
  offlineSwitch.hidden = !isDemo;

  current.service = chatFactory({
    onMessage(raw) {
      if (session !== current) return;
      const msg = parseIncomingMessage(raw); // 不相信別人送來的任何東西
      if (!msg || msg.senderId === me.id || current.seen.has(msg.msgId)) return;
      if (!current.senderFilter.allow(msg.senderId)) return;
      current.seen.add(msg.msgId);
      if (current.seen.size > 2000) current.seen = new Set([...current.seen].slice(-1000));
      chatScreen.addIncoming(msg);
    },
    onPresence(list) {
      if (session !== current) return;
      const members = list.map(({ id, meta }) => parsePresence(id, meta)).filter(Boolean);
      chatScreen.setMembers(members);
    },
    onStatus(status) {
      if (session !== current) return;
      chatScreen.setStatus(status);
    },
  });

  session = current;
  current.service.connect(me);
}

function sendMessage(text) {
  if (!session) return Promise.resolve({ ok: false });
  const { me, service } = session;
  return service.send(buildMessage({ msgId: newId(), senderId: me.id, name: me.name, text }));
}

function leave() {
  session?.service.leave();
  session = null;
  offlineSwitch.hidden = true;
  chatScreen.hide();
  joinScreen.show(loadLastName());
}

function setOfflineSwitch(on) {
  offlineSwitch.setAttribute("aria-checked", String(on));
}

offlineSwitch.addEventListener("click", () => {
  const on = offlineSwitch.getAttribute("aria-checked") !== "true";
  setOfflineSwitch(on);
  session?.service.demo?.setOffline(on);
});

demoBar.hidden = !isDemo;
joinScreen.show(loadLastName());
