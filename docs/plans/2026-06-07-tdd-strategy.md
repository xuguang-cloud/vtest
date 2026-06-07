# VTest TDD 实施规范

> 文档版本：v1.0 | 日期：2026-06-07 | 作者：QA-Lead + Dev-Lead
> 状态：Phase 0 P0-12 整整改档

---

## 一、TDD 基本原则

### 1.1 红-绿-重构循环

```
🔴 RED    → 先写一个失败的测试（定义预期行为）
🟢 GREEN  → 写最少的代码让测试通过
🔵 REFACTOR → 重构代码，消除重复，改善设计
```

### 1.2 强制规则

| 规则ID | 规则描述 | 适用范围 |
|--------|---------|---------|
| TDD-R01 | 新功能必须有测试先行，不允许先写业务代码再补测试 | 所有开发 |
| TDD-R02 | Bug修复必须先写一个能复现Bug的测试，然后修复 | 所有开发 |
| TDD-R03 | 测试覆盖率目标：核心模块（M3/AI引擎）≥90%，一般模块≥80% | 全项目 |
| TDD-R04 | 提交PR前，所有测试必须通过，覆盖率不得降低 | CI流水线 |
| TDD-R05 | 测试代码与业务代码同仓库，目录结构：`src/__tests__/` 对应 `src/` | 全项目 |

### 1.3 测试分层策略

```
                    ┌──────────────────┐
                    │   E2E Tests      │ ← 少量，验证核心链路
                    │   (Playwright)   │    10% 的测试数量
                    ├──────────────────┤
                    │  Integration     │ ← 中量，验证模块集成
                    │  Tests           │    30% 的测试数量
                    ├──────────────────┤
                    │  Unit Tests      │ ← 大量，验证函数/类
                    │  (Vitest)        │    60% 的测试数量
                    └──────────────────┘
```

---

## 二、测试目录结构

```
vtest/
├── packages/
│   ├── main/                    # Electron 主进程
│   │   ├── src/
│   │   │   ├── database/        # 数据持久层
│   │   │   ├── adb/             # ADB/模拟器管理
│   │   │   ├── ipc/             # 进程间通信
│   │   │   └── services/        # 业务服务
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── database/
│   │       │   ├── adb/
│   │       │   └── ipc/
│   │       └── integration/
│   │           ├── adb-lifecycle.test.ts
│   │           └── database-operations.test.ts
│   │
│   ├── renderer/                # Electron 渲染进程（React）
│   │   ├── src/
│   │   │   ├── components/      # UI组件
│   │   │   ├── hooks/           # React Hooks
│   │   │   ├── stores/          # 状态管理
│   │   │   └── pages/           # 页面
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── components/
│   │       │   ├── hooks/
│   │       │   └── stores/
│   │       └── integration/
│   │           └── workflow.test.tsx
│   │
│   ├── ai-engine/               # Python AI探索引擎
│   │   ├── src/
│   │   │   ├── explorer/        # 路径探索
│   │   │   ├── comparator/       # PRD/设计稿比对
│   │   │   └── checkpoint/       # 断点续传
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── explorer/
│   │       │   └── comparator/
│   │       └── integration/
│   │           ├── exploration-pipeline.test.py
│   │           └── comparison-pipeline.test.py
│   │
│   └── web-report/              # Web报告端
│       ├── src/
│       └── tests/
│           ├── unit/
│           └── integration/
│
├── tests/
│   └── e2e/                     # 端到端测试
│       ├── app-install.test.ts
│       ├── exploration.test.ts
│       ├── test-execution.test.ts
│       └── report-generation.test.ts
│
├── vitest.config.ts             # Vitest 配置
├── vitest.workspace.ts          # Vitest 工作区配置
├── playwright.config.ts         # Playwright E2E 配置
└── pytest.ini                    # Python pytest 配置
```

---

## 三、各模块 TDD 测试用例清单

### 3.1 M1: 项目管理模块

| 测试ID | 测试类型 | 测试描述 | 优先级 |
|--------|---------|---------|--------|
| M1-U01 | Unit | 项目CRUD操作（创建/读取/更新/删除） | P0 |
| M1-U02 | Unit | APK文件上传与存储（支持.apk格式校验） | P0 |
| M1-U03 | Unit | APK元数据提取（package_name, version, activities） | P0 |
| M1-U04 | Unit | 项目配置持久化（设备型号、OS版本保存与读取） | P0 |
| M1-U05 | Unit | PRD文档本地导入（JSON/Markdown解析） | P0 |
| M1-U06 | Unit | Figma设计稿导入（Token校验 + API调用） | P1 |
| M1-U07 | Unit | 钉钉文档OAuth2授权流程 | P1 |
| M1-U08 | Unit | 飞书文档OAuth2授权流程 | P1 |
| M1-U09 | Integration | APK安装到模拟器完整链路 | P0 |
| M1-U10 | Integration | 文档导入→解析→存储完整链路 | P0 |

### 3.2 M2: 模拟器管理模块

