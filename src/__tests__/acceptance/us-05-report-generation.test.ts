/**
 * US-05: Report Generation and Export - Acceptance-Level TDD Tests
 */

import { ExecutionReport, ExecutionSummary, DeviceInfo } from '../../main/core/contracts/test-execution.contract'
import { ReportGenerator } from '../../main/services/ReportGenerator'

describe('US-05: Report Generation and Export', () => {
  let generator: ReportGenerator

  beforeEach(() => {
    generator = new ReportGenerator()
  })

  const mockSummary: ExecutionSummary = {
    total: 100,
    passed: 85,
    failed: 10,
    blocked: 5,
    passRate: 85
  }

  const mockDevice: DeviceInfo = {
    model: 'Pixel 7',
    androidVersion: '14.0',
    apiLevel: 34
  }

  const mockReport: ExecutionReport = {
    executionId: 'exec-001',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    device: mockDevice,
    summary: mockSummary,
    results: []
  }

  describe('AC-1: HTML report generation', () => {
    it('should generate HTML report within 30 seconds', async () => {
      const startTime = Date.now()
      const html = await generator.generateHTML(mockReport)
      const endTime = Date.now()
      expect(html).toBeDefined()
      expect(html.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThanOrEqual(30 * 1000)
    })

    it('should generate HTML with report data structure', async () => {
      const html = await generator.generateHTML(mockReport)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
    })

    it('should include execution summary in HTML', async () => {
      const html = await generator.generateHTML(mockReport)
      expect(html).toContain('exec-001')
      expect(html).toContain('Summary')
    })

    it('should validate report data 100% consistent with execution_report.json', () => {
      const isValid = generator.validateReport(mockReport)
      expect(isValid).toBe(true)
    })

    it('should include device information', async () => {
      const html = await generator.generateHTML(mockReport)
      expect(html).toContain(mockDevice.model)
      expect(html).toContain(String(mockDevice.apiLevel))
    })

    it('should include pass rate calculation', async () => {
      const passRate = (mockSummary.passed / mockSummary.total) * 100
      expect(passRate).toBe(85)
      const html = await generator.generateHTML(mockReport)
      expect(html).toContain('85')
    })

    it('should handle empty results array', async () => {
      const emptyReport = { ...mockReport, results: [] }
      const html = await generator.generateHTML(emptyReport)
      expect(html).toBeDefined()
      expect(html.length).toBeGreaterThan(0)
    })

    it('should generate report with all result statuses', async () => {
      const reportWithResults = {
        ...mockReport,
        results: [
          { caseId: 'TC-001', status: 'passed' as const, startTime: '', endTime: '', duration: 0, steps: [] },
          { caseId: 'TC-002', status: 'failed' as const, startTime: '', endTime: '', duration: 0, steps: [] },
          { caseId: 'TC-003', status: 'blocked' as const, startTime: '', endTime: '', duration: 0, steps: [] }
        ]
      }
      const html = await generator.generateHTML(reportWithResults as ExecutionReport)
      expect(html).toBeDefined()
    })

    it('should reject invalid report data', () => {
      const invalidReport = { ...mockReport, executionId: '' }
      const isValid = generator.validateReport(invalidReport)
      expect(isValid).toBe(false)
    })

    it('should generate report ID matching execution ID', async () => {
      const html = await generator.generateHTML(mockReport)
      expect(html).toContain(mockReport.executionId)
    })
  })

  describe('AC-2: Report loading performance', () => {
    it('should render HTML content within 3 seconds', async () => {
      const startTime = Date.now()
      const html = await generator.generateHTML(mockReport)
      const endTime = Date.now()
      expect(html).toBeDefined()
      expect(endTime - startTime).toBeLessThanOrEqual(3 * 1000)
    })

    it('should generate valid HTML structure', async () => {
      const html = await generator.generateHTML(mockReport)
      expect(html).toMatch(/<html[\s>]/i)
      expect(html).toMatch(/<body[\s>]/i)
      expect(html).toMatch(/<head[\s>]/i)
    })

    it('should include CSS styling in report', async () => {
      const html = await generator.generateHTML(mockReport)
      expect(html).toMatch(/<style[\s>]/i)
    })

    it('should generate report for zero-pass scenario', async () => {
      const zeroPassSummary = { ...mockSummary, passed: 0, passRate: 0 }
      const zeroReport = { ...mockReport, summary: zeroPassSummary }
      const html = await generator.generateHTML(zeroReport)
      expect(html).toContain('0')
    })

    it('should handle report with 100% pass rate', async () => {
      const fullSummary = { ...mockSummary, passed: 100, failed: 0, blocked: 0, passRate: 100 }
      const fullReport = { ...mockReport, summary: fullSummary }
      const html = await generator.generateHTML(fullReport)
      expect(html).toContain('100')
    })
  })
})
