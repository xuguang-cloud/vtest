import { IDeviceConnector } from '../plugin/PluginHost'

export interface InstallOptions {
  reinstall?: boolean
  grantPermissions?: boolean
  timeout?: number
}

export class APKInstaller {
  constructor(private device: IDeviceConnector) {}

  async install(apkPath: string, options: InstallOptions = {}): Promise<void> {
    const start = Date.now()
    const timeout = options.timeout || 120000
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('APK install timeout')), timeout)
      this.device.install(apkPath).then(() => {
        clearTimeout(timer)
        resolve()
      }).catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  async uninstall(packageName: string, options: InstallOptions = {}): Promise<void> {
    const start = Date.now()
    const timeout = options.timeout || 60000
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('APK uninstall timeout')), timeout)
      this.device.uninstall(packageName).then(() => {
        clearTimeout(timer)
        resolve()
      }).catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  async reinstall(apkPath: string, packageName: string, options: InstallOptions = {}): Promise<void> {
    try {
      await this.uninstall(packageName, options)
    } catch (err) {
      // ignore uninstall failure on fresh install
    }
    await this.install(apkPath, options)
  }

  async launch(packageName: string, activity?: string): Promise<void> {
    return this.device.launch(packageName, activity)
  }
}
