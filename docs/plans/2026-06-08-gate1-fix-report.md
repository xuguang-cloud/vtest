# Gate 1 阻塞性问题修复报告

**修复日期**: 2026-06-08
**修复状态**: ✅ 已完成

---

## 修复摘要

| 阻塞性 | 问题 | 修复措施 | 状态 |
|--------|------|---------|------|
| **B1** | `encryptToken` iv/dekIv 字段语义混淆 | 明确 `iv` 为数据加密 IV，`dekIv` 为 DEK 加密 IV，两者独立生成 | ✅ 已修复 |
| **B2** | `IPCService.ts` exploration:start 双重注册 | 删除直接注册，统一使用 `createSecureHandler` 模式 | ✅ 已修复 |

---

## B1 修复详情

**问题**: `encryptToken` 返回值的 `iv` 和 `dekIv` 字段存储了同一个值，导致语义混淆。

**修复前**:
```typescript
const dekIv = crypto.randomBytes(IV_LENGTH)
// ...
return {
  encryptedData: wrappedKey + ':' + ciphertext,
  iv: dekIv.toString('base64'),  // 同一个值
  authTag,
  dekIv: dekIv.toString('base64')  // 同一个值
}
```

**修复后**:
```typescript
// 生成独立的数据加密IV（用于加密plaintext）
const dataIv = crypto.randomBytes(IV_LENGTH)
// 生成独立的DEK加密IV（用于加密DEK）
const dekIv = crypto.randomBytes(IV_LENGTH)
// ...
return {
  encryptedData: wrappedKey + ':' + ciphertext,
  iv: dataIv.toString('base64'),      // 数据加密IV
  authTag,
  dekIv: dekIv.toString('base64')     // DEK加密IV
}
```

**关键变更**:
- `iv`: 现在表示**数据加密 IV**（用于加密 plaintext）
- `dekIv`: 现在表示**DEK 加密 IV**（用于加密 DEK）
- 两者独立生成，语义清晰

---

## B2 修复详情

**问题**: `IPCService.ts` 第 82 行直接注册了 `exploration:start` handler，与第 62 行 `createSecureHandler` 重复注册同一通道。

**修复前**:
```typescript
// 第62行: createSecureHandler 注册
export function registerIPCHandlers() {
  createSecureHandler('exploration:start', async () => { ... })
}

// 第82行: 直接注册（重复！）
ipcMain.handle('exploration:start', async (event) => { ... })
```

**修复后**:
```typescript
// 仅保留 createSecureHandler 注册
export function registerIPCHandlers() {
  createSecureHandler('exploration:start', async () => { ... })
}
```

**关键变更**:
- 删除了第 82 行的直接注册代码
- 统一使用 `createSecureHandler` 模式
- 所有 IPC handler 都经过白名单验证和发送者验证

---

## main/index.ts 更新

**变更**: 使用 `registerIPCHandlers()` 替代 `require('./services/IPCService')`

```typescript
import { registerIPCHandlers, setTrustedSender } from './services/IPCService'

// 在 createWindow 中设置受信任发送者
setTrustedSender(mainWindow.webContents)

// 在 app.whenReady 中注册安全的 IPC 处理器
registerIPCHandlers()
```

---

## 5S 门禁状态更新

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| **Standard** | ✅ PASS | ✅ PASS |
| **Secure** | ❌ FAIL | ✅ PASS |
| **Scalable** | ✅ PASS | ✅ PASS |
| **Stable** | ✅ PASS | ✅ PASS |
| **Sustainable** | ✅ PASS | ✅ PASS |

**5S 综合评定**: ✅ **全维度 PASS**

---

## 下一步

1. ✅ Gate 1 评审通过
2. 🔄 进入 Phase 2: TDD 验收级端到端测试
3. 🔄 进入 Phase 3: 开发实现

**Gate 1 状态**: ✅ **通过**
