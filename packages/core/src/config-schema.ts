import { z } from 'zod';

/** SHARED CONTRACT. Validated environment; every key is documented in .env.example. */
const baseShape = {
  LLM_PROVIDER: z.enum(['mock', 'anthropic', 'openai']).default('mock'),
  EMBEDDINGS_PROVIDER: z.enum(['mock', 'local']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  SANDBOX_MODE: z.enum(['auto', 'docker', 'local']).default('auto'),
  PLUGINS: z.string().default(''),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_PATH: z.string().default('./data/gyan.db'),
  MAX_TOOL_CALLS: z.coerce.number().int().min(1).max(50).default(8),
};

export const configSchema = z.object(baseShape).superRefine((cfg, ctx) => {
  if (cfg.LLM_PROVIDER === 'anthropic' && !cfg.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['ANTHROPIC_API_KEY'],
      message: 'required when LLM_PROVIDER=anthropic (or set LLM_PROVIDER=mock)',
    });
  }
  if (cfg.LLM_PROVIDER === 'openai' && !cfg.OPENAI_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['OPENAI_API_KEY'],
      message: 'required when LLM_PROVIDER=openai (or set LLM_PROVIDER=mock)',
    });
  }
});

export type Config = z.infer<typeof configSchema> & { plugins: string[] };

/** Treat empty strings from .env as unset. */
function clean(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(baseShape)) {
    const v = env[key];
    if (v !== undefined && v.trim() !== '') out[key] = v.trim();
  }
  return out;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = configSchema.safeParse(clean(env));
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new ConfigError(`Invalid configuration:\n${lines.join('\n')}\nSee .env.example.`);
  }
  const plugins = result.data.PLUGINS.split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return { ...result.data, plugins };
}

const SECRET_KEYS = /KEY|TOKEN|SECRET|PASSWORD/i;

/** Safe-to-log copy of the config: secret values are masked. */
export function redactConfig(cfg: Config): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) {
    out[k] = SECRET_KEYS.test(k) && v ? '***redacted***' : v;
  }
  return out;
}
