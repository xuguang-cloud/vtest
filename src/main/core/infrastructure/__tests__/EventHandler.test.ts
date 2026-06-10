import { EventHandler } from '../event/EventHandler'

describe('EventHandler', () => {
  let handler: EventHandler

  beforeEach(() => {
    handler = new EventHandler()
  })

  it('should register and trigger handlers', async () => {
    const fn = jest.fn()
    handler.on('test.event', fn)
    await handler.emit('test.event', { data: 1 })
    expect(fn).toHaveBeenCalled()
    const event = fn.mock.calls[0][0]
    expect(event.type).toBe('test.event')
    expect(event.payload).toEqual({ data: 1 })
  })

  it('should handle multiple handlers for same event', async () => {
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    handler.on('multi', fn1)
    handler.on('multi', fn2)
    await handler.emit('multi', 'payload')
    expect(fn1).toHaveBeenCalled()
    expect(fn2).toHaveBeenCalled()
  })

  it('should remove specific handler', async () => {
    const fn = jest.fn()
    handler.on('test', fn)
    handler.off('test', fn)
    await handler.emit('test', {})
    expect(fn).not.toHaveBeenCalled()
  })

  it('should remove all handlers for a type', async () => {
    handler.on('test', jest.fn())
    handler.on('test', jest.fn())
    handler.off('test')
    await handler.emit('test', {})
    expect(handler.getHandlerCount('test')).toBe(0)
  })

  it('should support wildcard handlers', async () => {
    const fn = jest.fn()
    handler.on('*', fn)
    await handler.emit('any.event', {})
    await handler.emit('another.event', {})
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should support once handlers', async () => {
    const fn = jest.fn()
    handler.once('test', fn)
    await handler.emit('test', {})
    await handler.emit('test', {})
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should handle error in one handler without affecting others', async () => {
    const fn1 = jest.fn(() => { throw new Error('handler error') })
    const fn2 = jest.fn()
    handler.on('error.test', fn1)
    handler.on('error.test', fn2)
    await expect(handler.emit('error.test', {})).resolves.not.toThrow()
    expect(fn2).toHaveBeenCalled()
  })

  it('should not throw when emitting to unregistered type', async () => {
    await expect(handler.emit('nonexistent', {})).resolves.not.toThrow()
  })

  it('should remove all handlers', () => {
    handler.on('a', jest.fn())
    handler.on('b', jest.fn())
    handler.on('*', jest.fn())
    handler.removeAll()
    expect(handler.getHandlerCount()).toBe(0)
  })

  it('should return registered event types', () => {
    handler.on('type.a', jest.fn())
    handler.on('type.b', jest.fn())
    const types = handler.getRegisteredTypes()
    expect(types).toContain('type.a')
    expect(types).toContain('type.b')
  })
})