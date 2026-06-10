/**
 * PerformanceMonitor — 性能监控器
 * 收集和分析系统性能指标
 */

export interface MetricSnapshot {
  name: string
  values: number[]
  stats: MetricStats
  timestamp: number
}

export interface MetricStats {
  count: number
  average: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
}

export interface PerformanceReport {
  timestamp: number
  metrics: Record<string, MetricStats>
  summary: {
    totalMetrics: number
    totalDataPoints: number
    timeRange: number
  }
}

export class PerformanceMonitor {
  private metrics = new Map<string, number[]>()
  private metricTimestamps = new Map<string, number[]>()
  private maxDataPoints: number
  private startTime = Date.now()

  constructor(maxDataPoints: number = 10000) {
    this.maxDataPoints = maxDataPoints
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
      this.metricTimestamps.set(name, [])
    }

    const values = this.metrics.get(name)!
    const timestamps = this.metricTimestamps.get(name)!

    values.push(value)
    timestamps.push(Date.now())

    // 限制数据点数量
    if (values.length > this.maxDataPoints) {
      values.splice(0, values.length - this.maxDataPoints)
      timestamps.splice(0, timestamps.length - this.maxDataPoints)
    }
  }

  recordMetricWithLabels(name: string, value: number, labels: Record<string, string>): void {
    const labelKey = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',')

    this.recordMetric(`${name}{${labelKey}}`, value)
  }

  getMetricValues(name: string, timeRange?: { start: number; end: number }): number[] {
    const values = this.metrics.get(name)
    if (!values) return []

    if (!timeRange) return [...values]

    const timestamps = this.metricTimestamps.get(name) || []
    const filtered: number[] = []

    for (let i = 0; i < values.length; i++) {
      const ts = timestamps[i]
      if (ts >= timeRange.start && ts <= timeRange.end) {
        filtered.push(values[i])
      }
    }

    return filtered
  }

  analyzePerformance(name?: string): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: Date.now(),
      metrics: {},
      summary: {
        totalMetrics: 0,
        totalDataPoints: 0,
        timeRange: Date.now() - this.startTime
      }
    }

    const targetMetrics = name ? [name] : Array.from(this.metrics.keys())

    for (const metricName of targetMetrics) {
      const values = this.metrics.get(metricName)
      if (!values || values.length === 0) continue

      report.metrics[metricName] = this.calculateStats(values)
      report.summary.totalMetrics++
      report.summary.totalDataPoints += values.length
    }

    return report
  }

  private calculateStats(values: number[]): MetricStats {
    const sorted = [...values].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: sorted.length,
      average: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    }
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  getMetricNames(): string[] {
    return Array.from(this.metrics.keys())
  }

  hasMetric(name: string): boolean {
    return this.metrics.has(name)
  }

  generateHTMLReport(): string {
    const report = this.analyzePerformance()
    const metricCards = Object.entries(report.metrics)
      .map(([name, stats]) => `
        <div class="metric-card">
          <h3>${name}</h3>
          <div class="stat-grid">
            <div class="stat"><span class="label">Count</span><span class="value">${stats.count}</span></div>
            <div class="stat"><span class="label">Avg</span><span class="value">${stats.average.toFixed(2)}</span></div>
            <div class="stat"><span class="label">Min</span><span class="value">${stats.min}</span></div>
            <div class="stat"><span class="label">Max</span><span class="value">${stats.max}</span></div>
            <div class="stat"><span class="label">P50</span><span class="value">${stats.p50}</span></div>
            <div class="stat"><span class="label">P95</span><span class="value">${stats.p95}</span></div>
            <div class="stat"><span class="label">P99</span><span class="value">${stats.p99}</span></div>
          </div>
        </div>
      `).join('\n')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Performance Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 20px; background: #f8f9fa; }
    .summary { margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 8px; }
    .metric-card { background: white; border-radius: 8px; padding: 16px; margin: 12px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .metric-card h3 { margin: 0 0 12px 0; font-family: monospace; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .stat { padding: 8px; background: #f8f9fa; border-radius: 4px; }
    .label { display: block; font-size: 11px; color: #666; text-transform: uppercase; }
    .value { display: block; font-size: 16px; font-weight: 600; margin-top: 2px; }
  </style>
</head>
<body>
  <h1>📈 Performance Report</h1>
  <div class="summary">
    <p>Metrics: ${report.summary.totalMetrics} | Data Points: ${report.summary.totalDataPoints} | Time Range: ${(report.summary.timeRange / 1000).toFixed(0)}s</p>
    <p>Generated: ${new Date(report.timestamp).toISOString()}</p>
  </div>
  ${metricCards}
</body>
</html>`
  }

  clear(): void {
    this.metrics.clear()
    this.metricTimestamps.clear()
    this.startTime = Date.now()
  }
}