export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  startTime: number
  tags: Record<string, string | number | boolean>
}

export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  tags: Record<string, string | number | boolean>
  events: Array<{
    name: string
    timestamp: number
    attributes?: Record<string, unknown>
  }>
}

export class TraceManager {
  private traces: Map<string, Span[]> = new Map()

  generateTraceId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
  }

  generateSpanId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  createSpan(
    traceId: string,
    name: string,
    parentSpanId?: string
  ): Span {
    const span: Span = {
      traceId,
      spanId: this.generateSpanId(),
      parentSpanId,
      name,
      startTime: Date.now(),
      tags: {},
      events: []
    }

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, [])
    }
    this.traces.get(traceId)!.push(span)

    return span
  }

  endSpan(span: Span): void {
    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
  }

  addTag(span: Span, key: string, value: string | number | boolean): void {
    span.tags[key] = value
  }

  addEvent(span: Span, name: string, attributes?: Record<string, unknown>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes
    })
  }

  getTrace(traceId: string): Span[] | undefined {
    return this.traces.get(traceId)
  }

  clearTrace(traceId: string): void {
    this.traces.delete(traceId)
  }

  getAllTraces(): Map<string, Span[]> {
    return new Map(this.traces)
  }

  createContext(): TraceContext {
    const traceId = this.generateTraceId()
    return {
      traceId,
      spanId: this.generateSpanId(),
      startTime: Date.now(),
      tags: {}
    }
  }
}

export const traceManager = new TraceManager()
