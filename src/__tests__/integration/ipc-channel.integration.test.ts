/**
 * Integration tests for IPC Channel registration and invocation.
 */
import { WebContents } from 'electron'
import { registerIPCHandlers, setTrustedSender } from '../../main/services/IPCService'

const mockHandlerMap = new Map<string, (...args: any[]) => any>()

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel: string, handler: (...args: any[]) => any) => {
      mockHandlerMap.set(channel, handler)
    })
  }
}))

jest.mock('../../main/core/logger/Logger', () => ({
  mainLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

describe('IPC Channel Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHandlerMap.clear()
    setTrustedSender(null as any)
  })

  afterEach(() => {
    process.env.NODE_ENV = 'test'
  })

  describe('Happy Path', () => {
    it('should register all 4 exploration IPC handlers', () => {
      registerIPCHandlers()
      expect(mockHandlerMap.has('exploration:start')).toBe(true)
      expect(mockHandlerMap.has('exploration:stop')).toBe(true)
      expect(mockHandlerMap.has('exploration:pause')).toBe(true)
      expect(mockHandlerMap.has('exploration:resume')).toBe(true)
    })

    it('should return success from start handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:start')!
      const result = await handler({} as Electron.IpcMainInvokeEvent)
      expect(result).toEqual({ success: true })
    })

    it('should return success from stop handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:stop')!
      const result = await handler({} as Electron.IpcMainInvokeEvent)
      expect(result).toEqual({ success: true })
    })

    it('should return success from pause handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:pause')!
      const result = await handler({} as Electron.IpcMainInvokeEvent)
      expect(result).toEqual({ success: true })
    })

    it('should return success from resume handler', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:resume')!
      const result = await handler({} as Electron.IpcMainInvokeEvent)
      expect(result).toEqual({ success: true })
    })
  })

  describe('Sender verification', () => {
    it('should reject untrusted sender in production', async () => {
      process.env.NODE_ENV = 'production'
      const trusted = { id: 1 } as unknown as WebContents
      setTrustedSender(trusted)
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:start')!
      const event = { sender: { id: 2 } as unknown as WebContents } as Electron.IpcMainInvokeEvent
      await expect(handler(event)).rejects.toThrow('Untrusted sender')
    })

    it('should allow trusted sender in production', async () => {
      process.env.NODE_ENV = 'production'
      const trusted = { id: 1 } as unknown as WebContents
      setTrustedSender(trusted)
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:start')!
      const event = { sender: trusted } as unknown as Electron.IpcMainInvokeEvent
      const result = await handler(event)
      expect(result).toEqual({ success: true })
    })

    it('should allow any sender in development mode', async () => {
      process.env.NODE_ENV = 'development'
      const anyWebContents = { id: 99 } as unknown as WebContents
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:start')!
      const event = { sender: anyWebContents } as unknown as Electron.IpcMainInvokeEvent
      const result = await handler(event)
      expect(result).toEqual({ success: true })
    })

    it('should reject when sender is null', async () => {
      process.env.NODE_ENV = 'production'
      setTrustedSender({ id: 1 } as unknown as WebContents)
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:start')!
      const event = { sender: null } as unknown as Electron.IpcMainInvokeEvent
      await expect(handler(event)).rejects.toThrow('Untrusted sender')
    })
  })

  describe('Channel authorization', () => {
    it('should not register handlers for non-exploration channels', () => {
      registerIPCHandlers()
      expect(mockHandlerMap.has('project:create')).toBe(false)
      expect(mockHandlerMap.has('avd:start')).toBe(false)
      expect(mockHandlerMap.has('system:shell')).toBe(false)
    })
  })

  describe('Multiple sequential calls', () => {
    it('should handle multiple calls on same channel', async () => {
      registerIPCHandlers()
      const handler = mockHandlerMap.get('exploration:start')!
      const result1 = await handler({} as Electron.IpcMainInvokeEvent)
      const result2 = await handler({} as Electron.IpcMainInvokeEvent)
      const result3 = await handler({} as Electron.IpcMainInvokeEvent)
      expect(result1).toEqual({ success: true })
      expect(result2).toEqual({ success: true })
      expect(result3).toEqual({ success: true })
    })
  })
})
