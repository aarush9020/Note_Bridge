import { buildApp } from './app';
import { loadConfig, redactConfig } from './config';

const config = loadConfig();
const { app } = await buildApp({ config });

if (config.LLM_PROVIDER === 'mock') {
  console.log('[gyan] LLM_PROVIDER=mock: running in demo mode, no API key needed.');
}
if (config.SANDBOX_MODE !== 'docker') {
  console.warn(
    '[gyan] WARNING: sandbox runs as a local subprocess; network isolation is NOT enforced (Docker not in use).',
  );
}
console.log('[gyan] config', JSON.stringify(redactConfig(config)));

await app.listen({ port: config.PORT, host: '127.0.0.1' });
console.log(`[gyan] server listening on http://127.0.0.1:${config.PORT}`);
