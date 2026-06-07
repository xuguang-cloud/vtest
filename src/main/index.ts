import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AppLifecycleManager } from './core/lifecycle/AppLifecycleManager'
import { IPCBridge } from './core/bridge/IPCBridge'
import { ExplorationStateMachine } from './core/exploration/StateMachine'
import { mainLogger as logger } from './core/logger/Logger'

const lifecycleManager = new AppLifecycleManager()
const stateMachine = new ExplorationStateMachine()
const ipcBridge = new IPCBridge(stateMachine)

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })
  
  ipcBridge.setWindow(mainWindow)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  try {
    await lifecycleManager.onAppReady() // 触发崩溃恢复检查
    createWindow()
    // 注册 IPC Handler
    require('./services/IPCService')
    logger.info('Application initialized successfully')
  } catch (error) {
    logger.fatal('Failed to initialize application', { error })
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  await lifecycleManager.onAppQuit()
})