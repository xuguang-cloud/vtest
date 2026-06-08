import { EventEmitter } from 'events'
import { UITreeNode, ExplorationAction } from './types'
import { TreeHasher } from './TreeHasher'
import { Logger } from '../logger/Logger'

const logger = Logger.getLogger('exploration')

export interface DFSExplorerConfig {
  maxDepth: number
  maxSteps: number
  maxTime: number // milliseconds
}

export const DEFAULT_DFS_CONFIG: DFSExplorerConfig = {
  maxDepth: 20,
  maxSteps: 1000,
  maxTime: 60000
}

interface DFSFrame {
  treeHash: string
  interactableElements: UITreeNode[]
  nextElementIndex: number
}

/**
 * DFS Explorer - Depth-first search traversal of Android UI.
 *
 * Maintains:
 * - dfsStack: current exploration path stack
 * - visitedHashes: Set<string> for UI tree hash deduplication
 * - visitedActivities: Map<string, number> for activity visit counting
 */
export class DFSExplorer extends EventEmitter {
  private dfsStack: DFSFrame[] = []
  private visitedHashes: Set<string> = new Set()
  private visitedActivities: Map<string, number> = new Map()
  private stepCount: number = 0
  private startTime: number = 0
  private config: DFSExplorerConfig
  private initialized: boolean = false

  constructor(config: Partial<DFSExplorerConfig> = {}) {
    super()
    this.config = { ...DEFAULT_DFS_CONFIG, ...config }
  }

  getStack(): DFSFrame[] {
    return [...this.dfsStack]
  }

  getVisitedHashes(): Set<string> {
    return new Set(this.visitedHashes)
  }

  getVisitedActivities(): Map<string, number> {
    return new Map(this.visitedActivities)
  }

  getStepCount(): number {
    return this.stepCount
  }

  /**
   * Reset the explorer state.
   */
  reset(): void {
    this.dfsStack = []
    this.visitedHashes.clear()
    this.visitedActivities.clear()
    this.stepCount = 0
    this.startTime = 0
    this.initialized = false
    this.emit('reset')
  }

  /**
   * Initialize the explorer with a starting UI tree.
   */
  initialize(uiTree: UITreeNode, activityName: string = 'unknown'): void {
    this.reset()
    this.startTime = Date.now()
    this.initialized = true
    this.recordVisit(activityName, uiTree)
    this.emit('initialize', { activityName, treeHash: TreeHasher.hash(uiTree) })
  }

  /**
   * Core DFS step: decide the next action based on current UI tree.
   * @param uiTree - the current UI tree snapshot
   * @param activityName - current activity name for tracking
   * @returns ExplorationAction indicating what to do next
   */
  step(uiTree: UITreeNode, activityName: string = 'unknown'): ExplorationAction {
    this.stepCount++

    // Boundary: max steps
    if (this.stepCount >= this.config.maxSteps) {
      return { type: 'STOP', reason: `Max steps reached (${this.config.maxSteps})` }
    }

    // Boundary: max time
    if (Date.now() - this.startTime > this.config.maxTime) {
      return { type: 'STOP', reason: `Max time reached (${this.config.maxTime}ms)` }
    }

    // If we've backtracked to root and stack is empty, exploration complete
    if (!this.initialized) {
      return { type: 'STOP', reason: 'Not initialized' }
    }

    const currentHash = TreeHasher.hash(uiTree)
    this.visitedHashes.add(currentHash)

    // Record activity visit
    this.recordVisit(activityName, uiTree)

    // Extract all clickable elements
    const elements = this.extractClickableElements(uiTree)

    // Check if this is a new page we haven't seen before in this branch
    const topFrame = this.dfsStack.length > 0 ? this.dfsStack[this.dfsStack.length - 1] : null
    let currentFrame: DFSFrame

    if (this.dfsStack.length === 0) {
      return { type: 'STOP', reason: 'DFS complete - all paths explored' }
    }

    if (!topFrame || topFrame.treeHash !== currentHash) {
      // Boundary: max depth - only check when pushing a new frame
      if (this.dfsStack.length >= this.config.maxDepth) {
        return { type: 'STOP', reason: `Max depth reached (${this.config.maxDepth})` }
      }

      currentFrame = {
        treeHash: currentHash,
        interactableElements: elements,
        nextElementIndex: 0
      }
      this.dfsStack.push(currentFrame)
    } else {
      currentFrame = topFrame
    }

    // Find next unvisited clickable element (deep first)
    while (currentFrame.nextElementIndex < currentFrame.interactableElements.length) {
      const element = currentFrame.interactableElements[currentFrame.nextElementIndex]
      currentFrame.nextElementIndex++

      return { type: 'CLICK', target: element, index: currentFrame.nextElementIndex - 1 }
    }

    // All elements on this page visited → backtrack
    this.dfsStack.pop()

    return { type: 'BACK' }
  }

  /**
   * Record an activity visit, incrementing the counter.
   */
  private recordVisit(activityName: string, uiTree: UITreeNode): void {
    const count = this.visitedActivities.get(activityName) ?? 0
    this.visitedActivities.set(activityName, count + 1)
  }

  /**
   * Extract all clickable elements from the UI tree (depth-first order).
   */
  private extractClickableElements(node: UITreeNode): UITreeNode[] {
    const result: UITreeNode[] = []
    this.traverseClickable(node, result)
    return result
  }

  private traverseClickable(node: UITreeNode, result: UITreeNode[]): void {
    if (node.clickable) {
      result.push(node)
    }
    for (const child of node.children ?? []) {
      this.traverseClickable(child, result)
    }
  }
}
