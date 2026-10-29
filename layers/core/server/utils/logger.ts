/**
 * Structured logger, same API as MarketX's (server/utils/logger.ts there).
 * Server auto-import: use `logger` anywhere on the server without importing it.
 *
 * Production → JSON lines. Development → readable lines.
 * Never log request bodies: they hold names, phones and handover codes.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

function write(level: LogLevel, message: string, context?: LogContext) {
  if (process.env.NODE_ENV === 'production') {
    const out = JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...context })
    ;(level === 'error' ? process.stderr : process.stdout).write(out + '\n')
    return
  }
  const ctx = context && Object.keys(context).length ? ' ' + JSON.stringify(context) : ''
  const line = `[${level.toUpperCase().padEnd(5)}] ${message}${ctx}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      stack: error.stack?.split('\n').slice(1, 9).map((l) => l.trim()),
    }
  }
  return { errorMessage: String(error ?? 'unknown') }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
  /** Log a caught error with its stack: logger.logError('[POST /api/x]', err, { requestId }) */
  logError: (label: string, error: unknown, context?: LogContext) =>
    write('error', label, { ...serializeError(error), ...context }),
}
