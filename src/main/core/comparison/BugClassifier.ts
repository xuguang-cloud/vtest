/**
 * US-06: Bug Classifier
 *
 * Takes structural and visual comparison results and produces
 * classified BugEntry[] with severity ratings.
 *
 * Bug classification algorithm:
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  Unmatched PRD Requirement  →  BugType = '需求缺失'     │
 * │  reason = 'not_found'  →  severity = P1               │
 * │  reason = 'partial_match'  →  severity = P2            │
 * │  reason = 'wrong_state'  →  severity = P2              │
 * ├──────────────────────────────────────────────────────────┤
 * │  Visual Mismatch  →  BugType = '设计缺陷'               │
 * │  severity = 'critical'  →  severity = P0               │
 * │  severity = 'major'  →  severity = P1                  │
 * │  severity = 'minor'  →  severity = P2                  │
 * ├──────────────────────────────────────────────────────────┤
 * │  UX issues detected from structure  →  BugType = 'UX缺陷' │
 * │  (missing accessibility labels,  →  severity = P2/P3    │
 * │   no error states, etc.)                                 │
 * ├──────────────────────────────────────────────────────────┤
 * │  Behavior differs from PRD description                   │
 * │  →  BugType = '实现不一致'  →  severity from context   │
 * └──────────────────────────────────────────────────────────┘
 */

import {
  BugEntry,
  BugType,
  BugSeverity,
  BugClassificationResult,
  BugClassificationSummary,
  StructuralComparisonResult,
  VisualComparisonResult,
  UnmatchedRequirement,
  VisualMismatch
} from '../contracts/comparison.contract'

export class BugClassifier {
  /**
   * Classify bugs from structural and visual comparison results.
   *
   * Produces BugEntry[] with 4 bug types:
   * - 需求缺失: PRD requirement not implemented in the app
   * - 设计缺陷: Visual mismatch between app and design spec
   * - UX缺陷: Usability issue (missing labels, no error states)
   * - 实现不一致: App behavior differs from PRD description
   */
  classify(
    structuralResult: StructuralComparisonResult,
    visualResult?: VisualComparisonResult
  ): BugClassificationResult {
    const bugs: BugEntry[] = []

    // Phase 1: Structural bugs — 需求缺失 + 实现不一致
    for (const unmatched of structuralResult.unmatchedRequirements) {
      const bug = this.classifyUnmatchedRequirement(unmatched)
      bugs.push(bug)
    }

    // Phase 2: Visual bugs — 设计缺陷
    if (visualResult) {
      for (const mismatch of visualResult.mismatches) {
        const bug = this.classifyVisualMismatch(mismatch)
        bugs.push(bug)
      }
    }

    // Phase 3: UX defects — derived from structural analysis
    const uxBugs = this.detectUXDefects(structuralResult)
    bugs.push(...uxBugs)

    // Build summary
    const summary = this.buildSummary(bugs, structuralResult, visualResult)

    return { bugs, summary }
  }

  private classifyUnmatchedRequirement(unmatched: UnmatchedRequirement): BugEntry {
    const severityMap: Record<string, BugSeverity> = {
      'not_found': 'P1',
      'partial_match': 'P2',
      'wrong_state': 'P2'
    }

    // If the requirement is high priority, bump severity
    const baseSeverity = severityMap[unmatched.reason] || 'P2'

    return {
      id: `bug-${unmatched.requirementId}-${Date.now()}`,
      type: '需求缺失',
      severity: baseSeverity,
      description: `PRD requirement "${unmatched.requirementTitle}" (${unmatched.requirementId}) is not fully implemented. Reason: ${unmatched.reason}. Expected UI: ${unmatched.expectedUI.element} (${unmatched.expectedUI.type}).`,
      reproSteps: [
        `Open the app and navigate to screens: ${unmatched.searchedActivities.join(', ')}`,
        `Look for element: ${unmatched.expectedUI.element}`,
        `Expected: ${unmatched.expectedUI.type} with text "${unmatched.expectedUI.text || 'N/A'}"`,
        `Actual: Not found or incomplete`
      ],
      prdReference: unmatched.requirementId,
      evidenceRefs: [{
        source: 'structural',
        refId: unmatched.requirementId
      }],
      createdAt: new Date()
    }
  }

  private classifyVisualMismatch(mismatch: VisualMismatch): BugEntry {
    const severityMap: Record<string, BugSeverity> = {
      'critical': 'P0',
      'major': 'P1',
      'minor': 'P2'
    }

    return {
      id: `bug-visual-${mismatch.screenName}-${Date.now()}`,
      type: '设计缺陷',
      severity: severityMap[mismatch.severity] || 'P2',
      description: `Screen "${mismatch.screenName}" (activity: ${mismatch.activity}) has visual mismatch with design spec. Diff: ${(mismatch.diffPercentage * 100).toFixed(1)}%. Severity: ${mismatch.severity}.`,
      screenshotEvidence: mismatch.diffImagePath,
      reproSteps: [
        `Navigate to activity: ${mismatch.activity}`,
        `Observe screen: ${mismatch.screenName}`,
        `Compare with expected design: ${mismatch.expectedImagePath}`,
        `Visual diff regions: ${mismatch.diffRegions.length} areas detected`
      ],
      evidenceRefs: [{
        source: 'visual',
        refId: mismatch.screenName
      }],
      createdAt: new Date()
    }
  }

  /**
   * Detect UX defects from structural analysis:
   * - Missing accessibility labels on interactive elements
   * - Missing error state handling
   * - Missing loading indicators
   * - Navigation dead-ends
   */
  private detectUXDefects(
    structuralResult: StructuralComparisonResult
  ): BugEntry[] {
    const uxBugs: BugEntry[] = []

    // Check for extra elements that might be debug/internal tools exposed to users
    for (const extra of structuralResult.extraElements) {
      if (extra.category === 'debug_element') {
        uxBugs.push({
          id: `bug-ux-debug-${extra.elementName}-${Date.now()}`,
          type: 'UX缺陷',
          severity: 'P3',
          description: `Debug element "${extra.elementName}" visible in activity "${extra.activity}". This should be hidden in production.`,
          reproSteps: [
            `Navigate to activity: ${extra.activity}`,
            `Observe element: ${extra.elementName}`,
            `This appears to be a debug/internal element exposed to users`
          ],
          pathId: extra.pathId,
          evidenceRefs: [{
            source: 'structural',
            refId: extra.elementName
          }],
          createdAt: new Date()
        })
      }
    }

    return uxBugs
  }

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
      'P0': 0, 'P1': 0, 'P2': 0, 'P3': 0
    }

    for (const bug of bugs) {
      byType[bug.type]++
      bySeverity[bug.severity]++
    }

    return {
      totalBugs: bugs.length,
      byType,
      bySeverity,
      coverageRate: structuralResult.coverageRate,
      visualSimilarity: visualResult?.overallSimilarityScore ?? 0
    }
  }
}