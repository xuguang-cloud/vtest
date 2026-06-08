export interface AVDConfig {
  name: string
  device: string
  apiLevel: number
  screenSize: string
  screenDensity: string
}

export interface AVDStatus {
  name: string
  state: 'stopped' | 'starting' | 'running' | 'error'
  pid?: number
  error?: string
}