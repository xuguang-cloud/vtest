export interface PluginContext {
  registerDeviceDriver(type: string, factory: DriverFactory): void
  registerElementExtractor(name: string, extractor: IElementExtractor): void
  registerReporter(name: string, reporter: IReporter): void
}

export interface VTestPlugin {
  name: string
  version: string
  activate(context: PluginContext): void | Promise<void>
  deactivate?(): void | Promise<void>
}

export interface DriverFactory {
  create(options?: Record<string, unknown>): Promise<IDeviceConnector>
}

export interface IDeviceConnector {
  connect(): Promise<DeviceSession>
  disconnect(): Promise<void>
  install(appPath: string): Promise<void>
  uninstall(packageName: string): Promise<void>
  launch(packageName: string, activity?: string): Promise<void>
  isConnected(): Promise<boolean>
}

export interface DeviceSession {
  id: string
  name: string
  type: string
  platform: string
}

export interface IElementExtractor {
  extract(tree: UITreeNode): Promise<UIString[]>
}

export interface IReporter {
  report(result: unknown): Promise<void>
}

export interface UITreeNode {
  id: string
  platform: string
  nativeType: string
  role: string
  bounds: Bounds
  text?: string
  label?: string
  hint?: string
  resourceId?: string
  packageName?: string
  clickable: boolean
  enabled: boolean
  visible: boolean
  children: UITreeNode[]
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface UIString {
  key?: string
  text: string
  source: 'text' | 'label' | 'hint'
  elementId: string
  screen: string
}

export class PluginHost implements PluginContext {
  private deviceDrivers = new Map<string, DriverFactory>()
  private elementExtractors = new Map<string, IElementExtractor>()
  private reporters = new Map<string, IReporter>()
  private plugins: VTestPlugin[] = []

  async load(plugin: VTestPlugin): Promise<void> {
    this.plugins.push(plugin)
    await plugin.activate(this)
  }

  registerDeviceDriver(type: string, factory: DriverFactory): void {
    this.deviceDrivers.set(type, factory)
  }

  registerElementExtractor(name: string, extractor: IElementExtractor): void {
    this.elementExtractors.set(name, extractor)
  }

  registerReporter(name: string, reporter: IReporter): void {
    this.reporters.set(name, reporter)
  }

  getDeviceDriver(type: string): DriverFactory | undefined {
    return this.deviceDrivers.get(type)
  }

  getElementExtractor(name: string): IElementExtractor | undefined {
    return this.elementExtractors.get(name)
  }

  getReporter(name: string): IReporter | undefined {
    return this.reporters.get(name)
  }

  async unloadAll(): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.deactivate?.()
    }
    this.plugins = []
    this.deviceDrivers.clear()
    this.elementExtractors.clear()
    this.reporters.clear()
  }
}
