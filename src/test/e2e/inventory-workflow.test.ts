/**
 * E2E Test: Complete Inventory Workflow (Task 5.1)
 * Tests the full user journey of viewing dashboard, recording stock movements,
 * and verifying stock changes
 */

import { describe, test, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { inventoryService } from '@/services/inventoryService'
import { stockMovementService } from '@/services/stockMovementService'
import { MovementType } from '@prisma/client'

describe.sequential('E2E: Complete Inventory Workflow', () => {
  let testWarehouse1: any
  let testWarehouse2: any
  let testTitle1: any
  let testTitle2: any

  beforeAll(async () => {
    await cleanDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()

    // Create test warehouses
    testWarehouse1 = await testDb.warehouse.create({
      data: {
        name: 'Main Warehouse',
        code: 'MAIN',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
        addressLine1: '123 Main St',
        city: 'London',
        country: 'GB',
      },
    })

    testWarehouse2 = await testDb.warehouse.create({
      data: {
        name: 'Secondary Warehouse',
        code: 'SEC',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
        addressLine1: '456 Second Ave',
        city: 'Manchester',
        country: 'GB',
      },
    })

    // Create test titles
    testTitle1 = await testDb.title.create({
      data: {
        isbn: '9781234567890',
        title: 'Test Book One',
        author: 'John Doe',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 8.00,
        lowStockThreshold: 50,
      },
    })

    testTitle2 = await testDb.title.create({
      data: {
        isbn: '9789876543210',
        title: 'Test Book Two',
        author: 'Jane Smith',
        format: 'HARDCOVER',
        rrp: 29.99,
        unitCost: 12.00,
        lowStockThreshold: 30,
      },
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('complete inventory flow: view dashboard, record print received, verify stock increase', async () => {
    // Step 1: User views inventory dashboard - should be empty initially
    const initialInventory = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(initialInventory).toHaveLength(0)

    // Step 2: User records print received movement
    const printMovement = await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      referenceNumber: 'PO-12345',
      notes: 'Initial print run',
      createdBy: 'test-user',
    })

    // Step 3: Verify movement was recorded
    expect(printMovement).toBeDefined()
    expect(printMovement.quantity).toBe(100)
    expect(printMovement.movementType).toBe(MovementType.PRINT_RECEIVED)
    expect(printMovement.referenceNumber).toBe('PO-12345')

    // Step 4: Verify stock increased in inventory
    const updatedInventory = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(updatedInventory).toHaveLength(1)
    expect(updatedInventory[0].currentStock).toBe(100)
    expect(updatedInventory[0].title.id).toBe(testTitle1.id)
    expect(updatedInventory[0].warehouse.id).toBe(testWarehouse1.id)

    // Step 5: User refreshes dashboard and sees updated stock
    const dashboardInventory = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(dashboardInventory[0].currentStock).toBe(100)
  })

  test('record sale movement and verify stock decrease', async () => {
    // Step 1: Set up initial inventory with print received
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Verify initial stock
    const beforeSale = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(beforeSale[0].currentStock).toBe(100)

    // Step 3: User records online sale
    const saleMovement = await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      referenceNumber: 'ORD-67890',
      notes: 'Customer order',
      createdBy: 'test-user',
    })

    // Step 4: Verify sale movement was recorded with negative quantity
    expect(saleMovement).toBeDefined()
    expect(saleMovement.quantity).toBe(-10)
    expect(saleMovement.movementType).toBe(MovementType.ONLINE_SALES)

    // Step 5: Verify stock decreased
    const afterSale = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(afterSale[0].currentStock).toBe(90)

    // Step 6: Record another sale
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.UK_TRADE_SALES,
      quantity: 15,
      referenceNumber: 'TRD-001',
      createdBy: 'test-user',
    })

    // Step 7: Verify cumulative stock decrease
    const finalInventory = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(finalInventory[0].currentStock).toBe(75)
  })

  test('multiple movements workflow: prints, sales, damages, adjustments', async () => {
    // Step 1: Record initial print
    await stockMovementService.recordMovement({
      titleId: testTitle2.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 500,
      referenceNumber: 'PO-001',
      createdBy: 'test-user',
    })

    let inventory = await inventoryService.getInventoryByTitle(testTitle2.id)
    expect(inventory[0].currentStock).toBe(500)

    // Step 2: Record reprint
    await stockMovementService.recordMovement({
      titleId: testTitle2.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.REPRINT,
      quantity: 200,
      referenceNumber: 'REPR-001',
      createdBy: 'test-user',
    })

    inventory = await inventoryService.getInventoryByTitle(testTitle2.id)
    expect(inventory[0].currentStock).toBe(700)

    // Step 3: Record various sales
    await stockMovementService.recordMovement({
      titleId: testTitle2.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.DIRECT_SALES,
      quantity: 50,
      createdBy: 'test-user',
    })

    inventory = await inventoryService.getInventoryByTitle(testTitle2.id)
    expect(inventory[0].currentStock).toBe(650)

    // Step 4: Record damaged stock
    await stockMovementService.recordMovement({
      titleId: testTitle2.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.DAMAGED,
      quantity: 10,
      notes: 'Water damage during storm',
      createdBy: 'test-user',
    })

    inventory = await inventoryService.getInventoryByTitle(testTitle2.id)
    expect(inventory[0].currentStock).toBe(640)

    // Step 5: Record stock adjustment (positive)
    await stockMovementService.recordMovement({
      titleId: testTitle2.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.STOCK_ADJUSTMENT,
      quantity: 25,
      notes: 'Found additional stock during audit',
      createdBy: 'test-user',
    })

    inventory = await inventoryService.getInventoryByTitle(testTitle2.id)
    expect(inventory[0].currentStock).toBe(665)

    // Step 6: Record stock adjustment (negative)
    await stockMovementService.recordMovement({
      titleId: testTitle2.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.STOCK_ADJUSTMENT,
      quantity: -15,
      notes: 'Reconciliation discrepancy',
      createdBy: 'test-user',
    })

    inventory = await inventoryService.getInventoryByTitle(testTitle2.id)
    expect(inventory[0].currentStock).toBe(650)

    // Step 7: Verify all movements in history
    const movements = await stockMovementService.getMovementHistory({
      titleId: testTitle2.id,
      page: 1,
      limit: 100,
    })

    expect(movements.data).toHaveLength(6)
    expect(movements.data.map(m => m.movementType)).toContain(MovementType.PRINT_RECEIVED)
    expect(movements.data.map(m => m.movementType)).toContain(MovementType.REPRINT)
    expect(movements.data.map(m => m.movementType)).toContain(MovementType.DIRECT_SALES)
    expect(movements.data.map(m => m.movementType)).toContain(MovementType.DAMAGED)
    expect(movements.data.map(m => m.movementType)).toContain(MovementType.STOCK_ADJUSTMENT)
  })

  test('multi-warehouse inventory tracking', async () => {
    // Step 1: Add stock to warehouse 1
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Add stock to warehouse 2
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 150,
      createdBy: 'test-user',
    })

    // Step 3: Verify stock in each warehouse
    const warehouse1Inventory = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(warehouse1Inventory[0].currentStock).toBe(100)

    const warehouse2Inventory = await inventoryService.getInventoryByWarehouse(testWarehouse2.id)
    expect(warehouse2Inventory[0].currentStock).toBe(150)

    // Step 4: Verify total stock across all warehouses
    const titleInventory = await inventoryService.getInventoryByTitle(testTitle1.id)
    const totalStock = titleInventory.reduce((sum, inv) => sum + inv.currentStock, 0)
    expect(totalStock).toBe(250)

    // Step 5: Record sales from each warehouse
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 20,
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.UK_TRADE_SALES,
      quantity: 30,
      createdBy: 'test-user',
    })

    // Step 6: Verify updated stock in each warehouse
    const updatedW1 = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(updatedW1[0].currentStock).toBe(80)

    const updatedW2 = await inventoryService.getInventoryByWarehouse(testWarehouse2.id)
    expect(updatedW2[0].currentStock).toBe(120)

    // Step 7: Verify updated total
    const updatedTitleInventory = await inventoryService.getInventoryByTitle(testTitle1.id)
    const updatedTotal = updatedTitleInventory.reduce((sum, inv) => sum + inv.currentStock, 0)
    expect(updatedTotal).toBe(200)
  })

  test('movement history filtering and pagination', async () => {
    // Step 1: Create multiple movements
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle2.id,
      warehouseId: testWarehouse2.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 200,
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.DAMAGED,
      quantity: 5,
      createdBy: 'test-user',
    })

    // Step 2: Filter by title
    const title1Movements = await stockMovementService.getMovementHistory({
      titleId: testTitle1.id,
      page: 1,
      limit: 10,
    })
    expect(title1Movements.data).toHaveLength(3)

    // Step 3: Filter by warehouse
    const warehouse1Movements = await stockMovementService.getMovementHistory({
      warehouseId: testWarehouse1.id,
      page: 1,
      limit: 10,
    })
    expect(warehouse1Movements.data).toHaveLength(3)

    // Step 4: Filter by movement type
    const printMovements = await stockMovementService.getMovementHistory({
      movementType: MovementType.PRINT_RECEIVED,
      page: 1,
      limit: 10,
    })
    expect(printMovements.data).toHaveLength(2)

    // Step 5: Verify pagination metadata
    expect(title1Movements.pagination.total).toBe(3)
    expect(title1Movements.pagination.page).toBe(1)
    expect(title1Movements.pagination.totalPages).toBe(1)
  })

  test('free copies and pulped stock movements', async () => {
    // Step 1: Add initial stock
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Record free copies given away
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.FREE_COPIES,
      quantity: 5,
      notes: 'Review copies for media',
      createdBy: 'test-user',
    })

    let inventory = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(inventory[0].currentStock).toBe(95)

    // Step 3: Record pulped stock
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.PULPED,
      quantity: 20,
      notes: 'Unsold returns pulped',
      createdBy: 'test-user',
    })

    inventory = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    expect(inventory[0].currentStock).toBe(75)

    // Step 4: Verify movements in history
    const movements = await stockMovementService.getMovementHistory({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      page: 1,
      limit: 10,
    })

    expect(movements.data).toHaveLength(3)
    const movementTypes = movements.data.map(m => m.movementType)
    expect(movementTypes).toContain(MovementType.FREE_COPIES)
    expect(movementTypes).toContain(MovementType.PULPED)
  })

  test('last stock check timestamp update on adjustments', async () => {
    // Step 1: Create initial inventory
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    const beforeAdjustment = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    const initialLastCheck = beforeAdjustment[0].lastStockCheck

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100))

    // Step 2: Record stock adjustment
    await stockMovementService.recordMovement({
      titleId: testTitle1.id,
      warehouseId: testWarehouse1.id,
      movementType: MovementType.STOCK_ADJUSTMENT,
      quantity: 10,
      notes: 'Physical count adjustment',
      createdBy: 'test-user',
    })

    // Step 3: Verify last stock check was updated
    const afterAdjustment = await inventoryService.getInventoryByWarehouse(testWarehouse1.id)
    const updatedLastCheck = afterAdjustment[0].lastStockCheck

    expect(updatedLastCheck).not.toBeNull()
    if (initialLastCheck !== null && updatedLastCheck !== null) {
      expect(new Date(updatedLastCheck).getTime()).toBeGreaterThan(new Date(initialLastCheck).getTime())
    }
  })
})
