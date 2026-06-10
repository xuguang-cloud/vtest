/**
 * DataSanitizer — 数据清理器
 * 自动识别并脱敏敏感信息
 */

export interface SanitizationRule {
  name: string
  pattern: RegExp
  replacement: string
  description: string
}

export class DataSanitizer {
  private rules: SanitizationRule[] = [
    {
      name: 'ssn',
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: '***-**-****',
      description: 'Social Security Number'
    },
    {
      name: 'credit_card',
      pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
      replacement: '****-****-****-****',
      description: 'Credit Card Number'
    },
    {
      name: 'email',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '***@***.***',
      description: 'Email Address'
    },
    {
      name: 'phone',
      pattern: /\b1[3-9]\d{9}\b/g,
      replacement: '***-****-****',
      description: 'Chinese Phone Number'
    },
    {
      name: 'ip_address',
      pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      replacement: '***.***.***.***',
      description: 'IP Address'
    },
    {
      name: 'token',
      pattern: /(?:bearer|token|secret|password|api[_-]?key)\s*[:=]\s*['"]?\S+['"]?/gi,
      replacement: '$1: ***',
      description: 'Authentication Token'
    }
  ]

  addRule(rule: SanitizationRule): void {
    this.rules.push(rule)
  }

  removeRule(name: string): void {
    this.rules = this.rules.filter(r => r.name !== name)
  }

  sanitize(data: string): string {
    let sanitized = data
    for (const rule of this.rules) {
      sanitized = sanitized.replace(rule.pattern, rule.replacement)
    }
    return sanitized
  }

  /**
   * 深度清理 — 递归清理对象中的所有字符串字段
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.sanitize(value)
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitizeObject(value as Record<string, unknown>)
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'string' 
            ? this.sanitize(item)
            : (item && typeof item === 'object')
              ? this.sanitizeObject(item as Record<string, unknown>)
              : item
        )
      } else {
        result[key] = value
      }
    }
    return result as T
  }

  detectSensitiveData(data: string): string[] {
    const detected: string[] = []
    for (const rule of this.rules) {
      if (rule.pattern.test(data)) {
        detected.push(rule.name)
      }
    }
    return [...new Set(detected)]
  }

  getRules(): SanitizationRule[] {
    return [...this.rules]
  }
}