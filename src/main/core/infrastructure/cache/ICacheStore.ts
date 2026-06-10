/**
 * ICacheStore — 缓存存储抽象接口
 * 将 Redis 等外部缓存依赖抽象为接口，便于测试和替换
 */

export interface CacheStoreOptions {
  ttlMs?: number
  namespace?: string
}

export interface ICacheStore {
  /** 获取缓存值 */
  get(key: string): Promise<string | null>

  /** 设置缓存值 */
  set(key: string, value: string, options?: CacheStoreOptions): Promise<void>

  /** 删除缓存值 */
  del(key: string): Promise<boolean>

  /** 批量获取 */
  mget(keys: string[]): Promise<(string | null)[]>

  /** 批量设置 */
  mset(entries: Array<[string, string]>, options?: CacheStoreOptions): Promise<void>

  /** 检查 key 是否存在 */
  exists(key: string): Promise<boolean>

  /** 获取缓存统计 */
  getStats(): Promise<{ size: number; hitRate: number }>

  /** 清空缓存 */
  clear(): Promise<void>

  /** 健康检查 */
  ping(): Promise<boolean>
}

/**
 * NoopCacheStore — 空实现，用于无外部缓存时的回退
 */
export class NoopCacheStore implements ICacheStore {
  private store = new Map<string, string>()
  private hits = 0
  private misses = 0

  async get(key: string): Promise<string | null> {
    const value = this.store.get(key) ?? null
    if (value !== null) this.hits++
    else this.misses++
    return value
  }

  async set(key: string, value: string, _options?: CacheStoreOptions): Promise<void> {
    this.store.set(key, value)
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return keys.map(k => this.store.get(k) ?? null)
  }

  async mset(entries: Array<[string, string]>, _options?: CacheStoreOptions): Promise<void> {
    for (const [key, value] of entries) {
      this.store.set(key, value)
    }
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async getStats(): Promise<{ size: number; hitRate: number }> {
    const total = this.hits + this.misses
    return {
      size: this.store.size,
      hitRate: total > 0 ? this.hits / total : 0
    }
  }

  async clear(): Promise<void> {
    this.store.clear()
    this.hits = 0
    this.misses = 0
  }

  async ping(): Promise<boolean> {
    return true
  }
}

/**
 * 工厂函数：创建适合当前环境的 ICacheStore 实例
 */
export async function createCacheStore(type: 'memory' | 'redis' = 'memory', _options?: Record<string, unknown>): Promise<ICacheStore> {
  if (type === 'redis') {
    console.warn('[Cache] Redis store requires ioredis dependency. Falling back to memory store.')
    return new NoopCacheStore()
  }
  return new NoopCacheStore()
}