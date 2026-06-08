import { TestExecutionService } from '../TestExecutionService'
import { getDatabase } from '../../core/database/connection'
import { TestCase } from '../../core/contracts/test-execution.contract'

jest.mock('../../core/database/connection')
jest.mock('../../core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}))

const mockGetDatabase = getDatabase as jest.Mock

describe('TestExecutionService (US-04: 测试执行与结果收集)', () => {
  let service: TestExecutionService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TestExecutionService()
  })

  const mockTestCases: TestCase[] = [
    {
      caseId: 'TC-001',
      title: 'Login Test',
      priority: 'P1',
      preconditions: 'App on login screen',
      steps: [
        { step: 1, action: 'Enter username', expected: 'Username entered' },
        { step: 2, action: 'Enter password', expected: 'Password entered' },
        { step: 3, action: 'Click login', expected: 'Home screen shown' }
      ],
      expectedResult: 'User logged in',
      postconditions: 'Home screen displayed',
      tags: ['login']
    },
    {
      caseId: 'TC-002',
      title: 'Settings Test',
      priority: 'P2',
      preconditions: 'App on home screen',
      steps: [
        { step: 1, action: 'Click settings', expected: 'Settings shown' }
      ],
      expectedResult: 'Settings displayed',
      postconditions: 'Settings screen',
      tags: ['settings']
    }
  ]

  describe('createRun', () => {
    it('should create a new test run', async () => {
      const run = await service.createRun('project-1')

      expect(run).toBeDefined()
      expect(run.id).toBeDefined()
      expect(run.projectId).toBe('project-1')
      expect(run.status).toBe('pending')
      expect(run.results).toHaveLength(0)
    })
  })

  describe('executeRun', () => {
    it('should execute test cases and return report', async () => {
      const mockInsert = jest.fn().mockReturnThis()
      const mockDb = jest.fn().mockReturnValue({ insert: mockInsert })
      mockGetDatabase.mockReturnValue(mockDb)

      const request = {
        projectId: 'project-1',
        testCases: mockTestCases,
        deviceInfo: {
          model: 'Pixel 4',
          androidVersion: '12',
          apiLevel: 31
        }
      }

      const report = await service.executeRun(request)

      expect(report).toBeDefined()
      expect(report.executionId).toBeDefined()
      expect(report.startTime).toBeDefined()
      expect(report.endTime).toBeDefined()
      expect(report.device.model).toBe('Pixel 4')
      expect(report.summary.total).toBe(2)
      expect(report.results).toHaveLength(2)
    })

    it('should calculate summary correctly', async () => {
      const mockInsert = jest.fn().mockReturnThis()
      const mockDb = jest.fn().mockReturnValue({ insert: mockInsert })
      mockGetDatabase.mockReturnValue(mockDb)

      const request = {
        projectId: 'project-1',
        testCases: mockTestCases,
        deviceInfo: {
          model: 'Pixel 4',
          androidVersion: '12',
          apiLevel: 31
        }
      }

      const report = await service.executeRun(request)

      expect(report.summary.total).toBe(2)
      expect(report.summary.passed).toBe(2)
      expect(report.summary.passRate).toBe(100)
    })

    it('should emit events during execution', async () => {
      const mockInsert = jest.fn().mockReturnThis()
      const mockDb = jest.fn().mockReturnValue({ insert: mockInsert })
      mockGetDatabase.mockReturnValue(mockDb)

      const startedListener = jest.fn()
      const completedListener = jest.fn()
      
      service.on('test:run-started', startedListener)
      service.on('test:run-completed', completedListener)

      await service.executeRun({
        projectId: 'project-1',
        testCases: mockTestCases,
        deviceInfo: {
          model: 'Pixel 4',
          androidVersion: '12',
          apiLevel: 31
        }
      })

      expect(startedListener).toHaveBeenCalled()
      expect(completedListener).toHaveBeenCalled()
    })
  })

  describe('executeTestCase', () => {
    it('should execute a single test case', async () => {
      const result = await service.executeTestCase(mockTestCases[0], {
        projectId: 'project-1',
        testCases: mockTestCases,
        deviceInfo: {
          model: 'Pixel 4',
          androidVersion: '12',
          apiLevel: 31
        }
      })

      expect(result).toBeDefined()
      expect(result.caseId).toBe('TC-001')
      expect(result.status).toBe('passed')
      expect(result.steps).toHaveLength(3)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getRun', () => {
    it('should return run by ID', async () => {
      const run = await service.createRun('project-1')
      const found = service.getRun(run.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(run.id)
    })

    it('should return null for non-existent run', () => {
      const found = service.getRun('non-existent')
      expect(found).toBeNull()
    })
  })

  describe('getRunsByProject', () => {
    it('should return all runs for a project', async () => {
      await service.createRun('project-1')
      await service.createRun('project-1')
      await service.createRun('project-2')

      const runs = service.getRunsByProject('project-1')
      expect(runs).toHaveLength(2)
    })
  })

  describe('compareScreenshots', () => {
    it('should compare screenshots and return result', async () => {
      const result = await service.compareScreenshots('/path/expected.png', '/path/actual.png')

      expect(result.match).toBe(true)
      expect(result.diff).toBe(0)
    })
  })
})
