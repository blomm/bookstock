import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { NextRequest } from 'next/server'
import { authorizationService } from '@/services/authorizationService'
import { userService } from '@/services/userService'
import { roleService } from '@/services/roleService'

describe('Authorization Flow Integration', () => {
  let testUser: any
  let adminRole: any
  let clerkRole: any
  let readOnlyRole: any

  beforeEach(async () => {
    await cleanDatabase()

    // Create test roles
    adminRole = await roleService.create({
      name: 'admin',
      description: 'System Administrator',
      permissions: ['title:*', 'inventory:*', 'user:*', 'role:*', 'warehouse:*'],
      is_system: true
    })

    clerkRole = await roleService.create({
      name: 'inventory_clerk',
      description: 'Inventory Clerk',
      permissions: ['title:read', 'inventory:read', 'inventory:update', 'warehouse:read'],
      is_system: true
    })

    readOnlyRole = await roleService.create({
      name: 'read_only_user',
      description: 'Read Only User',
      permissions: ['title:read', 'inventory:read', 'report:read'],
      is_system: true
    })

    // Create test user
    testUser = await userService.create({
      clerk_id: 'test_flow_user',
      email: 'flow@example.com',
      first_name: 'Flow',
      last_name: 'Test'
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Complete Authorization Flow', () => {
    test('should handle user registration to first authorized action', async () => {
      // Step 1: User starts with no roles (new registration)
      let permissions = await authorizationService.getUserPermissions(testUser.id)
      expect(permissions).toEqual([])

      // Step 2: Assign default read-only role
      await userService.assignRole(testUser.id, readOnlyRole.id, 'system')

      // Step 3: Verify user can read but not create
      const canRead = await authorizationService.userHasPermission(testUser.id, 'title:read')
      const canCreate = await authorizationService.userHasPermission(testUser.id, 'title:create')

      expect(canRead).toBe(true)
      expect(canCreate).toBe(false)

      // Step 4: Promote user to inventory clerk
      await userService.assignRole(testUser.id, clerkRole.id, 'admin')

      // Step 5: Verify expanded permissions
      const canUpdateInventory = await authorizationService.userHasPermission(
        testUser.id,
        'inventory:update'
      )
      const canDeleteInventory = await authorizationService.userHasPermission(
        testUser.id,
        'inventory:delete'
      )

      expect(canUpdateInventory).toBe(true)
      expect(canDeleteInventory).toBe(false)

      // Step 6: Final permissions should combine all roles
      permissions = await authorizationService.getUserPermissions(testUser.id)
      expect(permissions).toContain('title:read')
      expect(permissions).toContain('inventory:read')
      expect(permissions).toContain('inventory:update')
    })

    test('should handle role changes and permission updates', async () => {
      // Start with admin role
      await userService.assignRole(testUser.id, adminRole.id, 'system')

      // Verify admin permissions
      const canDeleteUsers = await authorizationService.userHasPermission(
        testUser.id,
        'user:delete'
      )
      expect(canDeleteUsers).toBe(true)

      // Remove admin role
      await userService.removeRole(testUser.id, adminRole.id)

      // Add clerk role
      await userService.assignRole(testUser.id, clerkRole.id, 'admin')

      // Verify permissions changed
      const stillCanDeleteUsers = await authorizationService.userHasPermission(
        testUser.id,
        'user:delete'
      )
      const canReadInventory = await authorizationService.userHasPermission(
        testUser.id,
        'inventory:read'
      )

      expect(stillCanDeleteUsers).toBe(false)
      expect(canReadInventory).toBe(true)
    })

    test('should handle concurrent role assignments', async () => {
      // Assign multiple roles concurrently
      await Promise.all([
        userService.assignRole(testUser.id, readOnlyRole.id, 'system'),
        userService.assignRole(testUser.id, clerkRole.id, 'admin')
      ])

      // Verify combined permissions
      const permissions = await authorizationService.getUserPermissions(testUser.id)

      expect(permissions).toContain('title:read')
      expect(permissions).toContain('inventory:read')
      expect(permissions).toContain('inventory:update')
      expect(permissions).toContain('report:read')
    })
  })

  describe('Resource Access Patterns', () => {
    test('should enforce resource-level permissions correctly', async () => {
      await userService.assignRole(testUser.id, clerkRole.id, 'admin')

      // Test title resource access
      expect(authorizationService.canAccessResource('inventory_clerk', 'title', 'read')).toBe(true)
      expect(authorizationService.canAccessResource('inventory_clerk', 'title', 'create')).toBe(false)

      // Test inventory resource access
      expect(authorizationService.canAccessResource('inventory_clerk', 'inventory', 'read')).toBe(true)
      expect(authorizationService.canAccessResource('inventory_clerk', 'inventory', 'update')).toBe(true)
      expect(authorizationService.canAccessResource('inventory_clerk', 'inventory', 'delete')).toBe(false)

      // Test warehouse resource access
      expect(authorizationService.canAccessResource('inventory_clerk', 'warehouse', 'read')).toBe(true)
      expect(authorizationService.canAccessResource('inventory_clerk', 'warehouse', 'create')).toBe(false)
    })

    test('should provide accurate accessible resources map', async () => {
      await userService.assignRole(testUser.id, clerkRole.id, 'admin')

      const resources = authorizationService.getAccessibleResources('inventory_clerk')

      expect(resources).toEqual({
        title: ['read'],
        inventory: ['read', 'update'],
        warehouse: ['read']
      })
    })
  })

  describe('Hierarchical Permission Testing', () => {
    test('should handle wildcard permissions correctly', async () => {
      await userService.assignRole(testUser.id, adminRole.id, 'system')

      // Admin should have all permissions due to wildcards
      const permissions = [
        'title:create',
        'title:read',
        'title:update',
        'title:delete',
        'inventory:create',
        'inventory:read',
        'inventory:update',
        'inventory:delete',
        'user:create',
        'user:read',
        'user:update',
        'user:delete'
      ]

      for (const permission of permissions) {
        const hasPermission = await authorizationService.userHasPermission(
          testUser.id,
          permission
        )
        expect(hasPermission).toBe(true)
      }
    })

    test('should respect permission boundaries for non-admin roles', async () => {
      await userService.assignRole(testUser.id, clerkRole.id, 'admin')

      // Should have these permissions
      const allowedPermissions = [
        'title:read',
        'inventory:read',
        'inventory:update',
        'warehouse:read'
      ]

      // Should not have these permissions
      const deniedPermissions = [
        'title:create',
        'title:update',
        'title:delete',
        'inventory:create',
        'inventory:delete',
        'warehouse:create',
        'warehouse:update',
        'warehouse:delete',
        'user:read',
        'user:create'
      ]

      for (const permission of allowedPermissions) {
        const hasPermission = await authorizationService.userHasPermission(
          testUser.id,
          permission
        )
        expect(hasPermission).toBe(true)
      }

      for (const permission of deniedPermissions) {
        const hasPermission = await authorizationService.userHasPermission(
          testUser.id,
          permission
        )
        expect(hasPermission).toBe(false)
      }
    })
  })

  describe('Multiple User Scenarios', () => {
    test('should handle different users with different permissions', async () => {
      // Create additional test users
      const adminUser = await userService.create({
        clerk_id: 'admin_user',
        email: 'admin@example.com',
        first_name: 'Admin',
        last_name: 'User'
      })

      const readOnlyUser = await userService.create({
        clerk_id: 'readonly_user',
        email: 'readonly@example.com',
        first_name: 'ReadOnly',
        last_name: 'User'
      })

      // Assign different roles
      await userService.assignRole(adminUser.id, adminRole.id, 'system')
      await userService.assignRole(testUser.id, clerkRole.id, 'admin')
      await userService.assignRole(readOnlyUser.id, readOnlyRole.id, 'system')

      // Test permission differences
      const adminCanDelete = await authorizationService.userHasPermission(
        adminUser.id,
        'user:delete'
      )
      const clerkCanDelete = await authorizationService.userHasPermission(
        testUser.id,
        'user:delete'
      )
      const readOnlyCanDelete = await authorizationService.userHasPermission(
        readOnlyUser.id,
        'user:delete'
      )

      expect(adminCanDelete).toBe(true)
      expect(clerkCanDelete).toBe(false)
      expect(readOnlyCanDelete).toBe(false)

      // Test read permissions
      const adminCanRead = await authorizationService.userHasPermission(
        adminUser.id,
        'title:read'
      )
      const clerkCanRead = await authorizationService.userHasPermission(
        testUser.id,
        'title:read'
      )
      const readOnlyCanRead = await authorizationService.userHasPermission(
        readOnlyUser.id,
        'title:read'
      )

      expect(adminCanRead).toBe(true)
      expect(clerkCanRead).toBe(true)
      expect(readOnlyCanRead).toBe(true)
    })
  })

  describe('Performance and Scale Testing', () => {
    test('should handle permission checks efficiently with multiple roles', async () => {
      // Assign multiple roles to user
      await userService.assignRole(testUser.id, readOnlyRole.id, 'system')
      await userService.assignRole(testUser.id, clerkRole.id, 'admin')

      const startTime = Date.now()

      // Perform many permission checks
      const permissionChecks = Array(100).fill(null).map(async (_, index) => {
        return authorizationService.userHasPermission(
          testUser.id,
          `permission${index % 10}:read`
        )
      })

      await Promise.all(permissionChecks)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })

    test('should handle many users with concurrent permission checks', async () => {
      // Create multiple users with different roles
      const users = await Promise.all(
        Array(10).fill(null).map(async (_, index) => {
          const user = await userService.create({
            clerk_id: `concurrent_user_${index}`,
            email: `user${index}@example.com`,
            first_name: `User${index}`,
            last_name: 'Test'
          })

          // Assign random role
          const roles = [adminRole, clerkRole, readOnlyRole]
          const randomRole = roles[index % 3]
          await userService.assignRole(user.id, randomRole.id, 'system')

          return user
        })
      )

      const startTime = Date.now()

      // Perform concurrent permission checks for all users
      const checks = users.map(user =>
        authorizationService.userHasPermission(user.id, 'title:read')
      )

      const results = await Promise.all(checks)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(500)
      expect(results.every(result => result === true)).toBe(true) // All should have read access
    })
  })
})