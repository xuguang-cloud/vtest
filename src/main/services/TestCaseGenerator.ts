/**
 * US-03: Test Case Generator - Minimal Implementation (Green Phase)
 */

import { TestCase, TestStep } from '../core/contracts/test-execution.contract'
import { ExplorationPath, ExplorationStep } from '../core/contracts/exploration.contract'

export class TestCaseGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TestCaseGenerationError'
  }
}

export class TestCaseGenerator {
  private totalGenerated = 0
  private successfulGenerated = 0

  generateFromPath(path: ExplorationPath): TestCase {
    const caseId = `TC-${String(this.totalGenerated + 1).padStart(3, '0')}`
    this.totalGenerated++

    const steps: TestStep[] = path.steps.map((step: ExplorationStep, index: number) => ({
      step: index + 1,
      action: this.formatAction(step),
      expected: this.formatExpected(step),
    }))

    const testCase: TestCase = {
      caseId,
      title: `Test: ${path.startActivity} -> ${path.endActivity}`,
      priority: 'P0',
      preconditions: `App is on ${path.startActivity}`,
      steps,
      expectedResult: `Successfully navigate to ${path.endActivity}`,
      postconditions: `User is on ${path.endActivity}`,
      tags: ['auto-generated', 'exploration']
    }

    this.successfulGenerated++
    return testCase
  }

  validateCase(testCase: TestCase): boolean {
    if (!testCase.title || testCase.title.trim() === '') return false
    if (!testCase.steps || testCase.steps.length === 0) return false
    if (!testCase.expectedResult || testCase.expectedResult.trim() === '') return false
    if (!testCase.preconditions || testCase.preconditions.trim() === '') return false

    for (const step of testCase.steps) {
      if (!step.action || step.action.trim() === '') return false
      if (!step.expected || step.expected.trim() === '') return false
    }

    return true
  }

  getSuccessRate(): number {
    if (this.totalGenerated === 0) return 100
    return (this.successfulGenerated / this.totalGenerated) * 100
  }

  private formatAction(step: ExplorationStep): string {
    switch (step.action) {
      case 'click':
        return `Click on ${step.element || 'element'}`
      case 'input':
        return `Input text into ${step.element || 'field'}`
      case 'scroll':
        return `Scroll ${step.direction || 'down'}`
      case 'swipe':
        return `Swipe ${step.direction || 'left'}`
      case 'back':
        return 'Press back button'
      case 'rotate':
        return 'Rotate device'
      default:
        return 'Perform action'
    }
  }

  private formatExpected(step: ExplorationStep): string {
    switch (step.action) {
      case 'click':
        return `${step.element || 'Element'} is clicked`
      case 'input':
        return 'Text is entered'
      case 'scroll':
        return `Content scrolls ${step.direction || 'down'}`
      case 'swipe':
        return 'Screen is swiped'
      case 'back':
        return 'Previous screen is shown'
      case 'rotate':
        return 'Screen orientation changes'
      default:
        return 'Action is performed'
    }
  }
}
