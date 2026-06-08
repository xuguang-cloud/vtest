/**
 * Interface contract for Exploration Service.
 * Defines the complete API for managing UI exploration sessions.
 */

export type ExplorationState = 'IDLE' | 'INIT' | 'EXPLORING' | 'COMPARING' | 'GENERATING' | 'DONE' | 'ERROR'

export interface ExplorationConfig {
  timeout: number
  maxDepth: number
  strategy: 'dfs' | 'bfs'
}

export interface ExplorationResult {
  paths: string[]
  coverage: number
  duration: number
}

export interface ExplorationCheckpoint {
  id: string
  stepIndex: number
  activityName: string
  uiTreeHash: string
  stateData: Buffer
  createdAt: Date
}

export interface ExplorationRun {
  id: string
  projectId: string
  state: ExplorationState
  startedAt: Date
  completedAt?: Date
  config: ExplorationConfig
}

export interface ExplorationPath {
  id: string
  runId: string
  sequence: number
  activityName: string
  action: string
  screenshotPath?: string
  timestamp: Date
}

export interface ExplorationServiceError extends Error {
  code: string
  details?: Record<string, unknown>
}

export interface IExplorationService {
  /**
   * Start a new exploration run for a given project.
   * @param projectId - The project to explore.
   * @param config - Exploration configuration.
   * @returns The created ExplorationRun.
   * @throws ExplorationServiceError if start fails or project not found.
   */
  startExploration(projectId: string, config: ExplorationConfig): Promise<ExplorationRun>

  /**
   * Pause the current exploration.
   * @throws ExplorationServiceError if no exploration is running.
   */
  pauseExploration(): Promise<void>

  /**
   * Resume a paused exploration.
   * @throws ExplorationServiceError if no paused exploration exists.
   */
  resumeExploration(): Promise<void>

  /**
   * Stop and terminate the current exploration.
   * @returns The final ExplorationResult.
   * @throws ExplorationServiceError if no exploration is running.
   */
  stopExploration(): Promise<ExplorationResult>

  /**
   * Get the current exploration state.
   * @returns The current ExplorationState.
   */
  getCurrentState(): ExplorationState

  /**
   * Get the execution history of state transitions.
   * @returns Array of state transition records.
   */
  getStateHistory(): Array<{ state: ExplorationState; timestamp: number }>

  /**
   * Get the current exploration run details.
   * @returns The current ExplorationRun or null.
   */
  getCurrentRun(): ExplorationRun | null
}
