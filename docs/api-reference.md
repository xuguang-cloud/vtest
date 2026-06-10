# VTest API Reference

> Generated from src/main/contracts/ — the authoritative definition of all service interfaces.

---

## IExplorationService

**File**: `src/main/contracts/IExplorationService.ts`

Manages UI exploration sessions using DFS/BFS strategies over the Android UI tree.

### Types

| Type | Definition |
|------|-----------|
| `ExplorationState` | `'IDLE' \| 'INIT' \| 'EXPLORING' \| 'COMPARING' \| 'GENERATING' \| 'DONE' \| 'ERROR'` |
| `ExplorationConfig` | `{ timeout: number, maxDepth: number, strategy: 'dfs' \| 'bfs' }` |
| `ExplorationResult` | `{ paths: string[], coverage: number, duration: number }` |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `startExploration` | `(projectId: string, config: ExplorationConfig) => Promise<ExplorationRun>` | Start new exploration run |
| `pauseExploration` | `() => Promise<void>` | Pause current exploration |
| `resumeExploration` | `() => Promise<void>` | Resume paused exploration |
| `stopExploration` | `() => Promise<ExplorationResult>` | Stop and return results |
| `getCurrentState` | `() => ExplorationState` | Get current state |
| `getStateHistory` | `() => Array<{state, timestamp}>` | Get state transition history |
| `getCurrentRun` | `() => ExplorationRun \| null` | Get current run details |

---

## IComparisonService

**File**: `src/main/contracts/IComparisonService.ts`

Compares exploration results against PRD/design specs and classifies bugs.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `compare` | `(runId: string, prdPath?: string) => Promise<ComparisonResult>` | Compare exploration vs PRD |
| `classifyBug` | `(result: ComparisonResult) => Promise<BugClassification[]>` | Classify bugs by severity |
| `generateReport` | `(runId: string) => Promise<ComparisonReport>` | Generate comparison report |

---

## IProjectService

**File**: `src/main/contracts/IProjectService.ts`

CRUD operations for VTest projects (APK + PRD + Design bundles).

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `createProject` | `(dto: CreateProjectDTO) => Promise<Project>` | Create project |
| `getProject` | `(id: string) => Promise<Project>` | Get project by ID |
| `updateProject` | `(id: string, dto: UpdateProjectDTO) => Promise<Project>` | Update project |
| `deleteProject` | `(id: string) => Promise<void>` | Delete project |
| `listProjects` | `() => Promise<Project[]>` | List all projects |

---

## ITestCaseService

**File**: `src/main/contracts/ITestCaseService.ts`

Generates and manages test cases from exploration paths.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `generateTestCases` | `(runId: string) => Promise<TestCase[]>` | Generate test cases from exploration |
| `getTestCases` | `(projectId: string) => Promise<TestCase[]>` | Get all test cases for project |
| `updateTestCase` | `(caseId: string, updates: Partial<TestCase>) => Promise<TestCase>` | Update test case |
| `deleteTestCase` | `(caseId: string) => Promise<void>` | Delete test case |

---

## ITestExecutionService

**File**: `src/main/contracts/ITestExecutionService.ts`

Executes test cases on AVD or physical devices.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `executeTestRun` | `(projectId: string, caseIds: string[]) => Promise<ExecutionResult>` | Execute test cases |
| `getExecutionResults` | `(runId: string) => Promise<ExecutionResult>` | Get execution results |
| `getExecutionReport` | `(runId: string) => Promise<ExecutionReport>` | Get detailed report |
| `cancelExecution` | `(runId: string) => Promise<void>` | Cancel running execution |

### Types

| Type | Fields |
|------|--------|
| `StepStatus` | `'passed' \| 'failed' \| 'blocked' \| 'error'` |
| `StepResult` | `{ step: number, status: StepStatus, screenshot?: string, error?: string }` |
| `ExecutionSummary` | `{ total, passed, failed, blocked, passRate }` |

---

## IReportService

**File**: `src/main/contracts/IReportService.ts`

Generates and manages test reports.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `generateReport` | `(executionId: string, format: ReportFormat) => Promise<string>` | Generate report |
| `getReportHistory` | `(projectId: string) => Promise<ReportSummary[]>` | Get report history |
| `exportReport` | `(reportId: string, format: 'pdf' \| 'html' \| 'json') => Promise<Buffer>` | Export report |

---

## IAVDService

**File**: `src/main/contracts/IAVDService.ts`

