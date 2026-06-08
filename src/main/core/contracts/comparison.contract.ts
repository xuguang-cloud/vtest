export interface BugEntry {
  id: string
  type: '需求缺失' | '设计缺陷' | 'UX缺陷' | '实现不一致'
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  description: string
  screenshotEvidence?: string
  reproSteps: string[]
  prdReference?: string
  pathId?: string
}

export interface PRDRequirement {
  id: string
  title: string
  priority: string
  acceptanceCriteria: string[]
  uiRequirements: UIRequirement[]
  screens: string[]
}

export interface UIRequirement {
  element: string
  type: string
  color?: string
  text?: string
  placeholder?: string
}

export interface ComparisonResult {
  prdId: string
  coverageRate: number
  bugs: BugEntry[]
  matchedRequirements: string[]
  unmatchedRequirements: string[]
}