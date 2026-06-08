# VTest TDD 实施规范

> 文档版本：v1.1 | 日期：2026-06-08 | 作者：QA-Lead + Dev-Lead
> 状态：Phase 0 P0-12 整改完成 — Gate 1 修复版

---

## 一、TDD 基本原则

### 1.1 红-绿-重构循环

```
RED    → 先写一个失败的测试（定义预期行为）
GREEN  → 写最少的代码让测试通过
REFACTOR → 重构代码，消除重复，改善设计
```

### 1.2 强制规则

| 规则ID | 规则描述 | 适用范围 |
|--------|---------|---------|
| TDD-R01 | 新功能必须有测试先行，不允许先写业务代码再补测试 | 所有开发 |
| TDD-R02 | Bug修复必须先写一个能复现Bug的测试，然后修复 | 所有开发 |
| TDD-R03 | 测试覆盖率目标：核心模块（M3/AI引擎）≥90%，一般模块≥80% | 全项目 |
| TDD-R04 | 提交PR前，所有测试必须通过，覆盖率不得降低 | CI流水线 |
| TDD-R05 | 测试代码与业务代码同仓库，测试目录：`src/**/__tests__/*.test.ts` 对应同级业务模块 | 全项目 |

### 1.3 测试技术栈

| 层级 | 工具 | 配置 |
|------|------|------|
| 单元测试 | **Jest** + ts-jest | `jest.config.js` — preset: ts-jest, testEnv: node |
| 集成测试 | Jest + better-sqlite3 | 内存数据库或临时目录 |
| E2E测试 | Playwright | 配置待补充 |

> **注意**：本项目使用 **Jest** 作为测试框架（非 Vitest），配置位于 `jest.config.js`（preset: ts-jest）。

### 1.4 测试分层策略

```
                    ┌──────────────────┐
                    │   E2E Tests      │ ← 少量，验证核心链路
                    │   (Playwright)   │    10% 的测试数量
                    ├──────────────────┤
                    │  Integration     │ ← 中量，验证模块集成
                    │  Tests (Jest)    │    30% 的测试数量
                    ├──────────────────┤
                    │  Unit Tests      │ ← 大量，验证函数/类
                    │  (Jest)          │    60% 的测试数量
                    └──────────────────┘
```

---

## 二、测试目录结构

```
vtest/
├── src/
│   ├── main/
│   │   ├── core/
│   │   │   ├── avd/
│   │   │   │   └── __tests__/
│   │   │   │       └── AVDManager.test.ts
│   │   │   ├── exploration/
│   │   │   │   └── __tests__/
│   │   │   │       └── StateMachine.test.ts
│   │   │   ├── resilience/
│   │   │   │   └── __tests__/
│   │   │   │       ├── CheckpointManager.test.ts
│   │   │   │       ├── HeartbeatManager.test.ts
│   │   │   │       └── UIFreezeDetector.test.ts
│   │   │   ├── security/
│   │   │   │   └── __tests__/
│   │   │   │       └── encryption.test.ts
│   │   │   ├── logger/
│   │   │   │   └── __tests__/
│   │   │   │       └── Logger.test.ts
│   │   │   ├── bridge/
│   │   │   │   └── __tests__/
│   │   │   │       └── IPCBridge.test.ts
│   │   │   └── database/
│   │   │       └── connection.ts
│   │   ├── services/
│   │   │   ├── __tests__/
│   │   │   │   ├── ProjectService.test.ts
│   │   │   │   └── IPCService.test.ts
│   │   │   ├── ProjectService.ts
│   │   │   ├── IPCService.ts
│   │   │   └── AVDService.ts
│   │   └── contracts/
│   │       ├── project.contract.ts
│   │       └── ...
│   ├── preload/
│   │   ├── __tests__/
│   │   │   └── index.test.ts
│   │   └── index.ts
│   └── renderer/                  # Electron 渲染进程（React）
│       └── ...
├── jest.config.js                 # Jest 配置（ts-jest preset）
├── tsconfig.json
└── package.json                   # "test": "jest"
```

---

## 三、已覆盖模块的测试清单

### 3.1 核心模块（src/main/core/）

| 测试文件 | 模块 | 测试数 | 覆盖要点 |
|---------|------|--------|---------|
| `AVDManager.test.ts` | AVD管理 | 5 | listAVDs, startAVD参数, statusChange事件, getStatus |
| `StateMachine.test.ts` | 状态机 | 5+ | 状态转换, 无效转换, 历史记录, reset |
| `encryption.test.ts` | 加密模块 | 3 | encrypt/decrypt轮询, authTag篡改检测 |
| `HeartbeatManager.test.ts` | 心跳管理 | 3+ | 立即检测, 失败计数, 互斥锁 |
| `UIFreezeDetector.test.ts` | UI冻结检测 | 4 | 初始状态, hash变化, stop/reset |
| `CheckpointManager.test.ts` | 检查点 | 1 | 类定义验证 |
| `Logger.test.ts` | 日志 | 3+ | 各日志级别, 文件写入 |
| `RecoveryManager.test.ts` | 恢复 | 3 | 状态机, 恢复策略 |
| `IPCBridge.test.ts` | IPC桥接 | 4+ | 状态转发, 窗口销毁处理 |

