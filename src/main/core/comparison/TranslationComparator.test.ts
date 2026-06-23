import { describe, it, expect } from 'vitest'
import { TranslationComparator } from './TranslationComparator'
import { UIString } from '../plugin/PluginHost'

describe('TranslationComparator', () => {
  const comparator = new TranslationComparator()

  const buildStrings = (values: string[]): UIString[] =>
    values.map((text, idx) => ({ text, elementId: `el-${idx}`, screen: 'Login' }))

  it('detects matching translation', () => {
    const actual = buildStrings(['Login'])
    const specs = [{ locale: 'en', strings: { login: 'Login' } }]
    const issues = comparator.compare(actual, specs)
    expect(issues).toHaveLength(0)
  })

  it('detects mismatch translation', () => {
    const actual = buildStrings(['Logim'])
    const specs = [{ locale: 'en', strings: { login: 'Login' } }]
    const issues = comparator.compare(actual, specs)
    expect(issues.some(i => i.type === 'mismatch')).toBe(true)
  })

  it('detects extra untranslated strings', () => {
    const actual = buildStrings(['Login'])
    const specs = [{ locale: 'zh', strings: { login: '登录' } }]
    const issues = comparator.compare(actual, specs)
    expect(issues.some(i => i.type === 'extra')).toBe(true)
  })

  it('ignores whitespace when configured', () => {
    const actual = buildStrings(['  Login  '])
    const specs = [{ locale: 'en', strings: { login: 'Login' } }]
    const issues = comparator.compare(actual, specs)
    expect(issues).toHaveLength(0)
  })

  it('handles empty spec', () => {
    const actual = buildStrings(['Login'])
    const specs = [{ locale: 'en', strings: {} }]
    const issues = comparator.compare(actual, specs)
    expect(issues.length).toBeGreaterThan(0)
  })
})
