# VTest Phase 2 / Phase 3 执行计划

**文档版本**: v1.0  
**创建日期**: 2026-06-23  
**编制人**: PM-Agent  
**状态**: 执行中  

---

## 1. 当前状态

| 阶段 | 计划状态 | 实际状态 | 说明 |
|------|----------|----------|------|
| Phase 0 | 已完成 | 已完成 | 需求/设计/架构/测试/安全/隐私评估通过 |
| Gate 1 | 已通过 | 已通过 | 2026-06-08 全维度 PASS |
| Phase 1 | P0 安全修复 | 已完成 | 已修复 encryption/preload/IPC/BrowserWindow 等问题 |
| Phase 2 | TDD 端到端验收 | 进行中 | Vitest 配置已落地，新增模块测试框架已搭建 |
| Phase 3 | 开发实现 | 进行中 | 代码已推进至 VTest v3.0，AI 探索引擎 + 真实设备测试修复 |

**代码基准**: dae3348 — eat: VTest v3.0 - App智能探索引擎 + 真实设备测试修复

---

## 2. Phase 2 — TDD 端到端验收（进行中）

### 2.1 目标

- 确保新增核心模块（device/apk/extract/locator/plugin/script/comparison）达到 **80% 以上测试覆盖率**
- 统一测试框架：Jest 负责历史模块，Vitest 负责新增 Pro Phase 1 模块
- 打通 CI：PR 触发 lint / type-check / unit / integration

### 2.2 任务清单

| 任务 | 优先级 | 负责人 | 状态 | 验收标准 |
|------|--------|--------|------|----------|
| 补齐 comparison/TranslationComparator 测试 | P0 | QA-Lead | 待完成 | 覆盖 normal/extra/missing/mismatch 场景 |
| 补齐 infrastructure/* 各子模块单元测试 | P0 | QA-Lead | 进行中 | 覆盖率从 29% 提升至 ≥80% |
| 统一 Jest 与 Vitest 配置 | P1 | Dev-Lead | 进行中 | pnpm test 可运行全部测试 |
| 修复 CI workflow 中的包管理器差异 | P1 | DevOps-Lead | 待完成 | CI 使用 pnpm，或改为 npm 并锁定 |
| 补充 E2E 核心流程测试 | P2 | QA-Lead | 待启动 | 覆盖 exploration 完整链路 |

### 2.3 关键风险

- **双测试框架并存**: Jest 与 Vitest 混用可能导致配置冲突，需要明确模块归属
- **低覆盖模块**: infrastructure（29%）和 comparison（37%）是 Phase 2 重点

---

## 3. Phase 3 — 开发实现（进行中）

### 3.1 已落地模块

| 模块 | 路径 | 状态 | 说明 |
|------|------|------|------|
| APK 安装器 | src/main/core/apk/APKInstaller.ts | ✅ 初版完成 | 支持 install/uninstall/reinstall/launch |
| 设备管理器 | src/main/core/device/DeviceManager.ts | ✅ 初版完成 | 支持 emulator/real 设备连接，插件化驱动 |
| 元素定位器 | src/main/core/locator/ElementLocator.ts | ✅ 初版完成 | UI 元素定位抽象 |
| 提取引擎 | src/main/core/extract/ExtractEngine.ts | ✅ 初版完成 | 页面/元素信息提取 |
| 插件宿主 | src/main/core/plugin/PluginHost.ts | ✅ 初版完成 | 驱动工厂、设备驱动插件化 |
| 页面对象生成器 | src/main/core/script/PageObjectGenerator.ts | ✅ 初版完成 | 用例脚本生成 |
| 翻译/文案对比器 | src/main/core/comparison/TranslationComparator.ts | ✅ 初版完成 | 多语言文案缺失/不一致检测 |
| IPC 设备层 | src/main/ipc/deviceIpc.ts | ✅ 初版完成 | avd/device 相关 IPC handler |
| 设备面板 UI | src/renderer/src/components/DevicePanel.tsx | ✅ 初版完成 | 前端设备控制面板 |

### 3.2 待完成开发任务

| 任务 | 优先级 | 依赖 | 说明 |
|------|--------|------|------|
| 完善 DeviceManager 错误处理与重试 | P0 | AVDConnector | 当前 connect 缺少超时与重试 |
| 接入真实 ADB 设备驱动 | P0 | DeviceManager | 当前默认使用 emulator，需支持真实设备 |
| 补齐 PluginHost 加载外部插件能力 | P1 | PluginHost | 当前仅内置驱动，需支持动态插件 |
| TranslationComparator 算法优化 | P1 | TranslationComparator | 当前 O(n²) 且误报率高，需优化匹配逻辑 |
| ExtractEngine 与 Exploration 引擎集成 | P1 | ExtractEngine, DFSExplorer | 将提取能力接入探索流程 |
| PageObjectGenerator 输出格式标准化 | P1 | PageObjectGenerator | 对齐 TDD 用例 JSON 格式 |
| DevicePanel 与 IPC 联调 | P2 | deviceIpc | 前端面板调用后端能力 |

---

## 4. 里程碑与交付节奏

| 里程碑 | 目标日期 | 交付物 | 成功标准 |
|--------|----------|--------|----------|
| Phase 2.1 新增模块测试覆盖 ≥80% | 2026-06-30 | 测试报告、CI 通过 | Vitest coverage 达标 |
| Phase 2.2 全量测试通过 | 2026-07-07 | 合并到 develop | pnpm test 全绿 |
| Phase 3.1 设备管理完善 | 2026-07-14 | DeviceManager + ADB 驱动 | 支持真实设备连接 |
| Phase 3.2 探索引擎集成提取与对比 | 2026-07-28 | DFSExplorer v2.0 | 覆盖 US-02/US-06 核心链路 |
| Phase 3.3 MVP 功能联调 | 2026-08-15 | 端到端可运行 | 可完成一次完整的 APK → 探索 → 报告流程 |

---

## 5. 验收标准

- **TDD**: 核心模块覆盖率 ≥80%，CI 全绿
- **功能**: 支持 APK 安装 → 设备连接 → AI 探索 → 用例生成 → 报告展示 完整链路
- **质量**: 无 P0/P1 缺陷，5S 复评通过

---

## 6. 下一步行动

1. 整理当前工作区改动，分批次 commit
2. 补齐 infrastructure 和 comparison 测试
3. 修复 CI workflow 使用 pnpm 或统一为 npm
4. 更新 docs/architecture.md 中的模块关系图，加入 device/apk/plugin 等新模块
