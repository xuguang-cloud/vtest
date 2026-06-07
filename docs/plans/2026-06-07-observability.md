# VTest 可观测性方案设计文档

**文档版本**: v1.0  
**创建日期**: 2026-06-07  
**作者**: DevOps-Lead  
**审核状态**: 待审核

---

## 目录

1. [概述](#1-概述)
2. [日志系统架构](#2-日志系统架构)
3. [性能监控](#3-性能监控)
4. [错误追踪](#4-错误追踪)
5. [用户行为埋点](#5-用户行为埋点)
6. [告警策略](#6-告警策略)
7. [附录：完整配置示例](#7-附录完整配置示例)

---

## 1. 概述

### 1.1 设计目标

- **全面可观测**: 覆盖前端、后端、基础设施的全链路监控
- **实时响应**: 关键错误 5 分钟内告警，性能指标实时展示
- **用户授权**: 所有数据收集需用户明确授权，支持完全关闭
- **性能优先**: 监控本身不影响应用性能（< 1% CPU 开销）
- **数据安全**: 敏感日志脱敏，传输加密，存储加密

### 1.2 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                       VTest 桌面应用                        │
├─────────────────────────────────────────────────────────────┤
│  渲染进程                │  主进程                │ Python  │
│  ├─ 性能监控            │  ├─ 崩溃报告          │  ├─ 日志 │
│  ├─ 错误捕获            │  ├─ 日志收集          │  ├─ 指标 │
│  └─ 用户行为埋点        │  └─ 更新管理          │  └─ 追踪 │
└─────────────────────────────────────────────────────────────┘
                            ↓
              ┌─────────────────────────────┐
              │   本地日志文件 + SQLite      │
              └─────────────────────────────┘
                            ↓ (用户授权)
              ┌─────────────────────────────┐
              │   后端收集服务               │
              │   (可选，企业版)            │
              └─────────────────────────────┘
                            ↓
              ┌─────────────────────────────┐
              │   Grafana + Loki + Tempo    │
              │   (可观测性后端)            │
              └─────────────────────────────┘
```

---

## 2. 日志系统架构

### 2.1 日志分层设计

```
┌────────────────────────────────────────────────────────┐
│                    日志生产者                           │
├────────────────────────────────────────────────────────┤
│  主进程          │  渲染进程      │  Python 服务     │
│  (Main)         │  (Renderer)   │  (Backend)       │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│                    日志收集层                           │
│  IPC 通信 + 日志聚合器                                 │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│                    日志存储层                           │
│  文件轮转 + SQLite + (可选) 远程服务                  │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│                    日志展示层                           │
│  桌面端内嵌日志查看器 + (可选) Web 界面               │
└────────────────────────────────────────────────────────┘
```

### 2.2 主进程日志配置

#### 使用 electron-log

```typescript
// src/main/logger.ts
import log from 'electron-log'
import path from 'path'
import { app } from 'electron'

// 配置日志
export function setupLogging() {
  const logDir = path.join(app.getPath('userData'), 'logs')
  
  // 日志格式
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  
  // 日志文件配置
  log.transports.file.resolvePath = () => 
    path.join(logDir, `main-${new Date().toISOString().split('T')[0]}.log`)
  
  // 文件轮转配置
  log.transports.file.maxSize = 10 * 1024 * 1024  // 10MB
  log.transports.file.archiveLog = (oldLogPath) => {
    const info = path.parse(oldLogPath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return path.join(info.dir, `${info.name}.${timestamp}${info.ext}`)
  }
  
  // 日志级别
  log.transports.file.level = 'info'
  log.transports.console.level = 'debug'
  
  // 按日期分割
  setInterval(() => {
    log.transports.file.resolvePath = () => 
      path.join(logDir, `main-${new Date().toISOString().split('T')[0]}.log`)
  }, 60000)  // 每分钟检查一次
  
  // 捕获未处理的异常
  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error)
  })
  
  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection:', reason)
  })
  
  return log
}

// 导出日志实例
export const logger = log
```

#### 日志级别规范

```typescript
// src/shared/log-levels.ts

export enum LogLevel {
  ERROR = 'error',     // 错误：影响功能使用，需要立即处理
  WARN = 'warn',       // 警告：潜在问题，不影响使用
  INFO = 'info',       // 信息：重要流程节点
  DEBUG = 'debug',     // 调试：详细调试信息
  TRACE = 'trace',     // 追踪：最详细的追踪信息
}

// 日志级别说明
export const LogLevelDescriptions = {
  [LogLevel.ERROR]: '系统错误，功能不可用',
  [LogLevel.WARN]: '潜在问题，功能可正常使用',
  [LogLevel.INFO]: '关键业务流程节点',
  [LogLevel.DEBUG]: '调试信息，开发环境使用',
  [LogLevel.TRACE]: '详细追踪，性能分析使用',
}

// 各模块日志级别配置
export const ModuleLogLevel = {
  MAIN: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  RENDERER: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
  PYTHON: LogLevel.INFO,
  AVD: LogLevel.WARN,
}
```

### 2.3 渲染进程日志

#### 通过 IPC 发送到主进程

```typescript
// src/renderer/logger.ts
import { ipcRenderer } from 'electron'

export class RendererLogger {
  private moduleName: string
  
  constructor(moduleName: string) {
    this.moduleName = moduleName
  }
  
  private send(level: string, message: string, meta?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.moduleName,
      message,
      meta,
      // 获取调用栈（可选）
      stack: process.env.NODE_ENV === 'development' ? new Error().stack : undefined,
    }
    
    // 发送到主进程
    ipcRenderer.send('log-entry', logEntry)
    
    // 同时在控制台显示
    if (process.env.NODE_ENV === 'development') {
      console[level](`[${this.moduleName}] ${message}`, meta)
    }
  }
  
  error(message: string, meta?: any) {
    this.send('error', message, meta)
  }
  
  warn(message: string, meta?: any) {
    this.send('warn', message, meta)
  }
  
  info(message: string, meta?: any) {
    this.send('info', message, meta)
  }
  
  debug(message: string, meta?: any) {
    this.send('debug', message, meta)
  }
  
  trace(message: string, meta?: any) {
    this.send('trace', message, meta)
  }
}

// 使用示例
export const logger = new RendererLogger('AppRenderer')

// 在渲染进程中
logger.info('页面加载完成', { page: 'home', loadTime: 1234 })
logger.error('API 请求失败', { url: '/api/test', error: 'Timeout' })
```

#### 主进程接收渲染进程日志

```typescript
// src/main/ipc-handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { logger } from './logger'

export function setupLogIPC(mainWindow: BrowserWindow) {
  ipcMain.on('log-entry', (event, logEntry) => {
    const { level, module, message, meta, stack } = logEntry
    
    // 添加到主进程日志
    logger[level](`[Renderer:${module}] ${message}`, meta)
    
    // 如果是错误，同时记录堆栈
    if (level === 'error' && stack) {
      logger.error(`[Renderer:${module}] Stack:`, stack)
    }
    
    // 转发到日志查看器（如果打开）
    mainWindow.webContents.send('log-entry', logEntry)
  })
}
```

### 2.4 后端 Python 服务日志

#### 使用 Python logging 模块

```python
# src/python/logger.py
import logging
import logging.handlers
import json
import os
from datetime import datetime
from pathlib import Path

class JSONFormatter(logging.Formatter):
    """JSON 格式的日志格式化器"""
    
    def format(self, record):
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'module': record.module,
            'message': record.getMessage(),
            'process_id': record.process,
            'thread_id': record.thread,
        }
        
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        if hasattr(record, 'meta'):
            log_entry['meta'] = record.meta
            
        return json.dumps(log_entry, ensure_ascii=False)

def setup_logging(app_name='vtest'):
    """配置日志系统"""
    
    # 创建日志目录
    log_dir = Path.home() / f'.{app_name}' / 'logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # 根日志器
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)
    
    # 文件处理器（按日期轮转）
    file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=log_dir / 'backend.log',
        when='midnight',
        interval=1,
        backupCount=30,  # 保留 30 天
        encoding='utf-8'
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(JSONFormatter())
    
    # 错误日志单独存储
    error_handler = logging.handlers.RotatingFileHandler(
        filename=log_dir / 'error.log',
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=10,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(JSONFormatter())
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG if os.getenv('DEBUG') else logging.INFO)
    console_handler.setFormatter(
        logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')
    )
    
    # 添加处理器
    logger.addHandler(file_handler)
    logger.addHandler(error_handler)
    logger.addHandler(console_handler)
    
    return logger

