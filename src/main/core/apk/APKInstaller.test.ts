import { describe, it, expect, vi } from 'vitest'
import { APKInstaller } from './APKInstaller'
import { IDeviceConnector } from '../plugin/PluginHost'

describe('APKInstaller', () => {
  const createDevice = (overrides: Partial<IDeviceConnector> = {}): IDeviceConnector => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    install: vi.fn(),
    uninstall: vi.fn(),
    launch: vi.fn(),
    isConnected: vi.fn(),
    ...overrides
  })

  it('installs APK successfully', async () => {
    const device = createDevice({
      install: vi.fn().mockResolvedValue(undefined)
    })
    const installer = new APKInstaller(device)
    await installer.install('/path/app.apk')
    expect(device.install).toHaveBeenCalledWith('/path/app.apk')
  })

  it('rejects when install times out', async () => {
    const device = createDevice({
      install: vi.fn().mockImplementation(() => new Promise(() => {}))
    })
    const installer = new APKInstaller(device)
    await expect(installer.install('/path/app.apk', { timeout: 10 })).rejects.toThrow('APK install timeout')
  })

  it('uninstalls package successfully', async () => {
    const device = createDevice({
      uninstall: vi.fn().mockResolvedValue(undefined)
    })
    const installer = new APKInstaller(device)
    await installer.uninstall('com.example')
    expect(device.uninstall).toHaveBeenCalledWith('com.example')
  })

  it('rejects when uninstall times out', async () => {
    const device = createDevice({
      uninstall: vi.fn().mockImplementation(() => new Promise(() => {}))
    })
    const installer = new APKInstaller(device)
    await expect(installer.uninstall('com.example', { timeout: 10 })).rejects.toThrow('APK uninstall timeout')
  })

  it('reinstalls by uninstalling then installing', async () => {
    const device = createDevice({
      uninstall: vi.fn().mockResolvedValue(undefined),
      install: vi.fn().mockResolvedValue(undefined)
    })
    const installer = new APKInstaller(device)
    await installer.reinstall('/path/app.apk', 'com.example')
    expect(device.uninstall).toHaveBeenCalledWith('com.example')
    expect(device.install).toHaveBeenCalledWith('/path/app.apk')
  })

  it('reinstall succeeds even if uninstall fails', async () => {
    const device = createDevice({
      uninstall: vi.fn().mockRejectedValue(new Error('not installed')),
      install: vi.fn().mockResolvedValue(undefined)
    })
    const installer = new APKInstaller(device)
    await installer.reinstall('/path/app.apk', 'com.example')
    expect(device.install).toHaveBeenCalledWith('/path/app.apk')
  })

  it('launches the app', async () => {
    const device = createDevice({
      launch: vi.fn().mockResolvedValue(undefined)
    })
    const installer = new APKInstaller(device)
    await installer.launch('com.example', '.MainActivity')
    expect(device.launch).toHaveBeenCalledWith('com.example', '.MainActivity')
  })
})
