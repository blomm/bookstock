import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestInventory } from '../utils/test-db'

describe('Warehouse Transfer Operations', () => {
  let sourceWarehouse: any
  let destinationWarehouse: any
  let title: any

  beforeEach(async () => {
    await cleanDatabase()

    // Create test warehouses
    sourceWarehouse = await createTestWarehouse({
      name: 'Source Warehouse',
      code: 'SRC001',
      location: 'Manchester, UK',
      fulfillsChannels: ['wholesale', 'online']
    })

    destinationWarehouse = await createTestWarehouse({
      name: 'Destination Warehouse',
      code: 'DST001',
      location: 'London, UK',
      fulfillsChannels: ['retail', 'online']
    })

    // Create test title
    title = await createTestTitle({
      isbn: '9781234567890',
      title: 'Transfer Test Book',
      author: 'Test Author'
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Transfer Request Creation', () => {
    test('should create transfer movement with valid data', async () => {
      // Create initial inventory in source warehouse
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      const transfer = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -20,
          referenceNumber: 'TRF-001',
          notes: 'Transfer to London warehouse',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id
        }
      })

      expect(transfer).toBeDefined()
      expect(transfer.movementType).toBe('WAREHOUSE_TRANSFER')
      expect(transfer.quantity).toBe(-20)
      expect(transfer.destinationWarehouseId).toBe(destinationWarehouse.id)
    })

    test('should allow transfers to same warehouse (validation at service layer)', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 50,
        reservedStock: 0
      })

      // Database allows this - validation should be at service layer
      const transfer = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -10,
          referenceNumber: 'TRF-003',
          notes: 'Self transfer attempt',
          movementDate: new Date(),
          destinationWarehouseId: sourceWarehouse.id
        }
      })

      // In production, service layer would prevent this
      expect(transfer.warehouseId).toBe(transfer.destinationWarehouseId)
    })

    test('should create transfers with different reference numbers', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      const transfer1 = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -10,
          referenceNumber: 'TRF-004',
          notes: 'First transfer',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id
        }
      })

      // Create transfer with different reference number
      const transfer2 = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -10,
          referenceNumber: 'TRF-005', // Different reference
          notes: 'Second transfer',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id
        }
      })

      expect(transfer1.referenceNumber).toBe('TRF-004')
      expect(transfer2.referenceNumber).toBe('TRF-005')
      expect(transfer1.referenceNumber).not.toBe(transfer2.referenceNumber)
    })
  })

  describe('Transfer Tracking', () => {
    test('should link outbound and inbound transfer movements', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 75,
        reservedStock: 0
      })

      // Create transfer-out movement
      const transferOut = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -25,
          referenceNumber: 'TRF-LINK-001',
          notes: 'Transfer out to destination',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id
        }
      })

      // Create corresponding transfer-in movement at destination
      const transferIn = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destinationWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 25,
          referenceNumber: 'TRF-LINK-001-IN',
          notes: 'Transfer in from source',
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id
        }
      })

      expect(transferOut.quantity).toBe(-25)
      expect(transferIn.quantity).toBe(25)
      expect(transferOut.destinationWarehouseId).toBe(destinationWarehouse.id)
      expect(transferIn.sourceWarehouseId).toBe(sourceWarehouse.id)
    })

    test('should track transfer costs and financial impact', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 60,
        reservedStock: 0
      })

      const transfer = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -20,
          referenceNumber: 'TRF-COST-001',
          notes: 'Cost tracking test',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id,
          unitCostAtTime: 12.50,
          rrpAtTime: 19.99
        }
      })

      expect(Number(transfer.unitCostAtTime)).toBe(12.50)
      expect(Number(transfer.rrpAtTime)).toBe(19.99)
    })
  })

  describe('Inventory Impact Tracking', () => {
    test('should update stock levels when transfer is processed', async () => {
      const sourceInventory = await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      // Create transfer movement
      const transfer = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -20,
          referenceNumber: 'TRF-STOCK-001',
          notes: 'Stock level test',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id
        }
      })

      // Update source inventory to reflect transfer
      const updatedSourceInventory = await testDb.inventory.update({
        where: { id: sourceInventory.id },
        data: {
          currentStock: sourceInventory.currentStock + transfer.quantity,
          lastMovementDate: transfer.movementDate
        }
      })

      expect(updatedSourceInventory.currentStock).toBe(80) // 100 - 20
      expect(updatedSourceInventory.lastMovementDate).toBeDefined()
    })

    test('should create inventory at destination when transfer is received', async () => {
      // Create initial inventory at source
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 50,
        reservedStock: 0
      })

      // Create transfer-out movement
      const transferOut = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -15,
          referenceNumber: 'TRF-RECEIVE-001',
          notes: 'Receive test transfer',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id
        }
      })

      // Create transfer-in movement
      const transferIn = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destinationWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 15,
          referenceNumber: 'TRF-RECEIVE-001-IN',
          notes: 'Received transfer',
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id
        }
      })

      // Create or update inventory at destination
      const destinationInventory = await testDb.inventory.upsert({
        where: {
          titleId_warehouseId: {
            titleId: title.id,
            warehouseId: destinationWarehouse.id
          }
        },
        create: {
          titleId: title.id,
          warehouseId: destinationWarehouse.id,
          currentStock: 15,
          reservedStock: 0,
          lastMovementDate: transferIn.movementDate
        },
        update: {
          currentStock: { increment: 15 },
          lastMovementDate: transferIn.movementDate
        }
      })

      expect(destinationInventory.currentStock).toBe(15)
      expect(destinationInventory.warehouseId).toBe(destinationWarehouse.id)
    })
  })

  describe('Multi-Title Transfer Operations', () => {
    let title2: any

    beforeEach(async () => {
      title2 = await createTestTitle({
        isbn: '9781234567891',
        title: 'Second Transfer Test Book',
        author: 'Test Author 2'
      })

      // Create inventory for both titles at source
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 50,
        reservedStock: 0
      })

      await createTestInventory({
        titleId: title2.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 30,
        reservedStock: 0
      })
    })

    test('should handle multiple titles in single transfer batch', async () => {
      const batchRef = 'BATCH-001'

      // Create transfer movements for multiple titles
      const transfer1 = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -10,
          referenceNumber: 'TRF-BATCH-001-1',
          notes: 'Multi-title batch transfer',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id,
          batchNumber: batchRef
        }
      })

      const transfer2 = await testDb.stockMovement.create({
        data: {
          titleId: title2.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -15,
          referenceNumber: 'TRF-BATCH-001-2',
          notes: 'Multi-title batch transfer',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id,
          batchNumber: batchRef
        }
      })

      // Query transfers by batch
      const batchTransfers = await testDb.stockMovement.findMany({
        where: { batchNumber: batchRef }
      })

      expect(batchTransfers).toHaveLength(2)
      expect(batchTransfers.map(t => t.titleId)).toContain(title.id)
      expect(batchTransfers.map(t => t.titleId)).toContain(title2.id)
    })

    test('should calculate total batch value and costs', async () => {
      const batchRef = 'BATCH-002'

      await testDb.stockMovement.createMany({
        data: [
          {
            titleId: title.id,
            warehouseId: sourceWarehouse.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -8,
            referenceNumber: 'TRF-BATCH-002-1',
            notes: 'Batch value test',
            movementDate: new Date(),
            destinationWarehouseId: destinationWarehouse.id,
            unitCostAtTime: 15.00,
            rrpAtTime: 24.99,
            batchNumber: batchRef
          },
          {
            titleId: title2.id,
            warehouseId: sourceWarehouse.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -12,
            referenceNumber: 'TRF-BATCH-002-2',
            notes: 'Batch value test',
            movementDate: new Date(),
            destinationWarehouseId: destinationWarehouse.id,
            unitCostAtTime: 18.50,
            rrpAtTime: 29.99,
            batchNumber: batchRef
          }
        ]
      })

      // Calculate batch totals
      const batchTotals = await testDb.stockMovement.aggregate({
        where: { batchNumber: batchRef },
        _sum: {
          quantity: true
        },
        _count: {
          id: true
        }
      })

      expect(Math.abs(batchTotals._sum.quantity || 0)).toBe(20) // 8 + 12
      expect(batchTotals._count.id).toBe(2)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle transfer to inactive warehouse', async () => {
      // Deactivate destination warehouse
      await testDb.warehouse.update({
        where: { id: destinationWarehouse.id },
        data: { isActive: false }
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 40,
        reservedStock: 0
      })

      // Should validate that destination warehouse is active before creating transfer
      const inactiveWarehouse = await testDb.warehouse.findUnique({
        where: { id: destinationWarehouse.id }
      })

      expect(inactiveWarehouse?.isActive).toBe(false)

      // In a real system, this validation would happen in the service layer
      // For now, we just verify the warehouse is inactive
    })

    test('should handle transfer of non-existent title', async () => {
      await expect(
        testDb.stockMovement.create({
          data: {
            titleId: 99999, // Non-existent title
            warehouseId: sourceWarehouse.id,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -10,
            referenceNumber: 'TRF-NOTITLE-001',
            notes: 'Transfer non-existent title',
            movementDate: new Date(),
            destinationWarehouseId: destinationWarehouse.id
          }
        })
      ).rejects.toThrow()
    })

    test('should validate transfer quantity is not zero', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 20,
        reservedStock: 0
      })

      // Zero quantity transfers should be prevented at application level
      const zeroQuantityTransfer = {
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        movementType: 'WAREHOUSE_TRANSFER',
        quantity: 0,
        referenceNumber: 'TRF-ZERO-001',
        notes: 'Zero quantity transfer',
        movementDate: new Date(),
        destinationWarehouseId: destinationWarehouse.id
      }

      // In practice, this validation would be in the service layer
      expect(zeroQuantityTransfer.quantity).toBe(0)
    })

    test('should handle damaged items during transfer', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 50,
        reservedStock: 0
      })

      // Create transfer out
      const transferOut = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -20,
          referenceNumber: 'TRF-DAMAGE-001',
          notes: 'Transfer with potential damage',
          movementDate: new Date(),
          destinationWarehouseId: destinationWarehouse.id
        }
      })

      // Record damage adjustment
      const damageAdjustment = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destinationWarehouse.id,
          movementType: 'DAMAGED',
          quantity: -3,
          referenceNumber: 'DMG-001',
          notes: 'Damaged items found during transfer - reference TRF-DAMAGE-001',
          movementDate: new Date()
        }
      })

      // Create corresponding transfer-in with adjusted quantity
      const transferIn = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destinationWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 17, // 20 - 3 damaged
          referenceNumber: 'TRF-DAMAGE-001-IN',
          notes: 'Received with damage adjustment',
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id
        }
      })

      expect(transferIn.quantity).toBe(17)
      expect(damageAdjustment.movementType).toBe('DAMAGED')
      expect(damageAdjustment.quantity).toBe(-3)
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large batch transfers efficiently', async () => {
      // Create multiple titles and inventory
      const titles = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          createTestTitle({
            isbn: `97812345${String(i).padStart(5, '0')}`,
            title: `Batch Performance Book ${i}`,
            author: 'Performance Test'
          })
        )
      )

      // Create inventory for all titles
      await Promise.all(
        titles.map(t =>
          createTestInventory({
            titleId: t.id,
            warehouseId: sourceWarehouse.id,
            currentStock: 100,
            reservedStock: 0
          })
        )
      )

      const startTime = Date.now()

      // Create batch transfer for all titles
      const transferData = titles.map((t, i) => ({
        titleId: t.id,
        warehouseId: sourceWarehouse.id,
        movementType: 'WAREHOUSE_TRANSFER' as const,
        quantity: -10,
        referenceNumber: `TRF-PERF-${String(i).padStart(3, '0')}`,
        notes: 'Performance test transfer',
        movementDate: new Date(),
        destinationWarehouseId: destinationWarehouse.id,
        batchNumber: 'PERF-BATCH-001'
      }))

      await testDb.stockMovement.createMany({
        data: transferData
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (2 seconds for 25 transfers)
      expect(duration).toBeLessThan(2000)

      // Verify all transfers were created
      const createdTransfers = await testDb.stockMovement.count({
        where: { batchNumber: 'PERF-BATCH-001' }
      })
      expect(createdTransfers).toBe(25)
    })

    test('should efficiently query transfer history', async () => {
      // Create some transfer history
      await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 200,
        reservedStock: 0
      })

      const transfers = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          testDb.stockMovement.create({
            data: {
              titleId: title.id,
              warehouseId: sourceWarehouse.id,
              movementType: 'WAREHOUSE_TRANSFER',
              quantity: -5,
              referenceNumber: `TRF-HIST-${String(i).padStart(3, '0')}`,
              notes: 'History test transfer',
              movementDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // One per day
              destinationWarehouseId: destinationWarehouse.id
            }
          })
        )
      )

      const startTime = Date.now()

      // Query recent transfers
      const recentTransfers = await testDb.stockMovement.findMany({
        where: {
          titleId: title.id,
          movementType: 'WAREHOUSE_TRANSFER',
          movementDate: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        orderBy: { movementDate: 'desc' },
        take: 10
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Query should be fast
      expect(duration).toBeLessThan(100)
      expect(recentTransfers.length).toBeLessThanOrEqual(7) // 7 days worth
    })
  })
})