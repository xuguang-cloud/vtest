import { contextBridge, ipcRenderer } from 'electron'

// 定义允许的IPC通道白名单
const VALID_INVOKE_CHANNELS = [
  'exploration:start', 'oauth:authorize', 'oauth:token',
  'project:list', 'project:load', 'avd:list', 'avd:start',
  'logger:info', 'logger:error', 'avd:stop', 'avd:getStatus',
  'avd:rotate', 'system:getVersions', 'project:create', 'project:getAll',
  'project:getById', 'project:update', 'project:delete',
  'device:install', 'device:uninstall', 'device:launch'
]
const VALID_ON_CHANNELS = ['exploration:stateChanged', 'oauth:callback', 'logger:log']

function validateChannel(channel: string, validChannels: string[]): void {
  if (!validChannels.includes(channel)) {
    throw new Error(`IPC channel '${channel}' is not allowed`)
  }
}

const api = {
  getVersions: () => ({
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }),

  oauthAuthorize: (params: unknown) => ipcRenderer.invoke('oauth:authorize', params),
  oauthToken: (params: unknown) => ipcRenderer.invoke('oauth:token', params),

  projectList: () => ipcRenderer.invoke('project:list'),
  projectLoad: (id: string) => ipcRenderer.invoke('project:load', id),

  avdList: () => ipcRenderer.invoke('avd:list'),
  avdStart: (name: string) => ipcRenderer.invoke('avd:start', name),

  loggerInfo: (message: string) => ipcRenderer.invoke('logger:info', message),
  loggerError: (message: string) => ipcRenderer.invoke('logger:error', message),

  invoke: (channel: string, ...args: unknown[]) => {
    validateChannel(channel, VALID_INVOKE_CHANNELS)
    return ipcRenderer.invoke(channel, ...args)
  },

  on: (channel: string, listener: (...args: unknown[]) => void) => {
    validateChannel(channel, VALID_ON_CHANNELS)
    const wrappedListener = (_: unknown, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrappedListener)
    return () => ipcRenderer.removeListener(channel, wrappedListener)
  },

  onExplorationStateChanged: (callback: (status: unknown) => void) => {
    const listener = (_: unknown, status: unknown) => callback(status)
    ipcRenderer.on('exploration:stateChanged', listener)
    return () => ipcRenderer.removeListener('exploration:stateChanged', listener)
  },

  startExploration: () => ipcRenderer.invoke('exploration:start')
}

contextBridge.exposeInMainWorld('vtest', api)
