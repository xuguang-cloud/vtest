import { getDatabase } from '../core/database/connection'
import { Logger } from '../core/logger/Logger'
import { TestCase, TestStep } from '../core/contracts/test-execution.contract'
import { ExplorationPath } from '../core/contracts/exploration.contract'

const logger = Logger.getLogger('test-case')

export { TestCase, TestStep }

export interface GenerateTestCasesRequest {
  projectId: string
  paths: ExplorationPath[]
  priority?: 'P0' | 'P1' | 'P2' | 'P3'
}

export class TestCaseService {
  /**
   * Convert exploration paths to test cases
   */
  public async generateTestCases(request: GenerateTestCasesRequest): Promise<TestCase[]> {
    const { projectId, paths, priority = 'P1' } = request
    
    try {
      const testCases: TestCase[] = paths.map(path => this.pathToTestCase(path, projectId, priority))
      
      // Store test cases in database
      const db = getDatabase()
      for (const testCase of testCases) {
        await db('test_cases').insert({
          project_id: projectId,
          case_id: testCase.caseId,
          title: testCase.title,
          priority: testCase.priority,
          preconditions: testCase.preconditions,
          steps: JSON.stringify(testCase.steps),
          expected_result: testCase.expectedResult,
          postconditions: testCase.postconditions,
          tags: JSON.stringify(testCase.tags)
        })
      }
      
      logger.info(`Generated ${testCases.length} test cases for project ${projectId}`)
      return testCases
    } catch (error) {
      logger.error(`Failed to generate test cases: ${error}`)
      throw error
    }
  }

  /**
   * Get test cases by project ID
   */
  public async getTestCasesByProject(projectId: string): Promise<TestCase[]> {
    const db = getDatabase()
    const rows = await db('test_cases').where('project_id', projectId)
    
    return rows.map((row: Record<string, unknown>) => this.mapToTestCase(row))
  }

  /**
   * Get a single test case by ID
   */
  public async getTestCaseById(caseId: string): Promise<TestCase | null> {
    const db = getDatabase()
    const row = await db('test_cases').where('case_id', caseId).first()
    
    if (!row) return null
    return this.mapToTestCase(row)
  }

  /**
   * Validate test case format
   */
  public validateTestCase(testCase: TestCase): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!testCase.caseId) errors.push('caseId is required')
    if (!testCase.title) errors.push('title is required')
    if (!testCase.steps || testCase.steps.length === 0) errors.push('steps are required')
    if (!testCase.expectedResult) errors.push('expectedResult is required')
    if (!['P0', 'P1', 'P2', 'P3'].includes(testCase.priority)) {
      errors.push('priority must be one of: P0, P1, P2, P3')
    }
    
    // Validate steps
    testCase.steps?.forEach((step, index) => {
      if (!step.action) errors.push(`Step ${index + 1}: action is required`)
      if (!step.expected) errors.push(`Step ${index + 1}: expected result is required`)
    })
    
    return { valid: errors.length === 0, errors }
  }

  /**
   * Delete test cases by project ID
   */
  public async deleteTestCasesByProject(projectId: string): Promise<number> {
    const db = getDatabase()
    return await db('test_cases').where('project_id', projectId).del()
  }

  /**
   * Convert an exploration path to a test case
   */
  private pathToTestCase(path: ExplorationPath, projectId: string, priority: string): TestCase {
    const steps: TestStep[] = path.steps.map((step, index) => ({
      step: index + 1,
      action: this.formatAction(step),
      expected: this.formatExpected(step),
      screenshot: step.element ? `screenshot_${step.element}.png` : undefined
    }))

    return {
      caseId: `TC-${path.pathId}`,
      title: `Test: ${path.startActivity} to ${path.endActivity}`,
      priority: priority as 'P0' | 'P1' | 'P2' | 'P3',
      preconditions: `App should be on ${path.startActivity}`,
      steps,
      expectedResult: `User successfully navigates to ${path.endActivity}`,
      postconditions: `App should be on ${path.endActivity}`,
      tags: ['auto-generated', 'exploration', ...path.coverage]
    }
  }

  /**
   * Format action description
   */
  private formatAction(step: { action: string; element?: string; x?: number; y?: number; text?: string }): string {
    switch (step.action) {
      case 'click':
        return `Click on ${step.element || 'element'}`
      case 'input':
        return `Input "${step.text || ''}" into ${step.element || 'input field'}`
      case 'scroll':
        return `Scroll on ${step.element || 'screen'}`
      case 'swipe':
        return `Swipe on ${step.element || 'screen'}`
      case 'back':
        return 'Press back button'
      case 'rotate':
        return 'Rotate device'
      default:
        return `${step.action} on ${step.element || 'element'}`
    }
  }

  /**
   * Format expected result
   */
  private formatExpected(step: { action: string; element?: string }): string {
    switch (step.action) {
      case 'click':
        return `${step.element || 'Element'} is clickable and responds`
      case 'input':
        return 'Text is entered successfully'
      case 'scroll':
        return 'Content scrolls smoothly'
      case 'swipe':
        return 'Swipe gesture is recognized'
      case 'back':
        return 'Navigates to previous screen'
      case 'rotate':
        return 'Screen orientation changes'
      default:
        return 'Action completes successfully'
    }
  }

  private mapToTestCase(row: Record<string, unknown>): TestCase {
    return {
      caseId: String(row.case_id),
      title: String(row.title),
      priority: String(row.priority) as 'P0' | 'P1' | 'P2' | 'P3',
      preconditions: row.preconditions ? String(row.preconditions) : '',
      steps: JSON.parse(String(row.steps)),
      expectedResult: String(row.expected_result),
      postconditions: row.postconditions ? String(row.postconditions) : '',
      tags: row.tags ? JSON.parse(String(row.tags)) : []
    }
  }
}

export const testCaseService = new TestCaseService()
