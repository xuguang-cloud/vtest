/**
 * ExplorationOrchestrator — ties together the full exploration pipeline:
 *   APK install → dump UI → DFS explore → checkpoint → report
 */
import { ADBAdapter } from '../adb/ADBAdapter'
import { ADBUITreeProvider } from './ADBUITreeProvider'
import { DFSExplorer } from './DFSExplorer'
import { CheckpointManager, ExplorationSnapshot } from '../resilience/CheckpointManager'
import { UITreeNode, ExplorationAction } from './types'
import { ExplorationPath } from '../contracts/exploration.contract'
import { TreeHasher } from './TreeHasher'
import { Logger } from '../logger/Logger'

const logger = Logger.getLogger('orchestrator')

export interface OrchestratorConfig {
  apkPath: string
  packageName: string
  activityName?: string
  maxDepth: number
  maxSteps: number
  maxTime: number
  checkpointInterval: number
}

export interface ExplorationSessionResult {
  paths: ExplorationPath[]
  totalSteps: number
  visitedActivities: Map<string, number>
  coverageRate: number
  startTime: number
  endTime: number
  checkpoints: number
}

export class ExplorationOrchestrator {
  private adb: ADBAdapter
  private treeProvider: ADBUITreeProvider
  explorer: DFSExplorer
  private checkpointManager: CheckpointManager
  private runId: string
  private config: OrchestratorConfig

  constructor(
    adb: ADBAdapter,
    config: OrchestratorConfig,
    runId: string = `run-${Date.now()}`
  ) {
    this.adb = adb
    this.config = config
    this.runId = runId
    this.treeProvider = new ADBUITreeProvider(adb)
    this.explorer = new DFSExplorer({ maxDepth: config.maxDepth, maxSteps: config.maxSteps, maxTime: config.maxTime })
    this.checkpointManager = new CheckpointManager()
  }

  async run(): Promise<ExplorationSessionResult> {
    const startTime = Date.now()
    let checkpointCount = 0
    const paths: ExplorationPath[] = []

    logger.info(`Installing APK: ${this.config.apkPath}`)
    await this.adb.installAPK(this.config.apkPath)
    logger.info(`Launching: ${this.config.packageName}`)
    await this.adb.launchApp(this.config.packageName, this.config.activityName)
    await this.delay(2000)

    const initialTree = await this.treeProvider.dumpUITree()
    const initialActivity = 'MainActivity'
    this.explorer.initialize(initialTree, initialActivity)

    let currentTree = initialTree
    let currentActivity = initialActivity

    while (true) {
      if (this.explorer.getStepCount() > 0 && this.explorer.getStepCount() % this.config.checkpointInterval === 0) {
        await this.saveCheckpoint(currentTree, currentActivity)
        checkpointCount++
      }

      const action = this.explorer.step(currentTree, currentActivity)

      if (action.type === 'STOP') {
        logger.info(`Exploration complete: ${(action as any).reason}`)
        break
      }

      await this.executeAction(action)

      const hash = TreeHasher.hash(currentTree)

      paths.push({
        pathId: `path-${this.explorer.getStepCount()}`,
        startActivity: currentActivity,
        endActivity: currentActivity,
        steps: [
          {
            action: 'click',
            element: action.target?.text || action.target?.resourceId || '',
            x: action.target ? action.target.bounds.x + action.target.bounds.width / 2 : 0,
            y: action.target ? action.target.bounds.y + action.target.bounds.height / 2 : 0
          }
        ],
        coverage: [currentActivity],
        reproducible: true
      } as ExplorationPath)

      await this.delay(500)

      currentTree = await this.treeProvider.dumpUITree()
    }

    await this.adb.forceStopApp(this.config.packageName)

    return {
      paths,
      totalSteps: this.explorer.getStepCount(),
      visitedActivities: this.explorer.getVisitedActivities(),
      coverageRate: this.explorer.getVisitedActivities().size > 0 ? 1 : 0,
      startTime,
      endTime: Date.now(),
      checkpoints: checkpointCount
    }
  }

  private async executeAction(action: ExplorationAction): Promise<void> {
    switch (action.type) {
      case 'CLICK':
        if (action.target) {
          const cx = action.target.bounds.x + action.target.bounds.width / 2
          const cy = action.target.bounds.y + action.target.bounds.height / 2
          await this.adb.tapAt(cx, cy)
        }
        break
      case 'BACK':
        await this.adb.pressBack()
        break
      default:
        logger.warn(`Unknown action: ${action.type}`)
    }
  }

  private async saveCheckpoint(tree: UITreeNode, activityName: string): Promise<void> {
    try {
      const hash = TreeHasher.hash(tree)
      const snapshot: ExplorationSnapshot = {
        stepIndex: this.explorer.getStepCount(),
        activityName,
        uiTreeHash: hash,
        dfsStack: [hash, ...Array.from(this.explorer.getVisitedHashes())],
        visitedHashes: Array.from(this.explorer.getVisitedHashes())
      }
      await this.checkpointManager.saveCheckpoint(this.runId, snapshot)
      logger.debug(`Checkpoint saved at step ${snapshot.stepIndex}`)
    } catch (err: any) {
      logger.error(`Checkpoint save failed: ${err.message}`)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}