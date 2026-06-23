import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PluginHost, VTestPlugin } from './PluginHost'

describe('PluginHost', () => {
  let host: PluginHost

  beforeEach(() => { host = new PluginHost() })
  afterEach(async () => { await host.unloadAll() })

  it('loads a plugin and registers a device driver', async () => {
    const plugin: VTestPlugin = {
      name: 'test-driver', version: '1.0.0',
      activate(context) {
        context.registerDeviceDriver('android', {
          create: async () => ({
            connect: async () => ({ id: '1', name: 'd', type: 'emulator', platform: 'android' }),
            disconnect: async () => {}, install: async () => {}, uninstall: async () => {},
            launch: async () => {}, isConnected: async () => true
          } as any)
        })
      }
    }
    await host.load(plugin)
    expect(host.getDeviceDriver('android')).toBeDefined()
  })

  it('loads multiple plugins independently', async () => {
    const driverPlugin: VTestPlugin = {
      name: 'driver-plugin', version: '1.0.0',
      activate(context) {
        context.registerDeviceDriver('ios', { create: async () => ({} as any) })
      }
    }
    const extractorPlugin: VTestPlugin = {
      name: 'extractor-plugin', version: '1.0.0',
      activate(context) {
        context.registerElementExtractor('ocr', { extract: async () => [] })
      }
    }
    await host.load(driverPlugin)
    await host.load(extractorPlugin)
    expect(host.getDeviceDriver('ios')).toBeDefined()
    expect(host.getElementExtractor('ocr')).toBeDefined()
  })

  it('calls deactivate on unload', async () => {
    const deactivate = vi.fn()
    const plugin: VTestPlugin = { name: 'lifecycle-plugin', version: '1.0.0', activate() {}, deactivate }
    await host.load(plugin)
    await host.unloadAll()
    expect(deactivate).toHaveBeenCalled()
  })

  it('returns undefined for unregistered drivers', () => {
    expect(host.getDeviceDriver('missing')).toBeUndefined()
    expect(host.getElementExtractor('missing')).toBeUndefined()
    expect(host.getReporter('missing')).toBeUndefined()
  })

  it('clears all registrations on unloadAll', async () => {
    const plugin: VTestPlugin = {
      name: 'temp-plugin', version: '1.0.0',
      activate(context) {
        context.registerDeviceDriver('temp', { create: async () => ({} as any) })
      }
    }
    await host.load(plugin)
    expect(host.getDeviceDriver('temp')).toBeDefined()
    await host.unloadAll()
    expect(host.getDeviceDriver('temp')).toBeUndefined()
  })
})
