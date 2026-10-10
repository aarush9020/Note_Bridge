import { spawnSync, type ChildProcess } from 'node:child_process';

/**
 * Kill a process and everything it started.
 * - Windows: `taskkill /T /F` walks the process tree (child.kill() would leave grandchildren running).
 * - POSIX: the child was spawned detached (its own process group), so signal the whole group.
 */
export function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;

  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // fall through to the plain kill below
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
      return;
    } catch {
      // group already gone or not a group leader; fall through
    }
  }

  try {
    child.kill('SIGKILL');
  } catch {
    // already dead
  }
}
