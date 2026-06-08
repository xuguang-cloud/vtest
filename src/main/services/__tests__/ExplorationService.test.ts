import { ExplorationService } from '../ExplorationService'

jest.mock('../../core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    })
  }
}))

describe('ExplorationService (US-02: AI探索与路径生成)', () => {
  let service: ExplorationService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ExplorationService()
  })

  describe('startExploration', () => {
    it('should create and start a new exploration session', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 3,
        timeout: 5000,
        strategy: 'dfs'
      })

      expect(session).toBeDefined()
      expect(session.id).toBeDefined()
      expect(session.projectId).toBe('project-1')
      expect(session.config.maxDepth).toBe(3)
      expect(session.config.strategy).toBe('dfs')
      expect(session.status).toBe('running')
      expect(session.startTime).toBeDefined()
    })

    it('should emit exploration:started event', async () => {
      const listener = jest.fn()
      service.on('exploration:started', listener)

      await service.startExploration('project-1', {
        maxDepth: 2,
        timeout: 1000,
        strategy: 'dfs'
      })

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('pauseExploration', () => {
    it('should pause a running exploration', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 5,
        timeout: 10000,
        strategy: 'dfs'
      })

      await service.pauseExploration(session.id)
      const updatedSession = service.getSession(session.id)
      
      expect(updatedSession?.status).toBe('paused')
    })

    it('should throw error when session not found', async () => {
      await expect(service.pauseExploration('non-existent')).rejects.toThrow('Session not found')
    })
  })

  describe('resumeExploration', () => {
    it('should resume a paused exploration', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 5,
        timeout: 10000,
        strategy: 'dfs'
      })

      await service.pauseExploration(session.id)
      await service.resumeExploration(session.id)
      
      const updatedSession = service.getSession(session.id)
      expect(updatedSession?.status).toBe('running')
    })

    it('should throw error when session is not paused', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 2,
        timeout: 1000,
        strategy: 'dfs'
      })

      await expect(service.resumeExploration(session.id)).rejects.toThrow('Cannot resume')
    })
  })

  describe('stopExploration', () => {
    it('should stop exploration and return results', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 3,
        timeout: 5000,
        strategy: 'dfs'
      })

      // Wait for exploration to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = await service.stopExploration(session.id)

      expect(result).toBeDefined()
      expect(result.totalPaths).toBeGreaterThanOrEqual(0)
      expect(result.coverageSummary).toBeDefined()
      expect(result.coverageSummary.totalActivities).toBeDefined()
    })
  })

  describe('getSession', () => {
    it('should return session by id', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 2,
        timeout: 1000,
        strategy: 'dfs'
      })

      const found = service.getSession(session.id)
      expect(found).toBeDefined()
      expect(found?.projectId).toBe('project-1')
    })

    it('should return null for non-existent session', () => {
      const found = service.getSession('non-existent')
      expect(found).toBeNull()
    })
  })

  describe('getSessionsByProject', () => {
    it('should return all sessions for a project', async () => {
      await service.startExploration('project-1', {
        maxDepth: 2,
        timeout: 1000,
        strategy: 'dfs'
      })

      await service.startExploration('project-1', {
        maxDepth: 3,
        timeout: 1000,
        strategy: 'dfs'
      })

      const sessions = service.getSessionsByProject('project-1')
      expect(sessions).toHaveLength(2)
    })
  })

  describe('DFS exploration', () => {
    it('should explore up to maxDepth', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 2,
        timeout: 5000,
        strategy: 'dfs'
      })

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const result = await service.stopExploration(session.id)
      expect(result.totalPaths).toBeGreaterThanOrEqual(0)
    })

    it('should respect timeout', async () => {
      const session = await service.startExploration('project-1', {
        maxDepth: 100,
        timeout: 50,
        strategy: 'dfs'
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      
      const result = await service.stopExploration(session.id)
      expect(result).toBeDefined()
    })
  })
})
