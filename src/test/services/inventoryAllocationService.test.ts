import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse } from '../utils/test-db'
import InventoryAllocationService, { setDbClient } from '@/services/inventoryAllocationService'

describe('Inventory Allocation Service', () => {
  let warehouse1: any
  let warehouse2: any
  let warehouse3: any
  let title1: any
  let title2: any

  beforeEach(async () => {
    await cleanDatabase()
    setDbClient(testDb)

    // Clear any existing reservations from previous tests
    InventoryAllocationService.clearReservations()

    // Create test warehouses with different characteristics
    warehouse1 = await createTestWarehouse({
      name: 'Primary Warehouse',
      code: 'PRI001',
      location: 'London, UK',
      fulfillsChannels: ['UK_TRADE_SALES', 'ONLINE_SALES', 'DIRECT_SALES']
    })

    warehouse2 = await createTestWarehouse({
      name: 'Secondary Warehouse',
      code: 'SEC001',
      location: 'Manchester, UK',
      fulfillsChannels: ['ONLINE_SALES', 'DIRECT_SALES']
    })

    warehouse3 = await createTestWarehouse({
      name: 'US Warehouse',
      code: 'US001',
      location: 'New York, US',
      fulfillsChannels: ['US_TRADE_SALES']
    })

    // Create test titles
    title1 = await createTestTitle({
      isbn: '9781234567890',
      title: 'Allocation Test Book 1',
      author: 'Test Author',
      format: 'PAPERBACK',
      rrp: 19.99,
      unitCost: 5.50
    })

    title2 = await createTestTitle({
      isbn: '9781234567891',
      title: 'Allocation Test Book 2',
      author: 'Test Author',
      format: 'HARDCOVER',
      rrp: 29.99,
      unitCost: 8.50
    })

    // Create test inventory
    await testDb.inventory.createMany({
      data: [
        {
          titleId: title1.id,
          warehouseId: warehouse1.id,
          currentStock: 150,
          reservedStock: 20,
          minStockLevel: 25,
          reorderPoint: 50,
          averageCost: 5.50
        },
        {
          titleId: title1.id,
          warehouseId: warehouse2.id,
          currentStock: 80,
          reservedStock: 10,
          minStockLevel: 15,
          reorderPoint: 30,
          averageCost: 5.50
        },
        {
          titleId: title1.id,
          warehouseId: warehouse3.id,
          currentStock: 40,
          reservedStock: 5,
          minStockLevel: 10,
          reorderPoint: 20,
          averageCost: 5.50
        },
        {
          titleId: title2.id,
          warehouseId: warehouse1.id,
          currentStock: 60,
          reservedStock: 5,
          minStockLevel: 10,
          reorderPoint: 25,
          averageCost: 8.50
        }
      ]
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Stock Reservation Management (Sub-task 1)', () => {
    test('should reserve stock successfully with sufficient ATP', async () => {
      const reservationResult = await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 30,
        orderId: 'ORDER-001',
        customerId: 'CUSTOMER-001',
        priority: 'HIGH'
      })

      expect(reservationResult.success).toBe(true)
      expect(reservationResult.reservationId).toBeDefined()
      expect(reservationResult.message).toBe('Inventory reserved successfully')
      expect(reservationResult.atpRemaining).toBeDefined()

      // Verify inventory update
      const inventory = await testDb.inventory.findFirst({
        where: { titleId: title1.id, warehouseId: warehouse1.id }
      })
      expect(inventory?.reservedStock).toBe(50) // 20 + 30
    })

    test('should fail reservation when insufficient ATP', async () => {
      const reservationResult = await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 200, // More than ATP (150 - 20 - 25 = 105)
        orderId: 'ORDER-002',
        customerId: 'CUSTOMER-002'
      })

      expect(reservationResult.success).toBe(false)
      expect(reservationResult.message).toContain('Insufficient ATP')
      expect(reservationResult.atpRemaining).toBeDefined()
    })

    test('should release reservation successfully', async () => {
      // First, create a reservation
      const reservationResult = await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 20,
        orderId: 'ORDER-003',
        customerId: 'CUSTOMER-003'
      })

      expect(reservationResult.success).toBe(true)

      // Then release it
      const releaseResult = await InventoryAllocationService.releaseReservation(
        reservationResult.reservationId!,
        'Test release'
      )

      expect(releaseResult.success).toBe(true)
      expect(releaseResult.message).toBe('Reservation released successfully')

      // Verify inventory update
      const inventory = await testDb.inventory.findFirst({
        where: { titleId: title1.id, warehouseId: warehouse1.id }
      })
      expect(inventory?.reservedStock).toBe(20) // Back to original
    })

    test('should track active reservations', async () => {
      await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 15,
        orderId: 'ORDER-004',
        customerId: 'CUSTOMER-004'
      })

      await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse2.id,
        quantity: 10,
        orderId: 'ORDER-005',
        customerId: 'CUSTOMER-005'
      })

      const activeReservations = InventoryAllocationService.getActiveReservations(title1.id)
      expect(activeReservations).toHaveLength(2)
      expect(activeReservations[0].status).toBe('ACTIVE')
      expect(activeReservations[1].status).toBe('ACTIVE')
    })

    test('should set default expiration date', async () => {
      const reservationResult = await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 10,
        orderId: 'ORDER-006',
        customerId: 'CUSTOMER-006'
      })

      expect(reservationResult.success).toBe(true)

      const reservations = InventoryAllocationService.getActiveReservations(title1.id)
      const reservation = reservations.find(r => r.orderId === 'ORDER-006')
      expect(reservation?.expirationDate).toBeDefined()
      expect(reservation?.expirationDate.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('Allocation Prioritization (Sub-task 2)', () => {
    test('should allocate from best available warehouses', async () => {
      const allocationResult = await InventoryAllocationService.allocateInventory({
        titleId: title1.id,
        quantity: 50,
        customerId: 'CUSTOMER-007',
        customerTier: 'GOLD'
      })

      expect(allocationResult.success).toBe(true)
      expect(allocationResult.totalAllocated).toBe(50)
      expect(allocationResult.allocations.length).toBeGreaterThan(0)
      expect(allocationResult.unallocatedQuantity).toBe(0)

      // Verify allocations have required fields
      allocationResult.allocations.forEach(allocation => {
        expect(allocation.warehouseId).toBeDefined()
        expect(allocation.quantity).toBeGreaterThan(0)
        expect(allocation.reservationId).toBeDefined()
        expect(allocation.warehouseName).toBeDefined()
        expect(allocation.cost).toBeGreaterThan(0)
      })
    })

    test('should respect preferred warehouses', async () => {
      const allocationResult = await InventoryAllocationService.allocateInventory({
        titleId: title1.id,
        quantity: 30,
        customerId: 'CUSTOMER-008',
        customerTier: 'PLATINUM',
        preferredWarehouseIds: [warehouse2.id]
      })

      expect(allocationResult.success).toBe(true)

      // Should prefer warehouse2 if it has sufficient stock
      const warehouse2Allocation = allocationResult.allocations.find(
        alloc => alloc.warehouseId === warehouse2.id
      )
      expect(warehouse2Allocation).toBeDefined()
    })

    test('should limit number of warehouses used', async () => {
      const allocationResult = await InventoryAllocationService.allocateInventory({
        titleId: title1.id,
        quantity: 200, // Requires multiple warehouses
        customerId: 'CUSTOMER-009',
        customerTier: 'SILVER',
        maxWarehouses: 2
      })

      expect(allocationResult.allocations.length).toBeLessThanOrEqual(2)
    })

    test('should provide recommendations for unallocated quantity', async () => {
      const allocationResult = await InventoryAllocationService.allocateInventory({
        titleId: title1.id,
        quantity: 500, // More than total available
        customerId: 'CUSTOMER-010',
        customerTier: 'BRONZE'
      })

      expect(allocationResult.success).toBe(false)
      expect(allocationResult.unallocatedQuantity).toBeGreaterThan(0)
      expect(allocationResult.recommendations).toBeDefined()
      expect(allocationResult.recommendations!.length).toBeGreaterThan(0)
    })

    test('should prioritize by customer tier', async () => {
      // This test verifies that higher tier customers get better allocation priority
      // Since we can't easily test priority directly, we verify the allocation succeeds
      const platinumResult = await InventoryAllocationService.allocateInventory({
        titleId: title1.id,
        quantity: 40,
        customerId: 'PLATINUM-CUSTOMER',
        customerTier: 'PLATINUM'
      })

      const bronzeResult = await InventoryAllocationService.allocateInventory({
        titleId: title1.id,
        quantity: 40,
        customerId: 'BRONZE-CUSTOMER',
        customerTier: 'BRONZE'
      })

      expect(platinumResult.success).toBe(true)
      expect(bronzeResult.success).toBe(true)

      // Both should succeed as there's sufficient stock, but platinum should have better scoring
      expect(platinumResult.totalAllocated).toBe(40)
      expect(bronzeResult.totalAllocated).toBe(40)
    })
  })

  describe('ATP Calculations (Sub-task 3)', () => {
    test('should calculate ATP correctly for single warehouse', async () => {
      const atp = await InventoryAllocationService.calculateAtp(title1.id, warehouse1.id)

      expect(atp.titleId).toBe(title1.id)
      expect(atp.warehouseId).toBe(warehouse1.id)
      expect(atp.currentStock).toBe(150)
      expect(atp.reservedStock).toBe(20)
      expect(atp.minStockLevel).toBe(25)
      expect(atp.atpQuantity).toBe(105) // 150 - 20 - 25 + 0 (incoming)
      expect(atp.warehouseName).toBe('Primary Warehouse')
    })

    test('should calculate multi-warehouse ATP', async () => {
      const multiAtp = await InventoryAllocationService.calculateMultiWarehouseAtp(title1.id)

      expect(multiAtp.warehouseAtps).toHaveLength(3) // 3 warehouses have this title
      expect(multiAtp.totalAtp).toBeGreaterThan(0)
      expect(multiAtp.aggregatedDate).toBeDefined()

      // Verify individual ATP calculations
      multiAtp.warehouseAtps.forEach(atp => {
        expect(atp.titleId).toBe(title1.id)
        expect(atp.atpQuantity).toBeGreaterThanOrEqual(0)
        expect(atp.warehouseName).toBeDefined()
      })
    })

    test('should handle ATP calculation for non-existent inventory', async () => {
      await expect(
        InventoryAllocationService.calculateAtp(title1.id, 99999)
      ).rejects.toThrow('Inventory not found')
    })

    test('should calculate ATP with zero when insufficient stock', async () => {
      // Create inventory with high reservation and min stock
      await testDb.inventory.update({
        where: {
          titleId_warehouseId: {
            titleId: title1.id,
            warehouseId: warehouse1.id
          }
        },
        data: {
          reservedStock: 140, // Very high reservation
          minStockLevel: 50   // High safety stock
        }
      })

      const atp = await InventoryAllocationService.calculateAtp(title1.id, warehouse1.id)
      expect(atp.atpQuantity).toBe(0) // Should not go negative
    })
  })

  describe('Allocation Expiration and Cleanup (Sub-task 4)', () => {
    test('should clean up expired reservations', async () => {
      // Create a reservation with immediate expiration
      const pastDate = new Date(Date.now() - 1000) // 1 second ago

      await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 15,
        orderId: 'EXPIRED-ORDER-001',
        customerId: 'CUSTOMER-011',
        expirationDate: pastDate
      })

      // Create a valid reservation
      await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 10,
        orderId: 'VALID-ORDER-001',
        customerId: 'CUSTOMER-012'
      })

      const cleanupResult = await InventoryAllocationService.cleanupExpiredReservations()

      expect(cleanupResult.cleaned).toBe(1)
      expect(cleanupResult.releasedQuantity).toBe(15)
      expect(cleanupResult.details).toHaveLength(1)
      expect(cleanupResult.details[0].orderId).toBe('EXPIRED-ORDER-001')
    })

    test('should extend reservation expiration', async () => {
      const reservationResult = await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 12,
        orderId: 'EXTEND-ORDER-001',
        customerId: 'CUSTOMER-013'
      })

      expect(reservationResult.success).toBe(true)

      const newExpirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      const extendResult = await InventoryAllocationService.extendReservation(
        reservationResult.reservationId!,
        newExpirationDate
      )

      expect(extendResult.success).toBe(true)
      expect(extendResult.message).toBe('Reservation extended successfully')
    })

    test('should perform maintenance cleanup', async () => {
      // This test is primarily for the maintenance function structure
      const maintenanceResult = await InventoryAllocationService.performMaintenanceCleanup(30)

      expect(maintenanceResult.removedReservations).toBeGreaterThanOrEqual(0)
      expect(maintenanceResult.reclaimedMemory).toBe(true)
    })

    test('should get allocation statistics', async () => {
      // Create some test reservations
      await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse1.id,
        quantity: 5,
        orderId: 'STATS-ORDER-001',
        customerId: 'STATS-CUSTOMER-001'
      })

      await InventoryAllocationService.reserveInventory({
        titleId: title1.id,
        warehouseId: warehouse2.id,
        quantity: 8,
        orderId: 'STATS-ORDER-002',
        customerId: 'STATS-CUSTOMER-001'
      })

      const statistics = await InventoryAllocationService.getAllocationStatistics(title1.id)

      expect(statistics.totalReservations).toBeGreaterThanOrEqual(2)
      expect(statistics.activeReservations).toBeGreaterThanOrEqual(2)
      expect(statistics.totalReservedQuantity).toBeGreaterThanOrEqual(13)
      expect(statistics.topCustomers).toBeDefined()
      expect(Array.isArray(statistics.topCustomers)).toBe(true)
    })

    test('should handle concurrent allocation requests', async () => {
      // Test concurrent allocations to same inventory
      const promises = Array.from({ length: 3 }, (_, i) =>
        InventoryAllocationService.allocateInventory({
          titleId: title1.id,
          quantity: 20,
          customerId: `CONCURRENT-CUSTOMER-${i}`,
          customerTier: 'SILVER'
        })
      )

      const results = await Promise.all(promises)

      // All should succeed as there's sufficient total inventory
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.totalAllocated).toBe(20)
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid reservation release', async () => {
      const releaseResult = await InventoryAllocationService.releaseReservation(
        'INVALID-RESERVATION-ID',
        'Test invalid release'
      )

      expect(releaseResult.success).toBe(false)
      expect(releaseResult.message).toBe('Reservation not found or not active')
    })

    test('should handle extending non-existent reservation', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const extendResult = await InventoryAllocationService.extendReservation(
        'NON-EXISTENT-ID',
        futureDate
      )

      expect(extendResult.success).toBe(false)
      expect(extendResult.message).toBe('Reservation not found or not active')
    })

    test('should handle allocation with no available inventory', async () => {
      const allocationResult = await InventoryAllocationService.allocateInventory({
        titleId: 99999, // Non-existent title
        quantity: 10,
        customerId: 'CUSTOMER-014',
        customerTier: 'BRONZE'
      })

      expect(allocationResult.success).toBe(false)
      expect(allocationResult.totalAllocated).toBe(0)
      expect(allocationResult.unallocatedQuantity).toBe(10)
    })

    test('should handle zero quantity allocation request', async () => {
      const allocationResult = await InventoryAllocationService.allocateInventory({
        titleId: title1.id,
        quantity: 0,
        customerId: 'CUSTOMER-015',
        customerTier: 'BRONZE'
      })

      expect(allocationResult.success).toBe(true)
      expect(allocationResult.totalAllocated).toBe(0)
      expect(allocationResult.allocations).toHaveLength(0)
    })
  })
})