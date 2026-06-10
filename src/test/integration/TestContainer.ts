/**
 * TestContainer — 测试容器管理
 * 管理集成测试依赖的 Docker 容器生命周期
 * 使用 Docker CLI 交互，无需 dockerode 依赖
 */
import { execSync, spawn } from 'child_process'

export interface ContainerOptions {
  image: string
  name?: string
  ports?: Record<string, string> // 容器端口 -> 主机端口
  env?: Record<string, string>
  command?: string[]
  network?: string
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
  ports: Record<string, string>
}

export class TestContainer {
  private containers = new Map<string, string>() // image -> container id
  private dockerAvailable: boolean | null = null

  constructor() {
    this.checkDocker()
  }

  private checkDocker(): boolean {
    if (this.dockerAvailable !== null) return this.dockerAvailable
    try {
      execSync('docker info', { stdio: 'ignore', timeout: 5000 })
      this.dockerAvailable = true
    } catch {
      this.dockerAvailable = false
      console.warn('[TestContainer] Docker is not available. Container operations will fail.')
    }
    return this.dockerAvailable
  }

  async start(image: string, options: ContainerOptions): Promise<string> {
    if (!this.checkDocker()) {
      throw new Error('Docker is not available')
    }

    const args: string[] = ['docker', 'run', '-d']

    if (options.name) {
      args.push('--name', options.name)
    }

    if (options.ports) {
      for (const [containerPort, hostPort] of Object.entries(options.ports)) {
        args.push('-p', `${hostPort}:${containerPort}`)
      }
    }

    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('-e', `${key}=${value}`)
      }
    }

    if (options.network) {
      args.push('--network', options.network)
    }

    args.push(image)

    if (options.command) {
      args.push(...options.command)
    }

    return new Promise<string>((resolve, reject) => {
      const process = spawn(args[0], args.slice(1), { timeout: 30000 })

      let output = ''
      process.stdout.on('data', (data: Buffer) => {
        output += data.toString().trim()
      })

      process.stderr.on('data', (data: Buffer) => {
        output += data.toString().trim()
      })

      process.on('close', (code: number) => {
        if (code === 0 && output) {
          const containerId = output.trim()
          this.containers.set(image, containerId)
          resolve(containerId)
        } else {
          reject(new Error(`Failed to start container: ${output}`))
        }
      })

      process.on('error', reject)
    })
  }

  async stop(imageOrId: string): Promise<void> {
    const containerId = this.containers.get(imageOrId) || imageOrId
    if (!containerId) return

    try {
      execSync(`docker stop ${containerId}`, { timeout: 10000, stdio: 'ignore' })
    } catch {
      // 容器可能已经停止
    }

    try {
      execSync(`docker rm ${containerId}`, { timeout: 10000, stdio: 'ignore' })
    } catch {
      // 容器可能已被删除
    }

    // 清理跟踪
    for (const [image, id] of this.containers) {
      if (id === containerId) {
        this.containers.delete(image)
        break
      }
    }
  }

  async cleanup(): Promise<void> {
    for (const [image, containerId] of [...this.containers]) {
      try {
        execSync(`docker stop ${containerId}`, { timeout: 10000, stdio: 'ignore' })
        execSync(`docker rm ${containerId}`, { timeout: 10000, stdio: 'ignore' })
      } catch {
        // 忽略单个容器的清理错误
      }
    }
    this.containers.clear()
  }

  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    try {
      const output = execSync(
        `docker inspect ${containerId} --format '{{json .}}'`,
        { encoding: 'utf-8', timeout: 5000 }
      )
      const info = JSON.parse(output)
      return {
        id: info.Id?.substring(0, 12) || 'unknown',
        name: info.Name?.replace(/^\//, '') || 'unknown',
        image: info.Config?.Image || 'unknown',
        status: info.State?.Status || 'unknown',
        ports: info.NetworkSettings?.Ports || {}
      }
    } catch {
      return null
    }
  }

  async getLogs(containerId: string, tail: number = 50): Promise<string> {
    try {
      return execSync(
        `docker logs --tail ${tail} ${containerId}`,
        { encoding: 'utf-8', timeout: 5000 }
      )
    } catch {
      return ''
    }
  }

  getManagedContainers(): string[] {
    return Array.from(this.containers.values())
  }
}