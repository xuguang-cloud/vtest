import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { Logger } from '../../core/logger/Logger'
import {
  ComparisonRequest,
  ComparisonOptions,
  ComparisonSession,
  ComparisonSessionStatus,
  IComparisonEngine,
  StructuralComparisonResult,
  VisualComparisonResult,
  BugClassificationResult,
  DesignAsset,
  PRDRequirement
} from '../../core/contracts/comparison.contract'
import { ExplorationResult } from '../../core/contracts/exploration.contract'
import { StructuralComparer } from './StructuralComparer'
import { VisualComparer } from './VisualComparer'
import { BugClassifier } from './BugClassifier'
import { DocSourceRegistry, docSourceRegistry } from './DocSourceRegistry'

const logger = Logger.getLogger('comparison-engine')

const DEFAULT_OPTIONS: ComparisonOptions = {
  visualThreshold: 0.9,
  structural: true,
  visual: true,
  coverageGapThreshold: 0.2
}

/**
 * ComparisonEngine - Core orchestrator for PRD/Design comparison
 *
 * Orchestrates structural and visual comparison sub-engines,
 * feeds results into BugClassifier, and manages comparison sessions lifecycle.
 */
export class ComparisonEngine extends EventEmitter implements IComparisonEngine {
  private sessions: Map<string, ComparisonSession> = new Map()
  private structuralComparer: StructuralComparer
  private visualComparer: VisualComparer
  private bugClassifier: BugClassifier
  private docSourceRegistry: DocSourceRegistry

  constructor() {
    super()
    this.structuralComparer = new StructuralComparer()
    this.visualComparer = new VisualComparer()
    this.bugClassifier = new BugClassifier()
    this.docSourceRegistry = docSourceRegistry
  }

  /**
   * Run a full comparison session: structural + visual + classification
   */
  public async runComparison(request: ComparisonRequest): Promise<ComparisonSession> {
    const options = { ...DEFAULT_OPTIONS, ...request.comparisonOptions }
    const session = this.createSession(request.projectId)

    try {
      // Fetch PRD requirements
      const prdRequirements = await this.fetchPRDRequirements(request)
      session.status = 'running_structural'

      // Run structural comparison
      let structuralResult: StructuralComparisonResult | undefined
      let visualResult: VisualComparisonResult | undefined

      if (options.structural) {
        structuralResult = await this.runStructuralComparison(
          request.explorationResult,
          prdRequirements
        )
        session.structuralResult = structuralResult
      }

      // Run visual comparison
      if (options.visual && request.designSource) {
        session.status = 'running_visual'
        // Fetch design assets
        const expectedScreens = await this.docSourceRegistry.fetchDesignAssets(
          request.designSource.type,
          request.designSource.config
        )
        // Convert exploration screenshots to DesignAsset format
        const actualScreens = this.convertExplorationToDesignAssets(request.explorationResult)

        visualResult = await this.runVisualComparison(
          actualScreens,
          expectedScreens,
          options
        )
        session.visualResult = visualResult
      }

      // Classify bugs
      session.status = 'classifying'
      const bugResult = await this.classifyBugs(
        structuralResult || { prdId: '', coverageRate: 0, matchedRequirements: [], unmatchedRequirements: [], extraElements: [] },
        visualResult
      )
      session.bugs = bugResult.bugs

      // Complete session
      session.status = 'completed'
      session.completedAt = new Date()

      logger.info(
        `Comparison session completed: ${session.id}, ${session.bugs.length} bugs found`
      )

      this.emit('comparison:completed', { sessionId: session.id, session })

      return session
    } catch (error) {
      session.status = 'failed'
      logger.error(`Comparison session failed: ${error}`)
      this.emit('comparison:failed', { sessionId: session.id, error })
      throw error
    }
  }

  /**
   * Run only structural (PRD vs UI tree) comparison
   */
  public async runStructuralComparison(
    explorationResult: ExplorationResult,
    prdRequirements: PRDRequirement[]
  ): Promise<StructuralComparisonResult> {
    logger.info('Running structural comparison')
    return this.structuralComparer.compare(explorationResult, prdRequirements)
  }

  /**
   * Run only visual (screenshot diff) comparison
   */
  public async runVisualComparison(
    actualScreens: DesignAsset[],
    expectedScreens: DesignAsset[],
    options: ComparisonOptions
  ): Promise<VisualComparisonResult> {
    logger.info('Running visual comparison')
    return this.visualComparer.compare(actualScreens, expectedScreens, options)
  }

  /**
   * Classify bugs from structural and visual results
   */
  public async classifyBugs(
    structuralResult: StructuralComparisonResult,
    visualResult?: VisualComparisonResult
  ): Promise<BugClassificationResult> {
    logger.info('Classifying bugs')
    return this.bugClassifier.classify(structuralResult, visualResult)
  }

  /**
   * Get a comparison session by ID
   */
  public async getSession(sessionId: string): Promise<ComparisonSession | null> {
    return this.sessions.get(sessionId) || null
  }

  /**
   * List comparison sessions for a project
   */
  public async listSessions(projectId: string): Promise<ComparisonSession[]> {
    return Array.from(this.sessions.values()).filter(s => s.projectId === projectId)
  }

  // --- Private methods ---

  /**
   * Create a new comparison session
   */
  private createSession(projectId: string): ComparisonSession {
    const session: ComparisonSession = {
      id: `comparison-${uuidv4()}`,
      projectId,
      status: 'pending',
      startedAt: new Date(),
      bugs: []
    }

    this.sessions.set(session.id, session)
    logger.info(`Created comparison session: ${session.id}`)
    this.emit('comparison:started', session)

    return session
  }

  /**
   * Fetch PRD requirements from the configured source
   */
  private async fetchPRDRequirements(request: ComparisonRequest): Promise<PRDRequirement[]> {
    return this.docSourceRegistry.fetchPRD(
      request.prdSource.type,
      request.prdSource.config
    )
  }

  /**
   * Convert exploration result screenshots to DesignAsset format
   */
  private convertExplorationToDesignAssets(explorationResult: ExplorationResult): DesignAsset[] {
    const assets: DesignAsset[] = []

    for (const path of explorationResult.paths) {
      for (const coverage of path.coverage) {
        // Each covered screen becomes a design asset
        // In production, these would be actual screenshots
        assets.push({
          id: `screenshot-${path.pathId}-${coverage}`,
          screenName: coverage,
          activity: path.endActivity,
          imageData: Buffer.from(''), // Placeholder for actual screenshot data
          metadata: {
            pathId: path.pathId,
            steps: path.steps.length
          }
        })
      }
    }

    return assets
  }
}

export const comparisonEngine = new ComparisonEngine()
