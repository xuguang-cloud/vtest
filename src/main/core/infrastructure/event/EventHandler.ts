/**
 * EventHandler — 事件处理器
 * 管理事件的订阅、分发和生命周期
 */
import { Event, createEvent } from './Event'
import { EventStore } from './EventStore'

type HandlerFunction = (event: Event) => void | Promise<void>

export class EventHandler {
  private handlers = new Map<string, HandlerFunction[]>()
  private eventStore: EventStore
  private wildcardHandlers: HandlerFunction[] = []

  constructor() {
    this.eventStore = EventStore.getInstance()
  }

  on(eventType: string, handler: HandlerFunction): void {
    if (eventType === '*') {
      this.wildcardHandlers.push(handler)
      return
    }
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }
    this.handlers.get(eventType)!.push(handler)
  }

  off(eventType: string, handler?: HandlerFunction): void {
    if (!handler) {
      this.handlers.delete(eventType)
      return
    }
    const handlers = this.handlers.get(eventType)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx !== -1) handlers.splice(idx, 1)
    }
  }

  once(eventType: string, handler: HandlerFunction): void {
    const wrapper: HandlerFunction = async (event: Event) => {
      await handler(event)
      this.off(eventType, wrapper)
    }
    this.on(eventType, wrapper)
  }

  async emit(type: string, payload: unknown, metadata?: Record<string, unknown>): Promise<void> {
    const event = createEvent(type, payload, metadata)

    // 持久化
    await this.eventStore.append(event)

    // 触发特定类型处理器
    const handlers = this.handlers.get(type)
    const promises: Promise<void>[] = []

    if (handlers) {
      for (const handler of handlers) {
        promises.push((async () => { await handler(event) })())
      }
    }

    // 触发通配符处理器
    for (const handler of this.wildcardHandlers) {
      promises.push((async () => { await handler(event) })())
    }

    await Promise.allSettled(promises)
  }

  removeAll(): void {
    this.handlers.clear()
    this.wildcardHandlers = []
  }

  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return (this.handlers.get(eventType) || []).length
    }
    return this.wildcardHandlers.length + 
      Array.from(this.handlers.values()).reduce((sum, h) => sum + h.length, 0)
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys())
  }
}