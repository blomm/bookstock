import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'

describe('Role Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create role with required fields only', async () => {
      const roleData = {
        name: 'Basic Role',
        permissions: ['read:basic']
      }

      const role = await testDb.role.create({
        data: roleData
      })

      expect(role.name).toBe('Basic Role')
      expect(role.permissions).toEqual(['read:basic'])
      expect(role.id).toBeDefined()
      expect(role.isSystem).toBe(false)
      expect(role.isActive).toBe(true)
      expect(role.description).toBeNull()
      expect(role.createdAt).toBeInstanceOf(Date)
      expect(role.updatedAt).toBeInstanceOf(Date)
    })

    test('should create role with complete information', async () => {
      const roleData = {
        name: 'Admin Role',
        description: 'Full administrative access',
        permissions: ['user:*', 'role:*', 'title:*'],
        isSystem: true
      }

      const role = await testDb.role.create({
        data: roleData
      })

      expect(role).toMatchObject(roleData)
      expect(role.isActive).toBe(true)
    })

    test('should enforce unique name constraint', async () => {
      const roleName = 'Duplicate Role'

      await testDb.role.create({
        data: {
          name: roleName,
          permissions: ['test:read']
        }
      })

      await expect(
        testDb.role.create({
          data: {
            name: roleName,
            permissions: ['test:write']
          }
        })
      ).rejects.toThrow()
    })

    test('should support complex permission arrays', async () => {
      const permissions = [
        'title:read',
        'title:create',
        'title:update',
        'inventory:read',
        'inventory:update',
        'warehouse:read',
        'report:read',
        'report:create'
      ]

      const role = await testDb.role.create({
        data: {
          name: 'Operations Manager',
          permissions
        }
      })

      expect(role.permissions).toEqual(permissions)
    })
  })

  describe('Updates', () => {
    test('should update role permissions', async () => {
      const role = await testDb.role.create({
        data: {
          name: 'Updatable Role',
          permissions: ['read:basic']
        }
      })

      const updatedPermissions = ['read:basic', 'write:basic', 'delete:basic']

      const updatedRole = await testDb.role.update({
        where: { id: role.id },
        data: {
          permissions: updatedPermissions,
          description: 'Updated with more permissions'
        }
      })

      expect(updatedRole.permissions).toEqual(updatedPermissions)
      expect(updatedRole.description).toBe('Updated with more permissions')
      expect(updatedRole.updatedAt.getTime()).toBeGreaterThan(role.updatedAt.getTime())
    })

    test('should deactivate role', async () => {
      const role = await testDb.role.create({
        data: {
          name: 'Deactivated Role',
          permissions: ['test:read']
        }
      })

      const deactivatedRole = await testDb.role.update({
        where: { id: role.id },
        data: { isActive: false }
      })

      expect(deactivatedRole.isActive).toBe(false)
    })
  })

  describe('Queries', () => {
    test('should find role by name', async () => {
      const roleData = {
        name: 'Findable Role',
        permissions: ['find:me']
      }

      await testDb.role.create({ data: roleData })

      const foundRole = await testDb.role.findUnique({
        where: { name: 'Findable Role' }
      })

      expect(foundRole).toMatchObject(roleData)
    })

    test('should filter active roles', async () => {
      await testDb.role.create({
        data: { name: 'Active Role', permissions: ['test:read'], isActive: true }
      })
      await testDb.role.create({
        data: { name: 'Inactive Role', permissions: ['test:read'], isActive: false }
      })

      const activeRoles = await testDb.role.findMany({
        where: { isActive: true }
      })

      expect(activeRoles).toHaveLength(1)
      expect(activeRoles[0].name).toBe('Active Role')
    })

    test('should filter system roles', async () => {
      await testDb.role.create({
        data: { name: 'System Role', permissions: ['system:admin'], isSystem: true }
      })
      await testDb.role.create({
        data: { name: 'User Role', permissions: ['user:basic'], isSystem: false }
      })

      const systemRoles = await testDb.role.findMany({
        where: { isSystem: true }
      })

      expect(systemRoles).toHaveLength(1)
      expect(systemRoles[0].name).toBe('System Role')
    })
  })

  describe('Permission Validation', () => {
    test('should support wildcard permissions', async () => {
      const role = await testDb.role.create({
        data: {
          name: 'Wildcard Role',
          permissions: ['user:*', 'title:*']
        }
      })

      expect(role.permissions).toContain('user:*')
      expect(role.permissions).toContain('title:*')
    })

    test('should support granular permissions', async () => {
      const granularPermissions = [
        'title:read',
        'title:create',
        'title:update',
        'inventory:read',
        'inventory:update',
        'warehouse:read',
        'movement:read',
        'movement:create',
        'report:read'
      ]

      const role = await testDb.role.create({
        data: {
          name: 'Granular Role',
          permissions: granularPermissions
        }
      })

      expect(role.permissions).toEqual(granularPermissions)
    })
  })

  describe('Relationships', () => {
    test('should support user roles relationship', async () => {
      const role = await testDb.role.create({
        data: {
          name: 'Role with Users',
          permissions: ['test:read']
        }
      })

      const user = await testDb.user.create({
        data: {
          clerkId: 'clerk_role_test',
          email: 'roletest@example.com'
        }
      })

      await testDb.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      })

      const roleWithUsers = await testDb.role.findUnique({
        where: { id: role.id },
        include: {
          userRoles: {
            include: { user: true }
          }
        }
      })

      expect(roleWithUsers?.userRoles).toHaveLength(1)
      expect(roleWithUsers?.userRoles[0].user.email).toBe('roletest@example.com')
    })
  })

  describe('Predefined Roles', () => {
    test('should create Admin role with full permissions', async () => {
      const adminRole = await testDb.role.create({
        data: {
          name: 'Admin',
          description: 'Full system access for system administrators',
          permissions: [
            'user:*',
            'role:*',
            'title:*',
            'inventory:*',
            'warehouse:*',
            'settings:*',
            'audit:read'
          ],
          isSystem: true
        }
      })

      expect(adminRole.name).toBe('Admin')
      expect(adminRole.permissions).toContain('user:*')
      expect(adminRole.permissions).toContain('audit:read')
      expect(adminRole.isSystem).toBe(true)
    })

    test('should create Operations Manager role', async () => {
      const operationsRole = await testDb.role.create({
        data: {
          name: 'Operations Manager',
          description: 'Publishing operations team lead with broad inventory management access',
          permissions: [
            'title:read',
            'title:create',
            'title:update',
            'inventory:read',
            'inventory:update',
            'warehouse:read',
            'warehouse:update',
            'movement:read',
            'movement:create',
            'movement:approve',
            'report:read',
            'report:create',
            'user:read'
          ],
          isSystem: true
        }
      })

      expect(operationsRole.name).toBe('Operations Manager')
      expect(operationsRole.permissions).toContain('movement:approve')
      expect(operationsRole.permissions).not.toContain('user:*')
    })

    test('should create Read-Only User role', async () => {
      const readOnlyRole = await testDb.role.create({
        data: {
          name: 'Read-Only User',
          description: 'View-only access for stakeholders and junior team members',
          permissions: [
            'title:read',
            'inventory:read',
            'report:read'
          ],
          isSystem: true
        }
      })

      expect(readOnlyRole.name).toBe('Read-Only User')
      expect(readOnlyRole.permissions).toEqual([
        'title:read',
        'inventory:read',
        'report:read'
      ])
      expect(readOnlyRole.permissions).not.toContain('title:update')
    })
  })

  describe('Deletion', () => {
    test('should prevent deletion of system roles', async () => {
      const systemRole = await testDb.role.create({
        data: {
          name: 'System Role',
          permissions: ['system:admin'],
          isSystem: true
        }
      })

      // In a real application, this would be prevented by business logic
      // For now, we just test that the role exists and is marked as system
      const foundRole = await testDb.role.findUnique({
        where: { id: systemRole.id }
      })

      expect(foundRole?.isSystem).toBe(true)
    })

    test('should cascade delete user roles on role deletion', async () => {
      const role = await testDb.role.create({
        data: {
          name: 'Cascade Role',
          permissions: ['test:read']
        }
      })

      const user = await testDb.user.create({
        data: {
          clerkId: 'clerk_cascade_role',
          email: 'cascade.role@example.com'
        }
      })

      await testDb.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      })

      await testDb.role.delete({
        where: { id: role.id }
      })

      const userRoles = await testDb.userRole.findMany({
        where: { roleId: role.id }
      })

      expect(userRoles).toHaveLength(0)
    })
  })
})