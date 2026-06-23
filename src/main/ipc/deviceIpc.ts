import { ipcMain } from 'electron'
import { DeviceManager } from '../core/device/DeviceManager'
import { PluginHost } from '../core/plugin/PluginHost'
import { AVDConnector } from '../core/device/AVDConnector'
import { APKInstaller } from '../core/apk/APKInstaller'

let pluginHost: PluginHost | null = null
let deviceManager: DeviceManager | null = null

export function initDeviceIPC(): void {
  pluginHost = new PluginHost()
  deviceManager = new DeviceManager(pluginHost)
}

export function getDeviceManager(): DeviceManager {
  if (!deviceManager) throw new Error('Device IPC not initialized')
  return deviceManager
}

export function registerDeviceHandlers(): void {
  initDeviceIPC()

  ipcMain.handle('avd:list', async () => {
    const connector = new AVDConnector({ avdName: 'default' })
    return connector.listAVDs()
  })

  ipcMain.handle('avd:start', async (_event, name: string) => {
    const dm = getDeviceManager()
    dm.registerDriver('android-emulator', {
      create: async () => new AVDConnector({ avdName: name, headless: false }) as any
    })
    const device = await dm.connect({ type: 'emulator', platform: 'android', avdName: name })
    return { success: true, deviceId: (await device.connect()).id }
  })

  ipcMain.handle('avd:stop', async () => {
    const dm = getDeviceManager()
    await dm.disconnectAll()
    return { success: true }
  })

  ipcMain.handle('avd:getStatus', async () => {
    const connector = new AVDConnector({ avdName: 'default' })
    return { running: await connector.isConnected() }
  })

  ipcMain.handle('device:install', async (_event, apkPath: string) => {
    const dm = getDeviceManager()
    const device = await dm.connect({ type: 'emulator', platform: 'android', avdName: 'default' })
    const installer = new APKInstaller(device)
    await installer.install(apkPath)
    return { success: true }
  })

  ipcMain.handle('device:uninstall', async (_event, packageName: string) => {
    const dm = getDeviceManager()
    const device = await dm.connect({ type: 'emulator', platform: 'android', avdName: 'default' })
    const installer = new APKInstaller(device)
    await installer.uninstall(packageName)
    return { success: true }
  })

  ipcMain.handle('device:launch', async (_event, packageName: string, activity?: string) => {
    const dm = getDeviceManager()
    const device = await dm.connect({ type: 'emulator', platform: 'android', avdName: 'default' })
    const installer = new APKInstaller(device)
    await installer.launch(packageName, activity)
    return { success: true }
  })
}
