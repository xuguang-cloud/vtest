/**
 * AVD Lifecycle Integration Tests
 * Tests AVDManager event emission, state transitions, and spawn integration.
 * Mocks child_process.spawn for isolation.
 */

import { AVDManager } from '../../main/core/avd/AVDManager'
import { spawn } from 'child_process'

jest.mock('child_process')

jest.mock('../../main/core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}))

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

describe('AVD Lifecycle Integration', () => {
  let manager: AVDManager

  beforeEach(() => {
    jest.clearAllMocks()
    manager = new AVDManager()
  })

  // Helper to create a mock child process
  const createMockProcess = (overrides: any = {}) => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    kill: jest.fn(),
    pid: 12345,
    ...overrides
  })

  // Happy Path
  describe('AVD Start/Stop Lifecycle', () => {
    it('should transition from stopped to starting to running', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess as any)

      const statusChanges: any[] = []
      manager.on('statusChange', (status) => statusChanges.push(status))

      // Start the AVD (but do not await, we need to trigger the boot completed event)
      const startPromise = manager.startAVD('Pixel_4_API_30')

      // Simulate boot completed output
      const stdoutOn = mockProcess.stdout.on as jest.Mock
      const dataCallback = stdoutOn.mock.calls.find((c: any) => c[0] === 'data')?.[1]
      if (dataCallback) {
        dataCallback(Buffer.from('boot completed'))
      }

      // Wait for startAVD to resolve
      await startPromise

      // Verify status transitions
      expect(statusChanges.length).toBeGreaterThanOrEqual(2)
      expect(statusChanges[0]).toMatchObject({ name: 'Pixel_4_API_30', state: 'starting' })
    })

    it('should start AVD with config options', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess as any)

      await manager.startAVD('Pixel_4_API_30', { screenSize: '1080x1920' })

      expect(mockSpawn).toHaveBeenCalledWith('emulator', expect.arrayContaining([
        '-avd', 'Pixel_4_API_30',
        '-screen-size', '1080x1920'
      ]))
    })

    it('should list available AVDs', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess as any)

      setTimeout(() => {
        const stdoutOn = (mockProcess.stdout.on as jest.Mock)
        const dataCallback = stdoutOn.mock.calls.find((c: any) => c[0] === 'data')?.[1]
        const closeCallback = (mockProcess.on as jest.Mock).mock.calls.find((c: any) => c[0] === 'close')?.[1]
        if (dataCallback) dataCallback(Buffer.from('Pixel_4_API_30\nPixel_5_API_31\n'))
        if (closeCallback) closeCallback(0)
      }, 0)

      const avds = await manager.listAVDs()
      expect(avds).toEqual(['Pixel_4_API_30', 'Pixel_5_API_31'])
    })
  })

  // Edge Cases
  describe('Edge Cases', () => {
    it('should handle empty AVD list', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess as any)

      setTimeout(() => {
        const closeCallback = (mockProcess.on as jest.Mock).mock.calls.find((c: any) => c[0] === 'close')?.[1]
        if (closeCallback) closeCallback(0)
      }, 0)

      const avds = await manager.listAVDs()
      expect(avds).toEqual([])
    })

    it('should handle AVD name with special characters', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess as any)

      await manager.startAVD('Test_Device-123')

      expect(mockSpawn).toHaveBeenCalledWith('emulator', expect.arrayContaining([
        '-avd', 'Test_Device-123'
      ]))
    })
  })

  // Error Cases
  describe('Error Cases', () => {
    it('should not allow starting when already running', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess as any)

      // First start
      const startPromise = manager.startAVD('Pixel_4_API_30')
      const stdoutOn = mockProcess.stdout.on as jest.Mock
      const dataCallback = stdoutOn.mock.calls.find((c: any) => c[0] === 'data')?.[1]
      if (dataCallback) dataCallback(Buffer.from('boot completed'))
      await startPromise

      // Second start should throw
      await expect(manager.startAVD('Pixel_4_API_30')).rejects.toThrow('AVD is already running')
    })

    it('should reject rotateScreen when AVD is not running', async () => {
      await expect(manager.rotateScreen('portrait')).rejects.toThrow('AVD is not running')
    })

    it('should handle process error event', async () => {
      const mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess as any)

      const statusChanges: any[] = []
      manager.on('statusChange', (status) => statusChanges.push(status))

      // Start the AVD
      const startPromise = manager.startAVD('Pixel_4_API_30')

      // Simulate an error event from the child process
      const errorCallback = (mockProcess.on as jest.Mock).mock.calls.find((c: any) => c[0] === 'error')?.[1]
      if (errorCallback) {
        errorCallback(new Error('spawn emulator ENOENT'))
      }

      await startPromise

      // Check that we got an error status
      const errorStatus = statusChanges.find(s => s.state === 'error')
      expect(errorStatus).toBeDefined()
      expect(errorStatus.error).toContain('ENOENT')
    })
  })
})
