import type { Config } from '../config-schema';
import type { EmbeddingProvider, LLMProvider } from './llm';
import { MockEmbeddingProvider, MockProvider } from './mock';

export * from './llm';
export * from './mock';

/**
 * Real providers (anthropic/openai/local embeddings) land in Phase 1a. Until then, asking for one
 * fails loudly instead of silently falling back to mock.
 */
export function createLLMProvider(cfg: Config): LLMProvider {
  if (cfg.LLM_PROVIDER === 'mock') return new MockProvider();
  throw new Error(
    `LLM provider "${cfg.LLM_PROVIDER}" is not implemented yet (Phase 1a). Use LLM_PROVIDER=mock.`,
  );
}

export function createEmbeddingProvider(cfg: Config): EmbeddingProvider {
  if (cfg.EMBEDDINGS_PROVIDER === 'mock') return new MockEmbeddingProvider();
  throw new Error(
    'Local embeddings are not implemented yet (Phase 1a). Use EMBEDDINGS_PROVIDER=mock.',
  );
}
