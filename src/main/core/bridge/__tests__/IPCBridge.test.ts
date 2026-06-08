import { IPCBridge } from '../IPCBridge'
import { ExplorationStateMachine } from '../../exploration/StateMachine'
import { BrowserWindow } from 'electron'

// Mock electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn()
}))

// Mock logger
jest.mock('../../logger/Logger', () => ({
  mainLogger: {
    warn: jest.fn(),
    info: jest.fn()
  }
}))

describe('IPCBridge', () => {
  let stateMachine: ExplorationStateMachine
  let bridge: IPCBridge
  let mockWebContents: { send: jest.Mock; isDestroyed: jest.Mock }
  let mockWindow: BrowserWindow

  beforeEach(() => {
    jest.clearAllMocks()
    stateMachine = new ExplorationStateMachine()
    bridge = new IPCBridge(stateMachine)

    mockWebContents = {
      send: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false)
    }
    mockWindow = {
      webContents: mockWebContents,
      isDestroyed: mockWebContents.isDestroyed
    } as unknown as BrowserWindow
  })

  describe('setWindow', () => {
    it('should set the main window', () => {
      bridge.setWindow(mockWindow)
      // After setting window, sendToRenderer should work
      stateMachine.transition('INIT')
      stateMachine.transition('EXPLORING')

      // Verify by checking the window was used
      expect(mockWebContents.send).toHaveBeenCalledWith(
        'exploration:stateChanged',
        expect.any(Object)
      )
    })
  })

  describe('state machine event forwarding', () => {
    beforeEach(() => {
      bridge.setWindow(mockWindow)
    })

    it('should forward transition events to renderer', () => {
      stateMachine.transition('INIT')

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'exploration:stateChanged',
        expect.objectContaining({
          from: 'IDLE',
          to: 'INIT'
        })
      )
    })

    it('should forward multiple transitions', () => {
      stateMachine.transition('INIT')
      stateMachine.transition('EXPLORING')

      expect(mockWebContents.send).toHaveBeenCalledTimes(2)
    })
  })

  describe('window destruction handling', () => {
    it('should not send to destroyed window', () => {
      mockWebContents.isDestroyed.mockReturnValue(true)
      bridge.setWindow(mockWindow)

      stateMachine.transition('INIT')

      // Should not call send on destroyed window
      expect(mockWebContents.send).not.toHaveBeenCalled()
    })
  })

  describe('window not set', () => {
    it('should handle transition without window set', () => {
      // Don't set window - just create a new bridge and transition
      const _newBridge = new IPCBridge(new ExplorationStateMachine())
      // Should not throw
      expect(() => {
        stateMachine.transition('INIT')
      }).not.toThrow()
    })
  })
})
