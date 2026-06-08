import { registerIPCHandlers, setTrustedSender } from '../IPCService'
import { ipcMain } from 'electron'

// Mock electron before any imports that use it
const mockSender = { id: 1 }

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn()
  }
}))

// Mock logger
jest.mock('../../core/logger/Logger', () => ({
  mainLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

// Mock StateMachine after other mocks
jest.mock('../../core/exploration/StateMachine', () => ({
  ExplorationStateMachine: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn()
  }))
}))

describe('IPCService', () => {
  let mockHandlerMap: Map<string, (...args: any[]) => Promise<unknown>>

  beforeEach(() => {
    jest.clearAllMocks()
    mockHandlerMap = new Map()

    ;(ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: (...args: any[]) => Promise<unknown>) => {
      mockHandlerMap.set(channel, handler)
    })
  })

  describe('registerIPCHandlers', () => {
    it('should register all exploration handlers', () => {
      registerIPCHandlers()

      expect(ipcMain.handle).toHaveBeenCalledWith('exploration:start', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('exploration:stop', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('exploration:pause', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('exploration:resume', expect.any(Function))
    })

    it('should return success from exploration:start handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:start')
      expect(handler).toBeDefined()

      const mockEvent = { sender: mockSender } as unknown as Electron.IpcMainInvokeEvent
      const result = await handler!(mockEvent)
      expect(result).toEqual({ success: true })
    })

    it('should return success from exploration:stop handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:stop')
      expect(handler).toBeDefined()

      const mockEvent = { sender: mockSender } as unknown as Electron.IpcMainInvokeEvent
      const result = await handler!(mockEvent)
      expect(result).toEqual({ success: true })
    })

    it('should return success from exploration:pause handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:pause')
      expect(handler).toBeDefined()

      const mockEvent = { sender: mockSender } as unknown as Electron.IpcMainInvokeEvent
      const result = await handler!(mockEvent)
      expect(result).toEqual({ success: true })
    })

    it('should return success from exploration:resume handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:resume')
      expect(handler).toBeDefined()

      const mockEvent = { sender: mockSender } as unknown as Electron.IpcMainInvokeEvent
      const result = await handler!(mockEvent)
      expect(result).toEqual({ success: true })
    })
  })

  describe('setTrustedSender', () => {
    it('should set trusted sender without throwing', () => {
      const sender = { id: 1 } as any
      expect(() => setTrustedSender(sender)).not.toThrow()
    })
  })
})
