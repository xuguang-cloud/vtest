import { BrowserWindow } from 'electron'
import { ExplorationStateMachine, ExplorationState } from '../exploration/StateMachine'
import { mainLogger as logger } from '../logger/Logger'

export class IPCBridge {
  private mainWindow: BrowserWindow | null = null

  constructor(private stateMachine: ExplorationStateMachine) {
    this.setupStateMachineListener()
  }

  setWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  private setupStateMachineListener(): void {
    this.stateMachine.on('transition', (data: { from: ExplorationState; to: ExplorationState }) => {
      this.sendToRenderer('exploration:stateChanged', data)
    })
  }

  private sendToRenderer(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args)
    } else {
      logger.warn('Attempted to send IPC message to destroyed window')
    }
  }
}