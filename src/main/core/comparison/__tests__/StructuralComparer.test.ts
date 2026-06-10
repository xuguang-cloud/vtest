import { StructuralComparer } from '../StructuralComparer'
import { ExplorationResult } from '../../contracts/exploration.contract'
import { PRDRequirement } from '../../contracts/comparison.contract'

describe('StructuralComparer', () => {
  let comparer: StructuralComparer

  beforeEach(() => {
    comparer = new StructuralComparer()
  })

  const createExplorationResult = (paths: any[]): ExplorationResult => ({
    appPackage: 'com.test.app',
    paths: paths.map((p, i) => ({
      pathId: `path-${i}`,
      startActivity: p.startActivity || 'MainActivity',
      endActivity: p.endActivity || 'MainActivity',
      steps: p.steps || [],
      coverage: p.coverage || [],
      duration: p.duration || 0,
      success: p.success !== false,
      reproducible: true,
    })),
    totalPaths: paths.length,
    coverageSummary: {
      totalActivities: 0,
      exploredActivities: Array.from(new Set(paths.flatMap(p => [p.startActivity, p.endActivity]).filter(Boolean))).length,
      coverageRate: 0
    },
    explorationStart: new Date().toISOString(),
    explorationEnd: new Date().toISOString(),
  })

  const createPRD = (overrides?: Partial<PRDRequirement>): PRDRequirement => ({
    id: 'req-001',
    title: 'Test Requirement',
    priority: 'P0',
    acceptanceCriteria: ['AC-01'],
    uiRequirements: [
      { element: 'username_input', type: 'EditText', placeholder: 'Enter username' },
      { element: 'password_input', type: 'EditText', placeholder: 'Enter password' },
      { element: 'login_button', type: 'Button', text: 'Login' },
    ],
    screens: ['LoginActivity'],
    expectedActivities: ['LoginActivity'],
    behaviorDescription: 'User can login',
    ...overrides,
  })

  describe('compare', () => {
    it('should return 100% coverage when all PRD elements are found', () => {
      const exploration = createExplorationResult([
        {
          startActivity: 'LoginActivity',
          endActivity: 'LoginActivity',
          steps: [
            { element: 'username_input', type: 'EditText', text: '' },
            { element: 'password_input', type: 'EditText', text: '' },
            { element: 'login_button', type: 'Button', text: 'Login' },
          ],
        },
      ])
      const prd = createPRD()

      const result = comparer.compare(exploration, [prd])

      expect(result.coverageRate).toBe(1)
      expect(result.unmatchedRequirements).toHaveLength(0)
      expect(result.matchedRequirements).toHaveLength(1)
    })

    it('should detect missing elements', () => {
      const exploration = createExplorationResult([
        {
          startActivity: 'LoginActivity',
          endActivity: 'LoginActivity',
          steps: [
            { element: 'username_input', type: 'EditText', text: '' },
          ],
        },
      ])
      const prd = createPRD()

      const result = comparer.compare(exploration, [prd])

      expect(result.coverageRate).toBeLessThan(1)
      expect(result.unmatchedRequirements.length).toBeGreaterThan(0)
    })

    it('should identify extra elements not in PRD', () => {
      const exploration = createExplorationResult([
        {
          startActivity: 'LoginActivity',
          endActivity: 'LoginActivity',
          steps: [
            { element: 'username_input', type: 'EditText', text: '' },
            { element: 'password_input', type: 'EditText', text: '' },
            { element: 'login_button', type: 'Button', text: 'Login' },
            { element: 'debug_panel', type: 'View', text: '' },
          ],
        },
      ])
      const prd = createPRD()

      const result = comparer.compare(exploration, [prd])

      expect(result.extraElements.length).toBeGreaterThan(0)
      expect(result.extraElements.some(e => e.elementName === 'debug_panel')).toBe(true)
    })

    it('should handle empty PRD requirements', () => {
      const exploration = createExplorationResult([])
      const result = comparer.compare(exploration, [])

      expect(result.coverageRate).toBe(0)
      expect(result.matchedRequirements).toHaveLength(0)
    })

    it('should calculate coverage rate correctly', () => {
      const exploration = createExplorationResult([
        {
          startActivity: 'LoginActivity',
          endActivity: 'LoginActivity',
          steps: [
            { element: 'username_input', type: 'EditText', text: '' },
            { element: 'password_input', type: 'EditText', text: '' },
          ],
        },
      ])
      const prd = createPRD()

      const result = comparer.compare(exploration, [prd])

      expect(result.coverageRate).toBeGreaterThanOrEqual(0)
      expect(result.coverageRate).toBeLessThanOrEqual(1)
    })
  })
})
