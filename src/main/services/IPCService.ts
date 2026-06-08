import { ipcMain, WebContents } from 'electron'
import { ExplorationStateMachine } from '../core/exploration/StateMachine'
import { mainLogger as logger } from '../core/logger/Logger'

const stateMachine = new ExplorationStateMachine()

const ALLOWED_CHANNELS = new Set([
  'exploration:start',
  'exploration:stop',
  'exploration:pause',
  'exploration:resume'
])

let trustedSender: WebContents | null = null

export function setTrustedSender(sender: WebContents): void {
  trustedSender = sender
}

function verifySender(event: Electron.IpcMainInvokeEvent): boolean {
  const sender = event.sender
  if (!sender) {
    return false
  }
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  if (trustedSender && sender !== trustedSender) {
    return false
  }
  return true
}

function validateChannel(channel: string): boolean {
  return ALLOWED_CHANNELS.has(channel)
}

function createSecureHandler<T>(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<T>
) {
  return ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!validateChannel(channel)) {
        logger.warn('Unauthorized IPC channel: ' + channel)
        throw new Error('IPC channel not authorized')
      }
      if (!verifySender(event)) {
        logger.warn('Untrusted sender on channel: ' + channel)
        throw new Error('Untrusted sender')
      }
      logger.info('Processing IPC: ' + channel)
      return await handler(event, ...args)
    } catch (error: any) {
      logger.error('IPC error for ' + channel, { error: error.message })
      throw error
    }
  })
}

export function registerIPCHandlers() {
  createSecureHandler('exploration:start', async () => {
    stateMachine.start()
    return { success: true }
  })
  createSecureHandler('exploration:stop', async () => {
    stateMachine.stop()
    return { success: true }
  })
  createSecureHandler('exploration:pause', async () => {
    stateMachine.pause()
    return { success: true }
  })
  createSecureHandler('exploration:resume', async () => {
    stateMachine.resume()
    return { success: true }
  })
  logger.info('IPC handlers registered')
}