# 使用示例
if __name__ == '__main__':
    logger = setup_logging()
    
    logger.debug('调试信息', extra={'meta': {'user_id': 123}})
    logger.info('服务启动成功', extra={'meta': {'port': 8080}})
    logger.warning('内存使用率过高', extra={'meta': {'usage': '85%'}})
    logger.error('数据库连接失败', extra={'meta': {'db_host': 'localhost'}})
```

#### 集成到 Flask/FastAPI

```python
# src/python/app.py
from flask import Flask, request
from flask.logging import default_handler
import logging
from .logger import setup_logging, JSONFormatter

app = Flask(__name__)

# 配置日志
setup_logging()

@app.before_request
def log_request():
    """记录每个请求"""
    app.logger.info(
        f'Request: {request.method} {request.path}',
        extra={
            'meta': {
                'method': request.method,
                'path': request.path,
                'remote_addr': request.remote_addr,
                'user_agent': request.headers.get('User-Agent'),
            }
        }
    )

@app.after_request
def log_response(response):
    """记录响应"""
    app.logger.info(
        f'Response: {response.status_code}',
        extra={
            'meta': {
                'status_code': response.status_code,
                'content_length': response.content_length,
            }
        }
    )
    return response

@app.errorhandler(Exception)
def log_exception(error):
    """记录未处理的异常"""
    app.logger.error(
        f'Unhandled Exception: {str(error)}',
        exc_info=True,
        extra={
            'meta': {
                'path': request.path,
                'method': request.method,
            }
        }
    )
    return {'error': 'Internal Server Error'}, 500
```

### 2.5 AVD 模拟器日志

```typescript
// src/main/avd-logger.ts
import { spawn, ChildProcess } from 'child_process'
import { logger } from './logger'
import { EventEmitter } from 'events'

export class AVDLogger extends EventEmitter {
  private avdProcess: ChildProcess | null = null
  private logBuffer: string[] = []
  
  constructor() {
    super()
  }
  
  public startLogging(avdPath: string) {
    // 启动 AVD 并捕获日志
    this.avdProcess = spawn(
      'emulator',
      ['-avd', 'test-avd', '-logcat', '*:V'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )
    
    // 捕获标准输出
    this.avdProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      lines.forEach(line => this.parseLogLine(line, 'stdout'))
    })
    
    // 捕获标准错误
    this.avdProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      lines.forEach(line => this.parseLogLine(line, 'stderr'))
    })
    
    // 进程退出
    this.avdProcess.on('close', (code) => {
      logger.info(`AVD process exited with code ${code}`)
      this.emit('exit', code)
    })
  }
  
  private parseLogLine(line: string, source: 'stdout' | 'stderr') {
    // 解析 Android logcat 格式
    // 示例: 06-07 10:23:45.123  1234  5678 I Tag: Message
    
    const match = line.match(
      /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([A-Z])\s+(.+?):\s+(.*)$/
    )
    
    if (match) {
      const [, timestamp, pid, tid, level, tag, message] = match
      
      const logEntry = {
        timestamp,
        pid,
        tid,
        level: this.mapAndroidLevel(level),
        tag,
        message,
        source,
      }
      
      // 存储到缓冲区
      this.logBuffer.push(JSON.stringify(logEntry))
      if (this.logBuffer.length > 1000) {
        this.logBuffer.shift()
      }
      
      // 发送到主进程日志
      logger.debug(`[AVD:${tag}] ${message}`)
      
      // 触发事件
      this.emit('log', logEntry)
    }
  }
  
  private mapAndroidLevel(level: string): string {
    const map = {
      'V': 'trace',
      'D': 'debug',
      'I': 'info',
      'W': 'warn',
      'E': 'error',
      'F': 'fatal',
    }
    return map[level] || 'info'
  }
  
  public getLogs(filter?: { level?: string; tag?: string }): string[] {
    let logs = this.logBuffer
    
    if (filter?.level) {
      logs = logs.filter(line => {
        const entry = JSON.parse(line)
        return entry.level === filter.level
      })
    }
    
    if (filter?.tag) {
      logs = logs.filter(line => {
        const entry = JSON.parse(line)
        return entry.tag.includes(filter.tag)
      })
    }
    
    return logs
  }
  
  public stopLogging() {
    if (this.avdProcess) {
      this.avdProcess.kill()
      this.avdProcess = null
    }
  }
}
```

### 2.6 日志级别动态调整

```typescript
// src/main/log-level-manager.ts
import { BrowserWindow } from 'electron'
import { logger } from './logger'

export class LogLevelManager {
  private currentLevel: string
  private mainWindow: BrowserWindow
  
  constructor(mainWindow: BrowserWindow, initialLevel = 'info') {
    this.mainWindow = mainWindow
    this.currentLevel = initialLevel
    this.applyLogLevel(initialLevel)
  }
  
  public setLogLevel(level: string) {
    this.currentLevel = level
    this.applyLogLevel(level)
    
    logger.info(`Log level changed to: ${level}`)
    
    // 通知渲染进程
    this.mainWindow.webContents.send('log-level-changed', level)
  }
  
