/**
 * Event — 事件模型定义
 * 事件驱动架构的基础类型
 */

export interface Event {
  id: string
  type: string
  timestamp: number
  payload: unknown
  metadata?: Record<string, unknown>
}

export interface EventHandlerCallback<T = unknown> {
  (event: Event & { payload: T }): void | Promise<void>
}

export function createEvent(type: string, payload: unknown, metadata?: Record<string, unknown>): Event {
  return {
    id: generateEventId(),
    type,
    timestamp: Date.now(),
    payload,
    metadata
  }
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}