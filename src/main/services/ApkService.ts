import { getDatabase } from '../core/database/connection'
import { Logger } from '../core/logger/Logger'
import { APKInfo, APKUploadResult } from '../core/contracts/apk.contract'
import { v4 as uuidv4 } from 'uuid'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const logger = Logger.getLogger('apk')

export type { APKInfo, APKUploadResult }

export interface ParseAPKOptions {
  filePath: string
  projectId: string
}

export class ApkService {
  /**
   * Upload and parse an APK file
   */
  public async uploadAndParseAPK(options: ParseAPKOptions): Promise<APKUploadResult> {
    const taskId = uuidv4()
    
    try {
      // Validate file exists
      if (!fs.existsSync(options.filePath)) {
        return {
          taskId,
          status: 'error',
          error: `File not found: ${options.filePath}`
        }
      }

      // Parse APK info from file
      const apkInfo = await this.parseAPKInfo(options.filePath)

      // Store in database
      const db = getDatabase()
      await db('apk_info').insert({
        project_id: options.projectId,
        app_name: apkInfo.appName,
        package_name: apkInfo.packageName,
        version: apkInfo.version,
        version_code: apkInfo.versionCode,
        min_sdk: apkInfo.minSdk,
        target_sdk: apkInfo.targetSdk,
        activities: JSON.stringify(apkInfo.activities),
        permissions: JSON.stringify(apkInfo.permissions),
        file_size: apkInfo.fileSize,
        md5: apkInfo.md5,
        parse_status: apkInfo.parseStatus,
        error: apkInfo.error || null
      })

      logger.info(`APK parsed successfully: ${apkInfo.packageName} v${apkInfo.version}`)

      return {
        taskId,
        status: 'completed',
        apkInfo
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to parse APK: ${errorMsg}`)
      return {
        taskId,
        status:        'error',
        error: errorMsg
      }
    }
  }

  /**
   * Parse APK file metadata
   */
  public async parseAPKInfo(filePath: string): Promise<APKInfo> {
    const stats = fs.statSync(filePath)
    const fileBuffer = fs.readFileSync(filePath)
    const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex')

    // Try to extract manifest info using simple heuristics
    // In a real implementation, this would use a proper APK parser
    const fileContent = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 65536))
    
    // Extract package name from file content
    const packageMatch = fileContent.match(/package="([^"]+)"/)
    const packageName = packageMatch ? packageMatch[1] : this.extractPackageName(filePath)
    
    // Extract version name
    const versionMatch = fileContent.match(/versionName="([^"]+)"/)
    const version = versionMatch ? versionMatch[1] : '1.0.0'
    
    // Extract version code
    const versionCodeMatch = fileContent.match(/versionCode="(\d+)"/)
    const versionCode = versionCodeMatch ? parseInt(versionCodeMatch[1], 10) : 1
    
    // Extract minSdk
    const minSdkMatch = fileContent.match(/minSdkVersion="(\d+)"/)
    const minSdk = minSdkMatch ? parseInt(minSdkMatch[1], 10) : 21
    
    // Extract targetSdk
    const targetSdkMatch = fileContent.match(/targetSdkVersion="(\d+)"/)
    const targetSdk = targetSdkMatch ? parseInt(targetSdkMatch[1], 10) : minSdk
    
    // Extract activities
    const activities: string[] = []
    const activityRegex = /activity\s+android:name="([^"]+)"/g
    let match: RegExpExecArray | null
    while ((match = activityRegex.exec(fileContent)) !== null) {
      activities.push(match[1])
    }
    
    // Extract permissions
    const permissions: string[] = []
    const permissionRegex = /uses-permission\s+android:name="([^"]+)"/g
    while ((match = permissionRegex.exec(fileContent)) !== null) {
      permissions.push(match[1])
    }

    return {
      appName: path.basename(filePath, '.apk'),
      packageName,
      version,
      versionCode,
      minSdk,
      targetSdk,
      activities,
      permissions,
      fileSize: stats.size,
      md5: md5Hash,
      parseStatus: 'success'
    }
  }

  /**
   * Get APK info by project ID
   */
  public async getAPKInfoByProjectId(projectId: string): Promise<APKInfo | null> {
    const db = getDatabase()
    const row = await db('apk_info').where('project_id', projectId).first()
    
    if (!row) return null
    
    return this.mapToAPKInfo(row)
  }

  /**
   * Delete APK info by project ID
   */
  public async deleteAPKInfo(projectId: string): Promise<boolean> {
    const db = getDatabase()
    const result = await db('apk_info').where('project_id', projectId).del()
    return result > 0
  }

  private mapToAPKInfo(row: Record<string, unknown>): APKInfo {
    return {
      appName: String(row.app_name),
      packageName: String(row.package_name),
      version: String(row.version),
      versionCode: Number(row.version_code),
      minSdk: Number(row.min_sdk),
      targetSdk: Number(row.target_sdk),
      activities: JSON.parse(String(row.activities)),
      permissions: JSON.parse(String(row.permissions)),
      fileSize: Number(row.file_size),
      md5: String(row.md5),
      parseStatus: String(row.parse_status) as 'success' | 'error',
      error: row.error ? String(row.error) : undefined
    }
  }

  private extractPackageName(filePath: string): string {
    const baseName = path.basename(filePath, '.apk')
    return `com.example.${baseName.toLowerCase().replace(/[^a-z0-9]/g, '')}`
  }
}

export const apkService = new ApkService()
