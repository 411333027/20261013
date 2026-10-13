// 代號與訊息的規則。兩個階段共用，也用來檢查別人送進來的東西（architecture.md 第 5.5、9.2 節）。

export const NAME_MAX = 10;
export const MESSAGE_MAX = 500;
export const PROTOCOL_VERSION = 1;

// 控制字元（保留換行）、零寬字元、改變文字方向的字元
const INVISIBLE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

const segmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter("zh-Hant", { granularity: "grapheme" })
    : null;

/** 看起來是一個字的就算一個字（👨‍👩‍👧 算 1 個）。 */
export function countChars(text) {
  if (!segmenter) return Array.from(text).length;
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

/** 第一個「字」，用在頭像。 */
export function firstChar(text) {
  if (!segmenter) return Array.from(text)[0] ?? "";
  for (const { segment } of segmenter.segment(text)) return segment;
  return "";
}

export function cleanName(raw) {
  return String(raw ?? "").replace(INVISIBLE, "").replace(/\n/g, "").trim();
}

export function cleanMessage(raw) {
  return String(raw ?? "").replace(/\r\n?/g, "\n").replace(INVISIBLE, "").trim();
}

/** @returns {{ok: true, value: string} | {ok: false, error: string}} */
export function validateName(raw) {
  const value = cleanName(raw);
  if (value === "") return { ok: false, error: "請輸入代號（1～10 個字，不能只有空白）" };
  if (countChars(value) > NAME_MAX) return { ok: false, error: `代號最多 ${NAME_MAX} 個字` };
  return { ok: true, value };
}

/** @returns {{value: string, length: number, empty: boolean, tooLong: boolean}} */
export function inspectMessage(raw) {
  const value = cleanMessage(raw);
  const length = countChars(value);
  return { value, length, empty: length === 0, tooLong: length > MESSAGE_MAX };
}

export function buildMessage({ msgId, senderId, name, text }) {
  return { v: PROTOCOL_VERSION, msgId, senderId, name, text };
}

const isId = (x) => typeof x === "string" && x.length > 0 && x.length <= 64;

/** 檢查別人送來的訊息；格式不對就回傳 null（直接丟掉，不顯示）。 */
export function parseIncomingMessage(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.v !== PROTOCOL_VERSION) return null;
  if (!isId(payload.msgId) || !isId(payload.senderId)) return null;
  if (typeof payload.name !== "string" || typeof payload.text !== "string") return null;
  if (payload.text.length > MESSAGE_MAX * 20) return null; // 先擋掉超大的，避免浪費時間計算
  const name = validateName(payload.name);
  if (!name.ok) return null;
  const text = inspectMessage(payload.text);
  if (text.empty || text.tooLong) return null;
  return { msgId: payload.msgId, senderId: payload.senderId, name: name.value, text: text.value };
}

/** 檢查線上名單裡的一個人；不對就回傳 null。 */
export function parsePresence(id, meta) {
  if (!isId(id) || !meta || typeof meta !== "object") return null;
  const name = validateName(meta.name);
  if (!name.ok) return null;
  const joinedAt = typeof meta.joinedAt === "string" ? meta.joinedAt : "";
  return { id, name: name.value, joinedAt };
}
