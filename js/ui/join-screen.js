// 進入畫面：輸入代號、檢查規則、按「進入」。

import { NAME_MAX, cleanName, countChars, validateName } from "../core/rules.js";

const prefersTouch = () => matchMedia("(pointer: coarse)").matches;

export function createJoinScreen({ root, form, input, help, count, error }, { onEnter }) {
  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
  }

  function clearError() {
    error.hidden = true;
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
  }

  function updateCount() {
    const n = countChars(cleanName(input.value));
    count.textContent = `${n}/${NAME_MAX}`;
    count.classList.toggle("is-over", n > NAME_MAX);
  }

  input.addEventListener("input", () => {
    clearError();
    updateCount();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = validateName(input.value);
    if (!result.ok) {
      showError(result.error);
      input.focus();
      return;
    }
    onEnter(result.value);
  });

  return {
    show(lastName) {
      input.value = lastName;
      help.textContent = lastName ? "上次用的代號，可以直接進入或修改" : "取一個 1～10 個字的代號";
      clearError();
      updateCount();
      root.hidden = false;
      if (!prefersTouch()) input.focus();
    },
    hide() {
      root.hidden = true;
    },
  };
}
