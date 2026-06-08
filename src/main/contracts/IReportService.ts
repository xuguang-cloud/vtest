/**
 * Interface contract for Report Service.
 * Defines the complete API for generating and managing test reports.
 */

export type ReportFormat = 'html' | 'pdf' | 'json' | 'xml'
export type ReportStatus = 'generating' | 'ready' | 'failed' | 'expired'

export interface Report {
  id: string
  projectId: string
  runId: string
  name: string
  format: ReportFormat
  status: ReportStatus
  filePath?: string
  fileSize?: number
  createdAt: Date
  expiresAt?: Date
}

export interface ReportMetrics {
  totalTests: number
  passed: number
  failed: number
  skipped: number
  coverage: number
  duration: number
}

export interface GenerateReportRequest {
  runId: string
  name: string
  format: ReportFormat
  includeScreenshots?: boolean
  includeLogs?: boolean
}

export interface ReportFilter {
  projectId?: string
  format?: ReportFormat
  status?: ReportStatus
}

export interface ReportServiceError extends Error {
  code: string
  details?: Record<string, unknown>
}

export interface IReportService {
  /**
   * Generate a new report for a completed test run.
   * @param request - Report generation request parameters.
   * @returns The generated Report.
   * @throws ReportServiceError if the run is not found or generation fails.
   */
  generateReport(request: GenerateReportRequest): Promise<Report>

  /**
   * Retrieve a report by id.
   * @param reportId - The report id.
   * @returns The Report or null if not found.
   * @throws ReportServiceError if retrieval fails.
   */
  getReport(reportId: string): Promise<Report | null>

  /**
   * List all reports matching optional filters.
   * @param filter - Optional filter criteria.
   * @returns Array of matching Reports.
   * @throws ReportServiceError if retrieval fails.
   */
  listReports(filter?: ReportFilter): Promise<Report[]>

  /**
   * Get the metrics summary for a report.
   * @param reportId - The report id.
   * @returns The ReportMetrics or null if not found.
   * @throws ReportServiceError if retrieval fails.
   */
  getReportMetrics(reportId: string): Promise<ReportMetrics | null>

  /**
   * Delete a report.
   * @param reportId - The report id to delete.
   * @returns True if deleted, false if not found.
   * @throws ReportServiceError if deletion fails.
   */
  deleteReport(reportId: string): Promise<boolean>

  /**
   * Export a report to a specified format and path.
   * @param reportId - The report id.
   * @param targetPath - The destination file path.
   * @returns The exported file path.
   * @throws ReportServiceError if export fails.
   */
  exportReport(reportId: string, targetPath: string): Promise<string>
}
