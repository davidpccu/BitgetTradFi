const byId = (id) => document.getElementById(id);
const value = (input, suffix = '') => input === null || input === undefined ? '—' : `${input}${suffix}`;
const time = (stamp) => stamp ? new Date(stamp).toLocaleTimeString('zh-Hant', { hour12: false }) : '—';

function renderEvent(event) {
  const title = event.type === 'spot-fill' ? `SPOT ${event.side?.toUpperCase()} FILL` : `FUTURES ${event.side?.toUpperCase()} SIMULATED`;
  const detail = event.type === 'spot-fill' ? `Gross ${event.grossQty} @ ${event.price ?? 'market'}` : `${event.qty} · 不送單`;
  const row = document.createElement('div'); row.className = 'event';
  const timestamp = document.createElement('span'); timestamp.textContent = time(event.at);
  const heading = document.createElement('strong'); heading.textContent = title;
  const description = document.createElement('span'); description.textContent = detail;
  row.append(timestamp, heading, description); return row;
}

async function refresh() {
  try {
    const [market, status, events] = await Promise.all(['/api/public/market','/api/public/status','/api/public/events'].map((url) => fetch(url).then((response) => response.json())));
    byId('spot-bid').textContent = value(market.spot.bid); byId('spot-ask').textContent = value(market.spot.ask);
    byId('futures-bid').textContent = value(market.futures.bid); byId('futures-ask').textContent = value(market.futures.ask);
    byId('spread').textContent = value(market.spread); byId('session').textContent = market.session.status.toUpperCase();
    byId('spot-net').textContent = status.spotFilledGrossNetQty; byId('delta').textContent = status.deltaQty;
    byId('notional').textContent = value(status.unhedgedNotionalUsdt, ' USDT'); byId('protection').textContent = status.protected ? 'ON' : 'MONITORING';
    byId('mode').textContent = status.mode.toUpperCase(); byId('updated').textContent = market.stale ? '行情過期／未連線' : `更新 ${time(market.observedAt)}`;
    byId('connections').textContent = `PUBLIC WS ${status.publicConnected ? '●' : '○'} · PRIVATE WS ${status.privateConnected ? '●' : '○'}`;
    byId('reason').textContent = status.protectionReason ?? '連線正常（仍為 dry-run）';
    const list = byId('events'); list.replaceChildren();
    if (events.items.length) list.append(...events.items.map(renderEvent));
    else { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '等待 private FILL 事件…'; list.append(empty); }
  } catch { byId('reason').textContent = '唯讀 API 暫時無法使用'; }
}
refresh(); setInterval(refresh, 2000);
