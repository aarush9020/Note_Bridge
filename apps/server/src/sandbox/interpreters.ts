import { spawnSync } from 'node:child_process';
import { MAX_CODE_BYTES } from './limits';
import { ALLOWED_INTERPRETERS, SandboxError, type Interpreter, type SandboxRequest } from './types';

export function isAllowedInterpreter(name: unknown): name is Interpreter {
  return typeof name === 'string' && (ALLOWED_INTERPRETERS as readonly string[]).includes(name);
}

/** Exact-match allowlist. "node.exe", "../node", "bash", "powershell" and friends are all refused. */
export function validateRequest(req: SandboxRequest): Interpreter {
  if (!req || typeof req !== 'object') {
    throw new SandboxError('invalid_request', 'Sandbox request must be an object.');
  }
  if (!isAllowedInterpreter(req.interpreter)) {
    throw new SandboxError(
      'disallowed_interpreter',
      `Interpreter ${JSON.stringify(req.interpreter)} is not allowed. Use one of: ${ALLOWED_INTERPRETERS.join(', ')}.`,
    );
  }
  if (typeof req.code !== 'string') {
    throw new SandboxError('invalid_request', 'Sandbox request "code" must be a string.');
  }
  if (Buffer.byteLength(req.code, 'utf8') > MAX_CODE_BYTES) {
    throw new SandboxError('invalid_request', `Code is larger than ${MAX_CODE_BYTES} bytes.`);
  }
  return req.interpreter;
}

export interface ResolvedInterpreter {
  command: string;
  /** Arguments placed before the script path. */
  args: string[];
  /** File name written into the temp directory. */
  fileName: string;
}

let pythonCache: string | null | undefined;

/**
 * "python3" is the name the contract uses. On Windows it often does not exist (or is the Microsoft
 * Store stub that opens a store page), so try python3 then python and accept the first one that
 * really prints "Python 3.x".
 */
export function findPython(candidates: readonly string[] = ['python3', 'python']): string | null {
  for (const candidate of candidates) {
    try {
      const probe = spawnSync(candidate, ['--version'], {
        encoding: 'utf8',
        timeout: 5_000,
        windowsHide: true,
        shell: false,
      });
      const text = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
      if (probe.status === 0 && /Python 3\./.test(text)) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export function resetInterpreterCache(): void {
  pythonCache = undefined;
}

export function resolveInterpreter(interpreter: Interpreter): ResolvedInterpreter {
  if (interpreter === 'node') {
    // The running Node binary: always present, and does not depend on PATH surviving env stripping.
    return { command: process.execPath, args: [], fileName: 'main.js' };
  }
  if (pythonCache === undefined) pythonCache = findPython();
  if (!pythonCache) {
    throw new SandboxError(
      'interpreter_not_found',
      'python3 was not found on PATH (also tried "python"). Install Python 3 to run Python code.',
    );
  }
  // -I isolated mode ignores PYTHON* env vars and user site-packages; -B skips writing .pyc files.
  return { command: pythonCache, args: ['-I', '-B'], fileName: 'main.py' };
}
