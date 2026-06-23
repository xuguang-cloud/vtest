import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
  StreamProcessor,
  arrayToStream,
  createMapStream,
  createFilterStream,
  createBatchStream
} from '../stream/StreamProcessor'

describe('StreamProcessor', () => {
  it('should process a simple stream', async () => {
    const stream = arrayToStream([1, 2, 3])
    const processor = new StreamProcessor<number, number>(stream)
    const result = await processor.process()
    expect(result).toEqual([1, 2, 3])
  })

  it('should add and count transformers', () => {
    const stream = arrayToStream([1, 2, 3])
    const processor = new StreamProcessor<number, number>(stream)
    const t = createMapStream((x: number) => x * 2)
    processor.addTransformer(t)
    expect(processor.getTransformerCount()).toBe(1)
  })

  it('should clear transformers', () => {
    const stream = arrayToStream([1, 2, 3])
    const processor = new StreamProcessor<number, number>(stream)
    processor.addTransformer(createMapStream((x: number) => x))
    processor.clearTransformers()
    expect(processor.getTransformerCount()).toBe(0)
  })

  it('should chain map transformers', async () => {
    const stream = arrayToStream([1, 2, 3])
    const processor = new StreamProcessor<number, number>(stream)
      .addTransformer(createMapStream((x: number) => x * 2))
    const result = await processor.process()
    expect(result).toEqual([2, 4, 6])
  })

  it('should chain filter transformers', async () => {
    const stream = arrayToStream([1, 2, 3, 4, 5])
    const processor = new StreamProcessor<number, number>(stream)
      .addTransformer(createFilterStream((x: number) => x % 2 === 0))
    const result = await processor.process()
    expect(result).toEqual([2, 4])
  })

  it('should batch items', async () => {
    const stream = arrayToStream([1, 2, 3, 4, 5])
    const processor = new StreamProcessor<number, number[]>(stream)
      .addTransformer(createBatchStream<number>(2))
    const result = await processor.process()
    expect(result).toEqual([[1, 2], [3, 4], [5]])
  })

  it('should combine map, filter, and batch', async () => {
    const stream = arrayToStream([1, 2, 3, 4, 5, 6])
    const processor = new StreamProcessor<number, number[]>(stream)
      .addTransformer(createMapStream((x: number) => x * 2))
      .addTransformer(createFilterStream((x: number) => x > 6))
      .addTransformer(createBatchStream<number>(2))
    const result = await processor.process()
    expect(result).toEqual([[8, 10], [12]])
  })

  it('should pipe to a writable stream', async () => {
    const stream = arrayToStream([1, 2, 3])
    const chunks: number[] = []
    const writer = new WritableStream<number>({
      write(chunk) {
        chunks.push(chunk)
      }
    })
    const processor = new StreamProcessor<number, number>(stream)
      .addTransformer(createMapStream((x: number) => x * 3))
    await processor.processToWriter(writer)
    expect(chunks).toEqual([3, 6, 9])
  })
})

describe('arrayToStream', () => {
  it('should convert an array to a readable stream', async () => {
    const stream = arrayToStream(['a', 'b', 'c'])
    const reader = stream.getReader()
    const results: string[] = []
    let done = false
    while (!done) {
      const { value, done: d } = await reader.read()
      done = d
      if (!done) results.push(value as string)
    }
    expect(results).toEqual(['a', 'b', 'c'])
  })
})
