/**
 * Logger utility — colored console output with log levels.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

let currentLevel: LogLevel = 'info';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function timestamp(): string {
  return `${COLORS.dim}[${new Date().toISOString()}]${COLORS.reset}`;
}

export const logger = {
  debug(msg: string, ...args: unknown[]) {
    if (!shouldLog('debug')) return;
    console.debug(`${timestamp()} ${COLORS.dim}DEBUG${COLORS.reset} ${msg}`, ...args);
  },
  info(msg: string, ...args: unknown[]) {
    if (!shouldLog('info')) return;
    console.info(`${timestamp()} ${COLORS.cyan}INFO${COLORS.reset}  ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    if (!shouldLog('warn')) return;
    console.warn(`${timestamp()} ${COLORS.yellow}WARN${COLORS.reset}  ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]) {
    if (!shouldLog('error')) return;
    console.error(`${timestamp()} ${COLORS.red}ERROR${COLORS.reset} ${msg}`, ...args);
  },
};