Android Virtual Device lifecycle management.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `createAVD` | `(config: AVDConfig) => Promise<void>` | Create AVD |
| `startAVD` | `(avdName: string) => Promise<void>` | Start AVD |
| `stopAVD` | `() => Promise<void>` | Stop AVD |
| `getAVDStatus` | `() => Promise<AVDStatus>` | Get AVD status |
| `listAVDs` | `() => Promise<string[]>` | List available AVDs |
| `rotateScreen` | `(orientation: 'portrait' \| 'landscape') => Promise<void>` | Rotate screen |

---

## Core Infrastructure API

### Event System

**EventStore** — Append-only event log.

| Method | Signature | Description |
|--------|-----------|-------------|
| `append` | `(event: Event) => Promise<void>` | Save event to store |
| `getEvents` | `(type?: string) => Event[]` | Query events by type |
| `getEventsInRange` | `(start, end, type?) => Event[]` | Query by time range |
| `getCount` | `(type?: string) => number` | Count events |
| `replay` | `(type?, handler?) => Promise<void>` | Replay events |
| `loadFromDisk` | `() => Promise<number>` | Recover from disk |

**EventHandler** — Pub/Sub with wildcard `'*'` support.

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `(type: string, handler) => void` | Subscribe |
| `off` | `(type: string, handler?) => void` | Unsubscribe |
| `once` | `(type: string, handler) => void` | Subscribe once |
| `emit` | `(type, payload, metadata?) => Promise<void>` | Publish event |
| `removeAll` | `() => void` | Clear all handlers |

### Service Infrastructure

**ServiceBus** — Topic-based pub/sub.

| Method | Signature | Description |
|--------|-----------|-------------|
| `subscribe` | `(topic, handler) => void` | Subscribe to topic |
| `unsubscribe` | `(topic, handler) => void` | Unsubscribe |
| `publish` | `(topic, data) => void` | Publish synchronously |
| `publishAsync` | `(topic, data) => Promise<void>` | Publish async |
| `clearAll` | `() => void` | Remove all subscribers |

**ServiceRegistry** — Service lifecycle + dependency resolution.

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(service: Service) => void` | Register service |
| `unregister` | `(name: string) => boolean` | Unregister |
| `get` | `(name: string) => Service \| undefined` | Lookup |
| `startAll` | `() => Promise<void>` | Start all (topological order) |
| `stopAll` | `() => Promise<void>` | Stop all (reverse order) |
| `topologicalSort` | `() => string[]` | Resolve startup order |

### Resilience Patterns

**CircuitBreaker** — CLOSED → OPEN → HALF_OPEN.

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `(operation, fallback?) => Promise<T>` | Execute with protection |
| `getState` | `() => CircuitState` | Current state |
| `getFailureCount` | `() => number` | Failure count |
| `forceState` | `(state: CircuitState) => void` | Override state (testing) |
| `reset` | `() => void` | Reset to CLOSED |

**RetryStrategy** — Exponential backoff with jitter.

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `(operation, options) => Promise<T>` | Execute with retries |
| `withBackoff` | `(operation, maxAttempts?, baseDelay?) => Promise<T>` | Static helper |

### Security

**JWTAuth** — Pure crypto HS256 implementation.

| Method | Signature | Description |
|--------|-----------|-------------|
| `sign` | `(payload) => string` | Create signed JWT |
| `verify` | `(token) => any` | Verify and decode JWT |

**Encryption** (encryption.ts) — AES-256-GCM DEK/KEK.

| Method | Signature | Description |
|--------|-----------|-------------|
| `initMasterKey` | `(storageDir?: string) => void` | Initialize persistent key |
| `encryptToken` | `(plaintext: string) => EncryptedData` | Encrypt |
| `decryptToken` | `(data: EncryptedData) => string` | Decrypt |
| `hashData` | `(data: string) => string` | SHA-256 |
| `generateState` | `() => string` | Random state |
| `generateCodeVerifier` | `() => string` | PKCE verifier |
| `generateCodeChallenge` | `(verifier) => string` | PKCE challenge |

### IPC Channels

| Channel | Direction | Rate Limit | Description |
|---------|-----------|:----------:|-------------|
| `exploration:start` | invoke | 30/min | Start exploration |
| `exploration:stop` | invoke | 30/min | Stop exploration |
| `exploration:pause` | invoke | 30/min | Pause exploration |
| `exploration:resume` | invoke | 30/min | Resume exploration |
| `exploration:stateChanged` | on (event) | — | State change notifications |
| `oauth:authorize` | invoke | — | OAuth authorization |
| `oauth:callback` | on (event) | — | OAuth callback |
| `project:list` / `project:load` | invoke | — | Project management |
| `avd:list` / `avd:start` | invoke | — | AVD management |
| `logger:*` | invoke/on | — | Logging |