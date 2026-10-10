/**
 * The sandboxed process never inherits the server's environment (API keys, tokens, DB paths).
 * It gets an explicit allowlist of the few variables an interpreter needs to start.
 */
const POSIX_ALLOWLIST = ['PATH'] as const;
const WINDOWS_ALLOWLIST = ['PATH', 'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'TEMP', 'TMP'] as const;

/** Variables the Docker CLI itself needs to find the daemon. Never passed into the container. */
const DOCKER_CLI_ALLOWLIST = [
  'PATH',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'DOCKER_HOST',
  'DOCKER_CONFIG',
  'DOCKER_CONTEXT',
  'XDG_RUNTIME_DIR',
] as const;

/** Environment variable names are case-insensitive on Windows ("Path" vs "PATH"), so match that way. */
export function pickEnv(
  source: NodeJS.ProcessEnv,
  names: readonly string[],
): Record<string, string> {
  const allow = new Set(names.map((n) => n.toUpperCase()));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && allow.has(key.toUpperCase())) env[key] = value;
  }
  return env;
}

function setEnv(env: Record<string, string>, key: string, value: string): void {
  for (const existing of Object.keys(env)) {
    if (existing.toUpperCase() === key.toUpperCase()) delete env[existing];
  }
  env[key] = value;
}

export function buildSandboxEnv(
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const env = pickEnv(source, platform === 'win32' ? WINDOWS_ALLOWLIST : POSIX_ALLOWLIST);
  const fixed: Record<string, string> = {
    PYTHONIOENCODING: 'utf-8',
    PYTHONDONTWRITEBYTECODE: '1',
    NO_COLOR: '1',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fixed)) setEnv(env, key, value);
  return env;
}

export function buildDockerCliEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return pickEnv(source, DOCKER_CLI_ALLOWLIST);
}
