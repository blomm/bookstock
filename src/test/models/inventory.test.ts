import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse } from '../utils/test-db'

describe('Inventory Model', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Creation', () => {
    test('should create inventory record for title-warehouse combination', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'INV' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1500,
          reservedStock: 100
        }
      })

      expect(inventory).toMatchObject({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 1500,
        reservedStock: 100
      })
      expect(inventory.id).toBeDefined()
      expect(inventory.createdAt).toBeInstanceOf(Date)
      expect(inventory.updatedAt).toBeInstanceOf(Date)
    })

    test('should default reservedStock to 0', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'DEF' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 2000
        }
      })

      expect(inventory.reservedStock).toBe(0)
    })

    test('should enforce unique title-warehouse combination', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'UNQ' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      await expect(
        testDb.inventory.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            currentStock: 500
          }
        })
      ).rejects.toThrow()
    })

    test('should allow same title in different warehouses', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse1 = await createTestWarehouse({ code: 'WH1' })
      const warehouse2 = await createTestWarehouse({ code: 'WH2' })

      const inventory1 = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          currentStock: 1000
        }
      })

      const inventory2 = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse2.id,
          currentStock: 500
        }
      })

      expect(inventory1.titleId).toBe(title.id)
      expect(inventory2.titleId).toBe(title.id)
      expect(inventory1.warehouseId).toBe(warehouse1.id)
      expect(inventory2.warehouseId).toBe(warehouse2.id)
    })

    test('should allow different titles in same warehouse', async () => {
      const title1 = await createTestTitle({ isbn: '9781111111111' })
      const title2 = await createTestTitle({ isbn: '9782222222222' })
      const warehouse = await createTestWarehouse({ code: 'SHR' })

      const inventory1 = await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      const inventory2 = await testDb.inventory.create({
        data: {
          titleId: title2.id,
          warehouseId: warehouse.id,
          currentStock: 750
        }
      })

      expect(inventory1.warehouseId).toBe(warehouse.id)
      expect(inventory2.warehouseId).toBe(warehouse.id)
      expect(inventory1.titleId).toBe(title1.id)
      expect(inventory2.titleId).toBe(title2.id)
    })
  })

  describe('Validation', () => {
    test('should require titleId and warehouseId', async () => {
      // Missing titleId
      await expect(
        testDb.inventory.create({
          data: {
            warehouseId: 1,
            currentStock: 100
          } as any
        })
      ).rejects.toThrow()

      // Missing warehouseId
      await expect(
        testDb.inventory.create({
          data: {
            titleId: 1,
            currentStock: 100
          } as any
        })
      ).rejects.toThrow()
    })

    test('should require currentStock', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'REQ' })

      await expect(
        testDb.inventory.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id
          } as any
        })
      ).rejects.toThrow()
    })

    test('should handle negative stock values', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'NEG' })

      // Allow negative current stock (for oversold situations)
      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: -10,
          reservedStock: 0
        }
      })

      expect(inventory.currentStock).toBe(-10)
    })

    test('should handle lastMovementDate', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'LMD' })
      const movementDate = new Date('2024-01-15T10:30:00Z')

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000,
          lastMovementDate: movementDate
        }
      })

      expect(inventory.lastMovementDate).toEqual(movementDate)
    })
  })

  describe('Relationships', () => {
    test('should link to title and warehouse', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Inventory Test Book'
      })
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TST'
      })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      const inventoryWithRelations = await testDb.inventory.findUnique({
        where: { id: inventory.id },
        include: {
          title: true,
          warehouse: true
        }
      })

      expect(inventoryWithRelations?.title.title).toBe('Inventory Test Book')
      expect(inventoryWithRelations?.warehouse.name).toBe('Test Warehouse')
    })

    test('should handle cascade deletion from title', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'CAS' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      // Deleting title should cascade delete inventory
      await testDb.title.delete({
        where: { id: title.id }
      })

      const remainingInventory = await testDb.inventory.findMany({
        where: { titleId: title.id }
      })

      expect(remainingInventory).toHaveLength(0)
    })

    test('should handle cascade deletion from warehouse', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'WHC' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      // Deleting warehouse should cascade delete inventory
      await testDb.warehouse.delete({
        where: { id: warehouse.id }
      })

      const remainingInventory = await testDb.inventory.findMany({
        where: { warehouseId: warehouse.id }
      })

      expect(remainingInventory).toHaveLength(0)
    })
  })

  describe('Queries', () => {
    test('should find inventory by title and warehouse', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'FND' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1500
        }
      })

      const found = await testDb.inventory.findUnique({
        where: {
          titleId_warehouseId: {
            titleId: title.id,
            warehouseId: warehouse.id
          }
        }
      })

      expect(found?.currentStock).toBe(1500)
    })

    test('should filter by stock levels', async () => {
      const title1 = await createTestTitle({ isbn: '9781111111111' })
      const title2 = await createTestTitle({ isbn: '9782222222222' })
      const warehouse = await createTestWarehouse({ code: 'STK' })

      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse.id,
          currentStock: 100 // Low stock
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title2.id,
          warehouseId: warehouse.id,
          currentStock: 2000 // High stock
        }
      })

      const lowStock = await testDb.inventory.findMany({
        where: {
          currentStock: { lte: 500 }
        }
      })

      expect(lowStock).toHaveLength(1)
      expect(lowStock[0].currentStock).toBe(100)
    })

    test('should get total stock across warehouses for title', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse1 = await createTestWarehouse({ code: 'TOT1' })
      const warehouse2 = await createTestWarehouse({ code: 'TOT2' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          currentStock: 1500
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse2.id,
          currentStock: 800
        }
      })

      const allInventory = await testDb.inventory.findMany({
        where: { titleId: title.id }
      })

      const totalStock = allInventory.reduce((sum, inv) => sum + inv.currentStock, 0)
      expect(totalStock).toBe(2300)
    })

    test('should get available stock calculation (current - reserved)', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'AVL' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000,
          reservedStock: 150
        }
      })

      // Available stock calculation would be done in application logic
      const availableStock = inventory.currentStock - inventory.reservedStock
      expect(availableStock).toBe(850)
    })

    test('should order by various fields', async () => {
      const title1 = await createTestTitle({ isbn: '9781111111111' })
      const title2 = await createTestTitle({ isbn: '9782222222222' })
      const warehouse = await createTestWarehouse({ code: 'ORD' })

      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse.id,
          currentStock: 500
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title2.id,
          warehouseId: warehouse.id,
          currentStock: 1500
        }
      })

      const orderedByStock = await testDb.inventory.findMany({
        orderBy: { currentStock: 'desc' }
      })

      expect(orderedByStock[0].currentStock).toBe(1500)
      expect(orderedByStock[1].currentStock).toBe(500)
    })
  })

  describe('Updates', () => {
    test('should update stock levels', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'UPD' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000,
          reservedStock: 50
        }
      })

      const updated = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          currentStock: 1200,
          reservedStock: 75,
          lastMovementDate: new Date()
        }
      })

      expect(updated.currentStock).toBe(1200)
      expect(updated.reservedStock).toBe(75)
      expect(updated.lastMovementDate).toBeInstanceOf(Date)
      expect(updated.updatedAt.getTime()).toBeGreaterThan(inventory.updatedAt.getTime())
    })

    test('should handle stock adjustments', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'ADJ' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1000
        }
      })

      // Simulate stock movement adjustment
      const adjustment = -250
      const updated = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          currentStock: inventory.currentStock + adjustment,
          lastMovementDate: new Date()
        }
      })

      expect(updated.currentStock).toBe(750)
    })
  })

  describe('Multi-Warehouse Scenarios', () => {
    test('should track same title across all three main warehouses', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Multi-Warehouse Book'
      })

      const turnaround = await createTestWarehouse({
        name: 'Turnaround',
        code: 'TRN',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      const acc = await createTestWarehouse({
        name: 'ACC',
        code: 'ACC',
        location: 'US',
        fulfillsChannels: ['US_TRADE_SALES']
      })

      const flostream = await createTestWarehouse({
        name: 'Flostream',
        code: 'FLS',
        location: 'UK',
        fulfillsChannels: ['ONLINE_SALES']
      })

      // Create inventory records as specified in requirements
      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: turnaround.id,
          currentStock: 6060 // UK warehouse allocation
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: acc.id,
          currentStock: 1400 // US warehouse allocation
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: flostream.id,
          currentStock: 65 // Online fulfillment allocation
        }
      })

      const allInventory = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      expect(allInventory).toHaveLength(3)

      const totalStock = allInventory.reduce((sum, inv) => sum + inv.currentStock, 0)
      expect(totalStock).toBe(7525) // 6060 + 1400 + 65

      const turnaroundStock = allInventory.find(inv => inv.warehouse.code === 'TRN')?.currentStock
      const accStock = allInventory.find(inv => inv.warehouse.code === 'ACC')?.currentStock
      const flostreamStock = allInventory.find(inv => inv.warehouse.code === 'FLS')?.currentStock

      expect(turnaroundStock).toBe(6060)
      expect(accStock).toBe(1400)
      expect(flostreamStock).toBe(65)
    })
  })

  describe('Business Logic Support', () => {
    test('should support reprint threshold calculations', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        reprintThreshold: 1000 // Reprint when stock falls below 1000
      })
      const warehouse = await createTestWarehouse({ code: 'RPT' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 950 // Below reprint threshold
        }
      })

      const inventoryWithTitle = await testDb.inventory.findUnique({
        where: { id: inventory.id },
        include: { title: true }
      })

      const needsReprint = inventoryWithTitle!.currentStock < (inventoryWithTitle!.title.reprintThreshold || 0)
      expect(needsReprint).toBe(true)
    })

    test('should support months of stock calculation data', async () => {
      const title = await createTestTitle({ isbn: '9781111111111' })
      const warehouse = await createTestWarehouse({ code: 'MOS' })

      const inventory = await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 1200,
          lastMovementDate: new Date('2024-01-01')
        }
      })

      // This would support months of stock calculation:
      // months_remaining = current_stock / average_monthly_sales
      // The calculation would be done in application logic using stock movement history

      expect(inventory.currentStock).toBe(1200)
      expect(inventory.lastMovementDate).toBeInstanceOf(Date)
    })
  })
})