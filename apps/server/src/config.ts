import 'dotenv/config';
import { ConfigError, parseConfig, redactConfig, type Config } from '@gyan/core';

/** Load and validate config from process.env. Exits with a clear message on failure. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  try {
    return parseConfig(env);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

export { redactConfig };
