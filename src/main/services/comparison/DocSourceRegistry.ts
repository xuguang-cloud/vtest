import { EventEmitter } from 'events'
import { Logger } from '../../core/logger/Logger'
import {
  DocSourceAdapter,
  DocSourceType,
  ConfigValidationResult,
  PRDRequirement,
  DesignAsset
} from '../../core/contracts/comparison.contract'

const logger = Logger.getLogger('doc-source-registry')

/**
 * DocSourceRegistry - Plugin registry for document source adapters
 * 
 * Supports adapters for: dingtalk, feishu, figma, webpage, local_file
 * Each adapter fetches PRD requirements and design assets from its source.
 */
export class DocSourceRegistry extends EventEmitter {
  private adapters: Map<DocSourceType, DocSourceAdapter> = new Map()

  /**
   * Register a new document source adapter
   */
  public register(adapter: DocSourceAdapter): void {
    this.adapters.set(adapter.type, adapter)
    logger.info(`Registered document source adapter: ${adapter.type}`)
    this.emit('adapter:registered', { type: adapter.type })
  }

  /**
   * Get an adapter by source type
   */
  public get(type: DocSourceType): DocSourceAdapter | null {
    return this.adapters.get(type) || null
  }

  /**
   * List all registered adapter types
   */
  public listRegistered(): DocSourceType[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Check if a type is registered
   */
  public isRegistered(type: DocSourceType): boolean {
    return this.adapters.has(type)
  }

  /**
   * Fetch PRD requirements from a document source
   */
  public async fetchPRD(
    type: DocSourceType,
    config: Record<string, unknown>
  ): Promise<PRDRequirement[]> {
    const adapter = this.get(type)
    if (!adapter) {
      throw new Error(`No adapter registered for type: ${type}`)
    }

    // Validate config before fetching
    const validation = await adapter.validateConfig(config)
    if (!validation.valid) {
      throw new Error(`Invalid config for ${type}: ${validation.errors.join(', ')}`)
    }

    logger.info(`Fetching PRD from ${type}`)
    return adapter.fetchPRD(config)
  }

  /**
   * Fetch design assets from a document source
   */
  public async fetchDesignAssets(
    type: DocSourceType,
    config: Record<string, unknown>
  ): Promise<DesignAsset[]> {
    const adapter = this.get(type)
    if (!adapter) {
      throw new Error(`No adapter registered for type: ${type}`)
    }

    const validation = await adapter.validateConfig(config)
    if (!validation.valid) {
      throw new Error(`Invalid config for ${type}: ${validation.errors.join(', ')}`)
    }

    logger.info(`Fetching design assets from ${type}`)
    return adapter.fetchDesignAssets(config)
  }

  /**
   * Validate a document source configuration
   */
  public async validateConfig(
    type: DocSourceType,
    config: Record<string, unknown>
  ): Promise<ConfigValidationResult> {
    const adapter = this.get(type)
    if (!adapter) {
      return {
        valid: false,
        errors: [`No adapter registered for type: ${type}`]
      }
    }

    return adapter.validateConfig(config)
  }
}

// --- Built-in Adapters ---

/**
 * Local File Adapter - Reads PRD and design from local filesystem
 */
export class LocalFileAdapter implements DocSourceAdapter {
  public readonly type: DocSourceType = 'local_file'

  async fetchPRD(config: Record<string, unknown>): Promise<PRDRequirement[]> {
    const filePath = config.filePath as string
    if (!filePath) {
      throw new Error('Local file config requires "filePath"')
    }

    logger.info(`Reading PRD from local file: ${filePath}`)

    // For now, return mock requirements
    // In production, this would read and parse a JSON/CSV file
    return [{
      id: 'local-req-001',
      title: 'Local PRD Requirement',
      priority: 'high',
      acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
      uiRequirements: [],
      screens: ['MainActivity']
    }]
  }

  async fetchDesignAssets(config: Record<string, unknown>): Promise<DesignAsset[]> {
    const folderPath = config.folderPath as string
    if (!folderPath) {
      throw new Error('Local file config requires "folderPath" for design assets')
    }

    logger.info(`Reading design assets from local folder: ${folderPath}`)

    // Return mock design assets
    return [{
      id: 'local-design-001',
      screenName: 'MainActivity',
      imageData: Buffer.from(''),
      filePath: `${folderPath}/main.png`
    }]
  }

  async validateConfig(config: Record<string, unknown>): Promise<ConfigValidationResult> {
    const errors: string[] = []

    if (!config.filePath && !config.folderPath) {
      errors.push('Local file config requires "filePath" or "folderPath"')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Register built-in adapters
export const docSourceRegistry = new DocSourceRegistry()
docSourceRegistry.register(new LocalFileAdapter())
