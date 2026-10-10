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

  const plugins = await loadPlugins(app, ctx, config.plugins, importer);

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
