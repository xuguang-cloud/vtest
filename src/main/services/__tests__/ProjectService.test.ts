import { ProjectService } from '../ProjectService'
import { getDatabase } from '../../core/database/connection'
import { v4 as uuidv4 } from 'uuid'

jest.mock('../../core/database/connection')
jest.mock('../../core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}))
jest.mock('uuid')

const mockGetDatabase = getDatabase as jest.Mock
const mockUuidv4 = uuidv4 as jest.Mock

describe('ProjectService', () => {
  let service: ProjectService
  const mockUuid = 'test-uuid-123'
  const mockDate = new Date('2024-01-01T00:00:00.000Z')

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(mockDate)
    mockUuidv4.mockReturnValue(mockUuid)
    service = new ProjectService()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const createMockRow = (overrides: Record<string, unknown> = {}) => ({
    id: '1',
    uuid: mockUuid,
    name: 'Test Project',
    description: null,
    apk_path: null,
    prd_path: null,
    design_path: null,
    status: 'active',
    created_at: mockDate.toISOString(),
    updated_at: mockDate.toISOString(),
    ...overrides
  })

  // Create a proper knex-like function that returns a query builder
  const createKnexQb = (returnValue: unknown) => {
    const qb: any = {
      insert: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(returnValue),
      returning: jest.fn().mockResolvedValue([returnValue]),
      del: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockReturnThis()
    }
    // The knex function returns the qb when called with table name
    const knex = jest.fn().mockReturnValue(qb)
    // Also add methods directly for chaining
    return Object.assign(knex, qb)
  }

  describe('createProject', () => {
    it('should create a project with all fields', async () => {
      const row = createMockRow({
        description: 'A test project',
        apk_path: '/path/to.apk',
        prd_path: '/path/to.prd',
        design_path: '/path/to.design'
      })
      const knex = createKnexQb(row)
      knex.returning.mockResolvedValue([row])
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.createProject({
        name: 'Test Project',
        description: 'A test project',
        apkPath: '/path/to.apk',
        prdPath: '/path/to.prd',
        designPath: '/path/to.design'
      })

      expect(result.uuid).toBe(mockUuid)
      expect(result.name).toBe('Test Project')
      expect(result.status).toBe('active')
      expect(mockUuidv4).toHaveBeenCalled()
    })

    it('should create a project with minimal fields', async () => {
      const row = createMockRow()
      const knex = createKnexQb(row)
      knex.returning.mockResolvedValue([row])
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.createProject({ name: 'Minimal Project' })
      expect(result.name).toBe('Test Project')
    })

    it('should throw when database insert fails', async () => {
      const knex = createKnexQb(null)
      knex.returning.mockRejectedValue(new Error('DB insert failed'))
      mockGetDatabase.mockReturnValue(knex)

      await expect(service.createProject({ name: 'Fail' })).rejects.toThrow('DB insert failed')
    })
  })

  describe('getProjectById', () => {
    it('should return a project by ID', async () => {
      const knex = createKnexQb(createMockRow())
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.getProjectById('1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('1')
      expect(knex.where).toHaveBeenCalledWith('id', '1')
    })

    it('should return null when project not found', async () => {
      const knex = createKnexQb(null)
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.getProjectById('999')
      expect(result).toBeNull()
    })
  })

  describe('getProjectByUuid', () => {
    it('should return a project by UUID', async () => {
      const knex = createKnexQb(createMockRow())
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.getProjectByUuid(mockUuid)
      expect(result).not.toBeNull()
      expect(result?.uuid).toBe(mockUuid)
    })

    it('should return null when project not found by UUID', async () => {
      const knex = createKnexQb(null)
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.getProjectByUuid('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('getAllProjects', () => {
    it('should return all projects ordered by created_at desc', async () => {
      const mockRows = [createMockRow({ id: '1', name: 'P1' }), createMockRow({ id: '2', name: 'P2' })]
      const qb = { orderBy: jest.fn().mockResolvedValue(mockRows) }
      mockGetDatabase.mockReturnValue(() => qb)

      const result = await service.getAllProjects()
      expect(result).toHaveLength(2)
      expect(qb.orderBy).toHaveBeenCalledWith('created_at', 'desc')
    })

    it('should return empty array when no projects exist', async () => {
      const qb = { orderBy: jest.fn().mockResolvedValue([]) }
      mockGetDatabase.mockReturnValue(() => qb)

      const result = await service.getAllProjects()
      expect(result).toEqual([])
    })
  })

  describe('updateProject', () => {
    it('should update project fields', async () => {
      const row = createMockRow({ name: 'Updated', description: 'Updated desc' })
      const knex = createKnexQb(row)
      knex.returning.mockResolvedValue([row])
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.updateProject('1', { name: 'Updated', description: 'Updated desc' })
      expect(result).not.toBeNull()
      expect(result?.name).toBe('Updated')
    })

    it('should return null when project not found', async () => {
      const knex = createKnexQb(null)
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.updateProject('999', { name: 'New Name' })
      expect(result).toBeNull()
    })
  })

  describe('deleteProject', () => {
    it('should delete a project and return true', async () => {
      const qb = { where: jest.fn().mockReturnThis(), del: jest.fn().mockResolvedValue(1) }
      const knex = jest.fn().mockReturnValue(qb)
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.deleteProject('1')
      expect(result).toBe(true)
    })

    it('should return false when no project was deleted', async () => {
      const qb = { where: jest.fn().mockReturnThis(), del: jest.fn().mockResolvedValue(0) }
      const knex = jest.fn().mockReturnValue(qb)
      mockGetDatabase.mockReturnValue(knex)

      const result = await service.deleteProject('999')
      expect(result).toBe(false)
    })
  })
})