  private applyLogLevel(level: string) {
    const levels = ['trace', 'debug', 'info', 'warn', 'error']
    const targetIndex = levels.indexOf(level)
    
    // 动态更新 electron-log 级别
    logger.transports.file.level = level
    logger.transports.console.level = level
    
    // 可以在这里添加其他日志系统的级别调整
  }
  
  public getLogLevel(): string {
    return this.currentLevel
  }
}
```

### 2.7 日志查询界面（桌面端内嵌）

```typescript
// src/renderer/components/LogViewer.tsx
import React, { useState, useEffect, useRef } from 'react'
import { RendererLogger } from '../logger'

const logger = new RendererLogger('LogViewer')

interface LogEntry {
  timestamp: string
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  module: string
  message: string
  meta?: any
}

export const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState({
    level: 'all',
    module: '',
    keyword: '',
  })
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // 监听主进程发送的日志
    const { ipcRenderer } = window.require('electron')
    
    ipcRenderer.on('log-entry', (event, logEntry) => {
      setLogs(prev => [...prev, logEntry].slice(-1000))  // 只保留最近 1000 条
      
      if (autoScroll && logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      }
    })
    
    // 加载历史日志
    loadHistoryLogs()
    
    return () => {
      ipcRenderer.removeAllListeners('log-entry')
    }
  }, [])
  
  const loadHistoryLogs = async () => {
    const { ipcRenderer } = window.require('electron')
    const historyLogs = await ipcRenderer.invoke('get-history-logs')
    setLogs(historyLogs)
  }
  
  const filteredLogs = logs.filter(log => {
    if (filter.level !== 'all' && log.level !== filter.level) {
      return false
    }
    if (filter.module && !log.module.includes(filter.module)) {
      return false
    }
    if (filter.keyword && !log.message.includes(filter.keyword)) {
      return false
    }
    return true
  })
  
  const levelColors = {
    trace: '#999',
    debug: '#666',
    info: '#1890ff',
    warn: '#faad14',
    error: '#f5222d',
  }
  
  const exportLogs = () => {
    const { ipcRenderer } = window.require('electron')
    ipcRenderer.invoke('export-logs', filteredLogs)
    logger.info('导出日志', { count: filteredLogs.length })
  }
  
  const clearLogs = () => {
    setLogs([])
    logger.info('清空日志')
  }
  
  return (
    <div className="log-viewer">
      <div className="log-toolbar">
        <select
          value={filter.level}
          onChange={e => setFilter({ ...filter, level: e.target.value })}
        >
          <option value="all">所有级别</option>
          <option value="error">错误</option>
          <option value="warn">警告</option>
          <option value="info">信息</option>
          <option value="debug">调试</option>
          <option value="trace">追踪</option>
        </select>
        
        <input
          type="text"
          placeholder="模块过滤..."
          value={filter.module}
          onChange={e => setFilter({ ...filter, module: e.target.value })}
        />
        
        <input
          type="text"
          placeholder="关键词搜索..."
          value={filter.keyword}
          onChange={e => setFilter({ ...filter, keyword: e.target.value })}
        />
        
        <label>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
          />
          自动滚动
        </label>
        
        <button onClick={exportLogs}>导出</button>
        <button onClick={clearLogs}>清空</button>
      </div>
      
      <div className="log-container" ref={logContainerRef}>
        {filteredLogs.map((log, index) => (
          <div
            key={index}
            className={`log-entry log-level-${log.level}`}
            style={{ color: levelColors[log.level] }}
          >
            <span className="log-timestamp">{log.timestamp}</span>
            <span className="log-level">[{log.level.toUpperCase()}]</span>
            <span className="log-module">[{log.module}]</span>
            <span className="log-message">{log.message}</span>
            {log.meta && (
              <pre className="log-meta">{JSON.stringify(log.meta, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .log-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 12px;
        }
        
        .log-toolbar {
          padding: 8px;
          background: #f5f5f5;
          border-bottom: 1px solid #ddd;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .log-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          background: #1e1e1e;
          color: #d4d4d4;
        }
        
        .log-entry {
          padding: 2px 0;
          border-bottom: 1px solid #2d2d2d;
        }
        
        .log-timestamp {
          color: #858585;
          margin-right: 8px;
        }
        
        .log-level {
          font-weight: bold;
          margin-right: 8px;
        }
        
        .log-module {
          color: #9cdcfe;
          margin-right: 8px;
        }
        
        .log-message {
          color: #d4d4d4;
        }
        
        .log-meta {
          margin: 4px 0 4px 20px;
          padding: 4px;
          background: #2d2d2d;
          border-radius: 4px;
          font-size: 11px;
          color: #ce9178;
        }
      `}</style>
    </div>
  )
}
```

---

## 3. 性能监控

### 3.1 前端性能监控

#### 使用 Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Start static server
        run: |
          npm install -g serve
          serve -s dist -l 3000 &
          
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli@0.12.x
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
          
      - name: Upload Lighthouse results
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-results
          path: .lighthouseci/
```

#### Lighthouse CI 配置

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      // 测试的 URL
      url: [
        'http://localhost:3000',
        'http://localhost:3000/explorer',
        'http://localhost:3000/settings',
      ],
      numberOfRuns: 3,  // 运行 3 次取平均值
    },
    assert: {
      assertions: {
        // 性能分数要求
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        
        // 具体指标要求
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'interactive': ['error', { maxNumericValue: 5000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',  // 或 'lhci-server'
    },
  },
}
```

#### 客户端性能监控（Real User Monitoring）

```typescript
// src/renderer/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  
  constructor() {
    this.init()
  }
  
  private init() {
    // 监听页面加载性能
    window.addEventListener('load', () => {
      this.collectPageLoadMetrics()
    })
    
    // 监听路由变化（如果是 SPA）
    this.observeRouteChanges()
    
    // 监听长任务
    this.observeLongTasks()
    
    // 监听资源加载
    this.observeResourceTiming()
  }
  
  private collectPageLoadMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    const metrics = {
      // DNS 查询时间
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      
      // TCP 连接时间
      tcp: navigation.connectEnd - navigation.connectStart,
      
      // 首字节时间（TTFB）
      ttfb: navigation.responseStart - navigation.requestStart,
      
      // DOM 解析时间
      domParsing: navigation.domInteractive - navigation.responseEnd,
      
      // 页面完全加载时间
      loadComplete: navigation.loadEventEnd - navigation.startTime,
      
      // FP (First Paint)
      fp: this.getFirstPaint(),
      
      // FCP (First Contentful Paint)
      fcp: this.getFirstContentfulPaint(),
      
      // LCP (Largest Contentful Paint)
      lcp: this.getLargestContentfulPaint(),
    }
    
    this.reportMetrics('page-load', metrics)
  }
  
  private getFirstPaint(): number {
    const entries = performance.getEntriesByName('first-paint')
    return entries.length > 0 ? entries[0].startTime : 0
  }
  
  private getFirstContentfulPaint(): number {
    const entries = performance.getEntriesByName('first-contentful-paint')
    return entries.length > 0 ? entries[0].startTime : 0
  }
  
  private getLargestContentfulPaint(): number {
    return new Promise((resolve) => {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1]
        resolve(lastEntry.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
  }
  
  private observeLongTasks() {
    if ('PerformanceObserver' in window) {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const longTask = entry as PerformanceEntry & { duration: number }
          if (longTask.duration > 50) {
            this.reportMetrics('long-task', {
              duration: longTask.duration,
              startTime: longTask.startTime,
            })
          }
        })
      }).observe({ entryTypes: ['longtask'] })
    }
  }
  
  private observeResourceTiming() {
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource')
      
      const resourceMetrics = resources.map(resource => ({
        name: resource.name,
        type: this.getResourceType(resource.name),
        duration: resource.duration,
        size: (resource as PerformanceResourceTiming).transferSize,
      }))
      
      // 统计资源加载时间
      const slowResources = resourceMetrics.filter(r => r.duration > 1000)
      if (slowResources.length > 0) {
        this.reportMetrics('slow-resources', { resources: slowResources })
      }
    })
  }
  
  private getResourceType(url: string): string {
    if (url.match(/\.(js|mjs)$/)) return 'script'
    if (url.match(/\.css$/)) return 'stylesheet'
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image'
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font'
    return 'other'
  }
  
  private observeRouteChanges() {
    // 如果是使用 React Router 或 Vue Router
    // 在这里监听路由变化并收集性能指标
  }
  
  public reportMetrics(type: string, data: any) {
    // 存储到本地
    if (!this.metrics.has(type)) {
      this.metrics.set(type, [])
    }
    this.metrics.get(type)!.push(data)
    
    // 发送到主进程
    const { ipcRenderer } = window.require('electron')
    ipcRenderer.send('performance-metric', {
      type,
      data,
      timestamp: Date.now(),
    })
  }
  
  public getMetrics(): Record<string, any[]> {
    const result: Record<string, any[]> = {}
    this.metrics.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
}
```

### 3.2 后端性能监控

#### Python 性能分析

```python
# src/python/performance.py
import time
import functools
import cProfile
import pstats
import io
from contextlib import contextmanager
from .logger import logger

class PerformanceMonitor:
    """性能监控装饰器和上下文管理器"""
    
    def __init__(self):
        self.metrics = {}
    
    def measure(self, name: str = None):
        """装饰器：测量函数执行时间"""
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                metric_name = name or f"{func.__module__}.{func.__name__}"
                start_time = time.time()
                
                try:
                    result = func(*args, **kwargs)
                    return result
                finally:
                    elapsed_time = (time.time() - start_time) * 1000  # 转换为毫秒
                    self.record_metric(metric_name, elapsed_time)
                    
                    if elapsed_time > 1000:  # 超过 1 秒记录警告
                        logger.warning(
                            f'Slow function: {metric_name}',
                            extra={'meta': {'duration_ms': elapsed_time}}
                        )
            return wrapper
        return decorator
    
    @contextmanager
    def profile(self, name: str):
        """上下文管理器：性能分析"""
        profiler = cProfile.Profile()
        profiler.enable()
        
        start_time = time.time()
        yield
        elapsed_time = (time.time() - start_time) * 1000
        
        profiler.disable()
        
        # 输出性能分析结果
        stream = io.StringIO()
        stats = pstats.Stats(profiler, stream=stream).sort_stats('cumulative')
        stats.print_stats(20)  # 只显示前 20 行
        
        logger.debug(
            f'Performance profile: {name}',
            extra={
                'meta': {
                    'duration_ms': elapsed_time,
                    'profile': stream.getvalue()
                }
            }
        )
        
        self.record_metric(name, elapsed_time)
    
    def record_metric(self, name: str, value: float):
        """记录指标"""
        if name not in self.metrics:
            self.metrics[name] = []
        self.metrics[name].append(value)
        
        # 保持最近 100 条记录
        if len(self.metrics[name]) > 100:
            self.metrics[name] = self.metrics[name][-100:]
    
    def get_metrics(self) -> dict:
        """获取所有指标统计"""
        result = {}
        for name, values in self.metrics.items():
            result[name] = {
                'count': len(values),
                'avg': sum(values) / len(values),
                'min': min(values),
                'max': max(values),
                'p95': self.percentile(values, 95),
                'p99': self.percentile(values, 99),
            }
        return result
    
    @staticmethod
    def percentile(values: list, percentile: int) -> float:
        """计算百分位数"""
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile / 100)
        return sorted_values[index]

# 全局实例
monitor = PerformanceMonitor()

# 使用示例
@monitor.measure()
def process_device_logs(device_id: str):
    """处理设备日志（自动测量执行时间）"""
    time.sleep(0.5)  # 模拟耗时操作
    return {'status': 'ok'}

@monitor.measure(name='custom_name')
def another_function():
    pass

def example_usage():
    # 使用上下文管理器
    with monitor.profile('batch_processing'):
        for i in range(100):
            process_device_logs(f'device_{i}')
    
    # 获取性能指标
    metrics = monitor.get_metrics()
    print(metrics)
```

#### 集成到 Flask/FastAPI

```python
# src/python/middleware.py
from flask import request, g
from .performance import monitor
import time

def setup_performance_middleware(app):
    @app.before_request
    def before_request():
        g.start_time = time.time()
    
    @app.after_request
    def after_request(response):
        if hasattr(g, 'start_time'):
            elapsed_time = (time.time() - g.start_time) * 1000
            
            # 记录请求耗时
            monitor.record_metric(
                f'{request.method}:{request.endpoint}',
                elapsed_time
            )
            
            # 慢请求警告
            if elapsed_time > 1000:
                app.logger.warning(
                    f'Slow request: {request.method} {request.path}',
                    extra={
                        'meta': {
                            'duration_ms': elapsed_time,
                            'endpoint': request.endpoint,
                        }
                    }
                )
            
            # 添加响应头
            response.headers['X-Response-Time'] = f'{elapsed_time:.2f}ms'
        
        return response
```

### 3.3 AVD 资源监控

```typescript
// src/main/avd-monitor.ts
import { spawn } from 'child_process'
import { logger } from './logger'
import { EventEmitter } from 'events'

interface ResourceMetrics {
  timestamp: number
  cpu: number
  memory: {
    total: number
    used: number
    free: number
  }
  disk: {
    total: number
    used: number
    free: number
  }
}

export class AVDMonitor extends EventEmitter {
  private avdName: string
  private interval: NodeJS.Timeout | null = null
  private metrics: ResourceMetrics[] = []
  
  constructor(avdName: string) {
    super()
    this.avdName = avdName
  }
  
  public start(intervalMs: number = 5000) {
    this.interval = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)
    
    logger.info(`AVD monitor started for ${this.avdName}`)
  }
  
  public stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    
    logger.info(`AVD monitor stopped for ${this.avdName}`)
  }
  
  private async collectMetrics() {
    try {
      const [cpu, memory, disk] = await Promise.all([
        this.getCPUMetrics(),
        this.getMemoryMetrics(),
        this.getDiskMetrics(),
      ])
      
      const metrics: ResourceMetrics = {
        timestamp: Date.now(),
        cpu,
        memory,
        disk,
      }
      
      this.metrics.push(metrics)
      
      // 只保留最近 100 条记录
      if (this.metrics.length > 100) {
        this.metrics.shift()
      }
      
      // 发送实时更新
      this.emit('metrics', metrics)
      
      // 检查阈值
      this.checkThresholds(metrics)
      
      logger.debug(`AVD metrics collected`, { meta: metrics })
    } catch (error) {
      logger.error(`Failed to collect AVD metrics`, { meta: { error } })
    }
  }
  
  private async getCPUMetrics(): Promise<number> {
    // 使用 adb shell 获取 CPU 使用率
    const { exec } = require('child_process')
    const util = require('util')
    const execPromise = util.promisify(exec)
    
    try {
      const { stdout } = await execPromise(
        `adb -s emulator-5554 shell top -n 1 | grep -E "init|system" | awk '{sum += $3} END {print sum}'`
      )
      
      return parseFloat(stdout.trim()) || 0
    } catch {
      return 0
    }
  }
  
  private async getMemoryMetrics(): Promise<any> {
    const { exec } = require('child_process')
    const util = require('util')
    const execPromise = util.promisify(exec)
    
    try {
      const { stdout } = await execPromise(
        `adb -s emulator-5554 shell cat /proc/meminfo`
      )
      
      const lines = stdout.split('\n')
      const memInfo: any = {}
      
      lines.forEach(line => {
        const match = line.match(/^(\w+):\s+(\d+)\s+kB$/)
        if (match) {
          memInfo[match[1]] = parseInt(match[2]) * 1024  // 转换为字节
        }
      })
      
      const total = memInfo.MemTotal || 0
      const free = memInfo.MemFree || 0
      const available = memInfo.MemAvailable || free
      
      return {
        total,
        used: total - available,
        free: available,
      }
    } catch {
      return { total: 0, used: 0, free: 0 }
    }
  }
  
  private async getDiskMetrics(): Promise<any> {
    const { exec } = require('child_process')
    const util = require('util')
    const execPromise = util.promisify(exec)
    
    try {
      const { stdout } = await execPromise(
        `adb -s emulator-5554 shell df /data`
      )
      
      const lines = stdout.split('\n')
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/)
        return {
          total: parseInt(parts[1]) * 1024,
          used: parseInt(parts[2]) * 1024,
          free: parseInt(parts[3]) * 1024,
        }
      }
      
      return { total: 0, used: 0, free: 0 }
    } catch {
      return { total: 0, used: 0, free: 0 }
    }
  }
  
  private checkThresholds(metrics: ResourceMetrics) {
    // CPU 阈值
    if (metrics.cpu > 90) {
      logger.warn(`AVD CPU usage high: ${metrics.cpu}%`, {
        meta: { avd: this.avdName, cpu: metrics.cpu }
      })
    }
    
    // 内存阈值
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100
    if (memoryUsagePercent > 85) {
      logger.warn(`AVD memory usage high: ${memoryUsagePercent.toFixed(1)}%`, {
        meta: { avd: this.avdName, memory: metrics.memory }
      })
    }
    
    // 磁盘阈值
    const diskUsagePercent = (metrics.disk.used / metrics.disk.total) * 100
    if (diskUsagePercent > 90) {
      logger.warn(`AVD disk usage high: ${diskUsagePercent.toFixed(1)}%`, {
        meta: { avd: this.avdName, disk: metrics.disk }
      })
    }
  }
  
  public getMetrics(): ResourceMetrics[] {
    return this.metrics
  }
  
  public getLatestMetrics(): ResourceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }
}
```

---

## 4. 错误追踪

### 4.1 Electron crashReporter 配置

```typescript
// src/main/crash-reporter.ts
import { crashReporter } from 'electron'
import { logger } from './logger'

export function setupCrashReporter() {
  // 配置崩溃报告
  crashReporter.start({
    submitURL: 'https://your-crash-server.com/submit',
    uploadToServer: false,  // 默认不自动上传，等待用户授权
    ignoreSystemCrashHandler: true,
    rateLimit: true,
    compress: true,
    
    // 额外信息
    extra: {
      version: process.env.npm_package_version || 'unknown',
      platform: process.platform,
      arch: process.arch,
      // 不要包含敏感信息！
    },
  })
  
  logger.info('Crash reporter initialized')
  
  // 监听崩溃事件
  process.on('crash', () => {
    logger.error('Renderer process crashed')
  })
  
  process.on('renderer-process-crashed', (event, webContents, killed) => {
    logger.error('Renderer process crashed', {
      meta: { killed, webContentsId: webContents.id }
    })
  })
}
```

### 4.2 自动上报（可选，用户授权）

```typescript
// src/renderer/error-reporter.ts
import { RendererLogger } from './logger'

const logger = new RendererLogger('ErrorReporter')

export class ErrorReporter {
  private enabled: boolean = false
  private serverURL: string = 'https://your-error-server.com/api/errors'
  
  constructor() {
    this.loadSettings()
    this.setupGlobalErrorHandlers()
  }
  
  private loadSettings() {
    // 从配置文件加载用户偏好
    const { ipcRenderer } = window.require('electron')
    const settings = ipcRenderer.sendSync('get-settings')
    this.enabled = settings.errorReportingEnabled || false
  }
  
  public enable() {
    this.enabled = true
    this.saveSettings()
    logger.info('Error reporting enabled')
  }
  
  public disable() {
    this.enabled = false
    this.saveSettings()
    logger.info('Error reporting disabled')
  }
  
  private saveSettings() {
    const { ipcRenderer } = window.require('electron')
    ipcRenderer.send('save-settings', {
      errorReportingEnabled: this.enabled,
    })
  }
  
  private setupGlobalErrorHandlers() {
    // 捕获未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        type: 'unhandledrejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now(),
      })
    })
    
    // 捕获全局错误
    window.addEventListener('error', (event) => {
      this.reportError({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now(),
      })
    })
  }
  
  public reportError(errorInfo: any) {
    if (!this.enabled) {
      logger.debug('Error reporting disabled, skipping', { meta: errorInfo })
      return
    }
    
    // 脱敏处理
    const sanitizedError = this.sanitizeError(errorInfo)
    
    // 添加到队列（批量上报）
    this.queueError(sanitizedError)
  }
  
  private sanitizeError(error: any): any {
    const sanitized = { ...error }
    
    // 移除敏感信息
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret']
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***'
      }
    })
    
    // 移除用户数据路径
    if (sanitized.stack) {
      sanitized.stack = sanitized.stack.replace(
        /C:\\Users\\[^\\]+/g,
        'C:\\Users\\<redacted>'
      )
    }
    
    return sanitized
  }
  
  private errorQueue: any[] = []
  private flushTimeout: NodeJS.Timeout | null = null
  
  private queueError(error: any) {
    this.errorQueue.push(error)
    
    // 防抖：等待 10 秒后批量上报
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
    }
    
    this.flushTimeout = setTimeout(() => {
      this.flushErrors()
    }, 10000)
  }
  
  private async flushErrors() {
    if (this.errorQueue.length === 0) {
      return
    }
    
    const errorsToSend = [...this.errorQueue]
    this.errorQueue = []
    
    try {
      const response = await fetch(this.serverURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appVersion: process.env.npm_package_version,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          errors: errorsToSend,
        }),
      })
      
      if (response.ok) {
        logger.info(`Reported ${errorsToSend.length} errors successfully`)
      } else {
        throw new Error(`Server responded with ${response.status}`)
      }
    } catch (error) {
      logger.error('Failed to report errors', {
        meta: { error, queueLength: this.errorQueue.length }
      })
      
      // 失败后重新加入队列（最多重试 3 次）
      if (errorsToSend.length <= 3) {
        this.errorQueue.unshift(...errorsToSend)
      }
    }
  }
}
```

### 4.3 错误堆栈符号化

```typescript
// scripts/symbolicate.ts
import * as Sentry from '@sentry/electron'
import { app } from 'electron'

export function setupErrorSymbolication() {
  // 使用 Sentry 进行错误追踪和符号化
  Sentry.init({
    dsn: 'https://your-sentry-dsn@sentry.io/your-project-id',
    
    // 只在用户授权后启用
    enabled: false,  // 默认关闭
    
    // 环境
    environment: process.env.NODE_ENV || 'production',
    
    // 版本
    release: app.getVersion(),
    
    // 符号化配置
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.TryCatch(),
    ],
    
    // 性能监控
    tracesSampleRate: 0.1,  // 10% 采样
    
    // 脱敏处理
    beforeSend(event) {
      // 移除敏感信息
      if (event.user) {
        delete event.user.ip_address
        delete event.user.email
      }
      
      return event
    },
  })
}

// 符号化堆栈（开发环境）
export function symbolicateStack(stack: string): Promise<string> {
  // 使用 source-map 进行符号化
  const { SourceMapConsumer } = require('source-map')
  
  return new Promise((resolve) => {
    // 解析堆栈中的每一行
    const lines = stack.split('\n')
    const symbolicatedLines = lines.map(line => {
      // 匹配文件名和行号
      const match = line.match(/at (.+) \((.+):(\d+):(\d+)\)/)
      if (match) {
        const [, fnName, fileName, line, col] = match
        // 这里应该查找对应的 source map 文件并解析
        // 简化示例，实际需要完整实现
        return `at ${fnName} (${fileName}:${line}:${col})`
      }
      return line
    })
    
    resolve(symbolicatedLines.join('\n'))
  })
}
```

---

## 5. 用户行为埋点

**注意**: 此功能为可选功能，仅在企业版中提供，且需要用户明确授权。

### 5.1 埋点事件设计

```typescript
// src/shared/analytics-events.ts

export enum AnalyticsEvent {
  // 功能使用
  APP_LAUNCH = 'app_launch',
  APP_CLOSE = 'app_close',
  
  // 探索相关
  EXPLORER_START = 'explorer_start',
  EXPLORER_COMPLETE = 'explorer_complete',
  EXPLORER_TERMINATE = 'explorer_terminate',
  
  // 设备操作
  DEVICE_CONNECT = 'device_connect',
  DEVICE_DISCONNECT = 'device_disconnect',
  DEVICE_SCREENSHOT = 'device_screenshot',
  
  // 测试用例
  TEST_CASE_CREATE = 'test_case_create',
  TEST_CASE_RUN = 'test_case_run',
  TEST_CASE_DELETE = 'test_case_delete',
  
  // 设置
  SETTINGS_CHANGE = 'settings_change',
  
  // 性能
  PAGE_VIEW = 'page_view',
  FEATURE_USE = 'feature_use',
}

export interface AnalyticsPayload {
  event: AnalyticsEvent
  properties: {
    [key: string]: any
    timestamp: number
    userId?: string
    sessionId: string
    appVersion: string
    platform: string
  }
}
```

### 5.2 埋点实现

```typescript
// src/renderer/analytics.ts
import { AnalyticsEvent, AnalyticsPayload } from '../shared/analytics-events'
import { RendererLogger } from './logger'

const logger = new RendererLogger('Analytics')

export class Analytics {
  private enabled: boolean = false
  private userId: string | null = null
  private sessionId: string
  private eventQueue: AnalyticsPayload[] = []
  
  constructor() {
    this.sessionId = this.generateSessionId()
    this.loadSettings()
  }
  
  private loadSettings() {
    const { ipcRenderer } = window.require('electron')
    const settings = ipcRenderer.sendSync('get-settings')
    this.enabled = settings.analyticsEnabled || false
    this.userId = settings.userId || null
  }
  
  public enable() {
    this.enabled = true
    this.userId = this.userId || this.generateUserId()
    this.saveSettings()
    logger.info('Analytics enabled')
  }
  
  public disable() {
    this.enabled = false
    this.saveSettings()
    logger.info('Analytics disabled')
  }
  
  private saveSettings() {
    const { ipcRenderer } = window.require('electron')
    ipcRenderer.send('save-settings', {
      analyticsEnabled: this.enabled,
      userId: this.userId,
    })
  }
  
  public trackEvent(event: AnalyticsEvent, properties: any = {}) {
    if (!this.enabled) {
      return
    }
    
    const payload: AnalyticsPayload = {
      event,
      properties: {
        ...properties,
        timestamp: Date.now(),
        userId: this.userId,
        sessionId: this.sessionId,
        appVersion: process.env.npm_package_version,
        platform: navigator.platform,
      },
    }
    
    // 脱敏处理
    this.sanitizePayload(payload)
    
    // 添加到队列
    this.eventQueue.push(payload)
    
    // 防抖上报
    this.debouncedFlush()
  }
  
  private sanitizePayload(payload: AnalyticsPayload) {
    // 移除敏感信息
    const { properties } = payload
    
    // 不收集文件路径
    if (properties.filePath) {
      properties.filePath = '<redacted>'
    }
    
    // 不收集设备序列号
    if (properties.deviceSerial) {
      properties.deviceSerial = '<redacted>'
    }
  }
  
  private debouncedFlush = (() => {
    let timeout: NodeJS.Timeout | null = null
    
    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
      
      timeout = setTimeout(() => {
        this.flush()
      }, 30000)  // 30 秒后上报
    }
  })()
  
  private async flush() {
    if (this.eventQueue.length === 0) {
      return
    }
    
    const eventsToSend = [...this.eventQueue]
    this.eventQueue = []
    
    try {
      const response = await fetch('https://your-analytics-server.com/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsToSend }),
      })
      
      if (response.ok) {
        logger.info(`Reported ${eventsToSend.length} analytics events`)
      }
    } catch (error) {
      logger.error('Failed to report analytics', { meta: { error } })
      // 重新加入队列
      this.eventQueue.unshift(...eventsToSend)
    }
  }
  
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// 全局实例
export const analytics = new Analytics()
```

### 5.3 使用示例

```typescript
// 在探索任务开始时
analytics.trackEvent(AnalyticsEvent.EXPLORER_START, {
  taskType: 'compatibility',
  deviceCount: 5,
  estimatedDuration: 300,
})

// 在探索任务完成时
analytics.trackEvent(AnalyticsEvent.EXPLORER_COMPLETE, {
  taskId: 'task_123',
  duration: 285,
  success: true,
  bugsFound: 3,
})

// 在功能使用时
analytics.trackEvent(AnalyticsEvent.FEATURE_USE, {
  featureName: 'smart_assertion',
  success: true,
})
```

---

## 6. 告警策略

### 6.1 告警规则配置

```typescript
// src/main/alert-manager.ts
import { BrowserWindow, Notification } from 'electron'
import { logger } from './logger'

export interface AlertRule {
  id: string
  name: string
  condition: (metrics: any) => boolean
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  cooldown: number  // 冷却时间（毫秒）
  lastTriggered?: number
}

export class AlertManager {
  private rules: AlertRule[] = []
  private mainWindow: BrowserWindow
  
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.setupDefaultRules()
  }
  
  private setupDefaultRules() {
    this.rules = [
      // 关键错误实时告警
      {
        id: 'critical-error',
        name: '关键错误',
        condition: (metrics) => metrics.level === 'error',
        severity: 'critical',
        message: '发生关键错误，请检查日志',
        cooldown: 60000,  // 1 分钟冷却
      },
      
      // 性能退化检测
      {
        id: 'performance-degradation',
        name: '性能退化',
        condition: (metrics) => {
          const responseTime = metrics.averageResponseTime || 0
          return responseTime > 3000  // 响应时间超过 3 秒
        },
        severity: 'warning',
        message: '应用性能退化，响应时间超过 3 秒',
        cooldown: 300000,  // 5 分钟冷却
      },
      
      // 磁盘空间告警
      {
        id: 'disk-space-low',
        name: '磁盘空间不足',
        condition: (metrics) => {
          const { diskFree, diskTotal } = metrics
          const freePercent = (diskFree / diskTotal) * 100
          return freePercent < 10  // 剩余空间小于 10%
        },
        severity: 'error',
        message: '磁盘空间不足，请及时清理',
        cooldown: 3600000,  // 1 小时冷却
      },
      
      // AVD 崩溃告警
      {
        id: 'avd-crash',
        name: 'AVD 崩溃',
        condition: (metrics) => metrics.avdCrashed === true,
        severity: 'error',
        message: 'Android 模拟器崩溃，请重启',
        cooldown: 300000,
      },
      
      // 内存使用过高
      {
        id: 'memory-high',
        name: '内存使用过高',
        condition: (metrics) => {
          const { memoryUsed, memoryTotal } = metrics
          const usagePercent = (memoryUsed / memoryTotal) * 100
          return usagePercent > 85
        },
        severity: 'warning',
        message: '内存使用率超过 85%',
        cooldown: 600000,  // 10 分钟冷却
      },
    ]
  }
  
  public evaluateMetrics(metrics: any) {
    for (const rule of this.rules) {
      try {
        if (rule.condition(metrics)) {
          this.triggerAlert(rule, metrics)
        }
      } catch (error) {
        logger.error(`Error evaluating alert rule: ${rule.name}`, {
          meta: { error }
        })
      }
    }
  }
  
  private triggerAlert(rule: AlertRule, metrics: any) {
    const now = Date.now()
    
    // 检查冷却时间
    if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldown) {
      return
    }
    
    rule.lastTriggered = now
    
    // 记录日志
    logger[rule.severity](`Alert triggered: ${rule.name}`, {
      meta: { ruleId: rule.id, metrics }
    })
    
    // 显示桌面通知
    this.showNotification(rule)
    
    // 发送到渲染进程（在 UI 中显示）
    this.mainWindow.webContents.send('alert-triggered', {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: rule.message,
      timestamp: now,
    })
    
    // 如果是严重告警，发送到远程服务器（如果用户授权）
    if (rule.severity === 'critical' || rule.severity === 'error') {
      this.sendRemoteAlert(rule, metrics)
    }
  }
  
  private showNotification(rule: AlertRule) {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `VTest - ${rule.name}`,
        body: rule.message,
        icon: this.getIconForSeverity(rule.severity),
        urgency: rule.severity === 'critical' ? 'critical' : 'normal',
      })
      
      notification.on('click', () => {
        this.mainWindow.show()
        this.mainWindow.focus()
      })
      
      notification.show()
    }
  }
  
  private getIconForSeverity(severity: string): string {
    const icons = {
      info: 'info.png',
      warning: 'warning.png',
      error: 'error.png',
      critical: 'critical.png',
    }
    return `path/to/icons/${icons[severity] || 'info.png'}`
  }
  
  private async sendRemoteAlert(rule: AlertRule, metrics: any) {
    // 检查用户是否授权
    const { ipcRenderer } = require('electron')
    const settings = ipcRenderer.sendSync('get-settings')
    
    if (!settings.remoteAlertsEnabled) {
      return
    }
    
    try {
      await fetch('https://your-alert-server.com/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: rule.message,
          metrics,
          timestamp: Date.now(),
          appVersion: process.env.npm_package_version,
        }),
      })
    } catch (error) {
      logger.error('Failed to send remote alert', { meta: { error } })
    }
  }
  
  public addRule(rule: AlertRule) {
    this.rules.push(rule)
    logger.info(`Alert rule added: ${rule.name}`)
  }
  
  public removeRule(ruleId: string) {
    this.rules = this.rules.filter(r => r.id !== ruleId)
    logger.info(`Alert rule removed: ${ruleId}`)
  }
  
  public getRules(): AlertRule[] {
    return [...this.rules]
  }
}
```

### 6.2 告警通知配置

```typescript
// src/renderer/components/AlertCenter.tsx
import React, { useState, useEffect } from 'react'
import { RendererLogger } from '../logger'

const logger = new RendererLogger('AlertCenter')

interface Alert {
  id: string
  ruleId: string
  ruleName: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: number
  read: boolean
}

export const AlertCenter: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [showCenter, setShowCenter] = useState(false)
  
  useEffect(() => {
    const { ipcRenderer } = window.require('electron')
    
    // 监听告警
    ipcRenderer.on('alert-triggered', (event, alert) => {
      const newAlert: Alert = {
        id: `${alert.ruleId}_${alert.timestamp}`,
        ...alert,
        read: false,
      }
      
      setAlerts(prev => [newAlert, ...prev].slice(0, 100))  // 最多保留 100 条
      
      logger.info(`Alert received: ${alert.ruleName}`, {
        meta: { severity: alert.severity }
      })
    })
    
    // 加载历史告警
    loadHistoryAlerts()
    
    return () => {
      ipcRenderer.removeAllListeners('alert-triggered')
    }
  }, [])
  
  const loadHistoryAlerts = async () => {
    const { ipcRenderer } = window.require('electron')
    const history = await ipcRenderer.invoke('get-alert-history')
    setAlerts(history)
  }
  
  const markAsRead = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    )
  }
  
  const clearAll = () => {
    setAlerts([])
    const { ipcRenderer } = window.require('electron')
    ipcRenderer.invoke('clear-alert-history')
  }
  
  const unreadCount = alerts.filter(a => !a.read).length
  
  const severityColors = {
    info: '#1890ff',
    warning: '#faad14',
    error: '#f5222d',
    critical: '#a8071a',
  }
  
  return (
    <div className="alert-center">
      <button
        className="alert-trigger"
        onClick={() => setShowCenter(!showCenter)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>
      
      {showCenter && (
        <div className="alert-panel">
          <div className="alert-header">
            <h3>告警中心</h3>
            <button onClick={clearAll}>清空</button>
          </div>
          
          <div className="alert-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">暂无告警</div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`alert-item ${alert.read ? 'read' : 'unread'}`}
                  style={{ borderLeftColor: severityColors[alert.severity] }}
                  onClick={() => markAsRead(alert.id)}
                >
                  <div className="alert-title">
                    <span className="alert-severity" style={{ color: severityColors[alert.severity] }}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="alert-name">{alert.ruleName}</span>
                    <span className="alert-time">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="alert-message">{alert.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .alert-center {
          position: relative;
        }
        
        .alert-trigger {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          position: relative;
        }
        
        .badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #f5222d;
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .alert-panel {
          position: absolute;
          top: 40px;
          right: 0;
          width: 400px;
          max-height: 500px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
        }
        
        .alert-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #ddd;
        }
        
        .alert-list {
          overflow-y: auto;
          max-height: 450px;
        }
        
        .alert-item {
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
          border-left: 4px solid;
          cursor: pointer;
        }
        
        .alert-item.unread {
          background: #e6f7ff;
        }
        
        .alert-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        
        .alert-severity {
          font-weight: bold;
          font-size: 12px;
        }
        
        .alert-name {
          font-weight: bold;
          flex: 1;
        }
        
        .alert-time {
          font-size: 12px;
          color: #999;
        }
        
        .alert-message {
          font-size: 14px;
          color: #666;
        }
        
        .no-alerts {
          padding: 24px;
          text-align: center;
          color: #999;
        }
      `}</style>
    </div>
  )
}
```

---

## 7. 附录：完整配置示例

### 7.1 完整 Electron 主进程日志配置

查看完整配置: [src/main/logger.ts](https://github.com/yourorg/vtest/blob/main/src/main/logger.ts)

### 7.2 完整 Python 日志配置

查看完整配置: [src/python/logger.py](https://github.com/yourorg/vtest/blob/main/src/python/logger.py)

### 7.3 完整告警规则配置

查看完整配置: [src/main/alert-manager.ts](https://github.com/yourorg/vtest/blob/main/src/main/alert-manager.ts)

### 7.4 Docker 部署可观测性后端（可选）

```yaml
# docker-compose.observability.yml
version: '3.8'

services:
  # Loki - 日志聚合
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./config/loki:/etc/loki
      - loki-data:/loki
      
  # Tempo - 分布式追踪
  tempo:
    image: grafana/tempo:2.3.0
    ports:
      - "3200:3200"
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
    command: -config.file=/etc/tempo.yaml
    volumes:
      - ./config/tempo:/etc/tempo
      - tempo-data:/tmp/tempo
      
  # Prometheus - 指标收集
  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    volumes:
      - ./config/prometheus:/etc/prometheus
      - prometheus-data:/prometheus
      
  # Grafana - 可视化
  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./config/grafana:/etc/grafana/provisioning
      - grafana-data:/var/lib/grafana
    depends_on:
      - loki
      - tempo
      - prometheus

volumes:
  loki-data:
  tempo-data:
  prometheus-data:
  grafana-data:
```

---

## 8. 总结与下一步

### 8.1 实施优先级

| 阶段 | 任务 | 优先级 | 预计工期 |
|------|------|--------|---------|
| Phase 1 | 基础日志系统 | P0 | 1 周 |
| Phase 2 | 错误追踪（crashReporter） | P0 | 3 天 |
| Phase 3 | 性能监控（前端 + 后端） | P1 | 1 周 |
| Phase 4 | AVD 资源监控 | P1 | 3 天 |
| Phase 5 | 告警系统 | P1 | 5 天 |
| Phase 6 | 用户行为埋点（企业版） | P2 | 1 周 |
| Phase 7 | 可观测性后端（Loki/Tempo） | P3 | 2 周 |

### 8.2 成本估算

**开源版**:
- 基础设施: 免费（本地存储）
- 时间成本: ~4 周

**企业版**:
- 云服务（Grafana Cloud）: $49/月（基础版）
- 自建可观测性后端: $200/月（AWS EC2 + EBS）
- 时间成本: ~8 周

### 8.3 最佳实践

1. **日志规范**:
   - 统一日志格式（JSON）
   - 统一时间格式（ISO 8601）
   - 敏感信息脱敏

2. **性能优先**:
   - 异步日志写入
   - 批量上报
   - 采样策略

3. **用户隐私**:
   - 所有数据收集需用户授权
   - 支持完全关闭
   - 数据加密传输和存储

---

**文档状态**: 草稿  
**下一步**: 提交评审 → 技术方案评审 → 开始实施

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-06-07 | DevOps-Lead | 初始版本 |
