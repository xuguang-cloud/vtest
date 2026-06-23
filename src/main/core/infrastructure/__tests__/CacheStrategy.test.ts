import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { CacheStrategy } from '../cache/CacheStrategy'

describe('CacheStrategy', () => {
  let strategy: CacheStrategy

  beforeEach(() => {
    strategy = new CacheStrategy()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should record access and pre-warm after 5 accesses', () => {
    expect(strategy.shouldPreWarm('k')).toBe(false)
    for (let i = 0; i < 4; i++) {
      strategy.recordAccess('k')
    }
    expect(strategy.shouldPreWarm('k')).toBe(false)
    strategy.recordAccess('k')
    expect(strategy.shouldPreWarm('k')).toBe(true)
  })

  it('should not evict when eviction check interval has not passed', () => {
    strategy.recordAccess('k')
    strategy.recordAccess('k')
    strategy.recordAccess('k')
    expect(strategy.shouldEvict('k')).toBe(false)
  })

  it('should evict when average access interval exceeds 5 minutes', () => {
    strategy.recordAccess('k')
    jest.advanceTimersByTime(310_000)
    strategy.recordAccess('k')
    jest.advanceTimersByTime(310_000)
    strategy.recordAccess('k')
    expect(strategy.shouldEvict('k')).toBe(true)
  })

  it('should evict when access trend exceeds threshold', () => {
    strategy.recordAccess('k')
    jest.advanceTimersByTime(1_000)
    strategy.recordAccess('k')
    jest.advanceTimersByTime(21_000)
    strategy.recordAccess('k')
    jest.advanceTimersByTime(41_000)
    strategy.recordAccess('k')
    expect(strategy.shouldEvict('k')).toBe(true)
  })

  it('should not evict with insufficient data', () => {
    jest.advanceTimersByTime(60_000)
    strategy.recordAccess('k')
    expect(strategy.shouldEvict('k')).toBe(false)
  })

  it('should return stable access trend for regular intervals', () => {
    for (let i = 0; i < 3; i++) {
      strategy.recordAccess('k')
      jest.advanceTimersByTime(10_000)
    }
    const stats = strategy.getAccessStats('k')
    expect(stats?.accessTrend).toBe('stable')
  })

  it('should return increasing trend when intervals shrink', () => {
    strategy.recordAccess('k')
    jest.advanceTimersByTime(30_000)
    strategy.recordAccess('k')
    jest.advanceTimersByTime(10_000)
    strategy.recordAccess('k')
    const stats = strategy.getAccessStats('k')
    expect(stats?.accessTrend).toBe('increasing')
  })

  it('should return decreasing trend when intervals grow', () => {
    strategy.recordAccess('k')
    jest.advanceTimersByTime(10_000)
    strategy.recordAccess('k')
    jest.advanceTimersByTime(30_000)
    strategy.recordAccess('k')
    const stats = strategy.getAccessStats('k')
    expect(stats?.accessTrend).toBe('decreasing')
  })

  it('should return null stats for unknown keys', () => {
    expect(strategy.getAccessStats('unknown')).toBeNull()
  })

  it('should list hot keys sorted by count', () => {
    for (let i = 0; i < 3; i++) strategy.recordAccess('a')
    for (let i = 0; i < 5; i++) strategy.recordAccess('b')
    for (let i = 0; i < 2; i++) strategy.recordAccess('c')
    expect(strategy.getHotKeys(4)).toEqual(['b'])
  })

  it('should reset all data', () => {
    strategy.recordAccess('k')
    strategy.reset()
    expect(strategy.getAccessStats('k')).toBeNull()
    expect(strategy.getHotKeys()).toEqual([])
  })
})
