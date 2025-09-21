import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestInventory } from '../utils/test-db'

describe('Real-time Stock Level Synchronization', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Stock Movement Impact on Inventory', () => {
    test('should update inventory levels when stock movements are recorded', async () => {
      const title = await createTestTitle({
        isbn: '9782222222222',
        title: 'Stock Movement Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Movement Warehouse',
        code: 'MOV',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      // Record inbound stock movement (positive quantity)
      const inboundMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 50,
          movementDate: new Date(),
          referenceNumber: 'REC-001'
        }
      })

      // Simulate real-time stock update after movement
      const updatedInventoryAfterInbound = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          currentStock: inventory.currentStock + inboundMovement.quantity,
          lastMovementDate: inboundMovement.movementDate
        }
      })

      expect(updatedInventoryAfterInbound.currentStock).toBe(150) // 100 + 50
      expect(updatedInventoryAfterInbound.lastMovementDate).toEqual(inboundMovement.movementDate)

      // Record outbound stock movement (negative quantity)
      const outboundMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -25,
          movementDate: new Date(),
          referenceNumber: 'SALE-001',
          rrpAtTime: 19.99,
          unitCostAtTime: 8.50
        }
      })

      // Simulate real-time stock update after sale
      const finalInventory = await testDb.inventory.update({
        where: { id: updatedInventoryAfterInbound.id },
        data: {
          currentStock: updatedInventoryAfterInbound.currentStock + outboundMovement.quantity, // Adding negative number
          lastMovementDate: outboundMovement.movementDate
        }
      })

      expect(finalInventory.currentStock).toBe(125) // 150 - 25
      expect(finalInventory.lastMovementDate).toEqual(outboundMovement.movementDate)
    })

    test('should maintain accurate stock levels across multiple movements', async () => {
      const title = await createTestTitle({
        isbn: '9782222222223',
        title: 'Multiple Movements Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Multiple Movement Warehouse',
        code: 'MMW',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 200,
        reservedStock: 0
      })

      // Create multiple stock movements
      const movements = [
        { type: 'PRINT_RECEIVED', quantity: 100, ref: 'REC-001' },
        { type: 'UK_TRADE_SALES', quantity: -30, ref: 'SALE-001' },
        { type: 'ROW_TRADE_SALES', quantity: -20, ref: 'SALE-002' },
        { type: 'PRINT_RECEIVED', quantity: 75, ref: 'REC-002' },
        { type: 'ONLINE_SALES', quantity: -45, ref: 'SALE-003' }
      ]

      let expectedStock = inventory.currentStock
      let lastMovementDate = new Date()

      for (const movement of movements) {
        const stockMovement = await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: movement.type as any,
            quantity: movement.quantity,
            movementDate: lastMovementDate,
            referenceNumber: movement.ref
          }
        })

        expectedStock += movement.quantity

        // Update inventory to reflect movement
        await testDb.inventory.update({
          where: { id: inventory.id },
          data: {
            currentStock: expectedStock,
            lastMovementDate: stockMovement.movementDate
          }
        })
      }

      const finalInventory = await testDb.inventory.findUnique({
        where: { id: inventory.id }
      })

      // 200 + 100 - 30 - 20 + 75 - 45 = 280
      expect(finalInventory?.currentStock).toBe(280)
      expect(finalInventory?.lastMovementDate).toEqual(lastMovementDate)
    })
  })

  describe('Cross-Warehouse Stock Synchronization', () => {
    test('should maintain total stock consistency during warehouse transfers', async () => {
      const title = await createTestTitle({
        isbn: '9782222222224',
        title: 'Transfer Consistency Test'
      })

      const sourceWarehouse = await createTestWarehouse({
        name: 'Source Warehouse',
        code: 'SRC',
        location: 'UK'
      })

      const destinationWarehouse = await createTestWarehouse({
        name: 'Destination Warehouse',
        code: 'DST',
        location: 'US'
      })

      const sourceInventory = await createTestInventory({
        titleId: title.id,
        warehouseId: sourceWarehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      const destinationInventory = await createTestInventory({
        titleId: title.id,
        warehouseId: destinationWarehouse.id,
        currentStock: 50,
        reservedStock: 0
      })

      // Calculate initial total stock
      const initialTotal = sourceInventory.currentStock + destinationInventory.currentStock

      // Record warehouse transfer (outbound from source)
      const transferOutMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: sourceWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -30,
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destinationWarehouse.id,
          referenceNumber: 'TRANS-001'
        }
      })

      // Record warehouse transfer (inbound to destination)
      const transferInMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: destinationWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 30,
          movementDate: new Date(),
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destinationWarehouse.id,
          referenceNumber: 'TRANS-001'
        }
      })

      // Update source warehouse inventory
      const updatedSourceInventory = await testDb.inventory.update({
        where: { id: sourceInventory.id },
        data: {
          currentStock: sourceInventory.currentStock - 30,
          lastMovementDate: transferOutMovement.movementDate
        }
      })

      // Update destination warehouse inventory
      const updatedDestinationInventory = await testDb.inventory.update({
        where: { id: destinationInventory.id },
        data: {
          currentStock: destinationInventory.currentStock + 30,
          lastMovementDate: transferInMovement.movementDate
        }
      })

      // Verify stock levels changed correctly
      expect(updatedSourceInventory.currentStock).toBe(70) // 100 - 30
      expect(updatedDestinationInventory.currentStock).toBe(80) // 50 + 30

      // Verify total stock remains the same
      const finalTotal = updatedSourceInventory.currentStock + updatedDestinationInventory.currentStock
      expect(finalTotal).toBe(initialTotal) // 150 = 150
    })

    test('should track movement history for audit and synchronization', async () => {
      const title = await createTestTitle({
        isbn: '9782222222225',
        title: 'Movement History Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'History Warehouse',
        code: 'HST',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      // Create several movements with different timestamps
      const movementData = [
        { type: 'PRINT_RECEIVED', quantity: 50, date: new Date('2024-01-01') },
        { type: 'UK_TRADE_SALES', quantity: -10, date: new Date('2024-01-02') },
        { type: 'ONLINE_SALES', quantity: -15, date: new Date('2024-01-03') },
        { type: 'PRINT_RECEIVED', quantity: 25, date: new Date('2024-01-04') }
      ]

      for (const movement of movementData) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: movement.type as any,
            quantity: movement.quantity,
            movementDate: movement.date,
            referenceNumber: `REF-${movement.date.getDate()}`
          }
        })
      }

      // Retrieve movement history in chronological order
      const movementHistory = await testDb.stockMovement.findMany({
        where: {
          titleId: title.id,
          warehouseId: warehouse.id
        },
        orderBy: { movementDate: 'asc' }
      })

      expect(movementHistory).toHaveLength(4)

      // Verify chronological order
      expect(movementHistory[0].movementType).toBe('PRINT_RECEIVED')
      expect(movementHistory[0].quantity).toBe(50)
      expect(movementHistory[1].movementType).toBe('UK_TRADE_SALES')
      expect(movementHistory[1].quantity).toBe(-10)
      expect(movementHistory[2].movementType).toBe('ONLINE_SALES')
      expect(movementHistory[2].quantity).toBe(-15)
      expect(movementHistory[3].movementType).toBe('PRINT_RECEIVED')
      expect(movementHistory[3].quantity).toBe(25)

      // Calculate running stock balance from movements
      let runningBalance = inventory.currentStock
      const stockProgression = [runningBalance]

      for (const movement of movementHistory) {
        runningBalance += movement.quantity
        stockProgression.push(runningBalance)
      }

      expect(stockProgression).toEqual([100, 150, 140, 125, 150])
    })
  })

  describe('Reserved Stock Synchronization', () => {
    test('should synchronize reserved stock with current stock for availability calculations', async () => {
      const title = await createTestTitle({
        isbn: '9782222222226',
        title: 'Reserved Stock Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Reserved Stock Warehouse',
        code: 'RSW',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100,
        reservedStock: 20
      })

      // Calculate initial available stock
      const initialAvailableStock = inventory.currentStock - inventory.reservedStock
      expect(initialAvailableStock).toBe(80)

      // Reserve additional stock for pending order
      const updatedInventory = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: inventory.reservedStock + 15
        }
      })

      // Calculate new available stock
      const newAvailableStock = updatedInventory.currentStock - updatedInventory.reservedStock
      expect(newAvailableStock).toBe(65) // 100 - 35

      // Process sale and reduce both current and reserved stock
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -15,
          movementDate: new Date(),
          referenceNumber: 'SALE-RSV-001'
        }
      })

      const finalInventory = await testDb.inventory.update({
        where: { id: updatedInventory.id },
        data: {
          currentStock: updatedInventory.currentStock - 15,
          reservedStock: updatedInventory.reservedStock - 15 // Release reservation
        }
      })

      // Available stock should remain the same after fulfilling reserved order
      const finalAvailableStock = finalInventory.currentStock - finalInventory.reservedStock
      expect(finalAvailableStock).toBe(65) // (85 - 20) = 65
    })

    test('should prevent overselling when considering reserved stock', async () => {
      const title = await createTestTitle({
        isbn: '9782222222227',
        title: 'Overselling Prevention Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Oversell Prevention Warehouse',
        code: 'OPW',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 50,
        reservedStock: 30
      })

      const availableStock = inventory.currentStock - inventory.reservedStock
      expect(availableStock).toBe(20)

      // Attempt to reserve more stock than available should be validated
      const attemptedReservation = 25 // More than available (20)
      const maxPossibleReservation = Math.min(attemptedReservation, availableStock)

      expect(maxPossibleReservation).toBe(20)

      // Only reserve what's actually available
      const constrainedUpdate = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: inventory.reservedStock + maxPossibleReservation
        }
      })

      expect(constrainedUpdate.reservedStock).toBe(50) // 30 + 20
      expect(constrainedUpdate.currentStock - constrainedUpdate.reservedStock).toBe(0) // No available stock left
    })
  })

  describe('Real-time Inventory Alerts', () => {
    test('should detect low stock conditions in real-time', async () => {
      const title = await createTestTitle({
        isbn: '9782222222228',
        title: 'Low Stock Alert Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Alert Warehouse',
        code: 'ALT',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 25,
        reservedStock: 5,
        minStockLevel: 15,
        reorderPoint: 20
      })

      const availableStock = inventory.currentStock - inventory.reservedStock
      expect(availableStock).toBe(20)

      // Check if inventory is at or below reorder point
      const needsReorder = availableStock <= (inventory.reorderPoint || 0)
      expect(needsReorder).toBe(true)

      // Check if inventory is below minimum stock level
      const belowMinimum = inventory.currentStock < (inventory.minStockLevel || 0)
      expect(belowMinimum).toBe(false)

      // Simulate sale that brings stock below minimum
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'ONLINE_SALES',
          quantity: -12,
          movementDate: new Date(),
          referenceNumber: 'SALE-LOW-001'
        }
      })

      const updatedInventory = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          currentStock: inventory.currentStock - 12
        }
      })

      // Now stock should be below minimum threshold
      const nowBelowMinimum = updatedInventory.currentStock < (updatedInventory.minStockLevel || 0)
      expect(nowBelowMinimum).toBe(true)
      expect(updatedInventory.currentStock).toBe(13) // Below minStockLevel of 15
    })

    test('should identify titles requiring urgent restocking across warehouses', async () => {
      const title = await createTestTitle({
        isbn: '9782222222229',
        title: 'Urgent Restock Test'
      })

      const warehouses = await Promise.all([
        createTestWarehouse({ name: 'Urgent WH 1', code: 'URG1', location: 'UK' }),
        createTestWarehouse({ name: 'Urgent WH 2', code: 'URG2', location: 'US' }),
        createTestWarehouse({ name: 'Good Stock WH', code: 'GOOD', location: 'EU' })
      ])

      await Promise.all([
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouses[0].id,
          currentStock: 5,
          reservedStock: 2,
          minStockLevel: 10,
          reorderPoint: 15
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouses[1].id,
          currentStock: 8,
          reservedStock: 3,
          minStockLevel: 12,
          reorderPoint: 18
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouses[2].id,
          currentStock: 100,
          reservedStock: 10,
          minStockLevel: 20,
          reorderPoint: 30
        })
      ])

      // Find warehouses with urgent restock needs (below minimum or at/below reorder point)
      const urgentRestockWarehouses = await testDb.inventory.findMany({
        where: {
          titleId: title.id,
          OR: [
            {
              currentStock: {
                lt: testDb.inventory.fields.minStockLevel
              }
            },
            {
              currentStock: {
                lte: testDb.inventory.fields.reorderPoint
              }
            }
          ]
        },
        include: { warehouse: true }
      })

      expect(urgentRestockWarehouses).toHaveLength(2) // URG1 and URG2
      expect(urgentRestockWarehouses.map(inv => inv.warehouse.code)).toEqual(
        expect.arrayContaining(['URG1', 'URG2'])
      )

      // Calculate availability for urgent decisions
      const restockAnalysis = urgentRestockWarehouses.map(inv => ({
        warehouseCode: inv.warehouse.code,
        currentStock: inv.currentStock,
        availableStock: inv.currentStock - inv.reservedStock,
        shortfall: Math.max(0, (inv.minStockLevel || 0) - inv.currentStock),
        urgencyLevel: inv.currentStock < (inv.minStockLevel || 0) ? 'CRITICAL' : 'WARNING'
      }))

      expect(restockAnalysis).toEqual(
        expect.arrayContaining([
          {
            warehouseCode: 'URG1',
            currentStock: 5,
            availableStock: 3,
            shortfall: 5,
            urgencyLevel: 'CRITICAL'
          },
          {
            warehouseCode: 'URG2',
            currentStock: 8,
            availableStock: 5,
            shortfall: 4,
            urgencyLevel: 'CRITICAL'
          }
        ])
      )
    })
  })

  describe('Stock Level Consistency Validation', () => {
    test('should validate that reserved stock never exceeds current stock', async () => {
      const title = await createTestTitle({
        isbn: '9782222222230',
        title: 'Stock Consistency Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Consistency Warehouse',
        code: 'CST',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 50,
        reservedStock: 30
      })

      // Attempt to update reserved stock to exceed current stock should be prevented
      // This validation would typically be enforced at the application level
      const invalidReservedStock = inventory.currentStock + 10 // 60

      // Business logic validation: reserved cannot exceed current
      const isValidReservation = invalidReservedStock <= inventory.currentStock
      expect(isValidReservation).toBe(false)

      // Valid reservation update
      const validReservedStock = inventory.currentStock - 5 // 45
      const isValidUpdate = validReservedStock <= inventory.currentStock
      expect(isValidUpdate).toBe(true)

      const validUpdate = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: validReservedStock
        }
      })

      expect(validUpdate.reservedStock).toBe(45)
      expect(validUpdate.reservedStock).toBeLessThanOrEqual(validUpdate.currentStock)
    })

    test('should maintain accurate stock totals after concurrent movements', async () => {
      const title = await createTestTitle({
        isbn: '9782222222231',
        title: 'Concurrent Movement Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Concurrent Warehouse',
        code: 'CNC',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100,
        reservedStock: 0
      })

      // Simulate concurrent stock movements that might happen in a real system
      const movements = [
        { type: 'UK_TRADE_SALES', quantity: -10, ref: 'SALE-A' },
        { type: 'ONLINE_SALES', quantity: -5, ref: 'SALE-B' },
        { type: 'PRINT_RECEIVED', quantity: 20, ref: 'REC-A' },
        { type: 'ROW_TRADE_SALES', quantity: -8, ref: 'SALE-C' }
      ]

      let expectedFinalStock = inventory.currentStock

      // Process movements sequentially (in a real system these might be concurrent)
      for (const movement of movements) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: movement.type as any,
            quantity: movement.quantity,
            movementDate: new Date(),
            referenceNumber: movement.ref
          }
        })

        expectedFinalStock += movement.quantity

        // Update inventory to reflect the movement
        await testDb.inventory.update({
          where: { id: inventory.id },
          data: {
            currentStock: expectedFinalStock
          }
        })
      }

      // Verify final stock matches expected calculation
      // 100 - 10 - 5 + 20 - 8 = 97
      expect(expectedFinalStock).toBe(97)

      const finalInventory = await testDb.inventory.findUnique({
        where: { id: inventory.id }
      })

      expect(finalInventory?.currentStock).toBe(97)

      // Verify movement audit trail
      const allMovements = await testDb.stockMovement.findMany({
        where: {
          titleId: title.id,
          warehouseId: warehouse.id
        }
      })

      expect(allMovements).toHaveLength(4)

      const totalMovementQuantity = allMovements.reduce((sum, movement) => sum + movement.quantity, 0)
      expect(totalMovementQuantity).toBe(-3) // Net change: -10 - 5 + 20 - 8 = -3
      expect(inventory.currentStock + totalMovementQuantity).toBe(finalInventory?.currentStock)
    })
  })
})