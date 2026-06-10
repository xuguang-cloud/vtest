/**
 * LoggingService — 日志服务
 * 基于 Node.js 内置 console 实现的多级别日志服务
 * 支持日志级别控制、格式化输出、文件持久化
 */
import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: { name: string; message: string; stack?: string }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
}

export class LoggingService {
  private logLevel: LogLevel = 'info'
  private logDir: string | null = null
  private logStream: fs.WriteStream | null = null
  private formatter: (entry: LogEntry) => string = LoggingService.defaultFormatter

  constructor(options?: { level?: LogLevel; logDir?: string }) {
    if (options?.level) this.logLevel = options.level
    if (options?.logDir) {
      this.logDir = options.logDir
      this.ensureLogDir()
    }
  }

  private ensureLogDir(): void {
    if (this.logDir && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level
  }

  setFormatter(formatter: (entry: LogEntry) => string): void {
    this.formatter = formatter
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context)
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    this.log('fatal', message, context)
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.logLevel]) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    }

    const formatted = this.formatter(entry)

    // 控制台输出
    switch (level) {
      case 'debug':
      case 'info':
        console.log(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
      case 'fatal':
        console.error(formatted)
        break
    }

    // 文件写入
    if (this.logStream) {
      this.logStream.write(formatted + '\n')
    }

    // 错误日志单独写入
    if ((level === 'error' || level === 'fatal') && this.logDir) {
      const errorLogPath = path.join(this.logDir!, 'error.log')
      fs.appendFileSync(errorLogPath, formatted + '\n', 'utf-8')
    }
  }

  static defaultFormatter(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    return `${prefix} ${entry.message}${contextStr}`
  }

  static jsonFormatter(entry: LogEntry): string {
    return JSON.stringify(entry)
  }

  static prettyFormatter(entry: LogEntry): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',   // 青色
      info: '\x1b[32m',    // 绿色
      warn: '\x1b[33m',    // 黄色
      error: '\x1b[31m',   // 红色
      fatal: '\x1b[35m'    // 紫色
    }
    const reset = '\x1b[0m'
    const prefix = `${colors[entry.level]}[${entry.level.toUpperCase()}]${reset}`
    const message = entry.context ? `${entry.message} ${JSON.stringify(entry.context)}` : entry.message
    return `${prefix} ${message}`
  }

  traceRequest(method: string, url: string, status: number, duration: number): void {
    this.info('HTTP Request', { method, url, status, durationMs: duration })
  }

  setLogFile(filename: string): void {
    if (!this.logDir) {
      this.logDir = path.dirname(filename)
      this.ensureLogDir()
    }

    if (this.logStream) {
      this.logStream.end()
    }

    this.logStream = fs.createWriteStream(filename, { flags: 'a' })
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end()
      this.logStream = null
    }
  }
}

// 默认实例
export const defaultLogger = new LoggingService()