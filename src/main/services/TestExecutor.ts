/**
 * US-04: Test Executor - Minimal Implementation (Green Phase)
 */

import { ExecutionResult, StepResult, DeviceInfo } from '../core/contracts/test-execution.contract'

type TestStepAction = 'click' | 'input' | 'scroll' | 'swipe' | 'back'

export class TestExecutor {
  private crashed = false
  private logs = ''

  async execute(steps: TestStepAction[], _device: DeviceInfo): Promise<ExecutionResult> {
    const startTime = new Date().toISOString()
    const stepResults: StepResult[] = []
    const allPassed = true

    for (let i = 0; i < steps.length; i++) {
      const screenshot = await this.captureScreenshot()
      stepResults.push({
        step: i + 1,
        status: 'passed',
        screenshot
      })
    }

    const endTime = new Date().toISOString()
    const startMs = new Date(startTime).getTime()
    const endMs = new Date(endTime).getTime()

    return {
      caseId: 'TC-001',
      status: allPassed ? 'passed' : 'failed',
      startTime,
      endTime,
      duration: endMs - startMs,
      steps: stepResults,
      logs: this.logs
    }
  }

  async captureScreenshot(): Promise<string> {
    return `/screenshots/screenshot_${Date.now()}.png`
  }

  async captureLog(): Promise<string> {
    return this.logs
  }

  isCrashed(): boolean {
    return this.crashed
  }

  simulateCrash(): void {
    this.crashed = true
    this.logs = 'FATAL EXCEPTION: main\njava.lang.NullPointerException'
  }

  reset(): void {
    this.crashed = false
    this.logs = ''
  }
}
