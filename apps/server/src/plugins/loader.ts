import type { FastifyInstance } from 'fastify';
import type { GyanPlugin, PluginContext } from '@gyan/core';

/**
 * Plugin ids map to workspace packages: PLUGINS=conflicts -> @gyan/feature-conflicts.
 * A feature package must default-export (or export `plugin`) a GyanPlugin.
 */
export function packageNameFor(id: string): string {
  return `@gyan/feature-${id}`;
}

export type PluginImporter = (specifier: string) => Promise<unknown>;

export interface LoadedPlugin {
  id: string;
  name: string;
  version: string;
  routes: number;
}

function isPlugin(value: unknown): value is GyanPlugin {
  const p = value as Partial<GyanPlugin> | null;
  return !!p && typeof p.id === 'string' && typeof p.register === 'function';
}

export async function loadPlugins(
  app: FastifyInstance,
  ctx: PluginContext,
  ids: string[],
  importer: PluginImporter = (s) => import(s),
): Promise<LoadedPlugin[]> {
  const loaded: LoadedPlugin[] = [];
  for (const id of ids) {
    let mod: Record<string, unknown>;
    try {
      mod = (await importer(packageNameFor(id))) as Record<string, unknown>;
    } catch (err) {
      // A missing/broken plugin must not take the whole server down.
      ctx.log(`plugin "${id}" failed to load`, {
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const plugin = [mod.default, mod.plugin].find(isPlugin);
    if (!plugin) {
      ctx.log(`plugin "${id}" does not export a GyanPlugin`);
      continue;
    }
    const routes = await plugin.register(ctx);
    for (const route of routes) {
      app.route({
        method: route.method,
        url: `/api/plugins/${plugin.id}${route.path}`,
        handler: async (req) =>
          route.handler({
            params: req.params as Record<string, string>,
            query: req.query as Record<string, string | undefined>,
            body: req.body,
          }),
      });
    }
    loaded.push({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      routes: routes.length,
    });
  }
  return loaded;
}
