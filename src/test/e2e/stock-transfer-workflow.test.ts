/**
 * E2E Test: Stock Transfer Workflow (Task 5.3)
 * Tests stock transfers between warehouses: initiate transfer,
 * verify source decrease, verify destination increase
 */

import { describe, test, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { inventoryService } from '@/services/inventoryService'
import { stockMovementService } from '@/services/stockMovementService'
import { MovementType } from '@prisma/client'

describe.sequential('E2E: Stock Transfer Workflow', () => {
  let sourceWarehouse: any
  let destinationWarehouse: any
  let testTitle: any

  beforeAll(async () => {
    await cleanDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()

    // Create source warehouse
    sourceWarehouse = await testDb.warehouse.create({
      data: {
        name: 'London Warehouse',
        code: 'LON',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
        addressLine1: '123 London St',
        city: 'London',
        country: 'GB',
      },
    })

    // Create destination warehouse
    destinationWarehouse = await testDb.warehouse.create({
      data: {
        name: 'Manchester Warehouse',
        code: 'MAN',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
        addressLine1: '456 Manchester Rd',
        city: 'Manchester',
        country: 'GB',
      },
    })

    // Create test title
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

  test('complete transfer workflow: initiate, verify source decrease, verify destination increase', async () => {
    // Step 1: Add initial stock to source warehouse
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Verify source warehouse has stock
    const sourceBeforeTransfer = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    expect(sourceBeforeTransfer).toHaveLength(1)
    expect(sourceBeforeTransfer[0].currentStock).toBe(100)

    // Step 3: Verify destination warehouse has no stock
    const destBeforeTransfer = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destBeforeTransfer).toHaveLength(0)

    // Step 4: User initiates transfer of 30 units from source to destination
    const transferMovement = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 30,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      referenceNumber: 'TRF-001',
      notes: 'Rebalancing stock between warehouses',
      createdBy: 'test-user',
    })

    // Step 5: Verify transfer movement was recorded correctly
    expect(transferMovement).toBeDefined()
    expect(transferMovement.movementType).toBe(MovementType.WAREHOUSE_TRANSFER)
    expect(transferMovement.quantity).toBe(30)
    expect(transferMovement.sourceWarehouseId).toBe(sourceWarehouse.id)
    expect(transferMovement.destinationWarehouseId).toBe(destinationWarehouse.id)

    // Step 6: Verify source warehouse stock decreased
    const sourceAfterTransfer = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    expect(sourceAfterTransfer[0].currentStock).toBe(70) // 100 - 30

    // Step 7: Verify destination warehouse stock increased
    const destAfterTransfer = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destAfterTransfer).toHaveLength(1)
    expect(destAfterTransfer[0].currentStock).toBe(30)

    // Step 8: Verify total stock across warehouses remains unchanged
    const titleInventory = await inventoryService.getInventoryByTitle(testTitle.id)
    const totalStock = titleInventory.reduce((sum, inv) => sum + inv.currentStock, 0)
    expect(totalStock).toBe(100) // 70 + 30
  })

  test('multiple transfers between warehouses', async () => {
    // Step 1: Set up initial stock in source warehouse
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 200,
      createdBy: 'test-user',
    })

    // Step 2: First transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 50,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      createdBy: 'test-user',
    })

    // Verify after first transfer
    let sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    let destStock = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(150)
    expect(destStock[0].currentStock).toBe(50)

    // Step 3: Second transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 30,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      createdBy: 'test-user',
    })

    // Verify after second transfer
    sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    destStock = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(120) // 150 - 30
    expect(destStock[0].currentStock).toBe(80) // 50 + 30

    // Step 4: Transfer in reverse direction
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 20,
      sourceWarehouseId: destinationWarehouse.id,
      destinationWarehouseId: sourceWarehouse.id,
      createdBy: 'test-user',
    })

    // Verify after reverse transfer
    sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    destStock = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(140) // 120 + 20
    expect(destStock[0].currentStock).toBe(60) // 80 - 20
  })

  test('transfer with insufficient stock should fail', async () => {
    // Step 1: Add minimal stock to source
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 10,
      createdBy: 'test-user',
    })

    // Step 2: Attempt to transfer more than available
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        movementType: MovementType.WAREHOUSE_TRANSFER,
        quantity: 50,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: destinationWarehouse.id,
        createdBy: 'test-user',
      })
    ).rejects.toThrow()

    // Step 3: Verify stock unchanged in both warehouses
    const sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(10)

    const destStock = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destStock).toHaveLength(0)
  })

  test('transfer movement appears in history for both warehouses', async () => {
    // Step 1: Set up stock and perform transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 40,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      referenceNumber: 'TRF-XYZ',
      createdBy: 'test-user',
    })

    // Step 2: Check movement history
    const allMovements = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 10,
    })

    // Should have 2 movements: PRINT_RECEIVED and WAREHOUSE_TRANSFER
    expect(allMovements.data).toHaveLength(2)

    const transferMovement = allMovements.data.find(
      m => m.movementType === MovementType.WAREHOUSE_TRANSFER
    )
    expect(transferMovement).toBeDefined()
    expect(transferMovement?.quantity).toBe(40)
    expect(transferMovement?.sourceWarehouseId).toBe(sourceWarehouse.id)
    expect(transferMovement?.destinationWarehouseId).toBe(destinationWarehouse.id)
    expect(transferMovement?.referenceNumber).toBe('TRF-XYZ')
  })

  test('three-way warehouse transfers', async () => {
    // Step 1: Create third warehouse
    const thirdWarehouse = await testDb.warehouse.create({
      data: {
        name: 'Birmingham Warehouse',
        code: 'BIR',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
        city: 'Birmingham',
        country: 'GB',
      },
    })

    // Step 2: Add stock to source
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 300,
      createdBy: 'test-user',
    })

    // Step 3: Transfer from source to destination
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 100,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      createdBy: 'test-user',
    })

    // Step 4: Transfer from source to third warehouse
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 80,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: thirdWarehouse.id,
      createdBy: 'test-user',
    })

    // Step 5: Transfer from destination to third warehouse
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 30,
      sourceWarehouseId: destinationWarehouse.id,
      destinationWarehouseId: thirdWarehouse.id,
      createdBy: 'test-user',
    })

    // Step 6: Verify final distribution
    const sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(120) // 300 - 100 - 80

    const destStock = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destStock[0].currentStock).toBe(70) // 100 - 30

    const thirdStock = await inventoryService.getInventoryByWarehouse(thirdWarehouse.id)
    expect(thirdStock[0].currentStock).toBe(110) // 80 + 30

    // Step 7: Verify total remains 300
    const titleInventory = await inventoryService.getInventoryByTitle(testTitle.id)
    const totalStock = titleInventory.reduce((sum, inv) => sum + inv.currentStock, 0)
    expect(totalStock).toBe(300)
  })

  test('transfer with sales happening during transfer period', async () => {
    // Step 1: Initial stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Sale from source before transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      createdBy: 'test-user',
    })

    // Step 3: Transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 40,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      createdBy: 'test-user',
    })

    // Step 4: Sale from destination after transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: destinationWarehouse.id,
      movementType: MovementType.UK_TRADE_SALES,
      quantity: 5,
      createdBy: 'test-user',
    })

    // Step 5: Verify final stock
    const sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(50) // 100 - 10 - 40

    const destStock = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destStock[0].currentStock).toBe(35) // 40 - 5

    // Step 6: Verify total accounting
    const titleInventory = await inventoryService.getInventoryByTitle(testTitle.id)
    const totalStock = titleInventory.reduce((sum, inv) => sum + inv.currentStock, 0)
    expect(totalStock).toBe(85) // 100 - 10 - 5 (sales) = 85
  })

  test('transfer to same warehouse should fail', async () => {
    // Step 1: Add stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Attempt to transfer to same warehouse
    await expect(
      stockMovementService.recordMovement({
        titleId: testTitle.id,
        movementType: MovementType.WAREHOUSE_TRANSFER,
        quantity: 30,
        sourceWarehouseId: sourceWarehouse.id,
        destinationWarehouseId: sourceWarehouse.id,
        createdBy: 'test-user',
      })
    ).rejects.toThrow(/same warehouse/)

    // Step 3: Verify stock unchanged
    const sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(100)
  })

  test('transfer creates inventory record if destination has no prior stock', async () => {
    // Step 1: Add stock to source only
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Verify destination has no inventory record
    const destBefore = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destBefore).toHaveLength(0)

    // Step 3: Perform transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 50,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      createdBy: 'test-user',
    })

    // Step 4: Verify destination now has inventory record
    const destAfter = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destAfter).toHaveLength(1)
    expect(destAfter[0].currentStock).toBe(50)
    expect(destAfter[0].title.id).toBe(testTitle.id)
  })

  test('large transfer quantity', async () => {
    // Step 1: Add large quantity to source
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: sourceWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 10000,
      createdBy: 'test-user',
    })

    // Step 2: Transfer large quantity
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 7500,
      sourceWarehouseId: sourceWarehouse.id,
      destinationWarehouseId: destinationWarehouse.id,
      referenceNumber: 'BULK-TRF-001',
      createdBy: 'test-user',
    })

    // Step 3: Verify stock levels
    const sourceStock = await inventoryService.getInventoryByWarehouse(sourceWarehouse.id)
    expect(sourceStock[0].currentStock).toBe(2500)

    const destStock = await inventoryService.getInventoryByWarehouse(destinationWarehouse.id)
    expect(destStock[0].currentStock).toBe(7500)
  })
})
