import { describe, it, expect, jest, beforeEach } from "@jest/globals"

let uuidCounter = 0
jest.mock('uuid', () => ({ v4: jest.fn(() => `test-uuid-${++uuidCounter}`) }))

import { ComparisonEngine } from '../ComparisonEngine'
import { ComparisonRequest, IDocSourceRegistry, PRDRequirement, DesignAsset, ComparisonOptions } from '../../contracts/comparison.contract'
import { ExplorationResult } from '../../contracts/exploration.contract'

function createExplorationResult(): ExplorationResult {
  return {
    appPackage: 'com.test.app',
    explorationStart: new Date().toISOString(),
    explorationEnd: new Date().toISOString(),
    totalPaths: 1,
    paths: [
      {
        pathId: 'path-1',
        startActivity: 'LoginActivity',
        endActivity: 'LoginActivity',
        steps: [
          { action: 'input', element: 'username_input', text: '' },
          { action: 'input', element: 'password_input', text: '' },
          { action: 'click', element: 'login_button', text: 'Login' },
        ],
        coverage: ['LoginActivity'],
        reproducible: true,
      },
    ],
    coverageSummary: { totalActivities: 1, exploredActivities: 1, coverageRate: 1 },
  }
}

function createPRDRequirements(): PRDRequirement[] {
  return [
    {
      id: 'req-001',
      title: 'Login Screen',
      priority: 'P0',
      acceptanceCriteria: ['User can login'],
      uiRequirements: [
        { element: 'username_input', type: 'EditText', placeholder: 'Enter username' },
        { element: 'password_input', type: 'EditText', placeholder: 'Enter password' },
        { element: 'login_button', type: 'Button', text: 'Login' },
      ],
      screens: ['LoginActivity'],
      expectedActivities: ['LoginActivity'],
      behaviorDescription: 'User can login',
    },
  ]
}

function createDesignAssets(): DesignAsset[] {
  return [
    {
      id: 'design-login',
      screenName: 'LoginActivity',
      activity: 'LoginActivity',
      imageData: Buffer.alloc(0),
      filePath: '/designs/login.png',
      metadata: { source: 'local_file' },
    },
  ]
}

function createRegistry(prd: PRDRequirement[] = createPRDRequirements(), design: DesignAsset[] = createDesignAssets()): IDocSourceRegistry {
  return {
    register: jest.fn(),
    get: jest.fn(),
    listRegistered: jest.fn(),
    fetchPRD: jest.fn().mockResolvedValue(prd),
    fetchDesignAssets: jest.fn().mockResolvedValue(design),
  }
}

function createRequest(overrides: Partial<ComparisonRequest> = {}): ComparisonRequest {
  return {
    projectId: 'project-1',
    explorationResult: createExplorationResult(),
    prdSource: { type: 'local_file', config: { prdFilePath: '/tmp/prd.json' } },
    designSource: { type: 'local_file', config: { designDirPath: '/tmp/designs' } },
    comparisonOptions: { visualThreshold: 0.1, structural: true, visual: true, coverageGapThreshold: 0.2 },
    ...overrides,
  }
}

