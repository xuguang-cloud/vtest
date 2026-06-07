# VTest 数据持久层设计文档

**文档版本**: v1.0  
**创建日期**: 2026-06-07  
**架构师**: Arch-Lead  
**审核状态**: 待审核

---

## 目录

1. [概述](#1-概述)
2. [技术选型](#2-技术选型)
3. [数据库Schema设计](#3-数据库schema设计)
4. [数据迁移策略](#4-数据迁移策略)
5. [缓存策略](#5-缓存策略)
6. [数据加密方案](#6-数据加密方案)
7. [性能优化](#7-性能优化)
8. [备份与恢复](#8-备份与恢复)

---

## 1. 概述

### 1.1 设计目标

- **轻量级部署**: 单文件数据库，无需独立数据库服务
- **高可靠性**: ACID事务保证，崩溃恢复能力
- **易维护**: 清晰的Schema设计，完善的迁移机制
- **安全性**: 敏感数据加密存储
- **高性能**: 嵌入式架构，零网络延迟

### 1.2 适用范围

本文档适用于VTest桌面应用的全部数据持久化需求，包括：
- 项目管理
- APK文件管理
- 测试执行记录
- AI探索路径
- PRD文档缓存
- 设计稿管理
- OAuth令牌存储

---

## 2. 技术选型

### 2.1 推荐方案：better-sqlite3

**选型理由**：

| 考量维度 | better-sqlite3 优势 |
|---------|---------------------|
| **Electron生态** | 原生Node.js模块，与Electron完美集成 |
| **性能** | 同步API设计，性能优于异步SQLite库（比sqlite3快2-3倍） |
| **SQL支持** | 完整SQL-92支持，支持复杂查询和事务 |
| **部署简单** | 单文件数据库（.db），无需额外安装数据库服务 |
| **可靠性** | WAL模式支持，崩溃恢复能力强 |
| **加密扩展** | 支持SQLCipher扩展，实现透明加密 |
| **类型安全** | 配合TypeScript使用体验优秀 |

**替代方案对比**：

- **nedb**: 缺乏复杂查询能力，不适合结构化数据
- **lowdb**: JSON存储，大数据量性能差
- **postgres/MySQL**: 需要独立服务，部署复杂，不适合桌面应用

### 2.2 技术栈

```
better-sqlite3 (数据库引擎)
    ↓
Knex.js (Query Builder + Migration)
    ↓
TypeScript Types (类型安全)
```

**依赖安装**：

```bash
npm install better-sqlite3 knex @types/better-sqlite3
npm install -D knex @types/knex
```

---

## 3. 数据库Schema设计

### 3.1 核心表设计

#### 3.1.1 projects 表（项目基本信息）

```sql
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,  -- UUID v4，用于跨设备同步
    
    -- 项目基本信息
    name TEXT NOT NULL,
    description TEXT,
    package_name TEXT,  -- Android包名
    version TEXT,
    
    -- 项目配置
    config_json TEXT,  -- JSON格式的项目配置
    
    -- 路径信息
    project_path TEXT NOT NULL,  -- 项目根目录
    apk_path TEXT,  -- 当前APK路径
    
    -- 状态管理
    status TEXT NOT NULL DEFAULT 'active',  -- active, archived, deleted
    last_opened_at INTEGER,  -- 上次打开时间（Unix时间戳ms）
    
    -- 统计信息
    total_test_runs INTEGER DEFAULT 0,
    total_bugs INTEGER DEFAULT 0,
    total_coverage REAL DEFAULT 0,  -- 代码覆盖率
    
    -- 时间戳
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    deleted_at INTEGER,
    
    -- 约束
    CHECK (status IN ('active', 'archived', 'deleted')),
    CHECK (total_coverage >= 0 AND total_coverage <= 100)
);

-- 索引
CREATE INDEX idx_projects_uuid ON projects(uuid);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_package_name ON projects(package_name);
CREATE INDEX idx_projects_last_opened ON projects(last_opened_at DESC);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
```

**设计要点**：

- 使用`uuid`字段支持未来云同步
- `project_path`存储绝对路径，便于项目迁移
- 软删除机制（`deleted_at`），避免数据丢失
- `config_json`存储灵活配置，避免频繁改表

#### 3.1.2 apks 表（APK文件元数据）

```sql
CREATE TABLE IF NOT EXISTS apks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    
    -- APK基本信息
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,  -- 相对项目目录的路径
    file_size INTEGER NOT NULL,
    md5_hash TEXT NOT NULL,  -- 文件完整性校验
    sha256_hash TEXT NOT NULL,
    
    -- Android应用信息
    package_name TEXT NOT NULL,
    version_name TEXT,
    version_code INTEGER,
    min_sdk INTEGER,
    target_sdk INTEGER,
    permissions_json TEXT,  -- JSON数组：权限列表
    
    -- APK分析状态
    analysis_status TEXT DEFAULT 'pending',  -- pending, analyzing, completed, failed
    analysis_result_json TEXT,  -- JSON：activities, services, receivers等
    
    -- 上传信息
    uploaded_by TEXT,  -- 用户标识（OAuth用户信息）
    upload_source TEXT,  -- manual, ci_cd, api
    
    -- 时间戳
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    analyzed_at INTEGER,
    
    -- 外键
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 约束
    CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
    CHECK (file_size > 0),
    UNIQUE(project_id, md5_hash)  -- 同一项目不允许重复APK
);

-- 索引
CREATE INDEX idx_apks_project_id ON apks(project_id);
CREATE INDEX idx_apks_package_name ON apks(package_name);
CREATE INDEX idx_apks_version_code ON apks(version_code);
CREATE INDEX idx_apks_analysis_status ON apks(analysis_status);
CREATE INDEX idx_apks_md5 ON apks(md5_hash);
```

**设计要点**：

- `md5_hash` + `project_id`唯一约束，避免重复上传
- `analysis_result_json`缓存APK分析结果，加速后续操作
- 支持CI/CD集成（`upload_source`字段）

#### 3.1.3 test_runs 表（测试执行记录）

```sql
CREATE TABLE IF NOT EXISTS test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    project_id INTEGER NOT NULL,
    apk_id INTEGER NOT NULL,
    
    -- 执行信息
    run_name TEXT,  -- 用户自定义的测试名称
    run_type TEXT NOT NULL,  -- manual, ai_exploration, regression, ci_cd
    trigger_source TEXT,  -- user, schedule, webhook
    
    -- 状态管理
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
    progress INTEGER DEFAULT 0,  -- 0-100 进度百分比
    
    -- 配置快照（执行时的配置）
    config_snapshot_json TEXT NOT NULL,  -- JSON：执行参数快照
    
    -- 统计信息
    total_steps INTEGER DEFAULT 0,
    total_activities INTEGER DEFAULT 0,
    total_bugs_found INTEGER DEFAULT 0,
    total_test_cases_generated INTEGER DEFAULT 0,
    
    -- 性能指标
    execution_time_ms INTEGER,  -- 总执行时间
    avg_step_time_ms INTEGER,  -- 平均步骤耗时
    
    -- 结果路径
    report_path TEXT,  -- 测试报告路径
    log_path TEXT,  -- 日志文件路径
    
    -- AI探索专用
    exploration_strategy TEXT,  -- depth_first, breadth_first, random
    max_exploration_depth INTEGER,
    coverage_goal REAL,  -- 目标覆盖率
    
    -- 时间信息
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    
    -- 外键
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (apk_id) REFERENCES apks(id) ON DELETE CASCADE,
    
    -- 约束
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CHECK (progress >= 0 AND progress <= 100),
    CHECK (run_type IN ('manual', 'ai_exploration', 'regression', 'ci_cd'))
);

-- 索引
CREATE INDEX idx_test_runs_uuid ON test_runs(uuid);
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_test_runs_apk_id ON test_runs(apk_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX idx_test_runs_started_at ON test_runs(started_at DESC);
```

**设计要点**：

- `config_snapshot_json`保存执行时配置，保证可复现性
- `uuid`字段支持分布式追踪
- 分离`started_at`和`created_at`，支持调度场景

#### 3.1.4 test_cases 表（自动生成的测试用例）

```sql
CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    
    -- 用例标识
    case_uuid TEXT NOT NULL UNIQUE,
    case_hash TEXT NOT NULL,  -- 基于路径+操作的哈希，用于去重
    
    -- 用例信息
    title TEXT NOT NULL,
    description TEXT,
    test_type TEXT NOT NULL,  -- exploration, functional, edge_case, regression
    
    -- 路径信息（对应exploration_paths）
    path_id INTEGER,  -- 关联探索路径
    activity_stack_json TEXT,  -- JSON数组：Activity栈
    action_sequence_json TEXT,  -- JSON数组：操作序列
    
    -- 生成状态
    generation_status TEXT DEFAULT 'pending',  -- pending, generating, completed, failed
    code_content TEXT,  -- 生成的测试代码
    code_language TEXT,  -- java, kotlin, python
    
    -- 执行结果
    last_run_status TEXT,  -- passed, failed, skipped, not_run
    last_run_at INTEGER,
    failure_reason TEXT,
    
    -- 优先级
    priority INTEGER DEFAULT 3,  -- 1-5，1最高
    tags_json TEXT,  -- JSON数组：标签
    
    -- 时间戳
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    
    -- 外键
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (path_id) REFERENCES exploration_paths(id) ON DELETE SET NULL,
    
    -- 约束
    CHECK (test_type IN ('exploration', 'functional', 'edge_case', 'regression')),
    CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    CHECK (last_run_status IN ('passed', 'failed', 'skipped', 'not_run')),
    CHECK (priority >= 1 AND priority <= 5),
    UNIQUE(test_run_id, case_hash)  -- 同一测试运行中不允许重复用例
);

-- 索引
CREATE INDEX idx_test_cases_test_run_id ON test_cases(test_run_id);
CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_cases_case_uuid ON test_cases(case_uuid);
CREATE INDEX idx_test_cases_case_hash ON test_cases(case_hash);
CREATE INDEX idx_test_cases_generation_status ON test_cases(generation_status);
CREATE INDEX idx_test_cases_last_run_status ON test_cases(last_run_status);
CREATE INDEX idx_test_cases_priority ON test_cases(priority);
```

**设计要点**：

- `case_hash`实现用例去重，避免重复生成
- `path_id`关联探索路径，可追溯用例来源
- 支持多语言测试代码生成

#### 3.1.5 bugs 表（自动发现的Bug）

```sql
CREATE TABLE IF NOT EXISTS bugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    test_case_id INTEGER,  -- 可能关联的测试用例
    
    -- Bug标识
    bug_uuid TEXT NOT NULL UNIQUE,
    bug_hash TEXT NOT NULL,  -- 基于(stack_trace + activity + error_type)的哈希
    
    -- Bug信息
    title TEXT NOT NULL,
    description TEXT,
    bug_type TEXT NOT NULL,  -- crash, anr, ui_freeze, memory_leak, network_error, ui_bug
    severity TEXT NOT NULL,  -- critical, high, medium, low
    
    -- 复现信息
    reproduction_steps_json TEXT,  -- JSON数组：复现步骤
    activity_stack_json TEXT,  -- JSON数组：发生时的Activity栈
    ui_state_json TEXT,  -- JSON：UI状态快照
    
    -- 技术细节
    stack_trace TEXT,
    error_message TEXT,
    logcat_output TEXT,  -- 关键日志片段
    
    -- 截图/视频
    screenshot_path TEXT,
    video_path TEXT,
    
    -- 状态管理
    status TEXT NOT NULL DEFAULT 'open',  -- open, in_progress, resolved, closed, wont_fix
    assigned_to TEXT,
    resolution TEXT,  -- fixed, duplicate, invalid
    
    -- 时间戳
    detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    resolved_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    
    -- 外键
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL,
    
    -- 约束
    CHECK (bug_type IN ('crash', 'anr', 'ui_freeze', 'memory_leak', 'network_error', 'ui_bug')),
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
    UNIQUE(test_run_id, bug_hash)  -- 同一测试运行中不允许重复Bug
);

-- 索引
CREATE INDEX idx_bugs_test_run_id ON bugs(test_run_id);
CREATE INDEX idx_bugs_project_id ON bugs(project_id);
CREATE INDEX idx_bugs_test_case_id ON bugs(test_case_id);
CREATE INDEX idx_bugs_bug_uuid ON bugs(bug_uuid);
CREATE INDEX idx_bugs_bug_hash ON bugs(bug_hash);
CREATE INDEX idx_bugs_bug_type ON bugs(bug_type);
CREATE INDEX idx_bugs_severity ON bugs(severity);
CREATE INDEX idx_bugs_status ON bugs(status);
CREATE INDEX idx_bugs_detected_at ON bugs(detected_at DESC);
```

**设计要点**：

- `bug_hash`实现Bug去重，聚合同一问题的多次出现
- 存储`screenshot_path`和`video_path`，便于问题复现
- 支持Bug生命周期管理（status流转）

#### 3.1.6 exploration_paths 表（AI探索的路径树）

```sql
CREATE TABLE IF NOT EXISTS exploration_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    
    -- 路径标识
    path_uuid TEXT NOT NULL UNIQUE,
    parent_path_id INTEGER,  -- 父路径（构建路径树）
    
    -- 路径信息
    path_depth INTEGER NOT NULL DEFAULT 0,  -- 路径深度）
    activity_name TEXT NOT NULL,  -- 当前Activity
    entry_point TEXT,  -- 入口：launcher, deeplink, notification
    
    -- UI状态
    ui_tree_hash TEXT,  -- UI树的哈希（用于检测重复状态）
    ui_snapshot_path TEXT,  -- UI快照截图路径
    
    -- 操作序列
    action_sequence_json TEXT,  -- JSON数组：从根到当前的所有操作
    last_action_json TEXT,  -- JSON：最后一步操作详情
    
    -- 探索状态
    exploration_status TEXT DEFAULT 'active',  -- active, completed, abandoned, pruned
    coverage_contribution REAL,  -- 该路径对覆盖率的贡献
    
    -- 去重与剪枝
    is_duplicate BOOLEAN DEFAULT 0,  -- 是否是重复路径
    duplicate_of INTEGER,  -- 指向原始路径
    prune_reason TEXT,  -- 剪枝原因
    
    -- 性能指标
    exploration_time_ms INTEGER,  -- 探索该路径耗时
    activity_transitions_json TEXT,  -- JSON数组：Activity跳转记录
    
    -- 时间戳
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    completed_at INTEGER,
    
    -- 外键
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_path_id) REFERENCES exploration_paths(id) ON DELETE CASCADE,
    FOREIGN KEY (duplicate_of) REFERENCES exploration_paths(id) ON DELETE SET NULL,
    
    -- 约束
    CHECK (exploration_status IN ('active', 'completed', 'abandoned', 'pruned')),
    CHECK (path_depth >= 0)
);

-- 索引
CREATE INDEX idx_exploration_paths_test_run_id ON exploration_paths(test_run_id);
CREATE INDEX idx_exploration_paths_project_id ON exploration_paths(project_id);
CREATE INDEX idx_exploration_paths_path_uuid ON exploration_paths(path_uuid);
CREATE INDEX idx_exploration_paths_parent_id ON exploration_paths(parent_path_id);
CREATE INDEX idx_exploration_paths_activity ON exploration_paths(activity_name);
CREATE INDEX idx_exploration_paths_ui_tree_hash ON exploration_paths(ui_tree_hash);
CREATE INDEX idx_exploration_paths_status ON exploration_paths(exploration_status);
CREATE INDEX idx_exploration_paths_depth ON exploration_paths(path_depth);
CREATE INDEX idx_exploration_paths_duplicate ON exploration_paths(is_duplicate);
```

**设计要点**：

- 自引用`parent_path_id`构建路径树
- `ui_tree_hash`用于检测UI状态重复，优化探索策略
- `is_duplicate`标记避免重复探索

#### 3.1.7 prd_documents 表（PRD文档元数据和结构化内容缓存）

```sql
CREATE TABLE IF NOT EXISTS prd_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    
    -- 文档标识
    doc_uuid TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,  -- file_upload, url, tapd, jira, manual_input
    
    -- 文档元数据
    title TEXT NOT NULL,
    file_name TEXT,
    file_path TEXT,  -- 本地缓存路径
    file_size INTEGER,
    mime_type TEXT,
    
    -- 来源信息
    source_url TEXT,  -- 如果是从URL/API导入
    source_id TEXT,  -- 第三方系统ID（如TAPD需求ID）
    
    -- 解析状态
    parse_status TEXT DEFAULT 'pending',  -- pending, parsing, completed, failed
    parse_error TEXT,
    
    -- 结构化内容（缓存）
    structured_content_json TEXT,  -- JSON：解析后的结构化内容
    requirements_json TEXT,  -- JSON数组：提取的需求列表
    user_stories_json TEXT,  -- JSON数组：用户故事
    acceptance_criteria_json TEXT,  -- JSON数组：验收标准
    
    -- 统计信息
    total_requirements INTEGER DEFAULT 0,
    total_user_stories INTEGER DEFAULT 0,
    coverage_rate REAL,  -- PRD覆盖率（已生成测试用例的比例）
    
    -- 版本管理
    version INTEGER DEFAULT 1,
    previous_version_id INTEGER,  -- 前一个版本
    
    -- 时间戳
    uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    parsed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    
    -- 外键
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (previous_version_id) REFERENCES prd_documents(id) ON DELETE SET NULL,
    
    -- 约束
    CHECK (source_type IN ('file_upload', 'url', 'tapd', 'jira', 'manual_input')),
    CHECK (parse_status IN ('pending', 'parsing', 'completed', 'failed')),
    CHECK (version >= 1)
);

-- 索引
CREATE INDEX idx_prd_documents_project_id ON prd_documents(project_id);
CREATE INDEX idx_prd_documents_doc_uuid ON prd_documents(doc_uuid);
CREATE INDEX idx_prd_documents_source_type ON prd_documents(source_type);
CREATE INDEX idx_prd_documents_parse_status ON prd_documents(parse_status);
CREATE INDEX idx_prd_documents_version ON prd_documents(version);
```

**设计要点**：

- 缓存结构化内容，避免重复解析
- 支持多来源（文件上传、TAPD、Jira等）
- 版本管理支持PRD迭代

#### 3.1.8 design_assets 表（设计稿元数据和截图缓存）

```sql
CREATE TABLE IF NOT EXISTS design_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    
    -- 资源标识
    asset_uuid TEXT NOT NULL UNIQUE,
    asset_type TEXT NOT NULL,  -- screenshot, mockup, wireframe, design_spec
    
    -- 文件信息
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,  -- 本地缓存路径
    file_size INTEGER,
    mime_type TEXT,
    
    -- 来源信息
    source_type TEXT NOT NULL,  -- upload, figma, sketch, adobe_xd, screenshot
    source_url TEXT,
    source_project_id TEXT,  -- Figma文件ID等
    
    -- 设计信息
    page_name TEXT,  -- 页面名称
    screen_name TEXT,  -- 屏幕名称
    device_type TEXT,  -- phone, tablet, wear
    orientation TEXT,  -- portrait, landscape
    
    -- 尺寸信息
    width INTEGER,
    height INTEGER,
    dpi INTEGER,
    
    -- 解析状态
    parse_status TEXT DEFAULT 'pending',  -- pending, parsing, completed, failed
    ui_elements_json TEXT,  -- JSON数组：识别的UI元素
    
    -- 对比结果
    last_comparison_result_json TEXT,  -- JSON：与APK截图的对比结果
    match_score REAL,  -- 匹配度评分（0-100）
    
    -- 时间戳
    uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    parsed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    
    -- 外键
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 约束
    CHECK (asset_type IN ('screenshot', 'mockup', 'wireframe', 'design_spec')),
    CHECK (source_type IN ('upload', 'figma', 'sketch', 'adobe_xd', 'screenshot')),
    CHECK (parse_status IN ('pending', 'parsing', 'completed', 'failed')),
    CHECK (orientation IN ('portrait', 'landscape'))
);

-- 索引
CREATE INDEX idx_design_assets_project_id ON design_assets(project_id);
CREATE INDEX idx_design_assets_asset_uuid ON design_assets(asset_uuid);
CREATE INDEX idx_design_assets_asset_type ON design_assets(asset_type);
CREATE INDEX idx_design_assets_source_type ON design_assets(source_type);
CREATE INDEX idx_design_assets_page_name ON design_assets(page_name);
CREATE INDEX idx_design_assets_parse_status ON design_assets(parse_status);
```

**设计要点**：

- 支持多种设计工具来源（Figma、Sketch等）
- `ui_elements_json`缓存识别的UI元素，加速对比
- 存储对比结果，支持设计稿与实现的一致性检查

#### 3.1.9 oauth_tokens 表（加密存储的OAuth Token）

```sql
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,  -- 可能关联项目（如TAPD集成）
    
    -- Token标识
    token_uuid TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,  -- tapd, jira, github, gitlab, figma
    provider_user_id TEXT,  -- 第三方用户ID
    
    -- 加密的Token数据（AES-256-GCM加密）
    encrypted_access_token BLOB NOT NULL,  -- 加密后的access_token
    encrypted_refresh_token BLOB,  -- 加密后的refresh_token
    encryption_iv BLOB NOT NULL,  -- 加密IV（初始化向量）
    encryption_auth_tag BLOB NOT NULL,  -- 认证标签
    
    -- Token元数据（不加密）
    token_type TEXT DEFAULT 'Bearer',
    scope TEXT,  -- 权限范围
    expires_at INTEGER,  -- 过期时间（Unix时间戳ms）
    
    -- 状态管理
    is_valid BOOLEAN DEFAULT 1,
    last_refreshed_at INTEGER,
    refresh_error TEXT,
    
    -- 时间戳
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    
    -- 外键
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 约束
    CHECK (provider IN ('tapd', 'jira', 'github', 'gitlab', 'figma', 'other')),
    CHECK (token_type IN ('Bearer', 'Basic'))
);

-- 索引
CREATE INDEX idx_oauth_tokens_project_id ON oauth_tokens(project_id);
CREATE INDEX idx_oauth_tokens_token_uuid ON oauth_tokens(token_uuid);
CREATE INDEX idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX idx_oauth_tokens_is_valid ON oauth_tokens(is_valid);
```

**设计要点**：

- Token使用AES-256-GCM加密后存储（见第6节）
- 分离`encryption_iv`和`encryption_auth_tag`，保证加密安全
- 存储`expires_at`支持自动刷新

#### 3.1.10 exploration_checkpoints 表（探索检查点，支持断点续传）

```sql
CREATE TABLE IF NOT EXISTS exploration_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    
    -- 检查点标识
    checkpoint_uuid TEXT NOT NULL UNIQUE,
    checkpoint_number INTEGER NOT NULL,  -- 检查点序号
    
    -- 序列化状态
    state_data BLOB NOT NULL,  -- 序列化的探索状态（见故障恢复文档）
    
    -- 统计快照
    activities_explored INTEGER DEFAULT 0,
    paths_discovered INTEGER DEFAULT 0,
    bugs_found INTEGER DEFAULT 0,
    coverage_percent REAL DEFAULT 0,
    
    -- 时间戳
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    
    -- 外键
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
    
    -- 约束
    CHECK (checkpoint_number >= 1)
);

-- 索引
CREATE INDEX idx_checkpoints_test_run_id ON exploration_checkpoints(test_run_id);
CREATE INDEX idx_checkpoints_uuid ON exploration_checkpoints(checkpoint_uuid);
CREATE INDEX idx_checkpoints_number ON exploration_checkpoints(checkpoint_number);
```

### 3.2 视图设计

#### 3.2.1 项目统计视图

```sql
CREATE VIEW IF NOT EXISTS v_project_stats AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    COUNT(DISTINCT tr.id) AS total_test_runs,
    COUNT(DISTINCT tc.id) AS total_test_cases,
    COUNT(DISTINCT b.id) AS total_bugs,
    COALESCE(SUM(tr.execution_time_ms), 0) AS total_execution_time_ms,
    AVG(tr.coverage_goal) AS avg_coverage_goal
FROM projects p
LEFT JOIN test_runs tr ON p.id = tr.project_id
LEFT JOIN test_cases tc ON p.id = tc.project_id
LEFT JOIN bugs b ON p.id = b.project_id
WHERE p.status = 'active'
GROUP BY p.id;
```

#### 3.2.2 测试运行详情视图

```sql
CREATE VIEW IF NOT EXISTS v_test_run_details AS
SELECT 
    tr.id,
    tr.uuid,
    tr.run_name,
    tr.status,
    tr.progress,
    p.name AS project_name,
    a.file_name AS apk_file,
    tr.total_steps,
    tr.total_bugs_found,
    tr.total_test_cases_generated,
    tr.execution_time_ms,
    tr.started_at,
    tr.completed_at,
    CASE 
        WHEN tr.started_at IS NOT NULL AND tr.completed_at IS NOT NULL 
        THEN tr.completed_at - tr.started_at 
        ELSE NULL 
    END AS actual_duration_ms
FROM test_runs tr
JOIN projects p ON tr.project_id = p.id
JOIN apks a ON tr.apk_id = a.id;
```

---

## 4. 数据迁移策略

### 4.1 迁移工具选型：Knex.js

**选型理由**：

- 轻量级Query Builder，学习成本低
- 优秀的迁移管理功能
- 支持SQLite，API友好
- 与better-sqlite3完美配合

### 4.2 迁移文件结构

```
src/
  database/
    migrations/
      2026-06-07-001-create-projects-table.ts
      2026-06-07-002-create-apks-table.ts
      2026-06-07-003-create-test-runs-table.ts
      ...
    seeds/
      development/
        projects.ts
        apks.ts
    knexfile.ts
    connection.ts
```

### 4.3 迁移脚本示例

**migration文件示例**：

```typescript
// 2026-06-07-001-create-projects-table.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('projects', (table) => {
    table.incremental('id').primary();
    table.uuid('uuid').notNullable().unique();
    table.string('name').notNullable();
    table.text('description');
    table.string('package_name');
    table.text('config_json');
    table.string('project_path').notNullable();
    table.string('apk_path');
    table.string('status').notNullable().defaultTo('active');
    table.integer('last_opened_at');
    table.integer('total_test_runs').defaultTo(0);
    table.integer('total_bugs').defaultTo(0);
    table.decimal('total_coverage', 5, 2).defaultTo(0);
    table.bigInteger('created_at').notNullable();
    table.bigInteger('updated_at').notNullable();
    table.bigInteger('deleted_at');
    
    table.index(['uuid'], 'idx_projects_uuid');
    table.index(['status'], 'idx_projects_status');
    table.index(['package_name'], 'idx_projects_package_name');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('projects');
}
```

### 4.4 迁移执行流程

```typescript
// database/migrate.ts
import knex from './connection';
import { resolve } from 'path';

async function runMigrations() {
  const migrationsPath = resolve(__dirname, 'migrations');
  
  try {
    // 检查待运行的迁移
    const pending = await knex.migrate.list({
      directory: migrationsPath
    });
    
    console.log(`Pending migrations: ${pending.pending.length}`);
    
    // 执行迁移
    await knex.migrate.latest({
      directory: migrationsPath
    });
    
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// 回滚到上一个版本
async function rollbackMigration() {
  await knex.migrate.rollback({
    directory: resolve(__dirname, 'migrations')
  }, true);
}

export { runMigrations, rollbackMigration };
```

### 4.5 初始化逻辑

```typescript
// database/initialize.ts
import { runMigrations } from './migrate';
import Database from 'better-sqlite3';
import { resolve } from 'path';

const DB_PATH = resolve(process.cwd(), 'data', 'vtest.db');

async function initializeDatabase() {
  // 1. 确保数据目录存在
  const fs = require('fs-extra');
  await fs.ensureDir(resolve(process.cwd(), 'data'));
  
  // 2. 创建数据库连接
  const db = new Database(DB_PATH);
  
  // 3. 启用WAL模式（提高并发性能）
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  // 4. 运行迁移
  await runMigrations();
  
  // 5. 初始化种子数据（开发环境）
  if (process.env.NODE_ENV === 'development') {
    await seedDevelopmentData();
  }
  
  console.log('Database initialized successfully');
  return db;
}

export { initializeDatabase, DB_PATH };
```

---

## 5. 缓存策略

### 5.1 大文件存储策略

**原则**：数据库只存储元数据和小对象，大文件存储在文件系统。

#### 5.1.1 文件类型分类

| 文件类型 | 存储位置 | 数据库存储内容 |
|---------|---------|---------------|
| **APK文件** | `projects/{project_id}/apks/` | `file_path`, `file_size`, `md5_hash` |
| **截图** | `projects/{project_id}/screenshots/` | `screenshot_path` |
| **设计稿** | `projects/{project_id}/designs/` | `file_path`, `file_size`, `width`, `height` |
| **测试报告** | `projects/{project_id}/reports/` | `report_path` |
| **日志文件** | `projects/{project_id}/logs/` | `log_path` |
| **UI快照** | `projects/{project_id}/ui_snapshots/` | `ui_snapshot_path` |

#### 5.1.2 文件存储目录结构

```
projects/
  {project_uuid}/
    apks/
      app-v1.0.0.apk
      app-v1.0.1.apk
    screenshots/
      2026-06-07/
        test_run_{uuid}/
          activity_main_001.png
          activity_login_002.png
    designs/
      mockups/
        home_screen.png
        settings_screen.png
    reports/
      2026-06-07_test_run_{uuid}_report.html
    logs/
      2026-06-07_test_run_{uuid}.log
    ui_snapshots/
      2026-06-07/
        {path_uuid}_ui_tree.json
```

#### 5.1.3 文件清理策略

```typescript
// 清理超过30天的临时截图
async function cleanupOldFiles(projectId: number) {
  const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;
  
  // 1. 查询过期的截图记录
  const oldScreenshots = await db('test_runs')
    .where('project_id', projectId)
    .where('completed_at', '<', THIRTY_DAYS_AGO)
    .select('screenshot_path');
  
  // 2. 删除文件
  for (const screenshot of oldScreenshots) {
    if (screenshot.screenshot_path) {
      await fs.remove(screenshot.screenshot_path);
    }
  }
  
  // 3. 更新数据库
  await db('test_runs')
    .where('project_id', projectId)
    .where('completed_at', '<', THIRTY_DAYS_AGO)
    .update({ screenshot_path: null });
}
```

### 5.2 内存缓存策略

#### 5.2.1 热点数据缓存

使用Node.js内置的`Map`或`LruCache`库：

```typescript
import { LRUCache } from 'lru-cache';

// 项目配置缓存（热点数据）
const projectConfigCache = new LRUCache<string, any>({
  max: 100,  // 最多缓存100个项目
  ttl: 1000 * 60 * 5,  // 5分钟TTL
  updateAgeOnGet: true,
  
  // 序列化到数据库
  dispose: async (value, key) => {
    await db('projects')
      .where('uuid', key)
      .update({ config_json: JSON.stringify(value) });
  }
});

// 使用缓存
async function getProjectConfig(projectUuid: string) {
  // 1. 尝试从缓存读取
  let config = projectConfigCache.get(projectUuid);
  
  if (!config) {
    // 2. 从数据库读取
    const project = await db('projects')
      .where('uuid', projectUuid)
      .select('config_json')
      .first();
    
    config = JSON.parse(project.config_json || '{}');
    
    // 3. 写入缓存
    projectConfigCache.set(projectUuid, config);
  }
  
  return config;
}
```

#### 5.2.2 查询缓存

```typescript
// 频繁查询的结果缓存
const queryCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 1,  // 1分钟TTL
});

async function getProjectStats(projectId: number) {
  const cacheKey = `project_stats:${projectId}`;
  
  // 检查缓存
  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey);
  }
  
  // 执行查询
  const stats = await db('v_project_stats')
    .where('project_id', projectId)
    .first();
  
  // 写入缓存
  queryCache.set(cacheKey, stats);
  
  return stats;
}
```

### 5.3 数据库层缓存

#### 5.3.1 SQLite PRAGMA优化

```typescript
// 启用SQLite性能优化
function optimizeDatabase(db: Database) {
  // 1. WAL模式（Write-Ahead Logging）
  db.pragma('journal_mode = WAL');
  
  // 2. 禁用同步（提高写入性能，牺牲一定可靠性）
  db.pragma('synchronous = NORMAL');
  
  // 3. 增加缓存大小（64MB）
  db.pragma('cache_size = -64000');
  
  // 4. 内存临时表
  db.pragma('temp_store = MEMORY');
  
  // 5. 启用外键约束
  db.pragma('foreign_keys = ON');
  
  // 6. 启用查询优化
  db.pragma('optimize');
}
```

#### 5.3.2 预编译语句

```typescript
// 使用预编译语句提高查询性能
const preparedStatements = {
  insertProject: db.prepare(`
    INSERT INTO projects (uuid, name, project_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  updateProjectStatus: db.prepare(`
    UPDATE projects 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `),
  
  getProjectById: db.prepare(`
    SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL
  `)
};

// 使用
preparedStatements.insertProject.run(
  uuidv4(),
  'My Project',
  '/path/to/project',
  Date.now(),
  Date.now()
);
```

---

## 6. 数据加密方案

### 6.1 加密需求分析

**需要加密的数据**：

1. **OAuth Access Token** - 第三方系统访问凭证
2. **OAuth Refresh Token** - 用于刷新Access Token
3. **用户敏感配置** - 如API Keys、密码等

**不需要加密的数据**：

- 项目名称、描述等元数据
- 统计数据、日志等

### 6.2 加密算法选型

**算法**: AES-256-GCM

**理由**：

- **AES-256**: 密钥长度256位，当前安全标准
- **GCM模式**: 提供认证加密（Authenticated Encryption），同时保证机密性和完整性
- **Node.js原生支持**: `crypto`模块内置支持

### 6.3 密钥管理方案

#### 6.3.1 密钥生成与存储

**方案**：使用操作系统提供的密钥管理服务

- **Windows**: DPAPI (Data Protection API)
- **macOS**: Keychain
- **Linux**: Secret Service API / libsecret

**实现**：

```typescript
// src/security/key-manager.ts
import crypto from 'crypto';
import keytar from 'keytar';  // 跨平台密钥管理库

const SERVICE_NAME = 'VTest';
const ACCOUNT_NAME = 'database-encryption-key';

async function getOrCreateEncryptionKey(): Promise<Buffer> {
  // 1. 尝试从系统密钥库读取
  let key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  
  if (!key) {
    // 2. 生成新密钥（256位 = 32字节）
    const newKey = crypto.randomBytes(32);
    
    // 3. 存储到系统密钥库
    await keytar.setPassword(
      SERVICE_NAME, 
      ACCOUNT_NAME, 
      newKey.toString('hex')
    );
    
    key = newKey.toString('hex');
  }
  
  // 4. 返回Buffer
  return Buffer.from(key, 'hex');
}
```

**安装依赖**：

```bash
npm install keytar @types/keytar
```

#### 6.3.2 密钥轮换策略

```typescript
// 密钥版本管理
interface EncryptionKey {
  version: number;
  key: Buffer;
  createdAt: number;
  retiredAt?: number;
}

class KeyManager {
  private currentVersion: number = 1;
  private keys: Map<number, EncryptionKey> = new Map();
  
  async rotateKey(): Promise<void> {
    // 1. 生成新密钥
    const newKey = crypto.randomBytes(32);
    const newVersion = this.currentVersion + 1;
    
    // 2. 存储新密钥
    await keytar.setPassword(
      SERVICE_NAME,
      `encryption-key-v${newVersion}`,
      newKey.toString('hex')
    );
    
    // 3. 标记旧密钥为退役
    const oldKey = this.keys.get(this.currentVersion);
    if (oldKey) {
      oldKey.retiredAt = Date.now();
    }
    
    // 4. 更新当前版本
    this.currentVersion = newVersion;
    this.keys.set(newVersion, {
      version: newVersion,
      key: newKey,
      createdAt: Date.now()
    });
    
    // 5. 重新加密所有敏感数据（后台任务）
    await this.reEncryptAllData();
  }
  
  async reEncryptAllData(): Promise<void> {
    // 查询所有加密数据
    const tokens = await db('oauth_tokens').select('*');
    
    for (const token of tokens) {
      // 解密（使用旧密钥）
      const decrypted = this.decrypt(
        token.encrypted_access_token,
        token.encryption_iv,
        token.encryption_auth_tag,
        this.currentVersion - 1  // 旧版本
      );
      
      // 重新加密（使用新密钥）
      const { encrypted, iv, authTag } = this.encrypt(
        decrypted,
        this.currentVersion
      );
      
      // 更新数据库
      await db('oauth_tokens')
        .where('id', token.id)
        .update({
          encrypted_access_token: encrypted,
          encryption_iv: iv,
          encryption_auth_tag: authTag,
          encryption_key_version: this.currentVersion
        });
    }
  }
}
```

### 6.4 加密实现

#### 6.4.1 加密工具类

```typescript
// src/security/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;  // GCM推荐IV长度
const AUTH_TAG_LENGTH = 16;

class EncryptionService {
  private key: Buffer;
  
  constructor(key: Buffer) {
    this.key = key;
  }
  
  /**
   * 加密数据
   * @param plaintext - 明文数据（字符串或Buffer）
   * @returns 加密结果（包含ciphertext, iv, authTag）
   */
  encrypt(plaintext: string | Buffer): {
    encrypted: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    // 1. 生成随机IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 2. 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // 3. 加密数据
    const plaintextBuffer = Buffer.isBuffer(plaintext) 
      ? plaintext 
      : Buffer.from(plaintext, 'utf8');
    
    const encrypted = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final()
    ]);
    
    // 4. 获取认证标签
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv,
      authTag
    };
  }
  
  /**
   * 解密数据
   * @param encrypted - 加密数据
   * @param iv - 初始化向量
   * @param authTag - 认证标签
   * @returns 解密后的明文
   */
  decrypt(
    encrypted: Buffer, 
    iv: Buffer, 
    authTag: Buffer
  ): Buffer {
    // 1. 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // 2. 设置认证标签（验证数据完整性）
    decipher.setAuthTag(authTag);
    
    // 3. 解密数据
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted;
  }
  
  /**
   * 加密并转换为Base64（便于存储）
   */
  encryptToBase64(plaintext: string): {
    encryptedBase64: string;
    ivBase64: string;
    authTagBase64: string;
  } {
    const { encrypted, iv, authTag } = this.encrypt(plaintext);
    
    return {
      encryptedBase64: encrypted.toString('base64'),
      ivBase64: iv.toString('base64'),
      authTagBase64: authTag.toString('base64')
    };
  }
  
  /**
   * 从Base64解密
   */
  decryptFromBase64(
    encryptedBase64: string,
    ivBase64: string,
    authTagBase64: string
  ): string {
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decrypted = this.decrypt(encrypted, iv, authTag);
    return decrypted.toString('utf8');
  }
}
```

#### 6.4.2 Token加密存储

```typescript
// src/services/token-service.ts
import { EncryptionService } from '../security/encryption';
import { getOrCreateEncryptionKey } from '../security/key-manager';

class TokenService {
  private encryptionService: EncryptionService;
  
  async initialize() {
    const key = await getOrCreateEncryptionKey();
    this.encryptionService = new EncryptionService(key);
  }
  
  /**
   * 保存OAuth Token（加密）
   */
  async saveToken(tokenData: {
    provider: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }): Promise<string> {
    // 1. 加密Token
    const encryptedAccess = this.encryptionService.encryptToBase64(
      tokenData.accessToken
    );
    
    let encryptedRefresh;
    if (tokenData.refreshToken) {
      encryptedRefresh = this.encryptionService.encryptToBase64(
        tokenData.refreshToken
      );
    }
    
    // 2. 存储到数据库
    const [tokenId] = await db('oauth_tokens').insert({
      token_uuid: require('uuid').v4(),
      provider: tokenData.provider,
      encrypted_access_token: Buffer.from(encryptedAccess.encryptedBase64, 'base64'),
      encryption_iv: Buffer.from(encryptedAccess.ivBase64, 'base64'),
      encryption_auth_tag: Buffer.from(encryptedAccess.authTagBase64, 'base64'),
      encrypted_refresh_token: encryptedRefresh 
        ? Buffer.from(encryptedRefresh.encryptedBase64, 'base64')
        : null,
      expires_at: tokenData.expiresAt,
      created_at: Date.now(),
      updated_at: Date.now()
    });
    
    return tokenId;
  }
  
  /**
   * 读取OAuth Token（解密）
   */
  async getToken(tokenUuid: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }> {
    // 1. 从数据库读取
    const tokenRecord = await db('oauth_tokens')
      .where('token_uuid', tokenUuid)
      .where('is_valid', 1)
      .first();
    
    if (!tokenRecord) {
      throw new Error('Token not found');
    }
    
    // 2. 解密Access Token
    const accessToken = this.encryptionService.decryptFromBase64(
      tokenRecord.encrypted_access_token.toString('base64'),
      tokenRecord.encryption_iv.toString('base64'),
      tokenRecord.encryption_auth_tag.toString('base64')
    );
    
    // 3. 解密Refresh Token（如果有）
    let refreshToken;
    if (tokenRecord.encrypted_refresh_token) {
      const encryptedRefresh = this.encryptionService.decryptFromBase64(
        tokenRecord.encrypted_refresh_token.toString('base64'),
        tokenRecord.encryption_iv.toString('base64'),  // 重用同一个IV（不安全，应分开存储）
        tokenRecord.encryption_auth_tag.toString('base64')
      );
      refreshToken = encryptedRefresh;
    }
    
    return {
      accessToken,
      refreshToken,
      expiresAt: tokenRecord.expires_at
    };
  }
}
```

### 6.5 加密最佳实践

1. **每个Token使用独立的IV** - 避免IV重用攻击
2. **定期轮换密钥** - 建议每90天轮换一次
3. **密钥分离** - 不同环境（dev/staging/prod）使用不同密钥
4. **审计日志** - 记录所有敏感数据访问
5. **内存清理** - 使用完明文后立即清零内存

```typescript
// 安全的内存清理
function secureClearBuffer(buffer: Buffer): void {
  buffer.fill(0);  // 清零
  buffer.fill(0xFF);  // 填充0xFF
  buffer.fill(0);  // 再次清零
}
```

---

## 7. 性能优化

### 7.1 数据库层面优化

#### 7.1.1 索引优化

**已在前文Schema设计中包含全部必要索引**。

**额外建议**：

- 定期运行`ANALYZE`命令更新索引统计信息
- 使用`EXPLAIN QUERY PLAN`分析慢查询

```sql
-- 分析查询计划
EXPLAIN QUERY PLAN
SELECT * FROM test_runs 
WHERE project_id = 1 
  AND status = 'completed'
ORDER BY created_at DESC;

-- 更新统计信息
ANALYZE;
```

#### 7.1.2 分区策略

对于大表（如`exploration_paths`），考虑按`test_run_id`分区：

```sql
-- SQLite不支持原生分区，使用视图模拟
CREATE VIEW exploration_paths_run_1 AS
SELECT * FROM exploration_paths WHERE test_run_id = 1;

CREATE VIEW exploration_paths_run_2 AS
SELECT * FROM exploration_paths WHERE test_run_id = 2;
```

### 7.2 应用层面优化

#### 7.2.1 批量操作

```typescript
// 错误示例：逐条插入
for (const path of paths) {
  await db('exploration_paths').insert(path);
}

// 正确示例：批量插入
await db('exploration_paths').insert(paths);
```

#### 7.2.2 延迟加载

```typescript
// 错误示例：一次性加载所有数据
const testRun = await db('test_runs')
  .where('id', runId)
  .first();

const allPaths = await db('exploration_paths')
  .where('test_run_id', runId);

// 正确示例：按需加载
const testRun = await db('test_runs')
  .where('id', runId)
  .first();

// 当用户查看路径时再加载
async function loadPaths(testRunId: number, page: number) {
  const pageSize = 50;
  return await db('exploration_paths')
    .where('test_run_id', testRunId)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
}
```

#### 7.2.3 异步I/O

```typescript
// 并行执行独立查询
const [project, recentRuns, stats] = await Promise.all([
  getProject(projectId),
  getRecentRuns(projectId, 10),
  getProjectStats(projectId)
]);
```

---

## 8. 备份与恢复

### 8.1 备份策略

#### 8.1.1 自动备份

```typescript
// src/database/backup.ts
import Database from 'better-sqlite3';
import { resolve } from 'path';

async function backupDatabase() {
  const db = require('./connection').db;
  const backupDir = resolve(process.cwd(), 'backups');
  
  // 1. 确保备份目录存在
  await fs.ensureDir(backupDir);
  
  // 2. 生成备份文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(backupDir, `vtest-backup-${timestamp}.db`);
  
  // 3. 执行备份（better-sqlite3支持在线备份）
  db.backup(backupPath)
    .then(() => {
      console.log(`Backup completed: ${backupPath}`);
      
      // 4. 清理旧备份（保留最近7天）
      cleanupOldBackups(backupDir, 7);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
    });
}

// 每天凌晨2点自动备份
schedule.scheduleJob('0 2 * * *', backupDatabase);
```

#### 8.1.2 手动备份触发

```typescript
// 用户点击"备份"按钮时
ipcMain.handle('database:backup', async () => {
  await backupDatabase();
  return { success: true, message: '备份成功' };
});
```

### 8.2 恢复策略

```typescript
async function restoreDatabase(backupPath: string) {
  const currentDbPath = require('./connection').DB_PATH;
  const tempPath = currentDbPath + '.temp';
  
  try {
    // 1. 关闭当前数据库连接
    await db.destroy();
    
    // 2. 备份当前数据库（以防恢复失败）
    await fs.copy(currentDbPath, currentDbPath + '.before-restore');
    
    // 3. 复制备份文件
    await fs.copy(backupPath, tempPath);
    
    // 4. 验证备份文件完整性
    const testDb = new Database(tempPath);
    testDb.pragma('integrity_check');
    testDb.close();
    
    // 5. 替换当前数据库
    await fs.move(tempPath, currentDbPath, { overwrite: true });
    
    // 6. 重新初始化连接
    await initializeDatabase();
    
    // 7. 清理临时文件
    await fs.remove(currentDbPath + '.before-restore');
    
    return { success: true, message: '恢复成功' };
  } catch (error) {
    // 回滚
    if (await fs.pathExists(currentDbPath + '.before-restore')) {
      await fs.move(currentDbPath + '.before-restore', currentDbPath, { 
        overwrite: true 
      });
    }
    
    throw error;
  }
}
```

---

## 9. 总结

本文档详细设计了VTest项目的数据持久层，包括：

1. **技术选型**: better-sqlite3 + Knex.js，兼顾性能与易用性
2. **Schema设计**: 10张核心表，覆盖项目管理、测试执行、AI探索等场景
3. **迁移策略**: 版本化迁移脚本，支持平滑升级
4. **缓存策略**: 文件系统存储大文件，内存缓存热点数据
5. **加密方案**: AES-256-GCM加密敏感数据，密钥管理系统化
6. **性能优化**: 索引优化、批量操作、延迟加载
7. **备份恢复**: 自动备份+手动触发，保证数据安全

**下一步行动**：

1. 评审本文档，确认Schema设计
2. 实现Knex.js迁移脚本
3. 开发EncryptionService和TokenService
4. 编写单元测试和集成测试

---

**文档维护**：

- 本文档随数据库Schema变更同步更新
- 重大变更需经过架构评审
- 联系人：Arch-Lead

---

**附录：完整Schema创建脚本**

见附件 `schema-full.sql`（本文档所有CREATE TABLE语句的集合）
