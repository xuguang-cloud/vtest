import { describe, it, expect, beforeEach } from "@jest/globals"
import { LocalFileAdapter } from '../adapters/LocalFileAdapter'

describe('LocalFileAdapter', () => {
  let adapter: LocalFileAdapter

  beforeEach(() => {
    adapter = new LocalFileAdapter()
  })

  describe('validateConfig', () => {
    it('should return valid when prdFilePath is provided', async () => {
      const result = await adapter.validateConfig({ prdFilePath: '/tmp/prd.json' })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return invalid when prdFilePath is missing', async () => {
      const result = await adapter.validateConfig({})
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('prdFilePath is required')
    })
  })

  describe('fetchPRD', () => {
    it('should return mock PRD requirements', async () => {
      const result = await adapter.fetchPRD({ prdFilePath: '/tmp/prd.json' })
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].id).toBe('req-001')
      expect(result[0].title).toBe('Login Screen')
      expect(result[0].uiRequirements.length).toBeGreaterThan(0)
    })

    it('should include expected activities and screens', async () => {
      const result = await adapter.fetchPRD({ prdFilePath: '/tmp/prd.json' })
      const loginReq = result.find(r => r.id === 'req-001')
      expect(loginReq?.screens).toContain('LoginActivity')
      expect(loginReq?.expectedActivities).toContain('LoginActivity')
    })
  })

  describe('fetchDesignAssets', () => {
    it('should return empty array when designDirPath is not provided', async () => {
      const result = await adapter.fetchDesignAssets({ prdFilePath: '/tmp/prd.json' })
      expect(result).toEqual([])
    })

    it('should return mock design assets when designDirPath is provided', async () => {
      const result = await adapter.fetchDesignAssets({
        prdFilePath: '/tmp/prd.json',
        designDirPath: '/tmp/designs',
      })
      expect(result.length).toBe(2)
      expect(result.some(a => a.screenName === 'LoginActivity')).toBe(true)
      expect(result.some(a => a.screenName === 'HomeActivity')).toBe(true)
      expect(result[0].filePath.startsWith('/tmp/designs')).toBe(true)
    })

    it('should include correct metadata for each design asset', async () => {
      const result = await adapter.fetchDesignAssets({
        prdFilePath: '/tmp/prd.json',
        designDirPath: '/tmp/designs',
      })
      result.forEach(asset => {
        expect(asset.imageData).toEqual(Buffer.alloc(0))
        expect(asset.metadata?.source).toBe('local_file')
      })
    })
  })
})