### 3.2 服务层（src/main/services/）

| 测试文件 | 模块 | 测试数 | 覆盖要点 |
|---------|------|--------|---------|
| `ProjectService.test.ts` | 项目管理 | 13 | CRUD操作, UUID生成, 字段映射, 异常处理 |
| `IPCService.test.ts` | IPC服务 | 5 | 处理器注册, 安全包装, 信任发送者 |

### 3.3 Preload（src/preload/）

| 测试文件 | 模块 | 测试数 | 覆盖要点 |
|---------|------|--------|---------|
| `index.test.ts` | Preload API | 18 | API暴露, 版本信息, IPC调用, 通道白名单, 事件订阅 |

---

## 四、Mock 策略

### 4.1 外部依赖 Mock

| 依赖 | Mock方式 | 测试模块 |
|------|---------|---------|
| Electron IPC | `jest.mock('electron')` — 模拟 ipcMain/ipcRenderer/contextBridge | IPCService, IPCBridge, preload |
| Electron BrowserWindow | 模拟 webContents.send 和 isDestroyed | IPCBridge |
| 数据库 (Knex) | 模拟 knex query builder 链式调用 | ProjectService |
| 文件系统 (fs) | `jest.mock('fs')` 或使用 memfs | Logger |
| process.versions | `Object.defineProperty(process, 'versions', ...)` | preload |
| child_process.spawn | 模拟 stdout/stderr/close 事件 | AVDManager |
| Logger | 全局单例 mock — `Logger.getLogger` 返回 mock | 所有服务层测试 |
| UUID | `jest.mock('uuid')` | ProjectService |
| crypto | 直接使用 (Node.js 内置) | encryption |

### 4.2 Mock 示例

```typescript
// Electron IPC Mock
jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  contextBridge: { exposeInMainWorld: jest.fn() },
  ipcRenderer: { invoke: jest.fn(), on: jest.fn(), removeListener: jest.fn() }
}))

// Knex 数据库 Mock
const mockDb = {
  insert: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(row),
  returning: jest.fn().mockResolvedValue([row])
}
mockGetDatabase.mockReturnValue(mockDb)

// Logger Mock
jest.mock('../../core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}))
```

---

## 五、运行测试

### 5.1 本地测试命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npx jest src/main/services/__tests__/ProjectService.test.ts

# 带覆盖率报告
npx jest --coverage

# 带详细输出
npx jest --verbose
```

### 5.2 当前测试状态

| 指标 | 数值 |
|------|------|
| 测试套件数 | 12 |
| 测试总数 | 79 |
| 通过数 | 79 |
| 失败数 | 0 |
| 覆盖率 | 待生成（运行 `npx jest --coverage`） |

---

## 六、CI 集成

### 6.1 GitHub Actions 配置

```yaml
test:
  needs: [build]
  strategy:
    matrix:
      os: [windows-latest, macos-latest]
  steps:
    - run: npm test              # Jest 单元测试，< 10秒
    # - run: npm run test:integration  # 集成测试（待补充）
    # - run: npm run test:e2e          # E2E测试（待补充）

# PR 合入条件
required_checks:
  - lint
  - typecheck
  - test (100% pass)
  # - coverage (不降低)
```

### 6.2 覆盖率目标

| 模块 | 最低覆盖率 | 当前状态 |
|------|-----------|---------|
| core/security | 80% | encryption ✅ |
| core/exploration | 80% | StateMachine ✅ |
| core/resilience | 80% | Heartbeat/UIFreeze/Checkpoint ✅ |
| core/avd | 80% | AVDManager ✅ |
| core/bridge | 80% | IPCBridge ✅ |
| services | 80% | ProjectService/IPCService ✅ |
| preload | 80% | preload/index ✅ |
| renderer | 70% | 待补充 |

---

## 七、TDD 开发节奏

### Sprint 周期（2周）

| 阶段 | 天数 | 活动 |
|------|------|------|
| Sprint Planning | Day 1 | 确认Sprint目标，拆分Story到Task，每个Task编写测试用例 |
| TDD开发 | Day 2-7 | 按Task逐个红→绿→重构 |
| 集成联调 | Day 8-9 | 模块间集成，运行Integration测试 |
| E2E验证 | Day 10 | 运行E2E测试，验证核心链路 |
| 评审+修复 | Day 11-12 | 代码评审、Bug修复、覆盖率达标 |
| Sprint Review | Day 13-14 | 演示成果、Retrospective |

---

*本文档为VTest MVP TDD实施的核心规范，所有开发人员必须遵守。*
