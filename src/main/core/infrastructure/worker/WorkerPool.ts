/**
 * WorkerPool — 工作线程池
 * 管理并发任务执行，限制最大并发数
 */
import { Worker } from 'worker_threads'
import * as path from 'path'

export interface WorkerTask<T = unknown> {
  id?: string
  data: T
  workerFile?: string
}

interface QueuedTask<T = unknown> extends WorkerTask<T> {
  id: string
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason: unknown) => void
  workerFile: string
}

export class WorkerPool {
  private workers: Worker[] = []
  private queue: QueuedTask[] = []
  private active = new Set<Worker>()
  private workerIdle = new Map<Worker, boolean>()
  private concurrency: number
  private workerScriptPath: string

  constructor(concurrency: number, workerScriptPath?: string) {
    this.concurrency = concurrency
    this.workerScriptPath = workerScriptPath || path.resolve(__dirname, 'pool-worker.js')
  }

  async execute<T, R = unknown>(task: WorkerTask<T>): Promise<R> {
    return new Promise((resolve: (value: R) => void, reject) => {
      const queued: QueuedTask = {
        ...task,
        id: task.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        workerFile: task.workerFile || this.workerScriptPath,
        resolve: resolve as (value: unknown) => void,
        reject
      }
      this.queue.push(queued)
      this.processQueue()
    })
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.active.size < this.concurrency) {
      const idleWorker = this.findIdleWorker()
      if (idleWorker) {
        const task = this.queue.shift()!
        this.active.add(idleWorker)
        this.workerIdle.set(idleWorker, false)
        idleWorker.postMessage(task)
      } else if (this.workers.length < this.concurrency) {
        const task = this.queue.shift()!
        const worker = this.createWorker(task.workerFile)
        this.workers.push(worker)
        this.active.add(worker)
        this.workerIdle.set(worker, false)
        worker.postMessage(task)
      } else {
        break
      }
    }
  }

  private findIdleWorker(): Worker | undefined {
    for (const [worker, idle] of this.workerIdle) {
      if (idle) return worker
    }
    return undefined
  }

  private createWorker(workerFile: string): Worker {
    const worker = new Worker(workerFile)

    worker.on('message', (message: { id?: string; result?: unknown; error?: string }) => {
      this.active.delete(worker)
      this.workerIdle.set(worker, true)
      this.processQueue()
    })

    worker.on('error', (error: Error) => {
      this.active.delete(worker)
      this.workerIdle.set(worker, true)
      this.processQueue()
    })

    worker.on('exit', (code: number) => {
      this.active.delete(worker)
      this.workerIdle.delete(worker)
      this.workers = this.workers.filter(w => w !== worker)
    })

    return worker
  }

  getPendingCount(): number {
    return this.queue.length
  }

  getActiveCount(): number {
    return this.active.size
  }

  async terminate(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate()
    }
    this.workers = []
    this.active.clear()
    this.workerIdle.clear()
    this.queue = []
  }
}