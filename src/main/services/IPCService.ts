import { ipcMain } from 'electron'
import { ExplorationStateMachine } from '../core/exploration/StateMachine'
import { mainLogger as logger } from '../core/logger/Logger'

// 依赖注入或从上下文获取状态机实例 (此处为简化示例)
// 实际运行中需与 main/index.ts 中的实例对齐
const stateMachine = new ExplorationStateMachine()

ipcMain.handle('exploration:start', async () => {
  try {
    logger.info('Received exploration:start command from renderer')
    stateMachine.start()
    return { success: true }
  } catch (error: any) {
    logger.error('Failed to start exploration', { error: error.message })
    return { success: false, error: error.message }
  }
})