import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestSeries, createTestWarehouse, createTestPrinter } from '../utils/test-db'

describe('Database Relationships and Constraints', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Foreign Key Constraints', () => {
    test('should prevent deletion of title with inventory records', async () => {
      const warehouse = await createTestWarehouse()
      const title = await createTestTitle()

      // Create inventory record
      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 100,
          reservedStock: 0
        }
      })

      // Should fail to delete title due to foreign key constraint
      await expect(
        testDb.title.delete({ where: { id: title.id } })
      ).rejects.toThrow()
    })

    test('should prevent deletion of warehouse with inventory records', async () => {
      const warehouse = await createTestWarehouse()
      const title = await createTestTitle()

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 100,
          reservedStock: 0
        }
      })

      await expect(
        testDb.warehouse.delete({ where: { id: warehouse.id } })
      ).rejects.toThrow()
    })

    test('should prevent deletion of series with associated titles', async () => {
      const series = await createTestSeries({ name: 'Test Series' })
      await createTestTitle({
        seriesId: series.id
      })

      await expect(
        testDb.series.delete({ where: { id: series.id } })
      ).rejects.toThrow()
    })

    test('should allow deletion of printer referenced in stock movements', async () => {
      const warehouse = await createTestWarehouse()
      const title = await createTestTitle()
      const printer = await createTestPrinter()

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date(),
          printerId: printer.id
        }
      })

      // Should succeed - printer deletion sets printerId to null
      await testDb.printer.delete({ where: { id: printer.id } })

      const movement = await testDb.stockMovement.findFirst({
        where: { titleId: title.id }
      })
      expect(movement?.printerId).toBeNull()
    })
  })

  describe('Cascade Behavior', () => {
    test('should cascade delete price history when title is deleted', async () => {
      const title = await createTestTitle()

      await testDb.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: 29.99,
          effectiveFrom: new Date('2024-01-01')
        }
      })

      const priceHistoryBefore = await testDb.priceHistory.count({
        where: { titleId: title.id }
      })
      expect(priceHistoryBefore).toBe(1)

      // Delete title - should cascade to price history
      await testDb.title.delete({ where: { id: title.id } })

      const priceHistoryAfter = await testDb.priceHistory.count({
        where: { titleId: title.id }
      })
      expect(priceHistoryAfter).toBe(0)
    })

    test('should prevent deletion of title when inventory exists (safer business logic)', async () => {
      const warehouse = await createTestWarehouse()
      const title = await createTestTitle()

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 100,
          reservedStock: 0
        }
      })

      // Should fail due to foreign key constraint
      await expect(
        testDb.title.delete({ where: { id: title.id } })
      ).rejects.toThrow()
    })
  })

  describe('Business Logic Constraints', () => {
    test('should handle complex deletion scenario with multiple relationships', async () => {
      const series = await createTestSeries()
      const warehouse = await createTestWarehouse()
      const title = await createTestTitle({ seriesId: series.id })
      const printer = await createTestPrinter()

      // Create price history (should cascade delete)
      await testDb.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: 25.99,
          effectiveFrom: new Date('2024-01-01')
        }
      })

      // Create inventory (should prevent title deletion)
      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 50,
          reservedStock: 10
        }
      })

      // Create stock movement
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 50,
          movementDate: new Date(),
          printerId: printer.id
        }
      })

      // Title deletion should fail due to inventory
      await expect(
        testDb.title.delete({ where: { id: title.id } })
      ).rejects.toThrow()

      // Printer deletion should succeed and null the reference
      await testDb.printer.delete({ where: { id: printer.id } })

      const movement = await testDb.stockMovement.findFirst({
        where: { titleId: title.id }
      })
      expect(movement?.printerId).toBeNull()

      // Series deletion should fail due to associated title
      await expect(
        testDb.series.delete({ where: { id: series.id } })
      ).rejects.toThrow()
    })

    test('should allow safe cleanup after removing blocking relationships', async () => {
      const series = await createTestSeries()
      const warehouse = await createTestWarehouse()
      const title = await createTestTitle({ seriesId: series.id })

      // Create price history
      await testDb.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: 19.99,
          effectiveFrom: new Date('2024-01-01')
        }
      })

      // Create inventory (blocks deletion)
      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 25,
          reservedStock: 5
        }
      })

      // Remove inventory first
      await testDb.inventory.delete({ where: { id: inventory.id } })

      // Now title deletion should succeed and cascade to price history
      await testDb.title.delete({ where: { id: title.id } })

      // Verify price history was cascade deleted
      const priceHistoryCount = await testDb.priceHistory.count({
        where: { titleId: title.id }
      })
      expect(priceHistoryCount).toBe(0)

      // Now series deletion should succeed
      await testDb.series.delete({ where: { id: series.id } })
    })
  })
})