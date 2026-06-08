// Mock modules BEFORE any imports
jest.mock('../../core/database/connection')
jest.mock('../../core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}))

// Mock fs with all methods needed by knex and our code
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs')
  return {
    ...actualFs,
    existsSync: jest.fn().mockImplementation(() => true),
    statSync: jest.fn().mockImplementation(() => ({ size: 0 })),
    readFileSync: jest.fn(),
    readFile: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
  }
})

import { ApkService } from '../ApkService'
import { getDatabase } from '../../core/database/connection'
import * as fs from 'fs'

const mockGetDatabase = getDatabase as jest.Mock

describe('ApkService (US-01: APK导入与解析)', () => {
  let service: ApkService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ApkService()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('uploadAndParseAPK', () => {
    it('should parse APK and store info in database', async () => {
      const mockContent = Buffer.from(`
        <?xml version="1.0"?>
        <manifest package="com.example.testapp"
                  versionName="1.2.3"
                  versionCode="42">
          <uses-sdk minSdkVersion="21" targetSdkVersion="30"/>
          <activity android:name=".MainActivity"/>
          <activity android:name=".LoginActivity"/>
          <uses-permission android:name="android.permission.INTERNET"/>
          <uses-permission android:name="android.permission.CAMERA"/>
        </manifest>
      `)
      
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.statSync as jest.Mock).mockReturnValue({ size: 1024 })
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockContent)
      
      const mockInsert = jest.fn().mockReturnThis()
      const mockDb = jest.fn().mockReturnValue({ insert: mockInsert })
      mockGetDatabase.mockReturnValue(mockDb)
      
      const result = await service.uploadAndParseAPK({
        filePath: '/tmp/test.apk',
        projectId: '1'
      })

      expect(result.status).toBe('completed')
      expect(result.apkInfo).toBeDefined()
      expect(result.apkInfo?.packageName).toBe('com.example.testapp')
      expect(result.apkInfo?.version).toBe('1.2.3')
      expect(result.apkInfo?.versionCode).toBe(42)
      expect(result.apkInfo?.minSdk).toBe(21)
      expect(result.apkInfo?.targetSdk).toBe(30)
      expect(result.apkInfo?.activities).toContain('.MainActivity')
      expect(result.apkInfo?.activities).toContain('.LoginActivity')
      expect(result.apkInfo?.permissions).toContain('android.permission.INTERNET')
      expect(result.apkInfo?.permissions).toContain('android.permission.CAMERA')
    })

    it('should return error when file does not exist', async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      
      const result = await service.uploadAndParseAPK({
        filePath: '/nonexistent/test.apk',
        projectId: '1'
      })

      expect(result.status).toBe('error')
      expect(result.error).toContain('File not found')
    })
  })

  describe('parseAPKInfo', () => {
    it('should extract APK metadata from file', async () => {
      const mockContent = Buffer.from(`
        <manifest package="com.test.app" versionName="2.0.0" versionCode="100">
          <uses-sdk minSdkVersion="26" targetSdkVersion="33"/>
          <activity android:name=".HomeActivity"/>
          <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
        </manifest>
      `)
      
      ;(fs.statSync as jest.Mock).mockReturnValue({ size: 2048 })
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockContent)
      
      const result = await service.parseAPKInfo('/tmp/test.apk')
      
      expect(result.packageName).toBe('com.test.app')
      expect(result.version).toBe('2.0.0')
      expect(result.versionCode).toBe(100)
      expect(result.minSdk).toBe(26)
      expect(result.targetSdk).toBe(33)
      expect(result.activities).toContain('.HomeActivity')
      expect(result.permissions).toContain('android.permission.ACCESS_FINE_LOCATION')
      expect(result.fileSize).toBe(2048)
      expect(result.md5).toBeDefined()
      expect(result.parseStatus).toBe('success')
    })

    it('should use default values when manifest info is missing', async () => {
      ;(fs.statSync as jest.Mock).mockReturnValue({ size: 512 })
      ;(fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('some binary content'))
      
      const result = await service.parseAPKInfo('/tmp/unknown.apk')
      
      expect(result.packageName).toMatch(/^com\.example\./)
      expect(result.version).toBe('1.0.0')
      expect(result.versionCode).toBe(1)
      expect(result.minSdk).toBe(21)
      expect(result.parseStatus).toBe('success')
    })
  })

  describe('getAPKInfoByProjectId', () => {
    it('should return APK info when found', async () => {
      const mockRow = {
        app_name: 'TestApp',
        package_name: 'com.test.app',
        version: '1.0',
        version_code: 1,
        min_sdk: 21,
        target_sdk: 30,
        activities: '[]',
        permissions: '[]',
        file_size: 1024,
        md5: 'abc123',
        parse_status: 'success',
        error: null
      }
      
      const mockFirst = jest.fn().mockResolvedValue(mockRow)
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst })
      const mockDb = jest.fn().mockReturnValue({ where: mockWhere })
      mockGetDatabase.mockReturnValue(mockDb)
      
      const result = await service.getAPKInfoByProjectId('1')
      
      expect(result).not.toBeNull()
      expect(result?.packageName).toBe('com.test.app')
    })

    it('should return null when not found', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null)
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst })
      const mockDb = jest.fn().mockReturnValue({ where: mockWhere })
      mockGetDatabase.mockReturnValue(mockDb)
      
      const result = await service.getAPKInfoByProjectId('999')
      
      expect(result).toBeNull()
    })
  })
})
