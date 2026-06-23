import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { ConnectionPool, PoolError } from '../pool/ConnectionPool'

describe('ConnectionPool', () => {
  type Connection = { id: number }

  it('should create and release connections', async () => {
    let id = 0
    const pool = new ConnectionPool<Connection>({
      maxConnections: 2,
      createConnection: async () => ({ id: ++id }),
      releaseConnection: () => {}
    })

    const c1 = await pool.acquire()
    const c2 = await pool.acquire()
    expect(pool.getActiveCount()).toBe(2)
    expect(pool.getIdleCount()).toBe(0)

    pool.release(c1)
    expect(pool.getActiveCount()).toBe(1)
    expect(pool.getIdleCount()).toBe(1)

    const c3 = await pool.acquire()
    expect(c3).toBe(c1)
    expect(pool.getIdleCount()).toBe(0)

    pool.release(c1)
    pool.release(c2)
    pool.release(c3)
    await pool.shutdown()
  })

  it('should validate connections before reuse', async () => {
    let id = 0
    let valid = true
    const released: Connection[] = []
    const pool = new ConnectionPool<Connection>({
      maxConnections: 1,
      createConnection: async () => ({ id: ++id }),
      releaseConnection: (c) => { released.push(c) },
      validateConnection: () => valid
    })

    const c1 = await pool.acquire()
    valid = false
    pool.release(c1)
    const c2 = await pool.acquire()
    expect(c2.id).toBe(2)
    expect(released).toContain(c1)
    await pool.shutdown()
  })

  it('should queue acquire requests when max reached', async () => {
    let id = 0
    const pool = new ConnectionPool<Connection>({
      maxConnections: 1,
      createConnection: async () => ({ id: ++id }),
      releaseConnection: () => {}
    })

    const c1 = await pool.acquire()
    const promise = pool.acquire()
    expect(pool.getWaitingCount()).toBe(1)
    pool.release(c1)
    const c2 = await promise
    expect(c2).toBe(c1)
    await pool.shutdown()
  })

  it('should reject queued acquire on timeout', async () => {
    const pool = new ConnectionPool<Connection>({
      maxConnections: 1,
      createConnection: async () => ({ id: 1 }),
      releaseConnection: () => {},
      acquireTimeoutMs: 50
    })

    await pool.acquire()
    await expect(pool.acquire()).rejects.toThrow('Connection acquire timeout')
    expect(pool.getWaitingCount()).toBe(0)
    await pool.shutdown()
  })

  it('should shutdown and release resources', async () => {
    const released: Connection[] = []
    const pool = new ConnectionPool<Connection>({
      maxConnections: 2,
      createConnection: async () => ({ id: 1 }),
      releaseConnection: (c) => { released.push(c) }
    })

    const c1 = await pool.acquire()
    const c2 = await pool.acquire()
    const waiting = pool.acquire()
    await pool.shutdown()
    expect(released).toContain(c1)
    expect(released).toContain(c2)
    await expect(waiting).rejects.toThrow('Connection pool is shutting down')
  })

  it('should reject acquire after shutdown', async () => {
    const pool = new ConnectionPool<Connection>({
      maxConnections: 1,
      createConnection: async () => ({ id: 1 }),
      releaseConnection: () => {}
    })
    await pool.shutdown()
    await expect(pool.acquire()).rejects.toThrow('Connection pool is shutting down')
  })

  it('should track total count', async () => {
    const pool = new ConnectionPool<Connection>({
      maxConnections: 2,
      createConnection: async () => ({ id: 1 }),
      releaseConnection: () => {}
    })
    const c = await pool.acquire()
    expect(pool.getTotalCount()).toBe(1)
    pool.release(c)
    expect(pool.getTotalCount()).toBe(1)
    await pool.shutdown()
  })

  it('should create a PoolError', () => {
    const error = new PoolError('test error')
    expect(error.name).toBe('PoolError')
    expect(error.message).toBe('test error')
  })
})
