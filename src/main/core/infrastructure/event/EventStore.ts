/**
 * EventStore — 事件存储
 * 提供事件的持久化存储、查询和重放能力
 */
import { Event } from './Event'
import * as fs from 'fs'
import * as path from 'path'

export class EventStore {
  private static instance: EventStore
  private events: Event[] = []
  private storagePath: string | null = null

  private constructor() {}

  static getInstance(): EventStore {
    if (!EventStore.instance) {
      EventStore.instance = new EventStore()
    }
    return EventStore.instance
  }

  configureStorage(storagePath: string): void {
    this.storagePath = storagePath
    const dir = path.dirname(storagePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  async append(event: Event): Promise<void> {
    this.events.push(event)
    if (this.storagePath) {
      await this.persistEvent(event)
    }
  }

  private async persistEvent(event: Event): Promise<void> {
    const line = JSON.stringify(event) + '\n'
    await fs.promises.appendFile(this.storagePath!, line, 'utf-8')
  }

  getEvents(type?: string): Event[] {
    if (!type) return [...this.events]
    return this.events.filter(e => e.type === type)
  }

  getEventsInRange(start: number, end: number, type?: string): Event[] {
    return this.events.filter(e => {
      if (type && e.type !== type) return false
      return e.timestamp >= start && e.timestamp <= end
    })
  }

  getCount(type?: string): number {
    if (!type) return this.events.length
    return this.events.filter(e => e.type === type).length
  }

  async replay(type?: string, handler?: (event: Event) => void | Promise<void>): Promise<void> {
    const targetEvents = type ? this.events.filter(e => e.type === type) : [...this.events]
    for (const event of targetEvents) {
      if (handler) {
        await handler(event)
      }
    }
  }

  async clear(): Promise<void> {
    this.events = []
    if (this.storagePath && fs.existsSync(this.storagePath)) {
      await fs.promises.writeFile(this.storagePath, '', 'utf-8')
    }
  }

  async loadFromDisk(): Promise<number> {
    if (!this.storagePath || !fs.existsSync(this.storagePath)) return 0
    const content = await fs.promises.readFile(this.storagePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    this.events = lines.map(line => JSON.parse(line))
    return this.events.length
  }
}