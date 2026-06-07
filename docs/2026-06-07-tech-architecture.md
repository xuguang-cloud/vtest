# VTest 技术架构文档

**版本**: v1.0  
**日期**: 2026-06-07  
**状态**: 基础设施已搭建完成  
**审核**: 待评审

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [架构设计](#3-架构设计)
4. [核心模块](#4-核心模块)
5. [数据库设计](#5-数据库设计)
6. [安全架构](#6-安全架构)
7. [故障恢复](#7-故障恢复)
8. [构建与CI/CD](#8-构建与cicd)
9. [开发环境](#9-开发环境)

---

## 1. 项目概述

### 1.1 项目定位

VTest 是一款基于 AI 的 Android/iOS/鸿蒙 应用自动化测试工具，核心价值是自动探索应用 UI、比对 PRD 与设计稿、生成测试用例并执行验证。

### 1.2 核心功能

| 模块 | 功能描述 |
|------|----------|
| 项目管理 | APK导入、PRD文档导入、设计稿导入、项目配置 |
| 模拟器管理 | AVD创建/启动/关闭、屏幕尺寸切换、横竖屏旋转 |
| AI探索引擎 | UI树抓取、可交互元素识别、路径遍历、PRD/设计稿比对 |
| 测试用例生成 | 路径转用例、异常路径识别、用例编辑与导出 |
| 测试执行引擎 | 用例回放、截图对比断言、实时日志输出 |
| 报告系统 | 桌面端实时报告、Web端报告、报告导出 |

### 1.3 目标用户

- 移动端测试工程师
- QA团队
- 开发人员（自测）

---

## 2. 技术栈

### 2.1 核心框架

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 桌面框架 | Electron | ^33.0.0 | 跨平台桌面应用运行时 |
| 前端框架 | React | ^18.2.0 | UI组件开发 |
| 语言 | TypeScript | ^5.3.3 | 类型安全编程语言 |

### 2.2 构建工具

| 工具 | 版本 | 用途 |
|------|------|------|
| electron-vite | ^6.5.0 | Electron专用构建工具 |
| Vite | ^5.0.12 | 快速构建工具 |
| Tailwind CSS | ^3.4.1 | CSS样式框架 |
| ESLint | ^8.56.0 | 代码质量检查 |

### 2.3 数据层

| 工具 | 版本 | 用途 |
|------|------|------|
| better-sqlite3 | ^11.0.0 | SQLite数据库驱动 |
| Knex.js | ^3.1.0 | SQL查询构建器 + 迁移管理 |

### 2.4 测试框架

| 工具 | 版本 | 用途 |
|------|------|------|
| Jest | ^29.7.0 | 单元测试框架 |

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 渲染进程 (Renderer)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           React + TypeScript + Tailwind CSS          │   │
│  │                                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │ 项目管理 │  │ 测试执行 │  │   报告展示        │   │   │
│  │  │ UI组件   │  │ UI组件   │  │   UI组件          │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │ Context Bridge                      │
└───────────────────────┼─────────────────────────────────────┘
                        │ IPC通信 (electron-vite preload)
┌───────────────────────▼─────────────────────────────────────┐
│                    Electron 主进程 (Main)                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Node.js + TypeScript                      │   │
│  │                                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │ AVD管理  │  │ 安全模块 │  │ 故障恢复机制     │   │   │
│  │  │ 模块     │  │          │  │                  │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │ 探索引擎 │  │ 测试执行 │  │  分布式追踪      │   │   │
│  │  │ 状态机   │  │ 引擎     │  │                  │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  └────────────────────┬────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────┘
                        │ SQLite
┌───────────────────────▼─────────────────────────────────────┐
│                    本地数据库                               │
│           better-sqlite3 + Knex.js                         │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ projects │  │test_runs │  │checkpoints│ │ oauth_   │    │
│  │          │  │          │  │          │ │ tokens   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ paths    │  │audit_logs│  │ settings │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 进程间通信

| 通道 | 用途 | 方向 |
|------|------|------|
| `contextBridge` | 渲染进程安全访问主进程API | Renderer → Main |
| `ipcRenderer.invoke` | 异步调用主进程方法 | Renderer → Main |
| `ipcRenderer.on` | 监听主进程事件 | Main → Renderer |

### 3.3 Electron安全配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `contextIsolation` | `true` | 隔离渲染进程与主进程 |
| `nodeIntegration` | `false` | 禁用Node.js集成 |
| `sandbox` | `true` | 启用沙箱模式 |
| `devTools` | `!app.isPackaged` | 生产环境禁用DevTools |

---

## 4. 核心模块

### 4.1 安全模块

**文件**: `src/main/core/security/encryption.ts`

提供 Token 加密/解密功能，支持 OAuth2 PKCE 流程：

- **加密算法**: AES-256-GCM
- **密钥管理**: DEK (Data Encryption Key) + 密钥包装
- **IV存储**: `EncryptedData` 接口包含 `dekIv` 字段，确保解密时使用正确的IV

**核心函数**:

| 函数 | 说明 |
|------|------|
| `encryptToken()` | 加密Token，返回包含IV的加密数据 |
| `decryptToken()` | 使用正确的IV解密Token |
| `generateState()` | 生成防CSRF的state参数 |
| `generateCodeVerifier()` | 生成PKCE code_verifier |

### 4.2 AVD管理模块

**文件**: `src/main/core/avd/AVDManager.ts`

管理 Android 模拟器生命周期：

- **启动参数**: `-no-snapshot`（移除 `-wipe-data`，避免清除被测App状态）
- **横竖屏旋转**: 通过ADB命令模拟传感器事件
- **状态监听**: 通过EventEmitter通知状态变化

### 4.3 故障恢复模块

**文件**: `src/main/core/resilience/`

包含三个核心组件：

| 组件 | 职责 |
|------|------|
| `HeartbeatManager` | 心跳检测，含 `isChecking` 互斥锁防止并发 |
| `RecoveryManager` | 崩溃恢复，使用上一个检查点恢复状态 |
| `UIFreezeDetector` | UI冻结检测，可配置检查间隔（默认5-10秒） |

### 4.4 AI探索引擎状态机

**文件**: `src/main/core/exploration/StateMachine.ts`

定义完整的状态转换矩阵：

```
IDLE → INIT → EXPLORING → COMPARING → GENERATING → DONE
                          ↖          ↖           ↖
                           ↘          ↘           ↘
                            ERROR ←←←←←←←←←←←←←←←
```

### 4.5 分布式追踪

**文件**: `src/main/core/tracing/TraceContext.ts`

支持 TraceID 生成与传递，用于 Electron ↔ Python IPC 通信追踪：

- **TraceID**: 全局唯一追踪标识
- **SpanID**: 单次操作标识
- **ParentSpanID**: 父子Span关联

### 4.6 日志系统

**文件**: `src/main/core/logger/Logger.ts`

4级日志体系：

| 级别 | 用途 |
|------|------|
| `debug` | 调试信息 |
| `info` | 一般信息 |
| `warn` | 警告信息 |
| `error` | 错误信息 |
| `fatal` | 致命错误 |

支持按模块分类日志：`main`, `avd`, `security`, `exploration`, `database`

---

## 5. 数据库设计

### 5.1 核心表结构

| 表名 | 用途 |
|------|------|
| `projects` | 项目基本信息 |
| `test_runs` | 测试运行记录 |
| `exploration_checkpoints` | 探索检查点 |
| `exploration_paths` | 探索路径 |
| `oauth_tokens` | OAuth令牌（加密存储） |
| `audit_logs` | 安全审计日志 |
| `settings` | 应用设置 |

### 5.2 数据加密

- **OAuth令牌**: AES-256-GCM 加密存储，包含 IV 和 authTag
- **敏感字段**: 使用 `EncryptedData` 格式存储

---

## 6. 安全架构

### 6.1 OAuth2安全

- **授权流程**: Authorization Code Flow + PKCE
- **Token存储**: AES-256-GCM 加密，DEK IV 独立存储
- **防CSRF**: `state` 参数验证

### 6.2 APK沙箱隔离

- 独立AVD实例
- 只读共享文件夹
- NAT网络隔离
- 恶意APK静态检测前置

### 6.3 内嵌浏览器安全

- sandbox模式
- 仅HTTPS
- 禁止 `file://` 协议
- Cookie隔离

---

## 7. 故障恢复

### 7.1 恢复策略

| 故障类型 | 恢复策略 |
|----------|----------|
| AVD崩溃 | Heartbeat检测 → 自动重启 → 使用检查点恢复 |
| UI冻结 | UIFreezeDetector检测 → 超时保护 → 强制恢复 |
| 主进程崩溃 | 状态持久化 → 重启后恢复 |

### 7.2 检查点机制

- **保存时机**: 每5个Activity或每5分钟
- **内容**: Activity名称、UI树哈希、路径记录、截图
- **去重**: SHA256哈希去重

---

## 8. 构建与CI/CD

### 8.1 构建脚本

| 脚本 | 命令 | 用途 |
|------|------|------|
| `dev` | `electron-vite dev` | 开发模式 |
| `build` | `electron-vite build` | 生产构建 |
| `lint` | `eslint . --ext .ts,.tsx` | 代码检查 |
| `test` | `jest` | 单元测试 |
| `migrate:latest` | `knex migrate:latest` | 数据库迁移 |

### 8.2 CI/CD流水线

**文件**: `.github/workflows/ci-cd.yml`

| 阶段 | 任务 |
|------|------|
| Lint | 代码质量检查 |
| Test | 单元测试 |
| Security | `pnpm audit` 安全扫描 |
| Build | 多平台构建（Windows/macOS/Linux） |

---

## 9. 开发环境

### 9.1 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | >= 20.x |
| pnpm | >= 8.x |
| Python | >= 3.10（AI引擎） |

### 9.2 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 执行数据库迁移
pnpm migrate:latest

# 运行测试
pnpm test

# 构建生产版本
pnpm build
```

### 9.3 目录结构

```
vtest/
├── src/
│   ├── main/              # 主进程
│   │   ├── index.ts       # 入口文件
│   │   └── core/          # 核心模块
│   │       ├── security/  # 安全模块
│   │       ├── avd/       # AVD管理
│   │       ├── resilience/# 故障恢复
│   │       ├── exploration/# AI探索
│   │       ├── database/  # 数据库
│   │       ├── tracing/   # 分布式追踪
│   │       └── logger/    # 日志
│   ├── preload/           # 预加载脚本
│   └── renderer/          # 渲染进程
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           └── index.css
├── docs/                  # 文档
├── .github/workflows/     # CI/CD配置
└── package.json
```

---

## 附录：关键决策记录

| 决策 | 结论 | 依据 |
|------|------|------|
| 工期 | 内部6个月，对外7个月 | Dev-Lead估算，460人天工作量 |
| 团队规模 | 8人（+0.5人AI引擎+1人PM） | 消除AI引擎单点故障 |
| 数据库 | better-sqlite3 + Knex.js | 轻量级、高性能、支持迁移 |
| 分支策略 | Trunk-Based + 短寿feature分支 | Round 2共识 |
| 测试策略 | 单元测试60% + 集成测试85% + E2E覆盖 | M3无法达到85%单测覆盖率 |

---

**文档结束**

*本文档基于VTest项目设计文档和已实现代码编制，如有疑问请联系架构师。*
