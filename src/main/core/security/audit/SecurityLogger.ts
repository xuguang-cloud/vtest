/**
 * SecurityLogger — 安全日志记录器
 * 记录安全相关事件并支持异常检测
 */
import * as fs from 'fs'
import * as path from 'path'

export interface SecurityEvent {
  type: 'auth' | 'access' | 'modification' | 'permission' | 'anomaly' | 'encryption'
  userId: string
  action: string
  resource: string
  ip?: string
  userAgent?: string
  success: boolean
  details?: Record<string, unknown>
}

export interface SecurityLogEntry {
  timestamp: number
  event: SecurityEvent
  severity: 'info' | 'warning' | 'critical'
}

export class SecurityLogger {
  private logEntries: SecurityLogEntry[] = []
  private maxEntries: number
  private logPath: string | null = null
  private anomalyCounters = new Map<string, number>()

  constructor(options?: { maxEntries?: number; logPath?: string }) {
    this.maxEntries = options?.maxEntries || 10000
    if (options?.logPath) {
      this.logPath = options.logPath
      this.ensureLogDir()
    }
  }

  private ensureLogDir(): void {
    if (this.logPath) {
      const dir = path.dirname(this.logPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  logEvent(event: SecurityEvent, severity: SecurityLogEntry['severity'] = 'info'): void {
    const entry: SecurityLogEntry = {
      timestamp: Date.now(),
      event,
      severity
    }

    this.logEntries.push(entry)
    if (this.logEntries.length > this.maxEntries) {
      this.logEntries.shift()
    }

    // 持久化
    if (this.logPath) {
      this.persistLog(entry)
    }

    // 更新计数器
    const counterKey = `${event.type}:${event.action}`
    this.anomalyCounters.set(counterKey, (this.anomalyCounters.get(counterKey) || 0) + 1)
  }

  private persistLog(entry: SecurityLogEntry): void {
    try {
      const line = JSON.stringify(entry) + '\n'
      fs.appendFileSync(this.logPath!, line, 'utf-8')
    } catch {
      console.error('[SecurityLogger] Failed to persist log entry')
    }
  }

  detectAnomalies(): SecurityLogEntry[] {
    const anomalies: SecurityLogEntry[] = []
    const now = Date.now()
    const windowMs = 60000 // 1分钟窗口

    // 获取最近1分钟内的日志
    const recentLogs = this.logEntries.filter(e => now - e.timestamp < windowMs)

    // 检测频繁失败
    const failedAttempts = recentLogs.filter(
      e => !e.event.success && e.severity !== 'info'
    )
    if (failedAttempts.length > 10) {
      anomalies.push({
        timestamp: now,
        event: {
          type: 'anomaly',
          userId: 'system',
          action: 'frequent_failures',
          resource: 'system',
          success: false,
          details: { count: failedAttempts.length, windowMs }
        },
        severity: 'critical'
      })
    }

    // 检测短时间内大量同一用户的操作
    const userActions = new Map<string, number>()
    for (const log of recentLogs) {
      userActions.set(log.event.userId, (userActions.get(log.event.userId) || 0) + 1)
    }
    for (const [userId, count] of userActions) {
      if (count > 50) {
        anomalies.push({
          timestamp: now,
          event: {
            type: 'anomaly',
            userId,
            action: 'excessive_operations',
            resource: 'system',
            success: true,
            details: { count, windowMs }
          },
          severity: 'warning'
        })
      }
    }

    return anomalies
  }

  getLogs(options?: {
    type?: SecurityEvent['type']
    userId?: string
    severity?: SecurityLogEntry['severity']
    startTime?: number
    endTime?: number
    limit?: number
  }): SecurityLogEntry[] {
    let filtered = [...this.logEntries]

    if (options?.type) {
      filtered = filtered.filter(e => e.event.type === options.type)
    }
    if (options?.userId) {
      filtered = filtered.filter(e => e.event.userId === options.userId)
    }
    if (options?.severity) {
      filtered = filtered.filter(e => e.severity === options.severity)
    }
    if (options?.startTime) {
      filtered = filtered.filter(e => e.timestamp >= options.startTime!)
    }
    if (options?.endTime) {
      filtered = filtered.filter(e => e.timestamp <= options.endTime!)
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp)

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit)
    }

    return filtered
  }

  getAnomalyCounters(): Record<string, number> {
    return Object.fromEntries(this.anomalyCounters)
  }

  clear(): void {
    this.logEntries = []
    this.anomalyCounters.clear()
  }
}