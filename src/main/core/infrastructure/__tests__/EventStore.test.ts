import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { EventStore } from '../event/EventStore'
import { createEvent } from '../event/Event'

// Inline factory avoids hoisting issues with jest.mock('fs', ...)
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    appendFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(''),
  },
  readFileSync: jest.fn(),
  rmSync: jest.fn(),
  mkdtempSync: jest.fn().mockReturnValue('/tmp/es-xxx'),
  rmdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}))

import * as fs from 'fs'
const mockedFs = fs as jest.Mocked<typeof fs>

describe('EventStore', () => {
  let store: EventStore

  beforeEach(() => {
    store = EventStore.getInstance()
    store.clear()
    store.configureStorage('')
    jest.clearAllMocks()
  })

  afterEach(() => {
    store.clear()
  })

  it('should be a singleton', () => {
    expect(EventStore.getInstance()).toBe(EventStore.getInstance())
  })

  it('should append events', async () => {
    const event = createEvent('test.type', { foo: 'bar' })
    await store.append(event)
    expect(store.getCount()).toBe(1)
  })

  it('should retrieve all events', async () => {
    await store.append(createEvent('type.a', { id: 1 }))
    await store.append(createEvent('type.b', { id: 2 }))
    await store.append(createEvent('type.a', { id: 3 }))
    const all = store.getEvents()
    expect(all).toHaveLength(3)
  })

  it('should filter events by type', async () => {
    await store.append(createEvent('type.a', { id: 1 }))
    await store.append(createEvent('type.b', { id: 2 }))
    await store.append(createEvent('type.a', { id: 3 }))
    const typeAEvents = store.getEvents('type.a')
    expect(typeAEvents).toHaveLength(2)
  })

  it('should return empty array for non-existent type', () => {
    expect(store.getEvents('nonexistent')).toEqual([])
  })

  it('should clear all events', async () => {
    await store.append(createEvent('test', { data: 1 }))
    await store.clear()
    expect(store.getCount()).toBe(0)
  })

  it('should generate events with unique IDs', () => {
    const event1 = createEvent('test', {})
    const event2 = createEvent('test', {})
    expect(event1.id).toBeDefined()
    expect(event2.id).toBeDefined()
    expect(event1.id).not.toBe(event2.id)
  })

  it('should set correct timestamp on events', () => {
    const before = Date.now()
    const event = createEvent('test', {})
    const after = Date.now()
    expect(event.timestamp).toBeGreaterThanOrEqual(before)
    expect(event.timestamp).toBeLessThanOrEqual(after)
  })

  it('should store payload correctly', async () => {
    const payload = { userId: 'u123', action: 'login' }
    await store.append(createEvent('user.action', payload))
    const events = store.getEvents('user.action')
    expect(events[0].payload).toEqual(payload)
  })

  it('should configure storage and create parent directory', () => {
    mockedFs.existsSync.mockReturnValue(false)
    store.configureStorage('/test/events.log')
    expect(mockedFs.mkdirSync).toHaveBeenCalled()
  })

  it('should skip mkdir when directory exists', () => {
    mockedFs.existsSync.mockReturnValue(true)
    store.configureStorage('/test/events.log')
    expect(mockedFs.mkdirSync).not.toHaveBeenCalled()
  })

  it('should get events in timestamp range', async () => {
    const e1 = createEvent('type', { v: 1 })
    const e2 = createEvent('type', { v: 2 })
    const e3 = createEvent('type', { v: 3 })
    e1.timestamp = 1000
    e2.timestamp = 2000
    e3.timestamp = 3000
    await store.append(e1)
    await store.append(e2)
    await store.append(e3)
    const result = store.getEventsInRange(1500, 2500)
    expect(result).toHaveLength(1)
    expect(result[0].timestamp).toBe(2000)
  })

  it('should filter events in range by type', async () => {
    const e1 = createEvent('a', { v: 1 })
    const e2 = createEvent('b', { v: 2 })
    e1.timestamp = 1000
    e2.timestamp = 1000
    await store.append(e1)
    await store.append(e2)
    const result = store.getEventsInRange(0, 2000, 'a')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('a')
  })

  it('should get count by type', async () => {
    await store.append(createEvent('a', {}))
    await store.append(createEvent('a', {}))
    await store.append(createEvent('b', {}))
    expect(store.getCount('a')).toBe(2)
    expect(store.getCount('b')).toBe(1)
    expect(store.getCount()).toBe(3)
  })

  it('should replay events with handler', async () => {
    const handler = jest.fn()
    await store.append(createEvent('a', { v: 1 }))
    await store.append(createEvent('a', { v: 2 }))
    await store.append(createEvent('b', { v: 3 }))
    await store.replay('a', handler)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('should replay all events when type is not provided', async () => {
    const handler = jest.fn()
    await store.append(createEvent('a', {}))
    await store.append(createEvent('b', {}))
    await store.replay(undefined, handler)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('should replay without handler', async () => {
    await store.append(createEvent('a', {}))
    await expect(store.replay('a')).resolves.toBeUndefined()
  })

  it('should clear persisted storage', async () => {
    store.configureStorage('/test/events.log')
    await store.append(createEvent('a', {}))
    await store.clear()
    expect(store.getCount()).toBe(0)
    expect(mockedFs.promises.writeFile).toHaveBeenCalledWith('/test/events.log', '', 'utf-8')
  })

  it('should load events from disk', async () => {
    const data = JSON.stringify({ id: '1', type: 'a', payload: {}, timestamp: 100 }) + '\n' +
                 JSON.stringify({ id: '2', type: 'b', payload: {}, timestamp: 200 })
    mockedFs.promises.readFile.mockResolvedValue(data as never)
    store.configureStorage('/test/events.log')
    const count = await store.loadFromDisk()
    expect(count).toBe(2)
    expect(store.getCount()).toBe(2)
  })

  it('should return 0 when loading from non-existent storage', async () => {
    mockedFs.existsSync.mockReturnValue(false)
    store.configureStorage('/test/events.log')
    const count = await store.loadFromDisk()
    expect(count).toBe(0)
  })
})