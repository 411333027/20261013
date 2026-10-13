# CLAUDE.md

不用登入的匿名聊天室：網頁放在 GitHub Pages，用 Supabase Realtime 即時傳訊。

## 開始任何工作前

先讀 `docs/architecture.md`。所有行為、通訊格式、資料夾結構都以它為準；要偏離時先問使用者，並更新文件。

做前端（畫面、CSS）之前，先讀 `docs/design.md`。顏色、字體、元件樣式都以它為準。

## 目前進度：階段一

- 只做前端與示範模式（`js/chat/demo-chat.js`），`js/config.js` 保持空的。
- 還不要接 Supabase，不要載入 supabase-js，也不要建立 `js/chat/supabase-chat.js`。

## 金鑰

- 不可以把金鑰檔案 commit 進 git（`.env`、`.env.*`、`*.local`、`secrets*` 已列在 `.gitignore`）。
- 唯一可以進 repo 的是 `js/config.js` 裡的 Project URL 和 `sb_publishable_` 開頭的金鑰。
- `sb_secret_` 開頭的金鑰、資料庫密碼，絕對不能出現在任何檔案裡。
