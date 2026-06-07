import { mainLogger as logger } from '../logger/Logger'

export class AppLifecycleManager {
  private isDirty: boolean = false

  async onAppReady(): Promise<void> {
    logger.info('App ready, checking for previous crash state...')
    // 实际场景中这里会读取 CheckpointManager 的状态
    this.isDirty = false
  }

  async onAppQuit(): Promise<void> {
    logger.info('App quitting, cleaning up resources...')
    this.isDirty = false
  }

  markDirty(): void {
    this.isDirty = true
  }

  clearDirty(): void {
    this.isDirty = false
  }

  getDirtyState(): boolean {
    return this.isDirty
  }
}