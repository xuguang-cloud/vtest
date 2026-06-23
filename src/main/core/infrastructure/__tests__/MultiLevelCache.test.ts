import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { MultiLevelCache, LRUCache, ExternalCache } from '../cache/MultiLevelCache'
import { NoopCacheStore } from '../cache/ICacheStore'

describe('LRUCache', () => {
  let cache: LRUCache<string, number>

  beforeEach(() => {
    cache = new LRUCache<string, number>({ max: 2 })
  })

  it('should set and get values', () => {
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
  })

  it('should return undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined()
  })

  it('should evict the oldest item when max size is exceeded', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it('should refresh key order on get', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
  })

  it('should support has, delete and clear', () => {
    cache.set('x', 1)
    expect(cache.has('x')).toBe(true)
    expect(cache.delete('x')).toBe(true)
    expect(cache.has('x')).toBe(false)
    cache.set('y', 2)
    cache.clear()
    expect(cache.has('y')).toBe(false)
    expect(cache.size).toBe(0)
  })
})

describe('MultiLevelCache', () => {
  let cache: MultiLevelCache
  let l3Cache: NoopCacheStore

  beforeEach(() => {
    l3Cache = new NoopCacheStore()
    cache = new MultiLevelCache({
      l1MaxSize: 2,
      l2MaxSize: 2,
      l3Cache: l3Cache,
      l1TtlMs: 5000,
      defaultTtlMs: 60000
    })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should set and get from L1', async () => {
    await cache.set('key', 'value')
    const result = await cache.get<string>('key')
    expect(result).toBe('value')
  })

  it('should promote from L2 to L1 when L1 misses', async () => {
    await cache.set('key', 'value')
    jest.advanceTimersByTime(6_000)
    const result = await cache.get<string>('key')
    expect(result).toBe('value')
  })

  it('should promote from L3 to L1 and L2 when L1/L2 miss', async () => {
    await l3Cache.set('key', JSON.stringify({ hello: 'world' }))
    const result = await cache.get<{ hello: string }>('key')
    expect(result).toEqual({ hello: 'world' })
  })

  it('should return null when key is not found in any level', async () => {
    expect(await cache.get('missing')).toBeNull()
  })

  it('should delete from all levels', async () => {
    await cache.set('key', 'value')
    await l3Cache.set('key', JSON.stringify('value'))
    await cache.delete('key')
    expect(await cache.get('key')).toBeNull()
  })

  it('should clear L1 and L2', async () => {
    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.clear()
    const stats = cache.getStats()
    expect(stats.l1Size).toBe(0)
    expect(stats.l2Size).toBe(0)
  })

  it('should report stats', async () => {
    await cache.set('a', 1)
    const stats = cache.getStats()
    expect(stats.l1Size).toBe(1)
    expect(stats.l2Size).toBe(1)
    expect(stats.hasL3).toBe(true)
  })

  it('should use default TTL when not specified', async () => {
    const c = new MultiLevelCache({})
    await c.set('key', 'value')
    expect(await c.get('key')).toBe('value')
  })
})
