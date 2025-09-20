import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse } from '../utils/test-db'

describe('Multi-Warehouse Inventory Aggregation', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Inventory Aggregation Across Warehouses', () => {
    test('should calculate total stock across all warehouses', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const ukWarehouse = await createTestWarehouse({ code: 'UK1', name: 'UK Warehouse' })
      const usWarehouse = await createTestWarehouse({ code: 'US1', name: 'US Warehouse' })
      const euWarehouse = await createTestWarehouse({ code: 'EU1', name: 'EU Warehouse' })

      // Create inventory in multiple warehouses
      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: ukWarehouse.id,
          currentStock: 500,
          reservedStock: 25
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: usWarehouse.id,
          currentStock: 300,
          reservedStock: 15
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: euWarehouse.id,
          currentStock: 200,
          reservedStock: 10
        }
      })

      // Aggregate inventory across all warehouses
      const aggregatedInventory = await testDb.inventory.aggregate({
        where: { titleId: title.id },
        _sum: {
          currentStock: true,
          reservedStock: true
        }
      })

      expect(aggregatedInventory._sum.currentStock).toBe(1000) // 500 + 300 + 200
      expect(aggregatedInventory._sum.reservedStock).toBe(50)  // 25 + 15 + 10
    })

    test('should calculate available stock (current - reserved) per warehouse', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const ukWarehouse = await createTestWarehouse({ code: 'UK1' })
      const usWarehouse = await createTestWarehouse({ code: 'US1' })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: ukWarehouse.id,
          currentStock: 500,
          reservedStock: 75
        }
      })

      await testDb.inventory.create({
        data: {
          titleId: title.id,
          warehouseId: usWarehouse.id,
          currentStock: 300,
          reservedStock: 50
        }
      })

      const inventoryWithAvailable = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      const ukInventory = inventoryWithAvailable.find(inv => inv.warehouse.code === 'UK1')
      const usInventory = inventoryWithAvailable.find(inv => inv.warehouse.code === 'US1')

      const ukAvailable = ukInventory!.currentStock - ukInventory!.reservedStock
      const usAvailable = usInventory!.currentStock - usInventory!.reservedStock

      expect(ukAvailable).toBe(425) // 500 - 75
      expect(usAvailable).toBe(250) // 300 - 50

      const totalAvailable = ukAvailable + usAvailable
      expect(totalAvailable).toBe(675)
    })

    test('should group inventory by warehouse location', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      // Create warehouses in different locations
      const ukWarehouse1 = await createTestWarehouse({ code: 'UK1', location: 'UK', name: 'London Warehouse' })
      const ukWarehouse2 = await createTestWarehouse({ code: 'UK2', location: 'UK', name: 'Manchester Warehouse' })
      const usWarehouse = await createTestWarehouse({ code: 'US1', location: 'US', name: 'New York Warehouse' })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: ukWarehouse1.id, currentStock: 300, reservedStock: 15 }
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: ukWarehouse2.id, currentStock: 200, reservedStock: 10 }
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: usWarehouse.id, currentStock: 400, reservedStock: 20 }
      })

      // Group by location
      const inventoryByLocation = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      const ukTotal = inventoryByLocation
        .filter(inv => inv.warehouse.location === 'UK')
        .reduce((sum, inv) => sum + inv.currentStock, 0)

      const usTotal = inventoryByLocation
        .filter(inv => inv.warehouse.location === 'US')
        .reduce((sum, inv) => sum + inv.currentStock, 0)

      expect(ukTotal).toBe(500) // 300 + 200
      expect(usTotal).toBe(400)
    })
  })

  describe('Channel-Specific Inventory Allocation', () => {
    test('should track inventory by fulfillment channel', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const turnaroundWarehouse = await createTestWarehouse({
        code: 'TRN',
        name: 'Turnaround',
        location: 'UK',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      const accWarehouse = await createTestWarehouse({
        code: 'ACC',
        name: 'ACC',
        location: 'US',
        fulfillsChannels: ['US_TRADE_SALES']
      })

      const flostreamWarehouse = await createTestWarehouse({
        code: 'FLS',
        name: 'Flostream',
        location: 'UK',
        fulfillsChannels: ['ONLINE_SALES']
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: turnaroundWarehouse.id, currentStock: 600, reservedStock: 30 }
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: accWarehouse.id, currentStock: 400, reservedStock: 20 }
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: flostreamWarehouse.id, currentStock: 150, reservedStock: 10 }
      })

      // Calculate available inventory by channel
      const inventoryWithChannels = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      const channelInventory = inventoryWithChannels.reduce((acc, inv) => {
        const channels = inv.warehouse.fulfillsChannels as string[]
        const available = inv.currentStock - inv.reservedStock

        channels.forEach(channel => {
          acc[channel] = (acc[channel] || 0) + available
        })

        return acc
      }, {} as Record<string, number>)

      expect(channelInventory['UK_TRADE_SALES']).toBe(570) // Turnaround: 600 - 30
      expect(channelInventory['ROW_TRADE_SALES']).toBe(570) // Turnaround: 600 - 30
      expect(channelInventory['US_TRADE_SALES']).toBe(380) // ACC: 400 - 20
      expect(channelInventory['ONLINE_SALES']).toBe(140) // Flostream: 150 - 10
    })

    test('should identify potential allocation conflicts', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const turnaroundWarehouse = await createTestWarehouse({
        code: 'TRN',
        fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES']
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: turnaroundWarehouse.id, currentStock: 100, reservedStock: 25 }
      })

      // Simulate high reservation rate
      const available = 100 - 25 // 75 available
      const reservationRate = 25 / 100 // 25% reserved

      expect(available).toBe(75)
      expect(reservationRate).toBe(0.25)

      // Flag potential issues when reservation rate exceeds threshold
      const highReservationThreshold = 0.2 // 20%
      const needsAttention = reservationRate > highReservationThreshold

      expect(needsAttention).toBe(true)
    })
  })

  describe('Stock Movement Impact on Aggregation', () => {
    test('should reflect stock movements in inventory totals', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const ukWarehouse = await createTestWarehouse({ code: 'UK1' })
      const usWarehouse = await createTestWarehouse({ code: 'US1' })

      // Initial inventory
      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: ukWarehouse.id, currentStock: 1000, reservedStock: 0 }
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: usWarehouse.id, currentStock: 0, reservedStock: 0 }
      })

      const transferDate = new Date()

      // Record corresponding outbound movement from UK (first chronologically)
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: ukWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: -200,
          movementDate: transferDate,
          sourceWarehouseId: ukWarehouse.id,
          destinationWarehouseId: usWarehouse.id
        }
      })

      // Record inbound movement to US (second chronologically)
      await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: usWarehouse.id,
          movementType: 'WAREHOUSE_TRANSFER',
          quantity: 200,
          movementDate: new Date(transferDate.getTime() + 1000), // 1 second later
          sourceWarehouseId: ukWarehouse.id,
          destinationWarehouseId: usWarehouse.id
        }
      })

      // Simulate inventory update after transfer
      await testDb.inventory.update({
        where: { titleId_warehouseId: { titleId: title.id, warehouseId: ukWarehouse.id } },
        data: { currentStock: 800 }
      })

      await testDb.inventory.update({
        where: { titleId_warehouseId: { titleId: title.id, warehouseId: usWarehouse.id } },
        data: { currentStock: 200 }
      })

      // Verify total stock remains constant
      const totalStock = await testDb.inventory.aggregate({
        where: { titleId: title.id },
        _sum: { currentStock: true }
      })

      expect(totalStock._sum.currentStock).toBe(1000) // Total unchanged after transfer

      // Verify movement audit trail
      const movements = await testDb.stockMovement.findMany({
        where: { titleId: title.id },
        orderBy: { movementDate: 'asc' }
      })

      expect(movements).toHaveLength(2)
      expect(movements[0].quantity).toBe(-200) // Outbound from UK
      expect(movements[1].quantity).toBe(200)  // Inbound to US
    })

    test('should calculate stock velocity across warehouses', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })
      const ukWarehouse = await createTestWarehouse({ code: 'UK1' })

      const baseDate = new Date('2024-01-01')

      // Create sales movements over time
      const salesData = [
        { date: new Date('2024-01-01'), quantity: -50 },
        { date: new Date('2024-01-08'), quantity: -45 },
        { date: new Date('2024-01-15'), quantity: -60 },
        { date: new Date('2024-01-22'), quantity: -55 },
        { date: new Date('2024-01-29'), quantity: -40 }
      ]

      for (const sale of salesData) {
        await testDb.stockMovement.create({
          data: {
            titleId: title.id,
            warehouseId: ukWarehouse.id,
            movementType: 'UK_TRADE_SALES',
            quantity: sale.quantity,
            movementDate: sale.date,
            rrpAtTime: 29.99
          }
        })
      }

      // Calculate velocity metrics
      const movements = await testDb.stockMovement.findMany({
        where: {
          titleId: title.id,
          movementType: 'UK_TRADE_SALES',
          movementDate: {
            gte: baseDate,
            lte: new Date('2024-01-31')
          }
        }
      })

      const totalSold = movements.reduce((sum, mov) => sum + Math.abs(mov.quantity), 0)
      const weeklyAverage = totalSold / 5 // 5 weeks
      const dailyAverage = weeklyAverage / 7

      expect(totalSold).toBe(250) // 50 + 45 + 60 + 55 + 40
      expect(weeklyAverage).toBe(50)
      expect(dailyAverage).toBeCloseTo(7.14, 2)
    })
  })

  describe('Warehouse Performance Metrics', () => {
    test('should calculate fulfillment capacity by warehouse', async () => {
      const title = await createTestTitle({ isbn: '9781234567890' })

      const warehouses = [
        { code: 'UK1', capacity: 10000, currentUtilization: 0.7 },
        { code: 'US1', capacity: 15000, currentUtilization: 0.5 },
        { code: 'EU1', capacity: 8000, currentUtilization: 0.9 }
      ]

      for (const wh of warehouses) {
        const warehouse = await createTestWarehouse({ code: wh.code })
        const currentStock = Math.floor(wh.capacity * wh.currentUtilization)

        await testDb.inventory.create({
          data: {
            titleId: title.id,
            warehouseId: warehouse.id,
            currentStock,
            reservedStock: Math.floor(currentStock * 0.1) // 10% reserved
          }
        })
      }

      const warehouseMetrics = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      const metrics = warehouseMetrics.map(inv => {
        const wh = warehouses.find(w => w.code === inv.warehouse.code)!
        const available = inv.currentStock - inv.reservedStock
        const utilization = inv.currentStock / wh.capacity
        const availableCapacity = wh.capacity - inv.currentStock

        return {
          code: inv.warehouse.code,
          currentStock: inv.currentStock,
          available,
          utilization,
          availableCapacity
        }
      })

      const ukMetrics = metrics.find(m => m.code === 'UK1')!
      const usMetrics = metrics.find(m => m.code === 'US1')!
      const euMetrics = metrics.find(m => m.code === 'EU1')!

      expect(ukMetrics.currentStock).toBe(7000)
      expect(ukMetrics.available).toBe(6300) // 7000 - 700
      expect(ukMetrics.utilization).toBe(0.7)
      expect(ukMetrics.availableCapacity).toBe(3000)

      expect(usMetrics.currentStock).toBe(7500)
      expect(usMetrics.utilization).toBe(0.5)

      expect(euMetrics.utilization).toBe(0.9)
      expect(euMetrics.availableCapacity).toBe(800)
    })

    test('should identify reorder triggers across warehouses', async () => {
      const title = await createTestTitle({ isbn: '9781234567890', reprintThreshold: 500 })

      const ukWarehouse = await createTestWarehouse({ code: 'UK1' })
      const usWarehouse = await createTestWarehouse({ code: 'US1' })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: ukWarehouse.id, currentStock: 450, reservedStock: 50 } // 400 available
      })

      await testDb.inventory.create({
        data: { titleId: title.id, warehouseId: usWarehouse.id, currentStock: 600, reservedStock: 30 } // 570 available
      })

      const inventoryStatus = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true, title: true }
      })

      const reorderAlerts = inventoryStatus.map(inv => {
        const available = inv.currentStock - inv.reservedStock
        const needsReorder = available < inv.title.reprintThreshold!

        return {
          warehouse: inv.warehouse.code,
          available,
          threshold: inv.title.reprintThreshold,
          needsReorder
        }
      })

      const ukAlert = reorderAlerts.find(alert => alert.warehouse === 'UK1')!
      const usAlert = reorderAlerts.find(alert => alert.warehouse === 'US1')!

      expect(ukAlert.needsReorder).toBe(true)  // 400 < 500
      expect(usAlert.needsReorder).toBe(false) // 570 > 500
    })
  })
})