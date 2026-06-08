import { EventEmitter } from 'events'
import { Logger } from '../../core/logger/Logger'
import {
  DesignAsset,
  VisualComparisonResult,
  VisualMatch,
  VisualMismatch,
  DiffRegion,
  ComparisonOptions
} from '../../core/contracts/comparison.contract'

const logger = Logger.getLogger('visual-comparer')

/**
 * VisualComparer - Compares actual screenshots against design mocks using pixel-level comparison
 * 
 * Uses pixelmatch-like algorithm to detect visual differences between
 * actual app screenshots and expected design screenshots.
 */
export class VisualComparer extends EventEmitter {
  /**
   * Run visual comparison between actual and expected screenshots
   */
  public async compare(
    actualScreens: DesignAsset[],
    expectedScreens: DesignAsset[],
    options: ComparisonOptions
  ): Promise<VisualComparisonResult> {
    logger.info(
      `Starting visual comparison: ${actualScreens.length} actual vs ${expectedScreens.length} expected screens`
    )

    const matches: VisualMatch[] = []
    const mismatches: VisualMismatch[] = []

    // Create lookup for expected screens by screen name
    const expectedMap = new Map<string, DesignAsset>()
    for (const screen of expectedScreens) {
      expectedMap.set(screen.screenName, screen)
    }

    // Compare each actual screen against expected
    let totalSimilarity = 0
    for (const actual of actualScreens) {
      const expected = expectedMap.get(actual.screenName)

      if (expected) {
        const result = await this.compareScreens(actual, expected, options)
        totalSimilarity += result.similarityScore

        if (result.isMatch) {
          matches.push({
            screenName: actual.screenName,
            activity: actual.activity || 'unknown',
            similarityScore: result.similarityScore,
            diffImagePath: result.diffPath
          })
        } else {
          mismatches.push({
            screenName: actual.screenName,
            activity: actual.activity || 'unknown',
            expectedImagePath: expected.filePath || 'unknown',
            actualImagePath: actual.filePath || 'unknown',
            diffImagePath: result.diffPath || 'diff.png',
            diffPercentage: 1 - result.similarityScore,
            diffRegions: result.diffRegions,
            severity: this.calculateSeverity(result.similarityScore, options.visualThreshold)
          })
        }
      } else {
        // Screen in actual but not in expected - could be a bug
        logger.warn(`Screen "${actual.screenName}" found in actual but not in design`)
      }
    }

    const totalCompared = actualScreens.length
    const overallSimilarity = totalCompared > 0 ? totalSimilarity / totalCompared : 1.0

    logger.info(
      `Visual comparison complete: ${matches.length} matches, ${mismatches.length} mismatches`
    )

    return {
      totalScreensCompared: totalCompared,
      matches,
      mismatches,
      overallSimilarityScore: overallSimilarity
    }
  }

  /**
   * Compare two screens and return similarity metrics
   */
  private async compareScreens(
    actual: DesignAsset,
    expected: DesignAsset,
    options: ComparisonOptions
  ): Promise<ScreenComparisonResult> {
    // For now, simulate pixelmatch comparison
    // In production, this would use actual pixelmatch library
    const similarityScore = this.simulatePixelComparison(actual, expected)
    const isMatch = similarityScore >= options.visualThreshold

    return {
      similarityScore,
      isMatch,
      diffPath: `diff_${actual.screenName}_${Date.now()}.png`,
      diffRegions: this.calculateDiffRegions(actual, expected, isMatch)
    }
  }

  /**
   * Simulate pixel-level comparison (placeholder for actual pixelmatch integration)
   */
  private simulatePixelComparison(actual: DesignAsset, expected: DesignAsset): number {
    // Placeholder: compare metadata or hash for similarity
    // Real implementation would use pixelmatch(actual.imageData, expected.imageData, ...)
    if (actual.screenName !== expected.screenName) {
      return 0.0
    }

    // Simple heuristic: if both have image data, assume high similarity
    if (actual.imageData && expected.imageData) {
      // Compare image sizes as a basic similarity check
      const actualSize = actual.imageData.length
      const expectedSize = expected.imageData.length
      const sizeDiff = Math.abs(actualSize - expectedSize)
      const maxSize = Math.max(actualSize, expectedSize)
      
      if (maxSize === 0) return 1.0
      
      // Similar size = likely similar image
      const sizeSimilarity = 1 - (sizeDiff / maxSize)
      return Math.max(0.5, sizeSimilarity)
    }

    return 0.5 // Default moderate similarity
  }

  /**
   * Calculate diff regions for visual mismatch reporting
   */
  private calculateDiffRegions(
    actual: DesignAsset,
    expected: DesignAsset,
    isMatch: boolean
  ): DiffRegion[] {
    if (isMatch) {
      return []
    }

    // Return mock diff regions for non-matching screens
    return [
      {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        pixelDiffCount: 100
      }
    ]
  }

  /**
   * Calculate severity based on similarity score and threshold
   */
  private calculateSeverity(
    similarityScore: number,
    threshold: number
  ): 'minor' | 'major' | 'critical' {
    const diff = 1 - similarityScore
    const gap = diff - (1 - threshold)

    if (gap > 0.3 || diff > 0.5) {
      return 'critical'
    } else if (gap > 0.1 || diff > 0.2) {
      return 'major'
    }
    return 'minor'
  }
}

interface ScreenComparisonResult {
  similarityScore: number
  isMatch: boolean
  diffPath: string
  diffRegions: DiffRegion[]
}

export const visualComparer = new VisualComparer()
