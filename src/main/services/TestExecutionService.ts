import { EventEmitter } from 'events'
import { getDatabase } from '../core/database/connection'
import { Logger } from '../core/logger/Logger'
import { TestCase, TestStep, StepResult, ExecutionResult, ExecutionReport, ExecutionSummary } from '../core/contracts/test-execution.contract'
import { v4 as uuidv4 } from 'uuid'

const logger = Logger.getLogger('test-execution')

export { TestCase, TestStep, StepResult, ExecutionResult, ExecutionReport, ExecutionSummary }

export interface RunTestRequest {
  projectId: string
  testCases: TestCase[]
  deviceInfo: {
    model: string
    androidVersion: string
    apiLevel: number
  }
}

export interface TestRun {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'completed'
  startedAt: Date
  completedAt?: Date
  results: ExecutionResult[]
}

export class TestExecutionService extends EventEmitter {
  private runs: Map<string, TestRun> = new Map()

  /**
   * Create a new test run
   */
  public async createRun(projectId: string): Promise<TestRun> {
    const runId = uuidv4()
    const run: TestRun = {
      id: runId,
      projectId,
      status: 'pending',
      startedAt: new Date(),
      results: []
    }
    
    this.runs.set(runId, run)
    logger.info(`Test run created: ${runId} for project ${projectId}`)
    return run
  }

  /**
   * Execute a test run
   */
  public async executeRun(request: RunTestRequest): Promise<ExecutionReport> {
    const run = await this.createRun(request.projectId)
    run.status = 'running'
    
    this.emit('test:run-started', run)
    
    const results: ExecutionResult[] = []
    
    for (const testCase of request.testCases) {
      const result = await this.executeTestCase(testCase, request)
      results.push(result)
      
      // Store result in database
      const db = getDatabase()
      await db('execution_results').insert({
        test_run_id: run.id,
        case_id: testCase.caseId,
        status: result.status,
        duration: result.duration,
        step_results: JSON.stringify(result.steps),
        logs_path: result.logs || null
      })
      
      this.emit('test:case-completed', { runId: run.id, result })
    }
    
    run.results = results
    run.status = 'completed'
    run.completedAt = new Date()
    
    const summary = this.calculateSummary(results)
    
    const report: ExecutionReport = {
      executionId: run.id,
      startTime: run.startedAt.toISOString(),
      endTime: run.completedAt.toISOString(),
      device: request.deviceInfo,
      summary,
      results
    }
    
    logger.info(`Test run completed: ${run.id}, ${summary.passed}/${summary.total} passed`)
    this.emit('test:run-completed', { runId: run.id, report })
    
    return report
  }

  /**
   * Execute a single test case
   */
  public async executeTestCase(testCase: TestCase, request: RunTestRequest): Promise<ExecutionResult> {
    const startTime = new Date()
    const stepResults: StepResult[] = []
    let allStepsPassed = true
    
    for (const step of testCase.steps) {
      // Simulate step execution
      const stepResult = await this.executeStep(step, request)
      stepResults.push(stepResult)
      
      if (stepResult.status !== 'passed') {
        allStepsPassed = false
      }
    }
    
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()
    
    return {
      caseId: testCase.caseId,
      status: allStepsPassed ? 'passed' : 'failed',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      steps: stepResults,
      logs: this.generateLogs(testCase, stepResults)
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: TestStep, request: RunTestRequest): Promise<StepResult> {
    // Simulate step execution with a small delay
    await this.delay(50)
    
    // For testing purposes, all steps pass
    // In real implementation, this would interact with the device
    return {
      step: step.step,
      status: 'passed',
      screenshot: `screenshot_${request.projectId}_${step.step}.png`
    }
  }

  /**
   * Generate logs for a test case
   */
  private generateLogs(testCase: TestCase, stepResults: StepResult[]): string {
    const lines: string[] = [
      `Test Case: ${testCase.title}`,
      `Case ID: ${testCase.caseId}`,
      `Started: ${new Date().toISOString()}`,
      '---',
      ...stepResults.map(sr => `Step ${sr.step}: ${sr.status}`),
      '---',
      `Overall: ${stepResults.every(s => s.status === 'passed') ? 'PASSED' : 'FAILED'}`
    ]
    return lines.join('\n')
  }

  /**
   * Calculate execution summary
   */
  private calculateSummary(results: ExecutionResult[]): ExecutionSummary {
    const passed = results.filter(r => r.status === 'passed').length
    const failed = results.filter(r => r.status === 'failed').length
    const blocked = results.filter(r => r.status === 'blocked').length
    
    return {
      total: results.length,
      passed,
      failed,
      blocked,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0
    }
  }

  /**
   * Get test run by ID
   */
  public getRun(runId: string): TestRun | null {
    return this.runs.get(runId) || null
  }

  /**
   * Get all runs for a project
   */
  public getRunsByProject(projectId: string): TestRun[] {
    return Array.from(this.runs.values()).filter(r => r.projectId === projectId)
  }

  /**
   * Generate screenshot comparison
   */
  public async compareScreenshots(expectedPath: string, actualPath: string): Promise<{ match: boolean; diff: number }> {
    // Mock implementation for testing
    return { match: true, diff: 0 }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const testExecutionService = new TestExecutionService()
