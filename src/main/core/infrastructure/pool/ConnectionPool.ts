/**
 * ConnectionPool — 通用资源连接池
 * 管理可复用连接的创建、获取、释放和生命周期
 */

export interface PoolOptions<T> {
  maxConnections: number
  createConnection: () => Promise<T>
  releaseConnection: (connection: T) => void
  validateConnection?: (connection: T) => boolean | Promise<boolean>
  maxIdleTimeMs?: number
  acquireTimeoutMs?: number
}

export class ConnectionPool<T> {
  private connections: T[] = []
  private activeConnections = new Set<T>()
  private waitingQueue: Array<{
    resolve: (connection: T) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = []
  private isShuttingDown = false
  private readonly options: Required<PoolOptions<T>>

  constructor(options: PoolOptions<T>) {
    this.options = {
      maxIdleTimeMs: 60000,
      acquireTimeoutMs: 30000,
      ...options
    } as Required<PoolOptions<T>>
  }

  async acquire(): Promise<T> {
    if (this.isShuttingDown) {
      throw new PoolError('Connection pool is shutting down')
    }

    // 有闲置连接则复用
    while (this.connections.length > 0) {
      const connection = this.connections.pop()!
      if (this.options.validateConnection) {
        const valid = await this.options.validateConnection(connection)
        if (!valid) {
          this.options.releaseConnection(connection)
          continue
        }
      }
      this.activeConnections.add(connection)
      return connection
    }

    // 可以创建新连接
    if (this.activeConnections.size < this.options.maxConnections) {
      const connection = await this.options.createConnection()
      this.activeConnections.add(connection)
      return connection
    }

    // 等待可用连接
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waitingQueue.findIndex(w => w.reject === reject)
        if (idx !== -1) {
          this.waitingQueue.splice(idx, 1)
        }
        reject(new PoolError('Connection acquire timeout'))
      }, this.options.acquireTimeoutMs)

      this.waitingQueue.push({ resolve, reject, timer })
    })
  }

  release(connection: T): void {
    this.activeConnections.delete(connection)

    // 优先分配给等待者
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!
      clearTimeout(waiter.timer)
      this.activeConnections.add(connection)
      waiter.resolve(connection)
      return
    }

    // 否则放入闲置池
    this.connections.push(connection)
  }

  invalidate(connection: T): void {
    this.activeConnections.delete(connection)
    this.options.releaseConnection(connection)
  }

  getActiveCount(): number {
    return this.activeConnections.size
  }

  getIdleCount(): number {
    return this.connections.length
  }

  getWaitingCount(): number {
    return this.waitingQueue.length
  }

  getTotalCount(): number {
    return this.activeConnections.size + this.connections.length
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true

    // 拒绝所有等待的请求
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timer)
      waiter.reject(new PoolError('Connection pool is shutting down'))
    }
    this.waitingQueue = []

    // 释放所有连接
    for (const connection of this.connections) {
      this.options.releaseConnection(connection)
    }
    for (const connection of this.activeConnections) {
      this.options.releaseConnection(connection)
    }

    this.connections = []
    this.activeConnections.clear()
  }
}

export class PoolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PoolError'
  }
}