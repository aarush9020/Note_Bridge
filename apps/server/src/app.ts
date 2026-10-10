import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  InMemoryVectorIndex,
  createEmbeddingProvider,
  createLLMProvider,
  redactConfig,
  type Config,
  type PluginContext,
} from '@gyan/core';
import { openDb, type Db } from './db';
import { loadPlugins, type LoadedPlugin, type PluginImporter } from './plugins/loader';
import { createSandbox, type Sandbox } from './sandbox';

/** A plugin that wants to run code exposes attachSandbox; the server hands it the sandbox. */
function withSandbox(importer: PluginImporter, sandbox: Sandbox): PluginImporter {
  return async (specifier) => {
    const mod = (await importer(specifier)) as Record<string, unknown>;
    for (const candidate of [mod.default, mod.plugin]) {
      const attach = (candidate as { attachSandbox?: unknown } | undefined)?.attachSandbox;
      if (typeof attach === 'function') attach.call(candidate, sandbox.run);
    }
    return mod;
  };
}

export interface BuiltApp {
  app: FastifyInstance;
  db: Db;
  plugins: LoadedPlugin[];
}

export interface BuildOptions {
  config: Config;
  importer?: PluginImporter;
}

export async function buildApp({ config, importer }: BuildOptions): Promise<BuiltApp> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  const db = openDb(config.DATABASE_PATH);
  app.addHook('onClose', async () => {
    db.close();
  });

  const ctx: PluginContext = {
    config,
    llm: createLLMProvider(config),
    embeddings: createEmbeddingProvider(config),
    vectors: new InMemoryVectorIndex(),
    log: (message, extra) => console.log(`[gyan] ${message}`, extra ? JSON.stringify(extra) : ''),
  };

  const sandbox = createSandbox({ mode: config.SANDBOX_MODE, log: ctx.log });
  const plugins = await loadPlugins(
    app,
    ctx,
    config.plugins,
    withSandbox(importer ?? ((s) => import(s)), sandbox),
  );

  app.get('/api/health', async () => ({
    ok: true,
    llmProvider: ctx.llm.id,
    embeddingsProvider: ctx.embeddings.id,
    plugins: plugins.map((p) => p.id),
  }));

  // Redacted view of effective config, handy for the Settings page.
  app.get('/api/config', async () => redactConfig(config));

  return { app, db, plugins };
}
