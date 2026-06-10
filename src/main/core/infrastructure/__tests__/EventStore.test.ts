import { EventStore } from '../event/EventStore'
import { createEvent } from '../event/Event'

describe('EventStore', () => {
  let store: EventStore

  beforeEach(() => {
    store = EventStore.getInstance()
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
    expect(typeAEvents.every(e => e.type === 'type.a')).toBe(true)
  })

  it('should return empty array for non-existent type', () => {
    expect(store.getEvents('nonexistent')).toEqual([])
  })

  it('should clear all events', async () => {
    await store.append(createEvent('test', { data: 1 }))
    store.clear()
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
})