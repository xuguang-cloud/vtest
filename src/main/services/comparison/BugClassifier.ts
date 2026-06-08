import { EventEmitter } from 'events'
import { Logger } from '../../core/logger/Logger'
import {
  BugEntry,
  BugType,
  BugSeverity,
  BugClassificationResult,
  BugClassificationSummary,
  // BugEvidenceRef, — re-exported via contract
  StructuralComparisonResult,
  VisualComparisonResult,
  UnmatchedRequirement,
  // VisualMismatch, — re-exported via contract
} from '../../core/contracts/comparison.contract'
import { v4 as uuidv4 } from 'uuid'

const logger = Logger.getLogger('bug-classifier')

/**
 * BugClassifier - Automatically classifies bugs into 4 categories
 * 
 * Categories:
 * - 需求缺失: PRD requirement not found in app
 * - 设计缺陷: Visual mismatch with design spec
 * - UX缺陷: Usability issue not covered by PRD/design
 * - 实现不一致: Behavior differs from PRD description
 */
export class BugClassifier extends EventEmitter {
  /**
   * Classify bugs from structural and visual comparison results
   */
  public async classify(
    structuralResult: StructuralComparisonResult,
    visualResult?: VisualComparisonResult
  ): Promise<BugClassificationResult> {
    logger.info('Starting bug classification')

    const bugs: BugEntry[] = []

    // Classify structural issues
    const structuralBugs = this.classifyStructuralIssues(structuralResult)
    bugs.push(...structuralBugs)

    // Classify visual issues
    if (visualResult) {
      const visualBugs = this.classifyVisualIssues(visualResult)
      bugs.push(...visualBugs)
    }

    const summary = this.buildSummary(bugs, structuralResult, visualResult)

    logger.info(
      `Bug classification complete: ${bugs.length} total bugs (${summary.bySeverity.P0} P0, ${summary.bySeverity.P1} P1)`
    )

    return { bugs, summary }
  }

  /**
   * Classify issues found during structural comparison
   */
  private classifyStructuralIssues(
    structuralResult: StructuralComparisonResult
  ): BugEntry[] {
    const bugs: BugEntry[] = []

    for (const unmatched of structuralResult.unmatchedRequirements) {
      const severity = this.determineSeverityForUnmatched(unmatched)
      const bugType = this.determineBugTypeForUnmatched(unmatched)

      const bug: BugEntry = {
        id: `BUG-${uuidv4().substr(0, 8)}`,
        type: bugType,
        severity,
        description: this.buildDescriptionForUnmatched(unmatched),
        reproSteps: this.buildReproStepsForUnmatched(unmatched),
        prdReference: unmatched.requirementId,
        evidenceRefs: [{
          source: 'structural',
          refId: unmatched.requirementId
        }],
        createdAt: new Date()
      }

      bugs.push(bug)
    }

    // Classify extra elements
    for (const extra of structuralResult.extraElements) {
      const bug: BugEntry = {
        id: `BUG-${uuidv4().substr(0, 8)}`,
        type: 'UX缺陷',
        severity: 'P2',
        description: `Extra UI element found: "${extra.elementName}" in activity "${extra.activity}" (category: ${extra.category}). This element is not documented in PRD.`,
        reproSteps: [
          `Navigate to activity: ${extra.activity}`,
          `Observe element: ${extra.elementName}`,
          `Verify element is not in PRD specification`
        ],
        pathId: extra.pathId,
        evidenceRefs: [{
          source: 'structural',
          refId: extra.pathId
        }],
        createdAt: new Date()
      }

      bugs.push(bug)
    }

    return bugs
  }

