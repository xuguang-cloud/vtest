/**
 * RetryStrategy — 重试策略
 * 支持指数退避、最大重试次数、可配置延迟
 */

export interface RetryOptions {
  maxAttempts: number
  delayMs: number
  backoffMultiplier?: number
  maxDelayMs?: number
  retryableErrors?: Array<{ new (message?: string): Error }>
}

export class RetryStrategy {
  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        // 检查是否该重试此类型的错误
        if (options.retryableErrors && !this.isRetryableError(error, options.retryableErrors)) {
          throw error
        }

        if (attempt < options.maxAttempts) {
          const delay = this.calculateDelay(attempt, options)
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('Retry failed after all attempts')
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const multiplier = options.backoffMultiplier || 2
    let delay = options.delayMs * Math.pow(multiplier, attempt - 1)

    if (options.maxDelayMs) {
      delay = Math.min(delay, options.maxDelayMs)
    }

    // 增加随机抖动（jitter），避免惊群效应
    const jitter = delay * 0.1 * Math.random()
    return Math.floor(delay + jitter)
  }

  private isRetryableError(error: unknown, retryableErrors: Array<{ new (message?: string): Error }>): boolean {
    return retryableErrors.some(ErrorType => error instanceof ErrorType)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 带退避的重试（指数退避 + 抖动）
   */
  static async withBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    const strategy = new RetryStrategy()
    return strategy.execute(operation, {
      maxAttempts,
      delayMs: baseDelayMs,
      backoffMultiplier: 2,
      maxDelayMs: 30000
    })
  }
}