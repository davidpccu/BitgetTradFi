import { createHash } from 'node:crypto';
import { absolute, floorToStepTowardZero, formatDecimal, multiply, parseDecimal } from './decimal.js';

function intentIdFor(fillKey, side, quantity) {
  return createHash('sha256').update(`${fillKey}|${side}|${quantity}`).digest('hex').slice(0, 20);
}

export class HedgeCoordinator {
  constructor({ config, store, alerts, now = Date.now }) {
    this.config = config;
    this.store = store;
    this.alerts = alerts;
    this.now = now;
  }

  async handle(orderEvent) {
    if (!orderEvent.eligible) return { action: 'ignored', reason: orderEvent.ignoredReason };
    if (orderEvent.clientOid.startsWith(this.config.hedgeClientOidPrefix)) return { action: 'ignored', reason: 'self-order' };
    if (!orderEvent.orderId || !orderEvent.quantity) return { action: 'recovery', reason: 'fill-missing-identity-or-quantity' };

    let result = { action: 'ignored', reason: 'duplicate' };
    const next = await this.store.update((state) => {
      let grossDelta;
      let fillKey;
      if (orderEvent.quantityKind === 'incremental') {
        fillKey = `trade:${orderEvent.tradeId}`;
        if (state.processedTradeIds.includes(fillKey)) return;
        grossDelta = parseDecimal(orderEvent.quantity);
        state.processedTradeIds.push(fillKey);
      } else {
        fillKey = `order:${orderEvent.orderId}:${orderEvent.quantity}`;
        const previous = parseDecimal(state.orderCumulative[orderEvent.orderId] ?? '0');
        const current = parseDecimal(orderEvent.quantity);
        if (current < previous) {
          state.mode = 'recovery';
          state.protectionReason = 'cumulative fill moved backwards';
          state.manualInterventionRequired = true;
          result = { action: 'recovery', reason: state.protectionReason };
          return;
        }
        if (current === previous) return;
        grossDelta = current - previous;
        state.orderCumulative[orderEvent.orderId] = formatDecimal(current);
      }
      if (grossDelta <= 0n) return;

      // Gross base fill is intentional: fee quantity is never subtracted in Phase 1.
      const signedGross = orderEvent.side === 'buy' ? grossDelta : -grossDelta;
      const newSpotNet = parseDecimal(state.spotNetQty) + signedGross;
      const target = -multiply(newSpotNet, parseDecimal(this.config.hedgeRatio));
      const alreadySimulated = parseDecimal(state.simulatedRequestedQty);
      const rawDelta = target - alreadySimulated;
      const quantized = floorToStepTowardZero(rawDelta, parseDecimal(this.config.futuresQtyStep));
      state.spotNetQty = formatDecimal(newSpotNet);

      const eventBase = {
        at: this.now(), type: 'spot-fill', symbol: orderEvent.symbol, side: orderEvent.side,
        grossQty: formatDecimal(grossDelta), price: orderEvent.price || null,
        orderRef: orderEvent.orderId.slice(-8), tradeRef: orderEvent.tradeId ? orderEvent.tradeId.slice(-8) : null
      };
      state.events.unshift(eventBase);

      if (quantized === 0n) {
        result = { action: 'below-step', grossQty: formatDecimal(grossDelta) };
      } else {
        const id = intentIdFor(fillKey, quantized < 0n ? 'sell' : 'buy', formatDecimal(absolute(quantized)));
        const intent = {
          id,
          clientOid: `${this.config.hedgeClientOidPrefix}DRY_${id}`,
          symbol: this.config.futuresSymbol,
          side: quantized < 0n ? 'sell' : 'buy',
          qty: formatDecimal(absolute(quantized)),
          signedQty: formatDecimal(quantized),
          status: 'simulated',
          source: { orderRef: orderEvent.orderId.slice(-8), tradeRef: orderEvent.tradeId ? orderEvent.tradeId.slice(-8) : null },
          createdAt: this.now(),
          dryRun: true
        };
        state.intents.unshift(intent);
        state.simulatedRequestedQty = formatDecimal(alreadySimulated + quantized);
        state.events.unshift({ at: intent.createdAt, type: 'hedge-simulated', side: intent.side, qty: intent.qty, deltaQty: formatDecimal(absolute(target)), dryRun: true });
        result = { action: 'simulated', intent };
      }
      state.events = state.events.slice(0, 100);
      state.intents = state.intents.slice(0, 100);
    });

    if (result.action === 'simulated') {
      await this.alerts.send(`DRY-RUN hedge ${result.intent.side.toUpperCase()} ${result.intent.qty} ${result.intent.symbol} from Spot FILL`);
    } else if (result.action === 'recovery') {
      await this.alerts.send(`PROTECTION: ${result.reason}`);
    }
    return { ...result, state: next };
  }
}
