import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestSeries, createTestTitle, createTestWarehouse } from '../utils/test-db'

describe('Series Analytics and Completion Tracking', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Series Completion Tracking', () => {
    test('should calculate series completion percentage', async () => {
      const series = await createTestSeries({
        name: 'Test Completion Series'
      })

      // Create titles with different statuses
      const activeTitle = await createTestTitle({
        isbn: '9781111111111',
        title: 'Active Book',
        seriesId: series.id,
        status: 'ACTIVE'
      })

      const preOrderTitle = await createTestTitle({
        isbn: '9782222222222',
        title: 'Pre-order Book',
        seriesId: series.id,
        status: 'PRE_ORDER'
      })

      const discontinuedTitle = await createTestTitle({
        isbn: '9783333333333',
        title: 'Discontinued Book',
        seriesId: series.id,
        status: 'DISCONTINUED'
      })

      const seriesWithTitles = await testDb.series.findUnique({
        where: { id: series.id },
        include: {
          titles: true,
          _count: {
            select: {
              titles: {
                where: { status: 'ACTIVE' }
              }
            }
          }
        }
      })

      expect(seriesWithTitles?.titles).toHaveLength(3)
      expect(seriesWithTitles?._count.titles).toBe(1) // Only active titles
    })

    test('should track total titles per series', async () => {
      const series = await createTestSeries({ name: 'Count Test Series' })

      await createTestTitle({ isbn: '9781111111111', seriesId: series.id })
      await createTestTitle({ isbn: '9782222222222', seriesId: series.id })
      await createTestTitle({ isbn: '9783333333333', seriesId: series.id })

      const titleCount = await testDb.title.count({
        where: { seriesId: series.id }
      })

      expect(titleCount).toBe(3)
    })

    test('should calculate average series pricing', async () => {
      const series = await createTestSeries({ name: 'Pricing Series' })

      await createTestTitle({
        isbn: '9781111111111',
        seriesId: series.id,
        rrp: 15.99,
        unitCost: 8.00
      })

      await createTestTitle({
        isbn: '9782222222222',
        seriesId: series.id,
        rrp: 19.99,
        unitCost: 10.00
      })

      const seriesWithPricing = await testDb.title.aggregate({
        where: { seriesId: series.id },
        _avg: {
          rrp: true,
          unitCost: true
        },
        _count: true
      })

      expect(seriesWithPricing._avg.rrp).toBeCloseTo(17.99, 2)
      expect(seriesWithPricing._avg.unitCost).toBeCloseTo(9.00, 2)
      expect(seriesWithPricing._count).toBe(2)
    })
  })

  describe('Series Performance Analytics', () => {
    test('should track inventory levels across series', async () => {
      const warehouse = await createTestWarehouse({
        name: 'Test Warehouse',
        code: 'TW1'
      })

      const series = await createTestSeries({ name: 'Inventory Series' })

      const title1 = await createTestTitle({
        isbn: '9781111111111',
        seriesId: series.id
      })

      const title2 = await createTestTitle({
        isbn: '9782222222222',
        seriesId: series.id
      })

      // Create inventory for titles
      await testDb.inventory.create({
        data: {
          titleId: title1.id,
          warehouseId: warehouse.id,
          currentStock: 50,
          reservedStock: 5
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title2.id,
          warehouseId: warehouse.id,
          currentStock: 25,
          reservedStock: 2
        }
      })

      // Aggregate inventory across series
      const seriesInventory = await testDb.inventory.aggregate({
        where: {
          title: {
            seriesId: series.id
          }
        },
        _sum: {
          currentStock: true,
          reservedStock: true
        }
      })

      expect(seriesInventory._sum.currentStock).toBe(75)
      expect(seriesInventory._sum.reservedStock).toBe(7)
    })

    test('should calculate series sales velocity', async () => {
      const series = await createTestSeries({ name: 'Sales Velocity Series' })
      const warehouse = await createTestWarehouse({ name: 'Test Warehouse', code: 'TW1' })

      const title = await createTestTitle({
        isbn: '9781111111111',
        seriesId: series.id
      })

      // Create stock movements to simulate sales
      const movements = [
        { quantity: -10, movementDate: new Date('2024-01-01') },
        { quantity: -15, movementDate: new Date('2024-01-15') },
        { quantity: -8, movementDate: new Date('2024-02-01') }
      ]

      for (const movement of movements) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            movementType: 'ONLINE_SALES',
            quantity: movement.quantity,
            movementDate: movement.movementDate,
            referenceNumber: 'TEST-' + Math.random().toString(36).substr(2, 9)
          }
        })
      }

      const totalSales = await testDb.stockMovement.aggregate({
        where: {
          title: {
            seriesId: series.id
          },
          movementType: 'ONLINE_SALES'
        },
        _sum: {
          quantity: true
        }
      })

      expect(totalSales._sum.quantity).toBe(-33) // Total sales quantity (negative)
    })
  })

  describe('Series Hierarchy Analytics', () => {
    test('should aggregate metrics across series hierarchy', async () => {
      const parentSeries = await createTestSeries({
        name: 'Parent Analytics Series'
      })

      const childSeries1 = await testDb.series.create({
        data: {
          name: 'Child Series 1',
          parentId: parentSeries.id
        }
      })

      const childSeries2 = await testDb.series.create({
        data: {
          name: 'Child Series 2',
          parentId: parentSeries.id
        }
      })

      // Add titles to child series
      await createTestTitle({
        isbn: '9781111111111',
        seriesId: childSeries1.id,
        rrp: 15.99
      })

      await createTestTitle({
        isbn: '9782222222222',
        seriesId: childSeries1.id,
        rrp: 19.99
      })

      await createTestTitle({
        isbn: '9783333333333',
        seriesId: childSeries2.id,
        rrp: 12.99
      })

      // Get hierarchy metrics
      const hierarchyMetrics = await testDb.title.aggregate({
        where: {
          series: {
            OR: [
              { id: parentSeries.id },
              { parentId: parentSeries.id }
            ]
          }
        },
        _count: true,
        _avg: {
          rrp: true
        }
      })

      expect(hierarchyMetrics._count).toBe(3)
      expect(hierarchyMetrics._avg.rrp).toBeCloseTo(16.32, 2)
    })

    test('should track completion status across hierarchy levels', async () => {
      const parentSeries = await createTestSeries({ name: 'Hierarchy Parent' })

      const childSeries = await testDb.series.create({
        data: {
          name: 'Hierarchy Child',
          parentId: parentSeries.id
        }
      })

      // Add titles with different statuses
      await createTestTitle({
        isbn: '9781111111111',
        seriesId: childSeries.id,
        status: 'ACTIVE'
      })

      await createTestTitle({
        isbn: '9782222222222',
        seriesId: childSeries.id,
        status: 'DISCONTINUED'
      })

      const statusBreakdown = await testDb.title.groupBy({
        by: ['status'],
        where: {
          series: {
            parentId: parentSeries.id
          }
        },
        _count: {
          status: true
        }
      })

      expect(statusBreakdown).toHaveLength(2)

      const activeCount = statusBreakdown.find(s => s.status === 'ACTIVE')?._count.status
      const discontinuedCount = statusBreakdown.find(s => s.status === 'DISCONTINUED')?._count.status

      expect(activeCount).toBe(1)
      expect(discontinuedCount).toBe(1)
    })
  })
})