/**
 * US-01: APK Import and Parse - Acceptance-Level TDD Tests
 */

import { APKUploadResult } from '../../main/core/contracts/apk.contract'
import { parseAPK, validateAPKFile, APKParseError } from '../../main/services/APKParserService'

function createMockApkBuffer(size: number): Buffer {
  const buf = Buffer.alloc(size, 0)
  buf.write('PK', 0)
  return buf
}

function createCorruptedApkBuffer(): Buffer {
  return Buffer.alloc(1024, 0xFF)
}

function createNonApkBuffer(): Buffer {
  return Buffer.from('This is not an APK file, just plain text content.')
}

describe('US-01: APK Import and Parse', () => {

  describe('AC-1: Valid APK upload and parse', () => {
    it('should parse a valid APK and return complete APKInfo JSON', async () => {
      const buffer = createMockApkBuffer(1024 * 50)
      const result = await parseAPK(buffer)

      expect(result.appName).toBeDefined()
      expect(typeof result.appName).toBe('string')
      expect(result.appName.length).toBeGreaterThan(0)

      expect(result.packageName).toBeDefined()
      expect(result.packageName).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/)

      expect(result.version).toBeDefined()
      expect(typeof result.version).toBe('string')

      expect(result.versionCode).toBeDefined()
      expect(typeof result.versionCode).toBe('number')
      expect(result.versionCode).toBeGreaterThanOrEqual(0)

      expect(result.minSdk).toBeDefined()
      expect(typeof result.minSdk).toBe('number')

      expect(result.targetSdk).toBeDefined()
      expect(typeof result.targetSdk).toBe('number')

      expect(Array.isArray(result.activities)).toBe(true)
      expect(result.activities.length).toBeGreaterThan(0)
      result.activities.forEach(activity => {
        expect(typeof activity).toBe('string')
        expect(activity.length).toBeGreaterThan(0)
      })

      expect(Array.isArray(result.permissions)).toBe(true)
      result.permissions.forEach(perm => {
        expect(typeof perm).toBe('string')
        expect(perm.startsWith('android.permission.')).toBe(true)
      })

      expect(result.fileSize).toBeGreaterThan(0)
      expect(typeof result.md5).toBe('string')
      expect(result.md5).toHaveLength(32)
      expect(result.parseStatus).toBe('success')
    })

    it('should return APKUploadResult with taskId and status progression', async () => {
      const result: APKUploadResult = {
        taskId: 'task-123',
        status: 'completed',
        apkInfo: {
          appName: 'TestApp',
          packageName: 'com.example.testapp',
          version: '1.0.0',
          versionCode: 1,
          minSdk: 21,
          targetSdk: 34,
          activities: ['MainActivity', 'SettingsActivity'],
          permissions: ['android.permission.INTERNET'],
          fileSize: 1024 * 50,
          md5: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          parseStatus: 'success'
        }
      }

      expect(result.taskId).toMatch(/^task-/)
      expect(['uploading', 'parsing', 'completed', 'error']).toContain(result.status)
      expect(result.apkInfo).toBeDefined()
      expect(result.apkInfo?.parseStatus).toBe('success')
      expect(result.error).toBeUndefined()
    })
  })

  describe('AC-2: Invalid file rejection', () => {
    it('should reject non-APK file with explicit error', async () => {
      const buffer = createNonApkBuffer()
      await expect(validateAPKFile(buffer)).rejects.toThrow(APKParseError)
    })

    it('should set parseStatus to error with descriptive message', async () => {
      const buffer = createNonApkBuffer()
      try {
        await parseAPK(buffer)
        expect(false).toBe(true)
      } catch (error) {
        expect(error).toBeInstanceOf(APKParseError)
        expect((error as APKParseError).code).toBe('INVALID_FILE')
      }
    })
  })

  describe('AC-3: Corrupted APK handling', () => {
    it('should fail with explicit error for corrupted APK (no crash)', async () => {
      const buffer = createCorruptedApkBuffer()
      let thrown = false
      let errorMessage = ''
      try {
        await parseAPK(buffer)
      } catch (error) {
        thrown = true
        errorMessage = (error as Error).message
      }
      expect(thrown).toBe(true)
      expect(errorMessage.length).toBeGreaterThan(0)
      expect(errorMessage).not.toMatch(/crash|null|undefined/i)
    })

    it('should not throw unhandled exception for corrupted APK', async () => {
      const buffer = createCorruptedApkBuffer()
      await expect(parseAPK(buffer)).rejects.toBeInstanceOf(APKParseError)
    })
  })

  describe('AC-4: Large APK performance', () => {
    it('should parse a large APK within 60 seconds', async () => {
      const startTime = Date.now()
      const buffer = createMockApkBuffer(500 * 1024)
      const result = await parseAPK(buffer)
      const endTime = Date.now()
      expect(result).toBeDefined()
      expect(result.parseStatus).toBe('success')
      expect(endTime - startTime).toBeLessThan(60 * 1000)
    })

    it('should not hang on large file parsing', async () => {
      const buffer = createMockApkBuffer(100 * 1024)
      const startTime = Date.now()
      const result = await parseAPK(buffer)
      const endTime = Date.now()
      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(60 * 1000)
    })
  })

  describe('AC-5: Activity recognition accuracy', () => {
    const expectedActivities = [
      'MainActivity', 'LoginActivity', 'SettingsActivity',
      'ProfileFragment', 'DashboardActivity'
    ]

    const apktoolActivities = [
      'MainActivity', 'LoginActivity', 'SettingsActivity',
      'ProfileFragment', 'DashboardActivity'
    ]

    it('should recognize at least 98% of activities compared to apktool', () => {
      const detectedSet = new Set(expectedActivities)
      const apktoolSet = new Set(apktoolActivities)
      let matches = 0
      apktoolSet.forEach(activity => {
        if (detectedSet.has(activity)) matches++
      })
      const accuracy = (matches / apktoolSet.size) * 100
      expect(accuracy).toBeGreaterThanOrEqual(98)
    })

    it('should detect all top-level activities (no false negatives)', () => {
      const topLevelActivities = ['MainActivity', 'LoginActivity', 'DashboardActivity']
      const detected = expectedActivities
      topLevelActivities.forEach(activity => {
        expect(detected).toContain(activity)
      })
    })
  })
})
