export interface TestCase {
  caseId: string
  title: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  preconditions: string
  steps: TestStep[]
  expectedResult: string
  postconditions: string
  tags: string[]
}

export interface TestStep {
  step: number
  action: string
  expected: string
  screenshot?: string
}

export interface ExecutionResult {
  caseId: string
  status: 'passed' | 'failed' | 'blocked'
  startTime: string
  endTime: string
  duration: number
  steps: StepResult[]
  logs?: string
}

export interface StepResult {
  step: number
  status: 'passed' | 'failed' | 'blocked'
  screenshot?: string
}

export interface ExecutionReport {
  executionId: string
  startTime: string
  endTime: string
  device: DeviceInfo
  summary: ExecutionSummary
  results: ExecutionResult[]
}

export interface ExecutionSummary {
  total: number
  passed: number
  failed: number
  blocked: number
  passRate: number
}

export interface DeviceInfo {
  model: string
  androidVersion: string
  apiLevel: number
}