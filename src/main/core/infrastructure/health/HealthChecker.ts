/**
 * HealthChecker — 健康检查器
 * 提供组件和服务的心跳检测与健康状态报告
 */

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'

export interface HealthReport {
  timestamp: number
  status: HealthStatus
  checks: Record<string, boolean>
  details?: Record<string, string>
  uptime: number
}

export interface HealthCheckResult {
  name: string
  healthy: boolean
  message?: string
  duration: number
}

export class HealthChecker {
  private checks = new Map<string, () => Promise<boolean>>()
  private checkDescriptions = new Map<string, string>()
  private results = new Map<string, HealthCheckResult[]>()
  private startTime = Date.now()
  private checkTimeoutMs: number

  constructor(checkTimeoutMs: number = 5000) {
    this.checkTimeoutMs = checkTimeoutMs
  }

  register(name: string, check: () => Promise<boolean>, description?: string): void {
    this.checks.set(name, check)
    if (description) {
      this.checkDescriptions.set(name, description)
    }
  }

  unregister(name: string): void {
    this.checks.delete(name)
    this.checkDescriptions.delete(name)
  }

  async runChecks(): Promise<HealthReport> {
    const results: Record<string, boolean> = {}
    const details: Record<string, string> = {}
    const promises: Promise<void>[] = []

    for (const [name, check] of this.checks) {
      promises.push(
        this.runSingleCheck(name, check)
          .then(result => {
            results[name] = result.healthy
            details[name] = result.message || (result.healthy ? 'OK' : 'Failed')
            this.recordResult(result)
          })
      )
    }

    await Promise.allSettled(promises)

    return {
      timestamp: Date.now(),
      status: this.calculateOverallStatus(results),
      checks: results,
      details,
      uptime: Date.now() - this.startTime
    }
  }

  private async runSingleCheck(name: string, check: () => Promise<boolean>): Promise<HealthCheckResult> {
    const startTime = Date.now()
    try {
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), this.checkTimeoutMs)
      )
      const healthy = await Promise.race([check(), timeoutPromise])
      return {
        name,
        healthy,
        message: healthy ? undefined : 'Check returned unhealthy',
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        name,
        healthy: false,
        message: (error as Error).message,
        duration: Date.now() - startTime
      }
    }
  }

  private recordResult(result: HealthCheckResult): void {
    if (!this.results.has(result.name)) {
      this.results.set(result.name, [])
    }
    const history = this.results.get(result.name)!
    history.push(result)
    // 保留最近100条记录
    if (history.length > 100) {
      history.shift()
    }
  }

  private calculateOverallStatus(results: Record<string, boolean>): HealthStatus {
    const entries = Object.entries(results)
    if (entries.length === 0) return 'UNHEALTHY'

    const healthyCount = entries.filter(([, v]) => v).length
    const totalChecks = entries.length

    if (healthyCount === totalChecks) return 'HEALTHY'
    if (healthyCount >= totalChecks * 0.5) return 'DEGRADED'
    return 'UNHEALTHY'
  }

  getCheckHistory(name: string): HealthCheckResult[] {
    return this.results.get(name) || []
  }

  async waitForHealthy(name: string, timeoutMs: number = 30000, intervalMs: number = 1000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const check = this.checks.get(name)
      if (!check) throw new Error(`Health check "${name}" not registered`)
      const healthy = await check()
      if (healthy) return
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
    throw new Error(`Timeout waiting for "${name}" to become healthy`)
  }

  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys())
  }

  reset(): void {
    this.results.clear()
    this.startTime = Date.now()
  }
}