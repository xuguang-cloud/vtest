import { TestCaseService } from '../TestCaseService'
import { getDatabase } from '../../core/database/connection'
import { ExplorationPath } from '../../core/contracts/exploration.contract'

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

describe('TestCaseService (US-03: 测试用例生成)', () => {
  let service: TestCaseService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TestCaseService()
  })

  const mockExplorationPaths: ExplorationPath[] = [
    {
      pathId: 'path-1',
      startActivity: 'MainActivity',
      endActivity: 'SettingsActivity',
      steps: [
        { action: 'click', element: 'menu_button', x: 100, y: 200 },
        { action: 'click', element: 'settings_item', x: 150, y: 250 }
      ],
      coverage: ['main_screen', 'settings_screen'],
      reproducible: true
    },
    {
      pathId: 'path-2',
      startActivity: 'LoginActivity',
      endActivity: 'HomeActivity',
      steps: [
        { action: 'input', element: 'username_field', text: 'testuser' },
        { action: 'input', element: 'password_field', text: 'testpass' },
        { action: 'click', element: 'login_button' }
      ],
      coverage: ['login_screen', 'home_screen'],
      reproducible: true
    }
  ]

  describe('generateTestCases', () => {
    it('should convert exploration paths to test cases', async () => {
      const mockInsert = jest.fn().mockReturnThis()
      const mockDb = jest.fn().mockReturnValue({ insert: mockInsert })
      mockGetDatabase.mockReturnValue(mockDb)

      const testCases = await service.generateTestCases({
        projectId: 'project-1',
        paths: mockExplorationPaths,
        priority: 'P1'
      })

      expect(testCases).toHaveLength(2)
      expect(testCases[0].caseId).toBe('TC-path-1')
      expect(testCases[0].title).toBe('Test: MainActivity to SettingsActivity')
      expect(testCases[0].priority).toBe('P1')
      expect(testCases[0].steps).toHaveLength(2)
    })

    it('should store test cases in database', async () => {
      const mockInsert = jest.fn().mockReturnThis()
      const mockDb = jest.fn().mockReturnValue({ insert: mockInsert })
      mockGetDatabase.mockReturnValue(mockDb)

      await service.generateTestCases({
        projectId: 'project-1',
        paths: mockExplorationPaths
      })

      expect(mockDb).toHaveBeenCalledWith('test_cases')
      expect(mockInsert).toHaveBeenCalledTimes(2)
    })

    it('should use default priority P1 when not specified', async () => {
      const mockInsert = jest.fn().mockReturnThis()
      const mockDb = jest.fn().mockReturnValue({ insert: mockInsert })
      mockGetDatabase.mockReturnValue(mockDb)

      const testCases = await service.generateTestCases({
        projectId: 'project-1',
        paths: mockExplorationPaths
      })

      expect(testCases[0].priority).toBe('P1')
    })
  })

  describe('validateTestCase', () => {
    it('should validate a complete test case', () => {
      const testCase = {
        caseId: 'TC-001',
        title: 'Test Login',
        priority: 'P1' as const,
        preconditions: 'App is on login screen',
        steps: [
          { step: 1, action: 'Enter username', expected: 'Username is entered' }
        ],
        expectedResult: 'User is logged in',
        postconditions: 'App shows home screen',
        tags: ['login']
      }

      const result = service.validateTestCase(testCase)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should report errors for missing fields', () => {
      const testCase = {
        caseId: '',
        title: '',
        priority: 'P1' as const,
        preconditions: '',
        steps: [],
        expectedResult: '',
        postconditions: '',
        tags: []
      }

      const result = service.validateTestCase(testCase)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should validate priority values', () => {
      const testCase = {
        caseId: 'TC-001',
        title: 'Test',
        priority: 'P5' as any,
        preconditions: '',
        steps: [{ step: 1, action: 'click', expected: 'done' }],
        expectedResult: 'result',
        postconditions: '',
        tags: []
      }

      const result = service.validateTestCase(testCase)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('priority must be one of: P0, P1, P2, P3')
    })
  })

  describe('getTestCasesByProject', () => {
    it('should return test cases for a project', async () => {
      const mockRows = [
        {
          case_id: 'TC-001',
          title: 'Test Login',
          priority: 'P1',
          preconditions: 'Login screen',
          steps: '[{"step":1,"action":"Click login","expected":"Logged in"}]',
          expected_result: 'User logged in',
          postconditions: 'Home screen',
          tags: '[]'
        }
      ]
      
      const mockWhere = jest.fn().mockReturnValue(mockRows)
      const mockDb = jest.fn().mockReturnValue({ where: mockWhere })
      mockGetDatabase.mockReturnValue(mockDb)

      const testCases = await service.getTestCasesByProject('project-1')

      expect(testCases).toHaveLength(1)
      expect(testCases[0].caseId).toBe('TC-001')
    })
  })

  describe('getTestCaseById', () => {
    it('should return a test case by ID', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        case_id: 'TC-001',
        title: 'Test Login',
        priority: 'P1',
        preconditions: 'Login screen',
        steps: '[{"step":1,"action":"Click","expected":"Done"}]',
        expected_result: 'Logged in',
        postconditions: 'Home',
        tags: '[]'
      })
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst })
      const mockDb = jest.fn().mockReturnValue({ where: mockWhere })
      mockGetDatabase.mockReturnValue(mockDb)

      const testCase = await service.getTestCaseById('TC-001')

      expect(testCase).not.toBeNull()
      expect(testCase?.caseId).toBe('TC-001')
    })

    it('should return null when test case not found', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null)
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst })
      const mockDb = jest.fn().mockReturnValue({ where: mockWhere })
      mockGetDatabase.mockReturnValue(mockDb)

      const testCase = await service.getTestCaseById('non-existent')

      expect(testCase).toBeNull()
    })
  })
})
