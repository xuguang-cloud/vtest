import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { TaskQueue, ProcessingTaskQueue } from '../async/TaskQueue'

describe('TaskQueue', () => {
  let queue: TaskQueue

  beforeEach(() => {
    queue = new TaskQueue()
  })

  afterEach(() => {
    queue.clear()
  })

  it('should process a single task', async () => {
    const result = await queue.add({ data: 'hello' })
    expect(result).toBe('hello')
  })

  it('should use custom concurrency', async () => {
    const concurrentQueue = new TaskQueue(2)
    const results = await Promise.all([
      concurrentQueue.add({ data: 1 }),
      concurrentQueue.add({ data: 2 })
    ])
    expect(results).toEqual([1, 2])
  })

  it('should track pending and active count under concurrency limit', async () => {
    const q = new TaskQueue(1)
    const promise = q.add({ data: 'first' })
    expect(q.getActiveCount()).toBe(1)
    expect(q.getPendingCount()).toBe(0)

    q.add({ data: 'second' })
    expect(q.getPendingCount()).toBe(1)

    await promise
  })

  it('should process tasks by priority', async () => {
    const q = new TaskQueue(1)
    const order: string[] = []
    q.pause()
    const tasks = [
      q.add({ id: 'low', data: 'low', priority: 'low' }).then(() => order.push('low')),
      q.add({ id: 'normal', data: 'normal', priority: 'normal' }).then(() => order.push('normal')),
      q.add({ id: 'high', data: 'high', priority: 'high' }).then(() => order.push('high')),
      q.add({ id: 'critical', data: 'critical', priority: 'critical' }).then(() => order.push('critical'))
    ]
    q.resume()
    await Promise.all(tasks)
    expect(order).toEqual(['critical', 'high', 'normal', 'low'])
  })

  it('should pause and resume processing', async () => {
    queue.pause()
    const promise = queue.add({ data: 'paused' })
    expect(queue.getPendingCount()).toBe(1)

    queue.resume()
    await expect(promise).resolves.toBe('paused')
  })

  it('should cancel a pending task', () => {
    queue.pause()
    queue.add({ id: 'a', data: 'a' })
    queue.add({ id: 'b', data: 'b' })
    expect(queue.cancel('a')).toBe(true)
    expect(queue.getPendingCount()).toBe(1)
    expect(queue.cancel('missing')).toBe(false)
    queue.resume()
  })

  it('should clear pending tasks with rejection', async () => {
    queue.pause()
    const p = queue.add({ data: 'will-clear' })
    queue.clear()
    await expect(p).rejects.toThrow('Task queue cleared')
    expect(queue.getPendingCount()).toBe(0)
  })

  it('should report stats correctly', async () => {
    queue.pause()
    queue.add({ data: 'p1' })
    queue.add({ data: 'p2' })
    queue.resume()
    await queue.add({ data: 'done' })
    const stats = queue.getStats()
    expect(stats.pending).toBe(0)
    expect(stats.completed).toBeGreaterThanOrEqual(1)
    expect(stats.paused).toBe(false)
  })

  it('should handle task rejection when data is a rejected promise', async () => {
    const q = new TaskQueue(1)
    await expect(q.add({ data: Promise.reject(new Error('boom')) })).rejects.toThrow('boom')
    expect(q.getFailedCount()).toBe(1)
  })

  it('should return the task id', async () => {
    const result = await queue.add({ id: 'my-id', data: 'x' })
    expect(result).toBe('x')
  })
})

describe('ProcessingTaskQueue', () => {
  it('should process items with the provided processor', async () => {
    const processor = jest.fn().mockResolvedValue('processed')
    const ptq = new ProcessingTaskQueue<string, string>(1, processor)
    const result = await ptq.enqueue('input')
    expect(processor).toHaveBeenCalledWith('input')
    expect(result).toBe('processed')
  })
})
