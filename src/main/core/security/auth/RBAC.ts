/**
 * RBAC — 基于角色的访问控制
 * 支持角色定义、权限分配、装饰器守卫
 */

export interface User {
  id: string
  role: string
  [key: string]: unknown
}

export interface Permission {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'execute'
}

export class RBAC {
  private roles = new Map<string, Permission[]>()

  defineRole(role: string, permissions: Permission[]): void {
    this.roles.set(role, permissions)
  }

  defineRoles(roleMap: Record<string, Permission[]>): void {
    for (const [role, permissions] of Object.entries(roleMap)) {
      this.defineRole(role, permissions)
    }
  }

  hasPermission(user: User, resource: string, action: Permission['action']): boolean {
    const userPermissions = this.roles.get(user.role)
    if (!userPermissions) return false

    return userPermissions.some(p => 
      p.resource === resource && p.action === action
    )
  }

  hasAnyPermission(user: User, permissions: Array<{ resource: string; action: Permission['action'] }>): boolean {
    return permissions.some(p => this.hasPermission(user, p.resource, p.action))
  }

  hasAllPermissions(user: User, permissions: Array<{ resource: string; action: Permission['action'] }>): boolean {
    return permissions.every(p => this.hasPermission(user, p.resource, p.action))
  }

  getPermissions(user: User): Permission[] {
    return this.roles.get(user.role) || []
  }

  getRoles(): string[] {
    return Array.from(this.roles.keys())
  }

  removeRole(role: string): boolean {
    return this.roles.delete(role)
  }

  /**
   * 创建权限守卫装饰器
   * @param permission 所需的权限
   * @param getCurrentUser 获取当前用户的函数
   */
  requirePermission(
    permission: { resource: string; action: Permission['action'] },
    getCurrentUser: () => User
  ): MethodDecorator {
    return (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value

      descriptor.value = function (...args: unknown[]) {
        const user = getCurrentUser()
        const rbac = RBAC.getInstance()
        if (!rbac.hasPermission(user, permission.resource, permission.action)) {
          throw new RBACError(
            `Permission denied: ${user.role} cannot ${permission.action} ${permission.resource}`
          )
        }
        return originalMethod.apply(this, args)
      }

      return descriptor
    }
  }

  private static instance: RBAC

  static getInstance(): RBAC {
    if (!RBAC.instance) {
      RBAC.instance = new RBAC()
    }
    return RBAC.instance
  }

  clear(): void {
    this.roles.clear()
  }
}

export class RBACError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RBACError'
  }
}