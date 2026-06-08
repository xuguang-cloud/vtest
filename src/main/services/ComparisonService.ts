import { EventEmitter } from 'events'
import { Logger } from '../core/logger/Logger'
import {
  ComparisonRequest,
  ComparisonSession,
  IComparisonEngine
} from '../core/contracts/comparison.contract'
import { ComparisonEngine } from './comparison'

const logger = Logger.getLogger('comparison-service')

/**
 * ComparisonService - Service entry point for PRD/Design comparison
 *
 * Wraps the ComparisonEngine and provides a simplified API for
 * integration with the exploration flow.
 */
export class ComparisonService extends EventEmitter {
  private engine: IComparisonEngine

  constructor(engine?: IComparisonEngine) {
    super()
    this.engine = engine || new ComparisonEngine()
  }

  /**
   * Run comparison for a project's exploration results
   */
  public async runComparison(request: ComparisonRequest): Promise<{
    sessionId: string
    projectId: string
    coverageRate: number
    totalBugs: number
    bugsByType: Record<string, number>
    status: string
  }> {
    logger.info(`Starting comparison for project: ${request.projectId}`)

    try {
      const session = await this.engine.runComparison(request)
      const result = this.buildComparisonResult(session)

      logger.info(
        `Comparison complete for project: ${request.projectId}, ${result.totalBugs} bugs found`
      )

      this.emit('comparison:complete', { projectId: request.projectId, result })

      return result
    } catch (error) {
      logger.error(`Comparison failed for project: ${request.projectId}: ${error}`)
      this.emit('comparison:error', { projectId: request.projectId, error })
      throw error
    }
  }

  /**
   * Get a comparison session by ID
   */
  public async getSession(sessionId: string): Promise<ComparisonSession | null> {
    return this.engine.getSession(sessionId)
  }

  /**
   * List comparison sessions for a project
   */
  public async listSessions(projectId: string): Promise<ComparisonSession[]> {
    return this.engine.listSessions(projectId)
  }

  /**
   * Build a simplified comparison result from a session
   */
  private buildComparisonResult(session: ComparisonSession): {
    sessionId: string
    projectId: string
    coverageRate: number
    totalBugs: number
    bugsByType: Record<string, number>
    status: string
  } {
    const bugCountByType = this.countBugsByType(session.bugs)

    return {
      sessionId: session.id,
      projectId: session.projectId,
      coverageRate: session.structuralResult?.coverageRate || 0,
      totalBugs: session.bugs.length,
      bugsByType: bugCountByType,
      status: session.status
    }
  }

  /**
   * Count bugs by type
   */
  private countBugsByType(bugs: Array<{ type: string }>): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const bug of bugs) {
      counts[bug.type] = (counts[bug.type] || 0) + 1
    }
    return counts
  }
}

export const comparisonService = new ComparisonService()
