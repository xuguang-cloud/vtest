/**
 * Interface contract for AVD (Android Virtual Device) Service.
 * Defines the complete API for managing Android emulator lifecycle.
 */

export interface AVDConfig {
  name: string
  device: string
  apiLevel: number
  screenSize: string
  screenDensity: string
}

export interface AVDStatus {
  name: string
  state: 'stopped' | 'starting' | 'running' | 'error'
  pid?: number
  error?: string
}

export interface CreateAVDRequest {
  name: string
  device: string
  apiLevel: number
  screenSize?: string
  screenDensity?: string
}

export interface AVDServiceError extends Error {
  code: string
  details?: Record<string, unknown>
}

export interface IAVDService {
  /**
   * List all available AVD configurations.
   * @returns Array of AVD names.
   * @throws AVDServiceError if listing fails.
   */
  listAVDs(): Promise<string[]>

  /**
   * Create a new AVD configuration.
   * @param request - AVD creation parameters.
   * @throws AVDServiceError if creation fails.
   */
  createAVD(request: CreateAVDRequest): Promise<void>

  /**
   * Start a specified AVD.
   * @param name - The AVD name to start.
   * @param config - Optional partial configuration overrides.
   * @throws AVDServiceError if the AVD is already running or start fails.
   */
  startAVD(name: string, config?: Partial<AVDConfig>): Promise<void>

  /**
   * Stop the currently running AVD.
   * @throws AVDServiceError if stop operation fails.
   */
  stopAVD(): Promise<void>

  /**
   * Get the current AVD status.
   * @returns The current AVDStatus.
   */
  getStatus(): AVDStatus

  /**
   * Rotate the AVD screen to a specified orientation.
   * @param orientation - The target orientation.
   * @throws AVDServiceError if the AVD is not running or rotation fails.
   */
  rotateScreen(orientation: 'portrait' | 'landscape'): Promise<void>
}
