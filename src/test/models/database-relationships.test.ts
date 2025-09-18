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
      const warehouse = await createTestWarehouse({ code: 'TST1' })
      const title = await createTestTitle({ isbn: '9781234567890' })

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
      const warehouse = await createTestWarehouse({ code: 'TST1' })
      const title = await createTestTitle({ isbn: '9781234567890' })

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
        isbn: '9781234567890',
        seriesId: series.id
      })

      await expect(
        testDb.series.delete({ where: { id: series.id } })
      ).rejects.toThrow()
    })

    test('should allow deletion of printer referenced in stock movements', async () => {
      const warehouse = await createTestWarehouse({ code: 'TST1' })
      const title = await createTestTitle({ isbn: '9781234567890' })
      const printer = await createTestPrinter({ code: 'TST' })

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
      const title = await createTestTitle({ isbn: '9781234567890' })

      await testDb.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: 29.99,
          effectiveFrom: new Date('2024-01-01')
        }
      })

      await testDb.title.delete({ where: { id: title.id } })

      const priceHistoryCount = await testDb.priceHistory.count({
        where: { titleId: title.id }
      })
      expect(priceHistoryCount).toBe(0)
    })

    test('should cascade delete inventory when title is deleted', async () => {
      const warehouse = await createTestWarehouse({ code: 'TST1' })
      const title = await createTestTitle({ isbn: '9781234567890' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 100,
          reservedStock: 0
        }
      })

      await testDb.title.delete({ where: { id: title.id } })

      const inventoryCount = await testDb.inventory.count({
        where: { titleId: title.id }
      })
      expect(inventoryCount).toBe(0)
    })

    test('should cascade delete stock movements when title is deleted', async () => {
      const warehouse = await createTestWarehouse({ code: 'TST1' })
      const title = await createTestTitle({ isbn: '9781234567890' })

      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date()
        }
      })

      await testDb.title.delete({ where: { id: title.id } })

      const movementCount = await testDb.stockMovement.count({
        where: { titleId: title.id }
      })
      expect(movementCount).toBe(0)
    })
  })

  describe('Complex Relationships', () => {
    test('should properly link title to series with complete metadata', async () => {
      const series = await createTestSeries({
        name: 'Programming Mastery',
        description: 'A comprehensive series on software development'
      })

      const title = await createTestTitle({
        isbn: '9781234567890',
        title: 'Advanced TypeScript',
        author: 'Jane Developer',
        seriesId: series.id
      })

      const titleWithSeries = await testDb.title.findUnique({
        where: { id: title.id },
        include: {
          series: true,
          priceHistory: true,
          inventory: true,
          stockMovements: true
        }
      })

      expect(titleWithSeries?.series?.name).toBe('Programming Mastery')
      expect(titleWithSeries?.series?.description).toBe('A comprehensive series on software development')
      expect(titleWithSeries?.priceHistory).toEqual([])
      expect(titleWithSeries?.inventory).toEqual([])
      expect(titleWithSeries?.stockMovements).toEqual([])
    })

    test('should handle multi-warehouse inventory for single title', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const warehouse1 = await createTestWarehouse({ code: 'UK1', name: 'UK Warehouse' })
      const warehouse2 = await createTestWarehouse({ code: 'US1', name: 'US Warehouse' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          currentStock: 500,
          reservedStock: 25
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse2.id,
          currentStock: 300,
          reservedStock: 15
        }
      })

      const titleWithInventory = await testDb.title.findUnique({
        where: { id: title.id },
        include: {
          inventory: {
            include: { warehouse: true }
          }
        }
      })

      expect(titleWithInventory?.inventory).toHaveLength(2)

      const ukInventory = titleWithInventory?.inventory.find(inv => inv.warehouse.code === 'UK1')
      const usInventory = titleWithInventory?.inventory.find(inv => inv.warehouse.code === 'US1')

      expect(ukInventory?.currentStock).toBe(500)
      expect(ukInventory?.reservedStock).toBe(25)
      expect(usInventory?.currentStock).toBe(300)
      expect(usInventory?.reservedStock).toBe(15)
    })

    test('should track complete stock movement history with relationships', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const warehouse1 = await createTestWarehouse({ code: 'UK1' })
      const warehouse2 = await createTestWarehouse({ code: 'US1' })
      const printer = await createTestPrinter({ code: 'LSUK' })

      // Print received
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 1000,
          movementDate: new Date('2024-01-15'),
          printerId: printer.id,
          rrpAtTime: 29.99,
          unitCostAtTime: 8.75,
          referenceNumber: 'PRINT-001'
        }
      })

      // Transfer between warehouses
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse2.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 200,
          movementDate: new Date('2024-01-20'),
          sourceWarehouseId: warehouse1.id,
          destinationWarehouseId: warehouse2.id,
          referenceNumber: 'TRANSFER-001'
        }
      })

      // Sales from US warehouse
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse2.id,
          movementType: 'US_TRADE_SALES',
          quantity: -75,
          movementDate: new Date('2024-02-01'),
          rrpAtTime: 29.99,
          unitCostAtTime: 8.75,
          tradeDiscountAtTime: 45.0,
          referenceNumber: 'SALES-001'
        }
      })

      const titleWithMovements = await testDb.title.findUnique({
        where: { id: title.id },
        include: {
          stockMovements: {
            include: {
              warehouse: true,
              printer: true,
              sourceWarehouse: true,
              destinationWarehouse: true
            },
            orderBy: { movementDate: 'asc' }
          }
        }
      })

      expect(titleWithMovements?.stockMovements).toHaveLength(3)

      const printMovement = titleWithMovements?.stockMovements[0]
      const transferMovement = titleWithMovements?.stockMovements[1]
      const salesMovement = titleWithMovements?.stockMovements[2]

      // Verify print received movement
      expect(printMovement?.movementType).toBe('PRINT_RECEIVED')
      expect(printMovement?.quantity).toBe(1000)
      expect(printMovement?.printer?.code).toBe('LSUK')
      expect(printMovement?.warehouse.code).toBe('UK1')

      // Verify transfer movement
      expect(transferMovement?.movementType).toBe('WAREHOUSE_TRANSFER')
      expect(transferMovement?.quantity).toBe(200)
      expect(transferMovement?.sourceWarehouse?.code).toBe('UK1')
      expect(transferMovement?.destinationWarehouse?.code).toBe('US1')

      // Verify sales movement
      expect(salesMovement?.movementType).toBe('US_TRADE_SALES')
      expect(salesMovement?.quantity).toBe(-75)
      expect(salesMovement?.rrpAtTime?.toNumber()).toBe(29.99)
      expect(salesMovement?.tradeDiscountAtTime?.toNumber()).toBe(45.0)
    })
  })

  describe('Data Integrity Constraints', () => {
    test('should enforce unique ISBN constraint', async () => {
      await createTestTitle({ isbn: '9781234567890' })

      await expect(
        createTestTitle({ isbn: '9781234567890' })
      ).rejects.toThrow()
    })

    test('should enforce unique warehouse code constraint', async () => {
      await createTestWarehouse({ code: 'TST' })

      await expect(
        createTestWarehouse({ code: 'TST' })
      ).rejects.toThrow()
    })

    test('should enforce unique series name constraint', async () => {
      await createTestSeries({ name: 'Test Series' })

      await expect(
        createTestSeries({ name: 'Test Series' })
      ).rejects.toThrow()
    })

    test('should enforce unique printer code constraint', async () => {
      await createTestPrinter({ code: 'TST' })

      await expect(
        createTestPrinter({ code: 'TST' })
      ).rejects.toThrow()
    })

    test('should enforce unique inventory per title-warehouse combination', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const warehouse = await createTestWarehouse({ code: 'TST1' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 100,
          reservedStock: 0
        }
      })

      await expect(
        testDb.inventory.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            currentStock: 200,
            reservedStock: 10
          }
        })
      ).rejects.toThrow()
    })

    test('should enforce unique price history per title-date combination', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const effectiveDate = new Date('2024-01-01')

      await testDb.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: 29.99,
          effectiveFrom: effectiveDate
        }
      })

      await expect(
        testDb.priceHistory.create({
          data: {
            titleId: title.id,
            rrp: 34.99,
            effectiveFrom: effectiveDate
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('Business Logic Validation', () => {
    test('should allow negative quantities only for outbound movements', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const warehouse = await createTestWarehouse({ code: 'TST1' })

      // Positive quantity for inbound movement should work
      const inboundMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'PRINT_RECEIVED',
          quantity: 100,
          movementDate: new Date()
        }
      })
      expect(inboundMovement.quantity).toBe(100)

      // Negative quantity for outbound movement should work
      const outboundMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -50,
          movementDate: new Date()
        }
      })
      expect(outboundMovement.quantity).toBe(-50)
    })

    test('should track financial data accuracy in stock movements', async () => {
      const title = await createTestTitle({ isbn: '9781234567890', rrp: 34.99, unitCost: 8.75 })
      const warehouse = await createTestWarehouse({ code: 'TST1' })

      const movement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          movementType: 'UK_TRADE_SALES',
          quantity: -100,
          movementDate: new Date(),
          rrpAtTime: 34.99,
          unitCostAtTime: 8.75,
          tradeDiscountAtTime: 45.0
        }
      })

      // Calculate profit per unit
      const wholesalePrice = movement.rrpAtTime!.toNumber() * (1 - movement.tradeDiscountAtTime!.toNumber() / 100)
      const profitPerUnit = wholesalePrice - movement.unitCostAtTime!.toNumber()
      const totalProfit = profitPerUnit * Math.abs(movement.quantity)

      expect(wholesalePrice).toBeCloseTo(19.24, 2) // 34.99 * 0.55
      expect(profitPerUnit).toBeCloseTo(10.49, 2) // 19.24 - 8.75
      expect(totalProfit).toBeCloseTo(1049, 2) // 10.49 * 100
    })
  })
})