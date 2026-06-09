import { ExplorationOrchestrator, OrchestratorConfig } from '../ExplorationOrchestrator'
import { ADBAdapter } from '../../adb/ADBAdapter'

jest.mock('../../adb/ADBAdapter')
jest.mock('../../logger/Logger', () => ({
  Logger: { getLogger: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }) }
}))

const MockADB = ADBAdapter as jest.MockedClass<typeof ADBAdapter>

describe('ExplorationOrchestrator', () => {
  let adb: jest.Mocked<ADBAdapter>
  let config: OrchestratorConfig

  const simpleUI = `<node index="0" text="" class="android.widget.FrameLayout" bounds="[0,0][1080,1920]" clickable="false">
  <node index="1" text="Login" class="android.widget.Button" bounds="[100,100][300,180]" clickable="true"></node>
  <node index="2" text="Register" class="android.widget.Button" bounds="[100,250][300,330]" clickable="true"></node>
</node>`

  beforeEach(() => {
    jest.clearAllMocks()
    adb = {
      installAPK: jest.fn().mockResolvedValue(undefined),
      launchApp: jest.fn().mockResolvedValue(undefined),
      forceStopApp: jest.fn().mockResolvedValue(undefined),
      dumpUI: jest.fn().mockResolvedValue(simpleUI),
      tapAt: jest.fn().mockResolvedValue(undefined),
      pressBack: jest.fn().mockResolvedValue(undefined),
      tap: jest.fn(),
      inputText: jest.fn(),
      scroll: jest.fn(),
      swipe: jest.fn(),
      screenshot: jest.fn(),
      getLogcat: jest.fn(),
      uninstallAPK: jest.fn(),
      isDeviceConnected: jest.fn(),
      getDeviceInfo: jest.fn(),
      pressHome: jest.fn()
    } as any

    config = {
      apkPath: '/tmp/test.apk',
      packageName: 'com.example.app',
      maxDepth: 5,
      maxSteps: 20,
      maxTime: 30000,
      checkpointInterval: 5
    }
  })

  it('should install APK and launch app', async () => {
    const orch = new ExplorationOrchestrator(adb, config)
    await orch.run()
    expect(adb.installAPK).toHaveBeenCalledWith('/tmp/test.apk')
    expect(adb.launchApp).toHaveBeenCalledWith('com.example.app', undefined)
    expect(adb.forceStopApp).toHaveBeenCalledWith('com.example.app')
  })

  it('should complete exploration and return results', async () => {
    const orch = new ExplorationOrchestrator(adb, config)
    const result = await orch.run()
    expect(result.totalSteps).toBeGreaterThan(0)
    expect(result.paths.length).toBeGreaterThan(0)
    expect(result.startTime).toBeGreaterThan(0)
  })

  it('should tap on clickable elements', async () => {
    const orch = new ExplorationOrchestrator(adb, config)
    await orch.run()
    expect(adb.tapAt).toHaveBeenCalled()
  })

  it('should save checkpoints at configured interval', async () => {
    config.checkpointInterval = 1
    const orch = new ExplorationOrchestrator(adb, config)
    const result = await orch.run()
    expect(result.checkpoints).toBeGreaterThan(0)
  })

  it('should dump UI tree multiple times during exploration', async () => {
    const orch = new ExplorationOrchestrator(adb, config)
    await orch.run()
    expect(adb.dumpUI).toHaveBeenCalled()
  })
})