/**
 * APITester — API 接口测试器
 * 支持 HTTP 请求发送、响应验证、断言链式调用
 */
import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'

export interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

export interface APIResponse {
  status: number
  statusText: string
  data: unknown
  headers: Record<string, string>
  duration: number
}

export interface ExpectedResponse {
  status?: number
  data?: unknown
  headers?: Record<string, string>
}

export class APITester {
  private baseURL: string
  private defaultHeaders: Record<string, string> = {}

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/+$/, '')
  }

  setDefaultHeaders(headers: Record<string, string>): void {
    Object.assign(this.defaultHeaders, headers)
  }

  async request(endpoint: string, options: RequestOptions = {}): Promise<APIResponse> {
    const url = new URL(`${this.baseURL}${endpoint}`)
    const isHttps = url.protocol === 'https:'
    const startTime = Date.now()

    return new Promise<APIResponse>((resolve, reject) => {
      const headers = { ...this.defaultHeaders, ...options.headers }
      const bodyStr = options.body ? JSON.stringify(options.body) : undefined

      if (bodyStr && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }

      const reqOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers,
        timeout: options.timeout || 30000
      }

      const lib = isHttps ? https : http
      const req = lib.request(reqOptions, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8')
          let data: unknown = raw
          try {
            data = JSON.parse(raw)
          } catch {
            // 不是 JSON，保持原始字符串
          }

          const responseHeaders: Record<string, string> = {}
          for (const [key, value] of Object.entries(res.headers)) {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value)
          }

          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            data,
            headers: responseHeaders,
            duration: Date.now() - startTime
          })
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request timeout after ${options.timeout || 30000}ms`))
      })

      if (bodyStr) {
        req.write(bodyStr)
      }
      req.end()
    })
  }

  async get(endpoint: string, options?: RequestOptions): Promise<APIResponse> {
    return this.request(endpoint, { ...options, method: 'GET' })
  }

  async post(endpoint: string, body?: unknown, options?: RequestOptions): Promise<APIResponse> {
    return this.request(endpoint, { ...options, method: 'POST', body })
  }

  async put(endpoint: string, body?: unknown, options?: RequestOptions): Promise<APIResponse> {
    return this.request(endpoint, { ...options, method: 'PUT', body })
  }

  async delete(endpoint: string, options?: RequestOptions): Promise<APIResponse> {
    return this.request(endpoint, { ...options, method: 'DELETE' })
  }

  async testEndpoint(
    endpoint: string,
    options: RequestOptions,
    expected: ExpectedResponse
  ): Promise<APIResponse> {
    const response = await this.request(endpoint, options)

    // 验证状态码
    if (expected.status !== undefined && response.status !== expected.status) {
      throw new APIError(
        `Expected status ${expected.status}, got ${response.status}`
      )
    }

    // 验证响应数据
    if (expected.data !== undefined) {
      const actual = JSON.stringify(response.data)
      const expectedStr = JSON.stringify(expected.data)
      if (actual !== expectedStr) {
        throw new APIError(
          `Response data mismatch\nExpected: ${expectedStr}\nGot: ${actual}`
        )
      }
    }

    // 验证响应头
    if (expected.headers) {
      for (const [key, value] of Object.entries(expected.headers)) {
        const actualValue = response.headers[key.toLowerCase()]
        if (actualValue !== value) {
          throw new APIError(
            `Expected header ${key} to be "${value}", got "${actualValue}"`
          )
        }
      }
    }

    return response
  }

  /**
   * 测试多个端点并返回结果摘要
   */
  async batchTest(
    tests: Array<{
      name: string
      endpoint: string
      options: RequestOptions
      expected: ExpectedResponse
    }>
  ): Promise<{ passed: number; failed: number; results: Array<{ name: string; passed: boolean; error?: string }> }> {
    const results: Array<{ name: string; passed: boolean; error?: string }> = []

    for (const test of tests) {
      try {
        await this.testEndpoint(test.endpoint, test.options, test.expected)
        results.push({ name: test.name, passed: true })
      } catch (error) {
        results.push({
          name: test.name,
          passed: false,
          error: (error as Error).message
        })
      }
    }

    return {
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results
    }
  }
}

export class APIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'APIError'
  }
}