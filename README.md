# Bitget TradFi Phase 1 dry-run

依 `docs/mvp-architecture-plan.md` 建立的單一 Web Service 唯讀垂直接線。這個版本**沒有真實下單能力**：唯一交易 adapter 只接受已持久化的 intent，並回傳 `dryRun` 結果；公開 HTTP 僅允許 `GET`/`HEAD`。

## 模組

- `domain`：固定精度十進位、gross base fill 累計、ACK/FILL 分流、確定性 hedge intent。
- `workers/private-fill-listener`：私有事件 schema 正規化、Spot/Futures fill 分流及斷線告警。
- `workers/public-market-listener`：公開 ticker、stale 與 Reality market session 投影。
- `workers/recovery`：啟動 fail-closed 對帳骨架；證據不足保持 `PROTECTED`。
- `workers/file-store`：原子 rename 的可替換持久狀態介面（單程序 Phase 1）。
- `exchange-adapter/dry-run`：只有 dry-run ACK，無 place-order 網路路徑。
- `read-model`、`public-ui`：公開唯讀 JSON API 與監看 UI。
- `workers/telegram`：非阻斷 TG 告警，未設定時安全降級為遮罩日誌。

## 執行

需要 Node.js 20 以上，不需第三方套件：

```bash
npm test
npm start
```

瀏覽 `http://localhost:3000`。可設定 `PORT`、`STATE_FILE`、`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`；交易所 secret 不應出現在前端環境變數。啟動時 recovery skeleton 會刻意保持 `PROTECTED`，直到後續接上經 Phase 0 驗證的 authenticated REST/WS contract。

## 公開 API

- `GET /api/public/market`
- `GET /api/public/status`
- `GET /api/public/session`
- `GET /api/public/events`
- `GET /health/live`、`GET /health/ready`

其他 method 回傳 `405 read_only`，不存在任何管理或下單 route。

## 已知風險與下一步

此 Phase 1 實作刻意不臆測尚未驗證的 Bitget endpoint、簽章和事件欄位。JSON file store 僅適合單 replica dry-run，尚無跨程序 lease/fencing；Telegram 尚無持久 retry queue；market session 必須由經驗證的 Reality calendar feed 注入；未對沖名目在缺少可信 bid/ask 時顯示 unknown。下一步應先完成 Phase 0 官方 contract fixtures、商品與 one-way mode 驗證及風控門檻校準，再接實際 readonly WS/REST transport、重連 backfill、持久告警 outbox 與 leader fencing，之後才進 Phase 2 fault-injection shadow 測試。未完成上述 gate 前不可加入 live adapter。
