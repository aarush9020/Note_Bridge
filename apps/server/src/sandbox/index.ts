import { isDockerAvailable, runDocker } from './docker';
import { runLocal } from './local';
import { SandboxError, type Sandbox, type SandboxMode, type SandboxRequest } from './types';

export * from './types';
export * from './limits';
export { buildSandboxEnv } from './env';
export { findPython, isAllowedInterpreter, validateRequest } from './interpreters';
export { buildDockerArgs, isDockerAvailable } from './docker';

export const LOCAL_MODE_WARNING =
  'sandbox is running as a local subprocess; network and filesystem isolation are NOT enforced (Docker not in use).';

export interface CreateSandboxOptions {
  /** Mirrors the SANDBOX_MODE config value. */
  mode: 'auto' | 'docker' | 'local';
  log?: (message: string, extra?: Record<string, unknown>) => void;
  /** Injected in tests so no real Docker is needed. */
  detectDocker?: () => boolean;
  runLocalImpl?: typeof runLocal;
  runDockerImpl?: typeof runDocker;
}

/**
 * - local:  always a local subprocess (warns once).
 * - docker: Docker or a loud failure; never silently downgrades.
 * - auto:   Docker if the daemon answers, otherwise local with a warning.
 */
export function createSandbox(opts: CreateSandboxOptions): Sandbox {
  const log = opts.log ?? (() => {});
  const detect = opts.detectDocker ?? isDockerAvailable;
  const local = opts.runLocalImpl ?? runLocal;
  const docker = opts.runDockerImpl ?? runDocker;
  let resolved: SandboxMode | undefined;

  function resolveMode(): SandboxMode {
    if (resolved) return resolved;
    if (opts.mode === 'docker') {
      if (!detect()) {
        throw new SandboxError(
          'docker_unavailable',
          'SANDBOX_MODE=docker but Docker is not available. Start Docker or use SANDBOX_MODE=auto|local.',
        );
      }
      resolved = 'docker';
    } else if (opts.mode === 'local') {
      resolved = 'local';
      log(`WARNING: ${LOCAL_MODE_WARNING}`);
    } else if (detect()) {
      resolved = 'docker';
    } else {
      resolved = 'local';
      log(`WARNING: ${LOCAL_MODE_WARNING}`);
    }
    return resolved;
  }

  return {
    mode: async () => resolveMode(),
    run: async (req: SandboxRequest) => (resolveMode() === 'docker' ? docker(req) : local(req)),
  };
}
