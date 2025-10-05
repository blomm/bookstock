import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { authorizationService } from '@/services/authorizationService'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { userService } from '@/services/userService'
import { roleService } from '@/services/roleService'
import type { UserRole } from '@/lib/clerk'

describe('Authorization Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Permission Checking', () => {
    describe('hasPermission', () => {
      test('should return true for admin with any permission', () => {
        const result = authorizationService.hasPermission('admin', 'title:create')
        expect(result).toBe(true)
      })

      test('should return true for operations_manager with allowed permissions', () => {
        const result = authorizationService.hasPermission('operations_manager', 'inventory:update')
        expect(result).toBe(true)
      })

      test('should return false for read_only_user with write permissions', () => {
        const result = authorizationService.hasPermission('read_only_user', 'title:create')
        expect(result).toBe(false)
      })

      test('should return false for invalid role', () => {
        const result = authorizationService.hasPermission(undefined, 'title:read')
        expect(result).toBe(false)
      })

      test('should handle complex permission strings', () => {
        expect(authorizationService.hasPermission('financial_controller', 'report:read')).toBe(true)
        expect(authorizationService.hasPermission('financial_controller', 'report:create')).toBe(true)
        expect(authorizationService.hasPermission('financial_controller', 'report:export')).toBe(true)
        expect(authorizationService.hasPermission('financial_controller', 'title:create')).toBe(false)
      })
    })

    describe('hasAnyPermission', () => {
      test('should return true if user has any of the required permissions', () => {
        const permissions = ['title:create', 'title:update', 'title:delete']
        const result = authorizationService.hasAnyPermission('operations_manager', permissions)
        expect(result).toBe(true)
      })

      test('should return false if user has none of the required permissions', () => {
        const permissions = ['user:create', 'user:delete', 'role:create']
        const result = authorizationService.hasAnyPermission('inventory_clerk', permissions)
        expect(result).toBe(false)
      })

      test('should return false for empty permissions array', () => {
        const result = authorizationService.hasAnyPermission('admin', [])
        expect(result).toBe(false)
      })
    })

    describe('hasAllPermissions', () => {
      test('should return true if user has all required permissions', () => {
        const permissions = ['title:read', 'inventory:read', 'warehouse:read']
        const result = authorizationService.hasAllPermissions('operations_manager', permissions)
        expect(result).toBe(true)
      })

      test('should return false if user is missing any required permission', () => {
        const permissions = ['title:read', 'title:create', 'user:create']
        const result = authorizationService.hasAllPermissions('inventory_clerk', permissions)
        expect(result).toBe(false)
      })

      test('should return true for admin with any permissions', () => {
        const permissions = ['title:delete', 'user:delete', 'warehouse:delete']
        const result = authorizationService.hasAllPermissions('admin', permissions)
        expect(result).toBe(true)
      })
    })
  })

  describe('User Authorization', () => {
    let testUser: any
    let adminRole: any
    let clerkRole: any

    beforeEach(async () => {
      // Create test roles
      adminRole = await roleService.create({
        name: 'admin',
        description: 'System Administrator',
        permissions: ['title:*', 'inventory:*', 'user:*', 'role:*'],
        is_system: true
      })

      clerkRole = await roleService.create({
        name: 'inventory_clerk',
        description: 'Inventory Clerk',
        permissions: ['title:read', 'inventory:read', 'inventory:update'],
        is_system: true
      })

      // Create test user
      testUser = await userService.create({
        clerk_id: 'test_clerk_id_auth',
        email: 'test-auth@example.com',
        first_name: 'Test',
        last_name: 'User'
      })
    })

    describe('getUserPermissions', () => {
      test('should return user permissions from database roles', async () => {
        // Assign role to user
        await userService.assignRole(testUser.id, adminRole.id, 'system')

        const permissions = await authorizationService.getUserPermissions(testUser.id)
        expect(permissions).toEqual(['title:*', 'inventory:*', 'user:*', 'role:*'])
      })

      test('should return empty array for user with no roles', async () => {
        const permissions = await authorizationService.getUserPermissions(testUser.id)
        expect(permissions).toEqual([])
      })

      test('should combine permissions from multiple roles', async () => {
        await userService.assignRole(testUser.id, adminRole.id, 'system')
        await userService.assignRole(testUser.id, clerkRole.id, 'system')

        const permissions = await authorizationService.getUserPermissions(testUser.id)
        expect(permissions).toContain('title:*')
        expect(permissions).toContain('inventory:read')
        expect(permissions).toContain('inventory:update')
      })
    })

    describe('userHasPermission', () => {
      test('should check user permission against database roles', async () => {
        await userService.assignRole(testUser.id, clerkRole.id, 'system')

        const hasRead = await authorizationService.userHasPermission(testUser.id, 'inventory:read')
        const hasCreate = await authorizationService.userHasPermission(testUser.id, 'inventory:create')

        expect(hasRead).toBe(true)
        expect(hasCreate).toBe(false)
      })

      test('should return false for non-existent user', async () => {
        const result = await authorizationService.userHasPermission('non-existent', 'title:read')
        expect(result).toBe(false)
      })

      test('should handle wildcard permissions correctly', async () => {
        await userService.assignRole(testUser.id, adminRole.id, 'system')

        const hasAnyTitle = await authorizationService.userHasPermission(testUser.id, 'title:create')
        const hasAnyInventory = await authorizationService.userHasPermission(testUser.id, 'inventory:delete')

        expect(hasAnyTitle).toBe(true)
        expect(hasAnyInventory).toBe(true)
      })
    })
  })

  describe('Resource-based Authorization', () => {
    describe('canAccessResource', () => {
      test('should allow access with correct permission', () => {
        const result = authorizationService.canAccessResource(
          'operations_manager',
          'title',
          'read'
        )
        expect(result).toBe(true)
      })

      test('should deny access without permission', () => {
        const result = authorizationService.canAccessResource(
          'read_only_user',
          'title',
          'create'
        )
        expect(result).toBe(false)
      })

      test('should handle admin access to any resource', () => {
        const result = authorizationService.canAccessResource(
          'admin',
          'warehouse',
          'delete'
        )
        expect(result).toBe(true)
      })
    })

    describe('getAccessibleResources', () => {
      test('should return resources user can access', () => {
        const resources = authorizationService.getAccessibleResources('inventory_clerk')

        expect(resources).toEqual({
          title: ['read'],
          inventory: ['read', 'update'],
          warehouse: ['read'],
          report: ['read']
        })
      })

      test('should return all resources for admin', () => {
        const resources = authorizationService.getAccessibleResources('admin')

        expect(resources.title).toContain('read')
        expect(resources.title).toContain('create')
        expect(resources.title).toContain('update')
        expect(resources.title).toContain('delete')
      })

      test('should return empty object for invalid role', () => {
        const resources = authorizationService.getAccessibleResources(undefined)
        expect(resources).toEqual({})
      })
    })
  })

  describe('Performance Requirements', () => {
    test('should complete permission check in under 100ms', async () => {
      const startTime = Date.now()

      // Perform multiple permission checks
      for (let i = 0; i < 100; i++) {
        authorizationService.hasPermission('admin', 'title:read')
        authorizationService.hasPermission('operations_manager', 'inventory:update')
        authorizationService.hasPermission('read_only_user', 'report:read')
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(100)
    })

    test('should handle concurrent permission checks efficiently', async () => {
      const startTime = Date.now()

      const promises = Array(50).fill(null).map(async (_, index) => {
        return authorizationService.hasPermission('admin', `resource${index}:read`)
      })

      await Promise.all(promises)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(100)
    })
  })

  describe('Edge Cases', () => {
    test('should handle null and undefined inputs gracefully', () => {
      expect(authorizationService.hasPermission(null as any, 'title:read')).toBe(false)
      expect(authorizationService.hasPermission('admin', null as any)).toBe(false)
      expect(authorizationService.hasPermission(undefined, undefined as any)).toBe(false)
    })

    test('should handle empty permission strings', () => {
      expect(authorizationService.hasPermission('admin', '')).toBe(false)
      expect(authorizationService.hasPermission('admin', '   ')).toBe(false)
    })

    test('should handle malformed permission strings', () => {
      expect(authorizationService.hasPermission('admin', 'invalidpermission')).toBe(false)
      expect(authorizationService.hasPermission('admin', 'title:')).toBe(false)
      expect(authorizationService.hasPermission('admin', ':read')).toBe(false)
    })

    test('should be case sensitive for role names', () => {
      expect(authorizationService.hasPermission('ADMIN', 'title:read')).toBe(false)
      expect(authorizationService.hasPermission('Admin', 'title:read')).toBe(false)
    })

    test('should be case sensitive for permission strings', () => {
      expect(authorizationService.hasPermission('admin', 'TITLE:READ')).toBe(false)
      expect(authorizationService.hasPermission('admin', 'title:READ')).toBe(false)
    })
  })
})