import { spawn, ChildProcess } from 'child_process'
import { IDeviceConnector, DeviceSession } from '../plugin/PluginHost'

export interface AVDOptions {
  avdName: string
  sdkRoot?: string
  headless?: boolean
}

export interface AVDInfo {
  name: string
  target: string
  apiLevel: number
  abi: string
}

export class AVDConnector implements IDeviceConnector {
  private process: ChildProcess | null = null
  private session: DeviceSession | null = null

  constructor(private options: AVDOptions) {}

  async listAVDs(): Promise<AVDInfo[]> {
    const emulatorPath = this.getEmulatorPath()
    return new Promise((resolve, reject) => {
      const proc = spawn(emulatorPath, ['-list-avds'], { shell: true })
      let stdout = ''
      proc.stdout?.on('data', (data) => { stdout += data.toString() })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`list-avds failed with code ${code}`))
        const lines = stdout.split('\n').map(s => s.trim()).filter(Boolean)
        const infos = lines.map(name => ({ name, target: 'unknown', apiLevel: 0, abi: 'unknown' }))
        resolve(infos)
      })
    })
  }

  async createAVD(name: string, packageId: string): Promise<void> {
    const avdmanagerPath = this.getAvdManagerPath()
    return new Promise((resolve, reject) => {
      const proc = spawn(avdmanagerPath, ['create', 'avd', '-n', name, '-k', packageId, '--device', 'pixel'], { shell: true })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`create avd failed with code ${code}`))
        resolve()
      })
    })
  }

  async connect(): Promise<DeviceSession> {
    if (this.session) return this.session
    const emulatorPath = this.getEmulatorPath()
    const args = [`@${this.options.avdName}`]
    if (this.options.headless) args.push('-no-window')
    this.process = spawn(emulatorPath, args, { shell: true, detached: false })
    this.process.on('error', (err) => { throw err })
    await this.waitForBoot()
    this.session = {
      id: this.options.avdName,
      name: this.options.avdName,
      type: 'emulator',
      platform: 'android'
    }
    return this.session
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.session = null
  }

  async install(appPath: string): Promise<void> {
    const adbPath = this.getAdbPath()
    return this.runCommand(adbPath, ['-s', `emulator-5554`, 'install', appPath])
  }

  async uninstall(packageName: string): Promise<void> {
    const adbPath = this.getAdbPath()
    return this.runCommand(adbPath, ['-s', `emulator-5554`, 'uninstall', packageName])
  }

  async launch(packageName: string, activity?: string): Promise<void> {
    const adbPath = this.getAdbPath()
    const component = activity ? `${packageName}/${activity}` : `${packageName}/.MainActivity`
    return this.runCommand(adbPath, ['-s', `emulator-5554`, 'shell', 'am', 'start', '-n', component])
  }

  async isConnected(): Promise<boolean> {
    return this.session !== null
  }

  private waitForBoot(): Promise<void> {
    const adbPath = this.getAdbPath()
    return new Promise((resolve, reject) => {
      const check = () => {
        const proc = spawn(adbPath, ['-s', `emulator-5554`, 'shell', 'getprop', 'sys.boot_completed'], { shell: true })
        let stdout = ''
        proc.stdout?.on('data', (data) => { stdout += data.toString() })
        proc.on('error', reject)
        proc.on('close', (code) => {
          if (code === 0 && stdout.trim() === '1') return resolve()
          setTimeout(check, 1000)
        })
      }
      setTimeout(check, 3000)
    })
  }

  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { shell: true })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`command failed with code ${code}`))
        resolve()
      })
    })
  }

  private getSdkRoot(): string {
    return this.options.sdkRoot || process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '/opt/android-sdk'
  }

  private getEmulatorPath(): string {
    return `${this.getSdkRoot()}/emulator/emulator`
  }

  private getAvdManagerPath(): string {
    return `${this.getSdkRoot()}/cmdline-tools/latest/bin/avdmanager`
  }

  private getAdbPath(): string {
    return `${this.getSdkRoot()}/platform-tools/adb`
  }
}
