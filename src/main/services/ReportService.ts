import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../core/database/connection'
import { Logger } from '../core/logger/Logger'
import { ExecutionReport } from '../core/contracts/test-execution.contract'
import { v4 as uuidv4 } from 'uuid'

const logger = Logger.getLogger('report')

export interface ReportConfig {
  projectName: string
  includeScreenshots: boolean
  includeDeviceInfo: boolean
  theme: 'light' | 'dark'
}

export interface GeneratedReport {
  id: string
  format: 'html' | 'pdf'
  filePath: string
  createdAt: Date
  fileSize: number
  content: string
}

export class ReportService {
  public async generateHTMLReport(
    report: ExecutionReport,
    config: ReportConfig
  ): Promise<GeneratedReport> {
    const reportId = uuidv4()
    const outputPath = path.join(process.cwd(), 'reports', `${reportId}.html`)
    
    const reportsDir = path.dirname(outputPath)
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }
    
    const html = this.buildHTMLContent(report, config)
    fs.writeFileSync(outputPath, html, 'utf-8')
    
    const stats = fs.statSync(outputPath)
    
    logger.info(`HTML report generated: ${outputPath}`)
    
    return {
      id: reportId,
      format: 'html',
      filePath: outputPath,
      createdAt: new Date(),
      fileSize: stats.size,
      content: html
    }
  }

  public async exportReport(
    report: ExecutionReport,
    format: 'html' | 'pdf',
    config: ReportConfig
  ): Promise<GeneratedReport> {
    if (format === 'html') {
      return this.generateHTMLReport(report, config)
    }
    
    const reportId = uuidv4()
    const outputPath = path.join(process.cwd(), 'reports', `${reportId}.pdf`)
    
    const reportsDir = path.dirname(outputPath)
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }
    
    const pdfContent = this.buildPDFContent(report, config)
    fs.writeFileSync(outputPath, pdfContent, 'utf-8')
    
    const stats = fs.statSync(outputPath)
    
    logger.info(`PDF report exported: ${outputPath}`)
    
    return {
      id: reportId,
      format: 'pdf',
      filePath: outputPath,
      createdAt: new Date(),
      fileSize: stats.size,
      content: pdfContent
    }
  }

  public getReportSummary(report: ExecutionReport): string {
    const { summary } = report
    const lines = [
      '============================================',
      'VTest Execution Report Summary',
      '============================================',
      `Total Tests: ${summary.total}`,
      `Passed: ${summary.passed}`,
      `Failed: ${summary.failed}`,
      `Blocked: ${summary.blocked}`,
      `Pass Rate: ${summary.passRate.toFixed(2)}%`,
      '============================================',
      `Device: ${report.device.model} (Android ${report.device.androidVersion})`,
      '============================================'
    ]
    return lines.join('\n')
  }

  public async saveReport(report: ExecutionReport, format: string, filePath: string): Promise<void> {
    const db = getDatabase()
    await db('reports').insert({
      project_id: report.executionId,
      test_run_id: report.executionId,
      format,
      file_path: filePath,
      total_cases: report.summary.total,
      passed_cases: report.summary.passed,
      failed_cases: report.summary.failed,
      blocked_cases: report.summary.blocked,
      pass_rate: report.summary.passRate
    })
    
    logger.info(`Report saved to database: ${filePath}`)
  }

  private buildHTMLContent(report: ExecutionReport, config: ReportConfig): string {
    const { summary, results, device } = report
    const backgroundColor = config.theme === 'dark' ? '#1a1a2e' : '#f5f5f5'
    const textColor = config.theme === 'dark' ? '#e0e0e0' : '#333333'
    const cardBg = config.theme === 'dark' ? '#16213e' : '#ffffff'
    const passedPercent = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0
    
    const resultsHtml = results.map(result => {
      const stepHtml = result.steps.map(step => `
        <tr>
          <td>Step ${step.step}</td>
          <td>${step.status}</td>
        </tr>
      `).join('')
      
      return `
        <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background: ${cardBg};">
          <h4>${result.caseId} - ${result.status.toUpperCase()}</h4>
          <p>Duration: ${result.duration}ms</p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: ${config.theme === 'dark' ? '#0f3460' : '#e8e8e8'};">
                <th style="padding: 8px; text-align: left;">Step</th>
                <th style="padding: 8px; text-align: left;">Status</th>
              </tr>
            </thead>
            <tbody>${stepHtml}</tbody>
          </table>
        </div>
      `
    }).join('')
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VTest Report - ${config.projectName}</title>
  <style>
    body { font-family: Arial, sans-serif; background: ${backgroundColor}; color: ${textColor}; margin: 0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { text-align: center; padding: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .summary-card { background: ${cardBg}; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card h3 { margin: 0; font-size: 24px; }
    .pass-rate { background: ${passedPercent >= 80 ? '#4caf50' : passedPercent >= 50 ? '#ff9800' : '#f44336'}; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VTest Execution Report</h1>
      <h2>${config.projectName}</h2>
    </div>
    <div class="summary">
      <div class="summary-card"><h3>${summary.total}</h3><p>Total</p></div>
      <div class="summary-card"><h3>${summary.passed}</h3><p>Passed</p></div>
      <div class="summary-card"><h3>${summary.failed}</h3><p>Failed</p></div>
      <div class="summary-card pass-rate"><h3>${summary.passRate.toFixed(1)}%</h3><p>Pass Rate</p></div>
    </div>
    ${config.includeDeviceInfo ? `
    <div style="background: ${cardBg}; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3>Device Information</h3>
      <p>Model: ${device.model}</p>
      <p>Android Version: ${device.androidVersion}</p>
      <p>API Level: ${device.apiLevel}</p>
    </div>
    ` : ''}
    <h3>Test Results</h3>
    ${resultsHtml}
    <footer style="text-align: center; margin-top: 40px; padding: 20px; color: #999;">
      <p>Generated by VTest on ${new Date().toISOString()}</p>
    </footer>
  </div>
</body>
</html>`
  }

  private buildPDFContent(report: ExecutionReport, _config: ReportConfig): string {
    return this.getReportSummary(report)
  }
}

export const reportService = new ReportService()
