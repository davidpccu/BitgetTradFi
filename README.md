# Bitget STRC／rSTRC Phase 1 Dry-run

此專案是單一 Node.js Web Service，監聽 Bitget 私有訂單事件並只在 `RSTRCUSDT` Spot **FILL** 時計算 `STRCUSDT` Futures 模擬對沖意圖。程式碼中沒有真實下單端點，公開介面只有唯讀 API 與 UI。

## 模組

- `src/exchange/bitget-private-listener.js`：私有 WS 登入、訂閱、重連與 order/fill 正規化。
- `src/exchange/bitget-public-market.js`：公開 ticker、bid/ask 與 Reality market session 狀態。
- `src/domain/hedge-coordinator.js`：ACK/FILL 閘門、gross fill、去重、partial fill 累計與 dry-run intent。
- `src/workers/recovery-worker.js`：啟動／連線恢復骨架；Phase 1 尚未執行 REST 全量對帳。
- `src/alerts/telegram-alert.js`：Telegram 告警；未設定時安全降級至 stdout。
- `src/read-model/public-read-model.js`：對外資料投影，永遠回報 `canTrade: false`。
- `src/public-ui`：唯讀 API、健康檢查與監看頁；不依賴 exchange adapter。
- `src/domain/state-store.js`：可選原子 JSON snapshot 的 Phase 1 狀態介面，不是資料庫設計。

## 執行

需求：Node.js 20 以上，無第三方 runtime dependency。

```bash
cp .env.example .env
# 將 .env 值注入環境；Node 20.6+ 可直接：
node --env-file=.env src/main.js
```

未提供 Bitget 私有憑證時服務仍會啟動，公開 UI 位於 `http://localhost:3000`，狀態保持 `RECOVERY`。只有將 `BITGET_API_KEY`、`BITGET_API_SECRET`、`BITGET_API_PASSPHRASE` 以 Koyeb Secret 注入後才會嘗試登入 private WS。官方 WS endpoint 與 subscription args 在上線前必須依最新 Bitget UTA 文件複核，可用環境變數覆寫。

```bash
npm test
npm run check
```

## 唯讀端點

- `GET /api/public/market`
- `GET /api/public/status`
- `GET /api/public/events?limit=30`
- `GET /health/live`
- `GET /health/ready`

所有非 `GET`／`HEAD` 方法一律回覆 `405 read-only service`。Phase 1 沒有公開或私有管理路由，也沒有下單 route。

## Phase 1 限制

- `DRY_RUN=false` 會使程序拒絕啟動；模擬 intent 不會被轉成 Bitget order request。
- Reality session 僅顯示 ticker 實際回報的 session/status 欄位；未回報時顯示 `UNKNOWN`，不以本地時間猜測開休市。
- 計算採 gross base fill，刻意不扣 fee；這是本階段明確需求，不代表最終經濟曝險已校準。
- Recovery 目前只驗證 public/private WS readiness 並重播本地 snapshot；REST orders/fills/position backfill 尚未實作，因此不可進入真實交易。
- `STATE_FILE` 是可選本機 snapshot；Koyeb filesystem 並非可靠持久層，未配置外部持久狀態前重啟可能遺失去重游標。
- Bitget API 契約仍需在可連線環境以官方文件和帳戶事件 fixture 驗證，尤其是 UTA endpoint、subscription arguments、FILL status 與 quantity 欄位。
