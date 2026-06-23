import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AVDConnector } from './AVDConnector'
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process', () => ({
  spawn: vi.fn()
}))

class MockProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill = vi.fn()
}

describe('AVDConnector', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('lists available AVDs', async () => {
    const connector = new AVDConnector({ avdName: 'Pixel' })
    const proc = new MockProcess()
    ;(spawn as any).mockImplementation((cmd: string, args?: string[]) => {
      const isList = args?.includes('-list-avds')
      if (isList) {
        setTimeout(() => {
          proc.stdout.emit('data', 'Pixel_3\nPixel_4\n')
          proc.emit('close', 0)
        }, 0)
        return proc
      }
      return new MockProcess()
    })
    const avds = await connector.listAVDs()
    expect(avds).toHaveLength(2)
    expect(avds[0].name).toBe('Pixel_3')
  })

  it('creates an AVD', async () => {
    const connector = new AVDConnector({ avdName: 'Pixel' })
    const proc = new MockProcess()
    ;(spawn as any).mockImplementation((cmd: string, args?: string[]) => {
      const isCreate = args?.includes('create')
      if (isCreate) {
        setTimeout(() => proc.emit('close', 0), 0)
        return proc
      }
      return new MockProcess()
    })
    await expect(connector.createAVD('NewPixel', 'system-images;android-34;google_apis;x86_64')).resolves.toBeUndefined()
  })

  it('connects to an emulator and waits for boot', async () => {
    const connector = new AVDConnector({ avdName: 'Pixel', headless: true })
    const emulatorProc = new MockProcess()
    let bootCheckCount = 0
    ;(spawn as any).mockImplementation((cmd: string, args?: string[]) => {
      if (cmd.includes('emulator') && args?.[0]?.startsWith('@')) {
        setTimeout(() => emulatorProc.emit('close', 0), 0)
        return emulatorProc
      }
      if (cmd.includes('adb') && args?.includes('getprop')) {
        bootCheckCount++
        const adbProc = new MockProcess()
        if (bootCheckCount < 2) {
          setTimeout(() => adbProc.emit('close', 0), 0)
        } else {
          setTimeout(() => {
            adbProc.stdout.emit('data', '1')
            adbProc.emit('close', 0)
          }, 0)
        }
        return adbProc
      }
      return new MockProcess()
    })
    const session = await connector.connect()
    expect(session.id).toBe('Pixel')
  })

  it('disconnects the emulator', async () => {
    const connector = new AVDConnector({ avdName: 'Pixel' })
    const proc = new MockProcess()
    let bootCheckCount = 0
    ;(spawn as any).mockImplementation((cmd: string, args?: string[]) => {
      if (cmd.includes('emulator') && args?.[0]?.startsWith('@')) return proc
      if (cmd.includes('adb') && args?.includes('getprop')) {
        bootCheckCount++
        const adbProc = new MockProcess()
        setTimeout(() => {
          if (bootCheckCount >= 2) adbProc.stdout.emit('data', '1')
          adbProc.emit('close', 0)
        }, 0)
        return adbProc
      }
      return new MockProcess()
    })
    await connector.connect()
    await connector.disconnect()
    expect(proc.kill).toHaveBeenCalled()
  })

  it('installs an APK', async () => {
    const connector = new AVDConnector({ avdName: 'Pixel' })
    const proc = new MockProcess()
    ;(spawn as any).mockImplementation((cmd: string, args?: string[]) => {
      if (cmd.includes('adb') && args?.includes('install')) {
        setTimeout(() => proc.emit('close', 0), 0)
        return proc
      }
      return new MockProcess()
    })
    await expect(connector.install('/path/app.apk')).resolves.toBeUndefined()
  })

  it('uninstalls a package', async () => {
    const connector = new AVDConnector({ avdName: 'Pixel' })
    const proc = new MockProcess()
    ;(spawn as any).mockImplementation((cmd: string, args?: string[]) => {
      if (cmd.includes('adb') && args?.includes('uninstall')) {
        setTimeout(() => proc.emit('close', 0), 0)
        return proc
      }
      return new MockProcess()
    })
    await expect(connector.uninstall('com.example')).resolves.toBeUndefined()
  })

  it('launches an activity', async () => {
    const connector = new AVDConnector({ avdName: 'Pixel' })
    const proc = new MockProcess()
    ;(spawn as any).mockImplementation((cmd: string, args?: string[]) => {
      if (cmd.includes('adb') && args?.includes('am')) {
        setTimeout(() => proc.emit('close', 0), 0)
        return proc
      }
      return new MockProcess()
    })
    await expect(connector.launch('com.example', '.MainActivity')).resolves.toBeUndefined()
  })
})
