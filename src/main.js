import { createApplication } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createApplication(config);
const address = await app.start();
console.info(`STRC observer listening on http://${config.host}:${address.port} (DRY-RUN; order submission unavailable)`);

async function shutdown(signal) {
  console.info(`${signal}: shutting down`);
  await app.stop();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
