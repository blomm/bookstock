import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestUser } from '../utils/test-db'

describe('AuditLog Model', () => {
  let testUser: any

  beforeEach(async () => {
    await cleanDatabase()

    testUser = await createTestUser({
      clerkId: `clerk_audit_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      email: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create audit log with required fields only', async () => {
      const auditData = {
        action: 'LOGIN'
      }

      const auditLog = await testDb.auditLog.create({
        data: auditData
      })

      expect(auditLog.action).toBe('LOGIN')
      expect(auditLog.id).toBeDefined()
      expect(auditLog.timestamp).toBeInstanceOf(Date)
      expect(auditLog.userId).toBeNull()
      expect(auditLog.resource).toBeNull()
      expect(auditLog.resourceId).toBeNull()
      expect(auditLog.details).toBeNull()
      expect(auditLog.ipAddress).toBeNull()
      expect(auditLog.userAgent).toBeNull()
    })

    test('should create audit log with complete information', async () => {
      const details = {
        titleId: 123,
        previousValue: '19.99',
        newValue: '24.99',
        field: 'rrp'
      }

      const auditData = {
        userId: testUser.id,
        action: 'UPDATE_TITLE',
        resource: 'title',
        resourceId: '123',
        details,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }

      const auditLog = await testDb.auditLog.create({
        data: auditData
      })

      expect(auditLog).toMatchObject(auditData)
      expect(auditLog.details).toEqual(details)
      expect(auditLog.timestamp).toBeInstanceOf(Date)
    })

    test('should create system audit log without user', async () => {
      const auditData = {
        action: 'SYSTEM_STARTUP',
        resource: 'system',
        details: {
          version: '1.0.0',
          environment: 'test'
        }
      }

      const auditLog = await testDb.auditLog.create({
        data: auditData
      })

      expect(auditLog.action).toBe('SYSTEM_STARTUP')
      expect(auditLog.userId).toBeNull()
      expect(auditLog.resource).toBe('system')
      expect(auditLog.details).toEqual(auditData.details)
    })
  })

  describe('Action Types', () => {
    test('should log authentication actions', async () => {
      const loginLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'LOGIN',
          ipAddress: '10.0.0.1',
          userAgent: 'Test Browser'
        }
      })

      const logoutLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'LOGOUT',
          ipAddress: '10.0.0.1'
        }
      })

      expect(loginLog.action).toBe('LOGIN')
      expect(logoutLog.action).toBe('LOGOUT')
    })

    test('should log CRUD operations', async () => {
      const createLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'CREATE_TITLE',
          resource: 'title',
          resourceId: '456',
          details: {
            isbn: '9781234567890',
            title: 'New Book'
          }
        }
      })

      const updateLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'UPDATE_INVENTORY',
          resource: 'inventory',
          resourceId: '789',
          details: {
            field: 'currentStock',
            oldValue: 100,
            newValue: 95
          }
        }
      })

      const deleteLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'DELETE_SERIES',
          resource: 'series',
          resourceId: '101'
        }
      })

      expect(createLog.action).toBe('CREATE_TITLE')
      expect(updateLog.action).toBe('UPDATE_INVENTORY')
      expect(deleteLog.action).toBe('DELETE_SERIES')
    })

    test('should log security events', async () => {
      const failedLoginLog = await testDb.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          ipAddress: '192.168.1.200',
          details: {
            email: 'invalid@example.com',
            reason: 'Invalid credentials'
          }
        }
      })

      const permissionDeniedLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'PERMISSION_DENIED',
          resource: 'user',
          details: {
            attemptedAction: 'DELETE_USER',
            requiredPermission: 'user:delete'
          }
        }
      })

      expect(failedLoginLog.action).toBe('LOGIN_FAILED')
      expect(permissionDeniedLog.action).toBe('PERMISSION_DENIED')
    })
  })

  describe('Resource Tracking', () => {
    test('should track title operations', async () => {
      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'UPDATE_TITLE',
          resource: 'title',
          resourceId: '123',
          details: {
            field: 'rrp',
            oldValue: '19.99',
            newValue: '24.99'
          }
        }
      })

      const titleLogs = await testDb.auditLog.findMany({
        where: {
          resource: 'title',
          resourceId: '123'
        }
      })

      expect(titleLogs).toHaveLength(1)
      expect(titleLogs[0].action).toBe('UPDATE_TITLE')
    })

    test('should track inventory operations', async () => {
      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'STOCK_MOVEMENT',
          resource: 'inventory',
          resourceId: '456',
          details: {
            movementType: 'PRINT_RECEIVED',
            quantity: 1000,
            warehouseId: 1
          }
        }
      })

      const inventoryLogs = await testDb.auditLog.findMany({
        where: { resource: 'inventory' }
      })

      expect(inventoryLogs).toHaveLength(1)
      expect(inventoryLogs[0].details).toHaveProperty('movementType')
    })

    test('should track user management operations', async () => {
      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'ASSIGN_ROLE',
          resource: 'user',
          resourceId: testUser.id,
          details: {
            roleId: 'role_123',
            roleName: 'Operations Manager',
            assignedBy: 'admin_456'
          }
        }
      })

      const userLogs = await testDb.auditLog.findMany({
        where: {
          resource: 'user',
          resourceId: testUser.id
        }
      })

      expect(userLogs).toHaveLength(1)
      expect(userLogs[0].action).toBe('ASSIGN_ROLE')
    })
  })

  describe('Queries', () => {
    test('should find logs by user', async () => {
      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'LOGIN'
        }
      })

      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'UPDATE_TITLE',
          resource: 'title',
          resourceId: '123'
        }
      })

      await testDb.auditLog.create({
        data: {
          action: 'SYSTEM_EVENT',
          resource: 'system'
        }
      })

      const userLogs = await testDb.auditLog.findMany({
        where: { userId: testUser.id }
      })

      expect(userLogs).toHaveLength(2)
    })

    test('should find logs by action type', async () => {
      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'LOGIN',
          ipAddress: '192.168.1.1'
        }
      })

      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'LOGIN',
          ipAddress: '192.168.1.2'
        }
      })

      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'LOGOUT'
        }
      })

      const loginLogs = await testDb.auditLog.findMany({
        where: { action: 'LOGIN' }
      })

      expect(loginLogs).toHaveLength(2)
    })

    test('should find logs by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await testDb.auditLog.create({
        data: {
          action: 'OLD_EVENT',
          timestamp: yesterday
        }
      })

      await testDb.auditLog.create({
        data: {
          action: 'CURRENT_EVENT'
        }
      })

      const recentLogs = await testDb.auditLog.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      })

      expect(recentLogs).toHaveLength(1)
      expect(recentLogs[0].action).toBe('CURRENT_EVENT')
    })

    test('should find logs by IP address', async () => {
      const suspiciousIp = '10.0.0.999'

      await testDb.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          ipAddress: suspiciousIp,
          details: { reason: 'Invalid credentials' }
        }
      })

      await testDb.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          ipAddress: suspiciousIp,
          details: { reason: 'Account locked' }
        }
      })

      await testDb.auditLog.create({
        data: {
          action: 'LOGIN',
          ipAddress: '192.168.1.1'
        }
      })

      const suspiciousLogs = await testDb.auditLog.findMany({
        where: { ipAddress: suspiciousIp }
      })

      expect(suspiciousLogs).toHaveLength(2)
    })
  })

  describe('Relationships', () => {
    test('should include user information', async () => {
      await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'TEST_ACTION',
          resource: 'test'
        }
      })

      const logWithUser = await testDb.auditLog.findFirst({
        where: { userId: testUser.id },
        include: { user: true }
      })

      expect(logWithUser?.user.email).toBe(testUser.email)
      expect(logWithUser?.user.clerkId).toBe(testUser.clerkId)
    })

    test('should handle logs without user (system events)', async () => {
      await testDb.auditLog.create({
        data: {
          action: 'SYSTEM_MAINTENANCE',
          resource: 'system',
          details: { maintenanceType: 'database_cleanup' }
        }
      })

      const systemLog = await testDb.auditLog.findFirst({
        where: { action: 'SYSTEM_MAINTENANCE' },
        include: { user: true }
      })

      expect(systemLog?.user).toBeNull()
      expect(systemLog?.resource).toBe('system')
    })
  })

  describe('Complex Details', () => {
    test('should store complex JSON details', async () => {
      const complexDetails = {
        operation: 'bulk_update',
        affectedRecords: 150,
        changes: {
          field: 'unit_cost',
          criteria: { category: 'Fiction' },
          adjustment: { type: 'percentage', value: 5 }
        },
        metadata: {
          batchId: 'batch_789',
          source: 'csv_import',
          timestamp: new Date().toISOString()
        }
      }

      const auditLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'BULK_UPDATE_TITLES',
          resource: 'title',
          details: complexDetails
        }
      })

      expect(auditLog.details).toEqual(complexDetails)
      expect(auditLog.details).toHaveProperty('operation', 'bulk_update')
      expect(auditLog.details).toHaveProperty('affectedRecords', 150)
    })

    test('should store array data in details', async () => {
      const arrayDetails = {
        deletedItems: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' }
        ],
        deletionReason: 'Bulk cleanup',
        deletedBy: testUser.id
      }

      const auditLog = await testDb.auditLog.create({
        data: {
          userId: testUser.id,
          action: 'BULK_DELETE',
          details: arrayDetails
        }
      })

      expect(auditLog.details).toEqual(arrayDetails)
      expect(Array.isArray(auditLog.details?.deletedItems)).toBe(true)
      expect(auditLog.details?.deletedItems).toHaveLength(3)
    })
  })

  describe('Retention and Cleanup', () => {
    test('should support date-based queries for retention', async () => {
      const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
      const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

      await testDb.auditLog.create({
        data: {
          action: 'OLD_LOG',
          timestamp: oldDate
        }
      })

      await testDb.auditLog.create({
        data: {
          action: 'RECENT_LOG',
          timestamp: recentDate
        }
      })

      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago

      const oldLogs = await testDb.auditLog.findMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      })

      const recentLogs = await testDb.auditLog.findMany({
        where: {
          timestamp: { gte: cutoffDate }
        }
      })

      expect(oldLogs).toHaveLength(1)
      expect(recentLogs).toHaveLength(1)
      expect(oldLogs[0].action).toBe('OLD_LOG')
      expect(recentLogs[0].action).toBe('RECENT_LOG')
    })
  })

  describe('Performance', () => {
    test('should support indexed queries on common fields', async () => {
      // Create multiple logs for different users
      const secondUser = await createTestUser({
        clerkId: `clerk_second_audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: `second.audit_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`
      })

      // Create logs for performance testing
      for (let i = 0; i < 10; i++) {
        await testDb.auditLog.create({
          data: {
            userId: i % 2 === 0 ? testUser.id : secondUser.id,
            action: `ACTION_${i}`,
            resource: i % 3 === 0 ? 'title' : 'inventory',
            timestamp: new Date(Date.now() - i * 60000) // Different minutes
          }
        })
      }

      // Test indexed queries
      const userLogs = await testDb.auditLog.findMany({
        where: { userId: testUser.id }
      })

      const actionLogs = await testDb.auditLog.findMany({
        where: { action: 'ACTION_0' }
      })

      const resourceLogs = await testDb.auditLog.findMany({
        where: { resource: 'title' }
      })

      const timestampLogs = await testDb.auditLog.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 5 * 60000) // Last 5 minutes
          }
        }
      })

      expect(userLogs.length).toBeGreaterThan(0)
      expect(actionLogs.length).toBe(1)
      expect(resourceLogs.length).toBeGreaterThan(0)
      expect(timestampLogs.length).toBeGreaterThan(0)
    })
  })
})
