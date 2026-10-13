// 身分編號，以及從編號算出同名的區分標記（#三碼 和識別色）。

export const TONE_COUNT = 6; // 對應 style.css 的 .tone-0 ～ .tone-5

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 例如 "#a3f"。 */
export function tagFor(id) {
  return "#" + hash(id).toString(16).padStart(8, "0").slice(-3);
}

export function toneFor(id) {
  return hash("tone:" + id) % TONE_COUNT;
}
