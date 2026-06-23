import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { HealthChecker } from '../health/HealthChecker'

describe('HealthChecker', () => {
  let checker: HealthChecker

  beforeEach(() => {
    checker = new HealthChecker(1000)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should report HEALTHY when all checks pass', async () => {
    checker.register('db', async () => true, 'Database connection')
    const report = await checker.runChecks()
    expect(report.status).toBe('HEALTHY')
    expect(report.checks.db).toBe(true)
    expect(report.details.db).toBe('OK')
  })

  it('should report UNHEALTHY when all checks fail', async () => {
    checker.register('db', async () => false)
    const report = await checker.runChecks()
    expect(report.status).toBe('UNHEALTHY')
    expect(report.checks.db).toBe(false)
  })

  it('should report DEGRADED when some checks fail', async () => {
    checker.register('a', async () => true)
    checker.register('b', async () => true)
    checker.register('c', async () => false)
    const report = await checker.runChecks()
    expect(report.status).toBe('DEGRADED')
  })

  it('should record check history', async () => {
    checker.register('x', async () => true)
    await checker.runChecks()
    expect(checker.getCheckHistory('x')).toHaveLength(1)
  })

  it('should timeout a hanging check', async () => {
    jest.useFakeTimers()
    checker.register('hang', () => new Promise<boolean>(() => {}))
    const promise = checker.runChecks()
    jest.advanceTimersByTime(1100)
    const report = await promise
    expect(report.checks.hang).toBe(false)
    expect(report.details.hang).toContain('timeout')
  })

  it('should unregister a check', async () => {
    checker.register('x', async () => false)
    checker.unregister('x')
    const report = await checker.runChecks()
    expect(report.status).toBe('UNHEALTHY')
    expect(Object.keys(report.checks)).toHaveLength(0)
  })

  it('should wait for a healthy check', async () => {
    let calls = 0
    checker.register('x', async () => {
      calls++
      return calls >= 3
    })
    await expect(checker.waitForHealthy('x', 200, 1)).resolves.toBeUndefined()
  })

  it('should throw when waiting for healthy times out', async () => {
    checker.register('x', async () => false)
    await expect(checker.waitForHealthy('x', 50, 1)).rejects.toThrow('Timeout')
  })

  it('should list registered checks', () => {
    checker.register('a', async () => true)
    checker.register('b', async () => true)
    expect(checker.getRegisteredChecks()).toEqual(['a', 'b'])
  })

  it('should reset history and uptime', async () => {
    checker.register('a', async () => true)
    await checker.runChecks()
    checker.reset()
    expect(checker.getCheckHistory('a')).toEqual([])
  })

  it('should throw when waiting for an unregistered check', async () => {
    await expect(checker.waitForHealthy('missing', 100, 10)).rejects.toThrow('not registered')
  })
})
