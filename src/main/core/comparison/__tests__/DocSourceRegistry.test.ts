import { describe, it, expect, jest, beforeEach } from "@jest/globals"
import { DocSourceRegistry } from '../DocSourceRegistry'
import { DocSourceAdapter, DocSourceType, PRDRequirement, DesignAsset, ConfigValidationResult } from '../../contracts/comparison.contract'

function createAdapter(type: DocSourceType, overrides: Partial<DocSourceAdapter> = {}): DocSourceAdapter {
  return {
    type,
    fetchPRD: jest.fn().mockResolvedValue([]),
    fetchDesignAssets: jest.fn().mockResolvedValue([]),
    validateConfig: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
    ...overrides,
  }
}

describe('DocSourceRegistry', () => {
  let registry: DocSourceRegistry

  beforeEach(() => {
    registry = new DocSourceRegistry()
  })

  describe('register', () => {
    it('should register a new adapter', () => {
      const adapter = createAdapter('local_file')
      registry.register(adapter)
      expect(registry.get('local_file')).toBe(adapter)
      expect(registry.listRegistered()).toContain('local_file')
    })

    it('should throw when registering an adapter with a duplicate type', () => {
      registry.register(createAdapter('local_file'))
      expect(() => registry.register(createAdapter('local_file'))).toThrow(
        'DocSourceAdapter for type "local_file" is already registered',
      )
    })
  })

  describe('get', () => {
    it('should return null for unregistered types', () => {
      expect(registry.get('figma')).toBeNull()
    })
  })

  describe('listRegistered', () => {
    it('should return an empty array initially', () => {
      expect(registry.listRegistered()).toEqual([])
    })

    it('should list all registered adapter types', () => {
      registry.register(createAdapter('local_file'))
      registry.register(createAdapter('figma'))
      const types = registry.listRegistered()
      expect(types).toHaveLength(2)
      expect(types).toContain('local_file')
      expect(types).toContain('figma')
    })
  })

  describe('fetchPRD', () => {
    it('should fetch PRD using the registered adapter', async () => {
      const prd: PRDRequirement[] = [
        {
          id: 'req-001',
          title: 'Test',
          priority: 'P0',
          acceptanceCriteria: [],
          uiRequirements: [],
          screens: [],
        },
      ]
      const adapter = createAdapter('local_file', {
        fetchPRD: jest.fn().mockResolvedValue(prd),
      })
      registry.register(adapter)
      const result = await registry.fetchPRD('local_file', { prdFilePath: '/tmp/prd.json' })
      expect(result).toBe(prd)
      expect(adapter.fetchPRD).toHaveBeenCalledWith({ prdFilePath: '/tmp/prd.json' })
    })

    it('should throw when no adapter is registered for the type', async () => {
      await expect(registry.fetchPRD('local_file', {})).rejects.toThrow(
        'No adapter registered for source type: local_file',
      )
    })

    it('should throw when adapter config validation fails', async () => {
      const adapter = createAdapter('local_file', {
        validateConfig: jest.fn().mockResolvedValue({ valid: false, errors: ['missing path'] }),
      })
      registry.register(adapter)
      await expect(registry.fetchPRD('local_file', {})).rejects.toThrow(
        'Invalid config for local_file: missing path',
      )
    })
  })

  describe('fetchDesignAssets', () => {
    it('should fetch design assets using the registered adapter', async () => {
      const assets: DesignAsset[] = [
        {
          id: 'design-1',
          screenName: 'LoginActivity',
          activity: 'LoginActivity',
          imageData: Buffer.alloc(0),
          filePath: '/designs/login.png',
        },
      ]
      const adapter = createAdapter('local_file', {
        fetchDesignAssets: jest.fn().mockResolvedValue(assets),
      })
      registry.register(adapter)
      const result = await registry.fetchDesignAssets('local_file', { designDirPath: '/tmp/designs' })
      expect(result).toBe(assets)
      expect(adapter.fetchDesignAssets).toHaveBeenCalledWith({ designDirPath: '/tmp/designs' })
    })

    it('should throw when no adapter is registered for the type', async () => {
      await expect(registry.fetchDesignAssets('figma', {})).rejects.toThrow(
        'No adapter registered for source type: figma',
      )
    })

    it('should throw when adapter config validation fails', async () => {
      const adapter = createAdapter('figma', {
        validateConfig: jest.fn().mockResolvedValue({ valid: false, errors: ['invalid token'] }),
      })
      registry.register(adapter)
      await expect(registry.fetchDesignAssets('figma', {})).rejects.toThrow(
        'Invalid config for figma: invalid token',
      )
    })
  })
})
