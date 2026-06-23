import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { MemoryOptimizer } from '../memory/MemoryOptimizer'

describe('MemoryOptimizer', () => {
  let originalGc: unknown

  beforeEach(() => {
    originalGc = (globalThis as any).gc
    ;(globalThis as any).gc = jest.fn()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(globalThis as any).gc = originalGc
  })

  const mockMemoryUsage = (heapUsed: number, heapTotal: number) => {
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed,
      heapTotal,
      rss: 0,
      external: 0,
      arrayBuffers: 0
    } as NodeJS.MemoryUsage)
  }

  it('should start and stop the monitoring interval', () => {
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.5, checkIntervalMs: 1000 })
    optimizer.start()
    expect(optimizer).toBeDefined()
    optimizer.stop()
  })

  it('should not start duplicate intervals', () => {
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.5, checkIntervalMs: 1000 })
    optimizer.start()
    optimizer.start()
    optimizer.stop()
  })

  it('should report memory usage', () => {
    mockMemoryUsage(50, 100)
    const optimizer = new MemoryOptimizer()
    const usage = optimizer.getMemoryUsage()
    expect(usage.heapUsedPercent).toBe(0.5)
  })

  it('should trigger optimization when memory threshold exceeded', () => {
    mockMemoryUsage(90, 100)
    const onOptimize = jest.fn()
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.8, checkIntervalMs: 1000, onOptimize })
    optimizer.start()
    jest.advanceTimersByTime(1000)
    expect(onOptimize).toHaveBeenCalled()
    optimizer.stop()
  })

  it('should not trigger optimization below threshold', () => {
    mockMemoryUsage(50, 100)
    const onOptimize = jest.fn()
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.8, checkIntervalMs: 1000, onOptimize })
    optimizer.start()
    jest.advanceTimersByTime(1000)
    expect(onOptimize).not.toHaveBeenCalled()
    optimizer.stop()
  })

  it('should update stats after optimization', () => {
    mockMemoryUsage(90, 100)
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.8, checkIntervalMs: 1000 })
    optimizer.optimize()
    const stats = optimizer.getStats()
    expect(stats.optimizationCount).toBe(1)
    expect(stats.lastOptimizationTime).toBeGreaterThan(0)
  })

  it('should call the onOptimize callback', () => {
    mockMemoryUsage(90, 100)
    const onOptimize = jest.fn()
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.8, checkIntervalMs: 1000, onOptimize })
    optimizer.optimize()
    expect(onOptimize).toHaveBeenCalledTimes(1)
  })

  it('should handle missing global gc gracefully', () => {
    ;(globalThis as any).gc = undefined
    mockMemoryUsage(90, 100)
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.8 })
    expect(() => optimizer.optimize()).not.toThrow()
  })

  it('should clamp threshold values', () => {
    const optimizer = new MemoryOptimizer({ memoryThreshold: 0.5 })
    optimizer.setThreshold(1.5)
    mockMemoryUsage(100, 100)
    const onOptimize = jest.fn()
    optimizer.start()
    jest.advanceTimersByTime(1000)
    expect(onOptimize).not.toHaveBeenCalled()
    optimizer.stop()
  })
})
