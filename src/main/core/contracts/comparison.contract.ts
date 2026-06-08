/**
 * US-06: PRD/Design Comparison Engine — Extended Contracts
 *
 * Architecture: ComparisonEngine orchestrates two sub-engines
 * (StructuralComparer + VisualComparer), feeds results into
 * BugClassifier, and outputs via DocSourceAdapter plugins.
 */

import { ExplorationResult } from './exploration.contract'

// ─── Core Comparison Types ───

export interface ComparisonRequest {
  projectId: string
  explorationResult: ExplorationResult
  prdSource: DocSourceConfig
  designSource?: DocSourceConfig
  comparisonOptions?: ComparisonOptions
}

export interface ComparisonOptions {
  /** Pixel-match threshold (0–1). Lower = stricter visual match. */
  visualThreshold: number
  /** Whether to run structural comparison (default: true) */
  structural: boolean
  /** Whether to run visual comparison (default: true if designSource provided) */
  visual: boolean
  /** Max acceptable coverage gap before flagging P1 bug (default: 0.2) */
  coverageGapThreshold: number
}

export interface ComparisonSession {
  id: string
  projectId: string
  status: ComparisonSessionStatus
  startedAt: Date
  completedAt?: Date
  structuralResult?: StructuralComparisonResult
  visualResult?: VisualComparisonResult
  bugs: BugEntry[]
}

export type ComparisonSessionStatus =
  | 'pending'
  | 'running_structural'
  | 'running_visual'
  | 'classifying'
  | 'completed'
  | 'failed'

// ─── Structural Comparison (PRD vs UI Tree) ───

export interface StructuralComparisonResult {
  prdId: string
  coverageRate: number
  matchedRequirements: RequirementMatch[]
  unmatchedRequirements: UnmatchedRequirement[]
  extraElements: ExtraUIElement[]
}

export interface RequirementMatch {
  requirementId: string
  requirementTitle: string
  matchedPathId: string
  matchedActivity: string
  matchConfidence: number // 0–1
}

export interface UnmatchedRequirement {
  requirementId: string
  requirementTitle: string
  reason: 'not_found' | 'partial_match' | 'wrong_state'
  expectedUI: UIRequirement
  searchedActivities: string[]
}

export interface ExtraUIElement {
  elementName: string
  activity: string
  pathId: string
  /** Element exists in app but not in PRD — potential scope creep or undocumented feature */
  category: 'undocumented_feature' | 'debug_element' | 'internal_tool'
}

// ─── Visual Comparison (Screenshot diff) ───

export interface VisualComparisonResult {
  totalScreensCompared: number
  matches: VisualMatch[]
  mismatches: VisualMismatch[]
  overallSimilarityScore: number // 0–1
}

export interface VisualMatch {
  screenName: string
  activity: string
  similarityScore: number
  diffImagePath?: string
}

export interface VisualMismatch {
  screenName: string
  activity: string
  expectedImagePath: string
  actualImagePath: string
  diffImagePath: string
  diffPercentage: number
  diffRegions: DiffRegion[]
  severity: 'minor' | 'major' | 'critical'
}

export interface DiffRegion {
  x: number
  y: number
  width: number
  height: number
  pixelDiffCount: number
}

// ─── Bug Classification ───

export interface BugEntry {
  id: string
  type: BugType
  severity: BugSeverity
  description: string
  screenshotEvidence?: string
  reproSteps: string[]
  prdReference?: string
  pathId?: string
  /** Links to structural/visual comparison evidence */
  evidenceRefs: BugEvidenceRef[]
  createdAt: Date
}

export type BugType =
  | '需求缺失'   // PRD requirement not found in app
  | '设计缺陷'   // Visual mismatch with design spec
  | 'UX缺陷'     // Usability issue not covered by PRD/design
  | '实现不一致' // Behavior differs from PRD description

export type BugSeverity = 'P0' | 'P1' | 'P2' | 'P3'

export interface BugEvidenceRef {
  source: 'structural' | 'visual'
  refId: string // RequirementMatch.id, UnmatchedRequirement.requirementId, or VisualMismatch.screenName
}

export interface BugClassificationResult {
  bugs: BugEntry[]
  summary: BugClassificationSummary
}

