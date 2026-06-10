# VTest Architecture

## Layer Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     RENDERER LAYER                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │ App (React)  │  │ Exploration      │  │ ProjectForm      │    │
│  │              │  │ Monitor           │  │ ProjectList      │    │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘    │
│         │                   │                      │              │
│  ┌──────┴───────────────────┴──────────────────────┴──────────┐  │
│  │  ExplorationContext (useReducer)  │ useIPC │ useExploEngine│  │
│  └─────────────────────────────────────────────────────────────┘  │
│         │                                                         │
│         │ contextBridge.exposeInMainWorld('vtest', api)            │
│         │ IPC (channel whitelist + rate limit)                    │
├─────────┼─────────────────────────────────────────────────────────┤
│         ▼                                                         │
│                     SERVICE LAYER                                 │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ IPCService   │  │ Exploration  │  │ ProjectService         │  │
│  │ (RateLimited)│  │ Service      │  │ ApkService             │  │
│  ├──────────────┤  ├──────────────┤  │ TestCaseService        │  │
│  │ stateMachine │  │ ICacheStore  │  │ TestExecutionService   │  │
│  └──────┬───────┘  └──────┬───────┘  │ ComparisonService      │  │
│         │                 │           │ ReportService          │  │
│         │                 │           └────────────────────────┘  │
├─────────┼─────────────────┼──────────────────────────────────────┤
│         ▼                 ▼                                       │
│                     CORE INFRASTRUCTURE                           │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ EXPLORATION     │  │ COMPARISON        │  │ SECURITY       │  │
│  │ ┌─────────────┐ │  │ ┌──────────────┐ │  │ ┌────────────┐ │  │
│  │ │DFSExplorer  │ │  │ │Structural    │ │  │ │encryption │ │  │
│  │ │StateMachine │ │  │ │Comparer      │ │  │ │JWTAuth    │ │  │
│  │ │UITreeProvide│ │  │ │VisualComparer│ │  │ │RBAC       │ │  │
│  │ │TreeHasher   │ │  │ │BugClassifier │ │  │ │DataSanitiz│ │  │
│  │ │Checkpoint   │ │  │ └──────────────┘ │  │ │SecLogger  │ │  │
│  │ │Recovery     │ │  │                  │  │ └────────────┘ │  │
│  │ │Heartbeat    │ │  │ ADB / AVD /      │  └────────────────┘  │
│  │ └─────────────┘ │  │ Database / Bridge │                     │
│  └─────────────────┘  └──────────────────┘  ┌────────────────┐  │
│  ┌─────────────────┐  ┌──────────────────┐  │ INFRASTRUCTURE │  │
│  │ RESILIENCE      │  │ PERFORMANCE       │  │ ┌────────────┐ │  │
│  │ ┌─────────────┐ │  │ ┌──────────────┐ │  │ │ServiceBus  │ │  │
│  │ │CircuitBreak │ │  │ │WorkerPool    │ │  │ │ServiceReg  │ │  │
│  │ │RetryStrategy│ │  │ │StreamProcess │ │  │ │EventStore  │ │  │
│  │ │ConnPool     │ │  │ │MultiLvlCache │ │  │ │EventHandle │ │  │
│  │ │MemOptimizer │ │  │ │MetricsCollec │ │  │ │Logging     │ │  │
│  │ │TaskQueue    │ │  │ │PerfMonitor   │ │  │ │Monitoring  │ │  │
│  │ └─────────────┘ │  │ └──────────────┘ │  │ └────────────┘ │  │
│  └─────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Contracts Layer  (8 interfaces)                            │  │
│  │  Config Layer    (src/main/core/config/)                    │  │
│  │  Logger Layer    (src/main/core/logger/)                    │  │
│  │  Tracing Layer   (src/main/core/tracing/)                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Key Data Flows

### Exploration Flow
```
User Click → IPC (exploration:start) → IPCService
  → StateMachine (IDLE→INIT→EXPLORING)
  → ExplorationService → ExplorationOrchestrator
  → ADBAdapter → ADBUITreeProvider → DFSExplorer
  → CheckpointManager (periodic save)
  → EventStore.append({ type: 'exploration.step' })
  → IPC callback → Renderer Context → UI update
```

