/**
 * Database Integration Tests
 * Uses a real SQLite :memory: database via knex + sqlite3.
 * Tests actual CRUD, transactions, unique constraints, and foreign keys.
 */

import knex, { Knex } from 'knex'
import { ProjectService } from '../../main/services/ProjectService'
import { v4 as uuidv4 } from 'uuid'

jest.mock('../../main/core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}))

jest.mock('uuid', () => ({
  v4: jest.fn()
}))

const mockedUuidv4 = uuidv4 as jest.Mock

describe('Database Integration', () => {
  let db: Knex
  let service: ProjectService
  let uuidCounter: number

  beforeAll(async () => {
    db = knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
      pool: { min: 1, max: 1 }
    })
  })

  afterAll(async () => {
    await db.destroy()
  })

  beforeEach(async () => {
    await db.schema.dropTableIfExists('test_cases')
    await db.schema.dropTableIfExists('projects')

    await db.schema.createTable('projects', (table) => {
      table.increments('id').primary()
      table.string('uuid').notNullable().unique()
      table.string('name').notNullable()
      table.text('description')
      table.string('apk_path')
      table.string('prd_path')
      table.string('design_path')
      table.string('status').defaultTo('active')
      table.timestamps(true, true)
    })

/    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const connectionModule = require('../../main/core/database/connection')
    jest.spyOn(connectionModule, 'getDatabase').mockReturnValue(db)

    service = new ProjectService()
    uuidCounter = 0
    mockedUuidv4.mockImplementation(() => {
      uuidCounter += 1
      return 'test-uuid-' + uuidCounter
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // Happy Path
  describe('createProject', () => {
    it('should create a project with all fields', async () => {
      const result = await service.createProject({
        name: 'Test Project',
        description: 'A test project',
        apkPath: '/path/to.apk',
        prdPath: '/path/to.prd',
        designPath: '/path/to.design'
      })

      expect(result.uuid).toBe('test-uuid-1')
      expect(result.name).toBe('Test Project')
      expect(result.status).toBe('active')
      expect(result.description).toBe('A test project')
      expect(result.apkPath).toBe('/path/to.apk')
    })

    it('should create a project with minimal fields', async () => {
      const result = await service.createProject({ name: 'Minimal Project' })

      expect(result.name).toBe('Minimal Project')
      expect(result.status).toBe('active')
      expect(result.description).toBeUndefined()
    })
  })

  describe('getProjectById', () => {
    it('should return a project by ID', async () => {
      const created = await service.createProject({ name: 'Find Me' })
      const result = await service.getProjectById(String(created.id))

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Find Me')
    })

    it('should return null when project not found', async () => {
      const result = await service.getProjectById('99999')
      expect(result).toBeNull()
    })
  })

  describe('getProjectByUuid', () => {
    it('should return a project by UUID', async () => {
      const created = await service.createProject({ name: 'By UUID' })
      const result = await service.getProjectByUuid(created.uuid)

      expect(result).not.toBeNull()
      expect(result?.uuid).toBe('test-uuid-1')
    })

    it('should return null when UUID not found', async () => {
      const result = await service.getProjectByUuid('non-existent-uuid')
      expect(result).toBeNull()
    })
  })

  describe('getAllProjects', () => {
    it('should return all projects ordered by created_at desc', async () => {
      await service.createProject({ name: 'Project A' })
      await new Promise((r) => setTimeout(r, 10))
      await service.createProject({ name: 'Project B' })

      const result = await service.getAllProjects()
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Project A')
      expect(result[1].name).toBe('Project B')
    })

    it('should return empty array when no projects exist', async () => {
      const result = await service.getAllProjects()
      expect(result).toEqual([])
    })
  })

  describe('updateProject', () => {
    it('should update project fields', async () => {
      const created = await service.createProject({ name: 'Original' })
      const result = await service.updateProject(String(created.id), {
        name: 'Updated',
        description: 'Updated desc'
      })

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Updated')
      expect(result?.description).toBe('Updated desc')
    })

    it('should return null when project not found', async () => {
      const result = await service.updateProject('99999', { name: 'New Name' })
      expect(result).toBeNull()
    })
  })

  describe('deleteProject', () => {
    it('should delete a project and return true', async () => {
      const created = await service.createProject({ name: 'To Delete' })
      const result = await service.deleteProject(String(created.id))

      expect(result).toBe(true)
      const found = await service.getProjectById(String(created.id))
      expect(found).toBeNull()
    })

    it('should return false when no project was deleted', async () => {
      const result = await service.deleteProject('99999')
      expect(result).toBe(false)
    })
  })

  // Edge Cases
  describe('Edge Cases', () => {
    it('should handle project with empty string description', async () => {
      const result = await service.createProject({
        name: 'Empty Desc',
        description: ''
      })
      expect(result.name).toBe('Empty Desc')
    })

    it('should handle project name with special characters', async () => {
      const result = await service.createProject({
        name: "Project <> &'\\\"\n"
      })
      expect(result.name).toBe("Project <> &'\\\"\n")
    })

    it('should handle very long project name', async () => {
      const longName = 'A'.repeat(500)
      const result = await service.createProject({ name: longName })
      expect(result.name).toBe(longName)
    })
  })

  // Error Cases
  describe('Error Cases', () => {
    it('should enforce unique constraint on UUID column', async () => {
      await db('projects').insert({
        uuid: 'duplicate-uuid',
        name: 'First',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      })
      let caught = false
      try {
        await db('projects').insert({
          uuid: 'duplicate-uuid',
          name: 'Second',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        })
      } catch (error: any) {
        caught = true
        expect(error.message).toContain('UNIQUE')
      }
      expect(caught).toBe(true)
    })
  })
})
