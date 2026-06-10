/**
 * MemoryOptimizer — 内存优化器
 * 监控内存使用，达到阈值时自动触发优化
 */

export interface MemoryUsage {
  heapUsed: number
  heapTotal: number
  rss: number
  external: number
  arrayBuffers: number
  heapUsedPercent: number
}

export interface MemoryOptimizerOptions {
  memoryThreshold: number
  checkIntervalMs: number
  onOptimize?: (usage: MemoryUsage) => void
}

export class MemoryOptimizer {
  private memoryThreshold: number
  private checkIntervalMs: number
  private interval: ReturnType<typeof setInterval> | null = null
  private isRunning = false
  private lastOptimizationTime = 0
  private optimizationCount = 0
  private totalFreedBytes = 0
  private onOptimize?: (usage: MemoryUsage) => void

  constructor(options?: Partial<MemoryOptimizerOptions>) {
    this.memoryThreshold = options?.memoryThreshold ?? 0.8
    this.checkIntervalMs = options?.checkIntervalMs ?? 30000
    this.onOptimize = options?.onOptimize
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.interval = setInterval(() => {
      this.checkMemoryUsage()
    }, this.checkIntervalMs)
  }

  stop(): void {
    this.isRunning = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      heapUsedPercent: usage.heapTotal > 0 ? usage.heapUsed / usage.heapTotal : 0
    }
  }

  private checkMemoryUsage(): void {
    const usage = this.getMemoryUsage()

    if (usage.heapUsedPercent > this.memoryThreshold) {
      this.optimize()
    }
  }

  optimize(): MemoryUsage {
    const beforeUsage = this.getMemoryUsage()

    // 1. 清理 V8 内部缓存
    this.cleanupV8Cache()

    // 2. 触发垃圾回收
    this.triggerGC()

    // 3. 释放外部资源
    this.releaseExternalResources()

    const afterUsage = this.getMemoryUsage()
    const freedBytes = beforeUsage.heapUsed - afterUsage.heapUsed

    this.optimizationCount++
    this.lastOptimizationTime = Date.now()
    this.totalFreedBytes += Math.max(0, freedBytes)

    if (this.onOptimize) {
      this.onOptimize(afterUsage)
    }

    return afterUsage
  }

  private cleanupV8Cache(): void {
    // 清理 V8 内部代码缓存
    // 在 Node.js 中可以通过 v8 模块的某些 API 来提示 GC
    try {
      // V8 内部缓存清理提示
      if (typeof (global as any).gc === 'function') {
        (global as any).gc(true)
      }
    } catch {
      // 忽略清理错误
    }
  }

  private triggerGC(): void {
    try {
      if (typeof global.gc === 'function') {
        global.gc()
      }
    } catch {
      // 忽略 GC 错误（例如 --expose-gc 未启用）
    }
  }

  private releaseExternalResources(): void {
    // 清理外部资源引用
    // 具体实现取决于应用场景
  }

  getStats(): { optimizationCount: number; totalFreedBytes: number; lastOptimizationTime: number } {
    return {
      optimizationCount: this.optimizationCount,
      totalFreedBytes: this.totalFreedBytes,
      lastOptimizationTime: this.lastOptimizationTime
    }
  }

  setThreshold(threshold: number): void {
    this.memoryThreshold = Math.max(0, Math.min(1, threshold))
  }
}