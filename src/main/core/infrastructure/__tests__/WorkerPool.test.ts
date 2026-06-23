import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

class FakeWorker {
  terminated = false
  posted: unknown[] = []
  onMessage?: (message: unknown) => void
  onError?: (error: Error) => void
  onExit?: (code: number) => void

  constructor(public scriptPath: string) {}

  on(event: string, handler: Function) {
    if (event === 'message') this.onMessage = handler as (m: unknown) => void
    if (event === 'error') this.onError = handler as (e: Error) => void
    if (event === 'exit') this.onExit = handler as (c: number) => void
  }

  postMessage(message: unknown) {
    this.posted.push(message)
  }

  terminate() {
    this.terminated = true
    return Promise.resolve(0)
  }
}

describe('WorkerPool', () => {
  let WorkerConstructor: jest.Mock
  let workers: FakeWorker[]

  beforeEach(() => {
    workers = []
    WorkerConstructor = jest.fn().mockImplementation((scriptPath: string) => {
      const worker = new FakeWorker(scriptPath)
      workers.push(worker)
      return worker
    })
    jest.resetModules()
    jest.doMock('worker_threads', () => ({
      Worker: WorkerConstructor
    }))
  })

  afterEach(() => {
    jest.dontMock('worker_threads')
  })

  it('should create a worker and post a task', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(1, 'default-worker.js')
    pool.execute<string, string>({ data: 'hello' })
    expect(WorkerConstructor).toHaveBeenCalledWith('default-worker.js')
    expect(workers[0].posted).toHaveLength(1)
    expect(workers[0].posted[0]).toMatchObject({ data: 'hello' })
    await pool.terminate()
  })

  it('should queue tasks when concurrency is reached', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(1)
    pool.execute<string, string>({ data: 'a' })
    pool.execute<string, string>({ data: 'b' })
    expect(pool.getActiveCount()).toBe(1)
    expect(pool.getPendingCount()).toBe(1)
    await pool.terminate()
  })

  it('should track multiple active workers', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(2)
    pool.execute<string, string>({ data: 'x' })
    pool.execute<string, string>({ data: 'y' })
    expect(pool.getActiveCount()).toBe(2)
    expect(pool.getPendingCount()).toBe(0)
    await pool.terminate()
  })

  it('should use custom worker file when provided', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(1, 'default-worker.js')
    pool.execute<string, string>({ data: 'task', workerFile: 'custom-worker.js' })
    expect(WorkerConstructor).toHaveBeenCalledWith('custom-worker.js')
    await pool.terminate()
  })

  it('should terminate all workers', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(2)
    pool.execute<string, string>({ data: 'task' })
    await pool.terminate()
    expect(workers.every(w => w.terminated)).toBe(true)
    expect(pool.getActiveCount()).toBe(0)
    expect(pool.getPendingCount()).toBe(0)
  })

  it('should handle worker message events', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(1)
    pool.execute<string, string>({ data: 'task' })
    const worker = workers[0]
    expect(worker.onMessage).toBeDefined()
    expect(worker.onError).toBeDefined()
    expect(worker.onExit).toBeDefined()
    if (worker.onMessage) {
      worker.onMessage({ id: '1', result: 'ok' })
    }
    expect(pool.getActiveCount()).toBe(0)
    await pool.terminate()
  })

  it('should reuse an idle worker', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(1)
    pool.execute<string, string>({ data: 'task1' })
    const worker = workers[0]
    if (worker.onMessage) worker.onMessage({ id: '1', result: 'ok' })
    pool.execute<string, string>({ data: 'task2' })
    expect(workers).toHaveLength(1)
    expect(worker.posted).toHaveLength(2)
    await pool.terminate()
  })

  it('should handle worker error events', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(1)
    pool.execute<string, string>({ data: 'task' })
    const worker = workers[0]
    expect(worker.onError).toBeDefined()
    if (worker.onError) {
      worker.onError(new Error('worker error'))
    }
    expect(pool.getActiveCount()).toBe(0)
    await pool.terminate()
  })

  it('should handle worker exit events', async () => {
    const { WorkerPool } = await import('../worker/WorkerPool')
    const pool = new WorkerPool(1)
    pool.execute<string, string>({ data: 'task' })
    const worker = workers[0]
    expect(worker.onExit).toBeDefined()
    if (worker.onExit) {
      worker.onExit(0)
    }
    expect(pool.getActiveCount()).toBe(0)
    expect(workers).toHaveLength(1)
    await pool.terminate()
  })
})
