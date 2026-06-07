# VTest MVP v1.0 — PRD 5S 综合评审报告

> **评审日期**：2026-06-06  
> **PRD 版本**：v1.0 MVP  
> **PM**：PM-YYDS  
> **评审结论**：🔴 **不通过 — 需整改后重审**

---

## 一、专家团队评审汇总

| 角色 | Standard | Secure | Scalable | Stable | Sustainable | 综合 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **PM-YYDS** | — | — | — | — | — | 产品定义 7.5/10 |
| **UX-Lead** | 4.0 | 5.5 | 6.0 | **3.5** | **4.0** | **4.48** |
| **Arch-Lead** | 5.5 | **4.0** | 6.0 | **4.5** | 5.0 | **4.93** |
| **Dev-Lead** | 4.0 | **3.0** | 5.0 | **3.0** | **3.0** | **3.60** |
| **QA-Lead** | 5.0 | **4.0** | 6.0 | **4.0** | 5.0 | **4.80** |
| **Sec-Lead** | **3.0** | **2.0** | 5.0 | **3.0** | **2.0** | **2.80** |
| **DevOps-Lead** | **3.0** | **4.0** | **4.0** | **3.0** | 5.0 | **3.80** |

> **团队 5S 综合加权评分：3.91 / 10 — 🔴 严重不达标**

---

## 二、跨专家共识（全员一致指出的问题）

以下问题是 6 位专家中有 4 位以上同时指出的系统性缺陷：

| # | 共识问题 | 指出专家 | 严重度 |
|---|---------|---------|:---:|
| **C-01** | **Electron 安全配置完全缺失**（contextIsolation / nodeIntegration / sandbox / CSP） | UX, Arch, Dev, QA, Sec, DevOps（6/6） | 🔴 P0 |
| **C-02** | **OAuth2 实现细节空白**（Grant Type / PKCE / Redirect URI / Token 生命周期） | UX, Arch, Dev, QA, Sec, DevOps（6/6） | 🔴 P0 |
| **C-03** | **AES-256 密钥管理方案缺失**（密钥来源/存储/轮换） | Arch, Dev, QA, Sec（4/6） | 🔴 P0 |
| **C-04** | **APK 沙箱隔离不充分**（仅"独立AVD"无法防御恶意APK） | Arch, Dev, QA, Sec（4/6） | 🔴 P0 |
| **C-05** | **内嵌浏览器安全边界模糊**（Cookie复用/XSS风险/Session隔离） | UX, Arch, Dev, QA, Sec（5/6） | 🔴 P0 |
| **C-06** | **模拟器崩溃恢复/断点续传机制空白** | UX, Arch, Dev, QA, DevOps（5/6） | 🔴 P0 |
| **C-07** | **数据持久层/存储方案未定义**（SQLite?文件系统?Electron↔Web同步?） | Arch, Dev, QA, DevOps（4/6） | 🔴 P0 |
| **C-08** | **用户故事验收标准不可量化**（US-01~06均为定性描述） | Dev, QA, UX（3/6） | 🟡 P1 |
| **C-09** | **AI探索引擎状态机/生命周期未定义** | UX, Arch, Dev, QA（4/6） | 🟡 P1 |
| **C-10** | **CI/CD构建流水线完全空白** | Dev, QA, DevOps（3/6） | 🟡 P1 |
| **C-11** | **TDD在AI/非确定性组件上的落地策略缺失** | Arch, Dev, QA（3/6） | 🟡 P1 |
| **C-12** | **3个月工期严重低估**（实际需5.5-7个月） | Dev, DevOps（2/6） | 🟡 P1 |

---

## 三、必须修改项（阻塞项）— 整改后才能进入设计阶段

### 🔴 P0 阻塞项（共 14 项）

