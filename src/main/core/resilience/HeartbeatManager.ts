import { EventEmitter } from 'events'

export interface HeartbeatStatus {
  isAlive: boolean
  lastHeartbeat: number
  consecutiveFailures: number
}

export interface HeartbeatConfig {
  interval: number
  timeout: number
  maxConsecutiveFailures: number
}

export class HeartbeatManager extends EventEmitter {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private status: HeartbeatStatus = {
    isAlive: false,
    lastHeartbeat: 0,
    consecutiveFailures: 0
  }
  private isChecking = false
  private checkCount = 0

  constructor(
    private config: HeartbeatConfig,
    private performHealthCheck: () => Promise<boolean> = async () => true
  ) {
    super()
  }

  start(): void {
    if (this.intervalId) {
      return
    }

    this.status = {
      isAlive: false,
      lastHeartbeat: 0,
      consecutiveFailures: 0
    }

    this.intervalId = setInterval(() => {
      this.check()
    }, this.config.interval)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    this.status.isAlive = false
    this.emit('statusChange', this.status)
  }

  private async check(): Promise<void> {
    if (this.isChecking) {
      return
    }

    this.isChecking = true
    this.checkCount++

    try {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
      }

      this.timeoutId = setTimeout(() => {
        this.handleTimeout()
      }, this.config.timeout)

      await this.performHealthCheck()

      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }

      this.status.isAlive = true
      this.status.lastHeartbeat = Date.now()
      this.status.consecutiveFailures = 0
      this.emit('statusChange', this.status)
      this.emit('heartbeat', this.status)

    } catch (error) {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }

      this.status.isAlive = false
      this.status.consecutiveFailures++
      this.emit('statusChange', this.status)
      this.emit('heartbeat', this.status)

      if (this.status.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        this.emit('failure', this.status)
      }
    } finally {
      this.isChecking = false
    }
  }

  private handleTimeout(): void {
    this.timeoutId = null
    this.status.isAlive = false
    this.status.consecutiveFailures++
    this.emit('statusChange', this.status)
    this.emit('timeout', this.status)

    if (this.status.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.emit('failure', this.status)
    }
  }

  getStatus(): HeartbeatStatus {
    return { ...this.status }
  }

  getCheckCount(): number {
    return this.checkCount
  }
}
