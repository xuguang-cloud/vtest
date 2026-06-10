/**
 * CacheStrategy — 缓存策略
 * 基于访问模式分析的智能缓存策略管理
 * 支持访问频率跟踪、驱逐决策、预热决策
 */

export interface CacheAccessStats {
  key: string
  accessCount: number
  firstAccess: number
  lastAccess: number
  averageInterval: number
  accessTrend: 'increasing' | 'decreasing' | 'stable'
}

export class CacheStrategy {
  private accessTimes = new Map<string, number[]>()
  private accessCounts = new Map<string, number>()
  private lastEvictionCheck = Date.now()
  private evictionCheckIntervalMs = 30000 // 每30秒检查一次

  recordAccess(key: string): void {
    // 记录访问时间
    const times = this.accessTimes.get(key) || []
    times.push(Date.now())
    this.accessTimes.set(key, times.slice(-10)) // 保留最近10次

    // 记录访问次数
    this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1)
  }

  shouldEvict(key: string): boolean {
    // 检查是否到了检查周期
    if (Date.now() - this.lastEvictionCheck < this.evictionCheckIntervalMs) {
      return false
    }

    const times = this.accessTimes.get(key)
    if (!times || times.length < 3) return false

    // 计算访问间隔
    const intervals: number[] = []
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1])
    }

    // 如果平均间隔 > 5分钟，建议驱逐
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    if (avgInterval > 300000) return true // 5分钟

    // 如果访问间隔呈递增趋势（访问频率下降）
    const trend = this.calculateTrend(intervals)
    return trend > 10000 // 间隔每次平均增加10秒以上
  }

  shouldPreWarm(key: string): boolean {
    const count = this.accessCounts.get(key) || 0
    // 如果访问次数 >= 5，建议预热
    return count >= 5
  }

  getAccessStats(key: string): CacheAccessStats | null {
    const times = this.accessTimes.get(key)
    const count = this.accessCounts.get(key)
    if (!times || times.length < 2 || count === undefined) return null

    const intervals: number[] = []
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1])
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const trend = this.calculateTrend(intervals)

    return {
      key,
      accessCount: count,
      firstAccess: times[0],
      lastAccess: times[times.length - 1],
      averageInterval: avgInterval,
      accessTrend: trend > 1000 ? 'decreasing' : trend < -1000 ? 'increasing' : 'stable'
    }
  }

  private calculateTrend(intervals: number[]): number {
    if (intervals.length < 2) return 0
    let sum = 0
    for (let i = 1; i < intervals.length; i++) {
      sum += intervals[i] - intervals[i - 1]
    }
    return sum / (intervals.length - 1)
  }

  getHotKeys(threshold: number = 10): string[] {
    const result: string[] = []
    for (const [key, count] of this.accessCounts) {
      if (count >= threshold) {
        result.push(key)
      }
    }
    return result.sort((a, b) => (this.accessCounts.get(b) || 0) - (this.accessCounts.get(a) || 0))
  }

  reset(): void {
    this.accessTimes.clear()
    this.accessCounts.clear()
  }
}