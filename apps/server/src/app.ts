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
import { DocumentRepository } from './db/repositories/documents';
import { IngestStore } from './db/repositories/ingest-store';
import { JobRepository } from './db/repositories/jobs';
import { JobRunner, ProgressBus } from './jobs';
import { loadPlugins, type LoadedPlugin, type PluginImporter } from './plugins/loader';
import { registerIngestRoutes } from './routes/ingest';

export interface BuiltApp {
  app: FastifyInstance;
  db: Db;
  plugins: LoadedPlugin[];
  runner: JobRunner;
  documents: DocumentRepository;
  store: IngestStore;
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

  // Ingestion: a job left running by a crash can never finish, so fail it on startup.
  const documents = new DocumentRepository(db);
  const store = new IngestStore(db);
  const jobs = new JobRepository(db);
  jobs.failInterrupted();
  const bus = new ProgressBus();
  const runner = new JobRunner(jobs, bus);
  await registerIngestRoutes(app, {
    ingest: { documents, store, runner, llm: ctx.llm, embeddings: ctx.embeddings },
    bus,
    jobs,
  });

  app.get('/api/health', async () => ({
    ok: true,
    llmProvider: ctx.llm.id,
    embeddingsProvider: ctx.embeddings.id,
    plugins: plugins.map((p) => p.id),
  }));

  // Redacted view of effective config, handy for the Settings page.
  app.get('/api/config', async () => redactConfig(config));

  return { app, db, plugins, runner, documents, store };
}
