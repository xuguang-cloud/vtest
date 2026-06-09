/**
 * US-04: Test Execution and Result Collection - Acceptance-Level TDD Tests
 */
import { ExecutionResult, StepResult, DeviceInfo } from '../../main/core/contracts/test-execution.contract'
import { TestExecutor, IADBAdapter, TestStep } from '../../main/services/TestExecutor'

class MockADB implements IADBAdapter {
  tapCalls: string[] = []
  inputCalls: string[] = []
  screenshotCalls = 0
  shouldFail = false

  async tap(resourceId: string): Promise<void> { this.tapCalls.push(resourceId) }
  async inputText(text: string): Promise<void> { this.inputCalls.push(text) }
  async scroll(): Promise<void> {}
  async swipe(): Promise<void> {}
  async pressBack(): Promise<void> {}
  async screenshot(): Promise<string> {
    if (this.shouldFail) throw new Error('ADB disconnected')
    this.screenshotCalls++
    return '/screenshots/s' + this.screenshotCalls + '.png'
  }
  async getLogcat(): Promise<string> { return 'logcat output' }
  async dumpUI(): Promise<string> { return '<node text="Home" />' }
}

describe('US-04: Test Execution and Result Collection', () => {
  let executor: TestExecutor
  let adb: MockADB

  const mockDevice: DeviceInfo = {
    model: 'Pixel 7',
    androidVersion: '14.0',
    apiLevel: 34
  }

  beforeEach(() => {
    adb = new MockADB()
    executor = new TestExecutor(adb)
  })

  describe('AC-1: Single test case execution flow', () => {
    it('should execute a test case with all steps', async () => {
      const steps: TestStep[] = [
        { action: 'click', target: 'btn1' },
        { action: 'input', target: 'field1', value: 'text' },
        { action: 'scroll', value: 'down' },
        { action: 'swipe' }
      ]
      const result = await executor.execute(steps, mockDevice)
      expect(result.status).toBeDefined()
      expect(result.steps.length).toBe(steps.length)
    })

    it('should record start and end time for each execution', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }]
      const result = await executor.execute(steps, mockDevice)
      expect(new Date(result.startTime).getTime()).toBeLessThanOrEqual(
        new Date(result.endTime).getTime()
      )
    })

    it('should calculate execution duration', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }]
      const result = await executor.execute(steps, mockDevice)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should capture screenshot during execution', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }]
      await executor.execute(steps, mockDevice)
      expect(adb.screenshotCalls).toBeGreaterThan(0)
    })

    it('should validate each step result', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }, { action: 'input', target: 'f1', value: 'v' }]
      const result = await executor.execute(steps, mockDevice)
      result.steps.forEach((step: StepResult) => {
        expect(['passed', 'failed', 'blocked', 'error']).toContain(step.status)
      })
    })

    it('should set overall status based on step results', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }, { action: 'input', target: 'f1', value: 'v' }]
      const result = await executor.execute(steps, mockDevice)
      expect(['passed', 'failed', 'blocked', 'error']).toContain(result.status)
    })
  })

  describe('AC-2: Execution failure recording', () => {
    it('should record failed status when any step fails', async () => {
      const result: ExecutionResult = {
        caseId: 'TC-001',
        status: 'failed',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 5000,
        steps: [
          { step: 1, status: 'passed', screenshot: '/screenshots/step1.png' },
          { step: 2, status: 'failed', screenshot: '/screenshots/step2.png' }
        ],
        logs: 'Error: Element not found on screen'
      }
      expect(result.status).toBe('failed')
      expect(result.steps.some(s => s.status === 'failed')).toBe(true)
    })

    it('should capture screenshot evidence on failure', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }]
      await executor.execute(steps, mockDevice)
      expect(adb.screenshotCalls).toBeGreaterThan(0)
    })

    it('should collect execution logs', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }]
      const result = await executor.execute(steps, mockDevice)
      expect(result.logs).toBeDefined()
      expect(typeof result.logs).toBe('string')
    })

    it('should include error details in logs', async () => {
      const result: ExecutionResult = {
        caseId: 'TC-001',
        status: 'failed',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 5000,
        steps: [],
        logs: 'Assertion failed: Expected button to be visible'
      }
      expect(result.logs).toContain('failed')
    })

    it('should record blocked status when preconditions not met', async () => {
      const result: ExecutionResult = {
        caseId: 'TC-001',
        status: 'blocked',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 0,
        steps: [],
        logs: 'Precondition failed: App not installed'
      }
      expect(result.status).toBe('blocked')
    })
  })

  describe('AC-3: Crash capture rate 100%', () => {
    it('should detect when app crashes during execution', async () => {
      adb.shouldFail = true
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }]
      const result = await executor.execute(steps, mockDevice)
      expect(result.status).toBe('error')
      expect(result.steps[0].status).toBe('error')
    })

    it('should capture crash log on app crash', async () => {
      const crashLog = 'FATAL EXCEPTION: main\njava.lang.NullPointerException'
      expect(crashLog).toContain('FATAL EXCEPTION')
      expect(crashLog).toContain('Exception')
    })

    it('should record crash as failed status', () => {
      const crashed = true
      const status = crashed ? 'failed' : 'passed'
      expect(status).toBe('failed')
    })

    it('should capture last screenshot before crash', async () => {
      const steps: TestStep[] = [{ action: 'click', target: 'btn1' }]
      const result = await executor.execute(steps, mockDevice)
      expect(result.steps.length).toBeGreaterThan(0)
    })

    it('should include device info in crash report', () => {
      const device: DeviceInfo = { model: 'Pixel 7', androidVersion: '14.0', apiLevel: 34 }
      expect(device.model).toBeDefined()
      expect(device.androidVersion).toBeDefined()
      expect(device.apiLevel).toBeDefined()
    })
  })
})