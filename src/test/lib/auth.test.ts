import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest'
import {
  get_current_user,
  require_auth,
  require_role,
  require_permission,
  check_permission,
  get_db_user,
  sync_user_to_database,
  validate_api_auth,
  validate_api_permission,
  create_audit_log
} from '@/lib/auth'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn()
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

describe('Auth Library', () => {
  beforeEach(async () => {
    await cleanDatabase()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('get_current_user', () => {
    test('should return user data when authenticated', async () => {
      const mockUser = {
        id: 'clerk_user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'John',
        lastName: 'Doe',
        publicMetadata: { role: 'admin' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_user_123',
        user: mockUser
      })

      const result = await get_current_user()

      expect(result).toMatchObject({
        id: 'clerk_user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'admin',
        user: mockUser
      })
    })

    test('should return null when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        user: null
      })

      const result = await get_current_user()
      expect(result).toBeNull()
    })

    test('should handle auth errors gracefully', async () => {
      vi.mocked(auth).mockRejectedValue(new Error('Auth failed'))

      const result = await get_current_user()
      expect(result).toBeNull()
    })

    test('should extract role from user metadata', async () => {
      const mockUser = {
        id: 'clerk_user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Jane',
        lastName: 'Smith',
        publicMetadata: { role: 'operations_manager' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_user_123',
        user: mockUser
      })

      const result = await get_current_user()
      expect(result?.role).toBe('operations_manager')
    })
  })

  describe('check_permission', () => {
    test('should return true for user with permission', async () => {
      const mockUser = {
        id: 'clerk_user_123',
        emailAddresses: [{ emailAddress: 'admin@example.com' }],
        firstName: 'Admin',
        lastName: 'User',
        publicMetadata: { role: 'admin' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_user_123',
        user: mockUser
      })

      const result = await check_permission('title:create')
      expect(result).toBe(true)
    })

    test('should return false for user without permission', async () => {
      const mockUser = {
        id: 'clerk_user_123',
        emailAddresses: [{ emailAddress: 'readonly@example.com' }],
        firstName: 'Read',
        lastName: 'Only',
        publicMetadata: { role: 'read_only_user' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_user_123',
        user: mockUser
      })

      const result = await check_permission('title:create')
      expect(result).toBe(false)
    })

    test('should return false when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        user: null
      })

      const result = await check_permission('title:read')
      expect(result).toBe(false)
    })
  })

  describe('sync_user_to_database', () => {
    test('should create new user in database', async () => {
      const clerkUser = {
        id: 'clerk_new_user',
        emailAddresses: [{ emailAddress: 'newuser@example.com' }],
        firstName: 'New',
        lastName: 'User'
      }

      const result = await sync_user_to_database(clerkUser)

      expect(result).toMatchObject({
        clerk_id: 'clerk_new_user',
        email: 'newuser@example.com',
        first_name: 'New',
        last_name: 'User',
        is_active: true
      })
    })

    test('should update existing user in database', async () => {
      // First create a user
      const clerkUser = {
        id: 'clerk_existing_user',
        emailAddresses: [{ emailAddress: 'existing@example.com' }],
        firstName: 'Existing',
        lastName: 'User'
      }

      await sync_user_to_database(clerkUser)

      // Then update the user
      const updatedClerkUser = {
        id: 'clerk_existing_user',
        emailAddresses: [{ emailAddress: 'updated@example.com' }],
        firstName: 'Updated',
        lastName: 'User'
      }

      const result = await sync_user_to_database(updatedClerkUser)

      expect(result).toMatchObject({
        clerk_id: 'clerk_existing_user',
        email: 'updated@example.com',
        first_name: 'Updated',
        last_name: 'Updated'
      })
    })

    test('should throw error for user without email', async () => {
      const clerkUser = {
        id: 'clerk_no_email',
        emailAddresses: [],
        firstName: 'No',
        lastName: 'Email'
      }

      await expect(sync_user_to_database(clerkUser)).rejects.toThrow('User email not found')
    })

    test('should assign default role to new users', async () => {
      const clerkUser = {
        id: 'clerk_default_role',
        emailAddresses: [{ emailAddress: 'defaultrole@example.com' }],
        firstName: 'Default',
        lastName: 'Role'
      }

      const result = await sync_user_to_database(clerkUser)

      // Check that user has been assigned a role
      expect(result.userRoles).toBeDefined()
    })
  })

  describe('validate_api_auth', () => {
    test('should return user info for authenticated request', async () => {
      const mockUser = {
        id: 'clerk_api_user',
        emailAddresses: [{ emailAddress: 'api@example.com' }],
        firstName: 'API',
        lastName: 'User',
        publicMetadata: { role: 'admin' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_api_user',
        user: mockUser
      })

      const mockRequest = new NextRequest('http://localhost/api/test')
      const result = await validate_api_auth(mockRequest)

      expect(result).toMatchObject({
        userId: 'clerk_api_user',
        user: mockUser,
        role: 'admin',
        email: 'api@example.com'
      })
    })

    test('should throw error for unauthenticated request', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        user: null
      })

      const mockRequest = new NextRequest('http://localhost/api/test')

      await expect(validate_api_auth(mockRequest)).rejects.toThrow('Unauthorized')
    })
  })

  describe('validate_api_permission', () => {
    test('should return user info when user has permission', async () => {
      const mockUser = {
        id: 'clerk_perm_user',
        emailAddresses: [{ emailAddress: 'perm@example.com' }],
        firstName: 'Permission',
        lastName: 'User',
        publicMetadata: { role: 'admin' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_perm_user',
        user: mockUser
      })

      const mockRequest = new NextRequest('http://localhost/api/test')
      const result = await validate_api_permission(mockRequest, 'title:create')

      expect(result).toMatchObject({
        userId: 'clerk_perm_user',
        user: mockUser,
        role: 'admin'
      })
    })

    test('should throw error when user lacks permission', async () => {
      const mockUser = {
        id: 'clerk_no_perm_user',
        emailAddresses: [{ emailAddress: 'noperm@example.com' }],
        firstName: 'No',
        lastName: 'Permission',
        publicMetadata: { role: 'read_only_user' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_no_perm_user',
        user: mockUser
      })

      const mockRequest = new NextRequest('http://localhost/api/test')

      await expect(
        validate_api_permission(mockRequest, 'title:create')
      ).rejects.toThrow('Forbidden')
    })
  })

  describe('create_audit_log', () => {
    test('should create audit log entry', async () => {
      // First create a user to reference
      const clerkUser = {
        id: 'clerk_audit_user',
        emailAddresses: [{ emailAddress: 'audit@example.com' }],
        firstName: 'Audit',
        lastName: 'User'
      }
      const user = await sync_user_to_database(clerkUser)

      await create_audit_log(
        parseInt(user.id),
        'user:login',
        { timestamp: new Date() }
      )

      // Verify the audit log was created by checking the database
      const auditLogs = await testDb.auditLog.findMany({
        where: { user_id: user.id }
      })

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0]).toMatchObject({
        user_id: user.id,
        action: 'user:login'
      })
    })

    test('should capture IP address and user agent from request', async () => {
      const clerkUser = {
        id: 'clerk_audit_ip_user',
        emailAddresses: [{ emailAddress: 'auditip@example.com' }],
        firstName: 'Audit',
        lastName: 'IP'
      }
      const user = await sync_user_to_database(clerkUser)

      const mockRequest = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser 1.0'
        }
      })

      await create_audit_log(
        parseInt(user.id),
        'user:action',
        { data: 'test' },
        mockRequest
      )

      const auditLogs = await testDb.auditLog.findMany({
        where: { user_id: user.id }
      })

      expect(auditLogs[0]).toMatchObject({
        ip_address: '192.168.1.100',
        user_agent: 'Test Browser 1.0'
      })
    })
  })

  describe('Performance Tests', () => {
    test('should complete auth checks in under 500ms', async () => {
      const mockUser = {
        id: 'clerk_perf_user',
        emailAddresses: [{ emailAddress: 'perf@example.com' }],
        firstName: 'Performance',
        lastName: 'User',
        publicMetadata: { role: 'admin' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_perf_user',
        user: mockUser
      })

      const startTime = Date.now()

      // Perform multiple auth operations
      for (let i = 0; i < 10; i++) {
        await get_current_user()
        await check_permission('title:read')
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(500)
    })
  })
})