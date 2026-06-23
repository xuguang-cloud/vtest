# VTest 覆盖率提升计划

**文档版本**: v1.0  
**创建日期**: 2026-06-23  
**编制人**: QA-Lead  
**状态**: 执行中  

---

## 1. 当前覆盖率快照

| 模块 | 覆盖率 | 目标 | 差距 |
|------|--------|------|------|
| src/main/core/adb/ | 100% | 80% | ✅ 已达标 |
| src/main/core/avd/ | 100% | 80% | ✅ 已达标 |
| src/main/core/exploration/ | 87% | 85% | ✅ 已达标 |
| src/main/core/resilience/ | 80% | 80% | ✅ 已达标 |
| src/main/core/infrastructure/ | 29% | 80% | ⚠️ 差 51% |
| src/main/core/comparison/ | 37% | 80% | ⚠️ 差 43% |

> 数据来源：README.md 模块概览 + 最新 Vitest 覆盖率报告

---

## 2. 低覆盖率根因

### 2.1 src/main/core/infrastructure/ (29%)

该目录包含大量新增基础设施模块，目前仅有少量测试覆盖：

| 子模块 | 说明 | 测试现状 |
|--------|------|----------|
| sync/ | TaskQueue / priority queue | 无测试 |
| cache/ | MultiLevelCache (L1/L2/L3) | 无测试 |
| circuit/ | CircuitBreaker | 少量测试 |
| event/ | EventStore / EventHandler | 少量测试 |
| health/ | HealthChecker | 无测试 |
| memory/ | MemoryOptimizer | 无测试 |
| metrics/ | MetricsCollector | 无测试 |
| pool/ | ConnectionPool | 无测试 |
| etry/ | RetryStrategy | 无测试 |
| service/ | ServiceBus / ServiceRegistry | 无测试 |
| stream/ | StreamProcessor | 无测试 |
| worker/ | WorkerPool | 无测试 |

**根因**: 基础设施模块数量多、依赖复杂，且部分模块依赖 Node.js worker_threads / stream 等高级 API，Mock 成本较高。

### 2.2 src/main/core/comparison/ (37%)

当前新增文件：

| 文件 | 说明 | 测试现状 |
|------|------|----------|
| TranslationComparator.ts | 多语言文案对比 | 有测试文件，但覆盖率不足 |
| StructuralComparer.ts | UI 结构对比 | 未覆盖或覆盖低 |
| VisualComparer.ts | 截图视觉对比 | 未覆盖或覆盖低 |
| BugClassifier.ts | Bug 自动分类 | 未覆盖或覆盖低 |

**根因**: TranslationComparator 的匹配算法存在 O(n²) 双重循环，边界场景（空 spec、重复 key、大小写/空格规范化）测试不足；视觉/结构对比模块可能缺少 mock 图片数据。

---

## 3. 提升策略

### 3.1 Infrastructure 模块

按优先级分阶段补齐：

| 阶段 | 模块 | 目标覆盖率 | 测试重点 |
|------|------|------------|----------|
| 第 1 周 | circuit/, etry/, event/ | 80% | 状态机转换、重试策略、事件订阅/取消 |
| 第 2 周 | cache/, pool/, health/ | 80% | LRU 淘汰、连接池生命周期、健康检查超时 |
| 第 3 周 | sync/, service/, worker/, stream/, memory/, metrics/ | 80% | 任务队列优先级、服务注册拓扑排序、工作线程通信 |

### 3.2 Comparison 模块

| 文件 | 测试重点 |
|------|----------|
| TranslationComparator.ts | 空输入、完全匹配、部分匹配、缺失、多余、大小写/空格规范化 |
| StructuralComparer.ts | 相同 UI 树、属性差异、节点缺失/新增 |
| VisualComparer.ts | Mock 图片像素差异、阈值判断 |
| BugClassifier.ts | 需求缺失/设计缺陷/UX 缺陷/实现不一致 四分类 |

---

## 4. 具体任务清单

### 4.1 Infrastructure

- [ ] src/main/core/infrastructure/circuit/__tests__/CircuitBreaker.test.ts
- [ ] src/main/core/infrastructure/retry/__tests__/RetryStrategy.test.ts
- [ ] src/main/core/infrastructure/event/__tests__/EventStore.test.ts
- [ ] src/main/core/infrastructure/event/__tests__/EventHandler.test.ts
- [ ] src/main/core/infrastructure/cache/__tests__/MultiLevelCache.test.ts
- [ ] src/main/core/infrastructure/pool/__tests__/ConnectionPool.test.ts
- [ ] src/main/core/infrastructure/health/__tests__/HealthChecker.test.ts
- [ ] src/main/core/infrastructure/async/__tests__/TaskQueue.test.ts
- [ ] src/main/core/infrastructure/service/__tests__/ServiceBus.test.ts
- [ ] src/main/core/infrastructure/service/__tests__/ServiceRegistry.test.ts
- [ ] src/main/core/infrastructure/worker/__tests__/WorkerPool.test.ts
- [ ] src/main/core/infrastructure/stream/__tests__/StreamProcessor.test.ts
- [ ] src/main/core/infrastructure/metrics/__tests__/MetricsCollector.test.ts
- [ ] src/main/core/infrastructure/memory/__tests__/MemoryOptimizer.test.ts

### 4.2 Comparison

- [ ] 重写/补充 TranslationComparator.test.ts 边界场景
- [ ] 新增 StructuralComparer.test.ts
- [ ] 新增 VisualComparer.test.ts
- [ ] 新增 BugClassifier.test.ts

---

## 5. 验收标准

| 模块 | 目标覆盖率 | 验收方式 |
|------|------------|----------|
| infrastructure/ | ≥80% | 
px vitest run --coverage 通过 |
| comparison/ | ≥80% | 
px vitest run --coverage 通过 |
| 全项目 | ≥80% | CI 覆盖率检查通过 |

---

## 6. 注意事项

- 优先使用 **Vitest** 为新增模块写测试，保持与 itest.config.ts 一致
- 对 worker_threads、stream 等难测模块，使用 i.mock 或 
ode:worker_threads 的 Mock 版本
- 测试完成后，将 coverage/ 目录保持 .gitignore 忽略，只提交覆盖率报告截图或 CI 链接
