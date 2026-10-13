// 頭像和「#三碼」標籤：訊息和線上名單共用。顏色和三碼都從身分編號算出來。

import { tagFor, toneFor } from "../core/identity.js";
import { firstChar } from "../core/rules.js";

export function createAvatar(id, name) {
  const el = document.createElement("span");
  el.className = `avatar tone-${toneFor(id)}`;
  el.setAttribute("aria-hidden", "true");
  el.textContent = firstChar(name);
  return el;
}

export function createTag(id) {
  const el = document.createElement("span");
  el.className = `tag tone-${toneFor(id)}`;
  el.textContent = tagFor(id);
  return el;
}
