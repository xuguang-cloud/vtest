import { type ICacheStore } from './ICacheStore'

/**
 * MultiLevelCache — 多级缓存
 * L1: 内存 Map（最快，容量小）
 * L2: LRU 缓存（快速，受限容量）
 * L3: 外部缓存（如 Redis/ICacheStore，容量最大）
 * 自动逐级回退，写操作三级同步
 */

// 简易 LRU 缓存实现
export class LRUCache<K, V> {
  private cache = new Map<K, V>()
  private readonly max: number

  constructor(options: { max: number }) {
    this.max = options.max
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined
    const value = this.cache.get(key)!
    // 移动到最新
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.max) {
      // 删除最久未使用的（第一个）
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// 外部缓存接口
export interface ExternalCache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  del(key: string): Promise<void>
}

export class MultiLevelCache {
  private l1Cache = new Map<string, { value: unknown; expiry: number }>()
  private l2Cache: LRUCache<string, unknown>
  private l3Cache: ICacheStore | null = null
  private l1TtlMs: number
  private defaultTtlMs: number

  constructor(options: {
    l1MaxSize?: number
    l1TtlMs?: number
    l2MaxSize?: number
    l3Cache?: ICacheStore
    defaultTtlMs?: number
  } = {}) {
    this.l2Cache = new LRUCache<string, unknown>({ max: options.l2MaxSize || 1000 })
    this.l3Cache = options.l3Cache || null
    this.l1TtlMs = options.l1TtlMs || 5000
    this.defaultTtlMs = options.defaultTtlMs || 60000
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    // L1 缓存（内存 Map，含 TTL）
    const l1Entry = this.l1Cache.get(key)
    if (l1Entry) {
      if (Date.now() < l1Entry.expiry) {
        return l1Entry.value as T
      }
      this.l1Cache.delete(key)
    }

    // L2 缓存（LRU）
    const l2Value = this.l2Cache.get(key)
    if (l2Value !== undefined) {
      this.l1Cache.set(key, {
        value: l2Value,
        expiry: Date.now() + this.l1TtlMs
      })
      return l2Value as T
    }

    // L3 缓存（外部）
    if (this.l3Cache) {
      const l3Value = await this.l3Cache.get(key)
      if (l3Value !== null) {
        const parsed = JSON.parse(l3Value) as T
        this.l1Cache.set(key, {
          value: parsed,
          expiry: Date.now() + this.l1TtlMs
        })
        this.l2Cache.set(key, parsed)
        return parsed
      }
    }

    return null
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const ttlMs = ttl || this.defaultTtlMs

    // L1 写入
    this.l1Cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    })

    // L2 写入
    this.l2Cache.set(key, value)

    // L3 写入（通过 ICacheStore 接口）
    if (this.l3Cache) {
      await this.l3Cache.set(key, JSON.stringify(value), { ttlMs })
    }
  }

  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key)
    this.l2Cache.delete(key)
    if (this.l3Cache) {
      await this.l3Cache.del(key)
    }
  }

  async clear(): Promise<void> {
    this.l1Cache.clear()
    this.l2Cache.clear()
  }

  getStats(): { l1Size: number; l2Size: number; hasL3: boolean } {
    return {
      l1Size: this.l1Cache.size,
      l2Size: this.l2Cache.size,
      hasL3: this.l3Cache !== null
    }
  }
}