| ID | 问题 | 责任专家 | 产出要求 |
|----|------|---------|---------|
| **BLK-01** | 新增独立「安全需求」章节（威胁模型 + 数据分类 + 合规基线 + 审计日志） | Sec-Lead | 安全设计文档（SDD） |
| **BLK-02** | Electron 安全基线配置（contextIsolation + nodeIntegration:false + sandbox + CSP） | Sec-Lead + Dev-Lead | 安全配置 Checklist |
| **BLK-03** | OAuth2 完整实现方案（PKCE + state + scope最小化 + 系统密钥链 + 撤销） | Sec-Lead + Arch-Lead | OAuth2 技术方案文档 |
| **BLK-04** | AES-256 密钥管理方案（OS Keychain / DPAPI / libsecret） | Sec-Lead + Dev-Lead | 密钥管理方案文档 |
| **BLK-05** | APK 沙箱重设计（Docker容器化AVD + 网络隔离 + 文件只读 + 静态扫描） | Sec-Lead + Arch-Lead | APK安全防线设计 |
| **BLK-06** | 内嵌浏览器重设计（Session分区隔离 + URL白名单 + 导航拦截 + 抓取后清除） | Sec-Lead + UX-Lead | 浏览器安全方案文档 |
| **BLK-07** | 探索引擎状态机设计（IDLE→INIT→EXPLORING→COMPARING→GENERATING→DONE + 异常路径） | Arch-Lead + QA-Lead | 探索引擎状态机文档 |
| **BLK-08** | 模拟器崩溃恢复/断点续传机制（Checkpoint + Watchdog + 三层超时防护） | Arch-Lead + Dev-Lead | 稳定性设计文档 |
| **BLK-09** | 数据持久层设计（SQLite选型 + Schema + Electron↔Web数据流） | Arch-Lead + Dev-Lead | 数据架构文档 |
| **BLK-10** | 信息架构（IA）定义 + 桌面端导航模型 + Web端导航模型 | UX-Lead | IA 图 + 交互流程图 |
| **BLK-11** | 补充首次使用引导（Onboarding）和空状态 UX | UX-Lead | Onboarding 用户故事 + 线框图 |
| **BLK-12** | 所有用户故事验收标准改为可量化格式 | QA-Lead + PM | 修订版 PRD |
| **BLK-13** | CI/CD 构建流水线方案（多平台构建 + 签名 + 制品管理） | DevOps-Lead | CI/CD 架构文档 |
| **BLK-14** | 3个月工期调整为实际可行周期，或裁剪 scope | PM + Dev-Lead | 修订版项目计划 |

---

## 四、建议改进项（非阻塞 — 开发阶段逐步完善）

| ID | 问题 | 建议优先级 |
|----|------|:---:|
| IMP-01 | US-06 拆分为 4-5 条独立用户故事 | P1 |
| IMP-02 | Design Token 体系建立 | P1 |
| IMP-03 | 核心组件清单提取（PathTree/ScreenshotCompare/BugCard等） | P1 |
| IMP-04 | AVD 集群调度架构设计 | P1 |
| IMP-05 | IDeviceManager 抽象层（为 iOS/鸿蒙 预留） | P1 |
| IMP-06 | Plugin 接口契约正式定义 | P1 |
| IMP-07 | 可观测性架构（Logging/Metrics/Tracing） | P2 |
| IMP-08 | 截图对比稳定性方案（动态区域排除 + pHash + SSIM分级） | P1 |
| IMP-09 | 模拟器黄金镜像 + 环境标准化 | P1 |
| IMP-10 | 代码规范基础设施（ESLint + Prettier + Husky + Commitlint） | P1 |
| IMP-11 | Monorepo 结构和构建系统选型 | P1 |
| IMP-12 | MVP scope 裁剪（钉钉/飞书/网页抓取延迟到 v1.1） | P1 |
| IMP-13 | 标准测试 App 集定义（简单/中等/复杂 各1个） | P1 |
| IMP-14 | 企业版功能灰显策略（隐藏 vs 价值预告） | P3 |
| IMP-15 | 无障碍（WCAG 2.1 AA）合规 | P2 |

