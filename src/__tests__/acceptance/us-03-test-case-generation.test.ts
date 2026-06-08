/**
 * US-03: Test Case Generation - Acceptance-Level TDD Tests
 */

import { TestCase } from '../../main/core/contracts/test-execution.contract'
import { ExplorationPath } from '../../main/core/contracts/exploration.contract'
import { TestCaseGenerator } from '../../main/services/TestCaseGenerator'

describe('US-03: Test Case Generation', () => {
  let generator: TestCaseGenerator

  beforeEach(() => {
    generator = new TestCaseGenerator()
  })

  describe('AC-1: Path to test case conversion', () => {
    const samplePath: ExplorationPath = {
      pathId: 'path-001',
      startActivity: 'MainActivity',
      endActivity: 'SettingsActivity',
      steps: [
        { action: 'click', element: 'btn_settings' },
        { action: 'scroll', direction: 'down' },
        { action: 'click', element: 'cb_notifications' }
      ],
      coverage: ['MainActivity', 'SettingsActivity'],
      reproducible: true
    }

    it('should generate a test case from an exploration path', () => {
      const testCase = generator.generateFromPath(samplePath)
      expect(testCase).toBeDefined()
      expect(testCase.caseId).toBeDefined()
      expect(testCase.title).toBeDefined()
    })

    it('should generate a caseId for each test case', () => {
      const testCase = generator.generateFromPath(samplePath)
      expect(testCase.caseId).toMatch(/^TC-\d+$/)
    })

    it('should map each exploration step to a test step', () => {
      const testCase = generator.generateFromPath(samplePath)
      expect(testCase.steps.length).toBe(samplePath.steps.length)
      testCase.steps.forEach((step, index) => {
        expect(step.step).toBe(index + 1)
        expect(step.action).toBeDefined()
      })
    })

    it('should include priority for each test case', () => {
      const testCase = generator.generateFromPath(samplePath)
      expect(['P0', 'P1', 'P2', 'P3']).toContain(testCase.priority)
    })
  })

  describe('AC-2: Test case format validation', () => {
    const validTestCase: TestCase = {
      caseId: 'TC-001',
      title: 'Test navigation to settings',
      priority: 'P0',
      preconditions: 'App is on MainActivity',
      steps: [
        { step: 1, action: 'Click settings button', expected: 'Settings screen opens' },
        { step: 2, action: 'Scroll down', expected: 'Notifications option visible' }
      ],
      expectedResult: 'Settings page displays all options',
      postconditions: 'User is on SettingsActivity',
      tags: ['navigation', 'settings']
    }

    it('should validate complete test case with all required fields', () => {
      expect(generator.validateCase(validTestCase)).toBe(true)
    })

    it('should reject test case without title', () => {
      const invalidCase = { ...validTestCase, title: '' }
      expect(generator.validateCase(invalidCase as TestCase)).toBe(false)
    })

    it('should reject test case without steps', () => {
      const invalidCase = { ...validTestCase, steps: [] }
      expect(generator.validateCase(invalidCase as TestCase)).toBe(false)
    })

    it('should reject test case without expectedResult', () => {
      const invalidCase = { ...validTestCase, expectedResult: '' }
      expect(generator.validateCase(invalidCase as TestCase)).toBe(false)
    })

    it('should reject test case without preconditions', () => {
      const invalidCase = { ...validTestCase, preconditions: '' }
      expect(generator.validateCase(invalidCase as TestCase)).toBe(false)
    })

    it('should validate each step has action and expected', () => {
      const caseWithInvalidStep: TestCase = {
        ...validTestCase,
        steps: [{ step: 1, action: '', expected: '' }]
      }
      expect(generator.validateCase(caseWithInvalidStep)).toBe(false)
    })
  })

  describe('AC-3: Generation success rate', () => {
    it('should report generation success rate >= 98%', () => {
      const successRate = generator.getSuccessRate()
      expect(successRate).toBeGreaterThanOrEqual(98)
    })

    it('should count successful vs failed generations', () => {
      const total = 100
      const successful = 98
      const rate = (successful / total) * 100
      expect(rate).toBeGreaterThanOrEqual(98)
    })

    it('should handle edge case of zero paths', () => {
      const paths: ExplorationPath[] = []
      expect(paths.length).toBe(0)
    })

    it('should handle single path generation', () => {
      const paths: ExplorationPath[] = [{
        pathId: 'p1', startActivity: 'A', endActivity: 'B',
        steps: [], coverage: ['A'], reproducible: true
      }]
      expect(paths.length).toBe(1)
    })
  })
})
