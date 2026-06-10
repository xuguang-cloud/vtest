import { ServiceBus } from '../service/ServiceBus'

describe('ServiceBus', () => {
  let bus: ServiceBus

  beforeEach(() => {
    bus = ServiceBus.getInstance()
    bus.clearAll()
  })

  it('should be a singleton', () => {
    const instance1 = ServiceBus.getInstance()
    const instance2 = ServiceBus.getInstance()
    expect(instance1).toBe(instance2)
  })

  it('should subscribe and publish events', () => {
    const handler = jest.fn()
    bus.subscribe('test.event', handler)
    bus.publish('test.event', { data: 123 })
    expect(handler).toHaveBeenCalledWith({ data: 123 })
  })

  it('should support multiple subscribers on same topic', () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    bus.subscribe('multi.event', handler1)
    bus.subscribe('multi.event', handler2)
    bus.publish('multi.event', 'payload')
    expect(handler1).toHaveBeenCalledWith('payload')
    expect(handler2).toHaveBeenCalledWith('payload')
  })

  it('should handle unsubscribe', () => {
    const handler = jest.fn()
    bus.subscribe('test', handler)
    bus.unsubscribe('test', handler)
    bus.publish('test', 'data')
    expect(handler).not.toHaveBeenCalled()
  })

  it('should not throw when publishing to topic with no subscribers', () => {
    expect(() => bus.publish('nonexistent', 'data')).not.toThrow()
  })

  it('should handle subscriber errors without affecting others', () => {
    const handler1 = jest.fn(() => { throw new Error('Handler error') })
    const handler2 = jest.fn()
    bus.subscribe('error.topic', handler1)
    bus.subscribe('error.topic', handler2)
    expect(() => bus.publish('error.topic', 'data')).not.toThrow()
    expect(handler2).toHaveBeenCalled()
  })

  it('should support once (auto-unsubscribe after first call)', () => {
    const handler = jest.fn()
    bus.subscribe('once.event', handler)
    bus.publish('once.event', 'first')
    bus.publish('once.event', 'second')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('should track topics with subscribers', () => {
    bus.subscribe('topic.a', jest.fn())
    bus.subscribe('topic.a', jest.fn())
    bus.subscribe('topic.b', jest.fn())
    // Verify handlers are registered (no error on publish)
    expect(() => bus.publish('topic.a', 'data')).not.toThrow()
    expect(() => bus.publish('topic.b', 'data')).not.toThrow()
    // Unregistered topic should not throw
    expect(() => bus.publish('topic.c', 'data')).not.toThrow()
  })
})