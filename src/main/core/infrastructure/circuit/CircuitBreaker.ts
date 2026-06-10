/**
 * CircuitBreaker — 断路器模式
 * 防止级联故障，提供优雅降级能力
 * 状态: CLOSED → OPEN → HALF_OPEN → CLOSED
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  threshold: number
  resetTimeout: number
  halfOpenMaxRequests?: number
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime: number
  lastSuccessTime: number
  openCount: number
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private lastSuccessTime = 0
  private openCount = 0
  private halfOpenRequests = 0
  private readonly threshold: number
  private readonly resetTimeout: number
  private readonly halfOpenMaxRequests: number

  constructor(options: CircuitBreakerOptions) {
    this.threshold = options.threshold
    this.resetTimeout = options.resetTimeout
    this.halfOpenMaxRequests = options.halfOpenMaxRequests || 1
  }

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN')
      } else {
        if (fallback) return fallback()
        throw new CircuitBreakerError('Circuit breaker is OPEN', this.state)
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenRequests >= this.halfOpenMaxRequests) {
      if (fallback) return fallback()
      throw new CircuitBreakerError('Circuit breaker HALF_OPEN, max test requests reached', this.state)
    }

    this.halfOpenRequests++

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      if (fallback) return fallback()
      throw error
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.resetTimeout
  }

  private onSuccess(): void {
    this.successCount++
    this.halfOpenRequests = 0
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('CLOSED')
    }
    this.failureCount = 0
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    this.halfOpenRequests = 0

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.threshold) {
      this.transitionTo('OPEN')
    }
  }

  private transitionTo(newState: CircuitState): void {
    const prevState = this.state
    this.state = newState

    if (newState === 'OPEN') {
      this.openCount++
    }

    if (newState === 'CLOSED') {
      this.failureCount = 0
    }

    if (newState === 'HALF_OPEN') {
      this.halfOpenRequests = 0
    }
  }

  forceState(state: CircuitState): void {
    this.state = state
    if (state === 'CLOSED') {
      this.failureCount = 0
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openCount: this.openCount
    }
  }

  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
    this.lastSuccessTime = 0
    this.halfOpenRequests = 0
  }
}

export class CircuitBreakerError extends Error {
  public readonly state: CircuitState
  constructor(message: string, state: CircuitState) {
    super(message)
    this.name = 'CircuitBreakerError'
    this.state = state
  }
}