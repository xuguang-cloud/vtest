/**
 * MonitoringService — 监控服务
 * 指标收集、告警规则评估、通知分发
 */
import { MetricsCollector } from '../../core/infrastructure/metrics/MetricsCollector'

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency'

export interface AlertRule {
  name: string
  description: string
  metricName: string
  condition: (values: number[]) => boolean
  severity: AlertSeverity
  message: string
  timeRange: number
  cooldownMs?: number
  action?: () => void | Promise<void>
}

export interface Notifier {
  notify(alert: AlertNotification): void | Promise<void>
}

export interface AlertNotification {
  title: string
  message: string
  severity: AlertSeverity
  metricName: string
  timestamp: number
  value?: number
}

export class AlertNotifier implements Notifier {
  private handlers: Array<(alert: AlertNotification) => void | Promise<void>> = []

  onNotify(handler: (alert: AlertNotification) => void | Promise<void>): void {
    this.handlers.push(handler)
  }

  async notify(alert: AlertNotification): Promise<void> {
    console.log(`[Alert][${alert.severity}] ${alert.title}: ${alert.message}`)
    for (const handler of this.handlers) {
      await handler(alert)
    }
  }
}

export class MonitoringService {
  private metrics = new MetricsCollector()
  private alerts = new Map<string, { rule: AlertRule; lastTriggered: number }>()
  private notifier: Notifier
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  constructor(notifier?: Notifier) {
    this.notifier = notifier || new AlertNotifier()
  }

  setNotifier(notifier: Notifier): void {
    this.notifier = notifier
  }

  getMetricsCollector(): MetricsCollector {
    return this.metrics
  }

  registerAlert(name: string, rule: AlertRule): void {
    this.alerts.set(name, { rule, lastTriggered: 0 })
  }

  unregisterAlert(name: string): void {
    this.alerts.delete(name)
  }

  checkAlerts(): void {
    const now = Date.now()

    for (const [name, { rule, lastTriggered }] of this.alerts) {
      // 检查冷却期
      const cooldown = rule.cooldownMs || 60000
      if (now - lastTriggered < cooldown) continue

      const values = this.metrics.getTimerValues(rule.metricName, {
        start: now - rule.timeRange,
        end: now
      })

      // 如果是指标类型的值，获取计数器
      if (values.length === 0) {
        const counterValue = this.metrics.getCounter(rule.metricName)
        if (counterValue > 0) {
          const result = rule.condition([counterValue])
          if (result) {
            this.triggerAlert(name, rule, { values: [counterValue], now })
          }
        }
        continue
      }

      if (rule.condition(values)) {
        this.triggerAlert(name, rule, { values, now })
      }
    }
  }

  private triggerAlert(
    name: string,
    rule: AlertRule,
    context: { values: number[]; now: number }
  ): void {
    // 更新最后触发时间
    const entry = this.alerts.get(name)
    if (entry) {
      entry.lastTriggered = context.now
    }

    const notification: AlertNotification = {
      title: `Alert: ${name}`,
      message: rule.message,
      severity: rule.severity,
      metricName: rule.metricName,
      timestamp: context.now,
      value: context.values[context.values.length - 1]
    }

    // 发送通知
    this.notifier.notify(notification)

    // 执行告警动作
    if (rule.action) {
      rule.action()
    }

    // 记录告警指标
    this.metrics.incrementCounter('alerts.triggered', 1, name)
  }

  start(checkIntervalMs: number = 30000): void {
    if (this.isRunning) return
    this.isRunning = true
    this.checkInterval = setInterval(() => {
      this.checkAlerts()
    }, checkIntervalMs)
  }

  stop(): void {
    this.isRunning = false
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  getRegisteredAlerts(): string[] {
    return Array.from(this.alerts.keys())
  }

  getAlertState(name: string): { rule: AlertRule; lastTriggered: number } | undefined {
    return this.alerts.get(name)
  }

  /**
   * 创建常用的告警规则
   */
  static createHighErrorRateRule(
    name: string,
    threshold: number = 10,
    timeRangeMs: number = 60000
  ): AlertRule {
    return {
      name,
      description: `Error rate exceeds ${threshold} in ${timeRangeMs / 1000}s`,
      metricName: 'errors',
      condition: (values) => values.length > threshold,
      severity: 'critical',
      message: `Error rate high: ${threshold} errors in ${timeRangeMs / 1000}s`,
      timeRange: timeRangeMs
    }
  }
}