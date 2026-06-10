/**
 * ServiceBus — 发布订阅式服务总线
 * 支持服务间松耦合通信，基于主题的发布/订阅模式
 */
export interface BusService {
  name: string
}

export class ServiceBus {
  private static instance: ServiceBus
  private subscribers = new Map<string, Set<Function>>()

  private constructor() {}

  static getInstance(): ServiceBus {
    if (!ServiceBus.instance) {
      ServiceBus.instance = new ServiceBus()
    }
    return ServiceBus.instance
  }

  subscribe(topic: string, handler: Function): void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set())
    }
    this.subscribers.get(topic)!.add(handler)
  }

  unsubscribe(topic: string, handler: Function): void {
    const handlers = this.subscribers.get(topic)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscribers.delete(topic)
      }
    }
  }

  publish(topic: string, data: unknown): void {
    const handlers = this.subscribers.get(topic)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`[ServiceBus] Error in handler for topic "${topic}":`, error)
        }
      })
    }
  }

  async publishAsync(topic: string, data: unknown): Promise<void> {
    const handlers = this.subscribers.get(topic)
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map(async handler => {
          try {
            await handler(data)
          } catch (error) {
            console.error(`[ServiceBus] Async error in handler for topic "${topic}":`, error)
          }
        })
      )
    }
  }

  clearTopic(topic: string): void {
    this.subscribers.delete(topic)
  }

  clearAll(): void {
    this.subscribers.clear()
  }
}