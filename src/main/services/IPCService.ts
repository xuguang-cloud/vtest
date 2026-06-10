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

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30           // Max calls per window
const RATE_LIMIT_WINDOW_MS = 60000   // 1 minute window
const RATE_LIMIT_BURST = 10          // Max calls in 1 second

export function setTrustedSender(sender: WebContents): void {
  trustedSender = sender
}

function checkRateLimit(senderId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(senderId)
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(senderId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    logger.warn(`Rate limit exceeded for sender: ${senderId}`)
    return false
  }
  
  return true
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
      // Rate limiting
      const senderId = event.sender.id.toString()
      if (!checkRateLimit(senderId)) {
        logger.warn(`IPC rate limit exceeded: ${channel} from sender ${senderId}`)
        throw new Error('Rate limit exceeded')
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
    stateMachine.transition('INIT')
    return { success: true }
  })
  createSecureHandler('exploration:stop', async () => {
    stateMachine.transition('IDLE')
    return { success: true }
  })
  createSecureHandler('exploration:pause', async () => {
    stateMachine.transition('IDLE')
    return { success: true }
  })
  createSecureHandler('exploration:resume', async () => {
    stateMachine.transition('EXPLORING')
    return { success: true }
  })
  logger.info('IPC handlers registered')
}