describe('ComparisonEngine', () => {
  let engine: ComparisonEngine
  let registry: IDocSourceRegistry

  beforeEach(() => {
    registry = createRegistry()
    engine = new ComparisonEngine(registry)
  })

  describe('runComparison', () => {
    it('should return a completed session with structural and visual results', async () => {
      const request = createRequest()
      const session = await engine.runComparison(request)
      expect(session.projectId).toBe(request.projectId)
      expect(session.status).toBe('completed')
      expect(session.structuralResult).toBeDefined()
      expect(session.visualResult).toBeDefined()
      expect(session.bugs).toBeDefined()
      expect(registry.fetchPRD).toHaveBeenCalledWith(request.prdSource.type, request.prdSource.config)
      expect(registry.fetchDesignAssets).toHaveBeenCalledWith(request.designSource.type, request.designSource.config)
    })

    it('should skip visual comparison when options.visual is false', async () => {
      const request = createRequest({
        comparisonOptions: { visualThreshold: 0.1, structural: true, visual: false, coverageGapThreshold: 0.2 },
      })
      const session = await engine.runComparison(request)
      expect(session.status).toBe('completed')
      expect(session.visualResult).toBeUndefined()
      expect(registry.fetchDesignAssets).not.toHaveBeenCalled()
    })

    it('should skip visual comparison when designSource is missing', async () => {
      const request = createRequest({ designSource: undefined })
      const session = await engine.runComparison(request)
      expect(session.visualResult).toBeUndefined()
      expect(registry.fetchDesignAssets).not.toHaveBeenCalled()
    })

    it('should throw when structural comparison is disabled because structuralResult is required by classifier', async () => {
      const request = createRequest({
        comparisonOptions: { visualThreshold: 0.1, structural: false, visual: true, coverageGapThreshold: 0.2 },
      })
      await expect(engine.runComparison(request)).rejects.toThrow()
    })

    it('should use default options when none provided', async () => {
      const request = createRequest({ comparisonOptions: undefined })
      const session = await engine.runComparison(request)
      expect(session.status).toBe('completed')
      expect(session.structuralResult).toBeDefined()
      expect(session.visualResult).toBeDefined()
    })

    it('should mark session as failed and rethrow on error', async () => {
      const failingRegistry: IDocSourceRegistry = {
        ...createRegistry(),
        fetchPRD: jest.fn().mockRejectedValue(new Error('fetch failed')),
      }
      const localEngine = new ComparisonEngine(failingRegistry)
      await expect(localEngine.runComparison(createRequest())).rejects.toThrow('fetch failed')
      const sessions = await localEngine.listSessions('project-1')
      expect(sessions.some(s => s.status === 'failed')).toBe(true)
    })

    it('should store sessions and allow retrieval by id', async () => {
      const session = await engine.runComparison(createRequest())
      const retrieved = await engine.getSession(session.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(session.id)
    })
    it('should return null for a non-existent session id', async () => {
      const retrieved = await engine.getSession('non-existent-id')
      expect(retrieved).toBeNull()
    })
  })

  describe('runStructuralComparison', () => {
    it('should return a structural comparison result', async () => {
      const result = await engine.runStructuralComparison(createExplorationResult(), createPRDRequirements())
      expect(result.coverageRate).toBeGreaterThanOrEqual(0)
      expect(result.matchedRequirements).toBeDefined()
      expect(result.unmatchedRequirements).toBeDefined()
    })
  })

  describe('runVisualComparison', () => {
    it('should return a visual comparison result', async () => {
      const options: ComparisonOptions = { visualThreshold: 0.1, structural: true, visual: true, coverageGapThreshold: 0.2 }
      const result = await engine.runVisualComparison(createDesignAssets(), createDesignAssets(), options)
      expect(result.totalScreensCompared).toBeGreaterThanOrEqual(0)
      expect(result.matches).toBeDefined()
      expect(result.mismatches).toBeDefined()
    })
  })

  describe('classifyBugs', () => {
    it('should classify bugs from structural and visual results', async () => {
      const exploration = createExplorationResult()
      const prd = createPRDRequirements()
      const structural = await engine.runStructuralComparison(exploration, prd)
      const visual = await engine.runVisualComparison(createDesignAssets(), createDesignAssets(), {
        visualThreshold: 0.1, structural: true, visual: true, coverageGapThreshold: 0.2,
      })
      const result = await engine.classifyBugs(structural, visual)
      expect(result.bugs).toBeDefined()
      expect(result.summary.totalBugs).toBe(result.bugs.length)
    })
  })

  describe('listSessions', () => {
    it('should return sessions filtered by project id', async () => {
      await engine.runComparison(createRequest({ projectId: 'project-a' }))
      await engine.runComparison(createRequest({ projectId: 'project-b' }))
      const sessions = await engine.listSessions('project-a')
      expect(sessions.length).toBe(1)
      expect(sessions[0].projectId).toBe('project-a')
    })
  })
})