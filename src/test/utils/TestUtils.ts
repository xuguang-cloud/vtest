/**
 * TestUtils — 通用测试工具集
 * 提供 Mock 创建、异步等待、临时文件管理等辅助功能
 */

export class TestUtils {
  /**
   * 创建部分 Mock 对象
   */
  static createMock<T>(obj: Partial<T>): T {
    return obj as T
  }

  /**
   * 等待条件成立（带超时和轮询间隔）
   */
  static async waitFor<T>(
    condition: () => T | Promise<T>,
    timeout = 5000,
    interval = 100
  ): Promise<T> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition()
        if (result !== undefined && result !== null && result !== false) {
          return result
        }
      } catch {
        // 忽略中间错误
      }
      await TestUtils.sleep(interval)
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`)
  }

  /**
   * 带超时的 Promise
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage?: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(errorMessage || `Promise timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      promise.then(
        result => {
          clearTimeout(timeoutId)
          resolve(result)
        },
        error => {
          clearTimeout(timeoutId)
          reject(error)
        }
      )
    })
  }

  /**
   * 延迟等待
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 生成随机测试数据
   */
  static randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  static randomNumber(min: number = 0, max: number = 1000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  static randomBoolean(): boolean {
    return Math.random() > 0.5
  }

  /**
   * 模拟异步操作
   */
  static async simulateAsync<T>(result: T, delayMs: number = 10): Promise<T> {
    await TestUtils.sleep(delayMs)
    return result
  }

  /**
   * 多次重试直到成功
   */
  static async retryUntilSuccess<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 100
  ): Promise<T> {
    let lastError: Error | undefined
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (i < maxRetries - 1) {
          await TestUtils.sleep(delayMs)
        }
      }
    }
    throw lastError || new Error('Retry failed')
  }
}