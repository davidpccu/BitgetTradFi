# Phase 1 Dry-run 實作說明

## 完成範圍

此版本是單一 Node.js Web Service，完成 private order/fill listener、dry-run hedge coordinator、公開 ticker listener、公開唯讀 API/UI、Telegram 告警，以及 recovery readiness skeleton。它不含 Bitget 下單 endpoint 或送單 adapter，且 `DRY_RUN=false` 會直接拒絕啟動。

### 模組清單

| 模組 | 責任 |
|---|---|
| `src/config.js` | 驗證 dry-run invariant、symbols、WS subscriptions 與 server-side secrets |
| `src/exchange/native-websocket.js` | 無第三方 dependency 的 WSS handshake、frame、ping/pong transport |
| `src/exchange/bitget-private-listener.js` | Private WS login、order channel subscription、heartbeat、重連與事件正規化 |
| `src/exchange/bitget-public-market.js` | Spot/Futures ticker、bid/ask、exchange timestamp 與 Reality session/status |
| `src/domain/hedge-coordinator.js` | ACK/FILL 閘門、gross fill、partial fill high-water mark、去重與模擬 intent |
| `src/domain/decimal.js` | 固定精度 decimal 運算與 futures step 朝零量化 |
| `src/domain/state-store.js` | Phase 1 狀態介面及可選原子 JSON snapshot；不定義資料庫 |
| `src/workers/recovery-worker.js` | Public/private readiness、fail-closed mode 與恢復骨架 |
| `src/alerts/telegram-alert.js` | Telegram `sendMessage` 告警，未配置時降級至遮罩後 stdout |
| `src/read-model/public-read-model.js` | 市場、狀態、殘差及最近事件的唯讀投影 |
| `src/public-ui` | 僅 GET/HEAD 的 API、健康檢查與 responsive 監看 UI |
| `scripts/check-boundaries.js` | 防止 public UI 依賴 exchange，以及禁止 real place-order endpoint |

## 執行方式

```bash
cp .env.example .env
node --env-file=.env src/main.js
```

本機不放 private credentials 時，服務仍於 port 3000 提供 UI，但保持 `RECOVERY`。Koyeb 應以 Secret 注入三項 Bitget credential 與選配 Telegram token/chat ID；不得注入前端。

驗證指令：

```bash
npm test
npm run check
```

## 安全與事件語意

- `new`、`accepted` 等 ACK 狀態不通過 FILL status gate，即使 payload 帶有 quantity 也不產生 intent。
- 只有 `filled`／partial fill 類狀態可進 coordinator。具 `tradeId` 的 fill 使用單次 gross base quantity；否則使用 order cumulative fill high-water mark 計算新增量。
- fee 欄位刻意不從 base fill 扣除；目前依需求使用 gross fill。
- coordinator 只產生 `status=simulated`、`dryRun=true` 的 intent；程式中不存在交易所 place-order endpoint。
- market session 只顯示交易所 ticker 實際提供的 status/session；欄位缺失時顯示 `UNKNOWN`，避免依伺服器時間誤判 Reality 開休市。
- public controller 只依賴 read model，所有 POST/PUT/PATCH/DELETE 都回覆 HTTP 405。

## 已知風險與下一步

1. **Bitget UTA 契約待實證**：目前執行環境無法存取 Bitget 官方文件/API；WS v3 URL、login signature、subscription args、FILL enum 與 fill 欄位必須在可連線環境用官方文件及真實但唯讀的帳戶事件 fixture 複核。
2. **Recovery 尚非完整對帳**：Phase 1 skeleton 只檢查 WS readiness 與重播可選 snapshot；下一步需加入 REST open orders、fills、position 的分頁 backfill 與 gap detection，完成前不可真實交易。
3. **Koyeb 本機檔案非持久層**：`STATE_FILE` 只供本機 dry-run；Koyeb restart 可能遺失 trade IDs/high-water marks。下一階段需接入具原子更新能力的外部狀態介面，但本版不設計資料庫。
4. **Session 欄位可能不在 ticker**：若官方 Reality ticker 不提供 session，下一步應接官方 calendar/trading-time endpoint；不可自行以 UTC 時間猜測。
5. **Gross fill 經濟風險**：gross fill 不扣 base fee 可能造成少量 over-hedge，需以官方 fee asset semantics 與觀察資料校準。
6. **Phase 1 不是實盤批准**：尚未完成 instrument precision/minimum、帳戶模式、rSTRC/STRC 經濟比例、429、REST recovery 與 Koyeb 長連線實測。下一步只能先做 contract fixture、斷線重播及 shadow observation。
