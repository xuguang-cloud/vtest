/**
 * Interface contract for Test Case Service.
 * Defines the complete API for managing test cases within VTest.
 */

export type TestCaseStatus = 'draft' | 'active' | 'archived' | 'deprecated'

export interface TestCase {
  id: string
  projectId: string
  name: string
  description?: string
  steps: TestCaseStep[]
  status: TestCaseStatus
  createdAt: Date
  updatedAt: Date
}

export interface TestCaseStep {
  id: string
  order: number
  action: string
  selector?: string
  input?: string
  expectedResult?: string
}

export interface CreateTestCaseDTO {
  projectId: string
  name: string
  description?: string
  steps: Omit<TestCaseStep, 'id'>[]
}

export interface UpdateTestCaseDTO {
  name?: string
  description?: string
  steps?: TestCaseStep[]
  status?: TestCaseStatus
}

export interface TestCaseFilter {
  projectId?: string
  status?: TestCaseStatus
  search?: string
}

export interface TestCaseServiceError extends Error {
  code: string
  details?: Record<string, unknown>
}

export interface ITestCaseService {
  /**
   * Create a new test case.
   * @param dto - Test case creation data.
   * @returns The created TestCase.
   * @throws TestCaseServiceError if creation fails.
   */
  createTestCase(dto: CreateTestCaseDTO): Promise<TestCase>

  /**
   * Retrieve a test case by id.
   * @param id - The test case id.
   * @returns The TestCase or null if not found.
   * @throws TestCaseServiceError if retrieval fails.
   */
  getTestCaseById(id: string): Promise<TestCase | null>

  /**
   * Retrieve all test cases matching optional filters.
   * @param filter - Optional filter criteria.
   * @returns Array of matching TestCases.
   * @throws TestCaseServiceError if retrieval fails.
   */
  getTestCases(filter?: TestCaseFilter): Promise<TestCase[]>

  /**
   * Update an existing test case.
   * @param id - The test case id to update.
   * @param dto - Fields to update.
   * @returns The updated TestCase or null if not found.
   * @throws TestCaseServiceError if update fails.
   */
  updateTestCase(id: string, dto: UpdateTestCaseDTO): Promise<TestCase | null>

  /**
   * Delete a test case by id.
   * @param id - The test case id to delete.
   * @returns True if deleted, false if not found.
   * @throws TestCaseServiceError if deletion fails.
   */
  deleteTestCase(id: string): Promise<boolean>

  /**
   * Duplicate an existing test case.
   * @param id - The test case id to duplicate.
   * @returns The new duplicated TestCase.
   * @throws TestCaseServiceError if duplication fails.
   */
  duplicateTestCase(id: string): Promise<TestCase>
}
