import { EventEmitter } from 'events'
import {
  ExplorationResult,
  ExplorationPath
} from '../../core/contracts/exploration.contract'
import {
  PRDRequirement,
  StructuralComparisonResult,
  RequirementMatch,
  UnmatchedRequirement,
  ExtraUIElement
} from '../../core/contracts/comparison.contract'
import { Logger } from '../../core/logger/Logger'

const logger = Logger.getLogger('structural-comparer')

/**
 * StructuralComparer - Compares PRD requirements against exploration results
 * 
 * Matches PRD requirements to actual UI elements found during exploration,
 * identifying requirements that are met, missing, or partially implemented.
 */
export class StructuralComparer extends EventEmitter {
  /**
   * Run structural comparison between PRD requirements and exploration results
   */
  public async compare(
    explorationResult: ExplorationResult,
    prdRequirements: PRDRequirement[]
  ): Promise<StructuralComparisonResult> {
    logger.info(
      `Starting structural comparison: ${prdRequirements.length} requirements vs ${explorationResult.paths.length} paths`
    )

    const matchedRequirements: RequirementMatch[] = []
    const unmatchedRequirements: UnmatchedRequirement[] = []
    const extraElements: ExtraUIElement[] = []

    // Build activity index from exploration paths
    const activityMap = this.buildActivityMap(explorationResult)

    // Match each PRD requirement against exploration
    for (const req of prdRequirements) {
      const match = this.findRequirementMatch(req, explorationResult, activityMap)

      if (match) {
        matchedRequirements.push(match)
      } else {
        unmatchedRequirements.push({
          requirementId: req.id,
          requirementTitle: req.title,
          reason: 'not_found',
          expectedUI: req.uiRequirements[0] || { element: 'unknown', type: 'unknown' },
          searchedActivities: Array.from(activityMap.keys())
        })
      }
    }

    // Find extra UI elements not in PRD
    const extra = this.findExtraElements(explorationResult, prdRequirements)
    extraElements.push(...extra)

    const coverageRate = prdRequirements.length > 0
      ? matchedRequirements.length / prdRequirements.length
      : 0

    logger.info(
      `Structural comparison complete: ${matchedRequirements.length} matched, ${unmatchedRequirements.length} unmatched`
    )

    return {
      prdId: 'structural-comparison',
      coverageRate,
      matchedRequirements,
      unmatchedRequirements,
      extraElements
    }
  }

  /**
   * Build a map of activities discovered during exploration
   */
  private buildActivityMap(
    explorationResult: ExplorationResult
  ): Map<string, ExplorationPath[]> {
    const map = new Map<string, ExplorationPath[]>()

    for (const path of explorationResult.paths) {
      const key = path.startActivity
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(path)
    }

    return map
  }

  /**
   * Find a match for a PRD requirement in the exploration results
   */
  private findRequirementMatch(
    requirement: PRDRequirement,
    explorationResult: ExplorationResult,
    activityMap: Map<string, ExplorationPath[]>
  ): RequirementMatch | null {
    // Check if any of the requirement's expected activities were explored
    const expectedActivities = requirement.expectedActivities || requirement.screens

    for (const activity of expectedActivities) {
      const paths = activityMap.get(activity)
      if (paths && paths.length > 0) {
        // Found a match - requirement is present in the app
        return {
          requirementId: requirement.id,
          requirementTitle: requirement.title,
          matchedPathId: paths[0].pathId,
          matchedActivity: activity,
          matchConfidence: this.calculateMatchConfidence(requirement, paths[0])
        }
      }
    }

    // Try fuzzy matching on all activities
    for (const activity of Array.from(activityMap.keys())) {
      const paths = activityMap.get(activity)!
      for (const screen of requirement.screens) {
        if (this.isSimilar(activity, screen)) {
          return {
            requirementId: requirement.id,
            requirementTitle: requirement.title,
            matchedPathId: paths[0].pathId,
            matchedActivity: activity,
            matchConfidence: 0.7 // Partial match
          }
        }
      }
    }

    return null
  }

  /**
   * Calculate confidence score for a requirement match
   */
  private calculateMatchConfidence(
    requirement: PRDRequirement,
    path: ExplorationPath
  ): number {
    let score = 0.5 // Base score for finding the activity

    // Boost score if UI requirements are present
    if (requirement.uiRequirements && requirement.uiRequirements.length > 0) {
      score += 0.2
    }

    // Boost if acceptance criteria exist
    if (requirement.acceptanceCriteria && requirement.acceptanceCriteria.length > 0) {
      score += 0.1
    }

    // Boost if the path is reproducible
    if (path.reproducible) {
      score += 0.2
    }

    return Math.min(score, 1.0)
  }

  /**
   * Check if two strings are similar (fuzzy matching)
   */
  private isSimilar(a: string, b: string): boolean {
    const aLower = a.toLowerCase()
    const bLower = b.toLowerCase()
    return aLower.includes(bLower) || bLower.includes(aLower)
  }

  /**
   * Find UI elements that exist in the app but are not in PRD
   */
  private findExtraElements(
    explorationResult: ExplorationResult,
    prdRequirements: PRDRequirement[]
  ): ExtraUIElement[] {
    const extras: ExtraUIElement[] = []
    const prdElements = new Set<string>()

    // Collect all elements mentioned in PRD
    for (const req of prdRequirements) {
      for (const ui of req.uiRequirements || []) {
        prdElements.add(ui.element.toLowerCase())
      }
    }

    // Find elements in exploration that aren't in PRD
    for (const path of explorationResult.paths) {
      for (const step of path.steps) {
        if (step.element && !prdElements.has(step.element.toLowerCase())) {
          extras.push({
            elementName: step.element,
            activity: path.startActivity,
            pathId: path.pathId,
            category: 'undocumented_feature'
          })
        }
      }
    }

    return extras
  }
}

export const structuralComparer = new StructuralComparer()
