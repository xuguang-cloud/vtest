/**
 * ExplorationServiceAdapter — 探索服务适配器
 * 将现有的 IExplorationService 接入服务总线架构
 * 通过 ServiceBus 实现事件的发布与订阅
 */
import { Service as IService } from './ServiceRegistry'
import { ServiceBus } from './ServiceBus'

export interface ExplorationEvent {
  type: 'start' | 'pause' | 'resume' | 'stop' | 'error' | 'state_change'
  timestamp: number
  data?: unknown
}

export class ExplorationServiceAdapter implements IService {
  name = 'exploration-adapter'
  version = '1.0.0'

  constructor(
    private serviceBus: ServiceBus
  ) {}

  async start(): Promise<void> {
    this.serviceBus.subscribe('exploration.start', this.handleStart.bind(this))
    this.serviceBus.subscribe('exploration.stop', this.handleStop.bind(this))
    this.serviceBus.subscribe('exploration.pause', this.handlePause.bind(this))
    this.serviceBus.subscribe('exploration.resume', this.handleResume.bind(this))
  }

  async stop(): Promise<void> {
    this.serviceBus.clearTopic('exploration.*')
  }

  private async handleStart(data: unknown): Promise<void> {
    const event: ExplorationEvent = {
      type: 'start',
      timestamp: Date.now(),
      data
    }
    await this.serviceBus.publishAsync('exploration.event', event)
  }

  private async handleStop(data: unknown): Promise<void> {
    const event: ExplorationEvent = {
      type: 'stop',
      timestamp: Date.now(),
      data
    }
    await this.serviceBus.publishAsync('exploration.event', event)
  }

  private async handlePause(data: unknown): Promise<void> {
    const event: ExplorationEvent = {
      type: 'pause',
      timestamp: Date.now(),
      data
    }
    await this.serviceBus.publishAsync('exploration.event', event)
  }

  private async handleResume(data: unknown): Promise<void> {
    const event: ExplorationEvent = {
      type: 'resume',
      timestamp: Date.now(),
      data
    }
    await this.serviceBus.publishAsync('exploration.event', event)
  }
}