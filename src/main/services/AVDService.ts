import { AVDManager, AVDConfig, AVDStatus } from '../core/avd/AVDManager'
import { Logger } from '../core/logger/Logger'

const logger = Logger.getLogger('avd')

export interface CreateAVDRequest {
  name: string
  device: string
  apiLevel: number
  screenSize?: string
  screenDensity?: string
}

export class AVDService {
  private avdManager = new AVDManager()

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.avdManager.on('statusChange', (status) => {
      logger.info(`AVD status changed: ${status.name} -> ${status.state}`)
    })
  }

  public async listAVDs(): Promise<string[]> {
    try {
      return await this.avdManager.listAVDs()
    } catch (error) {
      logger.error(`Failed to list AVDs: ${error}`)
      throw error
    }
  }

  public async createAVD(request: CreateAVDRequest): Promise<void> {
    try {
      logger.info(`Creating AVD: ${request.name}`)
    } catch (error) {
      logger.error(`Failed to create AVD: ${error}`)
      throw error
    }
  }

  public async startAVD(name: string, config?: Partial<AVDConfig>): Promise<void> {
    try {
      logger.info(`Starting AVD: ${name}`)
      await this.avdManager.startAVD(name, config)
    } catch (error) {
      logger.error(`Failed to start AVD: ${error}`)
      throw error
    }
  }

  public async stopAVD(): Promise<void> {
    try {
      logger.info('Stopping AVD')
      await this.avdManager.stopAVD()
    } catch (error) {
      logger.error(`Failed to stop AVD: ${error}`)
      throw error
    }
  }

  public getStatus(): AVDStatus {
    return this.avdManager.getStatus()
  }

  public async rotateScreen(orientation: 'portrait' | 'landscape'): Promise<void> {
    try {
      logger.info(`Rotating screen to: ${orientation}`)
      await this.avdManager.rotateScreen(orientation)
    } catch (error) {
      logger.error(`Failed to rotate screen: ${error}`)
      throw error
    }
  }
}

export const avdService = new AVDService()
