/**
 * PermissionAuditor — 权限审计器
 * 记录和审计用户的权限使用情况
 */

export interface PermissionRecord {
  resource: string
  action: string
  timestamp: number
  granted: boolean
  reason?: string
}

export interface AuditReportEntry {
  user: string
  totalRequests: number
  grantedCount: number
  deniedCount: number
  lastAccessed: number
  topResources: Array<{ resource: string; count: number }>
}

export interface AuditReport {
  timestamp: number
  totalUsers: number
  totalRequests: number
  grantRate: number
  users: AuditReportEntry[]
}

export class PermissionAuditor {
  private permissions = new Map<string, PermissionRecord[]>()

  recordPermission(user: string, record: PermissionRecord): void {
    if (!this.permissions.has(user)) {
      this.permissions.set(user, [])
    }
    this.permissions.get(user)!.push(record)

    // 只保留最近1000条记录
    const records = this.permissions.get(user)!
    if (records.length > 1000) {
      records.splice(0, records.length - 1000)
    }
  }

  getRecords(user: string, options?: {
    startTime?: number
    endTime?: number
    resource?: string
    limit?: number
  }): PermissionRecord[] {
    let records = this.permissions.get(user) || []

    if (options?.startTime) {
      records = records.filter(r => r.timestamp >= options.startTime!)
    }
    if (options?.endTime) {
      records = records.filter(r => r.timestamp <= options.endTime!)
    }
    if (options?.resource) {
      records = records.filter(r => r.resource === options.resource)
    }

    records.sort((a, b) => b.timestamp - a.timestamp)

    if (options?.limit) {
      records = records.slice(0, options.limit)
    }

    return records
  }

  getGrantRate(user: string): number {
    const records = this.permissions.get(user) || []
    if (records.length === 0) return 1

    const granted = records.filter(r => r.granted).length
    return granted / records.length
  }

  getTopResources(user: string, limit: number = 5): Array<{ resource: string; count: number }> {
    const records = this.permissions.get(user) || []
    const resourceCount = new Map<string, number>()

    for (const record of records) {
      resourceCount.set(record.resource, (resourceCount.get(record.resource) || 0) + 1)
    }

    return Array.from(resourceCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([resource, count]) => ({ resource, count }))
  }

  generateAuditReport(): AuditReport {
    let totalRequests = 0
    let totalGranted = 0

    const users: AuditReportEntry[] = Array.from(this.permissions.entries())
      .map(([user, records]) => {
        const grantedCount = records.filter(r => r.granted).length
        totalRequests += records.length
        totalGranted += grantedCount

        return {
          user,
          totalRequests: records.length,
          grantedCount,
          deniedCount: records.length - grantedCount,
          lastAccessed: records.length > 0 ? records[records.length - 1].timestamp : 0,
          topResources: this.getTopResources(user)
        }
      })
      .sort((a, b) => b.totalRequests - a.totalRequests)

    return {
      timestamp: Date.now(),
      totalUsers: users.length,
      totalRequests,
      grantRate: totalRequests > 0 ? totalGranted / totalRequests : 1,
      users
    }
  }

  generateHTMLReport(): string {
    const report = this.generateAuditReport()
    const userRows = report.users.map(u => `
      <tr>
        <td>${u.user}</td>
        <td>${u.totalRequests}</td>
        <td>${u.grantedCount}</td>
        <td>${u.deniedCount}</td>
        <td>${u.totalRequests > 0 ? (u.grantedCount / u.totalRequests * 100).toFixed(1) : 'N/A'}%</td>
        <td>${new Date(u.lastAccessed).toLocaleString()}</td>
        <td>${u.topResources.map(r => `${r.resource}(${r.count})`).join(', ')}</td>
      </tr>
    `).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Permission Audit Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 20px; }
    .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; }
  </style>
</head>
<body>
  <h1>🔒 Permission Audit Report</h1>
  <div class="summary">
    <p>Users: ${report.totalUsers} | Total Requests: ${report.totalRequests} | Grant Rate: ${(report.grantRate * 100).toFixed(1)}%</p>
    <p>Generated: ${new Date(report.timestamp).toISOString()}</p>
  </div>
  <table>
    <thead><tr><th>User</th><th>Requests</th><th>Granted</th><th>Denied</th><th>Grant %</th><th>Last Access</th><th>Top Resources</th></tr></thead>
    <tbody>${userRows}</tbody>
  </table>
</body>
</html>`
  }

  clear(): void {
    this.permissions.clear()
  }
}