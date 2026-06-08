import { ReportService, ReportConfig } from '../ReportService'
import { ExecutionReport, DeviceInfo } from '../../core/contracts/test-execution.contract'

jest.mock('../../core/logger/Logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}))

describe('ReportService (US-05: 报告生成与导出)', () => {
  let service: ReportService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ReportService()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const createMockDevice = (): DeviceInfo => ({
    model: 'emulator-5554',
    androidVersion: '12',
    apiLevel: 31
  })

  const createMockReport = (): ExecutionReport => ({
    executionId: 'run-001',
    startTime: new Date('2024-01-01T00:00:00Z').toISOString(),
    endTime: new Date('2024-01-01T00:02:00Z').toISOString(),
    device: createMockDevice(),
    summary: {
      total: 10,
      passed: 8,
      failed: 1,
      blocked: 1,
      passRate: 80
    },
    results: [
      {
        caseId: 'tc-001',
        status: 'passed',
        startTime: new Date('2024-01-01T00:00:00Z').toISOString(),
        endTime: new Date('2024-01-01T00:00:05Z').toISOString(),
        duration: 5000,
        steps: [
          { step: 1, status: 'passed' },
          { step: 2, status: 'passed' }
        ]
      },
      {
        caseId: 'tc-002',
        status: 'failed',
        startTime: new Date('2024-01-01T00:00:10Z').toISOString(),
        endTime: new Date('2024-01-01T00:00:13Z').toISOString(),
        duration: 3000,
        steps: [
          { step: 1, status: 'passed' },
          { step: 2, status: 'failed' }
        ]
      }
    ]
  })

  const createMockConfig = (): ReportConfig => ({
    projectName: 'Test Project',
    includeScreenshots: true,
    includeDeviceInfo: true,
    theme: 'light'
  })

  describe('generateHTMLReport', () => {
    it('should generate HTML report with correct structure', async () => {
      const report = createMockReport()
      const config = createMockConfig()

      const result = await service.generateHTMLReport(report, config)

      expect(result).toBeDefined()
      expect(result.format).toBe('html')
    })

    it('should include test results summary', async () => {
      const report = createMockReport()
      const config = createMockConfig()

      const result = await service.generateHTMLReport(report, config)

      expect(result.content).toContain('Total')
      expect(result.content).toContain('Passed')
      expect(result.content).toContain('Failed')
    })

    it('should include device information', async () => {
      const report = createMockReport()
      const config = createMockConfig()

      const result = await service.generateHTMLReport(report, config)

      expect(result.content).toContain('emulator-5554')
      expect(result.content).toContain('Android')
    })

    it('should include individual test results', async () => {
      const report = createMockReport()
      const config = createMockConfig()

      const result = await service.generateHTMLReport(report, config)

      expect(result.content).toContain('tc-001')
      expect(result.content).toContain('tc-002')
    })

    it('should apply custom theme', async () => {
      const report = createMockReport()
      const config = { ...createMockConfig(), theme: 'dark' as const }

      const result = await service.generateHTMLReport(report, config)

      expect(result.content).toContain('#1a1a2e')
    })
  })

  describe('exportReport', () => {
    it('should export to HTML format', async () => {
      const report = createMockReport()
      const config = createMockConfig()

      const result = await service.exportReport(report, 'html', config)

      expect(result).toBeDefined()
      expect(result.format).toBe('html')
    })

    it('should export to PDF format', async () => {
      const report = createMockReport()
      const config = createMockConfig()

      const result = await service.exportReport(report, 'pdf', config)

      expect(result).toBeDefined()
      expect(result.format).toBe('pdf')
    })

    it('should default to PDF for non-HTML formats', async () => {
      const report = createMockReport()
      const config = createMockConfig()

      const result = await service.exportReport(report, 'pdf', config)

      expect(result).toBeDefined()
      expect(result.format).toBe('pdf')
    })
  })

  describe('getReportSummary', () => {
    it('should return formatted summary text', () => {
      const report = createMockReport()
      
      const summary = service.getReportSummary(report)

      expect(summary).toContain('VTest Execution Report Summary')
      expect(summary).toContain('Total Tests: 10')
      expect(summary).toContain('Passed: 8')
      expect(summary).toContain('Failed: 1')
      expect(summary).toContain('emulator-5554')
      expect(summary).toContain('Android 12')
    })
  })
})
