import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestInventory } from '../utils/test-db'

describe('Multi-Warehouse Inventory Operations', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Inventory Creation', () => {
    test('should create inventory for a title in a specific warehouse', async () => {
      const title = await createTestTitle({
        isbn: '9781111111111',
        title: 'Test Book'
      })

      const warehouse = await createTestWarehouse({
        name: 'Turnaround UK',
        code: 'TRN',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100,
        reservedStock: 10,
        binLocation: 'A1-B2',
        minStockLevel: 20,
        maxStockLevel: 200,
        reorderPoint: 25
      })

      expect(inventory).toMatchObject({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100,
        reservedStock: 10,
        binLocation: 'A1-B2',
        minStockLevel: 20,
        maxStockLevel: 200,
        reorderPoint: 25
      })
      expect(inventory.id).toBeDefined()
      expect(inventory.createdAt).toBeDefined()
    })

    test('should enforce unique constraint on title-warehouse combination', async () => {
      const title = await createTestTitle({
        isbn: '9781111111112',
        title: 'Test Book 2'
      })

      const warehouse = await createTestWarehouse({
        name: 'ACC US',
        code: 'ACC',
        location: 'US'
      })

      // Create first inventory record
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 50
      })

      // Attempt to create duplicate should fail
      await expect(
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse.id,
          currentStock: 30
        })
      ).rejects.toThrow()
    })

    test('should support multiple warehouses for the same title', async () => {
      const title = await createTestTitle({
        isbn: '9781111111113',
        title: 'Multi-Warehouse Book'
      })

      const ukWarehouse = await createTestWarehouse({
        name: 'Turnaround UK',
        code: 'TRN',
        location: 'UK'
      })

      const usWarehouse = await createTestWarehouse({
        name: 'ACC US',
        code: 'ACC',
        location: 'US'
      })

      const ukInventory = await createTestInventory({
        titleId: title.id,
        warehouseId: ukWarehouse.id,
        currentStock: 75,
        binLocation: 'UK-A1'
      })

      const usInventory = await createTestInventory({
        titleId: title.id,
        warehouseId: usWarehouse.id,
        currentStock: 60,
        binLocation: 'US-B2'
      })

      expect(ukInventory.titleId).toBe(title.id)
      expect(usInventory.titleId).toBe(title.id)
      expect(ukInventory.warehouseId).toBe(ukWarehouse.id)
      expect(usInventory.warehouseId).toBe(usWarehouse.id)
      expect(ukInventory.currentStock).toBe(75)
      expect(usInventory.currentStock).toBe(60)
    })
  })

  describe('Inventory Queries', () => {
    test('should retrieve inventory by title across all warehouses', async () => {
      const title = await createTestTitle({
        isbn: '9781111111114',
        title: 'Query Test Book'
      })

      const warehouses = await Promise.all([
        createTestWarehouse({ name: 'UK Warehouse', code: 'UK1', location: 'UK' }),
        createTestWarehouse({ name: 'US Warehouse', code: 'US1', location: 'US' }),
        createTestWarehouse({ name: 'EU Warehouse', code: 'EU1', location: 'EU' })
      ])

      // Create inventory in each warehouse
      await Promise.all([
        createTestInventory({ titleId: title.id, warehouseId: warehouses[0].id, currentStock: 100 }),
        createTestInventory({ titleId: title.id, warehouseId: warehouses[1].id, currentStock: 75 }),
        createTestInventory({ titleId: title.id, warehouseId: warehouses[2].id, currentStock: 50 })
      ])

      const inventoryRecords = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      expect(inventoryRecords).toHaveLength(3)
      expect(inventoryRecords.map(inv => inv.currentStock)).toEqual(
        expect.arrayContaining([100, 75, 50])
      )
      expect(inventoryRecords.map(inv => inv.warehouse.location)).toEqual(
        expect.arrayContaining(['UK', 'US', 'EU'])
      )
    })

    test('should retrieve inventory by warehouse across all titles', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Multi-Title Warehouse',
        code: 'MTW',
        location: 'UK'
      })

      const titles = await Promise.all([
        createTestTitle({ isbn: '9781111111115', title: 'Book 1' }),
        createTestTitle({ isbn: '9781111111116', title: 'Book 2' }),
        createTestTitle({ isbn: '9781111111117', title: 'Book 3' })
      ])

      // Create inventory for each title in the warehouse
      await Promise.all([
        createTestInventory({ titleId: titles[0].id, warehouseId: warehouse.id, currentStock: 200 }),
        createTestInventory({ titleId: titles[1].id, warehouseId: warehouse.id, currentStock: 150 }),
        createTestInventory({ titleId: titles[2].id, warehouseId: warehouse.id, currentStock: 100 })
      ])

      const warehouseInventory = await testDb.inventory.findMany({
        where: { warehouseId: warehouse.id },
        include: { title: true }
      })

      expect(warehouseInventory).toHaveLength(3)
      expect(warehouseInventory.map(inv => inv.currentStock)).toEqual(
        expect.arrayContaining([200, 150, 100])
      )
      expect(warehouseInventory.map(inv => inv.title.title)).toEqual(
        expect.arrayContaining(['Book 1', 'Book 2', 'Book 3'])
      )
    })

    test('should calculate total stock across all warehouses for a title', async () => {
      const title = await createTestTitle({
        isbn: '9781111111118',
        title: 'Total Stock Test'
      })

      const warehouses = await Promise.all([
        createTestWarehouse({ name: 'Warehouse A', code: 'WHA', location: 'UK' }),
        createTestWarehouse({ name: 'Warehouse B', code: 'WHB', location: 'US' }),
        createTestWarehouse({ name: 'Warehouse C', code: 'WHC', location: 'EU' })
      ])

      await Promise.all([
        createTestInventory({ titleId: title.id, warehouseId: warehouses[0].id, currentStock: 120, reservedStock: 20 }),
        createTestInventory({ titleId: title.id, warehouseId: warehouses[1].id, currentStock: 80, reservedStock: 15 }),
        createTestInventory({ titleId: title.id, warehouseId: warehouses[2].id, currentStock: 60, reservedStock: 10 })
      ])

      const totalStockAggregation = await testDb.inventory.aggregate({
        where: { titleId: title.id },
        _sum: {
          currentStock: true,
          reservedStock: true
        }
      })

      expect(totalStockAggregation._sum.currentStock).toBe(260) // 120 + 80 + 60
      expect(totalStockAggregation._sum.reservedStock).toBe(45) // 20 + 15 + 10
    })

    test('should filter inventory by stock levels', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Stock Level Warehouse',
        code: 'SLW',
        location: 'UK'
      })

      const titles = await Promise.all([
        createTestTitle({ isbn: '9781111111119', title: 'Low Stock Book' }),
        createTestTitle({ isbn: '9781111111120', title: 'Medium Stock Book' }),
        createTestTitle({ isbn: '9781111111121', title: 'High Stock Book' })
      ])

      await Promise.all([
        createTestInventory({ titleId: titles[0].id, warehouseId: warehouse.id, currentStock: 5, minStockLevel: 10 }),
        createTestInventory({ titleId: titles[1].id, warehouseId: warehouse.id, currentStock: 15, minStockLevel: 20 }),
        createTestInventory({ titleId: titles[2].id, warehouseId: warehouse.id, currentStock: 200, minStockLevel: 30 })
      ])

      // Find low stock items (below minimum)
      const lowStockItems = await testDb.inventory.findMany({
        where: {
          warehouseId: warehouse.id,
          OR: [
            { currentStock: { lt: 10 } }, // Below minStockLevel for first item
            { currentStock: { lt: 20 } }  // Below minStockLevel for second item
          ]
        },
        include: { title: true }
      })

      expect(lowStockItems).toHaveLength(2)
      expect(lowStockItems.map(item => item.title.title)).toContain('Low Stock Book')

      // Find items needing reorder
      const reorderItems = await testDb.inventory.findMany({
        where: {
          warehouseId: warehouse.id,
          currentStock: {
            lte: 20 // At or below threshold
          }
        },
        include: { title: true }
      })

      expect(reorderItems).toHaveLength(2) // Low Stock Book (5) and Medium Stock Book (15)
    })
  })

  describe('Inventory Updates', () => {
    test('should update stock levels for specific warehouse', async () => {
      const title = await createTestTitle({
        isbn: '9781111111122',
        title: 'Update Test Book'
      })

      const warehouse = await createTestWarehouse({
        name: 'Update Warehouse',
        code: 'UPD',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100,
        reservedStock: 10
      })

      // Update stock levels
      const updatedInventory = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          currentStock: 150,
          reservedStock: 25,
          lastMovementDate: new Date()
        }
      })

      expect(updatedInventory.currentStock).toBe(150)
      expect(updatedInventory.reservedStock).toBe(25)
      expect(updatedInventory.lastMovementDate).toBeDefined()
      expect(updatedInventory.updatedAt).not.toEqual(inventory.updatedAt)
    })

    test('should update cost basis and valuation', async () => {
      const title = await createTestTitle({
        isbn: '9781111111123',
        title: 'Cost Basis Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Cost Warehouse',
        code: 'CST',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100
      })

      // Update cost basis
      const updatedInventory = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          averageCost: 12.50,
          totalValue: 1250.00, // 100 * 12.50
          lastCostUpdate: new Date()
        }
      })

      expect(updatedInventory.averageCost?.toNumber()).toBe(12.50)
      expect(updatedInventory.totalValue?.toNumber()).toBe(1250.00)
      expect(updatedInventory.lastCostUpdate).toBeDefined()
    })

    test('should update location-specific attributes', async () => {
      const title = await createTestTitle({
        isbn: '9781111111124',
        title: 'Location Attributes Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Location Warehouse',
        code: 'LOC',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 100
      })

      // Update location-specific settings
      const updatedInventory = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          binLocation: 'Section-A-Shelf-15',
          minStockLevel: 25,
          maxStockLevel: 300,
          reorderPoint: 30
        }
      })

      expect(updatedInventory.binLocation).toBe('Section-A-Shelf-15')
      expect(updatedInventory.minStockLevel).toBe(25)
      expect(updatedInventory.maxStockLevel).toBe(300)
      expect(updatedInventory.reorderPoint).toBe(30)
    })
  })

  describe('Multi-Warehouse Business Logic', () => {
    test('should calculate available stock per warehouse', async () => {
      const title = await createTestTitle({
        isbn: '9781111111125',
        title: 'Available Stock Test'
      })

      const warehouses = await Promise.all([
        createTestWarehouse({ name: 'Warehouse 1', code: 'WH1', location: 'UK' }),
        createTestWarehouse({ name: 'Warehouse 2', code: 'WH2', location: 'US' })
      ])

      await Promise.all([
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouses[0].id,
          currentStock: 100,
          reservedStock: 20
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouses[1].id,
          currentStock: 80,
          reservedStock: 15
        })
      ])

      // Calculate available stock (current - reserved) for each warehouse
      const warehouseStock = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      const availableStockByWarehouse = warehouseStock.map(inv => ({
        warehouseCode: inv.warehouse.code,
        availableStock: inv.currentStock - inv.reservedStock
      }))

      expect(availableStockByWarehouse).toEqual(
        expect.arrayContaining([
          { warehouseCode: 'WH1', availableStock: 80 }, // 100 - 20
          { warehouseCode: 'WH2', availableStock: 65 }  // 80 - 15
        ])
      )
    })

    test('should identify warehouses below reorder point', async () => {
      const title = await createTestTitle({
        isbn: '9781111111126',
        title: 'Reorder Point Test'
      })

      const warehouses = await Promise.all([
        createTestWarehouse({ name: 'Low Stock WH', code: 'LSW', location: 'UK' }),
        createTestWarehouse({ name: 'Good Stock WH', code: 'GSW', location: 'US' })
      ])

      await Promise.all([
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouses[0].id,
          currentStock: 15,
          reorderPoint: 20
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouses[1].id,
          currentStock: 50,
          reorderPoint: 20
        })
      ])

      // Find warehouses below reorder point
      const needsReorder = await testDb.inventory.findMany({
        where: {
          titleId: title.id,
          currentStock: {
            lte: testDb.inventory.fields.reorderPoint
          }
        },
        include: { warehouse: true }
      })

      expect(needsReorder).toHaveLength(1)
      expect(needsReorder[0].warehouse.code).toBe('LSW')
      expect(needsReorder[0].currentStock).toBe(15)
      expect(needsReorder[0].reorderPoint).toBe(20)
    })

    test('should support channel-specific inventory allocation', async () => {
      const title = await createTestTitle({
        isbn: '9781111111127',
        title: 'Channel Allocation Test'
      })

      const turnaroundUK = await createTestWarehouse({
        name: 'Turnaround UK',
        code: 'TRN',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      const accUS = await createTestWarehouse({
        name: 'ACC US',
        code: 'ACC',
        location: 'US',
        fulfillsChannels: ['US_TRADE_SALES']
      })

      await Promise.all([
        createTestInventory({ titleId: title.id, warehouseId: turnaroundUK.id, currentStock: 100 }),
        createTestInventory({ titleId: title.id, warehouseId: accUS.id, currentStock: 75 })
      ])

      // Find warehouses that can fulfill UK trade orders
      const ukTradeWarehouses = await testDb.warehouse.findMany({
        where: {
          fulfillsChannels: {
            array_contains: 'UK_TRADE_SALES'
          },
          inventory: {
            some: {
              titleId: title.id,
              currentStock: {
                gt: 0
              }
            }
          }
        },
        include: {
          inventory: {
            where: { titleId: title.id }
          }
        }
      })

      expect(ukTradeWarehouses).toHaveLength(1)
      expect(ukTradeWarehouses[0].code).toBe('TRN')
      expect(ukTradeWarehouses[0].inventory[0].currentStock).toBe(100)
    })
  })

  describe('Inventory Deletion and Constraints', () => {
    test('should restrict deletion when foreign key constraints exist', async () => {
      const title = await createTestTitle({
        isbn: '9781111111128',
        title: 'Constraint Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Constraint Warehouse',
        code: 'CNS',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 50
      })

      // Should not be able to delete title when inventory exists (Restrict constraint)
      await expect(
        testDb.title.delete({
          where: { id: title.id }
        })
      ).rejects.toThrow()

      // Should not be able to delete warehouse when inventory exists (Restrict constraint)
      await expect(
        testDb.warehouse.delete({
          where: { id: warehouse.id }
        })
      ).rejects.toThrow()

      // Inventory should exist and be unaffected
      const stillExists = await testDb.inventory.findUnique({
        where: { id: inventory.id }
      })
      expect(stillExists).toBeDefined()
    })

    test('should allow deletion of inventory records directly', async () => {
      const title = await createTestTitle({
        isbn: '9781111111129',
        title: 'Deletion Test'
      })

      const warehouse = await createTestWarehouse({
        name: 'Deletion Warehouse',
        code: 'DEL',
        location: 'UK'
      })

      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse.id,
        currentStock: 25
      })

      // Should be able to delete inventory directly
      await testDb.inventory.delete({
        where: { id: inventory.id }
      })

      const deleted = await testDb.inventory.findUnique({
        where: { id: inventory.id }
      })
      expect(deleted).toBeNull()

      // Title and warehouse should still exist
      const titleExists = await testDb.title.findUnique({ where: { id: title.id } })
      const warehouseExists = await testDb.warehouse.findUnique({ where: { id: warehouse.id } })
      expect(titleExists).toBeDefined()
      expect(warehouseExists).toBeDefined()
    })
  })
})