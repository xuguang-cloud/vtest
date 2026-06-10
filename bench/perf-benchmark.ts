/**
 * VTest Performance Benchmarks
 *
 * Run with: npx ts-node bench/perf-benchmark.ts
 * Or add to package.json scripts: "bench": "ts-node bench/perf-benchmark.ts"
 *
 * Measures throughput and latency for core infrastructure components.
 */

interface BenchmarkResult {
  name: string
  opsPerSecond: number
  avgLatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  samples: number
}

async function measure<T>(
  name: string,
  fn: () => Promise<T> | T,
  iterations: number = 1000
): Promise<BenchmarkResult> {
  const latencies: number[] = []

  // Warmup
  for (let i = 0; i < 100; i++) {
    await fn()
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint()
    await fn()
    const end = process.hrtime.bigint()
    latencies.push(Number(end - start) / 1e6) // ns → ms
  }

  latencies.sort((a, b) => a - b)
  const totalMs = latencies.reduce((a, b) => a + b, 0)
  const avgMs = totalMs / latencies.length
  const p95Ms = latencies[Math.floor(latencies.length * 0.95)]
  const p99Ms = latencies[Math.floor(latencies.length * 0.99)]
  const opsPerSec = Math.round(1000 / avgMs * iterations / 10) * 10

  return {
    name,
    opsPerSecond: opsPerSec,
    avgLatencyMs: Math.round(avgMs * 100) / 100,
    p95LatencyMs: Math.round(p95Ms * 100) / 100,
    p99LatencyMs: Math.round(p99Ms * 100) / 100,
    samples: iterations
  }
}

function formatBenchmark(results: BenchmarkResult[]): string {
  let output = '\n=== VTest Performance Benchmarks ===\n\n'
  output += `${'Name'.padEnd(30)} ${'Ops/s'.padEnd(12)} ${'Avg(ms)'.padEnd(10)} ${'P95(ms)'.padEnd(10)} ${'P99(ms)'.padEnd(10)} ${'Samples'}\n`
  output += `${'─'.repeat(80)}\n`

  for (const r of results) {
    output += `${r.name.padEnd(30)} ${String(r.opsPerSecond).padEnd(12)} ${String(r.avgLatencyMs).padEnd(10)} ${String(r.p95LatencyMs).padEnd(10)} ${String(r.p99LatencyMs).padEnd(10)} ${r.samples}\n`
  }

  output += `\nTested: ${new Date().toISOString()}\n`
  output += `Node: ${process.version}\n`
  output += `Platform: ${process.platform}\n`
  return output
}

async function main(): Promise<void> {
  const results: BenchmarkResult[] = []

  // 1. ServiceBus throughput
  const { ServiceBus } = await import('../src/main/core/infrastructure/service/ServiceBus')
  const bus = ServiceBus.getInstance()
  const handler = () => { /* noop */ }
  bus.subscribe('bench', handler)

  results.push(await measure('ServiceBus.publish', () => {
    bus.publish('bench', { data: 'test' })
  }))
  bus.clearAll()

  // 2. EventStore append throughput
  const { EventStore } = await import('../src/main/core/infrastructure/event/EventStore')
  const { createEvent } = await import('../src/main/core/infrastructure/event/Event')
  const store = EventStore.getInstance()
  store.clear()

  const smallEvent = createEvent('bench.type', { key: 'value' })
  results.push(await measure('EventStore.append', async () => {
    const e = createEvent('bench.type', { key: 'value' })
    await store.append(e)
  }, 500))

  // 3. MetricsCollector recording
  const { MetricsCollector } = await import('../src/main/core/infrastructure/metrics/MetricsCollector')
  const metrics = new MetricsCollector()

  results.push(await measure('MetricsCollector.record', () => {
    metrics.record('bench', Math.random() * 100)
  }))

  results.push(await measure('MetricsCollector.calculateStats', () => {
    metrics.calculateStats('bench', { start: Date.now() - 60000, end: Date.now() })
  }))

  // 4. HealthChecker - single check
  const { HealthChecker } = await import('../src/main/core/infrastructure/health/HealthChecker')
  const hc = new HealthChecker()
  hc.register('pass', async () => true)

  results.push(await measure('HealthChecker.runChecks', async () => {
    await hc.runChecks()
  }))

  // 5. CacheStrategy access tracking
  const { CacheStrategy } = await import('../src/main/core/infrastructure/cache/CacheStrategy')
  const cs = new CacheStrategy()

  results.push(await measure('CacheStrategy.recordAccess', () => {
    cs.recordAccess(`key-${Math.random().toString(36).substring(2, 6)}`)
  }))

  // 6. DataSanitizer
  const { DataSanitizer } = await import(
    '../src/main/core/security/sanitization/DataSanitizer'
  )
  const ds = new DataSanitizer()
  const sensitiveText = 'User email: test@example.com, card: 4111-1111-1111-1111'

  results.push(await measure('DataSanitizer.sanitize', () => {
    ds.sanitize(sensitiveText)
  }))

  // Output results
  console.log(formatBenchmark(results))
}

main().catch(console.error)