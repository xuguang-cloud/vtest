import { UIString } from '../plugin/PluginHost'

export interface TranslationSpec {
  locale: string
  strings: Record<string, string>
}

export interface TranslationIssue {
  type: 'missing' | 'mismatch' | 'extra'
  key: string
  expected?: string
  actual?: string
  elementId: string
  screen: string
  severity: 'high' | 'medium' | 'low'
}

export class TranslationComparator {
  compare(actualStrings: UIString[], specs: TranslationSpec[]): TranslationIssue[] {
    const issues: TranslationIssue[] = []
    for (const spec of specs) {
      const specMap = this.buildSpecMap(spec)
      for (const str of actualStrings) {
        const normalizedActual = this.normalize(str.text)
        let found = false
        for (const [key, expectedValue] of Object.entries(specMap)) {
          if (normalizedActual === expectedValue) {
            found = true
            break
          }
          if (expectedValue) {
            issues.push({
              type: 'mismatch',
              key,
              expected: expectedValue,
              actual: str.text,
              elementId: str.elementId,
              screen: str.screen,
              severity: 'high'
            })
          }
        }
        if (!found) {
          issues.push({
            type: 'extra',
            key: normalizedActual,
            actual: str.text,
            elementId: str.elementId,
            screen: str.screen,
            severity: 'low'
          })
        }
      }
    }
    return issues
  }

  private buildSpecMap(spec: TranslationSpec): Record<string, string> {
    const map: Record<string, string> = {}
    for (const [key, value] of Object.entries(spec.strings)) {
      map[key] = this.normalize(value)
    }
    return map
  }

  private normalize(text: string): string {
    return text.replace(/\s+/g, '')
  }
}
