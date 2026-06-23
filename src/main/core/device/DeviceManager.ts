import { IDeviceConnector, DriverFactory, PluginHost } from '../plugin/PluginHost'

export interface DeviceOptions {
  type: 'emulator' | 'real'
  platform: 'android' | 'ios' | 'flutter' | 'harmonyos'
  id?: string
  avdName?: string
}

export class DeviceManager {
  private providers = new Map<string, DriverFactory>()
  private sessions = new Map<string, IDeviceConnector>()

  constructor(private pluginHost: PluginHost) {}

  async connect(options: DeviceOptions): Promise<IDeviceConnector> {
    const key = `${options.platform}-${options.type}-${options.id || options.avdName}`
    if (this.sessions.has(key)) {
      return this.sessions.get(key)!
    }

    const factory = this.providers.get(`${options.platform}-${options.type}`)
      || this.pluginHost.getDeviceDriver(`${options.platform}-${options.type}`)

    if (!factory) {
      throw new Error(`No driver registered for ${options.platform}-${options.type}`)
    }

    const device = await factory.create({
      id: options.id,
      avdName: options.avdName
    })

    await device.connect()
    this.sessions.set(key, device)
    return device
  }

  async disconnect(options: DeviceOptions): Promise<void> {
    const key = `${options.platform}-${options.type}-${options.id || options.avdName}`
    const device = this.sessions.get(key)
    if (device) {
      await device.disconnect()
      this.sessions.delete(key)
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [, device] of this.sessions) {
      await device.disconnect()
    }
    this.sessions.clear()
  }

  registerDriver(type: string, factory: DriverFactory): void {
    this.providers.set(type, factory)
  }
}
