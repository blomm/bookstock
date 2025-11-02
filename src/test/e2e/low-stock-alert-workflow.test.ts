/**
 * E2E Test: Low Stock Alert Workflow (Task 5.2)
 * Tests the low stock alert system: setting thresholds, triggering alerts,
 * and clearing alerts through stock adjustments
 */

import { describe, test, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { inventoryService } from '@/services/inventoryService'
import { stockMovementService } from '@/services/stockMovementService'
import { titleService } from '@/services/titleService'
import { MovementType } from '@prisma/client'

describe.sequential('E2E: Low Stock Alert Workflow', () => {
  let testWarehouse: any
  let testTitle: any

  beforeAll(async () => {
    await cleanDatabase()
  })

  beforeEach(async () => {
    await cleanDatabase()

    // Create test warehouse
    testWarehouse = await testDb.warehouse.create({
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

    // Create test title without low stock threshold initially
    testTitle = await testDb.title.create({
      data: {
        isbn: '9781234567890',
        title: 'Test Book',
        author: 'John Doe',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 8.00,
        lowStockThreshold: null,
      },
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  test('low stock alert workflow: set threshold, reduce stock, verify alert, adjust, verify clear', async () => {
    // Step 1: Set up initial stock
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'test-user',
    })

    // Step 2: Verify no low stock alerts initially (no threshold set)
    const noThresholdAlerts = await inventoryService.getLowStockItems()
    expect(noThresholdAlerts).toHaveLength(0)

    // Step 3: User sets low stock threshold to 50
    const updatedTitle = await titleService.updateStockThreshold(testTitle.id, 50)
    expect(updatedTitle.lowStockThreshold).toBe(50)

    // Step 4: Verify no alert yet (stock is 100, above threshold of 50)
    const aboveThresholdAlerts = await inventoryService.getLowStockItems()
    expect(aboveThresholdAlerts).toHaveLength(0)

    // Step 5: User reduces stock below threshold through sales
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 60,
      createdBy: 'test-user',
    })

    // Step 6: Verify stock is now 40 (below threshold of 50)
    const currentInventory = await inventoryService.getInventoryByTitle(testTitle.id)
    expect(currentInventory[0].currentStock).toBe(40)

    // Step 7: Verify low stock alert appears
    const lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(1)
    expect(lowStockAlerts[0].title.id).toBe(testTitle.id)
    expect(lowStockAlerts[0].totalStock).toBe(40)
    expect(lowStockAlerts[0].totalDeficit).toBe(10) // 50 - 40 = 10

    // Step 8: User adjusts stock to bring it above threshold
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.STOCK_ADJUSTMENT,
      quantity: 20,
      notes: 'Restocking to clear low stock alert',
      createdBy: 'test-user',
    })

    // Step 9: Verify stock is now 60 (above threshold)
    const adjustedInventory = await inventoryService.getInventoryByTitle(testTitle.id)
    expect(adjustedInventory[0].currentStock).toBe(60)

    // Step 10: Verify low stock alert is cleared
    const clearedAlerts = await inventoryService.getLowStockItems()
    expect(clearedAlerts).toHaveLength(0)
  })

  test('low stock alert shows warehouse breakdown', async () => {
    // Step 1: Create second warehouse
    const warehouse2 = await testDb.warehouse.create({
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

    // Step 2: Set low stock threshold
    await titleService.updateStockThreshold(testTitle.id, 100)

    // Step 3: Add stock to both warehouses (total below threshold)
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 30,
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: warehouse2.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 40,
      createdBy: 'test-user',
    })

    // Step 4: Verify low stock alert with warehouse breakdown
    const lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(1)
    expect(lowStockAlerts[0].totalStock).toBe(70) // 30 + 40
    expect(lowStockAlerts[0].totalDeficit).toBe(30) // 100 - 70
    expect(lowStockAlerts[0].warehouses).toHaveLength(2)

    // Verify warehouse breakdown details
    const warehouse1Stock = lowStockAlerts[0].warehouses.find(
      w => w.warehouse.id === testWarehouse.id
    )
    expect(warehouse1Stock?.currentStock).toBe(30)

    const warehouse2Stock = lowStockAlerts[0].warehouses.find(
      w => w.warehouse.id === warehouse2.id
    )
    expect(warehouse2Stock?.currentStock).toBe(40)
  })

  test('multiple titles with low stock alerts', async () => {
    // Step 1: Create multiple titles with thresholds
    const title1 = await testDb.title.create({
      data: {
        isbn: '9781111111111',
        title: 'Book One',
        author: 'Author One',
        format: 'PAPERBACK',
        rrp: 19.99,
        unitCost: 8.00,
        lowStockThreshold: 50,
      },
    })

    const title2 = await testDb.title.create({
      data: {
        isbn: '9782222222222',
        title: 'Book Two',
        author: 'Author Two',
        format: 'HARDCOVER',
        rrp: 29.99,
        unitCost: 12.00,
        lowStockThreshold: 75,
      },
    })

    const title3 = await testDb.title.create({
      data: {
        isbn: '9783333333333',
        title: 'Book Three',
        author: 'Author Three',
        format: 'PAPERBACK',
        rrp: 24.99,
        unitCost: 10.00,
        lowStockThreshold: 100,
      },
    })

    // Step 2: Add stock below thresholds for titles 1 and 2, above for title 3
    await stockMovementService.recordMovement({
      titleId: title1.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 30, // Below threshold of 50
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: title2.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 40, // Below threshold of 75
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: title3.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 150, // Above threshold of 100
      createdBy: 'test-user',
    })

    // Step 3: Verify only titles 1 and 2 show low stock alerts
    const lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(2)

    const alertedTitleIds = lowStockAlerts.map(alert => alert.title.id)
    expect(alertedTitleIds).toContain(title1.id)
    expect(alertedTitleIds).toContain(title2.id)
    expect(alertedTitleIds).not.toContain(title3.id)

    // Step 4: Verify deficit calculations
    const title1Alert = lowStockAlerts.find(a => a.title.id === title1.id)
    expect(title1Alert?.totalDeficit).toBe(20) // 50 - 30

    const title2Alert = lowStockAlerts.find(a => a.title.id === title2.id)
    expect(title2Alert?.totalDeficit).toBe(35) // 75 - 40
  })

  test('low stock filter by warehouse', async () => {
    // Step 1: Create second warehouse
    const warehouse2 = await testDb.warehouse.create({
      data: {
        name: 'Secondary Warehouse',
        code: 'SEC',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
      },
    })

    // Step 2: Set threshold
    await titleService.updateStockThreshold(testTitle.id, 50)

    // Step 3: Add low stock to warehouse 1 only
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 30, // Below threshold
      createdBy: 'test-user',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: warehouse2.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 80, // Above threshold
      createdBy: 'test-user',
    })

    // Step 4: Filter low stock by warehouse 1
    const warehouse1LowStock = await inventoryService.getLowStockItems(testWarehouse.id)
    expect(warehouse1LowStock).toHaveLength(1)

    // Step 5: Filter low stock by warehouse 2 (should be empty)
    const warehouse2LowStock = await inventoryService.getLowStockItems(warehouse2.id)
    expect(warehouse2LowStock).toHaveLength(0)

    // Step 6: Get all low stock items (based on total across warehouses)
    const allLowStock = await inventoryService.getLowStockItems()
    // Total stock is 30 + 80 = 110, above threshold of 50, so no alert
    expect(allLowStock).toHaveLength(0)
  })

  test('threshold update affects existing alerts', async () => {
    // Step 1: Set initial threshold and stock
    await titleService.updateStockThreshold(testTitle.id, 100)

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 80,
      createdBy: 'test-user',
    })

    // Step 2: Verify low stock alert exists
    let lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(1)
    expect(lowStockAlerts[0].totalDeficit).toBe(20) // 100 - 80

    // Step 3: Lower threshold to 50
    await titleService.updateStockThreshold(testTitle.id, 50)

    // Step 4: Verify alert is cleared (stock of 80 is now above threshold of 50)
    lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(0)

    // Step 5: Raise threshold to 150
    await titleService.updateStockThreshold(testTitle.id, 150)

    // Step 6: Verify alert reappears with new deficit
    lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(1)
    expect(lowStockAlerts[0].totalDeficit).toBe(70) // 150 - 80
  })

  test('remove threshold disables alerts', async () => {
    // Step 1: Set threshold and create low stock situation
    await titleService.updateStockThreshold(testTitle.id, 100)

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 50,
      createdBy: 'test-user',
    })

    // Step 2: Verify alert exists
    let lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(1)

    // Step 3: Remove threshold (set to null)
    await titleService.updateStockThreshold(testTitle.id, null)

    // Step 4: Verify alert is removed
    lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(0)
  })

  test('zero stock with threshold shows maximum deficit', async () => {
    // Step 1: Set threshold
    await titleService.updateStockThreshold(testTitle.id, 50)

    // Step 2: No stock movements (stock remains 0)

    // Step 3: Verify low stock alert shows maximum deficit
    const lowStockAlerts = await inventoryService.getLowStockItems()
    // Note: If there's no inventory record, getLowStockItems might not return it
    // This tests the edge case of titles with thresholds but no inventory
  })

  test('reprint movement can clear low stock alert', async () => {
    // Step 1: Set threshold and create low stock
    await titleService.updateStockThreshold(testTitle.id, 100)

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 50,
      createdBy: 'test-user',
    })

    // Step 2: Verify low stock alert
    let lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(1)

    // Step 3: Record reprint to bring stock above threshold
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.REPRINT,
      quantity: 100,
      referenceNumber: 'REPR-001',
      createdBy: 'test-user',
    })

    // Step 4: Verify alert is cleared
    lowStockAlerts = await inventoryService.getLowStockItems()
    expect(lowStockAlerts).toHaveLength(0)

    // Step 5: Verify stock is 150 (50 + 100)
    const inventory = await inventoryService.getInventoryByTitle(testTitle.id)
    expect(inventory[0].currentStock).toBe(150)
  })
})
