/**
 * VTest renderer type declarations
 * Exposed via preload/index.ts -> contextBridge.exposeInMainWorld('vtest', api)
 */

export interface VTestAPI {
  getVersions: () => { electron: string; node: string; chrome: string }
  oauthAuthorize: (params: unknown) => Promise<unknown>
  oauthToken: (params: unknown) => Promise<unknown>
  projectList: () => Promise<unknown>
  projectLoad: (id: string) => Promise<unknown>
  avdList: () => Promise<unknown>
  avdStart: (name: string) => Promise<unknown>
  loggerInfo: (message: string) => Promise<unknown>
  loggerError: (message: string) => Promise<unknown>
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
  onExplorationStateChanged: (callback: (status: unknown) => void) => () => void
  startExploration: () => Promise<unknown>
  stopExploration?: () => Promise<unknown>
  pauseExploration?: () => Promise<unknown>
  resumeExploration?: () => Promise<unknown>
  resetExploration?: () => Promise<unknown>
}

declare global {
  interface Window {
    vtest: VTestAPI
  }
}

export {}