---

## 五、团队技术选型共识

以下技术选型得到 3 位以上专家一致推荐：

| 领域 | 共识选型 | 推荐专家 |
|------|---------|---------|
| **桌面框架** | Electron 33+ | Dev, Arch, DevOps |
| **前端框架** | React 18/19 + TypeScript 5.x | Dev, Arch, UX |
| **UI组件库** | shadcn/ui 或 Ant Design 5.x | UX, Dev |
| **构建工具** | electron-vite + Vite | Dev, Arch, DevOps |
| **Monorepo** | pnpm workspace + Turborepo | Dev, Arch |
| **本地数据库** | better-sqlite3 | Arch, Dev |
| **模拟器管理** | Android SDK CLI（自建） | Arch, Dev |
| **AI引擎通信** | Unix Domain Socket + JSON-RPC 2.0 | Arch, Dev |
| **Python运行时** | Python 3.12 + FastAPI | Arch, Dev |
| **UI树采集** | uiautomator2 Python SDK | Arch, Dev |
| **截图对比** | pHash + SSIM + OpenCV 三级流水线 | Arch, QA |
| **CI/CD** | GitHub Actions | Dev, DevOps |
| **版本管理** | Trunk-Based + SemVer + Conventional Commits | Dev, DevOps |

---

## 六、下一步行动计划

### Phase 0: PRD 整改（1-2 周）

| 天数 | 任务 | 产出 |
|:---:|------|------|
| D1-D2 | PM 整合评审意见，修订 PRD（BLK-12/14） | 修订版 PRD v1.1 |
| D1-D3 | Sec-Lead 产出安全设计文档（BLK-01~06） | 安全设计文档（SDD） |
| D2-D4 | Arch-Lead 产出架构补充设计（BLK-07/09） | 架构设计文档 HLD |
| D2-D4 | Dev-Lead 产出稳定性设计（BLK-08） | 稳定性设计文档 |
| D2-D3 | UX-Lead 产出信息架构 + Onboarding（BLK-10/11） | IA 图 + 线框图 |
| D3-D4 | DevOps-Lead 产出 CI/CD 方案（BLK-13） | CI/CD 架构文档 |
| D5 | 全员 5S 复审（Round 2） | 评审通过 / 继续整改 |

### Phase 1: 设计阶段（2-3 周，PRD 评审通过后启动）

- HLD（高级设计）+ LLD（详细设计）
- UI/UX 设计（Figma 原型）
- API 接口规范（OpenAPI 3.1）
- 数据库 Schema

### Phase 2: TDD 先行（1-2 周）

- 功能测试用例开发
- 性能测试用例开发
- 接口测试用例开发
- 5S 评审测试用例

### Phase 3: 开发（8-12 周，视 scope 裁剪结果）

- 按模块并行开发
- TDD 红→绿→重构循环
- 每日构建 + 自动测试

---

## 七、评审签署

| 角色 | 评审结论 | 签署 |
|------|---------|:---:|
| PM-YYDS | 🔴 不通过，需整改后重审 | ✍️ |
| UX-Lead | 🔴 不通过 | ✍️ |
| Arch-Lead | 🔴 有条件通过（需完成 4 项阻塞整改） | ✍️ |
| Dev-Lead | 🔴 不通过（工期不可行 + 6 项阻塞） | ✍️ |
| QA-Lead | 🔴 不通过（12 项阻塞） | ✍️ |
| Sec-Lead | 🔴 严重不通过（6 项 P0 安全阻塞） | ✍️ |
| DevOps-Lead | 🔴 不通过（7 项阻塞） | ✍️ |

> **5S 综合评审结论：🔴 不通过**  
> **下一步：进入 Phase 0 整改阶段，5 个工作日内完成全部 14 项阻塞项整改，第 6 天全员复审。**

---

*VTest MVP v1.0 PRD 5S 综合评审报告 — 2026-06-06*
