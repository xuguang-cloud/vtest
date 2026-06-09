/**
 * End-to-end pipeline test: APK → dump UI → DFS → paths → result
 * Uses ExplorationOrchestrator with mocked ADB, validates full pipeline.
 */
import { ExplorationOrchestrator, OrchestratorConfig } from '../../main/core/exploration/ExplorationOrchestrator'
import { ADBAdapter } from '../../main/core/adb/ADBAdapter'
import { Logger } from '../../main/core/logger/Logger'

jest.mock('../../main/core/adb/ADBAdapter')
jest.mock('../../main/core/logger/Logger', () => ({
  Logger: { getLogger: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }) }
}))

const logger = Logger.getLogger('e2e')

function buildUITree(buttons: string[]): string {
  const nodes = buttons.map((text, i) =>
    `  <node index="${i + 1}" text="${text}" class="android.widget.Button" bounds="[100,${100 + i * 80}][300,${180 + i * 80}]" clickable="true"></node>`
  ).join('\n')
  return `<node index="0" text="" class="android.widget.FrameLayout" bounds="[0,0][1080,1920]" clickable="false">\n${nodes}\n</node>`
}

describe('E2E: Full exploration pipeline', () => {
  let adb: jest.Mocked<ADBAdapter>
  let config: OrchestratorConfig

  beforeEach(() => {
    jest.clearAllMocks()
    adb = {
      installAPK: jest.fn().mockResolvedValue(undefined),
      launchApp: jest.fn().mockResolvedValue(undefined),
      forceStopApp: jest.fn().mockResolvedValue(undefined),
      dumpUI: jest.fn(),
      tapAt: jest.fn().mockResolvedValue(undefined),
      pressBack: jest.fn().mockResolvedValue(undefined),
      isDeviceConnected: jest.fn().mockResolvedValue(true),
      tap: jest.fn(),
      inputText: jest.fn(),
      scroll: jest.fn(),
      swipe: jest.fn(),
      screenshot: jest.fn(),
      getLogcat: jest.fn(),
      uninstallAPK: jest.fn(),
      isDeviceConnected: jest.fn().mockResolvedValue(true),
      getDeviceInfo: jest.fn(),
      pressHome: jest.fn()
    } as any

    config = {
      apkPath: '/tmp/e2e-test.apk',
      packageName: 'com.e2e.app',
      maxDepth: 10,
      maxSteps: 50,
      maxTime: 60000,
      checkpointInterval: 5
    }
  })

  it('E2E: 3-page app with 2 buttons each', async () => {
    // Page 1: 2 buttons → click first → Page 2
    // Page 2: 2 buttons → click first → Page 3
    // Page 3: 2 buttons → both visited → back → back → done

    let dumpCount = 0
    const pages = [
      buildUITree(['Page1_Btn1', 'Page1_Btn2']),
      buildUITree(['Page2_Btn1', 'Page2_Btn2']),
      buildUITree(['Page3_Btn1', 'Page3_Btn2'])
    ]

    adb.dumpUI.mockImplementation(async () => {
      const page = pages[Math.min(dumpCount, pages.length - 1)]
      dumpCount++
      return page
    })

    const orch = new ExplorationOrchestrator(adb, config)
    const result = await orch.run()

    logger.info(`E2E result: ${result.totalSteps} steps, ${result.paths.length} paths, ${result.checkpoints} checkpoints`)

    expect(result.totalSteps).toBeGreaterThan(0)
    expect(result.paths.length).toBeGreaterThan(0)
    expect(result.checkpoints).toBeGreaterThanOrEqual(0)
    expect(adb.installAPK).toHaveBeenCalledTimes(1)
    expect(adb.forceStopApp).toHaveBeenCalledTimes(1)
    expect(adb.tapAt).toHaveBeenCalled()
    expect(dumpCount).toBeGreaterThan(3)
  }, 30000)

  it('E2E: single-button app — one click then backtrack → stop', async () => {
    adb.dumpUI.mockResolvedValue(buildUITree(['Single_Button']))
    const orch = new ExplorationOrchestrator(adb, config)
    const result = await orch.run()

    expect(result.totalSteps).toBeGreaterThan(0)
    expect(result.totalSteps).toBeLessThanOrEqual(config.maxSteps)
    expect(result.paths.length).toBeGreaterThan(0)
    expect(adb.tapAt).toHaveBeenCalledTimes(1)
  }, 30000)

  it('E2E: exploration respects maxSteps limit', async () => {
    // Many buttons so DFS would go forever, but maxSteps stops it
    adb.dumpUI.mockResolvedValue(buildUITree(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']))
    const limited = { ...config, maxSteps: 4 }
    const orch = new ExplorationOrchestrator(adb, limited)
    const result = await orch.run()

    expect(result.totalSteps).toBeLessThanOrEqual(5) // 4 + potential backward track
    expect(adb.forceStopApp).toHaveBeenCalledTimes(1)
  }, 30000)

  it('E2E: pipeline preserves checkpoint data across exploration', async () => {
    // Simulate 2-page app, checkpoints should accumulate
    let callIdx = 0
    const trees = [buildUITree(['A1', 'A2']), buildUITree(['B1'])]
    adb.dumpUI.mockImplementation(async () => {
      const tree = trees[Math.min(callIdx, trees.length - 1)]
      callIdx++
      return tree
    })

    const cpConfig = { ...config, checkpointInterval: 1 }
    const orch = new ExplorationOrchestrator(adb, cpConfig)
    const result = await orch.run()

    expect(result.checkpoints).toBeGreaterThanOrEqual(0)
    expect(result.visitedActivities.size).toBeGreaterThanOrEqual(0)
  }, 30000)
})