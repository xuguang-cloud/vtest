import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync } from 'fs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  traceId?: string
  spanId?: string
  metadata?: Record<string, unknown>
}

export class Logger {
  private logStream: ReturnType<typeof createWriteStream> | null = null
  private logLevel: LogLevel = 'info'

  private static instances: Map<string, Logger> = new Map()

  private constructor(private name: string) {
    this.initLogStream()
  }

  static getLogger(name: string): Logger {
    if (!Logger.instances.has(name)) {
      Logger.instances.set(name, new Logger(name))
    }
    return Logger.instances.get(name)!
  }

  private initLogStream(): void {
    const logDir = join(__dirname, '../../../logs')
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }

    const logPath = join(logDir, `${this.name}.log`)
    this.logStream = createWriteStream(logPath, { flags: 'a' })
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level
  }

  getLevel(): LogLevel {
    return this.logLevel
  }

  debug(message: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): void {
    this.log('debug', message, metadata, traceId, spanId)
  }

  info(message: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): void {
    this.log('info', message, metadata, traceId, spanId)
  }

  warn(message: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): void {
    this.log('warn', message, metadata, traceId, spanId)
  }

  error(message: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): void {
    this.log('error', message, metadata, traceId, spanId)
  }

  fatal(message: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): void {
    this.log('fatal', message, metadata, traceId, spanId)
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): void {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal']
    if (levels.indexOf(level) < levels.indexOf(this.logLevel)) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      traceId,
      spanId,
      metadata
    }

    const logLine = JSON.stringify(entry) + '\n'

    if (this.logStream) {
      this.logStream.write(logLine)
    }

    if (level === 'error' || level === 'fatal') {
      console.error(`[${level.toUpperCase()}] ${this.name}: ${message}`, metadata)
    } else if (level === 'warn') {
      console.warn(`[${level.toUpperCase()}] ${this.name}: ${message}`)
    } else if (level === 'info') {
      console.log(`[${level.toUpperCase()}] ${this.name}: ${message}`)
    }
  }
}

export const mainLogger = Logger.getLogger('main')
export const avdLogger = Logger.getLogger('avd')
export const securityLogger = Logger.getLogger('security')
export const explorationLogger = Logger.getLogger('exploration')
export const databaseLogger = Logger.getLogger('database')
