import { useState, useEffect } from 'react'
import { useIPC, Project } from '../hooks/useIPC'

interface ProjectListProps {
  onSelectProject: (project: Project) => void
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const { getAllProjects } = useIPC()

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      setLoading(true)
      const data = await getAllProjects()
      setProjects(data)
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-4xl mb-4">📋</div>
        <p>No projects yet</p>
        <p className="text-sm mt-1">Create a new project to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => onSelectProject(project)}
          className="p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition border border-gray-700"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-white">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-gray-400 mt-1">{project.description}</p>
              )}
            </div>
            <span
              className={`text-xs px-2 py-1 rounded ${
                project.status === 'active'
                  ? 'bg-green-900 text-green-400'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {project.status}
            </span>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            {project.apkPath && <span>📱 APK</span>}
            {project.prdPath && <span>📄 PRD</span>}
            {project.designPath && <span>🎨 Design</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
