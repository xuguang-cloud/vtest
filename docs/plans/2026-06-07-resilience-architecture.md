# VTest 故障恢复与断点续传架构设计文档

**文档版本**: v1.0  
**创建日期**: 2026-06-07  
**架构师**: Arch-Lead  
**审核状态**: 待审核

---

## 目录

1. [概述](#1-概述)
2. [系统架构总览](#2-系统架构总览)
3. [AVD崩溃恢复机制](#3-avd崩溃恢复机制)
4. [AI探索断点续传](#4-ai探索断点续传)
5. [死锁检测与超时保护](#5-死锁检测与超时保护)
6. [主进程崩溃恢复](#6-主进程崩溃恢复)
7. [状态管理与序列化](#7-状态管理与序列化)
8. [监控与告警](#8-监控与告警)
9. [测试策略](#9-测试策略)

---

## 1. 概述

### 1.1 设计目标

VTest作为AI驱动的Android应用自动化测试工具，需要具备强大的故障恢复能力：

1. **高可用性**: AVD崩溃、网络异常等故障不影响整体测试流程
2. **断点续传**: AI探索任务可以从任意检查点恢复，避免重复工作
3. **超时保护**: 防止死锁和无限等待，保证系统健壮性
4. **数据一致性**: 主进程崩溃后不丢失测试数据和状态

### 1.2 核心挑战

| 挑战 | 解决方案 |
|------|---------|
| **AVD不稳定** | Heartbeat检测 + 自动重启 + 状态恢复 |
| **AI探索耗时长** | 定期检查点 + 状态序列化 + 去重机制 |
| **UI操作可能卡死** | 步骤超时 + 页面无响应检测 + 强制恢复 |
| **主进程可能崩溃** | 渲染进程独立 + 状态持久化 + 自动恢复 |

### 1.3 技术栈

```
Electron Main Process (主进程)
    ↓
ADB Bridge (ADB通信层)
    ↓
AVD Emulator (Android虚拟设备)
    ↓
SQLite Database (状态持久化)
```

---

## 2. 系统架构总览

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Heartbeat    │  │ Checkpoint   │  │ Recovery     │   │
│  │ Manager      │  │ Manager      │  │ Manager      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  State Manager  │                       │
│                   └────────┬────────┘                       │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  ADB Bridge (通信层)                         │
│  • 命令执行 (adb shell, adb push/pull)                      │
│  • UI Automator 桥接                                        │
│  • 日志流 (logcat)                                          │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  AVD Emulator                                │
│  • Android 系统                                              │
│  • 被测应用 (APK)                                           │
│  • UI Automator Server                                      │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  SQLite Database                             │
│  • exploration_checkpoints (检查点数据)                      │
│  • test_runs (测试运行状态)                                 │
│  • exploration_paths (探索路径)                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件职责

| 组件 | 职责 | 关键方法 |
|------|------|----------|
| **HeartbeatManager** | 检测AVD健康状态 | `startHeartbeat()`, `checkAVDAlive()` |
| **CheckpointManager** | 管理检查点创建与恢复 | `createCheckpoint()`, `restoreFromCheckpoint()` |
| **RecoveryManager** | 协调恢复流程 | `recoverTestRun()`, `restartAVD()` |
| **StateManager** | 序列化管理探索状态 | `serializeState()`, `deserializeState()` |
| **TimeoutGuard** | 超时检测与处理 | `startStepTimer()`, `handleTimeout()` |
| **DeadlockDetector** | 死锁与卡死检测 | `detectUIFreeze()`, `forceRecover()` |

---

## 3. AVD崩溃恢复机制

### 3.1 Heartbeat检测机制

#### 3.1.1 设计思路

通过定期向AVD发送轻量级命令（如`adb shell echo ping`），检测AVD是否响应。

**检测频率**:
- **正常状态**: 每10秒检测一次
- **高风险状态**: 每3秒检测一次（执行UI操作时）
- **超时阈值**: 连续3次检测失败（30秒）判定为崩溃

#### 3.1.2 HeartbeatManager实现

```typescript
// src/avd/heartbeat-manager.ts
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class HeartbeatManager extends EventEmitter {
  private avdName: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly NORMAL_INTERVAL = 10000;  // 10秒
  private readonly HIGH_FREQ_INTERVAL = 3000;  // 3秒
  private consecutiveFailures: number = 0;
  private readonly MAX_FAILURES = 3;
  private isHighFrequencyMode: boolean = false;
  
  constructor(avdName: string) {
    super();
    this.avdName = avdName;
  }
  
  /**
   * 启动Heartbeat检测
   */
  startHeartbeat(): void {
    console.log(`[Heartbeat] Starting heartbeat for AVD: ${this.avdName}`);
    
    this.heartbeatInterval = setInterval(async () => {
      await this.performHeartbeat();
    }, this.NORMAL_INTERVAL);
  }
  
  /**
   * 执行一次Heartbeat检测
   */
  private async performHeartbeat(): Promise<void> {
    try {
      // 1. 发送ping命令
      const startTime = Date.now();
      const { stdout } = await execAsync(
        `adb -s ${this.avdName} shell echo "ping"`, 
        { timeout: 5000 }  // 单条命令5秒超时
      );
      const latency = Date.now() - startTime;
      
      // 2. 验证响应
      if (stdout.trim() === 'ping') {
        // Heartbeat成功
        this.consecutiveFailures = 0;
        
        // 如果之前是高频率模式，恢复正常频率
        if (this.isHighFrequencyMode) {
          this.downgradeToNormalFrequency();
        }
        
        this.emit('heartbeat:success', { latency });
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      // Heartbeat失败
      this.consecutiveFailures++;
      
      console.warn(
        `[Heartbeat] Failure ${this.consecutiveFailures}/${this.MAX_FAILURES}:`, 
        error.message
      );
      
      this.emit('heartbeat:failure', { 
        error, 
        consecutiveFailures: this.consecutiveFailures 
      });
      
      // 进入高风险模式（提高检测频率）
      if (!this.isHighFrequencyMode && this.consecutiveFailures >= 1) {
        this.upgradeToHighFrequency();
      }
      
      // 连续失败达到阈值，判定为崩溃
      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        console.error('[Heartbeat] AVD crashed detected!');
        this.emit('avd:crashed');
        await this.handleAVDCrash();
      }
    }
  }
  
  /**
   * 提高检测频率（高风险模式）
   */
  private upgradeToHighFrequency(): void {
    console.log('[Heartbeat] Upgrading to high frequency mode');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.isHighFrequencyMode = true;
    this.heartbeatInterval = setInterval(async () => {
      await this.performHeartbeat();
    }, this.HIGH_FREQ_INTERVAL);
  }
  
  /**
   * 恢复正常检测频率
   */
  private downgradeToNormalFrequency(): void {
    console.log('[Heartbeat] Downgrading to normal frequency');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.isHighFrequencyMode = false;
    this.heartbeatInterval = setInterval(async () => {
      await this.performHeartbeat();
    }, this.NORMAL_INTERVAL);
  }
  
  /**
   * 处理AVD崩溃
   */
  private async handleAVDCrash(): Promise<void> {
    console.log('[Heartbeat] Handling AVD crash...');
    
    // 1. 停止Heartbeat
    this.stopHeartbeat();
    
    // 2. 发出崩溃事件
    this.emit('avd:crash:start');
    
    // 3. 尝试重启AVD
    try {
      await this.restartAVD();
      
      // 4. 重启Heartbeat
      this.consecutiveFailures = 0;
      this.startHeartbeat();
      
      this.emit('avd:crash:recovered');
    } catch (error) {
      console.error('[Heartbeat] Failed to recover AVD:', error);
      this.emit('avd:crash:failed', { error });
    }
  }
  
  /**
   * 重启AVD
   */
  private async restartAVD(): Promise<void> {
    console.log(`[Heartbeat] Restarting AVD: ${this.avdName}`);
    
    // 1. 强制停止AVD
    try {
      await execAsync(`adb -s ${this.avdName} emu kill`);
    } catch (e) {
      // 忽略错误（可能已经在停止状态）
    }
    
    // 2. 等待完全停止
    await this.waitForAVDStop();
    
    // 3. 启动AVD（冷启动，保证干净状态）
    const avdProcess = exec(`emulator -avd ${this.avdName} -no-snapshot`);
    
    // 4. 等待AVD启动完成
    await this.waitForAVDStart();
    
    console.log(`[Heartbeat] AVD restarted: ${this.avdName}`);
  }
  
  /**
   * 等待AVD停止
   */
  private async waitForAVDStop(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        await execAsync(`adb -s ${this.avdName} get-state`, { timeout: 2000 });
        // 仍在运行，等待
        await this.sleep(1000);
      } catch (error) {
        // AVD已停止
        console.log('[Heartbeat] AVD stopped');
        return;
      }
    }
    
    throw new Error('Timeout waiting for AVD to stop');
  }
  
  /**
   * 等待AVD启动
   */
  private async waitForAVDStart(timeoutMs: number = 120000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const { stdout } = await execAsync(
          `adb -s ${this.avdName} get-state`,
          { timeout: 2000 }
        );
        
        if (stdout.trim() === 'device') {
          // AVD已启动，等待系统完全就绪
          await this.waitForBootComplete();
          console.log('[Heartbeat] AVD started and boot completed');
          return;
        }
      } catch (error) {
        // 还未启动，继续等待
      }
      
      await this.sleep(2000);
    }
    
    throw new Error('Timeout waiting for AVD to start');
  }
  
  /**
   * 等待系统启动完成
   */
  private async waitForBootComplete(timeoutMs: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const { stdout } = await execAsync(
          `adb -s ${this.avdName} shell getprop sys.boot_completed`,
          { timeout: 2000 }
        );
        
        if (stdout.trim() === '1') {
          // 系统启动完成
          return;
        }
      } catch (error) {
        // 忽略错误
      }
      
      await this.sleep(2000);
    }
    
    throw new Error('Timeout waiting for boot complete');
  }
  
  /**
   * 停止Heartbeat检测
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Heartbeat] Heartbeat stopped');
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { HeartbeatManager };
```

### 3.2 AVD恢复策略

#### 3.2.1 恢复流程状态图

```
AVD崩溃检测
    ↓
[状态1] 保存当前状态到检查点
    ↓
[状态2] 强制停止AVD
    ↓
[状态3] 启动AVD（冷启动）
    ↓
[状态4] 等待系统启动完成
    ↓
[状态5] 重新安装APK
    ↓
[状态6] 恢复检查点状态
    ↓
[状态7] 继续执行测试
```

#### 3.2.2 RecoveryManager实现

```typescript
// src/avd/recovery-manager.ts
import { HeartbeatManager } from './heartbeat-manager';
import { CheckpointManager } from '../checkpoint/checkpoint-manager';
import { execAsync } from '../utils/exec';

class RecoveryManager extends EventEmitter {
  private avdName: string;
  private testRunId: number;
  private heartbeatManager: HeartbeatManager;
  private checkpointManager: CheckpointManager;
  private maxRetries: number = 3;
  private currentRetries: number = 0;
  
  constructor(
    avdName: string, 
    testRunId: number,
    checkpointManager: CheckpointManager
  ) {
    super();
    this.avdName = avdName;
    this.testRunId = testRunId;
    this.checkpointManager = checkpointManager;
    
    // 初始化HeartbeatManager
    this.heartbeatManager = new HeartbeatManager(avdName);
    this.setupHeartbeatListeners();
  }
  
  /**
   * 设置Heartbeat事件监听
   */
  private setupHeartbeatListeners(): void {
    this.heartbeatManager.on('avd:crashed', async () => {
      console.log('[Recovery] AVD crash detected, starting recovery...');
      await this.recoverAVD();
    });
    
    this.heartbeatManager.on('avd:crash:recovered', () => {
      console.log('[Recovery] AVD recovered successfully');
      this.currentRetries = 0;  // 重置重试计数
    });
    
    this.heartbeatManager.on('avd:crash:failed', (error) => {
      console.error('[Recovery] AVD recovery failed:', error);
      this.handleRecoveryFailure();
    });
  }
  
  /**
   * 恢复AVD（主流程）
   */
  private async recoverAVD(): Promise<void> {
    try {
      // 步骤1: 保存当前状态到检查点
      console.log('[Recovery] Step 1: Saving checkpoint...');
      await this.checkpointManager.createCheckpoint(this.testRunId, {
        reason: 'avd_crash',
        timestamp: Date.now()
      });
      
      // 步骤2: 强制停止AVD
      console.log('[Recovery] Step 2: Force stopping AVD...');
      await this.forceStopAVD();
      
      // 步骤3: 启动AVD（冷启动）
      console.log('[Recovery] Step 3: Cold starting AVD...');
      await this.coldStartAVD();
      
      // 步骤4: 重新安装APK
      console.log('[Recovery] Step 4: Reinstalling APK...');
      await this.reinstallAPK();
      
      // 步骤5: 恢复检查点状态
      console.log('[Recovery] Step 5: Restoring from checkpoint...');
      await this.checkpointManager.restoreFromLatestCheckpoint(this.testRunId);
      
      // 步骤6: 重启Heartbeat
      console.log('[Recovery] Step 6: Restarting heartbeat...');
      this.heartbeatManager.startHeartbeat();
      
      this.emit('recovery:success');
      
    } catch (error) {
      console.error('[Recovery] Recovery failed:', error);
      this.currentRetries++;
      
      if (this.currentRetries < this.maxRetries) {
        console.log(`[Recovery] Retrying... (${this.currentRetries}/${this.maxRetries})`);
        await this.sleep(5000);  // 等待5秒后重试
        await this.recoverAVD();
      } else {
        this.emit('recovery:failed', { error, retries: this.currentRetries });
      }
    }
  }
  
  /**
   * 强制停止AVD
   */
  private async forceStopAVD(): Promise<void> {
    try {
      // 方法1: 使用adb emu kill
      await execAsync(`adb -s ${this.avdName} emu kill`, { timeout: 10000 });
    } catch (error) {
      console.warn('[Recovery] adb emu kill failed, trying kill-server...');
      
      // 方法2: 重启adb server
      await execAsync('adb kill-server');
      await this.sleep(2000);
      await execAsync('adb start-server');
    }
    
    // 等待AVD完全停止
    await this.waitForAVDStop();
  }
  
  /**
   * 冷启动AVD
   */
  private async coldStartAVD(): Promise<void> {
    // 冷启动（不使用快照）
    const emulatorProcess = exec(
      `emulator -avd ${this.avdName} -no-snapshot -wipe-data`,
      (error, stdout, stderr) => {
        if (error) {
          console.error('[Recovery] Emulator process error:', error);
        }
      }
    );
    
    // 等待AVD启动完成
    await this.heartbeatManager['waitForAVDStart'](120000);
  }
  
  /**
   * 重新安装APK
   */
  private async reinstallAPK(): Promise<void> {
    // 1. 获取APK路径
    const testRun = await db('test_runs')
      .where('id', this.testRunId)
      .join('apks', 'test_runs.apk_id', 'apks.id')
      .select('apks.file_path', 'apks.package_name')
      .first();
    
    if (!testRun) {
      throw new Error('Test run or APK not found');
    }
    
    const apkPath = testRun.file_path;
    const packageName = testRun.package_name;
    
    // 2. 卸载旧版本
    try {
      await execAsync(
        `adb -s ${this.avdName} uninstall ${packageName}`,
        { timeout: 10000 }
      );
    } catch (error) {
      // 忽略错误（可能未安装）
    }
    
    // 3. 安装新版本
    await execAsync(
      `adb -s ${this.avdName} install -r ${apkPath}`,
      { timeout: 60000 }
    );
    
    console.log(`[Recovery] APK reinstalled: ${packageName}`);
  }
  
  /**
   * 等待AVD停止
   */
  private async waitForAVDStop(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        await execAsync(`adb -s ${this.avdName} get-state`, { timeout: 2000 });
        await this.sleep(1000);
      } catch (error) {
        console.log('[Recovery] AVD stopped');
        return;
      }
    }
    
    throw new Error('Timeout waiting for AVD to stop');
  }
  
  /**
   * 处理恢复失败
   */
  private handleRecoveryFailure(): void {
    console.error(`[Recovery] Recovery failed after ${this.maxRetries} retries`);
    
    // 更新测试运行状态
    db('test_runs')
      .where('id', this.testRunId)
      .update({
        status: 'failed',
        updated_at: Date.now()
      });
    
    this.emit('test:failed', { 
      testRunId: this.testRunId, 
      reason: 'AVD recovery failed' 
    });
  }
  
  /**
   * 启动恢复管理器
   */
  start(): void {
    console.log('[Recovery] Starting recovery manager...');
    this.heartbeatManager.startHeartbeat();
  }
  
  /**
   * 停止恢复管理器
   */
  stop(): void {
    console.log('[Recovery] Stopping recovery manager...');
    this.heartbeatManager.stopHeartbeat();
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { RecoveryManager };
```

### 3.3 检查点设计

#### 3.3.1 检查点触发条件

| 触发条件 | 频率 | 优先级 |
|---------|------|--------|
| **探索N个Activity后** | 每5个Activity | 高 |
| **每M分钟** | 每5分钟 | 中 |
| **AVD崩溃前** | 立即 | 紧急 |
| **用户手动触发** | 按需 | 低 |

#### 3.3.2 检查点数据结构

```typescript
interface ExplorationCheckpoint {
  id: number;
  testRunId: number;
  checkpointNumber: number;
  timestamp: number;
  
  // 序列化的探索状态
  state: {
    // 当前Activity栈
    activityStack: string[];
    
    // 已访问路径哈希集合（用于去重）
    visitedPaths: Set<string>;
    
    // 待探索队列
    pendingQueue: ExplorationTask[];
    
    // 当前探索深度
    currentDepth: number;
    
    // 当前Activity信息
    currentActivity: string;
    currentUiTreeHash: string;
    
    // 统计信息
    stats: {
      activitiesExplored: number;
      pathsDiscovered: number;
      bugsFound: number;
      coveragePercent: number;
    };
  };
  
  // 序列化后的二进制数据（存储到DB）
  stateData: Buffer;
}
```

#### 3.3.3 检查点创建与恢复

（详见第4节"AI探索断点续传"）

---

## 4. AI探索断点续传

### 4.1 探索状态序列化

#### 4.1.1 状态组成

AI探索的状态包含以下关键数据：

```typescript
// src/exploration/exploration-state.ts
class ExplorationState {
  // 1. Activity栈
  private activityStack: string[] = [];
  
  // 2. 已访问路径哈希集合（用于去重）
  private visitedPaths: Set<string> = new Set();
  
  // 3. 待探索队列（优先级队列）
  private pendingQueue: PriorityQueue<ExplorationTask> = 
    new PriorityQueue<ExplorationTask>();
  
  // 4. 当前探索上下文
  private currentContext: {
    activity: string;
    uiTreeHash: string;
    depth: number;
    lastAction: UiAction | null;
  } = {
    activity: '',
    uiTreeHash: '',
    depth: 0,
    lastAction: null
  };
  
  // 5. 探索策略状态
  private strategyState: {
    strategy: 'depth_first' | 'breadth_first' | 'random';
    randomSeed: number;
    maxDepth: number;
    maxPaths: number;
  };
  
  // 6. 统计信息
  private stats: {
    activitiesExplored: Set<string>;
    pathsDiscovered: number;
    bugsFound: number;
    startTime: number;
    totalSteps: number;
  } = {
    activitiesExplored: new Set(),
    pathsDiscovered: 0,
    bugsFound: 0,
    startTime: Date.now(),
    totalSteps: 0
  };
  
  /**
   * 序列化状态为Buffer（存储到DB）
   */
  serialize(): Buffer {
    const stateObject = {
      activityStack: this.activityStack,
      visitedPaths: Array.from(this.visitedPaths),
      pendingQueue: this.pendingQueue.toArray(),
      currentContext: this.currentContext,
      strategyState: this.strategyState,
      stats: {
        ...this.stats,
        activitiesExplored: Array.from(this.stats.activitiesExplored)
      }
    };
    
    // 使用MessagePack序列化（比JSON更高效）
    const msgpack = require('msgpack-lite');
    const serialized = msgpack.encode(stateObject);
    
    return Buffer.from(serialized);
  }
  
  /**
   * 从Buffer反序列化状态
   */
  static deserialize(buffer: Buffer): ExplorationState {
    const msgpack = require('msgpack-lite');
    const stateObject = msgpack.decode(buffer);
    
    const state = new ExplorationState();
    
    // 恢复Activity栈
    state.activityStack = stateObject.activityStack;
    
    // 恢复已访问路径
    state.visitedPaths = new Set(stateObject.visitedPaths);
    
    // 恢复待探索队列
    state.pendingQueue = PriorityQueue.fromArray(stateObject.pendingQueue);
    
    // 恢复当前上下文
    state.currentContext = stateObject.currentContext;
    
    // 恢复策略状态
    state.strategyState = stateObject.strategyState;
    
    // 恢复统计信息
    state.stats = {
      ...stateObject.stats,
      activitiesExplored: new Set(stateObject.stats.activitiesExplored)
    };
    
    return state;
  }
  
  /**
   * 计算当前状态的哈希（用于去重）
   */
  getStateHash(): string {
    const crypto = require('crypto');
    
    // 使用Activity栈 + UI树哈希作为状态标识
    const stateString = JSON.stringify({
      activityStack: this.activityStack,
      uiTreeHash: this.currentContext.uiTreeHash
    });
    
    return crypto.createHash('sha256').update(stateString).digest('hex');
  }
  
  /**
   * 记录访问路径（去重）
   */
  markPathVisited(pathHash: string): void {
    this.visitedPaths.add(pathHash);
  }
  
  /**
   * 检查路径是否已访问
   */
  isPathVisited(pathHash: string): boolean {
    return this.visitedPaths.has(pathHash);
  }
  
  /**
   * 添加待探索任务
   */
  enqueueTask(task: ExplorationTask): void {
    this.pendingQueue.enqueue(task, task.priority);
  }
  
  /**
   * 获取下一个待探索任务
   */
  dequeueTask(): ExplorationTask | null {
    if (this.pendingQueue.isEmpty()) {
      return null;
    }
    return this.pendingQueue.dequeue();
  }
  
  /**
   * 更新统计信息
   */
  updateStats(update: Partial<ExplorationState['stats']>): void {
    Object.assign(this.stats, update);
  }
  
  /**
   * 获取统计信息快照
   */
  getStatsSnapshot(): any {
    return {
      ...this.stats,
      activitiesExplored: this.stats.activitiesExplored.size,
      currentTime: Date.now(),
      elapsedTimeMs: Date.now() - this.stats.startTime
    };
  }
}
```

#### 4.1.2 优先级队列实现

```typescript
// src/utils/priority-queue.ts
class PriorityQueue<T> {
  private heap: Array<{ item: T; priority: number }> = [];
  
  /**
   * 入队
   */
  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }
  
  /**
   * 出队（获取优先级最高的任务）
   */
  dequeue(): T | null {
    if (this.heap.length === 0) {
      return null;
    }
    
    const result = this.heap[0];
    const last = this.heap.pop()!;
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    
    return result.item;
  }
  
  /**
   * 是否为空
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }
  
  /**
   * 转换为数组（序列化用）
   */
  toArray(): Array<{ item: T; priority: number }> {
    return [...this.heap];
  }
  
  /**
   * 从数组恢复（反序列化用）
   */
  static fromArray<T>(arr: Array<{ item: T; priority: number }>): PriorityQueue<T> {
    const pq = new PriorityQueue<T>();
    pq.heap = [...arr];
    
    // 重建堆
    for (let i = Math.floor(pq.heap.length / 2) - 1; i >= 0; i--) {
      pq.sinkDown(i);
    }
    
    return pq;
  }
  
  private bubbleUp(index: number): void {
    const element = this.heap[index];
    
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      
      if (element.priority >= parent.priority) {
        break;
      }
      
      this.heap[parentIndex] = element;
      this.heap[index] = parent;
      index = parentIndex;
    }
  }
  
  private sinkDown(index: number): void {
    const length = this.heap.length;
    const element = this.heap[index];
    
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swap: number | null = null;
      let leftChild: { item: T; priority: number } | undefined;
      let rightChild: { item: T; priority: number } | undefined;
      
      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex];
        if (leftChild.priority < element.priority) {
          swap = leftChildIndex;
        }
      }
      
      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null && rightChild.priority < leftChild!.priority)
        ) {
          swap = rightChildIndex;
        }
      }
      
      if (swap === null) {
        break;
      }
      
      this.heap[index] = this.heap[swap];
      this.heap[swap] = element;
      index = swap;
    }
  }
}
```

### 4.2 CheckpointManager实现

```typescript
// src/checkpoint/checkpoint-manager.ts
import Database from 'better-sqlite3';
import { ExplorationState } from '../exploration/exploration-state';

class CheckpointManager extends EventEmitter {
  private db: Database;
  private readonly CHECKPOINT_INTERVAL_ACTIVITIES = 5;  // 每5个Activity创建检查点
  private readonly CHECKPOINT_INTERVAL_MINUTES = 5;  // 每5分钟创建检查点
  private activityCounter: number = 0;
  private lastCheckpointTime: number = Date.now();
  
  constructor(db: Database) {
    super();
    this.db = db;
  }
  
  /**
   * 创建检查点
   */
  async createCheckpoint(
    testRunId: number, 
    options: {
      reason?: 'periodic' | 'activity_count' | 'avd_crash' | 'manual';
      metadata?: any;
    } = {}
  ): Promise<string> {
    console.log(`[Checkpoint] Creating checkpoint for test run ${testRunId}...`);
    
    // 1. 获取当前探索状态
    const explorationService = require('../exploration/exploration-service').getInstance();
    const state = explorationService.getCurrentState();
    
    if (!state) {
      throw new Error('No active exploration state to checkpoint');
    }
    
    // 2. 序列化状态
    const stateBuffer = state.serialize();
    
    // 3. 获取检查点编号
    const lastCheckpoint = this.db.prepare(
      'SELECT MAX(checkpoint_number) as max_num FROM exploration_checkpoints WHERE test_run_id = ?'
    ).get(testRunId);
    
    const checkpointNumber = (lastCheckpoint.max_num || 0) + 1;
    
    // 4. 生成检查点UUID
    const checkpointUuid = require('uuid').v4();
    
    // 5. 获取统计快照
    const statsSnapshot = state.getStatsSnapshot();
    
    // 6. 存储到数据库
    const insertStmt = this.db.prepare(`
      INSERT INTO exploration_checkpoints (
        test_run_id,
        checkpoint_uuid,
        checkpoint_number,
        state_data,
        activities_explored,
        paths_discovered,
        bugs_found,
        coverage_percent,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      testRunId,
      checkpointUuid,
      checkpointNumber,
      stateBuffer,
      statsSnapshot.activitiesExplored,
      statsSnapshot.pathsDiscovered,
      statsSnapshot.bugsFound,
      statsSnapshot.coveragePercent || 0,
      Date.now()
    );
    
    console.log(`[Checkpoint] Checkpoint created: #${checkpointNumber} (${checkpointUuid})`);
    
    // 7. 更新时间戳
    this.lastCheckpointTime = Date.now();
    this.activityCounter = 0;
    
    this.emit('checkpoint:created', {
      testRunId,
      checkpointUuid,
      checkpointNumber
    });
    
    return checkpointUuid;
  }
  
  /**
   * 从最新检查点恢复
   */
  async restoreFromLatestCheckpoint(testRunId: number): Promise<ExplorationState> {
    console.log(`[Checkpoint] Restoring from latest checkpoint for test run ${testRunId}...`);
    
    // 1. 查询最新检查点
    const checkpoint = this.db.prepare(`
      SELECT * FROM exploration_checkpoints 
      WHERE test_run_id = ? 
      ORDER BY checkpoint_number DESC 
      LIMIT 1
    `).get(testRunId);
    
    if (!checkpoint) {
      throw new Error('No checkpoint found for test run');
    }
    
    return await this.restoreFromCheckpoint(checkpoint.checkpoint_uuid);
  }
  
  /**
   * 从指定检查点恢复
   */
  async restoreFromCheckpoint(checkpointUuid: string): Promise<ExplorationState> {
    console.log(`[Checkpoint] Restoring from checkpoint ${checkpointUuid}...`);
    
    // 1. 查询检查点数据
    const checkpoint = this.db.prepare(
      'SELECT * FROM exploration_checkpoints WHERE checkpoint_uuid = ?'
    ).get(checkpointUuid);
    
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointUuid}`);
    }
    
    // 2. 反序列化状态
    const stateBuffer = checkpoint.state_data;
    const state = ExplorationState.deserialize(stateBuffer);
    
    // 3. 恢复探索服务状态
    const explorationService = require('../exploration/exploration-service').getInstance();
    explorationService.restoreState(state);
    
    // 4. 更新测试运行状态
    this.db.prepare(
      'UPDATE test_runs SET status = ?, updated_at = ? WHERE id = ?'
    ).run('running', Date.now(), checkpoint.test_run_id);
    
    console.log(`[Checkpoint] Restored from checkpoint #${checkpoint.checkpoint_number}`);
    
    this.emit('checkpoint:restored', {
      checkpointUuid,
      checkpointNumber: checkpoint.checkpoint_number,
      testRunId: checkpoint.test_run_id
    });
    
    return state;
  }
  
  /**
   * 定期检查点触发（在探索过程中调用）
   */
  async checkPeriodicCheckpoint(testRunId: number): Promise<void> {
    const now = Date.now();
    const minutesSinceLastCheckpoint = (now - this.lastCheckpointTime) / 60000;
    
    // 触发条件1: 每N个Activity
    if (this.activityCounter >= this.CHECKPOINT_INTERVAL_ACTIVITIES) {
      console.log(`[Checkpoint] Trigger: ${this.activityCounter} activities explored`);
      await this.createCheckpoint(testRunId, { reason: 'activity_count' });
    }
    // 触发条件2: 每M分钟
    else if (minutesSinceLastCheckpoint >= this.CHECKPOINT_INTERVAL_MINUTES) {
      console.log(`[Checkpoint] Trigger: ${minutesSinceLastCheckpoint.toFixed(1)} minutes elapsed`);
      await this.createCheckpoint(testRunId, { reason: 'periodic' });
    }
  }
  
  /**
   * 增加Activity计数（在探索过程中调用）
   */
  incrementActivityCounter(): void {
    this.activityCounter++;
  }
  
  /**
   * 列出所有检查点
   */
  listCheckpoints(testRunId: number): Array<{
    checkpointUuid: string;
    checkpointNumber: number;
    createdAt: number;
    stats: any;
  }> {
    return this.db.prepare(
      'SELECT * FROM exploration_checkpoints WHERE test_run_id = ? ORDER BY checkpoint_number ASC'
    ).all(testRunId).map(row => ({
      checkpointUuid: row.checkpoint_uuid,
      checkpointNumber: row.checkpoint_number,
      createdAt: row.created_at,
      stats: {
        activitiesExplored: row.activities_explored,
        pathsDiscovered: row.paths_discovered,
        bugsFound: row.bugs_found,
        coveragePercent: row.coverage_percent
      }
    }));
  }
  
  /**
   * 删除检查点（节省空间）
   */
  deleteCheckpoint(checkpointUuid: string): void {
    this.db.prepare(
      'DELETE FROM exploration_checkpoints WHERE checkpoint_uuid = ?'
    ).run(checkpointUuid);
    
    console.log(`[Checkpoint] Deleted checkpoint: ${checkpointUuid}`);
  }
  
  /**
   * 清理旧检查点（保留最近N个）
   */
  cleanupOldCheckpoints(testRunId: number, keepCount: number = 5): void {
    const checkpoints = this.listCheckpoints(testRunId);
    
    if (checkpoints.length <= keepCount) {
      return;
    }
    
    const toDelete = checkpoints.slice(0, checkpoints.length - keepCount);
    
    for (const checkpoint of toDelete) {
      this.deleteCheckpoint(checkpoint.checkpointUuid);
    }
    
    console.log(`[Checkpoint] Cleaned up ${toDelete.length} old checkpoints`);
  }
}

export { CheckpointManager };
```

### 4.3 去重机制

#### 4.3.1 路径哈希计算

```typescript
// src/exploration/path-hasher.ts
class PathHasher {
  /**
   * 计算路径哈希（用于去重）
   * @param path - 探索路径（Activity序列 + 操作序列）
   * @returns SHA256哈希
   */
  static calculatePathHash(path: {
    activityStack: string[];
    actionSequence: UiAction[];
  }): string {
    const crypto = require('crypto');
    
    // 序列化路径
    const pathString = JSON.stringify({
      activities: path.activityStack,
      actions: path.actionSequence.map(a => ({
        type: a.type,
        target: a.target,
        params: a.params
      }))
    });
    
    return crypto.createHash('sha256').update(pathString).digest('hex');
  }
  
  /**
   * 计算UI状态哈希（用于检测重复状态）
   * @param uiTree - UI树JSON
   * @returns 哈希值
   */
  static calculateUiTreeHash(uiTree: any): string {
    const crypto = require('crypto');
    
    // 规范化UI树（排序属性，移除临时状态）
    const normalized = this.normalizeUiTree(uiTree);
    
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }
  
  /**
   * 规范化UI树（用于哈希计算）
   */
  private static normalizeUiTree(uiTree: any): any {
    if (!uiTree) return null;
    
    // 移除不稳定属性（如时间戳、动画状态）
    const normalized = {
      className: uiTree.className,
      text: uiTree.text,
      resourceId: uiTree.resourceId,
      children: (uiTree.children || []).map((child: any) => 
        this.normalizeUiTree(child)
      )
    };
    
    return normalized;
  }
}
```

#### 4.3.2 去重逻辑

```typescript
// 在探索过程中检查去重
async function exploreNextStep(state: ExplorationState): Promise<void> {
  // 1. 获取候选操作
  const candidates = await getCandidateActions();
  
  for (const action of candidates) {
    // 2. 模拟执行，计算路径哈希
    const simulatedPath = simulateAction(state, action);
    const pathHash = PathHasher.calculatePathHash(simulatedPath);
    
    // 3. 检查是否已访问
    if (state.isPathVisited(pathHash)) {
      console.log(`[Exploration] Skipping duplicate path: ${pathHash}`);
      continue;  // 跳过重复路径
    }
    
    // 4. 执行操作
    await executeAction(action);
    
    // 5. 标记为已访问
    state.markPathVisited(pathHash);
    
    // 6. 更新状态
    state.incrementActivityCounter();
    state.updateStats({ totalSteps: state.stats.totalSteps + 1 });
    
    // 7. 定期检查点
    await checkpointManager.checkPeriodicCheckpoint(testRunId);
    
    break;  // 执行成功，退出循环
  }
}
```

---

## 5. 死锁检测与超时保护

### 5.1 探索步骤超时

#### 5.1.1 TimeoutGuard实现

```typescript
// src/utils/timeout-guard.ts
class TimeoutGuard {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEFAULT_STEP_TIMEOUT = 30000;  // 30秒
  private readonly UI_OPERATION_TIMEOUT = 10000;  // 10秒
  private readonly ACTIVITY_TRANSITION_TIMEOUT = 15000;  // 15秒
  
  /**
   * 启动步骤超时计时器
   * @param stepId - 步骤ID
   * @param timeoutMs - 超时时间（毫秒）
   * @param onTimeout - 超时回调
   */
  startStepTimer(
    stepId: string, 
    timeoutMs: number = this.DEFAULT_STEP_TIMEOUT,
    onTimeout: (stepId: string) => void
  ): void {
    console.log(`[TimeoutGuard] Starting timer for step ${stepId} (${timeoutMs}ms)`);
    
    // 清除旧计时器（如果有）
    this.clearTimer(stepId);
    
    // 创建新计时器
    const timer = setTimeout(() => {
      console.error(`[TimeoutGuard] Step ${stepId} timed out after ${timeoutMs}ms`);
      onTimeout(stepId);
    }, timeoutMs);
    
    this.timers.set(stepId, timer);
  }
  
  /**
   * 启动UI操作超时计时器（更短）
   */
  startUIOperationTimer(
    operationId: string,
    onTimeout: (operationId: string) => void
  ): void {
    this.startStepTimer(operationId, this.UI_OPERATION_TIMEOUT, onTimeout);
  }
  
  /**
   * 启动Activity跳转超时计时器
   */
  startActivityTransitionTimer(
    transitionId: string,
    onTimeout: (transitionId: string) => void
  ): void {
    this.startStepTimer(transitionId, this.ACTIVITY_TRANSITION_TIMEOUT, onTimeout);
  }
  
  /**
   * 清除计时器
   */
  clearTimer(stepId: string): void {
    const timer = this.timers.get(stepId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(stepId);
    }
  }
  
  /**
   * 清除所有计时器
   */
  clearAllTimers(): void {
    for (const [stepId, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
  
  /**
   * 重置计时器（在操作进展时调用）
   */
  resetTimer(
    stepId: string, 
    timeoutMs: number = this.DEFAULT_STEP_TIMEOUT,
    onTimeout: (stepId: string) => void
  ): void {
    this.clearTimer(stepId);
    this.startStepTimer(stepId, timeoutMs, onTimeout);
  }
}

export { TimeoutGuard };
```

#### 5.1.2 超时处理策略

```typescript
// 在探索服务中集成TimeoutGuard
class ExplorationService extends EventEmitter {
  private timeoutGuard: TimeoutGuard;
  private currentStepId: string | null = null;
  
  constructor() {
    super();
    this.timeoutGuard = new TimeoutGuard();
  }
  
  /**
   * 执行探索步骤（带超时保护）
   */
  async executeStep(action: UiAction): Promise<StepResult> {
    const stepId = `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.currentStepId = stepId;
    
    return new Promise((resolve, reject) => {
      // 1. 启动超时计时器
      this.timeoutGuard.startStepTimer(
        stepId,
        this.getTimeoutForAction(action),
        (timedOutStepId) => {
          console.error(`[Exploration] Step ${timedOutStepId} timed out`);
          reject(new Error(`Step timeout: ${timedOutStepId}`));
        }
      );
      
      // 2. 执行操作
      this.performAction(action)
        .then(result => {
          // 成功：清除计时器
          this.timeoutGuard.clearTimer(stepId);
          resolve(result);
        })
        .catch(error => {
          // 失败：清除计时器
          this.timeoutGuard.clearTimer(stepId);
          reject(error);
        });
    });
  }
  
  /**
   * 根据操作类型获取超时时间
   */
  private getTimeoutForAction(action: UiAction): number {
    switch (action.type) {
      case 'click':
      case 'input':
        return 10000;  // UI操作：10秒
      
      case 'swipe':
      case 'scroll':
        return 15000;  // 滑动操作：15秒
      
      case 'launch_activity':
      case 'navigate_back':
        return 20000;  // Activity跳转：20秒
      
      default:
        return 30000;  // 默认：30秒
    }
  }
  
  /**
   * 处理步骤超时
   */
  private async handleStepTimeout(stepId: string): Promise<void> {
    console.warn(`[Exploration] Handling timeout for step ${stepId}`);
    
    try {
      // 1. 尝试获取当前Activity
      const currentActivity = await this.adbBridge.getCurrentActivity();
      
      // 2. 检测是否页面卡死
      const isFrozen = await this.detectUIFreeze();
      
      if (isFrozen) {
        console.warn('[Exploration] UI is frozen, forcing recovery...');
        await this.forceRecoverFromFreeze();
      } else {
        console.warn('[Exploration] Step timeout but UI is responsive, navigating back...');
        await this.adbBridge.pressBack();
      }
    } catch (error) {
      console.error('[Exploration] Failed to handle timeout:', error);
      
      // 最后手段：重启当前Activity
      await this.restartCurrentActivity();
    }
  }
}
```

### 5.2 Activity无响应检测

#### 5.2.1 UI冻结检测

```typescript
// src/exploration/ui-freeze-detector.ts
class UIFreezeDetector {
  private lastUiTreeHash: string | null = null;
  private lastChangeTime: number = Date.now();
  private readonly FREEZE_THRESHOLD_MS = 10000;  // 10秒无变化判定为冻结
  private checkInterval: NodeJS.Timeout | null = null;
  
  /**
   * 启动UI冻结检测
   */
  startDetection(onFreezeDetected: () => void): void {
    console.log('[UIFreezeDetector] Starting UI freeze detection...');
    
    this.checkInterval = setInterval(async () => {
      await this.checkUIFreeze(onFreezeDetected);
    }, 2000);  // 每2秒检查一次
  }
  
  /**
   * 检查UI是否冻结
   */
  private async checkUIFreeze(onFreezeDetected: () => void): Promise<void> {
    try {
      // 1. 获取当前UI树
      const uiTree = await this.getUiTree();
      const uiTreeHash = PathHasher.calculateUiTreeHash(uiTree);
      
      // 2. 检查是否变化
      if (uiTreeHash === this.lastUiTreeHash) {
        // UI树未变化
        const timeSinceLastChange = Date.now() - this.lastChangeTime;
        
        if (timeSinceLastChange >= this.FREEZE_THRESHOLD_MS) {
          console.warn(
            `[UIFreezeDetector] UI frozen for ${timeSinceLastChange}ms, triggering recovery...`
          );
          onFreezeDetected();
        }
      } else {
        // UI树变化了，重置计时器
        this.lastUiTreeHash = uiTreeHash;
        this.lastChangeTime = Date.now();
      }
    } catch (error) {
      console.error('[UIFreezeDetector] Error checking UI freeze:', error);
    }
  }
  
  /**
   * 获取UI树（通过UI Automator）
   */
  private async getUiTree(): Promise<any> {
    const { stdout } = await execAsync(
      'adb shell uiautomator dump /sdcard/ui_dump.xml',
      { timeout: 5000 }
    );
    
    const { stdout: xmlContent } = await execAsync(
      'adb shell cat /sdcard/ui_dump.xml',
      { timeout: 5000 }
    );
    
    // 解析XML为JSON
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);
    
    return result;
  }
  
  /**
   * 停止检测
   */
  stopDetection(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[UIFreezeDetector] UI freeze detection stopped');
    }
  }
}

export { UIFreezeDetector };
```

#### 5.2.2 强制恢复策略

```typescript
// 在ExplorationService中添加恢复方法
class ExplorationService {
  private uiFreezeDetector: UIFreezeDetector;
  
  constructor() {
    super();
    this.uiFreezeDetector = new UIFreezeDetector();
  }
  
  /**
   * 启动UI冻结检测
   */
  private startUIFreezeDetection(): void {
    this.uiFreezeDetector.startDetection(async () => {
      console.warn('[Exploration] UI freeze detected, forcing recovery...');
      await this.forceRecoverFromFreeze();
    });
  }
  
  /**
   * 强制从冻结状态恢复
   */
  private async forceRecoverFromFreeze(): Promise<void> {
    try {
      // 策略1: 按返回键
      console.log('[Recovery] Trying press back...');
      await this.adbBridge.pressBack();
      await this.sleep(3000);
      
      // 检查是否恢复
      if (!(await this.isUIFrozen())) {
        console.log('[Recovery] Recovered by pressing back');
        return;
      }
      
      // 策略2: 启动Home Intent
      console.log('[Recovery] Trying launch home...');
      await this.adbBridge.executeShellCommand('am start -a android.intent.action.MAIN -c android.intent.category.HOME');
      await this.sleep(3000);
      
      if (!(await this.isUIFrozen())) {
        console.log('[Recovery] Recovered by launching home');
        return;
      }
      
      // 策略3: 重启当前Activity
      console.log('[Recovery] Trying restart current activity...');
      await this.restartCurrentActivity();
      await this.sleep(5000);
      
      if (!(await this.isUIFrozen())) {
        console.log('[Recovery] Recovered by restarting activity');
        return;
      }
      
      // 策略4: 重启应用
      console.log('[Recovery] Trying restart app...');
      await this.restartApp();
      await this.sleep(5000);
      
      if (!(await this.isUIFrozen())) {
        console.log('[Recovery] Recovered by restarting app');
        return;
      }
      
      // 策略5: 重启AVD（最后手段）
      console.error('[Recovery] All recovery strategies failed, restarting AVD...');
      await this.recoveryManager.recoverAVD();
      
    } catch (error) {
      console.error('[Recovery] Force recovery failed:', error);
      throw error;
    }
  }
  
  /**
   * 检查UI是否冻结
   */
  private async isUIFrozen(): Promise<boolean> {
    try {
      const uiTree = await this.getUiTree();
      const uiTreeHash = PathHasher.calculateUiTreeHash(uiTree);
      
      // 如果能与UI Automator通信，说明未冻结
      return false;
    } catch (error) {
      // 无法获取UI树，可能冻结
      return true;
    }
  }
  
  /**
   * 重启当前Activity
   */
  private async restartCurrentActivity(): Promise<void> {
    const currentActivity = await this.adbBridge.getCurrentActivity();
    
    // 先finish当前Activity
    await this.adbBridge.executeShellCommand('input keyevent KEYCODE_BACK');
    await this.sleep(1000);
    
    // 重新启动Activity
    await this.adbBridge.executeShellCommand(
      `am start -n ${currentActivity}`
    );
  }
  
  /**
   * 重启应用
   */
  private async restartApp(): Promise<void> {
    const packageName = this.getCurrentPackageName();
    
    // 强制停止应用
    await this.adbBridge.executeShellCommand(
      `am force-stop ${packageName}`
    );
    await this.sleep(2000);
    
    // 重新启动应用
    await this.adbBridge.executeShellCommand(
      `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
    );
  }
}
```

### 5.3 最大探索时间全局超时

#### 5.3.1 全局超时管理器

```typescript
// src/exploration/global-timeout-manager.ts
class GlobalTimeoutManager extends EventEmitter {
  private testRunId: number;
  private startTime: number = 0;
  private maxDurationMs: number = 3600000;  // 默认1小时
  private timeoutTimer: NodeJS.Timeout | null = null;
  
  constructor(testRunId: number) {
    super();
    this.testRunId = testRunId;
  }
  
  /**
   * 启动全局超时计时器
   */
  start(maxDurationMs?: number): void {
    if (maxDurationMs) {
      this.maxDurationMs = maxDurationMs;
    }
    
    this.startTime = Date.now();
    
    console.log(
      `[GlobalTimeout] Starting global timeout: ${this.maxDurationMs / 60000} minutes`
    );
    
    this.timeoutTimer = setTimeout(() => {
      console.error(`[GlobalTimeout] Global timeout reached for test run ${this.testRunId}`);
      this.emit('timeout', {
        testRunId: this.testRunId,
        elapsedTimeMs: Date.now() - this.startTime
      });
    }, this.maxDurationMs);
  }
  
  /**
   * 停止计时器
   */
  stop(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
      console.log('[GlobalTimeout] Global timeout stopped');
    }
  }
  
  /**
   * 获取已运行时间
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
  
  /**
   * 获取剩余时间
   */
  getRemainingTime(): number {
    const elapsed = this.getElapsedTime();
    return Math.max(0, this.maxDurationMs - elapsed);
  }
  
  /**
   * 检查是否超时
   */
  isTimeout(): boolean {
    return this.getElapsedTime() >= this.maxDurationMs;
  }
}

export { GlobalTimeoutManager };
```

#### 5.3.2 集成到测试运行

```typescript
// 在测试运行开始时设置全局超时
async function startTestRun(testRunId: number, config: TestRunConfig): Promise<void> {
  const globalTimeoutManager = new GlobalTimeoutManager(testRunId);
  
  // 设置最大探索时间（从配置读取，默认1小时）
  const maxDurationMs = config.maxExplorationTimeMinutes * 60000 || 3600000;
  
  globalTimeoutManager.start(maxDurationMs);
  
  // 监听超时事件
  globalTimeoutManager.on('timeout', async () => {
    console.error(`[TestRun] Global timeout reached for test run ${testRunId}`);
    
    // 1. 保存最终检查点
    await checkpointManager.createCheckpoint(testRunId, { 
      reason: 'global_timeout' 
    });
    
    // 2. 停止探索
    explorationService.stop();
    
    // 3. 更新测试运行状态
    await db('test_runs')
      .where('id', testRunId)
      .update({
        status: 'completed',
        completed_at: Date.now(),
        execution_time_ms: globalTimeoutManager.getElapsedTime(),
        updated_at: Date.now()
      });
    
    // 4. 生成测试报告
    await reportGenerator.generate(testRunId);
    
    console.log(`[TestRun] Test run ${testRunId} completed due to global timeout`);
  });
  
  // 开始探索
  await explorationService.start(testRunId, config);
}
```

---

## 6. 主进程崩溃恢复

### 6.1 架构设计原则

#### 6.1.1 进程分离

```
┌─────────────────────────────────────────┐
│         Electron 主进程                  │
│  • 应用生命周期管理                     │
│  • 窗口管理                             │
│  • 原生API调用                          │
│  • 崩溃时：重启主进程                   │
└──────────────┬──────────────────────────┘
               │
               │ 通过IPC通信
               │
┌──────────────▼──────────────────────────┐
│         Electron 渲染进程                │
│  • UI渲染                               │
│  • 用户交互                             │
│  • 独立于主进程                         │
│  • 主进程崩溃时：保持运行               │
└──────────────┬──────────────────────────┘
               │
               │ 通过WebSocket/HTTP通信
               │
┌──────────────▼──────────────────────────┐
│         后端服务进程                     │
│  • AVD管理                              │
│  • AI探索引擎                           │
│  • 数据持久化                           │
│  • 独立于Electron                       │
└─────────────────────────────────────────┘
```

**关键设计**：

1. **渲染进程独立**: 主进程崩溃不影响UI
2. **后端服务独立**: 使用单独的Node.js进程运行核心逻辑
3. **状态持久化**: 所有关键状态定期保存到数据库

#### 6.1.2 状态持久化策略

```typescript
// src/state/persistent-state-manager.ts
class PersistentStateManager {
  private db: Database;
  private saveInterval: NodeJS.Timeout | null = null;
  private readonly SAVE_INTERVAL_MS = 5000;  // 每5秒保存一次
  
  constructor(db: Database) {
    this.db = db;
  }
  
  /**
   * 启动自动保存
   */
  startAutoSave(testRunId: number, stateProvider: () => any): void {
    console.log(`[PersistentState] Starting auto-save for test run ${testRunId}`);
    
    this.saveInterval = setInterval(async () => {
      try {
        const state = stateProvider();
        await this.saveState(testRunId, state);
      } catch (error) {
        console.error('[PersistentState] Auto-save failed:', error);
      }
    }, this.SAVE_INTERVAL_MS);
  }
  
  /**
   * 保存状态到数据库
   */
  private async saveState(testRunId: number, state: any): Promise<void> {
    const stateJson = JSON.stringify(state);
    
    // 使用UPSERT（插入或更新）
    const existing = this.db.prepare(
      'SELECT id FROM persistent_state WHERE test_run_id = ?'
    ).get(testRunId);
    
    if (existing) {
      this.db.prepare(
        'UPDATE persistent_state SET state_json = ?, updated_at = ? WHERE test_run_id = ?'
      ).run(stateJson, Date.now(), testRunId);
    } else {
      this.db.prepare(
        'INSERT INTO persistent_state (test_run_id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).run(testRunId, stateJson, Date.now(), Date.now());
    }
  }
  
  /**
   * 从数据库恢复状态
   */
  async restoreState(testRunId: number): Promise<any | null> {
    const row = this.db.prepare(
      'SELECT state_json FROM persistent_state WHERE test_run_id = ? ORDER BY updated_at DESC LIMIT 1'
    ).get(testRunId);
    
    if (!row) {
      return null;
    }
    
    return JSON.parse(row.state_json);
  }
  
  /**
   * 停止自动保存
   */
  stopAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
      console.log('[PersistentState] Auto-save stopped');
    }
  }
}

export { PersistentStateManager };
```

**数据库表结构**（需要添加到Schema中）：

```sql
CREATE TABLE IF NOT EXISTS persistent_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL UNIQUE,
    state_json TEXT NOT NULL,  -- 序列化的状态
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_persistent_state_test_run_id ON persistent_state(test_run_id);
```

### 6.2 崩溃检测与重启

#### 6.2.1 主进程崩溃检测（渲染进程中）

```typescript
// 在渲染进程中检测主进程崩溃
// renderer/main-process-monitor.ts
class MainProcessMonitor {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = Date.now();
  private readonly HEARTBEAT_TIMEOUT = 10000;  // 10秒未收到心跳判定为崩溃
  
  start(): void {
    console.log('[MainProcessMonitor] Starting main process monitor...');
    
    // 1. 监听主进程心跳
    window.electronAPI.on('heartbeat', () => {
      this.lastHeartbeat = Date.now();
    });
    
    // 2. 定期检查主进程是否存活
    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT) {
        console.error('[MainProcessMonitor] Main process crash detected!');
        this.handleMainProcessCrash();
      }
    }, 3000);  // 每3秒检查一次
  }
  
  private async handleMainProcessCrash(): Promise<void> {
    // 1. 显示崩溃提示
    this.showCrashDialog();
    
    // 2. 尝试重启主进程
    try {
      await window.electronAPI.restartMainProcess();
      console.log('[MainProcessMonitor] Main process restarted');
      
      // 3. 恢复未完成的任务
      await this.recoverUnfinishedTasks();
    } catch (error) {
      console.error('[MainProcessMonitor] Failed to restart main process:', error);
    }
  }
  
  private showCrashDialog(): void {
    // 显示"主进程已崩溃，正在恢复..."的提示
    const dialog = document.createElement('div');
    dialog.id = 'crash-dialog';
    dialog.innerHTML = `
      <div class="crash-dialog-content">
        <h2>主进程已崩溃</h2>
        <p>正在自动恢复，请稍候...</p>
        <div class="spinner"></div>
      </div>
    `;
    document.body.appendChild(dialog);
  }
  
  private async recoverUnfinishedTasks(): Promise<void> {
    // 查询未完成的测试运行
    const unfinishedRuns = await window.electronAPI.getUnfinishedTestRuns();
    
    if (unfinishedRuns.length > 0) {
      console.log(`[MainProcessMonitor] Found ${unfinishedRuns.length} unfinished test runs`);
      
      // 提示用户是否恢复
      const shouldRecover = confirm(
        `发现 ${unfinishedRuns.length} 个未完成的测试任务，是否恢复？`
      );
      
      if (shouldRecover) {
        for (const run of unfinishedRuns) {
          await window.electronAPI.recoverTestRun(run.id);
        }
      }
    }
  }
}
```

#### 6.2.2 主进程中心跳发送

```typescript
// 在主进程中定期发送心跳
// main.ts
import { BrowserWindow } from 'electron';

function startHeartbeat(window: BrowserWindow): void {
  setInterval(() => {
    window.webContents.send('heartbeat');
  }, 5000);  // 每5秒发送一次心跳
}
```

### 6.3 自动恢复流程

#### 6.3.1 启动时恢复检测

```typescript
// main.ts - 应用启动时
async function onAppReady(): Promise<void> {
  console.log('[Main] App ready, checking for unfinished tasks...');
  
  // 1. 查询未完成的测试运行
  const unfinishedRuns = db.prepare(
    "SELECT * FROM test_runs WHERE status IN ('pending', 'running')"
  ).all();
  
  if (unfinishedRuns.length > 0) {
    console.log(`[Main] Found ${unfinishedRuns.length} unfinished test runs`);
    
    // 2. 显示恢复对话框
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['恢复', '忽略'],
      defaultId: 0,
      title: '恢复未完成的任务',
      message: `发现 ${unfinishedRuns.length} 个未完成的测试任务`,
      detail: '是否恢复这些任务？'
    });
    
    if (response === 0) {
      // 3. 恢复任务
      for (const run of unfinishedRuns) {
        await recoverTestRun(run.id);
      }
    } else {
      // 4. 标记为放弃
      for (const run of unfinishedRuns) {
        db.prepare(
          "UPDATE test_runs SET status = 'abandoned', updated_at = ? WHERE id = ?"
        ).run(Date.now(), run.id);
      }
    }
  }
  
  // 5. 创建主窗口
  createMainWindow();
}

async function recoverTestRun(testRunId: number): Promise<void> {
  console.log(`[Main] Recovering test run ${testRunId}...`);
  
  try {
    // 1. 更新状态为running
    db.prepare(
      'UPDATE test_runs SET status = ?, updated_at = ? WHERE id = ?'
    ).run('running', Date.now(), testRunId);
    
    // 2. 恢复检查点
    const checkpointManager = new CheckpointManager(db);
    await checkpointManager.restoreFromLatestCheckpoint(testRunId);
    
    // 3. 重启AVD（如果需要）
    const recoveryManager = new RecoveryManager(
      getAVDName(testRunId), 
      testRunId, 
      checkpointManager
    );
    await recoveryManager.start();
    
    console.log(`[Main] Test run ${testRunId} recovered successfully`);
  } catch (error) {
    console.error(`[Main] Failed to recover test run ${testRunId}:`, error);
    
    // 标记为失败
    db.prepare(
      'UPDATE test_runs SET status = ?, updated_at = ? WHERE id = ?'
    ).run('failed', Date.now(), testRunId);
  }
}
```

---

## 7. 状态管理与序列化

### 7.1 状态分类

| 状态类型 | 存储位置 | 持久化频率 | 恢复优先级 |
|---------|---------|-----------|-----------|
| **探索状态** | DB (exploration_checkpoints) | 每5分钟/每5个Activity | 高 |
| **测试运行状态** | DB (test_runs) | 实时更新 | 高 |
| **UI状态** | DB (persistent_state) | 每5秒 | 中 |
| **缓存数据** | 文件系统 | 按需 | 低 |

### 7.2 序列化最佳实践

#### 7.2.1 使用MessagePack代替JSON

**理由**：

- **更小的体积**: MessagePack比JSON小20-30%
- **更快的序列化/反序列化**: 二进制格式，解析更快
- **支持更多类型**: 如Date、Buffer等

```typescript
// 使用msgpack-lite
const msgpack = require('msgpack-lite');

// 序列化
const serialized = msgpack.encode(stateObject);
const buffer = Buffer.from(serialized);

// 反序列化
const decoded = msgpack.decode(buffer);
```

#### 7.2.2 版本化状态格式

```typescript
interface SerializedState {
  version: number;  // 状态格式版本
  timestamp: number;
  data: any;
}

// 序列化时添加版本号
serialize(): Buffer {
  const stateObject = {
    version: 1,  // 当前版本
    timestamp: Date.now(),
    data: {
      activityStack: this.activityStack,
      visitedPaths: Array.from(this.visitedPaths),
      // ...
    }
  };
  
  return msgpack.encode(stateObject);
}

// 反序列化时处理版本兼容
static deserialize(buffer: Buffer): ExplorationState {
  const stateObject = msgpack.decode(buffer);
  
  if (stateObject.version === 1) {
    // v1格式
    return this.deserializeV1(stateObject.data);
  } else if (stateObject.version === 2) {
    // v2格式
    return this.deserializeV2(stateObject.data);
  } else {
    throw new Error(`Unsupported state version: ${stateObject.version}`);
  }
}
```

---

## 8. 监控与告警

### 8.1 关键指标监控

```typescript
// src/monitoring/metrics-collector.ts
class MetricsCollector {
  private metrics: Map<string, MetricValue> = new Map();
  
  /**
   * 记录AVD心跳延迟
   */
  recordHeartbeatLatency(latencyMs: number): void {
    this.recordMetric('avd.heartbeat.latency', latencyMs);
  }
  
  /**
   * 记录检查点创建
   */
  recordCheckpointCreated(checkpointNumber: number): void {
    this.recordMetric('checkpoint.created', checkpointNumber);
  }
  
  /**
   * 记录恢复事件
   */
  recordRecoveryEvent(event: 'started' | 'succeeded' | 'failed'): void {
    this.recordMetric(`recovery.${event}`, 1);
  }
  
  /**
   * 记录超时事件
   */
  recordTimeout(stepId: string, timeoutType: string): void {
    this.recordMetric(`timeout.${timeoutType}`, 1);
  }
  
  private recordMetric(name: string, value: number): void {
    this.metrics.set(name, {
      value,
      timestamp: Date.now()
    });
  }
  
  /**
   * 获取指标汇总
   */
  getMetricsSummary(): any {
    const summary: any = {};
    
    for (const [name, metric] of this.metrics) {
      if (!summary[name]) {
        summary[name] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity
        };
      }
      
      summary[name].count++;
      summary[name].sum += metric.value;
      summary[name].min = Math.min(summary[name].min, metric.value);
      summary[name].max = Math.max(summary[name].max, metric.value);
    }
    
    // 计算平均值
    for (const name of Object.keys(summary)) {
      summary[name].avg = summary[name].sum / summary[name].count;
    }
    
    return summary;
  }
}

