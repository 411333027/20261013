// 用 localStorage 記住上次的代號。無痕模式或被封鎖時讀寫會失敗，那就當作沒記住。

const KEY = "anonchat.lastName";

export function loadLastName() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveLastName(name) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // 記不住也沒關係
  }
}
