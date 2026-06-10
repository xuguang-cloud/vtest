/**
 * 加密工具模块
 * 使用 AES-256-GCM 提供加密/解密/哈希/状态生成
 * 
 * Master Key 管理:
 * - 首次使用时在 userData 目录生成并持久化 keyfile
 * - 后续启动自动从 keyfile 读取
 * - keyfile 本身以机器派生密钥加密存储
 * - 可通过 VTEST_MASTER_KEY_PATH 环境变量自定义路径
 */
import crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const KEY_STORAGE_FILENAME = '.vtest-master-key'

export interface EncryptedData {
  encryptedData: string
  iv: string
  authTag: string
  dekIv: string
}

let cachedMasterKey: Buffer | null = null
let keyStorePath: string | null = null

/**
 * 获取机器指纹（用于派生 keyfile 加密密钥）
 * 结合主机名和 OS 信息，保证同一设备可重现
 */
function getMachineFingerprint(): Buffer {
  const hostname = require('os').hostname()
  const platform = require('os').platform()
  const fingerprint = `VTEST_MASTER_KEY_V1:${hostname}:${platform}`
  return crypto.createHash('sha256').update(fingerprint).digest()
}

/**
 * 用机器指纹加密 Buffer
 */
function encryptBufferWithFingerprint(plaintext: Buffer): string {
  const fingerprint = getMachineFingerprint()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, fingerprint, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return iv.toString('base64') + ':' + tag.toString('base64') + ':' + encrypted.toString('base64')
}

/**
 * 用机器指纹解密 Buffer
 */
function decryptBufferWithFingerprint(encoded: string): Buffer {
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid keyfile format')
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')
  const fingerprint = getMachineFingerprint()
  const decipher = crypto.createDecipheriv(ALGORITHM, fingerprint, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

/**
 * 获取或生成 Master Key
 * 优先从 keyfile 读取，不存在则生成并持久化
 */
function getMasterKey(): Buffer {
  if (cachedMasterKey) {
    return cachedMasterKey
  }
  // 尝试从 keyfile 读取
  const loaded = loadMasterKeyFromFile()
  if (loaded) {
    cachedMasterKey = loaded
    return loaded
  }
  // 生成新 key 并持久化
  const newKey = crypto.randomBytes(KEY_LENGTH)
  saveMasterKeyToFile(newKey)
  cachedMasterKey = newKey
  return newKey
}

/**
 * 设置 keyfile 存储路径
 * 可在 app 初始化时由主进程调用: initMasterKey(app.getPath('userData'))
 */
export function initMasterKey(storageDir?: string): void {
  const dir = storageDir || process.env.VTEST_MASTER_KEY_PATH || process.cwd()
  keyStorePath = path.resolve(dir, KEY_STORAGE_FILENAME)
  // 重置缓存，下次 getMasterKey 会从文件加载
  cachedMasterKey = null
}

/**
 * 从 keyfile 加载 Master Key
 */
function loadMasterKeyFromFile(): Buffer | null {
  const filePath = resolveKeyFilePath()
  if (!filePath) return null
  try {
    if (!fs.existsSync(filePath)) return null
    const encoded = fs.readFileSync(filePath, 'utf-8').trim()
    if (!encoded) return null
    return decryptBufferWithFingerprint(encoded)
  } catch {
    // 文件损坏或密钥变更，删除后重新生成
    try { fs.unlinkSync(filePath) } catch { /* ignore */ }
    return null
  }
}

/**
 * 将 Master Key 持久化到 keyfile
 */
function saveMasterKeyToFile(key: Buffer): void {
  const filePath = resolveKeyFilePath()
  if (!filePath) return
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const encoded = encryptBufferWithFingerprint(key)
    fs.writeFileSync(filePath, encoded, { encoding: 'utf-8', mode: 0o600 })
  } catch (err) {
    // 非致命错误，session 内仍可工作
    console.warn('[vtest-crypto] Failed to persist master key:', (err as Error).message)
  }
}

/**
 * 解析 keyfile 路径
 */
function resolveKeyFilePath(): string | null {
  // 优先使用环境变量
  if (process.env.VTEST_MASTER_KEY_PATH) {
    return path.resolve(process.env.VTEST_MASTER_KEY_PATH, KEY_STORAGE_FILENAME)
  }
  // 其次使用 initMasterKey 设置的路径
  if (keyStorePath) return keyStorePath
  // 回退到 cwd
  return path.resolve(process.cwd(), KEY_STORAGE_FILENAME)
}

export function encryptToken(plaintext: string): EncryptedData {
  const dataIv = crypto.randomBytes(IV_LENGTH)
  const dek = crypto.randomBytes(KEY_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, dek, dataIv)
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')
  const authTag = cipher.getAuthTag().toString('base64')

  // Encrypt the DEK with master key
  const masterKey = getMasterKey()
  const dekIv = crypto.randomBytes(IV_LENGTH)
  const keyCipher = crypto.createCipheriv(ALGORITHM, masterKey, dekIv)
  let encryptedDek = keyCipher.update(dek, undefined, 'base64')
  encryptedDek += keyCipher.final('base64')
  const keyAuthTag = keyCipher.getAuthTag().toString('base64')

  // Format: encryptedDek:keyAuthTag:dekIvBase64:ciphertext
  const wrappedKey = encryptedDek + ':' + keyAuthTag + ':' + dekIv.toString('base64')

  return {
    encryptedData: wrappedKey + ':' + ciphertext,
    iv: dataIv.toString('base64'),
    authTag,
    dekIv: dekIv.toString('base64')
  }
}

export function decryptToken(encryptedData: EncryptedData): string {
  const parts = encryptedData.encryptedData.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }
  const [encryptedDek, keyAuthTag, keyIvBase64, ciphertext] = parts
  const masterKey = getMasterKey()
  const keyIv = Buffer.from(keyIvBase64, 'base64')
  const keyDecipher = crypto.createDecipheriv(ALGORITHM, masterKey, keyIv)
  keyDecipher.setAuthTag(Buffer.from(keyAuthTag, 'base64'))
  let dek: Buffer
  try {
    const dekBuffer = keyDecipher.update(encryptedDek, 'base64')
    const finalDek = keyDecipher.final()
    dek = Buffer.concat([dekBuffer, finalDek])
  } catch {
    throw new Error('Failed to unwrap data encryption key')
  }

  const dataIv = Buffer.from(encryptedData.iv, 'base64')
  const authTag = Buffer.from(encryptedData.authTag, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, dataIv)
  decipher.setAuthTag(authTag)

  try {
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8')
    plaintext += decipher.final('utf8')
    return plaintext
  } catch {
    throw new Error('Failed to decrypt token')
  }
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}