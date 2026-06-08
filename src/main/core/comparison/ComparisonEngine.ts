/**
 * US-06: Comparison Engine — Top-Level Orchestrator
 *
 * Coordinates structural comparison, visual comparison,
 * bug classification, and document source fetching to
 * produce a complete ComparisonSession.
 *
 * Data flow:
 *   DocSourceAdapter.fetchPRD()  ──┐
 *   DocSourceAdapter.fetchDesign()─┤
 *   ExplorationResult ─────────────┤
 *                                   ├─→ ComparisonEngine.runComparison()
 *                                      ├─→ StructuralComparer.compare()
 *                                      ├─→ VisualComparer.compare()
 *                                      └─→ BugClassifier.classify()
 *                                          └─→ ComparisonSession (output)
 */

import { v4 as uuidv4 } from 'uuid'
import {
  ComparisonRequest,
  ComparisonSession,
  // ComparisonSessionStatus, — re-exported via contract, not used internally
  ComparisonOptions,
  StructuralComparisonResult,
  VisualComparisonResult,
  BugClassificationResult,
  // BugEntry, — re-exported via contract, not used internally
  IComparisonEngine,
  IDocSourceRegistry
} from '../contracts/comparison.contract'
import { ExplorationResult } from '../contracts/exploration.contract'

import { StructuralComparer } from './StructuralComparer'
import { VisualComparer } from './VisualComparer'
import { BugClassifier } from './BugClassifier'

const DEFAULT_OPTIONS: ComparisonOptions = {
  visualThreshold: 0.1,
  structural: true,
  visual: true,
  coverageGapThreshold: 0.2
}

export class ComparisonEngine implements IComparisonEngine {
  private structuralComparer: StructuralComparer
  private visualComparer: VisualComparer
  private bugClassifier: BugClassifier
  private registry: IDocSourceRegistry
  private sessions: Map<string, ComparisonSession> = new Map()

  constructor(registry: IDocSourceRegistry) {
    this.structuralComparer = new StructuralComparer()
    this.visualComparer = new VisualComparer()
    this.bugClassifier = new BugClassifier()
    this.registry = registry
  }

  /**
   * Run a full comparison session:
   * 1. Fetch PRD from document source
   * 2. Fetch design assets (if provided)
   * 3. Run structural comparison
   * 4. Run visual comparison
   * 5. Classify bugs
   * 6. Output ComparisonSession
   */
  async runComparison(request: ComparisonRequest): Promise<ComparisonSession> {
    const sessionId = uuidv4()
    const options = request.comparisonOptions || DEFAULT_OPTIONS

    const session: ComparisonSession = {
      id: sessionId,
      projectId: request.projectId,
      status: 'pending',
      startedAt: new Date(),
      bugs: []
    }

    this.sessions.set(sessionId, session)

    try {
      // Step 1: Fetch PRD requirements
      const prdRequirements = await this.registry.fetchPRD(
        request.prdSource.type,
        request.prdSource.config
      )

      // Step 2: Run structural comparison
      if (options.structural) {
        session.status = 'running_structural'
        const structuralResult = this.structuralComparer.compare(
          request.explorationResult,
          prdRequirements
        )
        session.structuralResult = structuralResult
      }

      // Step 3: Fetch design assets + run visual comparison
      if (options.visual && request.designSource) {
        session.status = 'running_visual'
        const designAssets = await this.registry.fetchDesignAssets(
          request.designSource.type,
          request.designSource.config
        )

        // Build actual screen assets from exploration (placeholder)
        const actualScreens = this.buildActualScreens(request.explorationResult)

        const visualResult = this.visualComparer.compare(
          actualScreens,
          designAssets,
          options
        )
        session.visualResult = visualResult
      }

      // Step 4: Classify bugs
      session.status = 'classifying'
      const classificationResult = this.bugClassifier.classify(
        session.structuralResult!,
        session.visualResult
      )
      session.bugs = classificationResult.bugs

      // Step 5: Complete
      session.status = 'completed'
      session.completedAt = new Date()

    } catch (error) {
      session.status = 'failed'
      session.completedAt = new Date()
      throw error
    }

    return session
  }

  async runStructuralComparison(
    explorationResult: ExplorationResult,
    prdRequirements: import('../contracts/comparison.contract').PRDRequirement[]
  ): Promise<StructuralComparisonResult> {
    return this.structuralComparer.compare(explorationResult, prdRequirements)
  }

  async runVisualComparison(
    actualScreens: import('../contracts/comparison.contract').DesignAsset[],
    expectedScreens: import('../contracts/comparison.contract').DesignAsset[],
    options: ComparisonOptions
  ): Promise<VisualComparisonResult> {
    return this.visualComparer.compare(actualScreens, expectedScreens, options)
  }

  async classifyBugs(
    structuralResult: StructuralComparisonResult,
    visualResult?: VisualComparisonResult
  ): Promise<BugClassificationResult> {
    return this.bugClassifier.classify(structuralResult, visualResult)
  }

  async getSession(sessionId: string): Promise<ComparisonSession | null> {
    return this.sessions.get(sessionId) || null
  }

  async listSessions(projectId: string): Promise<ComparisonSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.projectId === projectId)
  }

  /**
   * Build DesignAsset[] from exploration screenshots.
   * In production, this reads actual screenshot files from disk.
   */
  private buildActualScreens(explorationResult: ExplorationResult): import('../contracts/comparison.contract').DesignAsset[] {
    return explorationResult.paths.map(path => ({
      id: `screen-${path.pathId}`,
      screenName: path.endActivity,
      activity: path.endActivity,
      imageData: Buffer.alloc(0), // placeholder — real data from screenshot files
      filePath: `screens/${path.endActivity}.png`,
      metadata: { pathId: path.pathId }
    }))
  }
}