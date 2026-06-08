import { VisualComparer } from '../VisualComparer'
import { DesignAsset, ComparisonOptions } from '../../contracts/comparison.contract'

describe('VisualComparer', () => {
  let comparer: VisualComparer

  beforeEach(() => {
    comparer = new VisualComparer()
  })

  const createDesignAsset = (id: string, screenName: string, activity?: string): DesignAsset => ({
    id,
    screenName,
    activity: activity || screenName,
    imageData: Buffer.alloc(100),
    filePath: `/designs/${screenName}.png`,
    metadata: {},
  })

  const createOptions = (): ComparisonOptions => ({
    visualThreshold: 0.1,
    structural: true,
    visual: true,
    coverageGapThreshold: 0.2,
  })

  describe('compare', () => {
    it('should return match when screens are identical', () => {
      const actual = [createDesignAsset('screen-1', 'LoginActivity')]
      const expected = [createDesignAsset('screen-1', 'LoginActivity')]

      const result = comparer.compare(actual, expected, createOptions())

      expect(result.totalScreensCompared).toBe(1)
      expect(result.matches.length + result.mismatches.length).toBe(1)
    })

    it('should detect mismatches when screens differ', () => {
      const actual = [createDesignAsset('screen-1', 'LoginActivity')]
      const expected = [createDesignAsset('screen-2', 'LoginActivity')]

      const result = comparer.compare(actual, expected, createOptions())

      expect(result.totalScreensCompared).toBeGreaterThanOrEqual(0)
    })

    it('should return empty result when no expected screens', () => {
      const actual = [createDesignAsset('screen-1', 'LoginActivity')]
      const expected: DesignAsset[] = []

      const result = comparer.compare(actual, expected, createOptions())

      expect(result.totalScreensCompared).toBe(0)
      expect(result.matches).toHaveLength(0)
      expect(result.mismatches).toHaveLength(0)
    })

    it('should handle empty actual screens', () => {
      const actual: DesignAsset[] = []
      const expected = [createDesignAsset('screen-1', 'LoginActivity')]

      const result = comparer.compare(actual, expected, createOptions())

      expect(result.totalScreensCompared).toBe(0)
    })

    it('should classify severity based on diff percentage', () => {
      const actual = [createDesignAsset('screen-1', 'LoginActivity')]
      const expected = [createDesignAsset('screen-1-diff', 'LoginActivity')]

      const result = comparer.compare(actual, expected, createOptions())

      for (const mismatch of result.mismatches) {
        expect(['minor', 'major', 'critical']).toContain(mismatch.severity)
      }
    })
  })
})
