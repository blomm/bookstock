import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { testDb } from '../utils/test-db'
import StockMovementAuditService, { setDbClient } from '@/services/stockMovementAuditService'
import { MovementType } from '@prisma/client'

describe('Stock Movement Audit Service', () => {
  beforeEach(async () => {
    setDbClient(testDb)
    await testDb.stockMovement.deleteMany()
    await testDb.inventory.deleteMany()
    await testDb.title.deleteMany()
    await testDb.warehouse.deleteMany()
    await testDb.series.deleteMany()
  })

  afterEach(async () => {
    await testDb.stockMovement.deleteMany()
    await testDb.inventory.deleteMany()
    await testDb.title.deleteMany()
    await testDb.warehouse.deleteMany()
    await testDb.series.deleteMany()
  })

  describe('Audit Trail Creation', () => {
    test('should create audit entry for movement', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          rrpAtTime: 19.99,
          unitCostAtTime: 5.50
        }
      })

      // Create audit entry
      const auditEntry = await StockMovementAuditService.createAuditEntry(
        movement.id,
        'CREATED',
        'test_user',
        {
          newValues: { quantity: 100, movementType: 'PRINT_RECEIVED' },
          reason: 'Initial movement creation',
          metadata: { source: 'test' }
        }
      )

      expect(auditEntry).toBeDefined()
      expect(auditEntry.movementId).toBe(movement.id)
      expect(auditEntry.action).toBe('CREATED')
      expect(auditEntry.performedBy).toBe('test_user')
      expect(auditEntry.newValues).toEqual({ quantity: 100, movementType: 'PRINT_RECEIVED' })
      expect(auditEntry.reason).toBe('Initial movement creation')
      expect(auditEntry.metadata).toEqual({ source: 'test' })
    })

    test('should create audit entry with minimal data', async () => {
      const auditEntry = await StockMovementAuditService.createAuditEntry(
        123,
        'UPDATED',
        'system'
      )

      expect(auditEntry).toBeDefined()
      expect(auditEntry.movementId).toBe(123)
      expect(auditEntry.action).toBe('UPDATED')
      expect(auditEntry.performedBy).toBe('system')
      expect(auditEntry.performedAt).toBeInstanceOf(Date)
    })
  })

  describe('Movement Audit Trail', () => {
    test('should get complete audit trail for movement', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          rrpAtTime: 19.99,
          unitCostAtTime: 5.50,
          referenceNumber: 'TEST-001'
        }
      })

      // Get audit trail
      const auditTrail = await StockMovementAuditService.getMovementAuditTrail(movement.id)

      expect(auditTrail).toBeDefined()
      expect(auditTrail!.movementId).toBe(movement.id)
      expect(auditTrail!.movement).toBeDefined()
      expect(auditTrail!.movement.title.title).toBe('Test Book')
      expect(auditTrail!.movement.warehouse.name).toBe('Test Warehouse')
      expect(auditTrail!.auditEntries).toBeDefined()
      expect(auditTrail!.timeline).toBeDefined()
      expect(auditTrail!.relatedMovements).toBeDefined()
    })

    test('should return null for non-existent movement', async () => {
      const auditTrail = await StockMovementAuditService.getMovementAuditTrail(99999)
      expect(auditTrail).toBeNull()
    })

    test('should get audit summary for movement', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          rrpAtTime: 19.99,
          unitCostAtTime: 5.50
        }
      })

      // Get audit summary
      const summary = await StockMovementAuditService.getMovementAuditSummary(movement.id)

      expect(summary).toBeDefined()
      expect(summary.totalAuditEntries).toBeGreaterThanOrEqual(0)
      expect(summary.isPartOfChain).toBe(false)
    })
  })

  describe('Movement Chain Tracking', () => {
    test('should create movement chain', async () => {
      const chainId = await StockMovementAuditService.createMovementChain(
        'test_user',
        'test_transfer',
        { description: 'Test chain creation' }
      )

      expect(chainId).toBeDefined()
      expect(chainId).toMatch(/^chain_/)
    })

    test('should get related movements for transfer pair', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const sourceWarehouse = await testDb.warehouse.create({
        data: {
          name: 'Source Warehouse',
          code: 'SRC',
          location: 'Source Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const destWarehouse = await testDb.warehouse.create({
        data: {
          name: 'Destination Warehouse',
          code: 'DST',
          location: 'Destination Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create transfer out movement
      const transferOut = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -50,
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destWarehouse.id,
          referenceNumber: 'TRANSFER-001'
        }
      })

      // Create transfer in movement
      const transferIn = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 50,
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destWarehouse.id,
          referenceNumber: 'TRANSFER-001'
        }
      })

      // Get related movements
      const relatedMovements = await StockMovementAuditService.getRelatedMovements(transferOut.id)

      expect(relatedMovements).toBeDefined()
      expect(relatedMovements.length).toBeGreaterThan(0)

      // Should find the transfer in movement
      const foundTransferIn = relatedMovements.find(m => m.id === transferIn.id)
      expect(foundTransferIn).toBeDefined()
    })

    test('should trace movement chain from single movement', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          batchNumber: 'BATCH-001'
        }
      })

      // Trace chain
      const chain = await StockMovementAuditService.traceMovementChain({ movementId: movement.id })

      expect(chain).toBeDefined()
      expect(chain!.movements.length).toBeGreaterThan(0)
      expect(chain!.metadata.totalQuantity).toBeGreaterThan(0)
    })
  })

  describe('Movement Timeline Generation', () => {
    test('should generate timeline for movement', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          rrpAtTime: 19.99
        }
      })

      // Generate timeline
      const timeline = await StockMovementAuditService.generateMovementTimeline(movement.id)

      expect(timeline).toBeDefined()
      expect(timeline.length).toBeGreaterThan(0)

      // Should include creation event
      const creationEvent = timeline.find(entry => entry.action === 'MOVEMENT_CREATED')
      expect(creationEvent).toBeDefined()
      expect(creationEvent!.description).toContain('PRINT_RECEIVED')
      expect(creationEvent!.description).toContain('100 units')
    })

    test('should generate timeline for transfer movement', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const sourceWarehouse = await testDb.warehouse.create({
        data: {
          name: 'Source Warehouse',
          code: 'SRC',
          location: 'Source Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const destWarehouse = await testDb.warehouse.create({
        data: {
          name: 'Destination Warehouse',
          code: 'DST',
          location: 'Destination Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      const transferMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -50,
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destWarehouse.id
        }
      })

      // Generate timeline
      const timeline = await StockMovementAuditService.generateMovementTimeline(transferMovement.id)

      expect(timeline).toBeDefined()
      expect(timeline.length).toBeGreaterThan(0)

      // Should include transfer-specific events
      const transferEvents = timeline.filter(entry => entry.action.includes('TRANSFER'))
      expect(transferEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Comprehensive Movement History', () => {
    test('should get comprehensive movement history for title', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create multiple movements
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(Date.now() - 86400000) // Yesterday
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -25,
          movementDate: new Date() // Today
        }
      })

      // Get comprehensive history
      const history = await StockMovementAuditService.getComprehensiveMovementHistory(
        title.id, // titleId
        undefined, // warehouseId
        new Date(Date.now() - 2 * 86400000), // dateFrom (2 days ago)
        new Date(), // dateTo (today)
        10 // limit
      )

      expect(history).toBeDefined()
      expect(history.length).toBe(2)

      // Should be sorted by movement date descending
      expect(history[0].movement.movementType).toBe('UK_TRADE_SALES')
      expect(history[1].movement.movementType).toBe('PRINT_RECEIVED')
    })

    test('should get comprehensive movement history for warehouse', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title1 = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book 1',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      const title2 = await testDb.title.create({
        data: {
          isbn: '9781234567891',
          title: 'Test Book 2',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 24.99,
          unitCost: 6.50,
          seriesId: series.id
        }
      })

      // Create movements for different titles in same warehouse
      await testDb.stockMovement.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date()
        }
      })

      await testDb.stockMovement.create({
        data: {
          titleId: title2.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 50,
          movementDate: new Date()
        }
      })

      // Get comprehensive history for warehouse
      const history = await StockMovementAuditService.getComprehensiveMovementHistory(
        undefined, // titleId
        warehouse.id, // warehouseId
        undefined, // dateFrom
        undefined, // dateTo
        10 // limit
      )

      expect(history).toBeDefined()
      expect(history.length).toBe(2)

      // All movements should be from the same warehouse
      history.forEach(auditTrail => {
        expect(auditTrail.movement.warehouseId).toBe(warehouse.id)
      })
    })

    test('should respect limit parameter', async () => {
      // Create test data
      const series = await testDb.series.create({
        data: { name: 'Test Series', description: 'Test Description' }
      })

      const warehouse = await testDb.warehouse.create({
        data: {
          name: 'Test Warehouse',
          code: 'TWH',
          location: 'Test Location',
          fulfillsChannels: ['UK_TRADE']
        }
      })

      const title = await testDb.title.create({
        data: {
          isbn: '9781234567890',
          title: 'Test Book',
          author: 'Test Author',
          format: 'PAPERBACK',
          rrp: 19.99,
          unitCost: 5.50,
          seriesId: series.id
        }
      })

      // Create 5 movements
      for (let i = 0; i < 5; i++) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'PRINT_RECEIVED',
            quantity: 10,
            movementDate: new Date(Date.now() - i * 86400000) // Different days
          }
        })
      }

      // Get limited history
      const history = await StockMovementAuditService.getComprehensiveMovementHistory(
        title.id,
        undefined,
        undefined,
        undefined,
        3 // limit to 3
      )

      expect(history).toBeDefined()
      expect(history.length).toBe(3)
    })
  })

  describe('Error Handling', () => {
    test('should handle non-existent movement gracefully', async () => {
      const timeline = await StockMovementAuditService.generateMovementTimeline(99999)
      expect(timeline).toEqual([])
    })

    test('should handle empty related movements', async () => {
      const relatedMovements = await StockMovementAuditService.getRelatedMovements(99999)
      expect(relatedMovements).toEqual([])
    })

    test('should handle chain operations with non-existent chain', async () => {
      const chain = await StockMovementAuditService.getMovementChain('non-existent-chain')
      expect(chain).toBeDefined() // Returns mock chain
    })
  })
})