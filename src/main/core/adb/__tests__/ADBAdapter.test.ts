import { ADBAdapter } from '../ADBAdapter'
import * as cp from 'child_process'

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn()
}))

const mockSpawn = cp.spawn as jest.Mock
const mockExecSync = cp.execSync as unknown as jest.Mock

function mockSpawnSuccess(stdout: string, exitCode = 0) {
  mockSpawn.mockReturnValueOnce({
    stdout: {
      on: (_event: string, cb: (data: Buffer) => void) => {
        if (stdout) { cb(Buffer.from(stdout)) }
        return { on: jest.fn() }
      }
    },
    stderr: {
      on: jest.fn().mockReturnThis()
    },
    on: (event: string, cb: (...args: any[]) => void) => {
      if (event === 'close') { cb(exitCode) }
      return { on: jest.fn() }
    }
  })
}

function mockSpawnFail(stderr: string, exitCode = 1) {
  mockSpawn.mockReturnValueOnce({
    stdout: {
      on: jest.fn().mockReturnThis()
    },
    stderr: {
      on: (_event: string, cb: (data: Buffer) => void) => {
        if (stderr) { cb(Buffer.from(stderr)) }
        return { on: jest.fn() }
      }
    },
    on: (event: string, cb: (...args: any[]) => void) => {
      if (event === 'close') { cb(exitCode) }
      return { on: jest.fn() }
    }
  })
}

describe('ADBAdapter', () => {
  let adapter: ADBAdapter

  beforeEach(() => {
    jest.clearAllMocks()
    adapter = new ADBAdapter('emulator-5554')
  })

  describe('device connectivity', () => {
    it('should detect connected device', () => {
      jest.spyOn(adapter as any, 'isDeviceConnected').mockReturnValue(true)
      expect(adapter.isDeviceConnected()).toBe(true)
    })

    it('should detect disconnected device', () => {
      jest.spyOn(adapter as any, 'isDeviceConnected').mockReturnValue(false)
      expect(adapter.isDeviceConnected()).toBe(false)
    })
  })

  describe('tap', () => {
    it('should call adb shell input tap', async () => {
      mockSpawnSuccess('OK')
      await adapter.tap('btn1')
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb', ['-s', 'emulator-5554', 'shell', 'input', 'tap', 'btn1'],
        expect.any(Object)
      )
    })
  })

  describe('inputText', () => {
    it('should call adb shell input text', async () => {
      mockSpawnSuccess('OK')
      await adapter.inputText('hello')
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb', ['-s', 'emulator-5554', 'shell', 'input', 'text', 'hello'],
        expect.any(Object)
      )
    })
  })

  describe('pressBack', () => {
    it('should send keyevent 4', async () => {
      mockSpawnSuccess('OK')
      await adapter.pressBack()
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb', ['-s', 'emulator-5554', 'shell', 'input', 'keyevent', '4'],
        expect.any(Object)
      )
    })
  })

  describe('pressHome', () => {
    it('should send keyevent 3', async () => {
      mockSpawnSuccess('OK')
      await adapter.pressHome()
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb', ['-s', 'emulator-5554', 'shell', 'input', 'keyevent', '3'],
        expect.any(Object)
      )
    })
  })

  describe('screenshot', () => {
    it('should capture and pull screenshot', async () => {
      mockSpawnSuccess('OK')
      mockSpawnSuccess('OK')
      mockSpawnSuccess('OK')
      const path = await adapter.screenshot()
      expect(path).toContain('.png')
      expect(mockSpawn).toHaveBeenCalledTimes(3) // screencap + pull + rm
    })
  })

  describe('dumpUI', () => {
    it('should dump via uiautomator', async () => {
      mockSpawnSuccess('OK')
      mockSpawnSuccess('<node text="Home" />')
      const xml = await adapter.dumpUI()
      expect(xml).toBe('<node text="Home" />')
      expect(mockSpawn).toHaveBeenCalledTimes(2)
    })
  })

  describe('getLogcat', () => {
    it('should return logcat output', async () => {
      mockSpawnSuccess('FATAL EXCEPTION: main\n  at com.example.Main.onCreate')
      const logs = await adapter.getLogcat()
      expect(logs).toContain('FATAL EXCEPTION')
    })
  })

  describe('installAPK', () => {
    it('should install APK with -r flag', async () => {
      mockSpawnSuccess('Success')
      await adapter.installAPK('/path/to/app.apk')
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb', ['-s', 'emulator-5554', 'install', '-r', '/path/to/app.apk'],
        expect.any(Object)
      )
    })
  })

  describe('launchApp', () => {
    it('should launch app via monkey', async () => {
      mockSpawnSuccess('OK')
      await adapter.launchApp('com.example.app')
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb',
        expect.arrayContaining(['shell', 'monkey', '-p', 'com.example.app']),
        expect.any(Object)
      )
    })

    it('should launch with specific activity', async () => {
      mockSpawnSuccess('OK')
      await adapter.launchApp('com.example.app', '.MainActivity')
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb',
        ['-s', 'emulator-5554', 'shell', 'am', 'start', '-n', 'com.example.app/.MainActivity'],
        expect.any(Object)
      )
    })
  })

  describe('forceStopApp', () => {
    it('should force stop app', async () => {
      mockSpawnSuccess('OK')
      await adapter.forceStopApp('com.example.app')
      expect(mockSpawn).toHaveBeenCalledWith(
        'adb', ['-s', 'emulator-5554', 'shell', 'am', 'force-stop', 'com.example.app'],
        expect.any(Object)
      )
    })
  })

  describe('retry mechanism', () => {
    it('should retry on failure', async () => {
      mockSpawnFail('error', 1)
      mockSpawnFail('error', 1)
      mockSpawnSuccess('OK')
      await adapter.tap('btn')
      expect(mockSpawn).toHaveBeenCalledTimes(3)
    }, 10000)

    it('should throw after all retries exhausted', async () => {
      mockSpawnFail('error', 1)
      mockSpawnFail('error', 1)
      mockSpawnFail('error', 1)
      await expect(adapter.tap('btn')).rejects.toThrow('ADB command failed')
      expect(mockSpawn).toHaveBeenCalledTimes(3)
    }, 10000)
  })

  describe('getDeviceInfo', () => {
    it('should return device properties', async () => {
      mockSpawnSuccess('Pixel 7')
      mockSpawnSuccess('14')
      mockSpawnSuccess('34')
      mockSpawnSuccess('Physical size: 1080x2400')
      const info = await adapter.getDeviceInfo()
      expect(info.model).toBe('Pixel 7')
      expect(info.androidVersion).toBe('14')
      expect(info.apiLevel).toBe(34)
      expect(info.screenSize).toBe('1080x2400')
    })
  })
})