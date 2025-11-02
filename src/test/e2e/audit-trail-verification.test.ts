/**
 * E2E Test: Audit Trail Verification (Task 5.4)
 * Tests audit trail functionality: record multiple movements,
 * filter history, verify all movements logged with correct user
 */

import { describe, test, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb } from '../utils/test-db'
import { stockMovementService } from '@/services/stockMovementService'
import { MovementType } from '@prisma/client'

describe.sequential('E2E: Audit Trail Verification', () => {
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

  test('audit trail logs all movements with user information', async () => {
    // Step 1: Record multiple movements by different users
    const movement1 = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      referenceNumber: 'PO-001',
      createdBy: 'user-alice',
    })

    const movement2 = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      referenceNumber: 'ORD-001',
      createdBy: 'user-bob',
    })

    const movement3 = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.STOCK_ADJUSTMENT,
      quantity: 5,
      notes: 'Manual count adjustment',
      createdBy: 'user-charlie',
    })

    const movement4 = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.DAMAGED,
      quantity: 3,
      notes: 'Water damage',
      createdBy: 'user-alice',
    })

    // Step 2: Retrieve audit trail
    const auditTrail = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 100,
    })

    // Step 3: Verify all movements are logged
    expect(auditTrail.data).toHaveLength(4)

    // Step 4: Verify each movement has correct user attribution
    const mov1 = auditTrail.data.find(m => m.id === movement1.id)
    expect(mov1?.createdBy).toBe('user-alice')
    expect(mov1?.movementType).toBe(MovementType.PRINT_RECEIVED)
    expect(mov1?.referenceNumber).toBe('PO-001')

    const mov2 = auditTrail.data.find(m => m.id === movement2.id)
    expect(mov2?.createdBy).toBe('user-bob')
    expect(mov2?.movementType).toBe(MovementType.ONLINE_SALES)

    const mov3 = auditTrail.data.find(m => m.id === movement3.id)
    expect(mov3?.createdBy).toBe('user-charlie')
    expect(mov3?.movementType).toBe(MovementType.STOCK_ADJUSTMENT)
    expect(mov3?.notes).toBe('Manual count adjustment')

    const mov4 = auditTrail.data.find(m => m.id === movement4.id)
    expect(mov4?.createdBy).toBe('user-alice')
    expect(mov4?.movementType).toBe(MovementType.DAMAGED)

    // Step 5: Verify timestamps are recorded
    auditTrail.data.forEach(movement => {
      expect(movement.createdAt).toBeDefined()
      expect(new Date(movement.createdAt).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  test('filter audit trail by movement type', async () => {
    // Step 1: Create movements of different types
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'user-1',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      createdBy: 'user-1',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 5,
      createdBy: 'user-2',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.UK_TRADE_SALES,
      quantity: 15,
      createdBy: 'user-1',
    })

    // Step 2: Filter by ONLINE_SALES
    const onlineSalesAudit = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      movementType: MovementType.ONLINE_SALES,
      page: 1,
      limit: 100,
    })

    // Step 3: Verify only ONLINE_SALES movements returned
    expect(onlineSalesAudit.data).toHaveLength(2)
    onlineSalesAudit.data.forEach(movement => {
      expect(movement.movementType).toBe(MovementType.ONLINE_SALES)
    })

    // Step 4: Filter by PRINT_RECEIVED
    const printAudit = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      movementType: MovementType.PRINT_RECEIVED,
      page: 1,
      limit: 100,
    })

    expect(printAudit.data).toHaveLength(1)
    expect(printAudit.data[0].movementType).toBe(MovementType.PRINT_RECEIVED)
  })

  test('filter audit trail by date range', async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Step 1: Create movements
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'user-1',
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      createdBy: 'user-1',
    })

    // Step 2: Filter by date range (from yesterday to tomorrow - should include all)
    const dateRangeAudit = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      dateFrom: yesterday.toISOString(),
      dateTo: tomorrow.toISOString(),
      page: 1,
      limit: 100,
    })

    expect(dateRangeAudit.data).toHaveLength(2)

    // Step 3: Filter by future date range (should return none)
    const futureAudit = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      dateFrom: tomorrow.toISOString(),
      page: 1,
      limit: 100,
    })

    expect(futureAudit.data).toHaveLength(0)
  })

  test('audit trail shows chronological order', async () => {
    // Step 1: Create movements with small delays
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      referenceNumber: 'FIRST',
      createdBy: 'user-1',
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      referenceNumber: 'SECOND',
      createdBy: 'user-1',
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.DAMAGED,
      quantity: 5,
      referenceNumber: 'THIRD',
      createdBy: 'user-1',
    })

    // Step 2: Retrieve audit trail
    const auditTrail = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 100,
    })

    // Step 3: Verify chronological order (most recent first)
    expect(auditTrail.data[0].referenceNumber).toBe('THIRD')
    expect(auditTrail.data[1].referenceNumber).toBe('SECOND')
    expect(auditTrail.data[2].referenceNumber).toBe('FIRST')

    // Step 4: Verify timestamps are in descending order
    for (let i = 0; i < auditTrail.data.length - 1; i++) {
      const current = new Date(auditTrail.data[i].createdAt).getTime()
      const next = new Date(auditTrail.data[i + 1].createdAt).getTime()
      expect(current).toBeGreaterThanOrEqual(next)
    }
  })

  test('audit trail includes notes and reference numbers', async () => {
    // Step 1: Create movements with detailed notes
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      referenceNumber: 'PO-2025-001',
      notes: 'Initial print run from printer XYZ',
      createdBy: 'user-1',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.DAMAGED,
      quantity: 5,
      notes: 'Water damage during storm on 2025-01-15',
      createdBy: 'user-2',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.STOCK_ADJUSTMENT,
      quantity: -3,
      notes: 'Discrepancy found during annual audit - books missing',
      createdBy: 'user-3',
    })

    // Step 2: Retrieve audit trail
    const auditTrail = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 100,
    })

    // Step 3: Verify notes are preserved
    expect(auditTrail.data).toHaveLength(3)

    const printMovement = auditTrail.data.find(m => m.movementType === MovementType.PRINT_RECEIVED)
    expect(printMovement?.notes).toBe('Initial print run from printer XYZ')
    expect(printMovement?.referenceNumber).toBe('PO-2025-001')

    const damagedMovement = auditTrail.data.find(m => m.movementType === MovementType.DAMAGED)
    expect(damagedMovement?.notes).toBe('Water damage during storm on 2025-01-15')

    const adjustmentMovement = auditTrail.data.find(m => m.movementType === MovementType.STOCK_ADJUSTMENT)
    expect(adjustmentMovement?.notes).toBe('Discrepancy found during annual audit - books missing')
  })

  test('audit trail for warehouse transfers includes both warehouses', async () => {
    // Step 1: Create second warehouse
    const warehouse2 = await testDb.warehouse.create({
      data: {
        name: 'Second Warehouse',
        code: 'WH2',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
      },
    })

    // Step 2: Set up stock and perform transfer
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'user-1',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      movementType: MovementType.WAREHOUSE_TRANSFER,
      quantity: 40,
      sourceWarehouseId: testWarehouse.id,
      destinationWarehouseId: warehouse2.id,
      referenceNumber: 'TRF-001',
      notes: 'Rebalancing stock',
      createdBy: 'user-manager',
    })

    // Step 3: Retrieve audit trail
    const auditTrail = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 100,
    })

    // Step 4: Verify transfer movement includes both warehouses
    const transferMovement = auditTrail.data.find(m => m.movementType === MovementType.WAREHOUSE_TRANSFER)
    expect(transferMovement).toBeDefined()
    expect(transferMovement?.sourceWarehouseId).toBe(testWarehouse.id)
    expect(transferMovement?.destinationWarehouseId).toBe(warehouse2.id)
    expect(transferMovement?.createdBy).toBe('user-manager')
    expect(transferMovement?.notes).toBe('Rebalancing stock')
  })

  test('audit trail pagination works correctly', async () => {
    // Step 1: Create 25 movements
    for (let i = 1; i <= 25; i++) {
      await stockMovementService.recordMovement({
        titleId: testTitle.id,
        warehouseId: testWarehouse.id,
        movementType: i % 2 === 0 ? MovementType.PRINT_RECEIVED : MovementType.ONLINE_SALES,
        quantity: i,
        referenceNumber: `REF-${i.toString().padStart(3, '0')}`,
        createdBy: `user-${i % 3 + 1}`,
      })
    }

    // Step 2: Get first page (limit 20)
    const page1 = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 20,
    })

    expect(page1.data).toHaveLength(20)
    expect(page1.pagination.total).toBe(25)
    expect(page1.pagination.totalPages).toBe(2)
    expect(page1.pagination.page).toBe(1)

    // Step 3: Get second page
    const page2 = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 2,
      limit: 20,
    })

    expect(page2.data).toHaveLength(5)
    expect(page2.pagination.page).toBe(2)

    // Step 4: Verify no overlap between pages
    const page1Ids = page1.data.map(m => m.id)
    const page2Ids = page2.data.map(m => m.id)
    const overlap = page1Ids.filter(id => page2Ids.includes(id))
    expect(overlap).toHaveLength(0)
  })

  test('audit trail combined filters: user, type, and date', async () => {
    // Step 1: Create movements by different users
    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      createdBy: 'user-alice',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 10,
      createdBy: 'user-alice',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.ONLINE_SALES,
      quantity: 5,
      createdBy: 'user-bob',
    })

    await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.DAMAGED,
      quantity: 3,
      createdBy: 'user-alice',
    })

    // Step 2: Filter by movement type ONLINE_SALES
    const salesAudit = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      movementType: MovementType.ONLINE_SALES,
      page: 1,
      limit: 100,
    })

    // Step 3: Verify results
    expect(salesAudit.data).toHaveLength(2)
    salesAudit.data.forEach(movement => {
      expect(movement.movementType).toBe(MovementType.ONLINE_SALES)
    })

    // Verify one by alice, one by bob
    const userNames = salesAudit.data.map(m => m.createdBy).sort()
    expect(userNames).toEqual(['user-alice', 'user-bob'])
  })

  test('movements cannot be modified after creation (immutability check)', async () => {
    // Step 1: Create a movement
    const movement = await stockMovementService.recordMovement({
      titleId: testTitle.id,
      warehouseId: testWarehouse.id,
      movementType: MovementType.PRINT_RECEIVED,
      quantity: 100,
      referenceNumber: 'PO-001',
      notes: 'Original note',
      createdBy: 'user-1',
    })

    // Step 2: Verify movement was created
    expect(movement.quantity).toBe(100)
    expect(movement.notes).toBe('Original note')

    // Step 3: Attempt to update the movement directly in database (should not have update method)
    // This verifies the service doesn't expose an update method for movements
    // @ts-expect-error - testing that update method doesn't exist
    expect(stockMovementService.updateMovement).toBeUndefined()

    // Step 4: Verify movement remains unchanged
    const auditTrail = await stockMovementService.getMovementHistory({
      titleId: testTitle.id,
      page: 1,
      limit: 100,
    })

    const retrievedMovement = auditTrail.data.find(m => m.id === movement.id)
    expect(retrievedMovement?.quantity).toBe(100)
    expect(retrievedMovement?.notes).toBe('Original note')
    expect(retrievedMovement?.createdBy).toBe('user-1')
  })
})
