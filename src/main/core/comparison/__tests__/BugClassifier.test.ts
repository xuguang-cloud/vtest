import { BugClassifier } from '../BugClassifier'
import {
  StructuralComparisonResult,
  VisualComparisonResult,
  UnmatchedRequirement,
  ExtraUIElement,
} from '../../contracts/comparison.contract'

describe('BugClassifier', () => {
  let classifier: BugClassifier

  beforeEach(() => {
    classifier = new BugClassifier()
  })

  const createStructuralResult = (overrides?: Partial<StructuralComparisonResult>): StructuralComparisonResult => ({
    prdId: 'prd-001',
    coverageRate: 0.75,
    matchedRequirements: [],
    unmatchedRequirements: [],
    extraElements: [],
    ...overrides,
  })

  const createUnmatchedRequirement = (reason: 'not_found' | 'partial_match' | 'wrong_state'): UnmatchedRequirement => ({
    requirementId: 'req-001',
    requirementTitle: 'Login Screen',
    reason,
    expectedUI: { element: 'login_button', type: 'Button', text: 'Login' },
    searchedActivities: ['LoginActivity'],
  })

  const createVisualResult = (overrides?: Partial<VisualComparisonResult>): VisualComparisonResult => ({
    totalScreensCompared: 2,
    matches: [],
    mismatches: [],
    overallSimilarityScore: 0.85,
    ...overrides,
  })

  describe('classify', () => {
    it('should classify unmatched requirements as 需求缺失', () => {
      const structural = createStructuralResult({
        unmatchedRequirements: [createUnmatchedRequirement('not_found')],
      })

      const result = classifier.classify(structural)

      expect(result.bugs.some(b => b.type === '需求缺失')).toBe(true)
    })

    it('should classify partial_match as 需求缺失 with P2 severity', () => {
      const structural = createStructuralResult({
        unmatchedRequirements: [createUnmatchedRequirement('partial_match')],
      })

      const result = classifier.classify(structural)

      expect(result.bugs.some(b => b.type === '需求缺失')).toBe(true)
    })

    it('should classify visual mismatches as 设计缺陷', () => {
      const structural = createStructuralResult()
      const visual = createVisualResult({
        mismatches: [{
          screenName: 'LoginActivity',
          activity: 'LoginActivity',
          expectedImagePath: '/designs/login.png',
          actualImagePath: '/screenshots/login.png',
          diffImagePath: '/diffs/login.png',
          diffPercentage: 0.25,
          diffRegions: [{ x: 0, y: 0, width: 100, height: 100, pixelDiffCount: 500 }],
          severity: 'critical',
        }],
      })

      const result = classifier.classify(structural, visual)

      expect(result.bugs.some(b => b.type === '设计缺陷')).toBe(true)
    })

    it('should classify debug elements as UX缺陷', () => {
      const extra: ExtraUIElement = {
        elementName: 'debug_panel',
        activity: 'LoginActivity',
        pathId: 'path-1',
        category: 'debug_element',
      }
      const structural = createStructuralResult({
        extraElements: [extra],
      })

      const result = classifier.classify(structural)

      expect(result.bugs.some(b => b.type === 'UX缺陷')).toBe(true)
    })

    it('should assign P0 severity for critical visual mismatches', () => {
      const structural = createStructuralResult()
      const visual = createVisualResult({
        mismatches: [{
          screenName: 'LoginActivity',
          activity: 'LoginActivity',
          expectedImagePath: '/designs/login.png',
          actualImagePath: '/screenshots/login.png',
          diffImagePath: '/diffs/login.png',
          diffPercentage: 0.35,
          diffRegions: [],
          severity: 'critical',
        }],
      })

      const result = classifier.classify(structural, visual)

      const designBug = result.bugs.find(b => b.type === '设计缺陷')
      expect(designBug).toBeDefined()
      expect(designBug?.severity).toBe('P0')
    })

    it('should build summary with correct totals', () => {
      const structural = createStructuralResult({
        unmatchedRequirements: [createUnmatchedRequirement('not_found')],
        extraElements: [{
          elementName: 'debug_btn',
          activity: 'HomeActivity',
          pathId: 'path-1',
          category: 'debug_element',
        }],
      })

      const result = classifier.classify(structural)

      expect(result.summary.totalBugs).toBeGreaterThan(0)
      expect(result.summary.coverageRate).toBe(0.75)
    })

    it('should handle empty results gracefully', () => {
      const structural = createStructuralResult()

      const result = classifier.classify(structural)

      expect(result.bugs).toHaveLength(0)
      expect(result.summary.totalBugs).toBe(0)
    })
  })
})
