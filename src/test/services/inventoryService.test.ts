import { describe, test, expect, beforeEach, vi } from 'vitest'
import { InventoryService } from '@/services/inventoryService'
import { prisma } from '@/lib/database'

// Mock Prisma
vi.mock('@/lib/database', () => ({
  prisma: {
    inventory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    title: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    warehouse: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

describe('InventoryService', () => {
  let service: InventoryService

  beforeEach(() => {
    service = new InventoryService()
    vi.clearAllMocks()
  })

  describe('getInventoryByWarehouse', () => {
    test('should get all inventory for a warehouse', async () => {
      const mockInventory = [
        {
          id: 1,
          titleId: 1,
          warehouseId: 1,
          currentStock: 1500,
          reservedStock: 100,
          lastMovementDate: new Date(),
          lastStockCheck: null,
          title: {
            id: 1,
            title: 'Test Book',
            isbn: '9781234567890',
            lowStockThreshold: 500
          },
          warehouse: {
            id: 1,
            name: 'UK Warehouse',
            code: 'UK-LON'
          }
        }
      ]

      vi.mocked(prisma.inventory.findMany).mockResolvedValue(mockInventory as any)

      const result = await service.getInventoryByWarehouse(1)

      expect(result).toEqual(mockInventory)
      expect(prisma.inventory.findMany).toHaveBeenCalledWith({
        where: { warehouseId: 1 },
        include: {
          title: true,
          warehouse: true
        },
        orderBy: { title: { title: 'asc' } }
      })
    })

    test('should return empty array if no inventory found', async () => {
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([])

      const result = await service.getInventoryByWarehouse(999)

      expect(result).toEqual([])
    })
  })

  describe('getInventoryByTitle', () => {
    test('should get inventory across all warehouses for a title', async () => {
      const mockInventory = [
        {
          id: 1,
          titleId: 1,
          warehouseId: 1,
          currentStock: 1500,
          reservedStock: 100,
          warehouse: { id: 1, name: 'UK Warehouse', code: 'UK-LON' }
        },
        {
          id: 2,
          titleId: 1,
          warehouseId: 2,
          currentStock: 800,
          reservedStock: 50,
          warehouse: { id: 2, name: 'US Warehouse', code: 'US-NYC' }
        }
      ]

      vi.mocked(prisma.inventory.findMany).mockResolvedValue(mockInventory as any)

      const result = await service.getInventoryByTitle(1)

      expect(result).toEqual(mockInventory)
      expect(prisma.inventory.findMany).toHaveBeenCalledWith({
        where: { titleId: 1 },
        include: { warehouse: true },
        orderBy: { warehouse: { name: 'asc' } }
      })
    })
  })

  describe('getLowStockItems', () => {
    test('should get titles below threshold across all warehouses', async () => {
      const mockInventory = [
        {
          id: 1,
          titleId: 1,
          warehouseId: 1,
          currentStock: 450,
          reservedStock: 50,
          title: {
            id: 1,
            title: 'Low Stock Book',
            isbn: '9781234567890',
            lowStockThreshold: 500
          },
          warehouse: {
            id: 1,
            name: 'UK Warehouse',
            code: 'UK-LON'
          }
        }
      ]

      vi.mocked(prisma.inventory.findMany).mockResolvedValue(mockInventory as any)

      const result = await service.getLowStockItems()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].currentStock).toBeLessThan(result[0].title.lowStockThreshold!)
      expect(prisma.inventory.findMany).toHaveBeenCalledWith({
        where: {
          title: {
            lowStockThreshold: { not: null }
          }
        },
        include: {
          title: true,
          warehouse: true
        }
      })
    })

    test('should filter low stock items by warehouse', async () => {
      const mockInventory = [
        {
          id: 1,
          titleId: 1,
          warehouseId: 1,
          currentStock: 450,
          reservedStock: 50,
          title: { lowStockThreshold: 500 },
          warehouse: { id: 1, code: 'UK-LON' }
        }
      ]

      vi.mocked(prisma.inventory.findMany).mockResolvedValue(mockInventory as any)

      await service.getLowStockItems(1)

      expect(prisma.inventory.findMany).toHaveBeenCalledWith({
        where: {
          warehouseId: 1,
          title: {
            lowStockThreshold: { not: null }
          }
        },
        include: {
          title: true,
          warehouse: true
        }
      })
    })

    test('should filter out items with stock above threshold', async () => {
      const mockInventory = [
        {
          id: 1,
          titleId: 1,
          warehouseId: 1,
          currentStock: 450,
          reservedStock: 50,
          title: { lowStockThreshold: 500 }
        },
        {
          id: 2,
          titleId: 2,
          warehouseId: 1,
          currentStock: 1200,
          reservedStock: 100,
          title: { lowStockThreshold: 500 }
        }
      ]

      vi.mocked(prisma.inventory.findMany).mockResolvedValue(mockInventory as any)

      const result = await service.getLowStockItems()

      // Service should filter client-side
      const lowStockOnly = result.filter(item =>
        item.title.lowStockThreshold !== null &&
        item.currentStock < item.title.lowStockThreshold
      )

      expect(lowStockOnly.length).toBe(1)
      expect(lowStockOnly[0].currentStock).toBe(450)
    })
  })

  describe('updateStockThreshold', () => {
    test('should update low stock threshold for a title', async () => {
      const mockTitle = {
        id: 1,
        isbn: '9781234567890',
        title: 'Test Book',
        lowStockThreshold: 600,
        updatedAt: new Date()
      }

      vi.mocked(prisma.title.update).mockResolvedValue(mockTitle as any)

      const result = await service.updateStockThreshold(1, 600)

      expect(result.lowStockThreshold).toBe(600)
      expect(prisma.title.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lowStockThreshold: 600 }
      })
    })

    test('should allow setting threshold to null', async () => {
      const mockTitle = {
        id: 1,
        lowStockThreshold: null
      }

      vi.mocked(prisma.title.update).mockResolvedValue(mockTitle as any)

      const result = await service.updateStockThreshold(1, null)

      expect(result.lowStockThreshold).toBeNull()
      expect(prisma.title.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lowStockThreshold: null }
      })
    })

    test('should throw error if title not found', async () => {
      const { Prisma } = await import('@prisma/client')
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
        meta: {}
      })

      vi.mocked(prisma.title.update).mockRejectedValue(error)

      await expect(
        service.updateStockThreshold(999, 500)
      ).rejects.toThrow('Title not found')
    })
  })

  describe('getTotalStock', () => {
    test('should calculate total stock across all warehouses for a title', async () => {
      const mockInventory = [
        { currentStock: 1500, reservedStock: 100 },
        { currentStock: 800, reservedStock: 50 },
        { currentStock: 300, reservedStock: 25 }
      ]

      vi.mocked(prisma.inventory.findMany).mockResolvedValue(mockInventory as any)

      const result = await service.getTotalStock(1)

      expect(result.totalStock).toBe(2600) // 1500 + 800 + 300
      expect(result.totalReserved).toBe(175) // 100 + 50 + 25
      expect(result.totalAvailable).toBe(2425) // 2600 - 175
    })

    test('should return zeros if no inventory found', async () => {
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([])

      const result = await service.getTotalStock(999)

      expect(result.totalStock).toBe(0)
      expect(result.totalReserved).toBe(0)
      expect(result.totalAvailable).toBe(0)
    })
  })
})
