/**
 * Process utility helpers — dev server start/stop and health checks.
 */

import { spawn, type ChildProcess } from 'child_process';

export interface DevServerOptions {
  command?: string;
  args?: string[];
  port?: number;
  baseUrl?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Check if a URL is reachable (returns true if HTTP status < 500 or any response).
 */
export async function isServerReady(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Wait for a server to become available, polling every second.
 */
export async function waitForServer(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerReady(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Start a dev server process and wait for it to be ready.
 * Returns the child process, or null if the server was already running.
 */
export async function startServer(options: DevServerOptions = {}): Promise<ChildProcess | null> {
  const {
    command = 'npm',
    args = ['run', 'dev'],
    port = 3000,
    baseUrl = `http://localhost:${port}`,
    timeoutMs = 30_000,
    env = process.env,
  } = options;

  // If already running, don't start another
  if (await isServerReady(baseUrl)) {
    return null;
  }

  const proc = spawn(command, args, {
    stdio: 'pipe',
    detached: false,
    env: { ...env, PORT: String(port) },
  });

  const ready = await waitForServer(baseUrl, timeoutMs);
  if (!ready) {
    proc.kill();
    throw new Error(`Server did not become ready within ${timeoutMs}ms`);
  }

  return proc;
}

/**
 * Gracefully stop a server process.
 */
export function stopServer(proc: ChildProcess | null): void {
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
  }
}
