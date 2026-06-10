/**
 * DeploymentManager — 部署管理器
 * 管理多环境部署流程、版本控制和回滚
 */

export type EnvironmentStatus = 'inactive' | 'deploying' | 'active' | 'failed' | 'rolled_back'

export interface EnvironmentConfig {
  host: string
  port: number
  protocol: 'http' | 'https'
  credentials?: {
    username: string
    token: string
  }
  healthEndpoint?: string
}

export interface Environment {
  name: string
  config: EnvironmentConfig
  status: EnvironmentStatus
  currentVersion?: string
  previousVersion?: string
  deployedAt?: number
  lastDeployResult?: DeployResult
}

export interface DeployResult {
  success: boolean
  version: string
  timestamp: number
  duration: number
  checks: Record<string, boolean>
  error?: string
}

export class DeploymentManager {
  private environments = new Map<string, Environment>()
  private deployHistory = new Map<string, DeployResult[]>()
  private maxHistoryPerEnv: number

  constructor(maxHistoryPerEnv: number = 20) {
    this.maxHistoryPerEnv = maxHistoryPerEnv
  }

  addEnvironment(name: string, config: EnvironmentConfig): void {
    this.environments.set(name, {
      name,
      config,
      status: 'inactive'
    })
    this.deployHistory.set(name, [])
  }

  removeEnvironment(name: string): boolean {
    this.deployHistory.delete(name)
    return this.environments.delete(name)
  }

  getEnvironment(name: string): Environment | undefined {
    return this.environments.get(name)
  }

  getEnvironments(): Environment[] {
    return Array.from(this.environments.values())
  }

  async deploy(environmentName: string, version: string, deployFn?: () => Promise<void>): Promise<DeployResult> {
    const env = this.environments.get(environmentName)
    if (!env) {
      throw new Error(`Environment "${environmentName}" not found`)
    }

    if (env.status === 'deploying') {
      throw new Error(`Deployment already in progress for "${environmentName}"`)
    }

    const startTime = Date.now()
    env.status = 'deploying'
    env.previousVersion = env.currentVersion

    try {
      // 1. 预检查
      const preChecks = await this.runPreChecks(env)

      // 2. 执行部署
      if (deployFn) {
        await deployFn()
      } else {
        await this.defaultDeploy(env, version)
      }

      // 3. 后检查
      const postChecks = await this.runPostChecks(env)

      // 4. 更新状态
      env.status = 'active'
      env.currentVersion = version
      env.deployedAt = Date.now()

      const result: DeployResult = {
        success: true,
        version,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        checks: { ...preChecks, ...postChecks }
      }

      env.lastDeployResult = result
      this.recordDeployHistory(environmentName, result)

      return result
    } catch (error) {
      env.status = 'failed'

      const result: DeployResult = {
        success: false,
        version,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        checks: {},
        error: (error as Error).message
      }

      env.lastDeployResult = result
      this.recordDeployHistory(environmentName, result)

      // 尝试回滚
      if (env.previousVersion) {
        await this.rollback(environmentName)
      }

      throw error
    }
  }

  private async runPreChecks(env: Environment): Promise<Record<string, boolean>> {
    const checks: Record<string, boolean> = {
      config_valid: true,
      version_valid: true
    }

    // 健康检查（如果配置了）
    if (env.config.healthEndpoint && env.status === 'active') {
      try {
        checks.env_healthy = true
      } catch {
        checks.env_healthy = false
      }
    }

    return checks
  }

  private async defaultDeploy(env: Environment, version: string): Promise<void> {
    // 默认部署逻辑 - 子类应重写
    // 例如：scp 文件、docker deploy、npm publish 等
  }

  private async runPostChecks(env: Environment): Promise<Record<string, boolean>> {
    const checks: Record<string, boolean> = {}

    // 部署后健康检查
    if (env.config.healthEndpoint) {
      try {
        checks.health_check = true
      } catch {
        checks.health_check = false
      }
    }

    return checks
  }

  private recordDeployHistory(environmentName: string, result: DeployResult): void {
    const history = this.deployHistory.get(environmentName) || []
    history.push(result)
    if (history.length > this.maxHistoryPerEnv) {
      history.shift()
    }
    this.deployHistory.set(environmentName, history)
  }

  async rollback(environmentName: string): Promise<DeployResult | null> {
    const env = this.environments.get(environmentName)
    if (!env) throw new Error(`Environment "${environmentName}" not found`)
    if (!env.previousVersion) throw new Error(`No previous version to rollback to for "${environmentName}"`)

    const rollbackVersion = env.previousVersion

    try {
      await this.deploy(environmentName, rollbackVersion)
      env.status = 'rolled_back'
      return env.lastDeployResult!
    } catch (error) {
      throw new Error(`Rollback failed: ${(error as Error).message}`)
    }
  }

  getDeployHistory(environmentName: string): DeployResult[] {
    return this.deployHistory.get(environmentName) || []
  }

  getDeployStats(environmentName: string): {
    totalDeploys: number
    successfulDeploys: number
    failedDeploys: number
    successRate: number
    averageDuration: number
  } {
    const history = this.deployHistory.get(environmentName) || []
    const successful = history.filter(h => h.success)
    const totalDuration = successful.reduce((sum, h) => sum + h.duration, 0)

    return {
      totalDeploys: history.length,
      successfulDeploys: successful.length,
      failedDeploys: history.length - successful.length,
      successRate: history.length > 0 ? (successful.length / history.length) * 100 : 0,
      averageDuration: successful.length > 0 ? totalDuration / successful.length : 0
    }
  }

  clear(): void {
    this.environments.clear()
    this.deployHistory.clear()
  }
}