  /**
   * Classify issues found during visual comparison
   */
  private classifyVisualIssues(
    visualResult: VisualComparisonResult
  ): BugEntry[] {
    const bugs: BugEntry[] = []

    for (const mismatch of visualResult.mismatches) {
      const severity = this.mapVisualSeverityToBugSeverity(mismatch.severity)
      
      let bugType: BugType
      if (mismatch.severity === 'critical') {
        bugType = '设计缺陷'
      } else {
        bugType = '设计缺陷'
      }

      const bug: BugEntry = {
        id: `BUG-${uuidv4().substr(0, 8)}`,
        type: bugType,
        severity,
        description: `Visual mismatch on screen "${mismatch.screenName}": ${(mismatch.diffPercentage * 100).toFixed(1)}% pixel difference detected. Expected design does not match actual implementation.`,
        screenshotEvidence: mismatch.diffImagePath,
        reproSteps: [
          `Navigate to screen: ${mismatch.screenName}`,
          `Compare actual screen with design specification`,
          `Review diff image: ${mismatch.diffImagePath}`
        ],
        evidenceRefs: [{
          source: 'visual',
          refId: mismatch.screenName
        }],
        createdAt: new Date()
      }

      bugs.push(bug)
    }

    return bugs
  }

  /**
   * Determine bug type for an unmatched requirement
   */
  private determineBugTypeForUnmatched(unmatched: UnmatchedRequirement): BugType {
    switch (unmatched.reason) {
      case 'not_found':
        return '需求缺失'
      case 'partial_match':
        return '实现不一致'
      case 'wrong_state':
        return '实现不一致'
      default:
        return '需求缺失'
    }
  }

  /**
   * Determine severity for an unmatched requirement
   */
  private determineSeverityForUnmatched(unmatched: UnmatchedRequirement): BugSeverity {
    switch (unmatched.reason) {
      case 'not_found':
        return 'P1'
      case 'partial_match':
        return 'P2'
      case 'wrong_state':
        return 'P1'
      default:
        return 'P2'
    }
  }

  /**
   * Map visual severity to bug severity
   */
  private mapVisualSeverityToBugSeverity(
    visualSeverity: 'minor' | 'major' | 'critical'
  ): BugSeverity {
    switch (visualSeverity) {
      case 'critical':
        return 'P0'
      case 'major':
        return 'P1'
      case 'minor':
        return 'P2'
      default:
        return 'P2'
    }
  }

  /**
   * Build human-readable description for unmatched requirement
   */
  private buildDescriptionForUnmatched(unmatched: UnmatchedRequirement): string {
    let desc = `PRD requirement "${unmatched.requirementTitle}" (ID: ${unmatched.requirementId}) was not found in the app. `
    desc += `Reason: ${unmatched.reason}. `
    desc += `Searched activities: ${unmatched.searchedActivities.join(', ') || 'all'}.`
    return desc
  }

  /**
   * Build reproduction steps for unmatched requirement
   */
  private buildReproStepsForUnmatched(unmatched: UnmatchedRequirement): string[] {
    return [
      `Check PRD requirement: ${unmatched.requirementTitle}`,
      `Verify expected UI element: ${unmatched.expectedUI.element} (${unmatched.expectedUI.type})`,
      `Search in activities: ${unmatched.searchedActivities.join(', ') || 'all explored activities'}`,
      `Confirm element is missing or does not match specification`
    ]
  }

  /**
   * Build classification summary
   */
  private buildSummary(
    bugs: BugEntry[],
    structuralResult: StructuralComparisonResult,
    visualResult?: VisualComparisonResult
  ): BugClassificationSummary {
    const byType: Record<BugType, number> = {
      '需求缺失': 0,
      '设计缺陷': 0,
      'UX缺陷': 0,
      '实现不一致': 0
    }

    const bySeverity: Record<BugSeverity, number> = {
      'P0': 0,
      'P1': 0,
      'P2': 0,
      'P3': 0
    }

    for (const bug of bugs) {
      byType[bug.type] = (byType[bug.type] || 0) + 1
      bySeverity[bug.severity] = (bySeverity[bug.severity] || 0) + 1
    }

    return {
      totalBugs: bugs.length,
      byType,
      bySeverity,
      coverageRate: structuralResult.coverageRate,
      visualSimilarity: visualResult?.overallSimilarityScore || 1.0
    }
  }
}

export const bugClassifier = new BugClassifier()