interface MetricValue {
  value: number;
  timestamp: number;
}
```

### 8.2 告警规则

```typescript
// src/monitoring/alert-manager.ts
class AlertManager {
  private rules: AlertRule[] = [
    {
      metric: 'avd.heartbeat.latency',
      condition: 'avg_5min > 5000',
      severity: 'warning',
      message: 'AVD heartbeat latency too high'
    },
    {
      metric: 'recovery.failed',
      condition: 'count_1hour > 3',
      severity: 'critical',
      message: 'Multiple recovery failures detected'
    },
    {
      metric: 'timeout.step',
      condition: 'count_10min > 10',
      severity: 'warning',
      message: 'Frequent step timeouts detected'
    }
  ];
  
  /**
   * 评估告警规则
   */
  evaluateRules(metrics: any): Alert[] {
    const alerts: Alert[] = [];
    
    for (const rule of this.rules) {
      if (this.evaluateCondition(rule, metrics)) {
        alerts.push({
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          timestamp: Date.now()
        });
      }
    }
    
    return alerts;
  }
  
  private evaluateCondition(rule: AlertRule, metrics: any): boolean {
    // 简化实现：实际应使用表达式解析器
    const metricValue = metrics[rule.metric];
    
    if (rule.condition.includes('avg_5min >')) {
      const threshold = parseFloat(rule.condition.split('>')[1].trim());
      return metricValue && metricValue.avg > threshold;
    }
    
    return false;
  }
}
```

---

## 9. 测试策略

### 9.1 单元测试

```typescript
// test/unit/heartbeat-manager.test.ts
import { HeartbeatManager } from '../../src/avd/heartbeat-manager';

