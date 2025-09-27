import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'

describe('User Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create user with required fields only', async () => {
      const userData = {
        clerkId: 'clerk_test_123',
        email: 'test@example.com'
      }

      const user = await testDb.user.create({
        data: userData
      })

      expect(user).toMatchObject(userData)
      expect(user.id).toBeDefined()
      expect(user.isActive).toBe(true)
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
      expect(user.firstName).toBeNull()
      expect(user.lastName).toBeNull()
      expect(user.lastLoginAt).toBeNull()
    })

    test('should create user with complete profile', async () => {
      const userData = {
        clerkId: 'clerk_test_456',
        email: 'complete@example.com',
        firstName: 'John',
        lastName: 'Doe',
        lastLoginAt: new Date()
      }

      const user = await testDb.user.create({
        data: userData
      })

      expect(user).toMatchObject(userData)
      expect(user.isActive).toBe(true)
    })

    test('should enforce unique clerkId constraint', async () => {
      const userData = {
        clerkId: 'clerk_duplicate',
        email: 'first@example.com'
      }

      await testDb.user.create({ data: userData })

      await expect(
        testDb.user.create({
          data: {
            ...userData,
            email: 'second@example.com'
          }
        })
      ).rejects.toThrow()
    })

    test('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com'

      await testDb.user.create({
        data: {
          clerkId: 'clerk_first',
          email
        }
      })

      await expect(
        testDb.user.create({
          data: {
            clerkId: 'clerk_second',
            email
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('Updates', () => {
    test('should update user profile fields', async () => {
      const user = await testDb.user.create({
        data: {
          clerkId: 'clerk_update',
          email: 'update@example.com'
        }
      })

      const updatedUser = await testDb.user.update({
        where: { id: user.id },
        data: {
          firstName: 'Updated',
          lastName: 'Name',
          lastLoginAt: new Date()
        }
      })

      expect(updatedUser.firstName).toBe('Updated')
      expect(updatedUser.lastName).toBe('Name')
      expect(updatedUser.lastLoginAt).toBeInstanceOf(Date)
      expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime())
    })

    test('should deactivate user', async () => {
      const user = await testDb.user.create({
        data: {
          clerkId: 'clerk_deactivate',
          email: 'deactivate@example.com'
        }
      })

      const deactivatedUser = await testDb.user.update({
        where: { id: user.id },
        data: { isActive: false }
      })

      expect(deactivatedUser.isActive).toBe(false)
    })
  })

  describe('Queries', () => {
    test('should find user by clerkId', async () => {
      const userData = {
        clerkId: 'clerk_find_123',
        email: 'find@example.com',
        firstName: 'Find',
        lastName: 'Me'
      }

      await testDb.user.create({ data: userData })

      const foundUser = await testDb.user.findUnique({
        where: { clerkId: 'clerk_find_123' }
      })

      expect(foundUser).toMatchObject(userData)
    })

    test('should find user by email', async () => {
      const userData = {
        clerkId: 'clerk_email_123',
        email: 'email@example.com'
      }

      await testDb.user.create({ data: userData })

      const foundUser = await testDb.user.findUnique({
        where: { email: 'email@example.com' }
      })

      expect(foundUser).toMatchObject(userData)
    })

    test('should filter active users', async () => {
      await testDb.user.create({
        data: { clerkId: 'clerk_active', email: 'active@example.com', isActive: true }
      })
      await testDb.user.create({
        data: { clerkId: 'clerk_inactive', email: 'inactive@example.com', isActive: false }
      })

      const activeUsers = await testDb.user.findMany({
        where: { isActive: true }
      })

      expect(activeUsers).toHaveLength(1)
      expect(activeUsers[0].email).toBe('active@example.com')
    })
  })

  describe('Relationships', () => {
    test('should support user roles relationship', async () => {
      // Create user and role first
      const user = await testDb.user.create({
        data: {
          clerkId: 'clerk_roles',
          email: 'roles@example.com'
        }
      })

      const role = await testDb.role.create({
        data: {
          name: 'Test Role',
          permissions: ['test:read']
        }
      })

      // Create user role relationship
      await testDb.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      })

      // Verify relationship
      const userWithRoles = await testDb.user.findUnique({
        where: { id: user.id },
        include: {
          userRoles: {
            include: { role: true }
          }
        }
      })

      expect(userWithRoles?.userRoles).toHaveLength(1)
      expect(userWithRoles?.userRoles[0].role.name).toBe('Test Role')
    })

    test('should support audit logs relationship', async () => {
      const user = await testDb.user.create({
        data: {
          clerkId: 'clerk_audit',
          email: 'audit@example.com'
        }
      })

      await testDb.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          ipAddress: '192.168.1.1'
        }
      })

      const userWithLogs = await testDb.user.findUnique({
        where: { id: user.id },
        include: { auditLogs: true }
      })

      expect(userWithLogs?.auditLogs).toHaveLength(1)
      expect(userWithLogs?.auditLogs[0].action).toBe('LOGIN')
    })
  })

  describe('Deletion', () => {
    test('should cascade delete user roles on user deletion', async () => {
      const user = await testDb.user.create({
        data: {
          clerkId: 'clerk_cascade',
          email: 'cascade@example.com'
        }
      })

      const role = await testDb.role.create({
        data: {
          name: 'Cascade Role',
          permissions: ['test:read']
        }
      })

      await testDb.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      })

      await testDb.user.delete({
        where: { id: user.id }
      })

      const userRoles = await testDb.userRole.findMany({
        where: { userId: user.id }
      })

      expect(userRoles).toHaveLength(0)
    })
  })
})