import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import WebhookService, {
  WebhookEndpoint,
  WebhookEventType,
  MovementWebhookData,
  InventoryWebhookData,
  BatchWebhookData
} from '../../services/webhookService'
import { MovementType } from '@prisma/client'

describe('WebhookService', () => {
  beforeAll(async () => {
    await WebhookService.initializeDefaultEndpoints()
  })

  beforeEach(async () => {
    // Clear all endpoints
    const endpoints = ['test-endpoint', 'invalid-endpoint', 'signature-test', 'metrics-test']
    for (const id of endpoints) {
      await WebhookService.unregisterEndpoint(id)
    }
  })

  describe('Endpoint Management', () => {
    it('should register webhook endpoint successfully', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'test-endpoint',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created', 'movement.updated'],
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        },
        metadata: {
          description: 'Test endpoint'
        }
      }

      await expect(WebhookService.registerEndpoint(endpoint)).resolves.toBeUndefined()
    })

    it('should validate endpoint configuration', async () => {
      const invalidEndpoint: WebhookEndpoint = {
        id: '',
        url: 'invalid-url',
        secret: 'short',
        isActive: true,
        events: [],
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      }

      await expect(WebhookService.registerEndpoint(invalidEndpoint))
        .rejects.toThrow('Endpoint ID is required')
    })

    it('should update webhook endpoint', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'update-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created'],
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const success = await WebhookService.updateEndpoint('update-test', {
        isActive: false,
        events: ['movement.created', 'movement.updated']
      })

      expect(success).toBe(true)
    })

    it('should unregister webhook endpoint', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'unregister-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created'],
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      }

      await WebhookService.registerEndpoint(endpoint)
      const success = await WebhookService.unregisterEndpoint('unregister-test')

      expect(success).toBe(true)

      const successAgain = await WebhookService.unregisterEndpoint('unregister-test')
      expect(successAgain).toBe(false)
    })
  })

  describe('Event Triggering', () => {
    it('should trigger movement event', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'movement-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created'],
        retryPolicy: {
          maxRetries: 1,
          retryDelay: 100,
          backoffMultiplier: 1
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const movementData: MovementWebhookData = {
        movementId: 123,
        externalId: 'ext_123',
        titleId: 456,
        titleISBN: '9781234567890',
        titleName: 'Test Book',
        warehouseId: 789,
        warehouseName: 'Test Warehouse',
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 100,
        unitCost: 5.50,
        totalValue: 550.00,
        movementDate: new Date(),
        performedBy: 'test-user'
      }

      await expect(WebhookService.triggerMovementEvent('movement.created', movementData))
        .resolves.toBeUndefined()
    })

    it('should trigger inventory event', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'inventory-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['inventory.updated'],
        retryPolicy: {
          maxRetries: 1,
          retryDelay: 100,
          backoffMultiplier: 1
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const inventoryData: InventoryWebhookData = {
        titleId: 123,
        warehouseId: 456,
        previousLevel: 100,
        newLevel: 90,
        change: -10,
        triggerMovementId: 789
      }

      await expect(WebhookService.triggerInventoryEvent(inventoryData))
        .resolves.toBeUndefined()
    })

    it('should trigger batch event', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'batch-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['batch.completed'],
        retryPolicy: {
          maxRetries: 1,
          retryDelay: 100,
          backoffMultiplier: 1
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const batchData: BatchWebhookData = {
        batchId: 'batch_123',
        sourceSystem: 'TestSystem',
        totalCount: 100,
        successCount: 95,
        failureCount: 5,
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        errors: ['Error 1', 'Error 2']
      }

      await expect(WebhookService.triggerBatchEvent('batch.completed', batchData))
        .resolves.toBeUndefined()
    })

    it('should only trigger events for subscribed endpoints', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'selective-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created'], // Only subscribed to created events
        retryPolicy: {
          maxRetries: 1,
          retryDelay: 100,
          backoffMultiplier: 1
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const movementData: MovementWebhookData = {
        movementId: 123,
        titleId: 456,
        titleISBN: '9781234567890',
        titleName: 'Test Book',
        warehouseId: 789,
        warehouseName: 'Test Warehouse',
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 100,
        unitCost: 5.50,
        totalValue: 550.00,
        movementDate: new Date(),
        performedBy: 'test-user'
      }

      // This should trigger (subscribed)
      await WebhookService.triggerMovementEvent('movement.created', movementData)

      // This should not trigger (not subscribed)
      await WebhookService.triggerMovementEvent('movement.updated', movementData)

      // Allow some time for processing
      await new Promise(resolve => setTimeout(resolve, 50))
    })
  })

  describe('Signature Generation and Verification', () => {
    it('should generate valid signature', () => {
      const payload = JSON.stringify({ test: 'data' })
      const secret = 'test-secret-key'

      const signature = WebhookService.generateSignature(payload, secret)

      expect(signature.timestamp).toBeTypeOf('number')
      expect(signature.signature).toMatch(/^v1=/)
    })

    it('should verify valid signature', () => {
      const payload = JSON.stringify({ test: 'data' })
      const secret = 'test-secret-key'

      const signature = WebhookService.generateSignature(payload, secret)
      const receivedSignature = `t=${signature.timestamp},v1=${signature.signature.replace('v1=', '')}`

      const isValid = WebhookService.verifySignature(payload, receivedSignature, secret)

      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' })
      const secret = 'test-secret-key'

      const invalidSignature = 't=1234567890,v1=invalid_signature'

      const isValid = WebhookService.verifySignature(payload, invalidSignature, secret)

      expect(isValid).toBe(false)
    })

    it('should reject expired signature', () => {
      const payload = JSON.stringify({ test: 'data' })
      const secret = 'test-secret-key'

      const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // 400 seconds ago
      const crypto = require('crypto')
      const signingString = `${oldTimestamp}.${payload}`
      const signatureValue = crypto
        .createHmac('sha256', secret)
        .update(signingString, 'utf8')
        .digest('hex')

      const expiredSignature = `t=${oldTimestamp},v1=${signatureValue}`

      const isValid = WebhookService.verifySignature(payload, expiredSignature, secret, 300)

      expect(isValid).toBe(false)
    })
  })

  describe('Delivery Management', () => {
    it('should track delivery status', async () => {
      // Mock fetch to simulate webhook delivery
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK')
      })
      global.fetch = mockFetch

      const endpoint: WebhookEndpoint = {
        id: 'delivery-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created'],
        retryPolicy: {
          maxRetries: 1,
          retryDelay: 100,
          backoffMultiplier: 1
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const movementData: MovementWebhookData = {
        movementId: 123,
        titleId: 456,
        titleISBN: '9781234567890',
        titleName: 'Test Book',
        warehouseId: 789,
        warehouseName: 'Test Warehouse',
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 100,
        unitCost: 5.50,
        totalValue: 550.00,
        movementDate: new Date(),
        performedBy: 'test-user'
      }

      await WebhookService.triggerMovementEvent('movement.created', movementData)

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com/webhooks'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'movement.created'
          })
        })
      )
    })

    it('should get endpoint metrics', async () => {
      const endpoint: WebhookEndpoint = {
        id: 'metrics-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created'],
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const metrics = await WebhookService.getEndpointMetrics('metrics-test')

      expect(metrics).toMatchObject({
        totalDeliveries: expect.any(Number),
        successfulDeliveries: expect.any(Number),
        failedDeliveries: expect.any(Number),
        averageResponseTime: expect.any(Number),
        successRate: expect.any(Number)
      })
    })
  })

  describe('Queue Processing', () => {
    it('should process delivery queue', async () => {
      // Mock failed then successful fetch
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error')
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('OK')
        })

      global.fetch = mockFetch

      const endpoint: WebhookEndpoint = {
        id: 'queue-test',
        url: 'https://example.com/webhooks',
        secret: 'test-secret-key-12345',
        isActive: true,
        events: ['movement.created'],
        retryPolicy: {
          maxRetries: 2,
          retryDelay: 50,
          backoffMultiplier: 1
        }
      }

      await WebhookService.registerEndpoint(endpoint)

      const movementData: MovementWebhookData = {
        movementId: 123,
        titleId: 456,
        titleISBN: '9781234567890',
        titleName: 'Test Book',
        warehouseId: 789,
        warehouseName: 'Test Warehouse',
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 100,
        unitCost: 5.50,
        totalValue: 550.00,
        movementDate: new Date(),
        performedBy: 'test-user'
      }

      await WebhookService.triggerMovementEvent('movement.created', movementData)

      // Allow time for initial processing and retry
      await new Promise(resolve => setTimeout(resolve, 200))

      // Process queue manually to ensure retries are processed
      await WebhookService.processDeliveryQueue()

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})