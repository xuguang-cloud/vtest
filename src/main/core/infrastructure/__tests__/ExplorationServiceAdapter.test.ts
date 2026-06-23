import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { ExplorationServiceAdapter } from '../service/ExplorationServiceAdapter'
import { ServiceBus } from '../service/ServiceBus'

describe('ExplorationServiceAdapter', () => {
  let bus: ServiceBus
  let adapter: ExplorationServiceAdapter

  beforeEach(() => {
    bus = ServiceBus.getInstance()
    bus.clearAll()
    adapter = new ExplorationServiceAdapter(bus)
  })

  afterEach(() => {
    bus.clearAll()
  })

  it('should have correct name and version', () => {
    expect(adapter.name).toBe('exploration-adapter')
    expect(adapter.version).toBe('1.0.0')
  })

  it('should subscribe to exploration topics on start', async () => {
    const subscribeSpy = jest.spyOn(bus, 'subscribe')
    await adapter.start()
    expect(subscribeSpy).toHaveBeenCalledWith('exploration.start', expect.any(Function))
    expect(subscribeSpy).toHaveBeenCalledWith('exploration.stop', expect.any(Function))
    expect(subscribeSpy).toHaveBeenCalledWith('exploration.pause', expect.any(Function))
    expect(subscribeSpy).toHaveBeenCalledWith('exploration.resume', expect.any(Function))
    subscribeSpy.mockRestore()
  })

  it('should clear exploration topics on stop', async () => {
    const clearTopicSpy = jest.spyOn(bus, 'clearTopic')
    await adapter.stop()
    expect(clearTopicSpy).toHaveBeenCalledWith('exploration.*')
    clearTopicSpy.mockRestore()
  })

  it('should publish start event when exploration.start is triggered', async () => {
    const publishSpy = jest.spyOn(bus, 'publishAsync').mockResolvedValue(undefined)
    await adapter.start()
    bus.publish('exploration.start', { taskId: '1' })
    expect(publishSpy).toHaveBeenCalledWith('exploration.event', expect.objectContaining({
      type: 'start',
      data: { taskId: '1' }
    }))
    publishSpy.mockRestore()
  })

  it('should publish stop event when exploration.stop is triggered', async () => {
    const publishSpy = jest.spyOn(bus, 'publishAsync').mockResolvedValue(undefined)
    await adapter.start()
    bus.publish('exploration.stop', { taskId: '2' })
    expect(publishSpy).toHaveBeenCalledWith('exploration.event', expect.objectContaining({
      type: 'stop',
      data: { taskId: '2' }
    }))
    publishSpy.mockRestore()
  })

  it('should publish pause event when exploration.pause is triggered', async () => {
    const publishSpy = jest.spyOn(bus, 'publishAsync').mockResolvedValue(undefined)
    await adapter.start()
    bus.publish('exploration.pause', { taskId: '3' })
    expect(publishSpy).toHaveBeenCalledWith('exploration.event', expect.objectContaining({
      type: 'pause',
      data: { taskId: '3' }
    }))
    publishSpy.mockRestore()
  })

  it('should publish resume event when exploration.resume is triggered', async () => {
    const publishSpy = jest.spyOn(bus, 'publishAsync').mockResolvedValue(undefined)
    await adapter.start()
    bus.publish('exploration.resume', { taskId: '4' })
    expect(publishSpy).toHaveBeenCalledWith('exploration.event', expect.objectContaining({
      type: 'resume',
      data: { taskId: '4' }
    }))
    publishSpy.mockRestore()
  })

  it('should include a timestamp in published events', async () => {
    const publishSpy = jest.spyOn(bus, 'publishAsync').mockResolvedValue(undefined)
    await adapter.start()
    bus.publish('exploration.start', null)
    const event = publishSpy.mock.calls[0][1] as { timestamp: number }
    expect(event.timestamp).toBeLessThanOrEqual(Date.now())
    publishSpy.mockRestore()
  })
})
