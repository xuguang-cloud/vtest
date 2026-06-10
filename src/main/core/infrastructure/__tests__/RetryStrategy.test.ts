import { RetryStrategy } from '../retry/RetryStrategy'

class NetworkError extends Error {
  constructor(message?: string) {
    super(message || 'Network error')
    this.name = 'NetworkError'
  }
}

class FatalError extends Error {
  constructor(message?: string) {
    super(message || 'Fatal error')
    this.name = 'FatalError'
  }
}

describe('RetryStrategy', () => {
  let strategy: RetryStrategy

  beforeEach(() => {
    strategy = new RetryStrategy()
  })

  it('should succeed on first attempt', async () => {
    const result = await strategy.execute(
      async () => 'success',
      { maxAttempts: 3, delayMs: 10 }
    )
    expect(result).toBe('success')
  })

  it('should retry on failure and eventually succeed', async () => {
    let attempts = 0
    const result = await strategy.execute(
      async () => {
        attempts++
        if (attempts < 3) throw new Error('transient error')
        return 'success'
      },
      { maxAttempts: 5, delayMs: 10 }
    )
    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  it('should throw after exhausting retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent error'))
    await expect(
      strategy.execute(fn, { maxAttempts: 3, delayMs: 10 })
    ).rejects.toThrow('persistent error')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should support configurable error filter', async () => {
    const fn = jest.fn()
    fn.mockRejectedValue(new NetworkError())

    await expect(
      strategy.execute(fn, {
        maxAttempts: 3,
        delayMs: 10,
        retryableErrors: [NetworkError]
      })
    ).rejects.toThrow('Network error')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new FatalError('fatal'))
    await expect(
      strategy.execute(fn, {
        maxAttempts: 3,
        delayMs: 10,
        retryableErrors: [NetworkError]
      })
    ).rejects.toThrow('fatal')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should use exponential backoff', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'))
    await expect(
      strategy.execute(fn, {
        maxAttempts: 4,
        delayMs: 100,
        backoffMultiplier: 2
      })
    ).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('should work with maxAttempts=1 (no retry)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'))
    await expect(
      strategy.execute(fn, { maxAttempts: 1, delayMs: 10 })
    ).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should return first success result', async () => {
    const fn = jest.fn()
    fn.mockRejectedValueOnce(new Error('fail1'))
    fn.mockRejectedValueOnce(new Error('fail2'))
    fn.mockResolvedValueOnce('final success')

    const result = await strategy.execute(fn, { maxAttempts: 5, delayMs: 10 })
    expect(result).toBe('final success')
  })

  it('should support static withBackoff helper', async () => {
    const result = await RetryStrategy.withBackoff(async () => 'done', 2, 10)
    expect(result).toBe('done')
  })
})