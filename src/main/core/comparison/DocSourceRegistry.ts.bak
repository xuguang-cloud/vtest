/**
 * US-06: Document Source Adapter Registry
 *
 * Plugin registry for PRD/design document sources.
 * Each adapter handles fetching and parsing from a specific
 * document platform (钉钉, 飞书, Figma, 网页, local files).
 */

import {
  DocSourceAdapter,
  DocSourceType,
  IDocSourceRegistry,
  ConfigValidationResult,
  PRDRequirement,
  DesignAsset
} from '../contracts/comparison.contract'

export class DocSourceRegistry implements IDocSourceRegistry {
  private adapters: Map<DocSourceType, DocSourceAdapter> = new Map()

  register(adapter: DocSourceAdapter): void {
    if (this.adapters.has(adapter.type)) {
      throw new Error(`DocSourceAdapter for type "${adapter.type}" is already registered`)
    }
    this.adapters.set(adapter.type, adapter)
  }

  get(type: DocSourceType): DocSourceAdapter | null {
    return this.adapters.get(type) || null
  }

  listRegistered(): DocSourceType[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Fetch PRD requirements using the configured adapter.
   */
  async fetchPRD(
    type: DocSourceType,
    config: Record<string, unknown>
  ): Promise<PRDRequirement[]> {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new Error(`No adapter registered for source type: ${type}`)
    }

    const validation = await adapter.validateConfig(config)
    if (!validation.valid) {
      throw new Error(`Invalid config for ${type}: ${validation.errors.join(', ')}`)
    }

    return adapter.fetchPRD(config)
  }

  /**
   * Fetch design assets using the configured adapter.
   */
  async fetchDesignAssets(
    type: DocSourceType,
    config: Record<string, unknown>
  ): Promise<DesignAsset[]> {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new Error(`No adapter registered for source type: ${type}`)
    }

    const validation = await adapter.validateConfig(config)
    if (!validation.valid) {
      throw new Error(`Invalid config for ${type}: ${validation.errors.join(', ')}`)
    }

    return adapter.fetchDesignAssets(config)
  }
}

/** Singleton registry instance */
export const docSourceRegistry = new DocSourceRegistry()