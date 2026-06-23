import { describe, it, expect, vi } from 'vitest'
import { DeviceManager } from './DeviceManager'
import { PluginHost } from '../plugin/PluginHost'

describe('DeviceManager', () => {
  it('connects to a registered driver', async () => {
    const pluginHost = new PluginHost()
    const manager = new DeviceManager(pluginHost)
    const mockDevice = {
      connect: vi.fn().mockResolvedValue({ id: '1', name: 'd', type: 'emulator', platform: 'android' }),
      disconnect: vi.fn(), install: vi.fn(), uninstall: vi.fn(), launch: vi.fn(),
      isConnected: vi.fn().mockResolvedValue(true)
    }
    manager.registerDriver('android-emulator', { create: async () => mockDevice as any })
    const device = await manager.connect({ type: 'emulator', platform: 'android', avdName: 'Pixel' })
    expect(device).toBe(mockDevice)
    expect(mockDevice.connect).toHaveBeenCalled()
  })

  it('returns existing session on duplicate connect', async () => {
    const pluginHost = new PluginHost()
    const manager = new DeviceManager(pluginHost)
    const mockDevice = {
      connect: vi.fn().mockResolvedValue({ id: '1', name: 'd', type: 'emulator', platform: 'android' }),
      disconnect: vi.fn(), install: vi.fn(), uninstall: vi.fn(), launch: vi.fn(),
      isConnected: vi.fn().mockResolvedValue(true)
    }
    manager.registerDriver('android-emulator', { create: async () => mockDevice as any })
    const first = await manager.connect({ type: 'emulator', platform: 'android', avdName: 'Pixel' })
    const second = await manager.connect({ type: 'emulator', platform: 'android', avdName: 'Pixel' })
    expect(first).toBe(second)
    expect(mockDevice.connect).toHaveBeenCalledTimes(1)
  })

  it('throws when no driver is registered', async () => {
    const pluginHost = new PluginHost()
    const manager = new DeviceManager(pluginHost)
    await expect(manager.connect({ type: 'real', platform: 'ios' })).rejects.toThrow('No driver registered')
  })

  it('disconnects a device', async () => {
    const pluginHost = new PluginHost()
    const manager = new DeviceManager(pluginHost)
    const mockDevice = {
      connect: vi.fn().mockResolvedValue({ id: '1', name: 'd', type: 'emulator', platform: 'android' }),
      disconnect: vi.fn().mockResolvedValue(undefined), install: vi.fn(), uninstall: vi.fn(),
      launch: vi.fn(), isConnected: vi.fn().mockResolvedValue(true)
    }
    manager.registerDriver('android-emulator', { create: async () => mockDevice as any })
    await manager.connect({ type: 'emulator', platform: 'android', avdName: 'Pixel' })
    await manager.disconnect({ type: 'emulator', platform: 'android', avdName: 'Pixel' })
    expect(mockDevice.disconnect).toHaveBeenCalled()
  })

  it('disconnects all devices', async () => {
    const pluginHost = new PluginHost()
    const manager = new DeviceManager(pluginHost)
    let disconnected = 0
    const createMockDevice = () => ({
      connect: vi.fn().mockResolvedValue({ id: '1', name: 'd', type: 'emulator', platform: 'android' }),
      disconnect: vi.fn().mockImplementation(() => { disconnected++; return Promise.resolve() }),
      install: vi.fn(), uninstall: vi.fn(), launch: vi.fn(), isConnected: vi.fn().mockResolvedValue(true)
    })
    manager.registerDriver('android-emulator', { create: async () => createMockDevice() as any })
    await manager.connect({ type: 'emulator', platform: 'android', avdName: 'Pixel1' })
    await manager.connect({ type: 'emulator', platform: 'android', avdName: 'Pixel2' })
    await manager.disconnectAll()
    expect(disconnected).toBe(2)
  })
})
