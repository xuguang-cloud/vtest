/**
 * Interface contract for Project Service.
 * Defines the complete API for managing projects within VTest.
 */

export type ProjectStatus = 'active' | 'inactive'

export interface Project {
  id: string
  uuid: string
  name: string
  description?: string
  apkPath?: string
  prdPath?: string
  designPath?: string
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

export interface CreateProjectDTO {
  name: string
  description?: string
  apkPath?: string
  prdPath?: string
  designPath?: string
}

export interface UpdateProjectDTO {
  name?: string
  description?: string
  apkPath?: string
  prdPath?: string
  designPath?: string
  status?: ProjectStatus
}

export interface ProjectServiceError extends Error {
  code: string
  details?: Record<string, unknown>
}

export interface IProjectService {
  /**
   * Create a new project.
   * @param dto - Project creation data.
   * @returns The created Project.
   * @throws ProjectServiceError if project creation fails.
   */
  createProject(dto: CreateProjectDTO): Promise<Project>

  /**
   * Retrieve a project by its database id.
   * @param id - The project id.
   * @returns The Project or null if not found.
   * @throws ProjectServiceError if retrieval fails.
   */
  getProjectById(id: string): Promise<Project | null>

  /**
   * Retrieve a project by its uuid.
   * @param uuid - The project uuid.
   * @returns The Project or null if not found.
   * @throws ProjectServiceError if retrieval fails.
   */
  getProjectByUuid(uuid: string): Promise<Project | null>

  /**
   * Retrieve all projects ordered by creation date (descending).
   * @returns Array of all Projects.
   * @throws ProjectServiceError if retrieval fails.
   */
  getAllProjects(): Promise<Project[]>

  /**
   * Update an existing project.
   * @param id - The project id to update.
   * @param dto - Fields to update.
   * @returns The updated Project or null if not found.
   * @throws ProjectServiceError if update fails.
   */
  updateProject(id: string, dto: UpdateProjectDTO): Promise<Project | null>

  /**
   * Delete a project by its id.
   * @param id - The project id to delete.
   * @returns True if deleted, false if not found.
   * @throws ProjectServiceError if deletion fails.
   */
  deleteProject(id: string): Promise<boolean>
}
