import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12

export interface EncryptedData {
  encryptedData: string
  iv: string
  authTag: string
  dekIv: string
}

let cachedMasterKey: Buffer | null = null

function getMasterKey(): Buffer {
  if (!cachedMasterKey) {
    cachedMasterKey = crypto.randomBytes(KEY_LENGTH)
  }
  return cachedMasterKey
}

export function encryptToken(plaintext: string): EncryptedData {
  const dek = crypto.randomBytes(KEY_LENGTH)
  const dekIv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, dek, dekIv)
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')
  const authTag = cipher.getAuthTag().toString('base64')
  
  const wrappedKey = crypto.publicEncrypt(getMasterKey(), dek).toString('base64')
  
  return {
    encryptedData: `${wrappedKey}:${ciphertext}`,
    iv: dekIv.toString('base64'),
    authTag,
    dekIv: dekIv.toString('base64')
  }
}

export function decryptToken(encryptedData: EncryptedData): string {
  const [wrappedKey, ciphertext] = encryptedData.encryptedData.split(':')
  const dek = crypto.privateDecrypt(getMasterKey(), Buffer.from(wrappedKey, 'base64'))
  const iv = Buffer.from(encryptedData.dekIv, 'base64')
  const authTag = Buffer.from(encryptedData.authTag, 'base64')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv)
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
