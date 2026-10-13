// 線上名單：手機上點人數才展開，電腦上一直顯示在右邊（切換由 CSS 決定）。

import { createAvatar, createTag } from "./person.js";

export function createOnlineList({ toggle, panel, list, counts }) {
  const isOpen = () => panel.classList.contains("is-open");

  function setOpen(open) {
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  document.addEventListener("click", (event) => {
    if (isOpen() && !panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  function render(members, myId) {
    const sorted = [...members].sort((a, b) => {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      return a.joinedAt.localeCompare(b.joinedAt);
    });

    for (const el of counts) el.textContent = `線上 ${members.length} 人`;

    list.replaceChildren(
      ...sorted.map((member) => {
        const item = document.createElement("li");
        item.className = "online__item";
        const name = document.createElement("span");
        name.className = "online__name";
        name.textContent = member.name;
        item.append(createAvatar(member.id, member.name), name, createTag(member.id));
        if (member.id === myId) {
          const you = document.createElement("span");
          you.className = "online__you";
          you.textContent = "（你）";
          item.append(you);
        }
        return item;
      }),
    );
  }

  return {
    render,
    reset() {
      setOpen(false);
      render([], null);
    },
  };
}
