# 匿名聊天室

不用註冊、不用登入，取一個代號就能開始聊天的網頁聊天室。

- 網址：`https://411333027.github.io/20261013/`（在 GitHub 的 Settings → Pages 開啟後才有）
- 目前在**階段一**：示範模式，還沒連上 Supabase。
- 架構與決定：[`docs/architecture.md`](docs/architecture.md)
- 畫面設計：[`docs/design.md`](docs/design.md)

## 在自己電腦上預覽

網頁用到瀏覽器的模組功能，不能直接雙擊 `index.html` 打開，要透過本機伺服器：

```
python -m http.server 8000
```

然後打開 <http://localhost:8000/>。

## 示範模式的網址參數

| 網址 | 效果 |
|---|---|
| `?bots=0` | 不要假的使用者（用來看「只有你一個人」的畫面） |
| `?demo` | 階段二之後，強制回到示範模式 |
