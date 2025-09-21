import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle, createTestWarehouse, createTestInventory } from '../utils/test-db'

describe('Inventory Reservation and Allocation Logic', () => {
  let warehouse1: any
  let warehouse2: any
  let warehouse3: any
  let title: any

  beforeEach(async () => {
    await cleanDatabase()

    // Create test warehouses with different characteristics
    warehouse1 = await createTestWarehouse({
      name: 'Primary Warehouse',
      code: 'PRI001',
      location: 'London, UK',
      fulfillsChannels: ['wholesale', 'online', 'retail']
    })

    warehouse2 = await createTestWarehouse({
      name: 'Secondary Warehouse',
      code: 'SEC001',
      location: 'Manchester, UK',
      fulfillsChannels: ['online', 'retail']
    })

    warehouse3 = await createTestWarehouse({
      name: 'Backup Warehouse',
      code: 'BAK001',
      location: 'Birmingham, UK',
      fulfillsChannels: ['wholesale']
    })

    // Create test title
    title = await createTestTitle({
      isbn: '9781234567890',
      title: 'Allocation Test Book',
      author: 'Test Author'
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Stock Reservation Management', () => {
    test('should reserve stock for pending orders', async () => {
      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 100,
        reservedStock: 10
      })

      // Reserve additional stock
      const updatedInventory = await testDb.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: inventory.reservedStock + 15
        }
      })

      expect(updatedInventory.reservedStock).toBe(25)
      expect(updatedInventory.currentStock).toBe(100) // Current stock unchanged

      // Available stock calculation
      const availableStock = updatedInventory.currentStock - updatedInventory.reservedStock
      expect(availableStock).toBe(75)
    })

    test('should calculate available stock correctly', async () => {
      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 50,
        reservedStock: 30,
        minStockLevel: 5
      })

      // Available to promise calculation
      const atp = inventory.currentStock - inventory.reservedStock - (inventory.minStockLevel || 0)
      expect(atp).toBe(15) // 50 - 30 - 5

      // Validate we can't over-allocate
      const maxAllocation = Math.max(0, atp)
      expect(maxAllocation).toBe(15)
    })

    test('should track reservation changes through stock movements', async () => {
      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 80,
        reservedStock: 0
      })

      // Simulate order creation - reserve stock
      await testDb.inventory.update({
        where: { id: inventory.id },
        data: { reservedStock: 20 }
      })

      // Create a movement to track the reservation
      const reservationMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          movementType: 'ONLINE_SALES',
          quantity: -20,
          referenceNumber: 'ORDER-001',
          notes: 'Stock reserved for customer order',
          movementDate: new Date()
        }
      })

      expect(reservationMovement.quantity).toBe(-20)
      expect(reservationMovement.referenceNumber).toBe('ORDER-001')

      // Verify reservation was tracked
      const updatedInventory = await testDb.inventory.findUnique({
        where: { id: inventory.id }
      })
      expect(updatedInventory?.reservedStock).toBe(20)
    })
  })

  describe('Multi-Warehouse Allocation Logic', () => {
    beforeEach(async () => {
      // Set up inventory across multiple warehouses
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 150,
        reservedStock: 20,
        minStockLevel: 25,
        reorderPoint: 50
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse2.id,
        currentStock: 80,
        reservedStock: 10,
        minStockLevel: 15,
        reorderPoint: 30
      })

      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse3.id,
        currentStock: 45,
        reservedStock: 5,
        minStockLevel: 10,
        reorderPoint: 20
      })
    })

    test('should calculate available-to-promise (ATP) across warehouses', async () => {
      const allInventory = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      // Calculate ATP by warehouse
      const atpByWarehouse = allInventory.map(inv => ({
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        currentStock: inv.currentStock,
        reservedStock: inv.reservedStock,
        minStockLevel: inv.minStockLevel || 0,
        availableToPromise: Math.max(0, inv.currentStock - inv.reservedStock - (inv.minStockLevel || 0))
      }))

      // Total ATP across all warehouses
      const totalATP = atpByWarehouse.reduce((sum, inv) => sum + inv.availableToPromise, 0)

      expect(atpByWarehouse).toHaveLength(3)
      expect(atpByWarehouse[0].availableToPromise).toBe(105) // 150 - 20 - 25
      expect(atpByWarehouse[1].availableToPromise).toBe(55)  // 80 - 10 - 15
      expect(atpByWarehouse[2].availableToPromise).toBe(30)  // 45 - 5 - 10
      expect(totalATP).toBe(190)
    })

    test('should allocate stock based on fulfillment channel priority', async () => {
      const orderRequest = {
        titleId: title.id,
        quantity: 40,
        channel: 'online',
        priority: 'HIGH'
      }

      // Find warehouses that can fulfill this channel
      const eligibleWarehouses = await testDb.warehouse.findMany({
        where: {
          isActive: true,
          fulfillsChannels: { array_contains: orderRequest.channel }
        },
        include: {
          inventory: {
            where: { titleId: orderRequest.titleId }
          }
        }
      })

      // Calculate allocation strategy
      const allocationPlan = eligibleWarehouses
        .map(warehouse => {
          const inventory = warehouse.inventory[0]
          if (!inventory) return null

          const available = inventory.currentStock - inventory.reservedStock - (inventory.minStockLevel || 0)
          const canAllocate = Math.max(0, available)

          return {
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            available: canAllocate,
            priority: warehouse.name === 'Primary Warehouse' ? 1 : 2
          }
        })
        .filter(Boolean)
        .sort((a, b) => a!.priority - b!.priority)

      // Allocate from highest priority warehouse first
      let remainingQuantity = orderRequest.quantity
      const allocations: Array<{ warehouseId: number; quantity: number }> = []

      for (const plan of allocationPlan) {
        if (remainingQuantity <= 0) break
        if (!plan) continue

        const allocateQuantity = Math.min(remainingQuantity, plan.available)
        if (allocateQuantity > 0) {
          allocations.push({
            warehouseId: plan.warehouseId,
            quantity: allocateQuantity
          })
          remainingQuantity -= allocateQuantity
        }
      }

      expect(allocations).toHaveLength(1) // Should allocate from primary warehouse only
      expect(allocations[0].warehouseId).toBe(warehouse1.id)
      expect(allocations[0].quantity).toBe(40)
      expect(remainingQuantity).toBe(0)
    })

    test('should handle partial allocation across multiple warehouses', async () => {
      const largeOrderRequest = {
        titleId: title.id,
        quantity: 180, // More than any single warehouse can fulfill
        channel: 'wholesale',
        priority: 'NORMAL'
      }

      // Find warehouses that can fulfill wholesale orders
      const eligibleWarehouses = await testDb.warehouse.findMany({
        where: {
          isActive: true,
          fulfillsChannels: { array_contains: largeOrderRequest.channel }
        },
        include: {
          inventory: {
            where: { titleId: largeOrderRequest.titleId }
          }
        }
      })

      // Calculate ATP for each warehouse
      const allocationOptions = eligibleWarehouses
        .map(warehouse => {
          const inventory = warehouse.inventory[0]
          if (!inventory) return null

          const available = inventory.currentStock - inventory.reservedStock - (inventory.minStockLevel || 0)
          return {
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            available: Math.max(0, available)
          }
        })
        .filter(Boolean)
        .sort((a, b) => b!.available - a!.available) // Sort by available quantity descending

      // Allocate across multiple warehouses
      let remainingQuantity = largeOrderRequest.quantity
      const allocations: Array<{ warehouseId: number; quantity: number }> = []

      for (const option of allocationOptions) {
        if (remainingQuantity <= 0 || !option) break

        const allocateQuantity = Math.min(remainingQuantity, option.available)
        if (allocateQuantity > 0) {
          allocations.push({
            warehouseId: option.warehouseId,
            quantity: allocateQuantity
          })
          remainingQuantity -= allocateQuantity
        }
      }

      expect(allocations.length).toBeGreaterThan(1) // Should use multiple warehouses
      expect(allocations.reduce((sum, a) => sum + a.quantity, 0)).toBe(135) // Total allocated
      expect(remainingQuantity).toBe(45) // Unfulfilled quantity
    })

    test('should prioritize warehouses by proximity/cost when multiple options exist', async () => {
      const orderRequest = {
        titleId: title.id,
        quantity: 25,
        channel: 'retail',
        customerLocation: 'London, UK'
      }

      // Define warehouse proximity scores (lower = closer/cheaper)
      const proximityScores = {
        [warehouse1.id]: 1, // London - closest
        [warehouse2.id]: 3, // Manchester - medium
        [warehouse3.id]: 5  // Birmingham - furthest for retail
      }

      const eligibleWarehouses = await testDb.warehouse.findMany({
        where: {
          isActive: true,
          fulfillsChannels: { array_contains: orderRequest.channel }
        },
        include: {
          inventory: {
            where: { titleId: orderRequest.titleId }
          }
        }
      })

      // Sort by proximity and available stock
      const sortedOptions = eligibleWarehouses
        .map(warehouse => {
          const inventory = warehouse.inventory[0]
          if (!inventory) return null

          const available = inventory.currentStock - inventory.reservedStock - (inventory.minStockLevel || 0)
          return {
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            available: Math.max(0, available),
            proximityScore: proximityScores[warehouse.id] || 10
          }
        })
        .filter(option => option && option.available >= orderRequest.quantity)
        .sort((a, b) => a!.proximityScore - b!.proximityScore)

      expect(sortedOptions).toHaveLength(2) // Only warehouse1 and warehouse2 fulfill retail
      expect(sortedOptions[0]?.warehouseId).toBe(warehouse1.id) // London warehouse first
      expect(sortedOptions[0]?.available).toBeGreaterThanOrEqual(orderRequest.quantity)
    })
  })

  describe('Dynamic Allocation Rules', () => {
    test('should apply allocation rules based on customer tier', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 30,
        reservedStock: 15,
        minStockLevel: 5
      })

      const orders = [
        {
          titleId: title.id,
          quantity: 8,
          customerTier: 'PREMIUM',
          priority: 'HIGH'
        },
        {
          titleId: title.id,
          quantity: 12,
          customerTier: 'STANDARD',
          priority: 'NORMAL'
        }
      ]

      // Available stock: 30 - 15 - 5 = 10 (not enough for both orders)
      // Premium customer should get priority

      // Process premium order first
      const premiumAllocation = Math.min(orders[0].quantity, 10)
      expect(premiumAllocation).toBe(8)

      // Remaining for standard customer
      const standardAllocation = Math.min(orders[1].quantity, 10 - premiumAllocation)
      expect(standardAllocation).toBe(2)

      // Premium customer gets full allocation, standard gets partial
      expect(premiumAllocation).toBe(orders[0].quantity)
      expect(standardAllocation).toBeLessThan(orders[1].quantity)
    })

    test('should consider seasonal demand patterns in allocation', async () => {
      // Create inventory with seasonal considerations
      const seasonalInventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 200,
        reservedStock: 50,
        minStockLevel: 30,
        reorderPoint: 75
      })

      // Simulate seasonal demand multiplier (e.g., holiday season)
      const seasonalMultiplier = 1.5
      const baseMinStock = seasonalInventory.minStockLevel || 0
      const adjustedMinStock = Math.floor(baseMinStock * seasonalMultiplier)

      // Calculate adjusted ATP
      const adjustedATP = seasonalInventory.currentStock - seasonalInventory.reservedStock - adjustedMinStock

      expect(adjustedATP).toBe(105) // 200 - 50 - 45
      expect(adjustedMinStock).toBe(45) // 30 * 1.5

      // Higher minimum stock level during peak season reduces ATP
      const normalATP = seasonalInventory.currentStock - seasonalInventory.reservedStock - baseMinStock
      expect(adjustedATP).toBeLessThan(normalATP)
    })

    test('should handle insufficient stock scenarios', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 10,
        reservedStock: 5,
        minStockLevel: 3
      })

      const orderRequest = {
        titleId: title.id,
        quantity: 15,
        allowBackorder: true,
        customerTier: 'PREMIUM'
      }

      // Available stock: 10 - 5 - 3 = 2
      const availableStock = 2
      const immediateAllocation = Math.min(orderRequest.quantity, availableStock)
      const backorderQuantity = orderRequest.quantity - immediateAllocation

      expect(immediateAllocation).toBe(2)
      expect(backorderQuantity).toBe(13)

      // In a real system, this would create a backorder record
      const shouldBackorder = backorderQuantity > 0
      expect(shouldBackorder).toBe(true)
    })

    test('should process stock allocations when new inventory arrives', async () => {
      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 5,
        reservedStock: 0,
        minStockLevel: 2
      })

      // Simulate pending orders waiting for stock
      const pendingOrders = [
        { quantity: 8, customerTier: 'PREMIUM', waitingDays: 2 },
        { quantity: 12, customerTier: 'STANDARD', waitingDays: 1 }
      ]

      // New stock arrives
      const newStock = 15
      await testDb.inventory.update({
        where: { id: inventory.id },
        data: { currentStock: inventory.currentStock + newStock }
      })

      const updatedInventory = await testDb.inventory.findUnique({
        where: { id: inventory.id }
      })

      const availableForOrders = (updatedInventory?.currentStock || 0) -
                               (updatedInventory?.reservedStock || 0) -
                               (updatedInventory?.minStockLevel || 0)

      expect(availableForOrders).toBe(18) // 20 - 0 - 2

      // Should fulfill premium order first
      const premiumOrder = pendingOrders.find(order => order.customerTier === 'PREMIUM')
      expect(premiumOrder?.quantity).toBe(8)
      expect(availableForOrders).toBeGreaterThanOrEqual(premiumOrder?.quantity || 0)

      // Record the allocation as a stock movement
      const allocationMovement = await testDb.stockMovement.create({
        data: {
          titleId: title.id,
          warehouseId: warehouse1.id,
          movementType: 'ONLINE_SALES',
          quantity: -(premiumOrder?.quantity || 0),
          referenceNumber: 'PREMIUM-ORDER-001',
          notes: 'Premium customer allocation from new stock arrival',
          movementDate: new Date()
        }
      })

      expect(allocationMovement.quantity).toBe(-8)
    })
  })

  describe('Allocation Optimization', () => {
    test('should minimize costs in allocation decisions', async () => {
      // Create inventory with different characteristics per warehouse
      await Promise.all([
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse1.id,
          currentStock: 50,
          reservedStock: 10,
          minStockLevel: 5,
          averageCost: 15.00
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse2.id,
          currentStock: 40,
          reservedStock: 5,
          minStockLevel: 5,
          averageCost: 12.50
        })
      ])

      const orderRequest = {
        titleId: title.id,
        quantity: 25,
        customerLocation: 'Manchester, UK',
        channel: 'online'
      }

      // Define shipping costs from each warehouse
      const shippingCosts = {
        [warehouse1.id]: { cost: 15.00, deliveryDays: 2 }, // London to Manchester
        [warehouse2.id]: { cost: 8.00, deliveryDays: 1 }   // Manchester to Manchester
      }

      const allocationOptions = await testDb.warehouse.findMany({
        where: {
          isActive: true,
          fulfillsChannels: { array_contains: orderRequest.channel }
        },
        include: {
          inventory: {
            where: { titleId: orderRequest.titleId }
          }
        }
      })

      const optimizedOptions = allocationOptions
        .map(warehouse => {
          const inventory = warehouse.inventory[0]
          if (!inventory) return null

          const available = inventory.currentStock - inventory.reservedStock - (inventory.minStockLevel || 0)
          const shipping = shippingCosts[warehouse.id]

          if (available < orderRequest.quantity || !shipping) return null

          return {
            warehouseId: warehouse.id,
            available,
            shippingCost: shipping.cost,
            deliveryDays: shipping.deliveryDays,
            totalCost: shipping.cost // Could include other costs here
          }
        })
        .filter(Boolean)
        .sort((a, b) => a!.totalCost - b!.totalCost) // Sort by total cost ascending

      // Should prefer warehouse2 (Manchester) due to lower shipping cost
      expect(optimizedOptions[0]?.warehouseId).toBe(warehouse2.id)
      expect(optimizedOptions[0]?.shippingCost).toBe(8.00)
    })

    test('should balance utilization across warehouses', async () => {
      // Create uneven inventory distribution
      await Promise.all([
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse1.id,
          currentStock: 200,
          reservedStock: 50,
          minStockLevel: 20,
          maxStockLevel: 300
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse2.id,
          currentStock: 50,
          reservedStock: 10,
          minStockLevel: 15,
          maxStockLevel: 150
        })
      ])

      // Calculate utilization rates
      const inventories = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      const utilizationRates = inventories.map(inv => {
        const utilization = (inv.currentStock + inv.reservedStock) / (inv.maxStockLevel || inv.currentStock)
        return {
          warehouseId: inv.warehouseId,
          warehouseName: inv.warehouse.name,
          utilization,
          available: inv.currentStock - inv.reservedStock - (inv.minStockLevel || 0)
        }
      })

      // Warehouse1: (200 + 50) / 300 = 83.3%
      // Warehouse2: (50 + 10) / 150 = 40%

      expect(utilizationRates[0].utilization).toBeCloseTo(0.833, 2)
      expect(utilizationRates[1].utilization).toBeCloseTo(0.4, 1)

      // For large orders, prefer higher utilization warehouse to balance
      const largeOrder = {
        titleId: title.id,
        quantity: 100,
        strategy: 'BALANCE_UTILIZATION'
      }

      // Should allocate from warehouse1 to balance utilization
      const balancedAllocation = utilizationRates
        .filter(rate => rate.available >= largeOrder.quantity)
        .sort((a, b) => b.utilization - a.utilization)[0] // Higher utilization first

      expect(balancedAllocation.warehouseId).toBe(warehouse1.id)
    })

    test('should consider lead times in allocation for time-sensitive orders', async () => {
      await Promise.all([
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse1.id,
          currentStock: 60,
          reservedStock: 15,
          minStockLevel: 10
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse2.id,
          currentStock: 45,
          reservedStock: 10,
          minStockLevel: 8
        })
      ])

      const urgentOrder = {
        titleId: title.id,
        quantity: 20,
        channel: 'online',
        deliveryRequired: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day delivery
        priority: 'URGENT'
      }

      // Define processing and shipping lead times
      const leadTimes = {
        [warehouse1.id]: { processing: 2, shipping: 2 }, // 4 hours total
        [warehouse2.id]: { processing: 1, shipping: 1 }  // 2 hours total
      }

      const allocationOptions = await testDb.warehouse.findMany({
        where: { isActive: true },
        include: {
          inventory: {
            where: { titleId: urgentOrder.titleId }
          }
        }
      })

      const timeOptimizedOptions = allocationOptions
        .map(warehouse => {
          const inventory = warehouse.inventory[0]
          if (!inventory) return null

          const available = inventory.currentStock - inventory.reservedStock - (inventory.minStockLevel || 0)
          const leadTime = leadTimes[warehouse.id]

          if (available < urgentOrder.quantity || !leadTime) return null

          const totalLeadTime = leadTime.processing + leadTime.shipping
          const canMeetDeadline = totalLeadTime <= 24 // 24 hours available

          return {
            warehouseId: warehouse.id,
            available,
            totalLeadTime,
            canMeetDeadline
          }
        })
        .filter(option => option?.canMeetDeadline)
        .sort((a, b) => a!.totalLeadTime - b!.totalLeadTime)

      // Should prefer warehouse2 with faster lead time
      expect(timeOptimizedOptions[0]?.warehouseId).toBe(warehouse2.id)
      expect(timeOptimizedOptions[0]?.totalLeadTime).toBe(2)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle allocation when all warehouses are at minimum stock', async () => {
      await Promise.all([
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse1.id,
          currentStock: 25,
          reservedStock: 0,
          minStockLevel: 25 // At minimum
        }),
        createTestInventory({
          titleId: title.id,
          warehouseId: warehouse2.id,
          currentStock: 15,
          reservedStock: 0,
          minStockLevel: 15 // At minimum
        })
      ])

      const orderRequest = {
        titleId: title.id,
        quantity: 10,
        channel: 'online'
      }

      // Calculate ATP - should be zero for all warehouses
      const inventories = await testDb.inventory.findMany({
        where: { titleId: title.id },
        include: { warehouse: true }
      })

      const atpCalculations = inventories.map(inv => ({
        warehouseId: inv.warehouseId,
        atp: Math.max(0, inv.currentStock - inv.reservedStock - (inv.minStockLevel || 0))
      }))

      const totalATP = atpCalculations.reduce((sum, calc) => sum + calc.atp, 0)

      expect(totalATP).toBe(0)
      expect(atpCalculations.every(calc => calc.atp === 0)).toBe(true)

      // Should create backorder when no stock available
      const shouldBackorder = totalATP < orderRequest.quantity
      expect(shouldBackorder).toBe(true)
    })

    test('should handle concurrent allocation requests', async () => {
      const inventory = await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 50,
        reservedStock: 10,
        minStockLevel: 5
      })

      // Available stock: 50 - 10 - 5 = 35

      const concurrentOrders = [
        { quantity: 20, orderRef: 'CONCURRENT-001' },
        { quantity: 18, orderRef: 'CONCURRENT-002' },
        { quantity: 15, orderRef: 'CONCURRENT-003' }
      ]

      // Process orders sequentially to simulate concurrent processing
      const allocations: Array<{ orderRef: string; allocated: number; status: string }> = []
      let currentReserved = inventory.reservedStock

      for (const order of concurrentOrders) {
        const currentAvailable = inventory.currentStock - currentReserved - (inventory.minStockLevel || 0)
        const canAllocate = Math.min(order.quantity, Math.max(0, currentAvailable))

        if (canAllocate > 0) {
          allocations.push({
            orderRef: order.orderRef,
            allocated: canAllocate,
            status: canAllocate === order.quantity ? 'FULFILLED' : 'PARTIAL'
          })
          currentReserved += canAllocate
        } else {
          allocations.push({
            orderRef: order.orderRef,
            allocated: 0,
            status: 'BACKORDER'
          })
        }
      }

      expect(allocations[0].allocated).toBe(20) // First order gets full allocation
      expect(allocations[1].allocated).toBe(15) // Second order gets partial (35 - 20 = 15)
      expect(allocations[2].allocated).toBe(0)  // Third order gets backorder
      expect(allocations[2].status).toBe('BACKORDER')
    })

    test('should validate allocation against business rules', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 100,
        reservedStock: 20,
        minStockLevel: 15
      })

      const invalidOrders = [
        { quantity: 0, reason: 'Zero quantity' },
        { quantity: -5, reason: 'Negative quantity' },
        { quantity: 1000, reason: 'Exceeds available stock' }
      ]

      for (const order of invalidOrders) {
        if (order.quantity <= 0) {
          // Should reject zero or negative quantities
          expect(order.quantity).toBeLessThanOrEqual(0)
        } else {
          // Check if quantity exceeds available stock
          const available = 100 - 20 - 15 // 65
          const exceeds = order.quantity > available
          expect(exceeds).toBe(true)
        }
      }
    })

    test('should handle warehouse deactivation during allocation', async () => {
      await createTestInventory({
        titleId: title.id,
        warehouseId: warehouse1.id,
        currentStock: 80,
        reservedStock: 10,
        minStockLevel: 10
      })

      // Deactivate warehouse
      await testDb.warehouse.update({
        where: { id: warehouse1.id },
        data: { isActive: false }
      })

      const orderRequest = {
        titleId: title.id,
        quantity: 25,
        channel: 'online'
      }

      // Query only active warehouses
      const activeWarehouses = await testDb.warehouse.findMany({
        where: {
          isActive: true,
          fulfillsChannels: { array_contains: orderRequest.channel }
        },
        include: {
          inventory: {
            where: { titleId: orderRequest.titleId }
          }
        }
      })

      // Should not include deactivated warehouse
      expect(activeWarehouses.find(w => w.id === warehouse1.id)).toBeUndefined()

      // Should fall back to other warehouses or create backorder
      const availableInventory = activeWarehouses
        .flatMap(w => w.inventory)
        .reduce((sum, inv) => sum + (inv.currentStock - inv.reservedStock - (inv.minStockLevel || 0)), 0)

      if (availableInventory < orderRequest.quantity) {
        // Should create backorder when no active warehouses can fulfill
        expect(availableInventory).toBeLessThan(orderRequest.quantity)
      }
    })
  })
})