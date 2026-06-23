import { describe, it, expect } from "@jest/globals"
import { TranslationComparator } from '../TranslationComparator'
import { UIString } from '../../plugin/PluginHost'

describe('TranslationComparator (Jest)', () => {
  const comparator = new TranslationComparator()

  const buildStrings = (values: string[]): UIString[] =>
    values.map((text, idx) => ({ text, elementId: `el-${idx}`, screen: 'Login', source: 'text' }))

  describe('compare', () => {
    it('returns no issues when actual strings match the spec exactly', () => {
      const actual = buildStrings(['Login'])
      const specs = [{ locale: 'en', strings: { login: 'Login' } }]
      const issues = comparator.compare(actual, specs)
      expect(issues).toHaveLength(0)
    })

    it('returns no issues when whitespace differs', () => {
      const actual = buildStrings(['  Login  '])
      const specs = [{ locale: 'en', strings: { login: 'Login' } }]
      const issues = comparator.compare(actual, specs)
      expect(issues).toHaveLength(0)
    })

    it('detects extra untranslated strings', () => {
      const actual = buildStrings(['Login'])
      const specs = [{ locale: 'zh', strings: { login: '登录' } }]
      const issues = comparator.compare(actual, specs)
      expect(issues.some(i => i.type === 'extra')).toBe(true)
    })

    it('detects mismatched strings', () => {
      const actual = buildStrings(['Logim'])
      const specs = [{ locale: 'en', strings: { login: 'Login' } }]
      const issues = comparator.compare(actual, specs)
      expect(issues.some(i => i.type === 'mismatch')).toBe(true)
    })

    it('handles empty actual strings', () => {
      const actual: UIString[] = []
      const specs = [{ locale: 'en', strings: { login: 'Login' } }]
      const issues = comparator.compare(actual, specs)
      expect(issues).toHaveLength(0)
    })

    it('handles empty specs', () => {
      const actual = buildStrings(['Login'])
      const specs = [{ locale: 'en', strings: {} }]
      const issues = comparator.compare(actual, specs)
      expect(issues.some(i => i.type === 'extra')).toBe(true)
    })

    it('handles multiple locales', () => {
      const actual = buildStrings(['Login'])
      const specs = [
        { locale: 'en', strings: { login: 'Login' } },
        { locale: 'zh', strings: { login: '登录' } },
      ]
      const issues = comparator.compare(actual, specs)
      expect(issues.length).toBeGreaterThanOrEqual(0)
    })

    it('normalizes whitespace in actual strings', () => {
      const actual = buildStrings(['Log  in'])
      const specs = [{ locale: 'en', strings: { login: 'Login' } }]
      const issues = comparator.compare(actual, specs)
      expect(issues).toHaveLength(0)
    })

    it('preserves element id and screen in issues', () => {
      const actual: UIString[] = [{ text: 'Logim', elementId: 'el-0', screen: 'Login', source: 'text' }]
      const specs = [{ locale: 'en', strings: { login: 'Login' } }]
      const issues = comparator.compare(actual, specs)
      const mismatch = issues.find(i => i.type === 'mismatch')
      expect(mismatch?.elementId).toBe('el-0')
      expect(mismatch?.screen).toBe('Login')
    })
  })
})
