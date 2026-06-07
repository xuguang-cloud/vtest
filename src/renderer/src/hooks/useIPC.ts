import { useCallback } from 'react'

export interface Project {
  id: string
  uuid: string
  name: string
  description?: string
  apkPath?: string
  prdPath?: string
  designPath?: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface AVDStatus {
  state: 'running' | 'stopped' | 'starting' | 'error'
  name?: string
  error?: string
}

export interface CreateProjectDTO {
  name: string
  description?: string
  apkPath?: string
  prdPath?: string
  designPath?: string
}

export interface UpdateProjectDTO {
  name?: string
  description?: string
  apkPath?: string
  prdPath?: string
  designPath?: string
  status?: 'active' | 'inactive'
}

export function useIPC() {
  const invoke = useCallback(async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    if (!window.vtest) {
      throw new Error('VTest API not available')
    }
    return await window.vtest.invoke(channel, ...args)
  }, [])

  const getVersions = useCallback(async () => {
    return await invoke<{ electron: string; node: string; chrome: string }>('system:getVersions')
  }, [invoke])

  const createProject = useCallback(async (dto: CreateProjectDTO): Promise<Project> => {
    return await invoke<Project>('project:create', dto)
  }, [invoke])

  const getAllProjects = useCallback(async (): Promise<Project[]> => {
    return await invoke<Project[]>('project:getAll')
  }, [invoke])

  const getProjectById = useCallback(async (id: string): Promise<Project | null> => {
    return await invoke<Project | null>('project:getById', id)
  }, [invoke])

  const updateProject = useCallback(async (id: string, dto: UpdateProjectDTO): Promise<Project | null> => {
    return await invoke<Project | null>('project:update', id, dto)
  }, [invoke])

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    return await invoke<boolean>('project:delete', id)
  }, [invoke])

  const listAVDs = useCallback(async (): Promise<string[]> => {
    return await invoke<string[]>('avd:list')
  }, [invoke])

  const startAVD = useCallback(async (name: string): Promise<void> => {
    return await invoke<void>('avd:start', name)
  }, [invoke])

  const stopAVD = useCallback(async (): Promise<void> => {
    return await invoke<void>('avd:stop')
  }, [invoke])

  const getAVDStatus = useCallback(async (): Promise<AVDStatus> => {
    return await invoke<AVDStatus>('avd:getStatus')
  }, [invoke])

  const rotateScreen = useCallback(async (orientation: 'portrait' | 'landscape'): Promise<void> => {
    return await invoke<void>('avd:rotate', orientation)
  }, [invoke])

  return {
    invoke,
    getVersions,
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject,
    listAVDs,
    startAVD,
    stopAVD,
    getAVDStatus,
    rotateScreen
  }
}
