/**
 * US-06: Structural Comparison Engine
 *
 * Compares exploration UI tree against PRD requirements
 * to identify missing, mismatched, and extra elements.
 */

import {
  StructuralComparisonResult,
  RequirementMatch,
  UnmatchedRequirement,
  ExtraUIElement,
  PRDRequirement,
  UIRequirement
} from '../contracts/comparison.contract'
import { ExplorationResult, ExplorationPath } from '../contracts/exploration.contract'

export class StructuralComparer {
  /**
   * Compare exploration result against structured PRD requirements.
   *
   * Algorithm:
   * 1. For each PRD requirement, scan all exploration paths for matching
   *    UI elements (by element name, type, and text).
   * 2. Calculate match confidence based on how many UI requirements
   *    within a PRD requirement are satisfied.
   * 3. Mark unmatched requirements with reason classification.
   * 4. Identify extra UI elements present in exploration but absent from PRD.
   */
  compare(
    explorationResult: ExplorationResult,
    prdRequirements: PRDRequirement[]
  ): StructuralComparisonResult {
    const matches: RequirementMatch[] = []
    const unmatched: UnmatchedRequirement[] = []
    const extraElements: ExtraUIElement[] = []

    // Collect all explored activities for reference
    const allActivities = this.collectActivities(explorationResult)
    // Collect all explored elements across all paths
    const exploredElements = this.collectExploredElements(explorationResult)

    for (const req of prdRequirements) {
      const result = this.matchRequirement(req, explorationResult, allActivities)

      if (result.confidence >= 0.6) {
        matches.push({
          requirementId: req.id,
          requirementTitle: req.title,
          matchedPathId: result.bestPathId,
          matchedActivity: result.bestActivity,
          matchConfidence: result.confidence
        })
      } else {
        unmatched.push({
          requirementId: req.id,
          requirementTitle: req.title,
          reason: result.confidence === 0 ? 'not_found' : 'partial_match',
          expectedUI: req.uiRequirements[0] || { element: '', type: '' },
          searchedActivities: allActivities
        })
      }
    }

    // Identify extra elements: explored elements not referenced in any PRD requirement
    const prdElementNames = new Set(
      prdRequirements.flatMap(r => r.uiRequirements.map(u => u.element))
    )
    for (const elem of exploredElements) {
      if (!prdElementNames.has(elem.name)) {
        extraElements.push({
          elementName: elem.name,
          activity: elem.activity,
          pathId: elem.pathId,
          category: this.classifyExtraElement(elem.name)
        })
      }
    }

    const matchedCount = matches.length
    const totalReqs = prdRequirements.length
    const coverageRate = totalReqs > 0 ? matchedCount / totalReqs : 0

    return {
      prdId: `structural-${Date.now()}`,
      coverageRate,
      matchedRequirements: matches,
      unmatchedRequirements: unmatched,
      extraElements
    }
  }

  private matchRequirement(
    req: PRDRequirement,
    result: ExplorationResult,
    allActivities: string[]
  ): { confidence: number; bestPathId: string; bestActivity: string } {
    let bestConfidence = 0
    let bestPathId = ''
    let bestActivity = ''

    // Check if requirement's expected screens are among explored activities
    const screenMatch = req.screens.some(s => allActivities.includes(s))

    // For each UI requirement, check if it appears in exploration paths
    const uiMatches = req.uiRequirements.map(uiReq => {
      return this.matchUIRequirement(uiReq, result)
    })

    const uiMatchRate = uiMatches.length > 0
      ? uiMatches.filter(m => m.matched).length / uiMatches.length
      : (screenMatch ? 1 : 0)

    // Find best matching path
    for (const path of result.paths) {
      const pathMatch = this.matchPathToRequirement(path, req)
      if (pathMatch.confidence > bestConfidence) {
        bestConfidence = pathMatch.confidence
        bestPathId = path.pathId
        bestActivity = path.endActivity
      }
    }

    // Combined confidence: UI element match + screen match
    const combinedConfidence = Math.max(
      uiMatchRate,
      bestConfidence,
      screenMatch ? 0.5 : 0
    )

    return {
      confidence: combinedConfidence,
      bestPathId: bestPathId || 'none',
      bestActivity: bestActivity || 'none'
    }
  }

  private matchUIRequirement(
    uiReq: UIRequirement,
    result: ExplorationResult
  ): { matched: boolean; pathId?: string } {
    for (const path of result.paths) {
      for (const step of path.steps) {
        // Match by element name, type, or text
        if (step.element === uiReq.element) return { matched: true, pathId: path.pathId }
        if (uiReq.text && step.text === uiReq.text) return { matched: true, pathId: path.pathId }
      }
    }
    return { matched: false }
  }

  private matchPathToRequirement(
    path: ExplorationPath,
    req: PRDRequirement
  ): { confidence: number } {
    // Check if path covers any of the requirement's expected screens
    const activityMatch = req.screens.some(s =>
      path.startActivity === s || path.endActivity === s
    )

    if (!activityMatch && req.expectedActivities) {
      const expectedMatch = req.expectedActivities.some(a =>
        path.startActivity === a || path.endActivity === a
      )
      if (!expectedMatch) return { confidence: 0 }
    }

    // Count how many UI requirements appear in this path's steps
    const uiHits = req.uiRequirements.filter(ui =>
      path.steps.some(step => step.element === ui.element)
    ).length

    const uiRate = req.uiRequirements.length > 0
      ? uiHits / req.uiRequirements.length
      : 0

    return { confidence: Math.max(activityMatch ? 0.5 : 0, uiRate) }
  }

  private collectActivities(result: ExplorationResult): string[] {
    const activities = new Set<string>()
    for (const path of result.paths) {
      activities.add(path.startActivity)
      activities.add(path.endActivity)
    }
    return Array.from(activities)
  }

  private collectExploredElements(
    result: ExplorationResult
  ): Array<{ name: string; activity: string; pathId: string }> {
    const elements: Array<{ name: string; activity: string; pathId: string }> = []
    for (const path of result.paths) {
      for (const step of path.steps) {
        if (step.element) {
          elements.push({
            name: step.element,
            activity: path.endActivity,
            pathId: path.pathId
          })
        }
      }
    }
    return elements
  }

  private classifyExtraElement(name: string): 'undocumented_feature' | 'debug_element' | 'internal_tool' {
    // Simple heuristic classification for extra UI elements
    if (name.startsWith('debug') || name.startsWith('test') || name.startsWith('dev'))
      return 'debug_element'
    if (name.startsWith('admin') || name.startsWith('internal') || name.startsWith('system'))
      return 'internal_tool'
    return 'undocumented_feature'
  }
}