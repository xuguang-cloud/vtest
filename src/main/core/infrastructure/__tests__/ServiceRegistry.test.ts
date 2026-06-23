import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { ServiceRegistry } from '../service/ServiceRegistry'

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry

  beforeEach(() => {
    registry = ServiceRegistry.getInstance()
    registry.getAll().forEach(s => registry.unregister(s.name))
  })

  afterEach(() => {
    registry.getAll().forEach(s => registry.unregister(s.name))
  })

  it('should be a singleton', () => {
    expect(ServiceRegistry.getInstance()).toBe(ServiceRegistry.getInstance())
  })

  it('should register and retrieve a service', () => {
    const service = { name: 'svc1' }
    registry.register(service)
    expect(registry.get('svc1')).toBe(service)
  })

  it('should warn when overwriting a registered service', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    registry.register({ name: 'svc1' })
    registry.register({ name: 'svc1' })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'))
    warnSpy.mockRestore()
  })

  it('should return all registered services', () => {
    registry.register({ name: 'a' })
    registry.register({ name: 'b' })
    expect(registry.getAll().map(s => s.name)).toEqual(['a', 'b'])
  })

  it('should unregister a service', () => {
    registry.register({ name: 'svc' })
    expect(registry.unregister('svc')).toBe(true)
    expect(registry.get('svc')).toBeUndefined()
  })

  it('should return false when unregistering unknown service', () => {
    expect(registry.unregister('unknown')).toBe(false)
  })

  it('should start a service', async () => {
    const start = jest.fn().mockResolvedValue(undefined)
    registry.register({ name: 'svc', start })
    await registry.start('svc')
    expect(start).toHaveBeenCalled()
    expect(registry.isRunning('svc')).toBe(true)
  })

  it('should stop a service', async () => {
    const start = jest.fn().mockResolvedValue(undefined)
    const stop = jest.fn().mockResolvedValue(undefined)
    registry.register({ name: 'svc', start, stop })
    await registry.start('svc')
    await registry.stop('svc')
    expect(stop).toHaveBeenCalled()
    expect(registry.isRunning('svc')).toBe(false)
  })

  it('should throw when starting unknown service', async () => {
    await expect(registry.start('unknown')).rejects.toThrow('not found')
  })

  it('should throw when stopping unknown service', async () => {
    await expect(registry.stop('unknown')).rejects.toThrow('not found')
  })

  it('should start all services in dependency order', async () => {
    const order: string[] = []
    const a = {
      name: 'a',
      dependsOn: ['b'],
      start: async () => { order.push('a') }
    }
    const b = {
      name: 'b',
      start: async () => { order.push('b') }
    }
    registry.register(a)
    registry.register(b)
    await registry.startAll()
    expect(order).toEqual(['b', 'a'])
    expect(registry.isRunning('a')).toBe(true)
    expect(registry.isRunning('b')).toBe(true)
  })

  it('should stop all services in reverse dependency order', async () => {
    const order: string[] = []
    const a = {
      name: 'a',
      dependsOn: ['b'],
      start: async () => {},
      stop: async () => { order.push('a') }
    }
    const b = {
      name: 'b',
      start: async () => {},
      stop: async () => { order.push('b') }
    }
    registry.register(a)
    registry.register(b)
    await registry.startAll()
    await registry.stopAll()
    expect(order).toEqual(['a', 'b'])
  })

  it('should detect circular dependencies', () => {
    registry.register({ name: 'a', dependsOn: ['b'] })
    registry.register({ name: 'b', dependsOn: ['a'] })
    expect(() => registry.topologicalSort()).toThrow('Circular dependency')
  })

  it('should throw when dependency is not registered', () => {
    registry.register({ name: 'a', dependsOn: ['missing'] })
    expect(() => registry.topologicalSort()).toThrow('not registered')
  })

  it('should provide counts', () => {
    expect(registry.getRegisteredCount()).toBe(0)
    expect(registry.getActiveCount()).toBe(0)
    registry.register({ name: 'x', start: async () => {} })
    expect(registry.getRegisteredCount()).toBe(1)
  })

  it('should not restart an already running service', async () => {
    const start = jest.fn().mockResolvedValue(undefined)
    registry.register({ name: 'svc', start })
    await registry.start('svc')
    await registry.start('svc')
    expect(start).toHaveBeenCalledTimes(1)
  })
})
