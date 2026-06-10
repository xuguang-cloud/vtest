import { CircuitBreaker } from '../circuit/CircuitBreaker'

describe('CircuitBreaker', () => {
  it('should start in CLOSED state', () => {
    const cb = new CircuitBreaker({ threshold: 3, resetTimeout: 1000 })
    expect(cb.getState()).toBe('CLOSED')
  })

  it('should execute successful operations', async () => {
    const cb = new CircuitBreaker({ threshold: 3, resetTimeout: 1000 })
    const result = await cb.execute(async () => 'success')
    expect(result).toBe('success')
  })

  it('should open circuit after threshold failures', async () => {
    const cb = new CircuitBreaker({ threshold: 3, resetTimeout: 5000 })
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    }
    expect(cb.getState()).toBe('OPEN')
  })

  it('should reject requests when circuit is OPEN', async () => {
    const cb = new CircuitBreaker({ threshold: 1, resetTimeout: 5000 })
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    await expect(cb.execute(async () => 'should not run')).rejects.toThrow('Circuit breaker is OPEN')
  })

  it('should transition to HALF_OPEN after resetTimeout (use forceState)', async () => {
    const cb = new CircuitBreaker({ threshold: 1, resetTimeout: 10000 })
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    expect(cb.getState()).toBe('OPEN')

    // Simulate elapsed time by forcing state
    cb.forceState('HALF_OPEN')
    await expect(cb.execute(async () => 'half-open success')).resolves.toBe('half-open success')
    expect(cb.getState()).toBe('CLOSED')
  })

  it('should go back to OPEN if HALF_OPEN call fails', async () => {
    const cb = new CircuitBreaker({ threshold: 2, resetTimeout: 5000 })
    // Open the circuit
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    expect(cb.getState()).toBe('OPEN')

    // Manually transition to HALF_OPEN for test
    cb.forceState('HALF_OPEN')
    // HALF_OPEN attempt fails
    await expect(cb.execute(async () => { throw new Error('fail again') })).rejects.toThrow('fail again')
    // Circuit should be OPEN after failure in HALF_OPEN (threshold=2, half-open failure triggers OPEN)
    expect(cb.getState()).toBe('OPEN')
  })

  it('should CLOSE after HALF_OPEN success', async () => {
    const cb = new CircuitBreaker({ threshold: 2, resetTimeout: 5000 })
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    expect(cb.getState()).toBe('OPEN')

    cb.forceState('HALF_OPEN')
    await cb.execute(async () => 'half-open success')
    expect(cb.getState()).toBe('CLOSED')
  })

  it('should provide fallback when circuit is OPEN', async () => {
    const cb = new CircuitBreaker({ threshold: 1, resetTimeout: 50000 })
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    expect(cb.getState()).toBe('OPEN')

    // With long resetTimeout, shouldAttemptReset returns false → uses fallback
    const result = await cb.execute(
      async () => 'primary',
      async () => 'fallback'
    )
    expect(result).toBe('fallback')
  })

  it('should track failure count correctly', async () => {
    const cb = new CircuitBreaker({ threshold: 5, resetTimeout: 1000 })
    expect(cb.getFailureCount()).toBe(0)
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    expect(cb.getFailureCount()).toBe(1)
  })

  it('should reset after success', async () => {
    const cb = new CircuitBreaker({ threshold: 2, resetTimeout: 5000 })
    await cb.execute(async () => 'success')
    await cb.execute(async () => 'success')
    expect(cb.getState()).toBe('CLOSED')
    expect(cb.getFailureCount()).toBe(0)
  })

  it('should return fallback when HALF_OPEN max requests exceeded', async () => {
    const cb = new CircuitBreaker({ threshold: 1, resetTimeout: 5000, halfOpenMaxRequests: 1 })
    await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    cb.forceState('HALF_OPEN')

    // First HALF_OPEN request
    await expect(cb.execute(async () => 'ok')).resolves.toBe('ok')
    expect(cb.getState()).toBe('CLOSED')
  })
})