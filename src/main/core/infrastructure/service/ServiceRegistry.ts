/**
 * ServiceRegistry — 服务注册中心
 * 统一管理服务的注册、发现和生命周期
 */
export interface Service {
  name: string
  version?: string
  dependsOn?: string[]   // 服务依赖列表（拓扑排序使用）
  start?(): Promise<void>
  stop?(): Promise<void>
}

export class ServiceRegistry {
  private static instance: ServiceRegistry
  private services = new Map<string, Service>()
  private startedServices = new Set<string>()

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry()
    }
    return ServiceRegistry.instance
  }

  register(service: Service): void {
    if (this.services.has(service.name)) {
      console.warn(`[ServiceRegistry] Service "${service.name}" already registered, overwriting`)
    }
    this.services.set(service.name, service)
  }

  unregister(name: string): boolean {
    this.startedServices.delete(name)
    return this.services.delete(name)
  }

  get(name: string): Service | undefined {
    return this.services.get(name)
  }

  getAll(): Service[] {
    return Array.from(this.services.values())
  }

  async startAll(): Promise<void> {
    const sorted = this.topologicalSort()
    for (const name of sorted) {
      if (!this.startedServices.has(name)) {
        const service = this.services.get(name)!
        if (service.start) {
          await service.start()
        }
        this.startedServices.add(name)
      }
    }
  }

  async stopAll(): Promise<void> {
    // 逆序停止（依赖方先停）
    const sorted = this.topologicalSort()
    for (const name of sorted.reverse()) {
      if (this.startedServices.has(name)) {
        const service = this.services.get(name)!
        if (service.stop) {
          await service.stop()
        }
        this.startedServices.delete(name)
      }
    }
  }

  /**
   * 拓扑排序：按依赖关系排序服务启动顺序
   * 使用 Kahn 算法（BFS），检测循环依赖
   * @throws 如果存在循环依赖
   */
  topologicalSort(): string[] {
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    // 初始化所有节点
    for (const [name, service] of this.services) {
      if (!inDegree.has(name)) inDegree.set(name, 0)
      if (!adjacency.has(name)) adjacency.set(name, [])

      const deps = service.dependsOn || []
      for (const dep of deps) {
        if (!this.services.has(dep)) {
          throw new Error(`Service "${name}" depends on "${dep}" which is not registered`)
        }
        if (!adjacency.has(dep)) adjacency.set(dep, [])
        adjacency.get(dep)!.push(name)
        inDegree.set(name, (inDegree.get(name) || 0) + 1)
      }
    }

    // Kahn's algorithm
    const queue: string[] = []
    for (const [name, degree] of inDegree) {
      if (degree === 0) queue.push(name)
    }

    const sorted: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      sorted.push(node)
      for (const dependent of adjacency.get(node) || []) {
        const newDegree = (inDegree.get(dependent) || 1) - 1
        inDegree.set(dependent, newDegree)
        if (newDegree === 0) queue.push(dependent)
      }
    }

    if (sorted.length !== this.services.size) {
      throw new Error('Circular dependency detected in service graph')
    }

    return sorted
  }

  async start(name: string): Promise<void> {
    const service = this.services.get(name)
    if (!service) throw new Error(`Service "${name}" not found`)
    if (!this.startedServices.has(name) && service.start) {
      await service.start()
      this.startedServices.add(name)
    }
  }

  async stop(name: string): Promise<void> {
    const service = this.services.get(name)
    if (!service) throw new Error(`Service "${name}" not found`)
    if (this.startedServices.has(name) && service.stop) {
      await service.stop()
      this.startedServices.delete(name)
    }
  }

  isRunning(name: string): boolean {
    return this.startedServices.has(name)
  }

  getRegisteredCount(): number {
    return this.services.size
  }

  getActiveCount(): number {
    return this.startedServices.size
  }
}