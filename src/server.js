import { loadConfig } from './config.js';
import { FileStore } from './workers/file-store.js';
import { TelegramNotifier } from './workers/telegram.js';
import { createReadModel } from './read-model/projection.js';
import { createPublicServer } from './public-ui/server.js';
import { RecoverySkeletonAdapter, RecoveryWorker } from './workers/recovery.js';

const config = loadConfig();
const store = new FileStore(config.stateFile); await store.init();
const notifier = new TelegramNotifier({ token: config.telegramToken, chatId: config.telegramChatId });
const recovery = new RecoveryWorker({ store, readonlyExchange: new RecoverySkeletonAdapter(), notifier, config });
await recovery.run(); // fail closed until an authenticated Bitget reconciliation adapter is configured
createPublicServer(createReadModel(store)).listen(config.port, () => console.log(`dry-run readonly service listening on :${config.port}`));
