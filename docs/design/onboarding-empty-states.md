# VTest MVP Onboarding & 空状态UX设计

## Onboarding 首次使用引导

### 目标
- 帮助新用户快速理解 VTest 的核心功能
- 引导完成首个项目的创建和测试执行
- 降低学习成本，提升首次使用体验

### 引导流程

```mermaid
graph LR
    A[欢迎页] --> B[功能概览]
    B --> C[创建首个项目]
    C --> D[连接设备]
    D --> E[执行首次测试]
    E --> F[完成引导]
```

### 步骤详情

#### 步骤1: 欢迎页
- **触发条件**: 首次启动应用，无历史项目
- **内容**:
  - 应用Logo和标语
  - 简短功能介绍（3-4个核心特性）
  - "开始体验" 按钮
- **跳过**: 提供"跳过引导"选项，直接进入主界面

#### 步骤2: 功能概览
- **内容**:
  - 3步快速介绍：项目创建、设备连接、测试执行
  - 每项配有简洁图标和说明
- **交互**: 左右滑动浏览，底部进度指示器

#### 步骤3: 创建首个项目
- **内容**:
  - 预置示例项目（可选）
  - 或引导填写基本信息创建新项目
- **表单字段**:
  - 项目名称（必填）
  - 描述（选填）
  - APK路径（必填，文件选择器）

#### 步骤4: 连接设备
- **内容**:
  - 自动检测设备
  - 设备连接状态展示
  - 未检测到设备时的引导

#### 步骤5: 执行首次测试
- **内容**:
  - 单按钮触发测试
  - 实时进度展示
  - 简要状态说明

#### 步骤6: 完成引导
- **内容**:
  - 恭喜信息
  - 快速链接到报告查看
  - "开始使用"按钮

### Onboarding 状态管理

```typescript
interface OnboardingState {
  isFirstTime: boolean;
  completedSteps: OnboardingStep[];
  currentStep: OnboardingStep;
  skipped: boolean;
}

type OnboardingStep =
  | 'welcome'
  | 'overview'
  | 'createProject'
  | 'connectDevice'
  | 'runTest'
  | 'complete';
```

### 设计原则

1. **渐进式披露**: 每步只展示必要信息
2. **可跳过**: 用户可随时退出引导
3. **可重复**: 设置中可重新查看引导
4. **上下文感知**: 根据用户操作动态调整引导内容

---

## 空状态 (Empty States) UX设计

### 设计原则

1. **清晰说明**: 明确告诉用户当前状态及原因
2. **引导行动**: 提供明确的下一步操作
3. **视觉友好**: 使用插画/图标，避免纯文字
4. **积极语调**: 保持鼓励性的文案

### 空状态清单

#### 1. 项目列表 - 无项目

```
[图标] 空文件夹图标
[标题] 还没有项目
[描述] 创建第一个项目开始自动化测试
[操作] [创建项目] [导入项目]
```

#### 2. 测试执行 - 无测试记录

```
[图标] 播放按钮+问号
[标题] 暂无测试执行
[描述] 选择项目并启动测试，开始探索应用
[操作] [选择项目] [了解测试流程]
```

#### 3. 报告列表 - 无报告

```
[图标] 文档图标
[标题] 还没有测试报告
[描述] 完成一次测试后，报告将在这里展示
[操作] [去执行测试]
```

#### 4. 设备列表 - 无设备

```
[图标] 设备图标+感叹号
[标题] 未检测到设备
[描述] 请连接Android设备或配置AVD模拟器
[操作] [刷新设备列表] [配置AVD]
```

#### 5. 测试监控 - 等待开始

```
[图标] 时钟图标
[标题] 等待测试启动
[描述] 选择项目后点击"开始测试"
[操作] [选择项目]
```

#### 6. 报告详情 - 无步骤数据

```
[图标] 清单图标
[标题] 暂无步骤数据
[描述] 测试执行中或执行完成后将展示详细步骤
[操作] [返回报告列表]
```

#### 7. 错误状态 - 通用

```
[图标] 错误图标
[标题] 出错了
[描述] {{动态错误信息}}
[操作] [重试] [返回首页]
```

### 空状态组件规范

```typescript
interface EmptyStateProps {
  /** 图标/插画组件 */
  icon: React.ReactNode;
  /** 标题 */
  title: string;
  /** 描述文本 */
  description: string;
  /** 主要操作按钮 */
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** 次要操作按钮 */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** 是否显示引导提示 */
  showHint?: boolean;
}
```

### 空状态使用示例

```tsx
// 项目列表示例
<EmptyState
  icon={<FolderOpenIcon />}
  title="还没有项目"
  description="创建第一个项目开始自动化测试"
  primaryAction={{
    label: "创建项目",
    onClick: handleCreateProject
  }}
  secondaryAction={{
    label: "导入项目",
    onClick: handleImportProject
  }}
  showHint={isFirstTime}
/>

// 设备列表示例
<EmptyState
  icon={<DeviceIcon />}
  title="未检测到设备"
  description="请连接Android设备或配置AVD模拟器"
  primaryAction={{
    label: "刷新设备列表",
    onClick: handleRefreshDevices
  }}
  secondaryAction={{
    label: "配置AVD",
    onClick: handleConfigureAVD
  }}
/>
```

### 视觉规范

#### 布局
- 垂直居中，内容最大宽度 400px
- 图标尺寸: 64x64px
- 标题: 16px, 中等字重
- 描述: 14px, 常规字重, 次要文本色
- 按钮间距: 16px

#### 颜色
- 图标: 次要文本色 (#999)
- 标题: 主文本色 (#333)
- 描述: 次要文本色 (#999)
- 按钮: 主色调按钮

### 状态映射表

| 页面 | 空状态条件 | 图标 | 标题 | 主要操作 | 次要操作 |
|------|----------|------|------|---------|---------|
| 项目列表 | projects.length === 0 | FolderOpen | 还没有项目 | 创建项目 | 导入项目 |
| 测试执行 | !selectedProject | Play | 暂无测试执行 | 选择项目 | 了解流程 |
| 报告列表 | reports.length === 0 | Document | 还没有测试报告 | 去执行测试 | - |
| 设备列表 | devices.length === 0 | Device | 未检测到设备 | 刷新设备 | 配置AVD |
| 报告详情 | !steps || steps.length === 0 | List | 暂无步骤数据 | 返回列表 | - |
