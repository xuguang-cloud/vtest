import { EventEmitter } from 'events'
import { Logger } from '../core/logger/Logger'
import { 
  ExplorationResult, 
  ExplorationPath, 
  ExplorationStep 
} from '../core/contracts/exploration.contract'

const logger = Logger.getLogger('exploration')

export { ExplorationResult, ExplorationPath, ExplorationStep }

export interface ExplorationConfig {
  maxDepth: number
  timeout: number
  strategy: 'dfs' | 'bfs'
}

export interface ExplorationSession {
  id: string
  projectId: string
  config: ExplorationConfig
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  startTime?: Date
  endTime?: Date
  paths: ExplorationPath[]
  currentDepth: number
}

export class ExplorationService extends EventEmitter {
  private sessions: Map<string, ExplorationSession> = new Map()
  private activeSessionId: string | null = null

  /**
   * Start a new exploration session
   */
  public async startExploration(projectId: string, config: ExplorationConfig): Promise<ExplorationSession> {
    const sessionId = `exploration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const session: ExplorationSession = {
      id: sessionId,
      projectId,
      config,
      status: 'running',
      startTime: new Date(),
      paths: [],
      currentDepth: 0
    }
    
    this.sessions.set(sessionId, session)
    this.activeSessionId = sessionId
    
    logger.info(`Exploration started: ${sessionId} for project ${projectId}`)
    this.emit('exploration:started', session)
    
    // Run exploration in background
    this.runExploration(session).catch(error => {
      logger.error(`Exploration failed: ${error}`)
      session.status = 'error'
      this.emit('exploration:error', { sessionId, error })
    })
    
    return session
  }

  /**
   * Pause the current exploration
   */
  public async pauseExploration(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    if (session.status !== 'running') {
      throw new Error(`Cannot pause exploration in state: ${session.status}`)
    }
    
    session.status = 'paused'
    logger.info(`Exploration paused: ${sessionId}`)
    this.emit('exploration:paused', session)
  }

  /**
   * Resume a paused exploration
   */
  public async resumeExploration(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    if (session.status !== 'paused') {
      throw new Error(`Cannot resume exploration in state: ${session.status}`)
    }
    
    session.status = 'running'
    logger.info(`Exploration resumed: ${sessionId}`)
    this.emit('exploration:resumed', session)
    
    // Continue exploration
    this.runExploration(session).catch(error => {
      logger.error(`Exploration failed after resume: ${error}`)
      session.status = 'error'
      this.emit('exploration:error', { sessionId, error })
    })
  }

  /**
   * Stop and complete an exploration
   */
  public async stopExploration(sessionId: string): Promise<ExplorationResult> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    
    session.status = 'completed'
    session.endTime = new Date()
    
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null
    }
    
    const result = this.buildExplorationResult(session)
    
    logger.info(`Exploration stopped: ${sessionId}, found ${result.totalPaths} paths`)
    this.emit('exploration:completed', { sessionId, result })
    
    return result
  }

  /**
   * Get exploration session by ID
   */
  public getSession(sessionId: string): ExplorationSession | null {
    return this.sessions.get(sessionId) || null
  }

  /**
   * Get all sessions for a project
   */
  public getSessionsByProject(projectId: string): ExplorationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.projectId === projectId)
  }

  /**
   * DFS traversal of UI elements
   */
  private async runExploration(session: ExplorationSession): Promise<void> {
    const startTime = Date.now()
    const { maxDepth, timeout } = session.config
    
    // Simulate DFS exploration with timeout
    const paths: ExplorationPath[] = []
    
    for (let depth = 0; depth < maxDepth; depth++) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        logger.warn(`Exploration timed out after ${timeout}ms`)
        break
      }
      
      // Check if paused
      if (session.status === 'paused') {
        logger.info('Exploration paused, waiting...')
        break
      }
      
      session.currentDepth = depth
      
      // Simulate discovering a new path
      const path = this.generateExplorationPath(depth)
      paths.push(path)
      
      this.emit('exploration:progress', {
        sessionId: session.id,
        currentDepth: depth,
        totalPaths: paths.length
      })
      
      // Simulate small delay
      await this.delay(10)
    }
    
    session.paths = paths
    
    if (session.status === 'running') {
      session.status = 'completed'
      session.endTime = new Date()
    }
    
    logger.info(`Exploration completed: ${session.id}, ${paths.length} paths discovered`)
    this.emit('exploration:completed', {
      sessionId: session.id,
      result: this.buildExplorationResult(session)
    })
  }

  /**
   * Generate a mock exploration path for testing
   */
  private generateExplorationPath(depth: number): ExplorationPath {
    const stepCount = Math.min(depth + 2, 5)
    const steps: ExplorationStep[] = []
    
    for (let i = 0; i < stepCount; i++) {
      steps.push({
        action: 'click',
        element: `element_${depth}_${i}`,
        x: 100 + i * 50,
        y: 200 + i * 30
      })
    }
    
    return {
      pathId: `path-${depth}-${Date.now()}`,
      startActivity: 'MainActivity',
      endActivity: `Activity_${depth}`,
      steps,
      coverage: [`screen_${depth}`],
      reproducible: true
    }
  }

  /**
   * Build exploration result from session
   */
  private buildExplorationResult(session: ExplorationSession): ExplorationResult {
    return {
      appPackage: 'com.example.app',
      explorationStart: session.startTime?.toISOString() || new Date().toISOString(),
      explorationEnd: session.endTime?.toISOString() || new Date().toISOString(),
      totalPaths: session.paths.length,
      paths: session.paths,
      coverageSummary: {
        totalActivities: session.paths.length + 1,
        exploredActivities: session.paths.length,
        coverageRate: session.paths.length > 0 ? (session.paths.length / (session.paths.length + 1)) * 100 : 0
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const explorationService = new ExplorationService()
