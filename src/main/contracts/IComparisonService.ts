/**
 * Interface contract for Comparison Service (US-06).
 * Orchestrates PRD/Design comparison sessions.
 */

import {
  ComparisonRequest,
  ComparisonSession,
  ComparisonOptions,
  StructuralComparisonResult,
  VisualComparisonResult,
  BugClassificationResult,
  DocSourceConfig,
  PRDRequirement,
  DesignAsset
} from '../core/contracts/comparison.contract'

export interface ComparisonServiceError extends Error {
  code: string
  details?: Record<string, unknown>
}

export interface IComparisonService {
  /**
   * Start a full comparison session for a project.
   * Fetches PRD/design from configured sources, runs structural
   * and visual comparison, then classifies bugs.
   * @param request - Comparison request with project, sources, and options.
   * @returns The ComparisonSession with results and bugs.
   * @throws ComparisonServiceError if fetch, comparison, or classification fails.
   */
  startComparison(request: ComparisonRequest): Promise<ComparisonSession>

  /**
   * Get a comparison session by ID.
   * @param sessionId - The session ID.
   * @returns The ComparisonSession or null if not found.
   */
  getSession(sessionId: string): Promise<ComparisonSession | null>

  /**
   * List all comparison sessions for a project.
   * @param projectId - The project ID.
   * @returns Array of ComparisonSessions.
   */
  listSessions(projectId: string): Promise<ComparisonSession[]>

  /**
   * Run structural comparison only (no visual).
   * Useful when only PRD source is available.
   * @param explorationResult - The exploration output.
   * @param prdRequirements - Parsed PRD requirements.
   * @returns Structural comparison result.
   */
  runStructuralComparison(
    explorationResult: import('../core/contracts/exploration.contract').ExplorationResult,
    prdRequirements: PRDRequirement[]
  ): Promise<StructuralComparisonResult>

  /**
   * Run visual comparison only (no structural).
   * Useful when only design assets are available.
   * @param actualScreens - Screenshots from exploration.
   * @param expectedScreens - Design reference images.
   * @param options - Comparison options including visual threshold.
   * @returns Visual comparison result.
   */
  runVisualComparison(
    actualScreens: DesignAsset[],
    expectedScreens: DesignAsset[],
    options: ComparisonOptions
  ): Promise<VisualComparisonResult>

  /**
   * Classify bugs from comparison results.
   * @param structuralResult - Structural comparison output.
   * @param visualResult - Visual comparison output (optional).
   * @returns Classified bugs with summary.
   */
  classifyBugs(
    structuralResult: StructuralComparisonResult,
    visualResult?: VisualComparisonResult
  ): Promise<BugClassificationResult>

  /**
   * Fetch PRD requirements from a configured document source.
   * @param sourceConfig - Document source configuration.
   * @returns Parsed PRD requirements.
   * @throws ComparisonServiceError if source is unavailable or config invalid.
   */
  fetchPRD(sourceConfig: DocSourceConfig): Promise<PRDRequirement[]>

  /**
   * Fetch design assets from a configured document source.
   * @param sourceConfig - Document source configuration.
   * @returns Design assets with image data.
   * @throws ComparisonServiceError if source is unavailable or config invalid.
   */
  fetchDesignAssets(sourceConfig: DocSourceConfig): Promise<DesignAsset[]>

  /**
   * Delete a comparison session.
   * @param sessionId - The session ID to delete.
   * @returns True if deleted, false if not found.
   */
  deleteSession(sessionId: string): Promise<boolean>
}