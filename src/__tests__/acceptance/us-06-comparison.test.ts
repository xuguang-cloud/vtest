/**
 * US-06: PRD/Design Document Compliance Comparison - Acceptance-Level TDD Tests
 *
 * NOTE: This is a TDD test file for the Red phase. All tests are expected to fail
 * before the US-06 comparison service is implemented.
 *
 * Tests cover the five core scenarios:
 * 1. PRD structured JSON comparison (element existence, attribute matching, missing element detection)
 * 2. Design document visual comparison (pixel-level diff, difference region annotation)
 * 3. Automatic bug classification (requirement missing / design defect / UX defect / implementation inconsistency)
 * 4. Bug severity levels (P0-P3)
 * 5. Bug output format (screenshot evidence + reproduction path + PRD original text reference)
 */

import { BugEntry, PRDRequirement } from '../../main/core/contracts/comparison.contract'
import { ComparisonService } from '../../main/services/ComparisonService'

describe('US-06: PRD/Design Document Compliance Comparison', () => {
  let comparisonService: ComparisonService

  beforeEach(() => {
    comparisonService = new ComparisonService()
  })

  // Test fixture helpers
  const createMockPRD = (): PRDRequirement => ({
    id: 'PRD-001',
    title: 'Login Screen Requirements',
    priority: 'high',
    acceptanceCriteria: [
      'AC-01: Username input field must be present on login screen',
      'AC-02: Password input field must be present on login screen',
      'AC-03: Login button must have text "Sign In"',
      'AC-04: Login button must be primary color (#007AFF)',
      'AC-05: Forgot password link must be present below login button',
    ],
    uiRequirements: [
      { element: 'username_input', type: 'text_field', placeholder: 'Enter username' },
      { element: 'password_input', type: 'text_field', placeholder: 'Enter password' },
      { element: 'login_button', type: 'button', text: 'Sign In', color: '#007AFF' },
      { element: 'forgot_password_link', type: 'link', text: 'Forgot Password?' },
    ],
    screens: ['login_screen', 'forgot_password_screen'],
  })

  const createMockPRDWithMissingElements = (): PRDRequirement => ({
    id: 'PRD-002',
    title: 'Registration Screen Requirements',
    priority: 'high',
    acceptanceCriteria: [
      'AC-01: Email input field must be present',
      'AC-02: Terms checkbox must be present',
      'AC-03: Submit button must be present',
    ],
    uiRequirements: [
      { element: 'email_input', type: 'text_field', placeholder: 'Enter email' },
      { element: 'terms_checkbox', type: 'checkbox', text: 'I agree to terms' },
      { element: 'submit_button', type: 'button', text: 'Submit', color: '#28A745' },
    ],
    screens: ['registration_screen'],
  })

  const createMockUIElement = (
    element: string,
    type: string,
    overrides?: Partial<{ color: string; text: string; placeholder: string }>
  ) => ({
    element,
    type,
    ...overrides,
  })
  // AC-1: PRD structured JSON comparison
  describe('AC-1: PRD structured JSON comparison', () => {
    it('should detect when all PRD required elements exist in implementation (happy path)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, implementation)

      expect(result.prdId).toBe(prd.id)
      expect(result.coverageRate).toBe(100)
      expect(result.unmatchedRequirements).toHaveLength(0)
      expect(result.bugs).toHaveLength(0)
    })

    it('should detect missing elements when implementation lacks PRD required elements (error case)', async () => {
      const prd = createMockPRD()
      const incompleteImplementation = prd.uiRequirements
        .filter((ui) => ui.element !== 'forgot_password_link')
        .map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, incompleteImplementation)

      expect(result.coverageRate).toBeLessThan(100)
      expect(result.unmatchedRequirements).toContain('forgot_password_link')
      expect(result.bugs.length).toBeGreaterThan(0)
    })

    it('should match element attributes correctly: color, text, placeholder (happy path)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) =>
        createMockUIElement(ui.element, ui.type, {
          color: ui.color,
          text: ui.text,
          placeholder: ui.placeholder,
        })
      )

      const result = await comparisonService.comparePRD(prd, implementation)

      const inconsistencyBugs = result.bugs.filter((b) => b.type === '实现不一致')
      expect(inconsistencyBugs).toHaveLength(0)
    })

    it('should detect attribute mismatch when implementation color differs from PRD (error case)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) =>
        createMockUIElement(ui.element, ui.type, {
          color: ui.element === 'login_button' ? '#FF0000' : ui.color,
          text: ui.text,
        })
      )

      const result = await comparisonService.comparePRD(prd, implementation)

      const colorMismatchBug = result.bugs.find(
        (b) => b.type === '实现不一致' && (b.description.includes('color') || b.description.includes('#FF0000'))
      )
      expect(colorMismatchBug).toBeDefined()
    })

    it('should handle empty implementation gracefully (edge case)', async () => {
      const prd = createMockPRD()
      const emptyImplementation: Array<{ element: string; type: string }> = []

      const result = await comparisonService.comparePRD(prd, emptyImplementation)

      expect(result.coverageRate).toBe(0)
      expect(result.bugs.length).toBe(prd.uiRequirements.length)
    })
  })
  // AC-2: Design document visual comparison
  describe('AC-2: Design document visual comparison', () => {
    it('should detect pixel differences between design and implementation screenshots (happy path)', async () => {
      const designScreenshot = '/fixtures/designs/login_screen_design.png'
      const implementationScreenshot = '/fixtures/screenshots/login_screen_impl.png'

      const result = await comparisonService.compareScreenshots(designScreenshot, implementationScreenshot)

      expect(result.diffPercentage).toBeGreaterThanOrEqual(0)
      expect(result.diffImagePath).toBeDefined()
      expect(typeof result.diffImagePath).toBe('string')
    })

    it('should annotate difference regions on the diff output (happy path)', async () => {
      const designScreenshot = '/fixtures/designs/login_screen_design.png'
      const implementationScreenshot = '/fixtures/screenshots/login_screen_with_differences.png'

      const result = await comparisonService.compareScreenshots(designScreenshot, implementationScreenshot)

      expect(result.highlightedRegions).toBeDefined()
      expect(result.highlightedRegions!.length).toBeGreaterThan(0)
      expect(result.highlightedRegions![0]).toHaveProperty('x')
      expect(result.highlightedRegions![0]).toHaveProperty('y')
      expect(result.highlightedRegions![0]).toHaveProperty('width')
      expect(result.highlightedRegions![0]).toHaveProperty('height')
    })

    it('should return zero pixel difference when screenshots are identical (edge case)', async () => {
      const designScreenshot = '/fixtures/designs/login_screen_design.png'
      const implementationScreenshot = '/fixtures/screenshots/login_screen_design.png'

      const result = await comparisonService.compareScreenshots(designScreenshot, implementationScreenshot)

      expect(result.diffPercentage).toBe(0)
      expect(result.highlightedRegions).toHaveLength(0)
    })

    it('should throw error when screenshot file does not exist (error case)', async () => {
      const nonExistentPath = '/fixtures/screenshots/non_existent.png'
      const anotherPath = '/fixtures/screenshots/login_screen_impl.png'

      await expect(comparisonService.compareScreenshots(nonExistentPath, anotherPath)).rejects.toThrow()
    })
  })
  // AC-3: Automatic bug classification
  describe('AC-3: Automatic bug classification', () => {
    it('should classify missing PRD elements as "需求缺失" (error case)', async () => {
      const prd = createMockPRDWithMissingElements()
      const implementation = prd.uiRequirements
        .filter((ui) => ui.element !== 'terms_checkbox')
        .map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, implementation)

      const missingReqBug = result.bugs.find((b) => b.type === '需求缺失')
      expect(missingReqBug).toBeDefined()
      expect(missingReqBug?.description).toContain('terms_checkbox')
    })

    it('should classify visual design differences as "设计缺陷" (error case)', async () => {
      const designScreenshot = '/fixtures/designs/login_screen_design.png'
      const implementationScreenshot = '/fixtures/screenshots/login_screen_wrong_colors.png'

      const result = await comparisonService.compareScreenshots(designScreenshot, implementationScreenshot)
      const bugs = await comparisonService.classifyVisualBugs(result, '设计缺陷')

      expect(bugs.some((b) => b.type === '设计缺陷')).toBe(true)
    })

    it('should classify UX interaction issues as "UX缺陷" (error case)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) =>
        createMockUIElement(ui.element, ui.type, {
          text: ui.element === 'login_button' ? '' : ui.text,
        })
      )

      const result = await comparisonService.comparePRD(prd, implementation)

      const uxBug = result.bugs.find((b) => b.type === 'UX缺陷')
      expect(uxBug).toBeDefined()
    })

    it('should classify implementation that deviates from PRD as "实现不一致" (error case)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) =>
        createMockUIElement(ui.element, ui.type, {
          text: ui.element === 'login_button' ? 'Login' : ui.text,
        })
      )

      const result = await comparisonService.comparePRD(prd, implementation)

      const inconsistencyBug = result.bugs.find((b) => b.type === '实现不一致')
      expect(inconsistencyBug).toBeDefined()
    })

    it('should handle implementation with no bugs (happy path)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) =>
        createMockUIElement(ui.element, ui.type, {
          color: ui.color,
          text: ui.text,
          placeholder: ui.placeholder,
        })
      )

      const result = await comparisonService.comparePRD(prd, implementation)

      expect(result.bugs).toHaveLength(0)
      expect(result.coverageRate).toBe(100)
    })
  })
  // AC-4: Bug severity levels P0-P3
  describe('AC-4: Bug severity levels P0-P3', () => {
    it('should classify missing critical elements as P0 (critical) (error case)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements
        .filter((ui) => ui.element !== 'login_button')
        .map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, implementation)

      const p0Bug = result.bugs.find((b) => b.severity === 'P0')
      expect(p0Bug).toBeDefined()
      expect(p0Bug?.description.toLowerCase()).toContain('login_button')
    })

    it('should classify non-critical UI mismatches as P1, P2, or P3 based on impact (error case)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) =>
        createMockUIElement(ui.element, ui.type, {
          color: ui.element === 'login_button' ? '#007AFE' : ui.color,
        })
      )

      const result = await comparisonService.comparePRD(prd, implementation)

      const colorBug = result.bugs.find((b) => b.description.toLowerCase().includes('color') || b.description.includes('#007AFE'))
      expect(colorBug).toBeDefined()
      expect(['P1', 'P2', 'P3']).toContain(colorBug?.severity)
    })

    it('should include severity in all generated bug entries (edge case)', async () => {
      const prd = createMockPRDWithMissingElements()
      const implementation: Array<{ element: string; type: string }> = []

      const result = await comparisonService.comparePRD(prd, implementation)

      expect(result.bugs.length).toBeGreaterThan(0)
      result.bugs.forEach((bug) => {
        expect(['P0', 'P1', 'P2', 'P3']).toContain(bug.severity)
      })
    })
  })
  // AC-5: Bug output format
  describe('AC-5: Bug output format', () => {
    it('should include screenshot evidence in each bug entry (happy path)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, implementation)

      result.bugs.forEach((bug) => {
        expect(bug.screenshotEvidence).toBeDefined()
        expect(bug.screenshotEvidence?.length).toBeGreaterThan(0)
      })
    })

    it('should include reproduction steps (path) for each bug entry (happy path)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, implementation)

      result.bugs.forEach((bug) => {
        expect(bug.reproSteps).toBeDefined()
        expect(bug.reproSteps.length).toBeGreaterThan(0)
      })
    })

    it('should reference original PRD text in bug entries (happy path)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements
        .filter((ui) => ui.element !== 'forgot_password_link')
        .map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, implementation)

      const bug = result.bugs.find((b) => b.type === '需求缺失')
      expect(bug).toBeDefined()
      expect(bug?.prdReference).toBeDefined()
      expect(bug?.prdReference).toContain('PRD-001')
    })

    it('should generate complete bug output with all required fields (edge case: multiple bugs)', async () => {
      const prd = createMockPRDWithMissingElements()
      const implementation: Array<{ element: string; type: string }> = []

      const result = await comparisonService.comparePRD(prd, implementation)

      expect(result.bugs.length).toBeGreaterThan(0)
      result.bugs.forEach((bug: BugEntry) => {
        expect(bug.id).toBeDefined()
        expect(bug.type).toMatch(/需求缺失|设计缺陷|UX缺陷|实现不一致/)
        expect(bug.severity).toMatch(/P[0-3]/)
        expect(bug.description).toBeTruthy()
        expect(bug.reproSteps).toBeInstanceOf(Array)
        expect(bug.reproSteps.length).toBeGreaterThan(0)
        expect(bug.screenshotEvidence).toBeDefined()
        expect(bug.prdReference).toBeDefined()
        expect(bug.pathId).toBeDefined()
      })
    })

    it('should include pathId for each bug to support navigation (edge case)', async () => {
      const prd = createMockPRD()
      const implementation = prd.uiRequirements.map((ui) => createMockUIElement(ui.element, ui.type))

      const result = await comparisonService.comparePRD(prd, implementation)

      result.bugs.forEach((bug) => {
        expect(bug.pathId).toBeDefined()
        expect(bug.pathId!.length).toBeGreaterThan(0)
      })
    })
  })
})
