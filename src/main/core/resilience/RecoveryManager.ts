import { EventEmitter } from 'events'
import { HeartbeatManager, HeartbeatConfig } from './HeartbeatManager'
import { AsyncMutex } from './AsyncMutex'
import { AVDManager } from '../avd/AVDManager'
import { CheckpointManager } from './CheckpointManager'

export interface Checkpoint {
  id: string
  timestamp: number
  activity: string
  uiTreeHash: string
  path: string[]
  screenshotPath?: string
}

export interface RecoveryStatus {
  isRecovering: boolean
  lastRecoveryTime: number
  recoveryAttempts: number
  currentCheckpoint?: Checkpoint
}

export class RecoveryManager extends EventEmitter {
  private heartbeatManager: HeartbeatManager
  private checkpointManager: CheckpointManager | null = null
  private recoveryMutex = new AsyncMutex()
  private recoveryStatus: RecoveryStatus = {
    isRecovering: false,
    lastRecoveryTime: 0,
    recoveryAttempts: 0
  }
  private checkpoints: Checkpoint[] = []
  private maxCheckpoints = 100

  constructor(
    private avdManager: AVDManager,
    heartbeatConfig: HeartbeatConfig,
    checkpointManager?: CheckpointManager
  ) {
    super()
    this.heartbeatManager = new HeartbeatManager(heartbeatConfig)
    if (checkpointManager) {
      this.checkpointManager = checkpointManager
    }
    this.setupHeartbeatHandlers()
  }

  private setupHeartbeatHandlers(): void {
    this.heartbeatManager.on('failure', () => {
      this.triggerRecovery()
    })

    this.heartbeatManager.on('timeout', () => {
      this.emit('warning', 'Heartbeat timeout detected')
    })
  }

  startMonitoring(): void {
    this.heartbeatManager.start()
  }

  stopMonitoring(): void {
    this.heartbeatManager.stop()
  }

  async triggerRecovery(): Promise<void> {
    if (this.recoveryMutex.isLocked()) {
      return
    }

    await this.recoveryMutex.acquire()

    this.recoveryStatus.isRecovering = true
    this.recoveryStatus.recoveryAttempts++
    this.recoveryStatus.lastRecoveryTime = Date.now()
    this.emit('recoveryStart', this.recoveryStatus)

    try {
      // Prefer database checkpoint (CheckpointManager) over in-memory checkpoint
      const lastCheckpoint = await this.getBestCheckpoint()

      if (lastCheckpoint) {
        this.recoveryStatus.currentCheckpoint = lastCheckpoint
        this.emit('usingCheckpoint', lastCheckpoint)

        await this.avdManager.stopAVD()
        await new Promise(resolve => setTimeout(resolve, 2000))
        await this.avdManager.startAVD(lastCheckpoint.activity)

        this.emit('recoverySuccess', {
          checkpoint: lastCheckpoint,
          attempts: this.recoveryStatus.recoveryAttempts
        })
      } else {
        await this.avdManager.stopAVD()
        await new Promise(resolve => setTimeout(resolve, 2000))
        await this.avdManager.startAVD('default')

        this.emit('recoverySuccess', {
          checkpoint: null,
          attempts: this.recoveryStatus.recoveryAttempts
        })
      }
    } catch (error) {
      this.emit('recoveryFailed', {
        error,
        attempts: this.recoveryStatus.recoveryAttempts
      })
    } finally {
      this.recoveryStatus.isRecovering = false
      this.emit('recoveryEnd', this.recoveryStatus)
      this.recoveryMutex.release()
    }
  }

  private async getBestCheckpoint(): Promise<Checkpoint | undefined> {
    // First try database checkpoint (persistent, survives crashes)
    if (this.checkpointManager) {
      try {
        const dbCheckpoint = await this.checkpointManager.getLatestCheckpoint('current')
        if (dbCheckpoint) {
          return {
            id: `db-${dbCheckpoint.stepIndex}`,
            timestamp: Date.now(),
            activity: dbCheckpoint.activityName,
            uiTreeHash: dbCheckpoint.uiTreeHash,
            path: dbCheckpoint.dfsStack
          }
        }
      } catch {
        // Database read failed, fall through to in-memory
      }
    }

    // Fall back to in-memory checkpoint
    return this.getLastValidCheckpoint()
  }

  saveCheckpoint(checkpoint: Omit<Checkpoint, 'id' | 'timestamp'>): Checkpoint {
    const newCheckpoint: Checkpoint = {
      ...checkpoint,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    this.checkpoints.unshift(newCheckpoint)

    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.pop()
    }

    this.emit('checkpointSaved', newCheckpoint)
    return newCheckpoint
  }

  getLastValidCheckpoint(): Checkpoint | undefined {
    return this.checkpoints[0]
  }

  getAllCheckpoints(): Checkpoint[] {
    return [...this.checkpoints]
  }

  clearCheckpoints(): void {
    this.checkpoints = []
    this.emit('checkpointsCleared')
  }

  getRecoveryStatus(): RecoveryStatus {
    return { ...this.recoveryStatus }
  }
}