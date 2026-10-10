import type { Config } from './config-schema';
import type { EmbeddingProvider, LLMProvider } from './providers/llm';
import type { VectorIndex } from './vector';

/**
 * SHARED CONTRACT - the plugin interface every feature package implements.
 * A feature never imports another feature; it only talks to core through PluginContext.
 */

export interface PluginRequest {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
}

export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Relative to /api/plugins/<plugin id>. */
  path: string;
  handler: (req: PluginRequest) => Promise<unknown>;
}

/** Metadata the web app uses to mount a panel for this feature. */
export interface PanelMeta {
  id: string;
  title: string;
  /** Where the panel is shown in the UI. */
  slot: 'viewer' | 'course' | 'chat' | 'global';
}

export interface PluginContext {
  config: Config;
  llm: LLMProvider;
  embeddings: EmbeddingProvider;
  vectors: VectorIndex;
  log: (message: string, extra?: Record<string, unknown>) => void;
}

export interface GyanPlugin {
  id: string;
  name: string;
  version: string;
  panels?: PanelMeta[];
  /** Called once at startup. Return the routes this plugin serves. */
  register(ctx: PluginContext): Promise<PluginRoute[]> | PluginRoute[];
}
