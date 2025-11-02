/**
 * E2E Test: Inventory Edge Cases (Task 5.5)
 * Tests edge cases: zero quantity movements, concurrent updates,
 * negative stock prevention, transfer to same warehouse
 */

import { describe, test, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { inventoryService } from '@/services/inventoryService'
import { stockMovementService } from '@/services/stockMovementService'
import { MovementType } from '@prisma/client'

describe.sequential('E2E: Inventory Edge Cases', () => {
  let testWarehouse: any
  let testTitle: any

  beforeAll(async () => {
    await cleanDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()

    testWarehouse = await testDb.warehouse.create({
      data: {
        name: 'Test Warehouse',
        code: 'TEST',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
      },
    })

    testTitle = await testDb.title.create({
      data: {
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'John Doe',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 8.00,
      },
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('zero quantity movement should fail validation', async () => {
    // Step 1: Attempt to record movement with zero quantity
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 0,
        createdBy: 'test-user',
      })
    ).rejects.toThrow()

    // Step 2: Verify no movement was recorded
    const movements = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 10,
    })
    expect(movements.data).toHaveLength(0)
  })

  test('negative quantity for inbound movement should fail', async () => {
    // Step 1: Attempt to record negative PRINT_RECEIVED
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.PRINT_RECEIVED,
        quantity: -50,
        createdBy: 'test-user',
      })
    ).rejects.toThrow()

    // Step 2: Attempt to record negative REPRINT
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.REPRINT,
        quantity: -20,
        createdBy: 'test-user',
      })
    ).rejects.toThrow()
  })

  test('negative stock prevention: cannot sell more than available', async () => {
    // Step 1: Add 50 units to inventory
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 50,
      createdBy: 'test-user',
    })

    // Step 2: Attempt to sell 100 units (more than available)
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.ONLINE_SALES,
        quantity: 100,
        createdBy: 'test-user',
      })
    ).rejects.toThrow(/insufficient stock|negative/)

    // Step 3: Verify stock remains at 50
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(50)
  })

  test('negative stock prevention: damage beyond available stock', async () => {
    // Step 1: Add minimal stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 10,
      createdBy: 'test-user',
    })

    // Step 2: Attempt to damage more than available
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.DAMAGED,
        quantity: 20,
        createdBy: 'test-user',
      })
    ).rejects.toThrow()

    // Step 3: Verify stock unchanged
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(10)
  })

  test('transfer to same warehouse should fail', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Attempt transfer to same warehouse
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        movementType: MovementType.WAREHOUSE_TRANSFER,
        quantity: 30,
        sourceWarehouseId: testWarehouse.id,
        destinationWarehouseId: testWarehouse.id,
        createdBy: 'test-user',
      })
    ).rejects.toThrow(/same warehouse/)

    // Step 3: Verify stock unchanged
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(100)
  })

  test('transfer without source warehouse should fail', async () => {
    // Step 1: Attempt transfer without sourceWarehouseId
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        movementType: MovementType.WAREHOUSE_TRANSFER,
        quantity: 30,
        destinationWarehouseId: testWarehouse.id,
        createdBy: 'test-user',
      } as any)
    ).rejects.toThrow()
  })

  test('transfer without destination warehouse should fail', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Attempt transfer without destinationWarehouseId
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        movementType: MovementType.WAREHOUSE_TRANSFER,
        quantity: 30,
        sourceWarehouseId: testWarehouse.id,
        createdBy: 'test-user',
      } as any)
    ).rejects.toThrow()
  })

  test('concurrent stock updates maintain data integrity', async () => {
    // Step 1: Add initial stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Simulate concurrent sales
    const concurrentSales = [
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.ONLINE_SALES,
        quantity: 10,
        createdBy: 'user-1',
      }),
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.UK_TRADE_SALES,
        quantity: 15,
        createdBy: 'user-2',
      }),
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.DIRECT_SALES,
        quantity: 20,
        createdBy: 'user-3',
      }),
    ]

    // Step 3: Wait for all to complete
    await Promise.all(concurrentSales)

    // Step 4: Verify final stock is correct (100 - 10 - 15 - 20 = 55)
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(55)

    // Step 5: Verify all movements were recorded
    const movements = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      page: 1,
      limit: 100,
    })
    expect(movements.data).toHaveLength(4) // 1 PRINT_RECEIVED + 3 sales
  })

  test('stock adjustment with exact negative to reach zero', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 50,
      createdBy: 'test-user',
    })

    // Step 2: Adjust with exactly -50 to reach zero
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.STOCK_ADJUSTMENT,
      quantity: -50,
      notes: 'Removing all stock',
      createdBy: 'test-user',
    })

    // Step 3: Verify stock is exactly zero
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(0)
  })

  test('stock adjustment attempting to go negative should fail', async () => {
    // Step 1: Add minimal stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 20,
      createdBy: 'test-user',
    })

    // Step 2: Attempt adjustment beyond available stock
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.STOCK_ADJUSTMENT,
        quantity: -30,
        notes: 'Attempting to remove more than available',
        createdBy: 'test-user',
      })
    ).rejects.toThrow()

    // Step 3: Verify stock unchanged
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(20)
  })

  test('movement without required createdBy should fail', async () => {
    // Step 1: Attempt to create movement without createdBy
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 100,
      } as any)
    ).rejects.toThrow()
  })

  test('movement for non-existent title should fail', async () => {
    // Step 1: Attempt movement for non-existent title
    await expect(
      stockMovementService.recordMovement({
        titleId: 99999,
        warehouseId: testWarehouse.id,
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 100,
        createdBy: 'test-user',
      })
    ).rejects.toThrow()
  })

  test('movement for non-existent warehouse should fail', async () => {
    // Step 1: Attempt movement for non-existent warehouse
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: 99999,
        movementType: MovementType.PRINT_RECEIVED,
        quantity: 100,
        createdBy: 'test-user',
      })
    ).rejects.toThrow()
  })

  test('very large quantity movements', async () => {
    // Step 1: Record very large print quantity
    const largeMovement = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 1000000,
      createdBy: 'test-user',
    })

    expect(largeMovement.quantity).toBe(1000000)

    // Step 2: Verify inventory reflects large quantity
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(1000000)

    // Step 3: Record large sale
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 500000,
      createdBy: 'test-user',
    })

    // Step 4: Verify calculation correct
    const updatedInventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(updatedInventory[0].currentStock).toBe(500000)
  })

  test('stock adjustment with notes less than minimum length should fail', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Attempt stock adjustment with insufficient notes
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: MovementType.STOCK_ADJUSTMENT,
        quantity: 10,
        notes: 'Short',
        createdBy: 'test-user',
      })
    ).rejects.toThrow()
  })

  test('free copies reducing stock to zero', async () => {
    // Step 1: Add exact amount
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 25,
      createdBy: 'test-user',
    })

    // Step 2: Give all away as free copies
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.FREE_COPIES,
      quantity: 25,
      notes: 'All copies sent as review copies',
      createdBy: 'test-user',
    })

    // Step 3: Verify stock is zero
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(0)
  })

  test('pulping entire remaining stock', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 1000,
      createdBy: 'test-user',
    })

    // Step 2: Sell some
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 750,
      createdBy: 'test-user',
    })

    // Step 3: Pulp remaining
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PULPED,
      quantity: 250,
      notes: 'End of life for this edition',
      createdBy: 'test-user',
    })

    // Step 4: Verify stock is zero
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(0)
  })

  test('reserved stock tracking with multiple reservations', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Create inventory record with reserved stock
    await testDb.inventory.update({
      where: {
        titleId_warehouseId: {
          titleId: testTitle.id,
          warehouseId: testWarehouse.id,
        },
      },
      data: {
        reservedStock: 30,
      },
    })

    // Step 3: Verify available stock calculation
    const inventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(inventory[0].currentStock).toBe(100)
    expect(inventory[0].reservedStock).toBe(30)
    expect(inventory[0].availableStock).toBe(70) // 100 - 30
  })

  test('movement history with very long notes', async () => {
    // Step 1: Create movement with long notes
    const longNotes = 'A'.repeat(1000) // 1000 character note

    const movement = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      notes: longNotes,
      createdBy: 'test-user',
    })

    expect(movement.notes).toBe(longNotes)

    // Step 2: Verify notes are preserved in history
    const history = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 10,
    })

    expect(history.data[0].notes).toBe(longNotes)
  })

  test('transfer with reserved stock should still work if enough unreserved stock', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Reserve some stock
    await testDb.inventory.update({
      where: {
        titleId_warehouseId: {
          titleId: testTitle.id,
          warehouseId: testWarehouse.id,
        },
      },
      data: {
        reservedStock: 20,
      },
    })

    // Step 3: Create second warehouse
    const warehouse2 = await testDb.warehouse.create({
      data: {
        name: 'Warehouse 2',
        code: 'WH2',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
      },
    })

    // Step 4: Transfer within available stock limit (70 available, try to transfer 50)
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 50,
      sourceWarehouseId: testWarehouse.id,
      destinationWarehouseId: warehouse2.id,
      createdBy: 'test-user',
    })

    // Step 5: Verify transfer succeeded
    const sourceInventory = await inventoryService.getInventoryByWarehouse(testWarehouse.id)
    expect(sourceInventory[0].currentStock).toBe(50)

    const destInventory = await inventoryService.getInventoryByWarehouse(warehouse2.id)
    expect(destInventory[0].currentStock).toBe(50)
  })
})
