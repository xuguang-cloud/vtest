import { EventEmitter } from 'events'

export interface UIState {
  timestamp: number
  activity: string
  uiTreeHash: string
}

export interface UIFreezeConfig {
  checkInterval: number
  freezeThreshold: number
  warningThreshold: number
}

export interface UIFreezeStatus {
  isFrozen: boolean
  isWarning: boolean
  lastStateChange: number
  consecutiveSameState: number
}

export class UIFreezeDetector extends EventEmitter {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private status: UIFreezeStatus = {
    isFrozen: false,
    isWarning: false,
    lastStateChange: Date.now(),
    consecutiveSameState: 0
  }
  private lastHash: string = ''

  constructor(
    private config: UIFreezeConfig,
    private getUiHash: () => Promise<string> = async () => ''
  ) {
    super()
  }

  start(): void {
    if (this.intervalId) {
      return
    }

    this.status = {
      isFrozen: false,
      isWarning: false,
      lastStateChange: Date.now(),
      consecutiveSameState: 0
    }
    this.lastHash = ''

    this.intervalId = setInterval(() => {
      this.detect()
    }, this.config.checkInterval)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.status.isFrozen = false
    this.status.isWarning = false
    this.emit('statusChange', this.status)
  }

  private async detect(): Promise<void> {
    try {
      const currentHash = await this.getUiHash()

      if (!currentHash) {
        return
      }

      if (currentHash !== this.lastHash) {
        this.lastHash = currentHash
        this.status.consecutiveSameState = 0
        this.status.lastStateChange = Date.now()
        this.status.isFrozen = false
        this.status.isWarning = false
        this.emit('statusChange', this.status)
        this.emit('unfreeze', this.status)
      } else {
        this.status.consecutiveSameState++
        const timeSinceLastChange = Date.now() - this.status.lastStateChange

        if (timeSinceLastChange >= this.config.freezeThreshold) {
          if (!this.status.isFrozen) {
            this.status.isFrozen = true
            this.status.isWarning = false
            this.emit('freeze', this.status)
            this.emit('statusChange', this.status)
          }
        } else if (timeSinceLastChange >= this.config.warningThreshold) {
          if (!this.status.isWarning) {
            this.status.isWarning = true
            this.emit('warning', this.status)
            this.emit('statusChange', this.status)
          }
        }
      }
    } catch (error) {
      this.emit('error', error)
    }
  }

  getStatus(): UIFreezeStatus {
    return { ...this.status }
  }

  reset(): void {
    this.status = {
      isFrozen: false,
      isWarning: false,
      lastStateChange: Date.now(),
      consecutiveSameState: 0
    }
    this.lastHash = ''
    this.emit('statusChange', this.status)
  }
}
