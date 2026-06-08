import { TestExecutor, IADBAdapter, TestStep } from '../TestExecutor'

class MockADB implements IADBAdapter {
  tapCalls: string[] = []
  inputCalls: string[] = []
  screenshotCalls = 0
  dumpUICalls = 0
  shouldFailScreenshot = false
  mockUI = '<node text="Home" />'

  async tap(resourceId: string): Promise<void> { this.tapCalls.push(resourceId) }
  async inputText(text: string): Promise<void> { this.inputCalls.push(text) }
  async scroll(): Promise<void> {}
  async swipe(): Promise<void> {}
  async pressBack(): Promise<void> {}
  async screenshot(): Promise<string> {
    if (this.shouldFailScreenshot) throw new Error('ADB disconnected')
    this.screenshotCalls++
    return `/screenshots/s${this.screenshotCalls}.png`
  }
  async getLogcat(): Promise<string> { return 'logcat output' }
  async dumpUI(): Promise<string> { this.dumpUICalls++; return this.mockUI }
}

describe('TestExecutor (US-04)', () => {
  let executor: TestExecutor
  let adb: MockADB

  beforeEach(() => {
    adb = new MockADB()
    executor = new TestExecutor(adb)
  })

  it('should execute click steps via ADB', async () => {
    const steps: TestStep[] = [
      { action: 'click', target: 'btn_login' },
      { action: 'click', target: 'btn_submit' }
    ]
    const result = await executor.execute(steps, { model: 'pixel', androidVersion: '12', apiLevel: 31 })
    expect(result.status).toBe('passed')
    expect(adb.tapCalls).toEqual(['btn_login', 'btn_submit'])
    expect(adb.screenshotCalls).toBe(4) // before + after per step
  })

  it('should execute input steps', async () => {
    const steps: TestStep[] = [{ action: 'input', target: 'edit_username', value: 'testuser' }]
    const result = await executor.execute(steps, { model: 'pixel', androidVersion: '12', apiLevel: 31 })
    expect(result.status).toBe('passed')
    expect(adb.inputCalls).toEqual(['testuser'])
  })

  it('should execute assert step and pass when UI matches', async () => {
    adb.mockUI = '<node text="Home"><node text="Welcome" /></node>'
    const steps: TestStep[] = [{ action: 'assert', expected: 'Welcome' }]
    const result = await executor.execute(steps, { model: 'pixel', androidVersion: '12', apiLevel: 31 })
    expect(result.status).toBe('passed')
    expect(result.steps[0].status).toBe('passed')
  })

  it('should execute assert step and fail when UI mismatches', async () => {
    adb.mockUI = '<node text="Home" />'
    const steps: TestStep[] = [{ action: 'assert', expected: 'LoginScreen' }]
    const result = await executor.execute(steps, { model: 'pixel', androidVersion: '12', apiLevel: 31 })
    expect(result.status).toBe('failed')
    expect(result.steps[0].status).toBe('failed')
  })

  it('should handle errors gracefully', async () => {
    adb.shouldFailScreenshot = true
    const steps: TestStep[] = [{ action: 'click', target: 'btn' }]
    const result = await executor.execute(steps, { model: 'pixel', androidVersion: '12', apiLevel: 31 })
    expect(result.status).toBe('error')
    expect(result.steps[0].status).toBe('error')
  })

  it('should return correct summary counts', async () => {
    const steps: TestStep[] = [
      { action: 'click', target: 'btn_ok' },
      { action: 'click', target: 'btn_cancel' }
    ]
    const result = await executor.execute(steps, { model: 'pixel', androidVersion: '12', apiLevel: 31 })
    expect(result.steps.length).toBe(2)
    expect(result.steps.every(s => s.status === 'passed')).toBe(true)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})