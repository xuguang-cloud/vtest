export interface ExplorationPath {
  pathId: string
  startActivity: string
  endActivity: string
  steps: ExplorationStep[]
  coverage: string[]
  reproducible: boolean
}

export interface ExplorationStep {
  action: 'click' | 'input' | 'scroll' | 'swipe' | 'back' | 'rotate'
  element?: string
  x?: number
  y?: number
  text?: string
  direction?: 'up' | 'down' | 'left' | 'right'
}

export interface ExplorationResult {
  appPackage: string
  explorationStart: string
  explorationEnd: string
  totalPaths: number
  paths: ExplorationPath[]
  coverageSummary: {
    totalActivities: number
    exploredActivities: number
    coverageRate: number
  }
}