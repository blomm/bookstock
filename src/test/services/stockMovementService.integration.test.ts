import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestPrinter } from '../utils/test-db'
import StockMovementService, { setDbClient, MovementRequest, BatchMovementRequest, TransactionRollbackRequest } from '@/services/stockMovementService'

describe('Stock Movement Service Integration Tests', () => {
  let warehouse1: any
  let warehouse2: any
  let title1: any
  let printer: any

  beforeEach(async () => {
    await cleanDatabase()
    setDbClient(testDb)

    // Create test data
    warehouse1 = await createTestWarehouse({
      name: 'Main Warehouse',
      code: 'MAIN001',
      location: 'London, UK',
      fulfillsChannels: ['wholesale', 'online']
    })

    warehouse2 = await createTestWarehouse({
      name: 'Secondary Warehouse',
      code: 'SEC001',
      location: 'Manchester, UK',
      fulfillsChannels: ['retail']
    })

    title1 = await createTestTitle({
      isbn: '9781234567890',
      title: 'Integration Test Book',
      author: 'Test Author',
      rrp: 19.99,
      unitCost: 8.50
    })

    printer = await createTestPrinter({
      name: 'Lightning Source UK',
      location: 'Milton Keynes, UK'
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Atomic Transaction Processing', () => {
    test('should process movement and update inventory atomically', async () => {
      // Create initial inventory
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 0,
          reservedStock: 0
        }
      })

      const movementRequest: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse1.id,
        movementType: 'PRINT_RECEIVED',
        quantity: 1000,
        movementDate: new Date('2024-01-15'),
        referenceNumber: 'ATOMIC-TEST-001',
        unitCostAtTime: 8.50,
        printerId: printer.id
      }

      const result = await StockMovementService.processMovement(movementRequest)

      expect(result.success).toBe(true)
      expect(result.movement).toBeDefined()
      expect(result.inventoryUpdated).toBe(true)

      // Verify movement was created
      const movement = await testDb.stockMovement.findUnique({
        where: { id: result.movement!.id }
      })
      expect(movement).toBeDefined()
      expect(movement!.quantity).toBe(1000)

      // Verify inventory was updated
      const inventory = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        }
      })
      expect(inventory!.currentStock).toBe(1000)
    })

    test('should rollback transaction on inventory update failure', async () => {
      // Don't create inventory record to force failure
      const movementRequest: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse1.id,
        movementType: 'UK_TRADE_SALES',
        quantity: -100, // Trying to sell without inventory
        movementDate: new Date('2024-01-15'),
        referenceNumber: 'ROLLBACK-TEST-001'
      }

      const result = await StockMovementService.processMovement(movementRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No inventory record found')

      // Verify no movement was created
      const movement = await testDb.stockMovement.findFirst({
        where: { referenceNumber: 'ROLLBACK-TEST-001' }
      })
      expect(movement).toBeNull()
    })
  })

  describe('Movement Validation and Business Rules', () => {
    test('should validate movement data and enforce business rules', async () => {
      // Create inventory for stock validation
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 500,
          reservedStock: 0
        }
      })

      // Valid movement
      const validRequest: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse1.id,
        movementType: 'UK_TRADE_SALES',
        quantity: -100,
        movementDate: new Date('2024-01-15'),
        referenceNumber: 'VALIDATION-001',
        rrpAtTime: 19.99,
        unitCostAtTime: 8.50
      }

      const validation = await StockMovementService.validateMovement(validRequest)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Invalid movement - insufficient stock
      const invalidRequest: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse1.id,
        movementType: 'UK_TRADE_SALES',
        quantity: -1000, // More than available
        movementDate: new Date('2024-01-15'),
        referenceNumber: 'VALIDATION-002'
      }

      const invalidValidation = await StockMovementService.validateMovement(invalidRequest)
      expect(invalidValidation.isValid).toBe(false)
      expect(invalidValidation.errors.some(e => e.includes('Insufficient stock'))).toBe(true)
    })

    test('should enforce warehouse channel compatibility', async () => {
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse2.id, // Secondary warehouse (retail only)
          currentStock: 500,
          reservedStock: 0
        }
      })

      // Try UK trade sales from retail-only warehouse
      const request: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse2.id,
        movementType: 'UK_TRADE_SALES',
        quantity: -100,
        movementDate: new Date('2024-01-15'),
        referenceNumber: 'CHANNEL-001'
      }

      const validation = await StockMovementService.validateMovement(request)
      expect(validation.warnings.some(w => w.includes('does not support UK_TRADE_SALES'))).toBe(true)
    })

    test('should validate transfer movements', async () => {
      const transferRequest: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse1.id,
        movementType: 'WAREHOUSE_TRANSFER',
        quantity: -100,
        movementDate: new Date('2024-01-15'),
        sourceWarehouseId: warehouse1.id,
        destinationWarehouseId: warehouse1.id // Same warehouse
      }

      const validation = await StockMovementService.validateMovement(transferRequest)
      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(e => e.includes('Source and destination warehouses cannot be the same'))).toBe(true)
    })
  })

  describe('Batch Processing', () => {
    test('should process batch movements efficiently', async () => {
      // Create inventory
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 2000,
          reservedStock: 0
        }
      })

      const batchRequest: BatchMovementRequest = {
        movements: [
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -100,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'BATCH-001',
            rrpAtTime: 19.99
          },
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'ONLINE_SALES',
            quantity: -50,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'BATCH-002',
            rrpAtTime: 19.99
          },
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'DIRECT_SALES',
            quantity: -75,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'BATCH-003',
            rrpAtTime: 19.99
          }
        ]
      }

      const result = await StockMovementService.processBatchMovements(batchRequest)

      expect(result.success).toBe(true)
      expect(result.successCount).toBe(3)
      expect(result.failureCount).toBe(0)
      expect(result.results).toHaveLength(3)
      expect(result.errors).toHaveLength(0)

      // Verify inventory was updated correctly
      const inventory = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        }
      })
      expect(inventory!.currentStock).toBe(1775) // 2000 - 100 - 50 - 75
    })

    test('should handle batch validation and partial failures', async () => {
      const batchRequest: BatchMovementRequest = {
        movements: [
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -100,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'PARTIAL-001'
          },
          {
            titleId: 99999, // Invalid title
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -50,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'PARTIAL-002'
          }
        ],
        continueOnError: true
      }

      const result = await StockMovementService.processBatchMovements(batchRequest)

      expect(result.success).toBe(false)
      expect(result.failureCount).toBeGreaterThan(0)
      expect(result.errors.length).toBeGreaterThan(0)

      // At least one error should be about invalid title or no inventory
      const hasExpectedError = result.errors.some(error =>
        error.error.includes('Title not found') ||
        error.error.includes('No inventory record found')
      )
      expect(hasExpectedError).toBe(true)
    })

    test('should support validation-only mode', async () => {
      const batchRequest: BatchMovementRequest = {
        movements: [
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            movementType: 'UK_TRADE_SALES',
            quantity: -100,
            movementDate: new Date('2024-01-15'),
            referenceNumber: 'VALIDATE-001'
          }
        ],
        validateOnly: true
      }

      const result = await StockMovementService.processBatchMovements(batchRequest)

      expect(result.results).toHaveLength(0) // No actual processing
      expect(result.errors).toHaveLength(1) // Validation error for no inventory

      // Verify no movements were created
      const movements = await testDb.stockMovement.findMany({
        where: { referenceNumber: 'VALIDATE-001' }
      })
      expect(movements).toHaveLength(0)
    })
  })

  describe('Transaction Rollback and Compensation', () => {
    test('should rollback movement and revert inventory changes', async () => {
      // Create inventory and initial movement
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 1000,
          reservedStock: 0
        }
      })

      const movementRequest: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse1.id,
        movementType: 'UK_TRADE_SALES',
        quantity: -200,
        movementDate: new Date('2024-01-15'),
        referenceNumber: 'ROLLBACK-001',
        rrpAtTime: 19.99
      }

      const processResult = await StockMovementService.processMovement(movementRequest)
      expect(processResult.success).toBe(true)

      // Verify inventory after movement
      const inventoryAfter = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        }
      })
      expect(inventoryAfter!.currentStock).toBe(800)

      // Rollback the movement
      const rollbackRequest: TransactionRollbackRequest = {
        movementId: processResult.movement!.id,
        reason: 'Incorrect quantity entered',
        approvedBy: 'Test Manager',
        createReversalMovement: true
      }

      const rollbackResult = await StockMovementService.rollbackMovement(rollbackRequest)

      expect(rollbackResult.success).toBe(true)
      expect(rollbackResult.originalMovement).toBeDefined()
      expect(rollbackResult.reversalMovement).toBeDefined()
      expect(rollbackResult.inventoryReverted).toBe(true)

      // Verify reversal movement
      expect(rollbackResult.reversalMovement!.quantity).toBe(200) // Opposite of original
      expect(rollbackResult.reversalMovement!.notes).toContain('Rollback of movement')

      // Verify inventory was reverted
      const inventoryReverted = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        }
      })
      expect(inventoryReverted!.currentStock).toBe(1000) // Back to original
    })

    test('should handle warehouse transfer rollback', async () => {
      // Create inventory in both warehouses
      await testDb.inventory.createMany({
        data: [
          {
            titleId: title1.id,
            warehouseId: warehouse1.id,
            currentStock: 500,
            reservedStock: 0
          },
          {
            titleId: title1.id,
            warehouseId: warehouse2.id,
            currentStock: 0,
            reservedStock: 0
          }
        ]
      })

      // Create transfer movement (outbound from warehouse1)
      const transferRequest: MovementRequest = {
        titleId: title1.id,
        warehouseId: warehouse1.id,
        movementType: 'WAREHOUSE_TRANSFER',
        quantity: -100,
        movementDate: new Date('2024-01-15'),
        sourceWarehouseId: warehouse1.id,
        destinationWarehouseId: warehouse2.id,
        referenceNumber: 'TRANSFER-ROLLBACK-001'
      }

      const processResult = await StockMovementService.processMovement(transferRequest)
      expect(processResult.success).toBe(true)

      // Rollback with reversal movement
      const rollbackRequest: TransactionRollbackRequest = {
        movementId: processResult.movement!.id,
        reason: 'Transfer cancelled',
        approvedBy: 'Warehouse Manager',
        createReversalMovement: true
      }

      const rollbackResult = await StockMovementService.rollbackMovement(rollbackRequest)

      expect(rollbackResult.success).toBe(true)
      expect(rollbackResult.reversalMovement).toBeDefined()

      // Verify reversal movement reverses transfer direction
      const reversal = rollbackResult.reversalMovement!
      expect(reversal.quantity).toBe(100) // Opposite of original -100
      expect(reversal.sourceWarehouseId).toBe(warehouse2.id) // Reversed
      expect(reversal.destinationWarehouseId).toBe(warehouse1.id) // Reversed
    })
  })

  describe('Utility Methods', () => {
    test('should get movement history with filters', async () => {
      // Create inventory
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 1000,
          reservedStock: 0
        }
      })

      // Create multiple movements
      const movements = [
        {
          movementType: 'PRINT_RECEIVED' as const,
          quantity: 1000,
          date: new Date('2024-01-01')
        },
        {
          movementType: 'UK_TRADE_SALES' as const,
          quantity: -200,
          date: new Date('2024-01-15')
        },
        {
          movementType: 'ONLINE_SALES' as const,
          quantity: -100,
          date: new Date('2024-01-20')
        }
      ]

      for (const [index, movement] of movements.entries()) {
        await StockMovementService.processMovement({
          titleId: title1.id,
          warehouseId: warehouse1.id,
          movementType: movement.movementType,
          quantity: movement.quantity,
          movementDate: movement.date,
          referenceNumber: `HISTORY-${index + 1}`
        })
      }

      // Get all movements for title
      const titleHistory = await StockMovementService.getMovementHistory(title1.id)
      expect(titleHistory).toHaveLength(3)

      // Get movements by type
      const salesMovements = await StockMovementService.getMovementHistory(
        title1.id,
        undefined,
        'UK_TRADE_SALES'
      )
      expect(salesMovements).toHaveLength(1)
      expect(salesMovements[0].movementType).toBe('UK_TRADE_SALES')

      // Get movements by date range
      const januaryMovements = await StockMovementService.getMovementHistory(
        title1.id,
        undefined,
        undefined,
        new Date('2024-01-10'),
        new Date('2024-01-31')
      )
      expect(januaryMovements).toHaveLength(2) // Sales movements only
    })

    test('should calculate movement statistics', async () => {
      // Create inventory
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 1000,
          reservedStock: 0
        }
      })

      // Create movements with known values
      const movements = [
        {
          movementType: 'PRINT_RECEIVED' as const,
          quantity: 500,
          rrp: 19.99
        },
        {
          movementType: 'UK_TRADE_SALES' as const,
          quantity: -100,
          rrp: 19.99
        },
        {
          movementType: 'ONLINE_SALES' as const,
          quantity: -50,
          rrp: 19.99
        }
      ]

      for (const [index, movement] of movements.entries()) {
        await StockMovementService.processMovement({
          titleId: title1.id,
          warehouseId: warehouse1.id,
          movementType: movement.movementType,
          quantity: movement.quantity,
          movementDate: new Date('2024-01-15'),
          referenceNumber: `STATS-${index + 1}`,
          rrpAtTime: movement.rrp
        })
      }

      const stats = await StockMovementService.getMovementStats(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        warehouse1.id
      )

      expect(stats.totalMovements).toBe(3)
      expect(stats.inboundQuantity).toBe(500)
      expect(stats.outboundQuantity).toBe(150) // 100 + 50
      expect(stats.movementsByType['PRINT_RECEIVED']).toBe(1)
      expect(stats.movementsByType['UK_TRADE_SALES']).toBe(1)
      expect(stats.movementsByType['ONLINE_SALES']).toBe(1)
    })
  })
})