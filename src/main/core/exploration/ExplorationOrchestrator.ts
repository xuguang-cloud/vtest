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
import * as path from 'path'

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
  error?: string
}

const MAX_CONSECUTIVE_CHECKPOINT_FAILURES = 3

export class ExplorationOrchestrator {
  private adb: ADBAdapter
  private treeProvider: ADBUITreeProvider
  private explorer: DFSExplorer
  private checkpointManager: CheckpointManager
  private runId: string
  private config: OrchestratorConfig

  constructor(
    adb: ADBAdapter,
    config: OrchestratorConfig,
    runId: string = `run-${Date.now()}`,
    checkpointManager?: CheckpointManager
  ) {
    this.adb = adb
    this.config = config
    this.runId = runId
    this.treeProvider = new ADBUITreeProvider(adb)
    this.explorer = new DFSExplorer({ maxDepth: config.maxDepth, maxSteps: config.maxSteps, maxTime: config.maxTime })
    this.checkpointManager = checkpointManager || new CheckpointManager()
  }

  async run(): Promise<ExplorationSessionResult> {
    const startTime = Date.now()
    let checkpointCount = 0
    let consecutiveCheckpointFailures = 0
    const paths: ExplorationPath[] = []

    try {
      // Validate APK path
      if (!this.config.apkPath.toLowerCase().endsWith('.apk')) {
        return { paths: [], totalSteps: 0, visitedActivities: new Map(), coverageRate: 0, startTime, endTime: Date.now(), checkpoints: 0, error: 'Invalid APK file: must end with .apk' }
      }
      if (this.config.apkPath.includes('..')) {
        return { paths: [], totalSteps: 0, visitedActivities: new Map(), coverageRate: 0, startTime, endTime: Date.now(), checkpoints: 0, error: 'Invalid APK path: path traversal detected' }
      }

      // Check device connection
      const connected = await this.adb.isDeviceConnected()
      if (!connected) {
        return { paths: [], totalSteps: 0, visitedActivities: new Map(), coverageRate: 0, startTime, endTime: Date.now(), checkpoints: 0, error: 'Device not connected' }
      }

      // Resolve real main activity if not provided
      const activity = this.config.activityName || await this.getMainActivity()

      logger.info(`Installing APK: ${this.config.apkPath}`)
      await this.adb.installAPK(this.config.apkPath)
      logger.info(`Launching: ${this.config.packageName}/${activity}`)
      await this.adb.launchApp(this.config.packageName, activity)
      await this.waitForUIChange(2000)

      const initialTree = await this.treeProvider.dumpUITree()
      this.explorer.initialize(initialTree, activity)

      let currentTree = initialTree
      let currentActivity = activity

      while (true) {
        if (this.explorer.getStepCount() > 0 && this.explorer.getStepCount() % this.config.checkpointInterval === 0) {
          const saved = await this.checkpointManager.saveCheckpoint(this.runId, {
            stepIndex: this.explorer.getStepCount(),
            activityName: currentActivity,
            uiTreeHash: TreeHasher.hash(currentTree),
            dfsStack: Array.from(this.explorer.getVisitedHashes()),
            visitedHashes: Array.from(this.explorer.getVisitedHashes())
          })
          if (saved) {
            checkpointCount++
            consecutiveCheckpointFailures = 0
          } else {
            consecutiveCheckpointFailures++
            if (consecutiveCheckpointFailures >= MAX_CONSECUTIVE_CHECKPOINT_FAILURES) {
              logger.error(`Aborting exploration: ${MAX_CONSECUTIVE_CHECKPOINT_FAILURES} consecutive checkpoint failures`)
              break
            }
          }
        }

        const action = this.explorer.step(currentTree, currentActivity)

        if (action.type === 'STOP') {
          logger.info(`Exploration complete: ${this.getStopReason(action)}`)
          break
        }

        await this.executeAction(action)

        const triggerText = action.target?.text || action.target?.resourceId || ''
        const cx = action.target ? action.target.bounds.x + action.target.bounds.width / 2 : 0
        const cy = action.target ? action.target.bounds.y + action.target.bounds.height / 2 : 0

        paths.push({
          pathId: `path-${this.explorer.getStepCount()}`,
          startActivity: currentActivity,
          endActivity: currentActivity,
          steps: [{ action: action.type.toLowerCase(), element: triggerText, x: cx, y: cy }],
          coverage: [currentActivity],
          reproducible: true
        } as ExplorationPath)

        await this.waitForUIChange(500)
        currentTree = await this.treeProvider.dumpUITree()
      }

      await this.adb.forceStopApp(this.config.packageName)

      const totalActivities = await this.getTotalActivityCount()
      const visitedCount = this.explorer.getVisitedActivities().size
      const coverage = totalActivities > 0 ? visitedCount / totalActivities : (visitedCount > 0 ? 1 : 0)

      return {
        paths,
        totalSteps: this.explorer.getStepCount(),
        visitedActivities: this.explorer.getVisitedActivities(),
        coverageRate: coverage,
        startTime,
        endTime: Date.now(),
        checkpoints: checkpointCount
      }
    } catch (err: any) {
      logger.error(`Exploration failed: ${err.message}`)
      await this.adb.forceStopApp(this.config.packageName).catch(() => {})
      return { paths, totalSteps: this.explorer.getStepCount(), visitedActivities: this.explorer.getVisitedActivities(), coverageRate: 0, startTime, endTime: Date.now(), checkpoints: checkpointCount, error: err.message }
    }
  }

  private async getMainActivity(): Promise<string> {
    try {
      const { execSync } = await import('child_process')
      const output = execSync(`adb -s emulator-5554 shell cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${this.config.packageName}`, { timeout: 5000 }).toString()
      const match = output.match(/(\S+)\s+filter/)
      return match ? match[1] : 'MainActivity'
    } catch {
      return 'MainActivity'
    }
  }

  private async getTotalActivityCount(): Promise<number> {
    try {
      const { execSync } = await import('child_process')
      const output = execSync(`aapt dump xmltree ${this.config.apkPath} AndroidManifest.xml`, { timeout: 10000 }).toString()
      return (output.match(/E: activity/g) || []).length || 10
    } catch {
      return 10
    }
  }

  private async waitForUIChange(baseMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, baseMs))
  }

  private getStopReason(action: ExplorationAction): string {
    return 'reason' in action ? String((action as any).reason) : 'unknown'
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
}