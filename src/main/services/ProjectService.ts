import { getDatabase } from '../core/database/connection'
import { Logger } from '../core/logger/Logger'
import { Project, CreateProjectDTO, UpdateProjectDTO } from '../core/contracts/project.contract'
import { v4 as uuidv4 } from 'uuid'

const logger = Logger.getLogger('project')

export type { Project, CreateProjectDTO, UpdateProjectDTO }

export class ProjectService {
  public async createProject(dto: CreateProjectDTO): Promise<Project> {
    const db = getDatabase()
    try {
      const uuid = uuidv4()
      const now = new Date()
      
      const [project] = await db('projects').insert({
        uuid,
        name: dto.name,
        description: dto.description,
        apk_path: dto.apkPath,
        prd_path: dto.prdPath,
        design_path: dto.designPath,
        status: 'active',
        created_at: now,
        updated_at: now
      }).returning('*')

      logger.info(`Project created: ${uuid}`)
      return this.mapToProject(project)
    } catch (error) {
      logger.error(`Failed to create project: ${error}`)
      throw error
    }
  }

  public async getProjectById(id: string): Promise<Project | null> {
    const db = getDatabase()
    try {
      const project = await db('projects').where('id', id).first()
      return project ? this.mapToProject(project) : null
    } catch (error) {
      logger.error(`Failed to get project: ${error}`)
      throw error
    }
  }

  public async getProjectByUuid(uuid: string): Promise<Project | null> {
    const db = getDatabase()
    try {
      const project = await db('projects').where('uuid', uuid).first()
      return project ? this.mapToProject(project) : null
    } catch (error) {
      logger.error(`Failed to get project by uuid: ${error}`)
      throw error
    }
  }

  public async getAllProjects(): Promise<Project[]> {
    const db = getDatabase()
    try {
      const projects = await db('projects').orderBy('created_at', 'desc')
      return projects.map(this.mapToProject)
    } catch (error) {
      logger.error(`Failed to get all projects: ${error}`)
      throw error
    }
  }

  public async updateProject(id: string, dto: UpdateProjectDTO): Promise<Project | null> {
    const db = getDatabase()
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date()
      }

      if (dto.name !== undefined) updateData.name = dto.name
      if (dto.description !== undefined) updateData.description = dto.description
      if (dto.apkPath !== undefined) updateData.apk_path = dto.apkPath
      if (dto.prdPath !== undefined) updateData.prd_path = dto.prdPath
      if (dto.designPath !== undefined) updateData.design_path = dto.designPath
      if (dto.status !== undefined) updateData.status = dto.status

      const [project] = await db('projects')
        .where('id', id)
        .update(updateData)
        .returning('*')

      if (project) {
        logger.info(`Project updated: ${id}`)
        return this.mapToProject(project)
      }
      return null
    } catch (error) {
      logger.error(`Failed to update project: ${error}`)
      throw error
    }
  }

  public async deleteProject(id: string): Promise<boolean> {
    const db = getDatabase()
    try {
      const result = await db('projects').where('id', id).del()
      if (result > 0) {
        logger.info(`Project deleted: ${id}`)
        return true
      }
      return false
    } catch (error) {
      logger.error(`Failed to delete project: ${error}`)
      throw error
    }
  }

  private mapToProject(row: Record<string, unknown>): Project {
    return {
      id: String(row.id),
      uuid: String(row.uuid),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      apkPath: row.apk_path ? String(row.apk_path) : undefined,
      prdPath: row.prd_path ? String(row.prd_path) : undefined,
      designPath: row.design_path ? String(row.design_path) : undefined,
      status: row.status as 'active' | 'inactive',
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string)
    }
  }
}

export const projectService = new ProjectService()