### Security Flow for Encrypted Storage
```
initMasterKey('/path/to/data')
  → keyfile exists? YES → decrypt with machine fingerprint → set cachedMasterKey
  → keyfile exists? NO → crypto.randomBytes(32) → encrypt with fingerprint → write file

encryptToken('sensitive-data')
  → getMasterKey() → generate DEK (Data Encryption Key)
  → AES-256-GCM encrypt data with DEK
  → AES-256-GCM encrypt DEK with Master Key
  → return { encryptedData, iv, authTag, dekIv }
```

### Circuit Breaker Flow
```
execute(operation, fallback?)
  → state = OPEN?
    → shouldAttemptReset? YES → HALF_OPEN
    → shouldAttemptReset? NO → return fallback() | throw
  → state = HALF_OPEN & maxRequests exceeded? → return fallback() | throw
  → try operation()
    → SUCCESS → CLOSED | reset failureCount
    → FAILURE → failureCount++
      → failureCount >= threshold? → OPEN
```

## Module Dependency Graph

```
renderer/ ──→ services/ ──→ core/ ──→ contracts/
                │                        │
                └── preload/ ──────────────┘
                    │ (contextBridge)
                    │
core/ ──→ config/ ──→ infrastructure/ ──→ No external deps
                  │       │
                  │       ├── service/   (ServiceBus, ServiceRegistry)
                  │       ├── event/     (EventStore, EventHandler)
                  │       ├── cache/     (MultiLevelCache, CacheStrategy)
                  │       ├── circuit/   (CircuitBreaker)
                  │       ├── retry/     (RetryStrategy)
                  │       ├── metrics/   (MetricsCollector)
                  │       ├── health/    (HealthChecker)
                  │       ├── pool/      (ConnectionPool)
                  │       ├── memory/    (MemoryOptimizer)
                  │       ├── async/     (TaskQueue)
                  │       ├── worker/    (WorkerPool)
                  │       └── stream/    (StreamProcessor)
                  │
                  ├── security/ (encryption, jwt, rbac, audit, sanitize)
                  ├── exploration/ (dfs, state machine, tree, checkpoint)
                  ├── adb/ (android debug bridge)
                  ├── avd/ (android virtual device)
                  ├── resilience/ (heartbeat, recovery, ui freeze)
                  ├── comparison/ (structural, visual, classify)
                  ├── database/ (connection, migrations)
                  ├── logger/
                  └── tracing/
```

## Infrastructure Architecture Descriptions

| Module | Pattern | Description |
|--------|---------|-------------|
| ServiceBus | Pub/Sub | Topic-based publish/subscribe for cross-module messaging |
| ServiceRegistry | Registry | Service registration with lifecycle management + **topological dependency sort** |
| EventStore | Event Sourcing | Append-only event log with persistence and replay |
| EventHandler | Observer | Event subscription with wildcard support, once() semantics |
| CircuitBreaker | Circuit Breaker | CLOSED→OPEN→HALF_OPEN with configurable threshold/timeout and fallback |
| RetryStrategy | Retry | Exponential backoff with jitter, configurable retryable errors |
| WorkerPool | Thread Pool | `worker_threads` based concurrent task execution |
| MultiLevelCache | Cache-Aside | L1 (heap) → L2 (LRU) → L3 (external/Redis) |
| ConnectionPool | Pool | Generic connection pool with acquire timeout and health check |
| TaskQueue | Queue | Priority-based async task queue with concurrency control |
| MetricsCollector | Metrics | Counter/Timer/Gauge with P50/P95/P99 percentile calculation |
| HealthChecker | Health | Periodic checks with `waitForHealthy()`, timeout, and history |

## Testing Infrastructure

```
src/main/*/__tests__/     Unit tests (co-located with source)
src/__tests__/acceptance/ User story acceptance tests
src/__tests__/integration/ Integration tests with Docker services
src/__tests__/e2e/       End-to-end pipeline tests
src/test/utils/          Test utilities (mocks, data factories)
```

## Configuration

All app constants are centralized in `src/main/core/config/index.ts` — never hardcode in business logic.

```
config/ ──▶ EXPLORATION (maxDepth, maxSteps, timeout, ...)
         ──▶ SECURITY   (encryption algo, rate limits, jwt expiry, ...)
         ──▶ PERFORMANCE (pool sizes, cache limits, thresholds, ...)
         ──▶ IPC        (channel whitelist, rate limit config, ...)
         ──▶ HEALTH     (timeouts, intervals, thresholds, ...)
         ──▶ UI/AVD/LOGGING/DEVICE/DATABASE
```