| 测试ID | 测试类型 | 测试描述 | 优先级 |
|--------|---------|---------|--------|
| M2-U01 | Unit | AVD配置生成（给定设备参数生成AVD配置） | P0 |
| M2-U02 | Unit | AVD启动（模拟adb命令调用） | P0 |
| M2-U03 | Unit | AVD关闭（优雅关闭 + 强制杀死） | P0 |
| M2-U04 | Unit | 屏幕分辨率切换（adb shell wm size） | P0 |
| M2-U05 | Unit | 横竖屏旋转（adb shell settings put） | P0 |
| M2-U06 | Unit | AVD健康检查（heartbeat机制） | P0 |
| M2-U07 | Unit | AVD端口检测与分配 | P1 |
| M2-U08 | Integration | AVD完整生命周期（创建→启动→切换→关闭） | P0 |

### 3.3 M3: AI探索引擎（核心，最高密度）

| 测试ID | 测试类型 | 测试描述 | 优先级 |
|--------|---------|---------|--------|
| M3-U01 | Unit | UI树解析（XML格式→结构化节点树） | P0 |
| M3-U02 | Unit | 可交互元素识别（按钮/输入框/列表/Tab等分类） | P0 |
| M3-U03 | Unit | 元素哈希计算（用于去重） | P0 |
| M3-U04 | Unit | DFS路径遍历算法（正确性 + 无死循环） | P0 |
| M3-U05 | Unit | 循环检测（Activity A→B→A 回路检测） | P0 |
| M3-U06 | Unit | 探索边界控制（最大深度/最大时间/最大节点数） | P0 |
| M3-U07 | Unit | 步骤执行器（点击/输入/滑动/返回模拟） | P0 |
| M3-U08 | Unit | 超时保护（单步超时 + Activity无响应检测） | P0 |
| M3-U09 | Unit | 检查点保存（探索状态序列化→JSON） | P0 |
| M3-U10 | Unit | 检查点恢复（JSON→探索状态反序列化 + 去重） | P0 |
| M3-U11 | Unit | PRD比对：结构化JSON条目匹配（元素存在性检查） | P0 |
| M3-U12 | Unit | PRD比对：Bug分类生成（需求缺失/设计缺陷/UX缺陷/实现不一致） | P0 |
| M3-U13 | Unit | 设计稿比对：截图模板匹配（OpenCV） | P1 |
| M3-U14 | Unit | 5级恢复策略（返回→Home→重启Activity→重启App→重启AVD） | P0 |
| M3-U15 | Integration | 完整探索流程（Mock UI树→DFS遍历→生成路径树） | P0 |
| M3-U16 | Integration | 断点续传全流程（探索N步→保存→恢复→继续→不重复） | P0 |
| M3-U17 | Integration | PRD比对全流程（导入PRD→探索→比对→生成Bug） | P0 |

### 3.4 M4: 测试用例生成模块

| 测试ID | 测试类型 | 测试描述 | 优先级 |
|--------|---------|---------|--------|
| M4-U01 | Unit | 路径→用例转换（单条路径→一条测试用例） | P0 |
| M4-U02 | Unit | Bug条目生成（差异→结构化Bug对象） | P0 |
| M4-U03 | Unit | 用例优先级自动分配（基于路径深度和Bug严重度） | P1 |
| M4-U04 | Integration | 批量路径→批量用例→存储到DB | P0 |

### 3.5 M5: 测试执行引擎

| 测试ID | 测试类型 | 测试描述 | 优先级 |
|--------|---------|---------|--------|
| M5-U01 | Unit | 用例回放：点击操作执行 | P0 |
| M5-U02 | Unit | 用例回放：输入操作执行 | P0 |
| M5-U03 | Unit | 用例回放：滑动操作执行 | P0 |
| M5-U04 | Unit | 截图对比：pHash相似度计算 | P0 |
| M5-U05 | Unit | 截图对比：SSIM结构相似度 | P0 |
| M5-U06 | Unit | 截图对比：OpenCV模板匹配 | P0 |
| M5-U07 | Unit | 截图差异标注（红框标记差异区域） | P1 |
| M5-U08 | Unit | 执行日志格式化（JSON结构化日志） | P0 |
| M5-U09 | Integration | 完整用例执行流程（读取用例→回放→截图→断言→记录结果） | P0 |

### 3.6 M6: 报告系统

| 测试ID | 测试类型 | 测试描述 | 优先级 |
|--------|---------|---------|--------|
| M6-U01 | Unit | 通过率计算 | P0 |
| M6-U02 | Unit | 覆盖率计算（Activity覆盖率/路径覆盖率） | P0 |
| M6-U03 | Unit | Bug统计（按类型/严重度分组） | P0 |
| M6-U04 | Integration | 桌面端报告渲染（数据→React组件） | P0 |
| M6-U05 | Integration | Web报告端数据接口（REST API→前端渲染） | P1 |

### 3.7 E2E 端到端测试

