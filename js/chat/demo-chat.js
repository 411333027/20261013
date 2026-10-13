// 示範用聊天服務（階段一）。不連任何伺服器：
// - 2～3 個假的使用者，會自動說話、偶爾離開再回來
// - 同一個瀏覽器的分頁之間，用 BroadcastChannel 互傳訊息和線上名單
// - 可以模擬斷線
//
// 「插座」的形狀（supabase-chat.js 必須提供一模一樣的東西，見 architecture.md 第 4.1 節）：
//   createXxxChat({ onMessage, onPresence, onStatus }) → { connect(me), send(payload), leave() }
//   onMessage(payload)       別人送來的原始訊息（畫面層會再檢查格式）
//   onPresence([{id, meta}]) 最新的完整線上名單，meta = { name, joinedAt }
//   onStatus(status)         "connecting" | "online" | "offline"
//   send(payload)            回傳 Promise<{ ok: boolean }>
// 示範模式另外提供 demo.setOffline(boolean)，給「模擬斷線」開關使用。

import { newId } from "../core/identity.js";
import { PROTOCOL_VERSION } from "../core/rules.js";

const CHANNEL_NAME = "anon-chat-demo";
const HEARTBEAT_MS = 3000;
const PEER_TIMEOUT_MS = 9000;

const BOT_NAMES = ["阿華", "小明", "小明"]; // 刻意有兩個同名
const BOT_LINES = [
  "早安～今天有人要去看展嗎？",
  "我我我！",
  "我也想去\n不過要下午才有空",
  "有人知道附近哪裡有好吃的拉麵嗎",
  "展覽資訊在這 https://example.com/expo",
  "剛剛那個 <b>粗體</b> 有變粗嗎？",
  "哈哈哈哈",
  "今天好冷，記得多穿一點",
  "週末要不要一起去爬山？",
  "我先去吃飯，等等回來",
  "推薦一首歌：〈晴天〉",
  "這裡好安靜喔",
  "👋",
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.random() * (max - min);

export function createDemoChat({ onMessage, onPresence, onStatus }, { bots: withBots = true } = {}) {
  let me = null;
  let status = "connecting";
  let offline = false;
  let closed = false;
  const peers = new Map(); // 其他分頁：id → { meta, seenAt }
  const timers = new Set();
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

  const bots = withBots
    ? BOT_NAMES.map((name, i) => ({
        id: newId(),
        meta: { name, joinedAt: new Date(Date.now() - (i + 1) * 60_000).toISOString() },
        present: true,
      }))
    : [];

  function later(fn, ms) {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!closed) fn();
    }, ms);
    timers.add(t);
  }

  function setStatus(next) {
    status = next;
    onStatus(next);
  }

  const isOnline = () => status === "online" && !offline && !closed;

  function emitPresence() {
    if (!isOnline()) return;
    const list = [{ id: me.id, meta: me.meta }];
    for (const bot of bots) if (bot.present) list.push({ id: bot.id, meta: bot.meta });
    for (const [id, peer] of peers) list.push({ id, meta: peer.meta });
    onPresence(list);
  }

  function post(message) {
    if (channel && !closed) channel.postMessage(message);
  }

  function announce(type) {
    post({ type, id: me.id, meta: me.meta });
  }

  function goOnline() {
    setStatus("online");
    announce("hello");
    emitPresence();
  }

  if (channel) {
    channel.onmessage = ({ data }) => {
      if (!me || !isOnline() || !data || typeof data !== "object") return;
      if (data.type === "hello" || data.type === "here") {
        if (typeof data.id !== "string" || data.id === me.id) return;
        const isNew = !peers.has(data.id);
        peers.set(data.id, { meta: data.meta, seenAt: Date.now() });
        if (data.type === "hello") announce("here");
        if (isNew) emitPresence();
      } else if (data.type === "bye") {
        if (peers.delete(data.id)) emitPresence();
      } else if (data.type === "message") {
        onMessage(data.payload);
      }
    };
  }

  function heartbeat() {
    if (isOnline()) {
      announce("here");
      let changed = false;
      for (const [id, peer] of peers) {
        if (Date.now() - peer.seenAt > PEER_TIMEOUT_MS) changed = peers.delete(id) || changed;
      }
      if (changed) emitPresence();
    }
    later(heartbeat, HEARTBEAT_MS);
  }

  function botTalk() {
    const speakers = bots.filter((b) => b.present);
    if (isOnline() && speakers.length > 0) {
      const bot = pick(speakers);
      onMessage({ v: PROTOCOL_VERSION, msgId: newId(), senderId: bot.id, name: bot.meta.name, text: pick(BOT_LINES) });
    }
    later(botTalk, between(5000, 12000));
  }

  function botComeAndGo() {
    const bot = pick(bots);
    bot.present = !bot.present;
    emitPresence();
    later(botComeAndGo, bot.present ? between(40000, 70000) : between(15000, 25000));
  }

  function onPageHide() {
    if (me) announce("bye");
  }

  return {
    connect({ id, name, joinedAt }) {
      me = { id, meta: { name, joinedAt } };
      setStatus("connecting");
      later(goOnline, 600);
      later(heartbeat, HEARTBEAT_MS);
      if (bots.length > 0) {
        later(botTalk, between(2500, 5000));
        later(botComeAndGo, between(40000, 70000));
      }
      addEventListener("pagehide", onPageHide);
    },

    send(payload) {
      return new Promise((resolve) => {
        later(() => {
          if (!isOnline()) return resolve({ ok: false });
          post({ type: "message", payload });
          resolve({ ok: true });
        }, 150);
        if (closed) resolve({ ok: false });
      });
    },

    leave() {
      if (me) announce("bye");
      closed = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      removeEventListener("pagehide", onPageHide);
      channel?.close();
    },

    demo: {
      setOffline(value) {
        if (value === offline || closed) return;
        offline = value;
        if (offline) {
          setStatus("offline");
        } else {
          peers.clear(); // 斷線期間的名單不算數，重新問一次
          setStatus("connecting");
          later(goOnline, 800);
        }
      },
    },
  };
}
