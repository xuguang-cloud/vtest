# VTest — AI-Powered Android App Testing Tool

**VTest** is an Electron + TypeScript desktop application that automates Android app testing using AI-driven exploration. It combines ADB-based UI tree analysis, DFS exploration strategies, and intelligent comparison to deliver comprehensive test coverage.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Layer                        │
│  React + TypeScript  │  ExplorationContext (useReducer)  │
│  ExplorationMonitor  │  ProjectForm / ProjectList        │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC (contextIsolation + sandbox)
┌───────────────────────┴─────────────────────────────────┐
│                    Service Layer                          │
│  IPCService (RateLimited)  │  ExplorationService          │
│  ProjectService / ApkService / TestCaseService           │
│  ComparisonService / ReportService / TestExecutionService│
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                    Core Infrastructure                    │
├───────────────────────┬─────────────────────────────────┤
│  Microservices        │  Event-Driven                    │
│  ├ ServiceBus         │  ├ Event (create/query/replay)   │
│  └ ServiceRegistry    │  └ EventHandler (pub/sub/wild)   │
├───────────────────────┼─────────────────────────────────┤
│  Resilience           │  Performance                     │
│  ├ CircuitBreaker     │  ├ WorkerPool (Threads)          │
│  ├ RetryStrategy      │  ├ MultiLevelCache (L1-L3)       │
│  ├ HeartbeatManager   │  ├ StreamProcessor               │
│  ├ CheckpointManager  │  ├ MetricsCollector              │
│  └ RecoveryManager    │  └ PerformanceMonitor            │
├───────────────────────┼─────────────────────────────────┤
│  Security             │  Resource Management             │
│  ├ JWTAuth + RBAC     │  ├ ConnectionPool                │
│  ├ EncryptionService  │  ├ MemoryOptimizer               │
│  ├ DataSanitizer      │  └ TaskQueue (priority)          │
│  ├ SecurityLogger     │                                  │
│  └ PermissionAuditor  │  Monitoring & Health             │
├───────────────────────┼─────────────────────────────────┤
│  Exploration          │  ├ HealthChecker                 │
│  ├ DFSExplorer        │  ├ MonitoringService             │
│  ├ StateMachine       │  └ LoggingService                │
│  ├ ExplorationEngine  │                                  │
│  └ UITreeProvider     │  Testing Infrastructure          │
│                        │  ├ TestUtils / TestDataFactory   │
│  Comparison           │  ├ CoverageReporter              │
│  ├ StructuralComparer │  ├ TestContainer                 │
│  ├ VisualComparer     │  └ APITester                     │
│  └ BugClassifier      │                                  │
└───────────────────────┴─────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Android SDK (for ADB-based features)
- Electron (bundled via electron-vite)

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev       # Start Electron dev server with hot reload
```

### Testing

```bash
pnpm test                    # Run all tests (43 test suites)
pnpm test -- --testPathPattern="infrastructure"  # Infrastructure tests (47 cases)
pnpm test -- --testPathPattern="security"        # Security tests
```

### Build

```bash
pnpm build     # Production build via electron-vite
pnpm lint      # ESLint check
```

## Module Overview

| Module | Description | Coverage |
|--------|-------------|:--------:|
| `src/main/core/adb/` | Android ADB adapter | ✅ 100% |
| `src/main/core/avd/` | AVD lifecycle manager | ✅ 100% |
| `src/main/core/exploration/` | DFS UI exploration engine | ✅ 87% |
| `src/main/core/resilience/` | Circuit breaker, heartbeat, recovery | ✅ 80% |
| `src/main/core/infrastructure/` | Bus, event, cache, concurrency, security | ✅ 29% (新增) |
| `src/main/core/comparison/` | UI structural/visual comparison | 🟡 37% |
| `src/main/core/security/` | Encryption, JWT, RBAC, audit | 🟡 17% |
| `src/main/services/` | Business service layer | 🟡 40% |
| `src/test/` | Integration, e2e, acceptance tests | ✅ 38 suites |

## Key Design Decisions

1. **Zero external crypto**: `JWTAuth` and `encryption.ts` use only Node.js `crypto` module — no `jsonwebtoken` dependency.
2. **Defense in depth**: AES-256-GCM DEK/KEK wrapping + machine-fingerprint keyfile persistence.
3. **IPC security**: Channel whitelist + sender verification + rate limiting (30 req/min).
4. **Singleton infrastructure**: `ServiceBus`, `EventStore`, `ServiceRegistry` — all single-instance with `getInstance()`.
5. **Electron security**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.

## API Contracts

All service interfaces are defined in `src/main/contracts/`:

| Interface | Methods |
|-----------|---------|
| `IExplorationService` | startExploration, stopExploration, getSession |
| `IComparisonService` | compare, classifyBug, generateReport |
| `IProjectService` | createProject, updateProject, getProject |
| `ITestCaseService` | generateTestCases, runTestCases |
| `ITestExecutionService` | executeTestRun, getExecutionResults |
| `IReportService` | generateReport, getReportHistory |
| `IAVDService` | createAVD, startAVD, stopAVD |

## Quality Metrics

| Metric | Current | Target |
|--------|:-------:|:------:|
| 12D Assessment | 3.8/5.0 | 5.0/5.0 |
| Test files | 43 | 50+ |
| TypeScript errors | 22 | 0 |
| Test pass rate | 100% | 100% |
| Infrastructure test coverage | 29% | 80%+ |