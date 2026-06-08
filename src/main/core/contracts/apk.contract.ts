export interface APKInfo {
  appName: string
  packageName: string
  version: string
  versionCode: number
  minSdk: number
  targetSdk: number
  activities: string[]
  permissions: string[]
  fileSize: number
  md5: string
  parseStatus: 'success' | 'error'
  error?: string
}

export interface APKUploadResult {
  taskId: string
  status: 'uploading' | 'parsing' | 'completed' | 'error'
  apkInfo?: APKInfo
  error?: string
}