import { ExplorationPath, ExplorationResult } from '../contracts/exploration.contract'
import { StateMachine } from './StateMachine'
import { DFSExplorer } from './DFSExplorer'
import { UITreeNode } from './types'

export interface ExplorationOptions {
  maxDepth: number
  maxSteps: number
  maxTime: number
  maxNodes: number
}

/**
 * ExplorationEngine - Orchestrates the DFS-based app exploration.
 *
 * Uses StateMachine for lifecycle management and DFSExplorer for
 * the actual depth-first traversal strategy.
 */
export class ExplorationEngine {
  private stateMachine: StateMachine
  private dfsExplorer: DFSExplorer
  private history: { state: string; timestamp: number }[] = []
  private paths: ExplorationPath[] = []
  private visitedNodes: Set<string> = new Set()
  private options: ExplorationOptions = { maxDepth: 20, maxSteps: 1000, maxTime: 60000, maxNodes: 1000 }
  private startTime: number = 0
  private totalActivities: number = 0

  constructor() {
    this.stateMachine = new StateMachine()
    this.dfsExplorer = new DFSExplorer()
  }

  getCurrentState(): string {
    return this.stateMachine.getCurrentState()
  }

  getHistory() {
    return [...this.history]
  }

  getVisitedNodes(): number {
    return this.visitedNodes.size
  }

  getPaths(): ExplorationPath[] {
    return [...this.paths]
  }

  addPath(path: ExplorationPath): void {
    this.paths.push(path)
  }

  /**
   * Transition the state machine.
   */
  transition(to: 'IDLE' | 'INIT' | 'EXPLORING' | 'COMPARING' | 'GENERATING' | 'DONE' | 'ERROR'): void {
    this.stateMachine.transition(to)
    this.history.push({ state: to, timestamp: Date.now() })
  }

  /**
   * Initialize exploration with a starting UI tree.
   */
  initialize(uiTree: UITreeNode, activityName: string = 'unknown'): void {
    this.transition('INIT')
    this.dfsExplorer.initialize(uiTree, activityName)
    this.visitedNodes.add(this.hashTree(uiTree))
    this.transition('EXPLORING')
  }

  /**
   * Perform a single DFS step.
   * @param uiTree - current UI tree
   * @param activityName - current activity name
   * @returns action to perform
   */
  step(uiTree: UITreeNode, activityName: string = 'unknown'): import('./types').ExplorationAction {
    const treeHash = this.hashTree(uiTree)
    this.visitedNodes.add(treeHash)
    return this.dfsExplorer.step(uiTree, activityName)
  }

  /**
   * Explore the app starting from a given UI tree.
   */
  explore(options: Partial<ExplorationOptions> = {}): ExplorationResult {
    this.options = { ...this.options, ...options }
    this.startTime = Date.now()

    const result: ExplorationResult = {
      appPackage: 'com.example.app',
      explorationStart: new Date(this.startTime).toISOString(),
      explorationEnd: new Date().toISOString(),
      totalPaths: this.paths.length,
      paths: [...this.paths],
      coverageSummary: {
        totalActivities: this.totalActivities,
        exploredActivities: this.dfsExplorer.getVisitedActivities().size,
        coverageRate: this.totalActivities > 0
          ? (this.dfsExplorer.getVisitedActivities().size / this.totalActivities) * 100
          : 0
      }
    }

    return result
  }

  addNode(nodeId: string): void {
    this.visitedNodes.add(nodeId)
  }

  hasVisited(nodeId: string): boolean {
    return this.visitedNodes.has(nodeId)
  }

  reset(): void {
    this.stateMachine.reset()
    this.dfsExplorer.reset()
    this.history = []
    this.paths = []
    this.visitedNodes.clear()
    this.startTime = 0
  }

  private hashTree(uiTree: UITreeNode): string {
    // Simple hash for visited nodes tracking
    const { TreeHasher } = require('./TreeHasher')
    return TreeHasher.hash(uiTree)
  }
}
