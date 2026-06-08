# VTest MVP 信息架构与导航模型

## 信息架构图 (IA)

```mermaid
graph TD
    subgraph App["VTest Application"]
        direction TB
        
        subgraph Nav["主导航"]
            N1[项目]
            N2[测试]
            N3[报告]
            N4[设备]
            N5[设置]
        end
        
        subgraph Project["项目模块"]
            P1[项目列表]
            P2[项目详情]
            P3[创建项目]
            P4[编辑项目]
        end
        
        subgraph Test["测试模块"]
            T1[测试控制台]
            T2[实时监控]
            T3[测试配置]
        end
        
        subgraph Report["报告模块"]
            R1[报告列表]
            R2[报告详情]
            R3[报告导出]
        end
        
        subgraph Device["设备模块"]
            D1[设备列表]
            D2[设备详情]
            D3[AVD管理]
        end
        
        subgraph Settings["设置模块"]
            S1[通用设置]
            S2[安全设置]
            S3[关于]
        end
        
        subgraph Global["全局功能"]
            G1[通知中心]
            G2[用户菜单]
            G3[帮助]
        end
    end
    
    N1 --> P1
    N2 --> T1
    N3 --> R1
    N4 --> D1
    N5 --> S1
    
    P1 --> P2
    P1 --> P3
    P2 --> P4
    
    T1 --> T2
    T1 --> T3
    
    R1 --> R2
    R2 --> R3
    
    D1 --> D2
    D1 --> D3

## 导航模型

### 主导航结构

| 导航项 | 路径 | 图标 | 权限 | 说明 |
|--------|------|------|------|------|
| 项目 | /projects | Folder | 公开 | 项目管理入口 |
| 测试 | /test | Play | 公开 | 测试执行入口 |
| 报告 | /reports | FileText | 公开 | 测试报告入口 |
| 设备 | /devices | Smartphone | 公开 | 设备管理入口 |
| 设置 | /settings | Settings | 公开 | 系统设置入口 |

### 页面层级

```
App Root
├── / (默认重定向到 /projects)
│
├── /projects
│   ├── /projects (列表页)
│   ├── /projects/:id (详情页)
│   ├── /projects/create (创建页)
│   └── /projects/:id/edit (编辑页)
│
├── /test
│   ├── /test (控制台)
│   ├── /test/:projectId/run (执行页)
│   └── /test/:projectId/monitor (监控页)
│
├── /reports
│   ├── /reports (列表页)
│   ├── /reports/:id (详情页)
│   └── /reports/:id/export (导出页)
│
├── /devices
│   ├── /devices (列表页)
│   ├── /devices/:id (详情页)
│   └── /devices/avd (AVD管理)
│
└── /settings
    ├── /settings/general (通用)
    ├── /settings/security (安全)
    └── /settings/about (关于)
```

### 面包屑规则

| 页面 | 面包屑 |
|------|--------|
| 项目列表 | 项目 |
| 项目详情 | 项目 > [项目名称] |
| 创建项目 | 项目 > 创建 |
| 编辑项目 | 项目 > [项目名称] > 编辑 |
| 测试控制台 | 测试 |
| 测试执行 | 测试 > [项目名称] |
| 测试监控 | 测试 > [项目名称] > 监控 |
| 报告列表 | 报告 |
| 报告详情 | 报告 > [报告名称] |
| 设备列表 | 设备 |
| 设备详情 | 设备 > [设备名称] |

### 页面跳转规则

#### 正向流程
```
项目列表 → 创建项目 → 项目详情 → 测试执行 → 测试监控 → 报告详情
```

#### 回退规则
- 详情页 → 列表页 (返回按钮)
- 创建/编辑 → 上级页面 (取消/保存后)
- 测试执行 → 项目详情 (停止/完成后)

#### 快捷入口
- 项目卡片上的"开始测试"按钮 → 直接跳转测试执行
- 报告卡片上的"查看详情" → 跳转报告详情
- 通知中的"查看报告" → 跳转报告详情

### 导航状态

```typescript
interface NavigationState {
  activeTab: 'projects' | 'test' | 'reports' | 'devices' | 'settings';
  breadcrumbs: BreadcrumbItem[];
  backPath?: string;
  isModalOpen: boolean;
}

interface BreadcrumbItem {
  label: string;
  path: string;
  isActive: boolean;
}
```

### 响应式导航

#### 桌面端 (>1024px)
- 左侧固定侧边栏导航
- 完整显示导航文字和图标

#### 平板端 (768-1024px)
- 左侧收缩导航栏
- 仅显示图标，hover显示文字

#### 移动端 (<768px)
- 底部Tab导航栏
- 最多显示5个主入口

### 键盘导航

| 快捷键 | 功能 |
|--------|------|
| Alt+1 | 跳转到项目 |
| Alt+2 | 跳转到测试 |
| Alt+3 | 跳转到报告 |
| Alt+4 | 跳转到设备 |
| Alt+5 | 跳转到设置 |
| Alt+← | 返回上一页 |
| Ctrl+K | 打开命令面板 |
