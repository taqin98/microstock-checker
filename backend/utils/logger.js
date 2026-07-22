const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, context, message, data = null) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;

  const entry = {
    timestamp: formatTimestamp(),
    level,
    context,
    message,
    ...(data && { data }),
  };

  const color = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' }[level];
  const reset = '\x1b[0m';
  const prefix = `${color}[${level.toUpperCase()}]${reset}`;

  console.log(`${prefix} ${entry.timestamp} [${context}] ${message}`, data || '');
}

export function createLogger(context) {
  return {
    debug: (msg, data) => log('debug', context, msg, data),
    info: (msg, data) => log('info', context, msg, data),
    warn: (msg, data) => log('warn', context, msg, data),
    error: (msg, data) => log('error', context, msg, data),
  };
}
