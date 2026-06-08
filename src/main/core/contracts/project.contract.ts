export interface Project {
  id: string
  uuid: string
  name: string
  description?: string
  apkPath?: string
  prdPath?: string
  designPath?: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
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