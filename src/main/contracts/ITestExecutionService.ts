/**
 * Interface contract for Test Execution Service.
 * Defines the complete API for executing test cases and managing test runs.
 */

export type TestExecutionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error'

export interface TestExecution {
  id: string
  runId: string
  testCaseId: string
  status: TestExecutionStatus
  startedAt?: Date
  completedAt?: Date
  duration?: number
  output?: string
  errorMessage?: string
  screenshotPath?: string
}

export interface TestRun {
  id: string
  projectId: string
  name: string
  status: TestExecutionStatus
  startedAt?: Date
  completedAt?: Date
  executions: TestExecution[]
}

export interface TestRunSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  error: number
  duration: number
}

export interface ExecuteTestRequest {
  runId: string
  testCaseId: string
  timeout?: number
}

export interface TestExecutionServiceError extends Error {
  code: string
  details?: Record<string, unknown>
}

export interface ITestExecutionService {
  /**
   * Create a new test run for a project.
   * @param projectId - The project to run tests against.
   * @param name - The test run name.
   * @param testCaseIds - Array of test case ids to execute.
   * @returns The created TestRun.
   * @throws TestExecutionServiceError if creation fails.
   */
  createTestRun(projectId: string, name: string, testCaseIds: string[]): Promise<TestRun>

  /**
   * Execute a single test case within a run.
   * @param request - Execution request parameters.
   * @returns The TestExecution result.
   * @throws TestExecutionServiceError if execution fails.
   */
  executeTest(request: ExecuteTestRequest): Promise<TestExecution>

  /**
   * Get a test run by id.
   * @param runId - The test run id.
   * @returns The TestRun or null if not found.
   * @throws TestExecutionServiceError if retrieval fails.
   */
  getTestRun(runId: string): Promise<TestRun | null>

  /**
   * Get the execution status of a specific test.
   * @param executionId - The test execution id.
   * @returns The TestExecution or null if not found.
   * @throws TestExecutionServiceError if retrieval fails.
   */
  getTestExecution(executionId: string): Promise<TestExecution | null>

  /**
   * Cancel an in-progress test run.
   * @param runId - The test run id to cancel.
   * @returns True if cancelled, false if not found or already completed.
   * @throws TestExecutionServiceError if cancellation fails.
   */
  cancelTestRun(runId: string): Promise<boolean>

  /**
   * Get a summary of a completed test run.
   * @param runId - The test run id.
   * @returns The TestRunSummary or null if not found.
   * @throws TestExecutionServiceError if retrieval fails.
   */
  getTestRunSummary(runId: string): Promise<TestRunSummary | null>
}
