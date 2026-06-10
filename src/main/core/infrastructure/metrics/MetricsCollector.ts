/**
 * MetricsCollector — 指标收集器
 * 支持多种指标类型：计数器、计时器、直方图
 */

export interface MetricStats {
  count: number
  avg: number
  min: number
  max: number
  p50?: number
  p95?: number
  p99?: number
  sum: number
}

export type MetricType = 'counter' | 'timer' | 'gauge'

export interface MetricDefinition {
  name: string
  type: MetricType
  help?: string
}

export class MetricsCollector {
  private counters = new Map<string, number>()
  private timers = new Map<string, number[]>()
  private gauges = new Map<string, number>()
  private metricDefinitions = new Map<string, MetricDefinition>()
  private labels = new Map<string, Map<string, number>>()

  defineMetric(definition: MetricDefinition): void {
    this.metricDefinitions.set(definition.name, definition)
  }

  incrementCounter(name: string, value: number = 1, label?: string): void {
    if (label) {
      if (!this.labels.has(name)) {
        this.labels.set(name, new Map())
      }
      const labelMap = this.labels.get(name)!
      labelMap.set(label, (labelMap.get(label) || 0) + value)
    }

    this.counters.set(name, (this.counters.get(name) || 0) + value)
  }

  recordTimer(name: string, durationMs: number): void {
    if (!this.timers.has(name)) {
      this.timers.set(name, [])
    }
    this.timers.get(name)!.push(durationMs)
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value)
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0
  }

  getTimerValues(name: string, timeRange?: { start: number; end: number }): number[] {
    const values = this.timers.get(name) || []
    if (!timeRange) return [...values]

    // 此处我们只能根据记录的数值本身来判断范围
    // 简化处理：返回所有记录值
    return values
  }

  getGauge(name: string): number {
    return this.gauges.get(name) || 0
  }

  calculateStats(name: string): MetricStats {
    const timerValues = this.timers.get(name)
    const counterValue = this.counters.get(name)

    if (timerValues && timerValues.length > 0) {
      return this.calculateTimerStats(timerValues)
    }

    if (counterValue !== undefined) {
      return {
        count: 1,
        avg: counterValue,
        min: counterValue,
        max: counterValue,
        sum: counterValue
      }
    }

    return { count: 0, avg: 0, min: 0, max: 0, sum: 0 }
  }

  private calculateTimerStats(values: number[]): MetricStats {
    const sorted = [...values].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: sorted.length,
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      sum
    }
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  getLabelValues(name: string): Record<string, number> {
    const labelMap = this.labels.get(name)
    if (!labelMap) return {}
    return Object.fromEntries(labelMap)
  }

  snapshot(): {
    counters: Record<string, number>
    gauges: Record<string, number>
    timers: Record<string, MetricStats>
  } {
    const counters: Record<string, number> = {}
    const gauges: Record<string, number> = {}
    const timers: Record<string, MetricStats> = {}

    for (const [name, value] of this.counters) {
      counters[name] = value
    }
    for (const [name, value] of this.gauges) {
      gauges[name] = value
    }
    for (const [name] of this.timers) {
      timers[name] = this.calculateStats(name)
    }

    return { counters, gauges, timers }
  }

  reset(): void {
    this.counters.clear()
    this.timers.clear()
    this.gauges.clear()
    this.labels.clear()
  }
}