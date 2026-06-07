# VTest PRD Round 2 复审综合报告

> 日期：2026-06-07 | 阶段：Round 2 5S 复审
> 综合：6.83/10 🟡 未达7.0通过线，需修复10项阻塞后进入Phase 1

---

## 一、6位专家评分总览

| 专家 | Round 1 | Round 2 | 变化 | 结论 |
|------|:-------:|:-------:|:----:|------|
| UX-Lead | 4.48 | 6.70 | +2.22 | 🟡 有条件通过 |
| Arch-Lead | 4.93 | 7.10 | +2.17 | 🟡 有条件通过 |
| QA-Lead | 3.91 | 7.10 | +3.19 | 🟡 有条件通过 |
| Sec-Lead | 3.91 | 6.80 | +2.89 | 🟡 有条件通过 |
| Dev-Lead | 3.91 | 7.10 | +3.19 | 🟡 有条件通过 |
| DevOps-Lead | 3.80 | 6.20 | +2.40 | 🟡 有条件通过 |
| **团队均分** | **3.91** | **6.83** | **+2.92** | **🟡 未达7.0** |

---

## 二、10项Phase 1前必须修复的阻塞项

### 🔴 Critical（P0，必须在Phase 1前修复）

| # | 问题 | 负责专家 | 修复工作量 | 修复方案 |
|---|------|---------|:---------:|---------|
| R2-01 | Token加密DEK的IV未存储，导致解密必然失败 | Sec-Lead | 0.5人天 | encryptToken返回值增加dekIv字段，decryptToken使用正确的IV |
| R2-02 | AVD冷启动使用-wipe-data标志，清除被测App所有状态 | Arch-Lead | 0.1人天 | 去掉-wipe-data，仅用-no-snapshot |
| R2-03 | UIFreezeDetector每2秒ADB dump+XML解析，消耗50-100%性能 | Arch-Lead | 1人天 | 改用uiautomator2 API直接获取UI树，或降至5-10秒频率 |
| R2-04 | 信息架构（IA）+导航模型缺失（BLK-10） | UX-Lead | 3人天 | 输出桌面端+Web端完整页面树+导航模型 |
| R2-05 | Onboarding + 空状态UX缺失（BLK-11） | UX-Lead | 3人天 | 输出首次使用引导流程+空状态设计+Sample Project |

### 🟡 High（P1，必须在Phase 1前2周内修复）

| # | 问题 | 负责专家 | 修复工作量 | 修复方案 |
|---|------|---------|:---------:|---------|
| R2-06 | HeartbeatManager无并发锁，多检测可能并行执行 | Arch-Lead | 0.1人天 | 添加isChecking互斥锁 |
| R2-07 | 崩溃时应使用上一个已保存检查点，而非创建新检查点 | Arch-Lead | 0.2人天 | 修改RecoveryManager.recoverAVD()逻辑 |
| R2-08 | CI/CD流水线缺安全扫描+回滚机制+pnpm未适配 | DevOps-Lead | 2人天 | 添加Snyk/npm audit + pnpm替换 + scripts定义 |
| R2-09 | 分布式追踪缺失（Electron↔Python IPC无TraceID） | DevOps-Lead | 1人天 | 设计TraceID传递方案 |
| R2-10 | AI探索引擎正常状态转换矩阵缺失 | Arch-Lead | 1人天 | 定义IDLE→INIT→EXPLORING→COMPARING→GENERATING→DONE |

**总修复工作量：约 12 人天，不影响6个月工期。**

---

## 三、Phase 1进入条件

| # | 条件 | 预计完成时间 | 状态 |
|---|------|:----------:|:---:|
| C1 | 5S综合 ≥ 7.0（当前6.83） | R2-01~10全部修复后预估7.5+ | ⬜ |
| C2 | 10项阻塞项全部修复 | 12人天 / 约2周（并行） | ⬜ |
| C3 | IA图 + Onboarding线框图交付 | UX-Lead 3天（可并行） | ⬜ |
| C4 | 安全架构Bug修复（R2-01） | 0.5天 | ⬜ |

**预计全部阻塞项修复后综合评分可达 7.5/10，满足5S通过条件。**

---

## 四、关键决策确认

| 决策 | 结论 | 依据 |
|------|------|------|
| 工期 | **对外承诺7个月，内部冲刺6个月** | Dev-Lead建议，6个月仅60%概率 |
| 团队规模 | **8人（增加0.5人AI引擎+1人PM）** | 消除AI引擎单点故障 |
| 分支策略 | **Trunk-Based + 短寿feature分支** | Round 1共识，修复文档矛盾 |
| AI引擎测试 | **确定性算法TDD + AI组件Golden Dataset回归** | M3无法达到85%单测覆盖率 |
| M3覆盖目标 | **单元测试60% + 集成测试85% + E2E场景覆盖** | 务实调整 |

---

## 五、文档清单（共10份）

| # | 文档 | 路径 |
|---|------|------|
| 1 | PRD v1.0 | `docs/plans/2026-06-06-vtest-mvp-prd.md` |
| 2 | Round 1评审报告 | `docs/plans/2026-06-06-vtest-mvp-review-round1.md` |
| 3 | 安全架构设计 | `docs/plans/2026-06-07-security-architecture.md` |
| 4 | 数据持久层设计 | `docs/plans/2026-06-07-data-persistence.md` |
| 5 | 故障恢复架构 | `docs/plans/2026-06-07-resilience-architecture.md` |
| 6 | 量化验收标准 | `docs/plans/2026-06-07-acceptance-criteria.md` |
| 7 | 工期重新估算 | `docs/plans/2026-06-07-timeline-reestimation.md` |
| 8 | CI/CD流水线 | `docs/plans/2026-06-07-cicd-pipeline.md` |
| 9 | 可观测性方案 | `docs/plans/2026-06-07-observability.md` |
| 10 | TDD实施规范 | `docs/plans/2026-06-07-tdd-strategy.md` |
