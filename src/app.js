import { TelegramAlert } from './alerts/telegram-alert.js';
import { HedgeCoordinator } from './domain/hedge-coordinator.js';
import { StateStore } from './domain/state-store.js';
import { BitgetPrivateFillListener } from './exchange/bitget-private-listener.js';
import { BitgetPublicMarketListener } from './exchange/bitget-public-market.js';
import { createPublicServer } from './public-ui/server.js';
import { PublicReadModel } from './read-model/public-read-model.js';
import { RecoveryWorker } from './workers/recovery-worker.js';

export async function createApplication(config, dependencies = {}) {
  const store = dependencies.store ?? new StateStore(config.stateFile);
  await store.load();
  const alerts = dependencies.alerts ?? new TelegramAlert({ token: config.telegramBotToken, chatId: config.telegramChatId, logger: dependencies.logger });
  const coordinator = new HedgeCoordinator({ config, store, alerts, now: dependencies.now });
  const readModel = new PublicReadModel({ config, store, now: dependencies.now });
  const privateListener = new BitgetPrivateFillListener({ config, coordinator, store, alerts, socketFactory: dependencies.privateSocketFactory, now: dependencies.now, timers: dependencies.timers });
  const publicListener = new BitgetPublicMarketListener({ config, store, alerts, socketFactory: dependencies.publicSocketFactory, now: dependencies.now, timers: dependencies.timers });
  const recovery = new RecoveryWorker({ config, store, alerts, now: dependencies.now });
  const server = createPublicServer({ readModel });

  let recoveryTimer;
  return {
    modules: { store, alerts, coordinator, readModel, privateListener, publicListener, recovery, server },
    async start() {
      publicListener.start(); privateListener.start();
      await recovery.run();
      recoveryTimer = setInterval(() => void recovery.run(), 10_000);
      await new Promise((resolve, reject) => {
        server.once('error', reject); server.listen(config.port, config.host, resolve);
      });
      return server.address();
    },
    async stop() {
      clearInterval(recoveryTimer); privateListener.stop(); publicListener.stop();
      if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}
