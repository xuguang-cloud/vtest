import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { AVDConfig, AVDStatus } from '../contracts/avd.contract'

export { AVDConfig, AVDStatus }

export class AVDManager extends EventEmitter {
  private avdProcess: ChildProcess | null = null
  private status: AVDStatus = { name: '', state: 'stopped' }

  async listAVDs(): Promise<string[]> {
    return new Promise((resolve) => {
      const process = spawn('emulator', ['-list-avds'])
      let output = ''
      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      process.on('close', () => {
        resolve(output.trim().split('\n').filter(Boolean))
      })
    })
  }

  async startAVD(avdName: string, config?: Partial<AVDConfig>): Promise<void> {
    if (this.status.state === 'running') {
      throw new Error('AVD is already running')
    }

    this.status = { name: avdName, state: 'starting' }
    this.emit('statusChange', this.status)

    const args: string[] = [
      `-avd`, avdName,
      `-no-snapshot`,
      `-no-boot-anim`,
      `-gpu`, `auto`,
      `-no-audio`
    ]

    if (config?.screenSize) {
      args.push(`-screen-size`, config.screenSize)
    }

    this.avdProcess = spawn('emulator', args)

    this.avdProcess.on('error', (err) => {
      this.status = { name: avdName, state: 'error', error: err.message }
      this.emit('statusChange', this.status)
    })

    this.avdProcess.on('close', (code) => {
      if (code === 0) {
        this.status = { name: avdName, state: 'stopped' }
      } else {
        this.status = { name: avdName, state: 'error', error: `Exit code: ${code}` }
      }
      this.emit('statusChange', this.status)
    })

    this.avdProcess.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes('boot completed')) {
        this.status = { name: avdName, state: 'running', pid: this.avdProcess?.pid }
        this.emit('statusChange', this.status)
      }
    })
  }

  async stopAVD(): Promise<void> {
    if (!this.avdProcess) {
      return
    }

    return new Promise((resolve) => {
      this.avdProcess?.kill('SIGTERM')
      const timeout = setTimeout(() => {
        this.avdProcess?.kill('SIGKILL')
        resolve()
      }, 5000)

      this.avdProcess?.on('close', () => {
        clearTimeout(timeout)
        this.status = { name: this.status.name, state: 'stopped' }
        this.emit('statusChange', this.status)
        resolve()
      })
    })
  }

  getStatus(): AVDStatus {
    return { ...this.status }
  }

  async rotateScreen(orientation: 'portrait' | 'landscape'): Promise<void> {
    if (this.status.state !== 'running') {
      throw new Error('AVD is not running')
    }

    const command = orientation === 'portrait' ? 'rotate 0' : 'rotate 90'
    await this.executeAdbCommand(`shell input ${command}`)
  }

  private async executeAdbCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('adb', command.split(' '))
      let output = ''
      let error = ''

      process.stdout.on('data', (data) => {
        output += data.toString()
      })

      process.stderr.on('data', (data) => {
        error += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim())
        } else {
          reject(new Error(error || `Command failed with exit code ${code}`))
        }
      })
    })
  }
}
