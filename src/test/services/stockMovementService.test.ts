import { describe, test, expect, beforeEach, vi } from 'vitest'
import { StockMovementService } from '@/services/stockMovementService'
import { prisma } from '@/lib/database'
import { MovementType } from '@prisma/client'

// Mock Prisma
vi.mock('@/lib/database', () => ({
  prisma: {
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn()
    },
    inventory: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    title: {
      findUnique: vi.fn()
    },
    warehouse: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

describe('StockMovementService', () => {
  let service: StockMovementService

  beforeEach(() => {
    service = new StockMovementService()
    vi.clearAllMocks()
  })

  describe('recordMovement', () => {
    test('should record print received movement and update inventory', async () => {
      const movementData = {
        titleId: 1,
        warehouseId: 1,
        movementType: 'PRINT_RECEIVED' as MovementType,
        quantity: 3000,
        createdBy: 'user_123'
      }

      const mockMovement = {
        id: 1,
        ...movementData,
        movementDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const mockInventory = {
        id: 1,
        titleId: 1,
        warehouseId: 1,
        currentStock: 4500, // 1500 + 3000
        reservedStock: 0
      }

      // Mock validation
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({ id: 1 } as any)

      // Mock the transaction to execute callbacks
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma)
      })

      vi.mocked(prisma.stockMovement.create).mockResolvedValue(mockMovement as any)
      vi.mocked(prisma.inventory.upsert).mockResolvedValue(mockInventory as any)

      const result = await service.recordMovement(movementData)

      expect(result.movement.id).toBe(1)
      expect(result.inventoryUpdate.currentStock).toBe(4500)
    })

    test('should validate sufficient stock for outbound movements', async () => {
      const movementData = {
        titleId: 1,
        warehouseId: 1,
        movementType: 'UK_TRADE_SALES' as MovementType,
        quantity: 2000, // Trying to sell more than available
        createdBy: 'user_123'
      }

      // Mock validation
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({ id: 1 } as any)

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma)
      })

      vi.mocked(prisma.inventory.upsert).mockResolvedValue({
        id: 1,
        currentStock: -1500, // Result would be negative
        reservedStock: 0
      } as any)

      await expect(
        service.recordMovement(movementData)
      ).rejects.toThrow('Insufficient stock')
    })

    test('should handle warehouse transfers atomically', async () => {
      const transferData = {
        titleId: 1,
        sourceWarehouseId: 1,
        destinationWarehouseId: 2,
        movementType: 'WAREHOUSE_TRANSFER' as MovementType,
        quantity: 500,
        createdBy: 'user_123'
      }

      // Mock validation
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique)
        .mockResolvedValueOnce({ id: 1 } as any) // Source
        .mockResolvedValueOnce({ id: 2 } as any) // Destination

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma)
      })

      vi.mocked(prisma.stockMovement.create).mockResolvedValue({
        id: 1,
        ...transferData,
        warehouseId: 2, // Destination
        movementDate: new Date()
      } as any)

      // Source warehouse inventory
      vi.mocked(prisma.inventory.findUnique)
        .mockResolvedValueOnce({
          id: 1,
          titleId: 1,
          warehouseId: 1,
          currentStock: 1000,
          reservedStock: 0
        } as any)

      vi.mocked(prisma.inventory.update).mockResolvedValue({ currentStock: 500 } as any)
      vi.mocked(prisma.inventory.upsert).mockResolvedValue({ currentStock: 800 } as any)

      const result = await service.recordMovement(transferData)

      expect(result.movement).toBeDefined()
      expect(result.inventoryUpdate).toBeDefined()
    })

    test('should record stock adjustment and update lastStockCheck', async () => {
      const adjustmentData = {
        titleId: 1,
        warehouseId: 1,
        movementType: 'STOCK_ADJUSTMENT' as MovementType,
        quantity: -25, // Adjustment delta
        notes: 'Physical count correction',
        createdBy: 'user_123'
      }

      // Mock validation
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({ id: 1 } as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma)
      })

      vi.mocked(prisma.stockMovement.create).mockResolvedValue({
        id: 1,
        ...adjustmentData,
        movementDate: new Date()
      } as any)

      vi.mocked(prisma.inventory.upsert).mockResolvedValue({
        id: 1,
        currentStock: 975, // 1000 - 25
        lastStockCheck: new Date()
      } as any)

      const result = await service.recordMovement(adjustmentData)

      expect(result.inventoryUpdate.currentStock).toBe(975)
      expect(result.inventoryUpdate.lastStockCheck).toBeDefined()
    })

    test('should require notes for stock adjustments', async () => {
      const adjustmentData = {
        titleId: 1,
        warehouseId: 1,
        movementType: 'STOCK_ADJUSTMENT' as MovementType,
        quantity: -25,
        createdBy: 'user_123'
        // Missing notes
      }

      // Mock validation
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({ id: 1 } as any)

      await expect(
        service.recordMovement(adjustmentData as any)
      ).rejects.toThrow('Stock adjustments require notes')
    })

    test('should track createdBy for audit trail', async () => {
      const movementData = {
        titleId: 1,
        warehouseId: 1,
        movementType: 'PRINT_RECEIVED' as MovementType,
        quantity: 1000,
        createdBy: 'user_123'
      }

      // Mock validation
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({ id: 1 } as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma)
      })

      vi.mocked(prisma.stockMovement.create).mockResolvedValue({
        id: 1,
        ...movementData,
        movementDate: new Date()
      } as any)

      vi.mocked(prisma.inventory.upsert).mockResolvedValue({
        currentStock: 1000
      } as any)

      await service.recordMovement(movementData)

      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user_123'
          })
        })
      )
    })
  })

  describe('getMovementHistory', () => {
    test('should get movement history for a title', async () => {
      const mockMovements = [
        {
          id: 1,
          titleId: 1,
          warehouseId: 1,
          movementType: 'PRINT_RECEIVED',
          quantity: 3000,
          movementDate: new Date('2024-01-01')
        },
        {
          id: 2,
          titleId: 1,
          warehouseId: 1,
          movementType: 'UK_TRADE_SALES',
          quantity: -150,
          movementDate: new Date('2024-01-15')
        }
      ]

      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue(mockMovements as any)

      const result = await service.getMovementHistory({ titleId: 1 })

      expect(result.length).toBe(2)
      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: { titleId: 1 },
        include: {
          title: true,
          warehouse: true,
          creator: true
        },
        orderBy: { movementDate: 'desc' }
      })
    })

    test('should filter by warehouse', async () => {
      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])

      await service.getMovementHistory({ titleId: 1, warehouseId: 1 })

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: { titleId: 1, warehouseId: 1 },
        include: {
          title: true,
          warehouse: true,
          creator: true
        },
        orderBy: { movementDate: 'desc' }
      })
    })

    test('should filter by date range', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])

      await service.getMovementHistory({
        titleId: 1,
        startDate,
        endDate
      })

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: {
          titleId: 1,
          movementDate: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          title: true,
          warehouse: true,
          creator: true
        },
        orderBy: { movementDate: 'desc' }
      })
    })

    test('should filter by movement type', async () => {
      vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([])

      await service.getMovementHistory({
        titleId: 1,
        movementType: 'PRINT_RECEIVED' as MovementType
      })

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: {
          titleId: 1,
          movementType: 'PRINT_RECEIVED'
        },
        include: {
          title: true,
          warehouse: true,
          creator: true
        },
        orderBy: { movementDate: 'desc' }
      })
    })
  })

  describe('calculateInventoryImpact', () => {
    test('should calculate positive impact for inbound movements', () => {
      expect(service.calculateInventoryImpact('PRINT_RECEIVED', 1000)).toBe(1000)
      expect(service.calculateInventoryImpact('REPRINT', 2000)).toBe(2000)
    })

    test('should calculate negative impact for outbound movements', () => {
      expect(service.calculateInventoryImpact('UK_TRADE_SALES', 150)).toBe(-150)
      expect(service.calculateInventoryImpact('ONLINE_SALES', 50)).toBe(-50)
      expect(service.calculateInventoryImpact('DAMAGED', 10)).toBe(-10)
      expect(service.calculateInventoryImpact('PULPED', 25)).toBe(-25)
    })

    test('should handle warehouse transfers separately', () => {
      // Transfers require special handling with source/destination
      expect(service.calculateInventoryImpact('WAREHOUSE_TRANSFER', 500)).toBe(0)
    })

    test('should handle stock adjustments as delta', () => {
      expect(service.calculateInventoryImpact('STOCK_ADJUSTMENT', -25)).toBe(-25)
      expect(service.calculateInventoryImpact('STOCK_ADJUSTMENT', 75)).toBe(75)
    })
  })

  describe('validateMovement', () => {
    test('should validate title exists', async () => {
      vi.mocked(prisma.title.findUnique).mockResolvedValue(null)

      await expect(
        service.validateMovement({
          titleId: 999,
          warehouseId: 1,
          movementType: 'PRINT_RECEIVED' as MovementType,
          quantity: 1000
        })
      ).rejects.toThrow('Title not found')
    })

    test('should validate warehouse exists', async () => {
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue(null)

      await expect(
        service.validateMovement({
          titleId: 1,
          warehouseId: 999,
          movementType: 'PRINT_RECEIVED' as MovementType,
          quantity: 1000
        })
      ).rejects.toThrow('Warehouse not found')
    })

    test('should validate positive quantity', async () => {
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({ id: 1 } as any)

      await expect(
        service.validateMovement({
          titleId: 1,
          warehouseId: 1,
          movementType: 'PRINT_RECEIVED' as MovementType,
          quantity: -100 // Negative for inbound movement
        })
      ).rejects.toThrow('Quantity must be positive')
    })

    test('should validate transfer has both warehouses', async () => {
      vi.mocked(prisma.title.findUnique).mockResolvedValue({ id: 1 } as any)

      await expect(
        service.validateMovement({
          titleId: 1,
          warehouseId: 1,
          movementType: 'WAREHOUSE_TRANSFER' as MovementType,
          quantity: 500
          // Missing sourceWarehouseId and destinationWarehouseId
        })
      ).rejects.toThrow('Warehouse transfer requires source and destination warehouses')
    })
  })
})
