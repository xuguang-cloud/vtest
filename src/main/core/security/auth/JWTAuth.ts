/**
 * JWTAuth — 简易 JWT 认证实现
 * 使用 Node.js crypto 实现 HMAC-SHA256 签名
 * 无需外部 jsonwebtoken 依赖
 */
import crypto from 'crypto'

export interface JWTHeader {
  alg: 'HS256'
  typ: 'JWT'
}

export interface JWTPayload {
  sub?: string
  iss?: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

export class JWTAuth {
  private secret: string
  private defaultExpiresIn: number

  constructor(secret: string, defaultExpiresInMs: number = 86400000) {
    this.secret = secret
    this.defaultExpiresIn = defaultExpiresInMs
  }

  sign(payload: Record<string, unknown>, expiresInMs?: number): string {
    const header: JWTHeader = { alg: 'HS256', typ: 'JWT' }
    const now = Date.now()

    const fullPayload: JWTPayload = {
      ...payload,
      iat: Math.floor(now / 1000),
      exp: Math.floor((now + (expiresInMs || this.defaultExpiresIn)) / 1000)
    }

    const headerBase64 = this.base64urlEncode(JSON.stringify(header))
    const payloadBase64 = this.base64urlEncode(JSON.stringify(fullPayload))
    const signature = this.createSignature(`${headerBase64}.${payloadBase64}`)

    return `${headerBase64}.${payloadBase64}.${signature}`
  }

  verify(token: string): JWTPayload {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new JWTError('Invalid token format')
    }

    const [headerBase64, payloadBase64, signature] = parts

    // 验证签名
    const expectedSignature = this.createSignature(`${headerBase64}.${payloadBase64}`)
    if (signature !== expectedSignature) {
      throw new JWTError('Invalid signature')
    }

    // 解析 payload
    const payload: JWTPayload = JSON.parse(this.base64urlDecode(payloadBase64))

    // 检查过期
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new JWTError('Token expired')
    }

    return payload
  }

  decode(token: string): { header: JWTHeader; payload: JWTPayload } | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const header: JWTHeader = JSON.parse(this.base64urlDecode(parts[0]))
      const payload: JWTPayload = JSON.parse(this.base64urlDecode(parts[1]))
      return { header, payload }
    } catch {
      return null
    }
  }

  private createSignature(data: string): string {
    const hmac = crypto.createHmac('sha256', this.secret)
    hmac.update(data)
    return this.base64urlEncode(hmac.digest())
  }

  private base64urlEncode(data: Buffer | string): string {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data
    return buffer
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }

  private base64urlDecode(data: string): string {
    const padded = data.padEnd(data.length + (4 - (data.length % 4)) % 4, '=')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    return Buffer.from(padded, 'base64').toString('utf-8')
  }

  refreshToken(token: string, expiresInMs?: number): string {
    const payload = this.verify(token)
    const { iat, exp, ...rest } = payload
    return this.sign(rest, expiresInMs)
  }
}

export class JWTError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JWTError'
  }
}