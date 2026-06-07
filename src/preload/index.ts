import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('vtest', {
  getVersions: () => {
    return {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }
  },
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => listener(...args))
  },
  // 新增：精准监听探索状态变化
  onExplorationStateChanged: (callback: (status: any) => void) => {
    const listener = (_: any, status: any) => callback(status)
    ipcRenderer.on('exploration:stateChanged', listener)
    return () => ipcRenderer.removeListener('exploration:stateChanged', listener)
  },
  // 新增：启动探索指令
  startExploration: () => ipcRenderer.invoke('exploration:start')
})