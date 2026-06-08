/**
 * UI Tree Node - Represents a UI element in the Android view hierarchy
 */
export interface UITreeNode {
  className: string
  bounds: { x: number; y: number; width: number; height: number }
  text: string
  clickable: boolean
  children: UITreeNode[]
  resourceId?: string
  contentDescription?: string
}

/**
 * Exploration Action - What the DFS explorer decides to do next
 */
export type ExplorationAction =
  | { type: 'CLICK'; target: UITreeNode; index: number }
  | { type: 'BACK' }
  | { type: 'STOP'; reason: string }

/**
 * Exploration Path Entry - Records a single step in the exploration
 */
export interface ExplorationPathEntry {
  fromActivity: string
  toActivity: string
  trigger: 'click' | 'back'
  element?: string
  screenshotPath?: string
  uiTreeHash: string
}
