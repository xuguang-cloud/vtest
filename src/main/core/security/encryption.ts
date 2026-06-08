import crypto from 'crypto'
import { mainLogger as logger } from '../logger/Logger'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16 // AES-GCM typically uses 16-byte IVs (96 bits for GCM)

export interface EncryptedData {
  encryptedData: string
  iv: string
  authTag: string
  dekIv: string
}

let cachedMasterKey: Buffer | null = null

function getMasterKey(): Buffer {
  if (cachedMasterKey) {
    return cachedMasterKey
  }
  cachedMasterKey = crypto.randomBytes(KEY_LENGTH)
  return cachedMasterKey
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
