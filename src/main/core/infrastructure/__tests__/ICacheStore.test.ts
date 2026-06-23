import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NoopCacheStore, createCacheStore } from '../cache/ICacheStore'

describe('NoopCacheStore', () => {
  let store: NoopCacheStore

  beforeEach(() => {
    store = new NoopCacheStore()
  })

  afterEach(async () => {
    await store.clear()
  })

  it('should set and get a value', async () => {
    await store.set('foo', 'bar')
    expect(await store.get('foo')).toBe('bar')
  })

  it('should return null for missing key', async () => {
    expect(await store.get('missing')).toBeNull()
  })

  it('should delete a key', async () => {
    await store.set('foo', 'bar')
    expect(await store.del('foo')).toBe(true)
    expect(await store.get('foo')).toBeNull()
    expect(await store.del('foo')).toBe(false)
  })

  it('should support mget and mset', async () => {
    await store.mset([
      ['a', '1'],
      ['b', '2']
    ])
    expect(await store.mget(['a', 'b', 'c'])).toEqual(['1', '2', null])
  })

  it('should check existence', async () => {
    await store.set('x', 'y')
    expect(await store.exists('x')).toBe(true)
    expect(await store.exists('z')).toBe(false)
  })

  it('should report stats with hit rate', async () => {
    await store.set('x', 'y')
    await store.get('x')
    await store.get('y')
    const stats = await store.getStats()
    expect(stats.size).toBe(1)
    expect(stats.hitRate).toBe(0.5)
  })

  it('should clear all data and stats', async () => {
    await store.set('x', 'y')
    await store.get('x')
    await store.clear()
    const stats = await store.getStats()
    expect(stats.size).toBe(0)
    expect(stats.hitRate).toBe(0)
  })

  it('should ping successfully', async () => {
    expect(await store.ping()).toBe(true)
  })
})

describe('createCacheStore', () => {
  it('should create a memory store by default', async () => {
    const store = await createCacheStore()
    expect(store).toBeInstanceOf(NoopCacheStore)
  })

  it('should create a memory store explicitly', async () => {
    const store = await createCacheStore('memory')
    expect(store).toBeInstanceOf(NoopCacheStore)
  })

  it('should fall back to memory store for redis and warn', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const store = await createCacheStore('redis')
    expect(store).toBeInstanceOf(NoopCacheStore)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
