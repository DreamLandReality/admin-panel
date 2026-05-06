const devOnly = process.env.NODE_ENV !== 'production'

type StructuredLogLevel = 'info' | 'warn' | 'error'
type StructuredLogContext = Record<string, string | number | boolean | null | undefined>

function structured(level: StructuredLogLevel, event: string, message: string, context: StructuredLogContext = {}) {
  const entry = {
    level,
    event,
    message,
    context,
    timestamp: new Date().toISOString(),
  }

  if (level === 'error') {
    console.error(JSON.stringify(entry))
    return
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(entry))
    return
  }

  if (devOnly) {
    console.info(JSON.stringify(entry))
  }
}

export const log = {
  error: (message: string, ...args: unknown[]) => {
    console.error(message, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    if (!devOnly) return
    console.warn(message, ...args)
  },
  info: (message: string, ...args: unknown[]) => {
    if (!devOnly) return
    console.info(message, ...args)
  },
  event: structured,
} as const
