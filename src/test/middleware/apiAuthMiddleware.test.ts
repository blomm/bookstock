import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { NextRequest, NextResponse } from 'next/server'
import { apiAuthMiddleware } from '@/middleware/apiAuthMiddleware'

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn()
}))

describe('API Auth Middleware', () => {
  beforeEach(async () => {
    await cleanDatabase()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Authentication Middleware', () => {
    test('should allow authenticated requests to proceed', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_auth_user',
        user: {
          id: 'clerk_auth_user',
          emailAddresses: [{ emailAddress: 'auth@example.com' }],
          publicMetadata: { role: 'admin' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/protected')
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const protectedHandler = apiAuthMiddleware(mockHandler)
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalledWith(mockRequest)
      expect(response.status).toBe(200)
    })

    test('should reject unauthenticated requests', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: null,
        user: null
      })

      const mockRequest = new NextRequest('http://localhost/api/protected')
      const mockHandler = vi.fn()

      const protectedHandler = apiAuthMiddleware(mockHandler)
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toMatchObject({
        error: 'Unauthorized'
      })
    })

    test('should handle authentication errors gracefully', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockRejectedValue(new Error('Auth service unavailable'))

      const mockRequest = new NextRequest('http://localhost/api/protected')
      const mockHandler = vi.fn()

      const protectedHandler = apiAuthMiddleware(mockHandler)
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    test('should add user context to request', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      const mockUser = {
        id: 'clerk_context_user',
        emailAddresses: [{ emailAddress: 'context@example.com' }],
        publicMetadata: { role: 'operations_manager' }
      }

      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_context_user',
        user: mockUser
      })

      const mockRequest = new NextRequest('http://localhost/api/protected')
      const mockHandler = vi.fn((req) => {
        // Check that user context is added to request
        expect(req.user).toMatchObject({
          id: 'clerk_context_user',
          email: 'context@example.com',
          role: 'operations_manager'
        })
        return NextResponse.json({ success: true })
      })

      const protectedHandler = apiAuthMiddleware(mockHandler)
      await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalled()
    })
  })

  describe('Permission Middleware', () => {
    test('should allow requests with required permission', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_perm_user',
        user: {
          id: 'clerk_perm_user',
          emailAddresses: [{ emailAddress: 'perm@example.com' }],
          publicMetadata: { role: 'admin' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/titles', {
        method: 'POST'
      })
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const protectedHandler = apiAuthMiddleware(mockHandler, ['title:create'])
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalledWith(mockRequest)
      expect(response.status).toBe(200)
    })

    test('should reject requests without required permission', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_no_perm_user',
        user: {
          id: 'clerk_no_perm_user',
          emailAddresses: [{ emailAddress: 'noperm@example.com' }],
          publicMetadata: { role: 'read_only_user' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/titles', {
        method: 'POST'
      })
      const mockHandler = vi.fn()

      const protectedHandler = apiAuthMiddleware(mockHandler, ['title:create'])
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data).toMatchObject({
        error: 'Forbidden'
      })
    })

    test('should allow requests with any of multiple required permissions', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_multi_perm_user',
        user: {
          id: 'clerk_multi_perm_user',
          emailAddresses: [{ emailAddress: 'multi@example.com' }],
          publicMetadata: { role: 'inventory_clerk' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/inventory')
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const protectedHandler = apiAuthMiddleware(mockHandler, [
        'inventory:read',
        'inventory:update'
      ])
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalledWith(mockRequest)
      expect(response.status).toBe(200)
    })
  })

  describe('Audit Logging Middleware', () => {
    test('should create audit log for protected requests', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_audit_user',
        user: {
          id: 'clerk_audit_user',
          emailAddresses: [{ emailAddress: 'audit@example.com' }],
          publicMetadata: { role: 'admin' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/titles', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Title' })
      })
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ id: 'new_title_id' })
      )

      const auditingHandler = apiAuthMiddleware(mockHandler, [], {
        enableAuditLog: true,
        action: 'title:create'
      })
      await auditingHandler(mockRequest)

      // Verify audit log was created
      const auditLogs = await testDb.auditLog.findMany({
        where: { action: 'title:create' }
      })

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0]).toMatchObject({
        action: 'title:create',
        resource: 'title'
      })
    })

    test('should include request details in audit log', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_detail_user',
        user: {
          id: 'clerk_detail_user',
          emailAddresses: [{ emailAddress: 'detail@example.com' }],
          publicMetadata: { role: 'operations_manager' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/inventory/123', {
        method: 'PUT',
        headers: {
          'x-forwarded-for': '192.168.1.50',
          'user-agent': 'Test Client 2.0'
        }
      })
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const auditingHandler = apiAuthMiddleware(mockHandler, [], {
        enableAuditLog: true,
        action: 'inventory:update',
        resource: 'inventory',
        resourceId: '123'
      })
      await auditingHandler(mockRequest)

      const auditLogs = await testDb.auditLog.findMany({
        where: { action: 'inventory:update' }
      })

      expect(auditLogs[0]).toMatchObject({
        action: 'inventory:update',
        resource: 'inventory',
        resource_id: '123',
        ip_address: '192.168.1.50',
        user_agent: 'Test Client 2.0'
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle middleware errors gracefully', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_error_user',
        user: {
          id: 'clerk_error_user',
          emailAddresses: [{ emailAddress: 'error@example.com' }],
          publicMetadata: { role: 'admin' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/error')
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'))

      const protectedHandler = apiAuthMiddleware(mockHandler)
      const response = await protectedHandler(mockRequest)

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toMatchObject({
        error: 'Internal Server Error'
      })
    })

    test('should handle database connection errors', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_db_error_user',
        user: {
          id: 'clerk_db_error_user',
          emailAddresses: [{ emailAddress: 'dberror@example.com' }],
          publicMetadata: { role: 'admin' }
        }
      })

      // Mock database error
      const originalCreate = testDb.auditLog.create
      testDb.auditLog.create = vi.fn().mockRejectedValue(new Error('DB connection failed'))

      const mockRequest = new NextRequest('http://localhost/api/test')
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const auditingHandler = apiAuthMiddleware(mockHandler, [], {
        enableAuditLog: true,
        action: 'test:action'
      })

      // Should still complete successfully even if audit logging fails
      const response = await auditingHandler(mockRequest)
      expect(response.status).toBe(200)

      // Restore original function
      testDb.auditLog.create = originalCreate
    })
  })

  describe('Performance Tests', () => {
    test('should complete middleware processing in under 100ms', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_perf_user',
        user: {
          id: 'clerk_perf_user',
          emailAddresses: [{ emailAddress: 'perf@example.com' }],
          publicMetadata: { role: 'admin' }
        }
      })

      const mockRequest = new NextRequest('http://localhost/api/perf')
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const protectedHandler = apiAuthMiddleware(mockHandler, ['title:read'])

      const startTime = Date.now()
      await protectedHandler(mockRequest)
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(100)
    })

    test('should handle concurrent requests efficiently', async () => {
      const { auth } = await import('@clerk/nextjs/server')
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_concurrent_user',
        user: {
          id: 'clerk_concurrent_user',
          emailAddresses: [{ emailAddress: 'concurrent@example.com' }],
          publicMetadata: { role: 'admin' }
        }
      })

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )
      const protectedHandler = apiAuthMiddleware(mockHandler)

      const requests = Array(20).fill(null).map((_, index) => {
        const request = new NextRequest(`http://localhost/api/test${index}`)
        return protectedHandler(request)
      })

      const startTime = Date.now()
      const responses = await Promise.all(requests)
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(500)
      expect(responses.every(r => r.status === 200)).toBe(true)
    })
  })
})