export interface BugClassificationSummary {
  totalBugs: number
  byType: Record<BugType, number>
  bySeverity: Record<BugSeverity, number>
  coverageRate: number
  visualSimilarity: number
}

// ─── Document Source Adapter (Plugin Architecture) ───

export interface DocSourceConfig {
  type: DocSourceType
  /** Source-specific config — each adapter defines its own shape */
  config: Record<string, unknown>
}

export type DocSourceType = 'dingtalk' | 'feishu' | 'figma' | 'webpage' | 'local_file'

export interface DocSourceAdapter {
  readonly type: DocSourceType

  /**
   * Fetch and parse PRD requirements from the document source.
   * Returns structured PRDRequirement[] ready for structural comparison.
   */
  fetchPRD(config: Record<string, unknown>): Promise<PRDRequirement[]>

  /**
   * Fetch design screenshots/frames for visual comparison.
   * Returns DesignAsset[] with image data ready for pixelmatch.
   */
  fetchDesignAssets(config: Record<string, unknown>): Promise<DesignAsset[]>

  /**
   * Validate that the source config is correctly formed before fetching.
   */
  validateConfig(config: Record<string, unknown>): Promise<ConfigValidationResult>
}

export interface DesignAsset {
  id: string
  screenName: string
  /** Activity this screen corresponds to (mapped from design frame labels) */
  activity?: string
  /** Image data as PNG buffer for pixelmatch comparison */
  imageData: Buffer
  /** File path if stored locally */
  filePath?: string
  metadata?: Record<string, unknown>
}

export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
}

// ─── PRD Requirement (extended from existing) ───

export interface PRDRequirement {
  id: string
  title: string
  priority: string
  acceptanceCriteria: string[]
  uiRequirements: UIRequirement[]
  screens: string[]
  /** Which activities this requirement is expected to appear in */
  expectedActivities?: string[]
  /** Functional behavior description for behavioral comparison */
  behaviorDescription?: string
}

export interface UIRequirement {
  element: string
  type: string
  color?: string
  text?: string
  placeholder?: string
  /** Expected accessibility attributes */
  accessibilityLabel?: string
  /** Expected element bounds (for position matching) */
  bounds?: { x: number; y: number; width: number; height: number }
}

// ─── Comparison Engine Interface ───

export interface IComparisonEngine {
  /**
   * Run a full comparison session: structural + visual + classification.
   */
  runComparison(request: ComparisonRequest): Promise<ComparisonSession>

  /**
   * Run only structural (PRD vs UI tree) comparison.
   */
  runStructuralComparison(
    explorationResult: ExplorationResult,
    prdRequirements: PRDRequirement[]
  ): Promise<StructuralComparisonResult>

  /**
   * Run only visual (screenshot diff) comparison.
   */
  runVisualComparison(
    actualScreens: DesignAsset[],
    expectedScreens: DesignAsset[],
    options: ComparisonOptions
  ): Promise<VisualComparisonResult>

  /**
   * Classify bugs from structural and visual results.
   */
  classifyBugs(
    structuralResult: StructuralComparisonResult,
    visualResult?: VisualComparisonResult
  ): Promise<BugClassificationResult>

  /**
   * Get a comparison session by ID.
   */
  getSession(sessionId: string): Promise<ComparisonSession | null>

  /**
   * List comparison sessions for a project.
   */
  listSessions(projectId: string): Promise<ComparisonSession[]>
}

// ─── Adapter Registry ───

export interface IDocSourceRegistry {
  /**
   * Register a new document source adapter plugin.
   */
  register(adapter: DocSourceAdapter): void

  /**
   * Get an adapter by source type.
   */
  get(type: DocSourceType): DocSourceAdapter | null

  /**
   * List all registered adapter types.
   */
  listRegistered(): DocSourceType[]

  /**
   * Fetch PRD requirements using the adapter for the given source type.
   */
  fetchPRD(type: DocSourceType, config: Record<string, unknown>): Promise<PRDRequirement[]>

  /**
   * Fetch design assets using the adapter for the given source type.
   */
  fetchDesignAssets(type: DocSourceType, config: Record<string, unknown>): Promise<DesignAsset[]>
}