describe('HeartbeatManager', () => {
  let heartbeatManager: HeartbeatManager;
  
  beforeEach(() => {
    heartbeatManager = new HeartbeatManager('test-avd');
  });
  
  it('should detect AVD crash after 3 consecutive failures', async () => {
    const crashPromise = new Promise((resolve) => {
      heartbeatManager.on('avd:crashed', resolve);
    });
    
    // 模拟3次失败
    for (let i = 0; i < 3; i++) {
      heartbeatManager['performHeartbeat']();
    }
    
    await crashPromise;
    // 断言：crash事件被触发
  });
});
```

### 9.2 集成测试

```typescript
// test/integration/recovery-integration.test.ts
import { RecoveryManager } from '../../src/avd/recovery-manager';

describe('Recovery Integration', () => {
  it('should recover from AVD crash and restore checkpoint', async () => {
    // 1. 启动测试运行
    const testRunId = await startTestRun();
    
    // 2. 创建检查点
    await checkpointManager.createCheckpoint(testRunId);
    
    // 3. 模拟AVD崩溃
    await simulateAVDCrash();
    
    // 4. 验证自动恢复
    await waitForRecovery(testRunId);
    
    // 5. 验证状态恢复
    const state = await getExplorationState(testRunId);
    expect(state).not.toBeNull();
  });
});
```

### 9.3 压力测试

```typescript
// test/stress/concurrent-exploration.test.ts
describe('Concurrent Exploration Stress Test', () => {
  it('should handle 10 concurrent test runs with failures', async () => {
    const testRunIds = [];
    
    // 启动10个并发测试
    for (let i = 0; i < 10; i++) {
      const id = await startTestRun({ avdName: `avd-${i}` });
      testRunIds.push(id);
    }
    
    // 随机杀死一些AVD
    await randomlyKillAVDs(3);
    
    // 验证所有测试最终完成或恢复
    await waitForAllTestsComplete(testRunIds, 3600000);  // 1小时超时
  });
});
```

---

## 10. 总结

本文档详细设计了VTest的故障恢复与断点续传架构，核心包括：

1. **AVD崩溃恢复**: Heartbeat检测 + 自动重启 + 检查点恢复
2. **AI探索断点续传**: 状态序列化 + 定期检查点 + 去重机制
3. **死锁检测与超时保护**: 步骤超时 + UI冻结检测 + 强制恢复
4. **主进程崩溃恢复**: 进程分离 + 状态持久化 + 自动重启恢复

**关键设计原则**：

- **故障不可避免，但恢复可以快速**: 通过检查点机制保证快速恢复
- **去重至关重要**: 避免重复探索，节省时间和资源
- **超时保护必须多层次**: 步骤级、Activity级、全局级
- **状态持久化要频繁但不影响性能**: 5秒自动保存 + 关键操作立即保存

**下一步行动**：

1. 实现HeartbeatManager和RecoveryManager
2. 完善CheckpointManager的序列化和反序列化
3. 集成TimeoutGuard到探索流程
4. 编写单元测试和集成测试
5. 进行压力测试和故障注入测试

---

**文档维护**：

- 本文档随架构演进同步更新
- 重大变更需经过架构评审
- 联系人：Arch-Lead

---

**附录：配置参数参考**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `HEARTBEAT_NORMAL_INTERVAL` | 10000ms | 正常Heartbeat间隔 |
| `HEARTBEAT_HIGH_FREQ_INTERVAL` | 3000ms | 高风险Heartbeat间隔 |
| `MAX_HEARTBEAT_FAILURES` | 3 | 判定崩溃的连续失败次数 |
| `CHECKPOINT_INTERVAL_ACTIVITIES` | 5 | 每N个Activity创建检查点 |
| `CHECKPOINT_INTERVAL_MINUTES` | 5 | 每N分钟创建检查点 |
| `DEFAULT_STEP_TIMEOUT` | 30000ms | 默认步骤超时 |
| `UI_OPERATION_TIMEOUT` | 10000ms | UI操作超时 |
| `ACTIVITY_TRANSITION_TIMEOUT` | 15000ms | Activity跳转超时 |
| `FREEZE_THRESHOLD_MS` | 10000ms | UI冻结判定阈值 |
| `GLOBAL_TIMEOUT_DEFAULT` | 3600000ms (1小时) | 全局超时 |
| `STATE_SAVE_INTERVAL` | 5000ms | 状态自动保存间隔 |