| 测试ID | 测试描述 | 优先级 | 预计耗时 |
|--------|---------|--------|---------|
| E2E-01 | APK上传→安装到模拟器→验证安装成功 | P0 | 5min |
| E2E-02 | 新建项目→配置设备→启动模拟器→AI探索→查看路径树 | P0 | 20min |
| E2E-03 | 导入PRD→启动探索→查看Bug列表→验证Bug分类正确 | P0 | 20min |
| E2E-04 | 生成用例→执行→查看报告→验证通过率 | P0 | 15min |
| E2E-05 | 探索中AVD崩溃→系统自动恢复→从检查点继续 | P0 | 15min |
| E2E-06 | 断点续传：探索→暂停→恢复→不重复探索 | P0 | 15min |

---

## 四、Mock 策略

### 4.1 需要Mock的外部依赖

| 依赖 | Mock方式 | 适用范围 |
|------|---------|---------|
| ADB命令 | 子进程Mock（execa mock） | M2模块所有Unit测试 |
| UI树抓取 | JSON fixture文件（真实App UI树XML样本） | M3模块 |
| 模拟器操作 | ADB命令Mock + 虚拟设备状态机 | M2/M5模块 |
| 钉钉/飞书API | HTTP Mock（msw / nock） | M1模块 |
| Figma API | HTTP Mock（msw / nock） | M1模块 |
| 数据库 | 内存SQLite（:memory:） | 所有Integration测试 |
| 文件系统 | memfs 或临时目录 | M1/M4/M6模块 |
| 截图对比 | 预计算fixture（已知相似度的图片对） | M5模块 |

### 4.2 Fixture 数据管理

```
tests/
├── fixtures/
│   ├── ui-trees/              # 真实App的UI树样本（XML）
│   │   ├── simple-app.xml
│   │   ├── shopping-app.xml
│   │   └── social-app.xml
│   ├── screenshots/           # 截图fixture（已知差异的图片对）
│   │   ├── identical/
│   │   ├── minor-diff/
│   │   └── major-diff/
│   ├── prd-documents/         # PRD fixture
│   │   ├── structured.json
│   │   └── markdown.md
│   └── design-assets/         # 设计稿fixture
│       ├── button-primary.png
│       └── login-page.png
```

---

## 五、CI 集成

### 5.1 测试执行策略

```yaml
# GitHub Actions 中的测试步骤
test:
  needs: [build]
  strategy:
    matrix:
      os: [windows-latest, macos-latest]
  steps:
    - run: pnpm test:unit          # Vitest，< 30秒
    - run: pnpm test:integration   # 集成测试，< 5分钟
    - run: pnpm test:e2e           # E2E测试（仅Windows，需AVD），< 30分钟

# PR 合入条件
required_checks:
  - lint
  - typecheck
  - test:unit (100% pass)
  - test:integration (100% pass)
  - coverage (不降低)
```

### 5.2 代码覆盖率门禁

| 模块 | 最低覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| M3 AI探索引擎 | 85% | 90% |
| M1 项目管理 | 80% | 85% |
| M2 模拟器管理 | 80% | 85% |
| M4 用例生成 | 80% | 85% |
| M5 执行引擎 | 80% | 85% |
| M6 报告系统 | 70% | 80% |
| 全项目 | 75% | 85% |

---

## 六、TDD 开发节奏

### Sprint 周期（2周一个Sprint）

| 阶段 | 天数 | 活动 |
|------|------|------|
| Sprint Planning | Day 1 | 确认Sprint目标，拆分Story到Task，每个Task编写测试用例清单 |
| TDD开发 | Day 2-7 | 按Task逐个红→绿→重构 |
| 集成联调 | Day 8-9 | 模块间集成，运行Integration测试 |
| E2E验证 | Day 10 | 运行E2E测试，验证核心链路 |
| 评审+修复 | Day 11-12 | 代码评审、Bug修复、覆盖率达标 |
| Sprint Review | Day 13-14 | 演示成果、Retrospective |

### 每日站会检查项

- [ ] 昨天完成了哪些测试？
- [ ] 今天计划写哪些测试？
- [ ] 有没有遇到"无法测试"的情况？（需要重构）
- [ ] 测试覆盖率是否达标？
- [ ] 有没有测试失败需要排查？

---

## 七、5S评审与TDD的关系

| 5S维度 | TDD如何支撑 | 检查点 |
|--------|-----------|--------|
| **Standard** | 测试用例就是可量化的功能标准 | 每个User Story的验收标准转化为测试用例 |
| **Secure** | 安全测试作为TDD的一部分 | OAuth2、Token管理、沙箱隔离均有专门测试 |
| **Scalable** | Mock策略验证可扩展性 | 插件接口通过Mock验证可替换性 |
| **Stable** | 故障恢复测试覆盖恢复场景 | AVD崩溃恢复、断点续传均有E2E测试 |
| **Sustainable** | 覆盖率门禁保证长期可维护 | CI中覆盖率不达标则阻断合入 |

---

*本文档为VTest MVP TDD实施的核心规范，所有开发人员必须遵守。*
