/**
 * TaskQueue — 异步任务队列
 * 支持并发控制、优先级调度、任务取消
 */

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

export interface Task<T = unknown> {
  id?: string
  data: T
  priority?: TaskPriority
}

interface QueuedTask extends Task {
  id: string
  priority: TaskPriority
  createdAt: number
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  cancelled: boolean
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
}

export class TaskQueue {
  private queue: QueuedTask[] = []
  private activeCount = 0
  private readonly concurrency: number
  private completedCount = 0
  private failedCount = 0
  private isPaused = false

  constructor(concurrency: number = 1) {
    this.concurrency = concurrency
  }

  async add<T, R = unknown>(task: Task<T>): Promise<R> {
    return new Promise((resolve, reject) => {
      const queued: QueuedTask = {
        ...task,
        id: task.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        priority: task.priority || 'normal',
        createdAt: Date.now(),
        resolve: resolve as (value: unknown) => void,
        reject,
        cancelled: false
      }

      this.queue.push(queued)
      this.queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
      this.processNext()
    })
  }

  private async processNext(): Promise<void> {
    if (this.isPaused || this.activeCount >= this.concurrency) return
    if (this.queue.length === 0) return

    const task = this.queue.shift()
    if (!task || task.cancelled) {
      this.processNext()
      return
    }

    this.activeCount++

    try {
      const result = await this.execute(task)
      if (!task.cancelled) {
        task.resolve(result)
        this.completedCount++
      }
    } catch (error) {
      if (!task.cancelled) {
        task.reject(error)
        this.failedCount++
      }
    } finally {
      this.activeCount--
      this.processNext()
    }
  }

  private async execute(task: QueuedTask): Promise<unknown> {
    // 执行任务的具体逻辑需要子类实现实际的处理
    return task.data
  }

  cancel(taskId: string): boolean {
    const existing = this.queue.find(t => t.id === taskId)
    if (existing) {
      existing.cancelled = true
      this.queue = this.queue.filter(t => t.id !== taskId)
      return true
    }
    return false
  }

  pause(): void {
    this.isPaused = true
  }

  resume(): void {
    this.isPaused = false
    this.processNext()
  }

  getPendingCount(): number {
    return this.queue.length
  }

  getActiveCount(): number {
    return this.activeCount
  }

  getCompletedCount(): number {
    return this.completedCount
  }

  getFailedCount(): number {
    return this.failedCount
  }

  clear(): void {
    for (const task of this.queue) {
      task.reject(new Error('Task queue cleared'))
    }
    this.queue = []
  }

  getStats(): {
    pending: number
    active: number
    completed: number
    failed: number
    paused: boolean
  } {
    return {
      pending: this.queue.length,
      active: this.activeCount,
      completed: this.completedCount,
      failed: this.failedCount,
      paused: this.isPaused
    }
  }
}

/**
 * 带处理器的任务队列
 * 内部包装 TaskQueue，添加自动处理逻辑
 */
export class ProcessingTaskQueue<T, R> {
  private queue: TaskQueue
  private processor: (data: T) => Promise<R>

  constructor(concurrency: number, processor: (data: T) => Promise<R>) {
    this.queue = new TaskQueue(concurrency)
    this.processor = processor
  }

  async enqueue(data: T, priority: TaskPriority = 'normal'): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.add({
        data,
        priority
      })
      // Delegate to execute via processor
      this.processor(data).then(resolve).catch(reject)
    })
  }
}