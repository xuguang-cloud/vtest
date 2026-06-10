/**
 * US-04: Test Executor — executes test case steps via ADB, captures screenshots, asserts results.
 */
import { ExecutionResult, StepResult, DeviceInfo } from '../core/contracts/test-execution.contract'
import { Logger } from '../core/logger/Logger'

const logger = Logger.getLogger('executor')

export type TestStepAction = 'click' | 'input' | 'scroll' | 'swipe' | 'back' | 'wait' | 'assert'
export type StepStatus = 'passed' | 'failed' | 'blocked' | 'error'

export interface TestStep {
  action: TestStepAction
  target?: string   // element resourceId or text
  value?: string    // input text / wait ms / scroll direction
  expected?: string // expected UI state after step
}

export interface IADBAdapter {
  tap(resourceId: string): Promise<void>
  inputText(text: string): Promise<void>
  scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void>
  swipe(x1: number, y1: number, x2: number, y2: number): Promise<void>
  pressBack(): Promise<void>
  screenshot(): Promise<string>  // returns file path
  getLogcat(): Promise<string>
  dumpUI(): Promise<string>      // returns XML
}

export class TestExecutor {
  private adb: IADBAdapter

  constructor(adb: IADBAdapter) {
    this.adb = adb
  }

  async execute(steps: TestStep[], device: DeviceInfo): Promise<ExecutionResult> {
    const startTime = new Date()
    const stepResults: StepResult[] = []
    let blocked = false

    for (let i = 0; i < steps.length; i++) {
      if (blocked) {
        stepResults.push({ step: i + 1, status: 'blocked', screenshot: '' })
        continue
      }

      try {
        const result = await this.executeStep(steps[i], i + 1)
        stepResults.push(result)

        if (result.status === 'blocked') {
          blocked = true
        }
      } catch (err: any) {
        logger.error(`Step ${i + 1} error`, { error: err.message })
        stepResults.push({
          step: i + 1,
          status: 'error',
          screenshot: '',
          error: err.message
        })
      }
    }

    const endTime = new Date()
    const passed = stepResults.filter(r => r.status === 'passed').length
    const failed = stepResults.filter(r => r.status === 'failed').length
    const blockedCount = stepResults.filter(r => r.status === 'blocked').length
    const errorCount = stepResults.filter(r => r.status === 'error').length

    let overallStatus: StepStatus = 'passed'
    if (errorCount > 0) overallStatus = 'error'
    else if (blockedCount > 0) overallStatus = 'blocked'
    else if (failed > 0) overallStatus = 'failed'

    const logs = await this.adb.getLogcat().catch(() => '')

    return {
      caseId: '',
      status: overallStatus,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - startTime.getTime(),
      steps: stepResults,
      logs
    }
  }

  private async executeStep(step: TestStep, index: number): Promise<StepResult> {
    try {
      if (step.action === 'assert') {
        return await this.assertStep(step, index)
      }
      const screenshotBefore = await this.adb.screenshot()
      await this.performAction(step)
      const screenshotAfter = await this.adb.screenshot()
      return { step: index, status: 'passed', screenshot: screenshotAfter }
    } catch (err: any) {
      return { step: index, status: 'error', screenshot: '', error: err.message }
    }
  }

  private async performAction(step: TestStep): Promise<void> {
    switch (step.action) {
      case 'click':
        if (!step.target) throw new Error('Click requires target')
        await this.adb.tap(step.target)
        break
      case 'input':
        if (!step.value) throw new Error('Input requires value')
        await this.adb.inputText(step.value)
        break
      case 'scroll':
        await this.adb.scroll((step.value as any) || 'down')
        break
      case 'swipe':
        await this.adb.swipe(100, 500, 100, 200)
        break
      case 'back':
        await this.adb.pressBack()
        break
      case 'wait':
        await new Promise(r => setTimeout(r, parseInt(step.value || '500')))
        break

      default:
        throw new Error(`Unknown action: ${step.action}`)
    }
  }

  private async assertStep(step: TestStep, index: number): Promise<StepResult> {
    const uiXML = await this.adb.dumpUI().catch(() => '')

    if (step.expected && !uiXML.includes(step.expected)) {
      return {
        step: index,
        status: 'failed',
        screenshot: '',
        error: `Expected UI to contain "${step.expected}"`
      }
    }

    return {
      step: index,
      status: 'passed',
      screenshot: ''
    }
  }
}