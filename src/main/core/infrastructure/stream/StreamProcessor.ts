/**
 * StreamProcessor — 流式处理器
 * 基于 TransformStream 的链式数据处理管道
 */

export class StreamProcessor<T = unknown, R = unknown> {
  private stream: ReadableStream<T>
  private transformers: TransformStream[] = []

  constructor(stream: ReadableStream<T>) {
    this.stream = stream
  }

  addTransformer(transformer: TransformStream): this {
    this.transformers.push(transformer)
    return this
  }

  async process(): Promise<R[]> {
    let processedStream: ReadableStream = this.stream

    for (const transformer of this.transformers) {
      processedStream = processedStream.pipeThrough(transformer)
    }

    return new Promise((resolve, reject) => {
      const results: R[] = []
      const reader = processedStream.getReader()

      const read = async () => {
        try {
          const { done, value } = await reader.read()
          if (done) {
            resolve(results)
            return
          }
          results.push(value as R)
          read()
        } catch (error) {
          reject(error)
        }
      }

      read()
    })
  }

  async processToWriter(writer: WritableStream<R>): Promise<void> {
    let processedStream: ReadableStream = this.stream

    for (const transformer of this.transformers) {
      processedStream = processedStream.pipeThrough(transformer)
    }

    await processedStream.pipeTo(writer as WritableStream)
  }

  getTransformerCount(): number {
    return this.transformers.length
  }

  clearTransformers(): void {
    this.transformers = []
  }
}

/**
 * 创建可迭代数据源流
 */
export function arrayToStream<T>(data: T[]): ReadableStream<T> {
  return new ReadableStream({
    start(controller) {
      for (const item of data) {
        controller.enqueue(item)
      }
      controller.close()
    }
  })
}

/**
 * Map 变换流 — 对每个元素应用映射函数
 */
export function createMapStream<T, R>(fn: (item: T) => R): TransformStream<T, R> {
  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(fn(chunk))
    }
  })
}

/**
 * Filter 变换流 — 过滤满足条件的元素
 */
export function createFilterStream<T>(predicate: (item: T) => boolean): TransformStream<T, T> {
  return new TransformStream({
    transform(chunk, controller) {
      if (predicate(chunk)) {
        controller.enqueue(chunk)
      }
    }
  })
}

/**
 * Batch 变换流 — 按批次大小聚合元素
 */
export function createBatchStream<T>(batchSize: number): TransformStream<T, T[]> {
  let buffer: T[] = []

  return new TransformStream({
    transform(chunk, controller) {
      buffer.push(chunk)
      if (buffer.length >= batchSize) {
        controller.enqueue([...buffer])
        buffer = []
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue([...buffer])
        buffer = []
      }
    }
  })
}