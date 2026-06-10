/**
 * TestDataFactory — 测试数据工厂
 * 提供统一的数据构造方法，避免 mock 代码泄漏到生产环境
 */
import { ExplorationPath, ExplorationStep, ExplorationResult } from '../../main/core/contracts/exploration.contract'

export class TestDataFactory {
  /**
   * 生成模拟探索路径（仅测试使用）
   */
  static generateMockExplorationPath(depth: number): ExplorationPath {
    const stepCount = Math.min(depth + 2, 5)
    const steps: ExplorationStep[] = []

    for (let i = 0; i < stepCount; i++) {
      steps.push({
        action: 'click',
        element: `element_${depth}_${i}`,
        x: 100 + i * 50,
        y: 200 + i * 30
      })
    }

    return {
      pathId: `path-${depth}-${Date.now()}`,
      startActivity: 'MainActivity',
      endActivity: `Activity_${depth}`,
      steps,
      coverage: [`screen_${depth}`],
      reproducible: true
    }
  }

  /**
   * 生成模拟探索结果（仅测试使用）
   */
  static generateMockExplorationResult(pathCount: number): ExplorationResult {
    const paths: ExplorationPath[] = []
    for (let i = 0; i < pathCount; i++) {
      paths.push(this.generateMockExplorationPath(i))
    }
    return {
      appPackage: 'com.example.test',
      explorationStart: new Date().toISOString(),
      explorationEnd: new Date().toISOString(),
      totalPaths: paths.length,
      paths,
      coverageSummary: {
        totalActivities: pathCount + 1,
        exploredActivities: pathCount,
        coverageRate: pathCount > 0 ? (pathCount / (pathCount + 1)) * 100 : 0
      }
    }
  }
}