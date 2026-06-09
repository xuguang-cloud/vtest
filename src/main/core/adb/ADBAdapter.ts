/**
 * ADBAdapter — Real ADB command execution via child_process.spawn.
 * Implements IADBAdapter for TestExecutor integration.
 */
import { spawn, execSync } from 'child_process'
import { IADBAdapter } from './TestExecutor'
import { Logger } from '../logger/Logger'

const logger = Logger.getLogger('adb')

const ADB_PATH = process.env.ADB_PATH || 'adb'
const RETRY_COUNT = 3
const RETRY_DELAY = 1000

async function execAdb(args: string[], timeout = 30000): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      return await new Promise<string>((resolve, reject) => {
        const proc = spawn(ADB_PATH, args, {
          timeout,
          stdio: ['ignore', 'pipe', 'pipe']
        })
        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

        proc.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim())
          } else {
            reject(new Error(`ADB command failed (code ${code}): ${stderr.trim()}`))
          }
        })
        proc.on('error', reject)
      })
    } catch (err: any) {
      lastError = err
      logger.warn(`ADB attempt ${attempt + 1}/${RETRY_COUNT} failed: ${err.message}`)
      if (attempt < RETRY_COUNT - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY))
      }
    }
  }

  throw lastError
}

export class ADBAdapter implements IADBAdapter {
  private deviceId: string

  constructor(deviceId: string = 'emulator-5554') {
    this.deviceId = deviceId
  }

  private adbArgs(...args: string[]): string[] {
    return ['-s', this.deviceId, ...args]
  }

  async tap(resourceId: string): Promise<void> {
    await execAdb(this.adbArgs('shell', 'input', 'tap', resourceId))
  }

  async tapAt(x: number, y: number): Promise<void> {
    await execAdb(this.adbArgs('shell', 'input', 'tap', `${x}`, `${y}`))
  }

  async inputText(text: string): Promise<void> {
    const escaped = text.replace(/ /g, '%s').replace(/[()<>&|;]/g, '\\$&')
    await execAdb(this.adbArgs('shell', 'input', 'text', escaped))
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right' = 'down'): Promise<void> {
    const args = this.adbArgs('shell', 'input', 'swipe')
    switch (direction) {
      case 'up': args.push('500', '500', '500', '200'); break
      case 'down': args.push('500', '200', '500', '500'); break
      case 'left': args.push('500', '500', '200', '500'); break
      case 'right': args.push('200', '500', '500', '500'); break
    }
    await execAdb(args)
  }

  async swipe(
    x1: number, y1: number,
    x2: number, y2: number,
    duration = 300
  ): Promise<void> {
    await execAdb(this.adbArgs(
      'shell', 'input', 'swipe',
      `${x1}`, `${y1}`, `${x2}`, `${y2}`, `${duration}`
    ))
  }

  async pressBack(): Promise<void> {
    await execAdb(this.adbArgs('shell', 'input', 'keyevent', '4'))
  }

  async pressHome(): Promise<void> {
    await execAdb(this.adbArgs('shell', 'input', 'keyevent', '3'))
  }

  async screenshot(): Promise<string> {
    const timestamp = Date.now()
    const remotePath = `/sdcard/vtest_screenshot_${timestamp}.png`
    const localPath = `/tmp/vtest_screenshot_${timestamp}.png`

    await execAdb(this.adbArgs('shell', 'screencap', '-p', remotePath))
    await execAdb(this.adbArgs('pull', remotePath, localPath))
    await execAdb(this.adbArgs('shell', 'rm', remotePath))

    logger.info(`Screenshot saved: ${localPath}`)
    return localPath
  }

  async getLogcat(): Promise<string> {
    return execAdb(this.adbArgs('logcat', '-d', '-v', 'threadtime', 'AndroidRuntime:E', 'System.err:W', '*:S'))
  }

  async dumpUI(): Promise<string> {
    const remotePath = '/sdcard/window_dump.xml'
    await execAdb(this.adbArgs('shell', 'uiautomator', 'dump', '/sdcard/window_dump.xml'))
    return execAdb(this.adbArgs('shell', 'cat', remotePath))
  }

  async installAPK(apkPath: string): Promise<void> {
    await execAdb(this.adbArgs('install', '-r', apkPath), 120000)
    logger.info(`APK installed: ${apkPath}`)
  }

  async uninstallAPK(packageName: string): Promise<void> {
    await execAdb(this.adbArgs('uninstall', packageName))
  }

  async launchApp(packageName: string, activityName?: string): Promise<void> {
    if (activityName) {
      await execAdb(this.adbArgs('shell', 'am', 'start', '-n', `${packageName}/${activityName}`))
    } else {
      await execAdb(this.adbArgs(
        'shell', 'monkey', '-p', packageName,
        '-c', 'android.intent.category.LAUNCHER', '1'
      ))
    }
  }

  async forceStopApp(packageName: string): Promise<void> {
    await execAdb(this.adbArgs('shell', 'am', 'force-stop', packageName))
  }

  async isDeviceConnected(): Promise<boolean> {
    try {
      const output = execSync(`${ADB_PATH} devices`, { timeout: 5000 }).toString()
      return output.includes(this.deviceId)
    } catch {
      return false
    }
  }

  async getDeviceInfo(): Promise<{
    model: string
    androidVersion: string
    apiLevel: number
    screenSize: string
  }> {
    const [model, version, apiLevel, size] = await Promise.all([
      execAdb(this.adbArgs('shell', 'getprop', 'ro.product.model')),
      execAdb(this.adbArgs('shell', 'getprop', 'ro.build.version.release')),
      execAdb(this.adbArgs('shell', 'getprop', 'ro.build.version.sdk')),
      execAdb(this.adbArgs('shell', 'wm', 'size'))
    ])

    return {
      model: model || 'unknown',
      androidVersion: version || 'unknown',
      apiLevel: parseInt(apiLevel) || 0,
      screenSize: size?.replace('Physical size: ', '') || 'unknown'
    }
  }
}