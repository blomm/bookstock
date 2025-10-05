import { UserRole } from '@/lib/clerk'
import { authorizationService } from '@/services/authorizationService'

export interface AuthorizationContext {
  userId: string
  role: UserRole
  permissions: string[]
  can: (permission: string) => boolean
  canAny: (permissions: string[]) => boolean
  canAll: (permissions: string[]) => boolean
  canAccess: (resource: string, action: string) => boolean
}

export async function createAuthorizationContext(
  userId: string,
  role: UserRole
): Promise<AuthorizationContext> {
  const permissions = await authorizationService.getUserPermissions(userId)

  return {
    userId,
    role,
    permissions,
    can: (permission: string) => authorizationService.hasPermission(role, permission),
    canAny: (perms: string[]) => authorizationService.hasAnyPermission(role, perms),
    canAll: (perms: string[]) => authorizationService.hasAllPermissions(role, perms),
    canAccess: (resource: string, action: string) =>
      authorizationService.canAccessResource(role, resource, action)
  }
}

export function getResourceFromPath(path: string): { resource: string; action: string } | null {
  // Extract resource and action from API path
  const apiPathRegex = /^\/api\/([^\/]+)(?:\/([^\/]+))?/
  const match = path.match(apiPathRegex)

  if (!match) {
    return null
  }

  const resource = match[1]
  let action = 'read' // default action

  // Determine action based on HTTP method and path structure
  const hasId = match[2] && match[2] !== 'search' && match[2] !== 'bulk'

  if (path.includes('/bulk')) {
    action = 'bulk'
  } else if (hasId) {
    action = 'read' // specific resource by ID
  } else {
    action = 'read' // list/search
  }

  return { resource, action }
}

export function getActionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'read'
    case 'POST':
      return 'create'
    case 'PUT':
    case 'PATCH':
      return 'update'
    case 'DELETE':
      return 'delete'
    default:
      return 'read'
  }
}

export function combineResourceAction(resource: string, action: string): string {
  return `${resource}:${action}`
}

export function extractResourceFromRequest(req: Request): {
  resource: string
  action: string
  permission: string
} {
  const url = new URL(req.url)
  const pathInfo = getResourceFromPath(url.pathname)
  const method = req.method

  if (!pathInfo) {
    return {
      resource: 'unknown',
      action: 'read',
      permission: 'unknown:read'
    }
  }

  const action = getActionFromMethod(method)
  const permission = combineResourceAction(pathInfo.resource, action)

  return {
    resource: pathInfo.resource,
    action,
    permission
  }
}

export class PermissionBuilder {
  private permissions: string[] = []

  static create(): PermissionBuilder {
    return new PermissionBuilder()
  }

  resource(resource: string): ResourceBuilder {
    return new ResourceBuilder(this, resource)
  }

  any(...permissions: string[]): PermissionBuilder {
    this.permissions.push(...permissions)
    return this
  }

  build(): string[] {
    return [...this.permissions]
  }
}

export class ResourceBuilder {
  constructor(
    private parent: PermissionBuilder,
    private resource: string
  ) {}

  read(): PermissionBuilder {
    this.parent.any(`${this.resource}:read`)
    return this.parent
  }

  create(): PermissionBuilder {
    this.parent.any(`${this.resource}:create`)
    return this.parent
  }

  update(): PermissionBuilder {
    this.parent.any(`${this.resource}:update`)
    return this.parent
  }

  delete(): PermissionBuilder {
    this.parent.any(`${this.resource}:delete`)
    return this.parent
  }

  all(): PermissionBuilder {
    this.parent.any(`${this.resource}:*`)
    return this.parent
  }

  actions(...actions: string[]): PermissionBuilder {
    actions.forEach(action => {
      this.parent.any(`${this.resource}:${action}`)
    })
    return this.parent
  }
}

export const permissions = {
  title: {
    read: 'title:read',
    create: 'title:create',
    update: 'title:update',
    delete: 'title:delete',
    all: 'title:*'
  },
  inventory: {
    read: 'inventory:read',
    create: 'inventory:create',
    update: 'inventory:update',
    delete: 'inventory:delete',
    all: 'inventory:*'
  },
  warehouse: {
    read: 'warehouse:read',
    create: 'warehouse:create',
    update: 'warehouse:update',
    delete: 'warehouse:delete',
    all: 'warehouse:*'
  },
  user: {
    read: 'user:read',
    create: 'user:create',
    update: 'user:update',
    delete: 'user:delete',
    all: 'user:*'
  },
  role: {
    read: 'role:read',
    create: 'role:create',
    update: 'role:update',
    delete: 'role:delete',
    all: 'role:*'
  },
  report: {
    read: 'report:read',
    create: 'report:create',
    export: 'report:export',
    all: 'report:*'
  },
  audit: {
    read: 'audit:read',
    all: 'audit:*'
  }
}

export function validateResourceAccess(
  userRole: UserRole,
  requiredPermissions: string[]
): {
  allowed: boolean
  missingPermissions: string[]
  hasPermissions: string[]
} {
  const hasPermissions: string[] = []
  const missingPermissions: string[] = []

  requiredPermissions.forEach(permission => {
    if (authorizationService.hasPermission(userRole, permission)) {
      hasPermissions.push(permission)
    } else {
      missingPermissions.push(permission)
    }
  })

  return {
    allowed: missingPermissions.length === 0,
    missingPermissions,
    hasPermissions
  }
}