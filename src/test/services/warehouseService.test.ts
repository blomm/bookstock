import { describe, test, expect, beforeEach, vi } from 'vitest'
import { WarehouseService } from '@/services/warehouseService'
import { prisma } from '@/lib/database'

// Mock Prisma
vi.mock('@/lib/database', () => ({
  prisma: {
    warehouse: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    }
  }
}))

describe('WarehouseService', () => {
  let service: WarehouseService

  beforeEach(() => {
    service = new WarehouseService()
    vi.clearAllMocks()
  })

  describe('create', () => {
    test('should create warehouse with valid data', async () => {
      const mockWarehouse = {
        id: 1,
        name: 'UK Warehouse',
        code: 'UK-LON',
        type: 'PHYSICAL',
        status: 'ACTIVE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(prisma.warehouse.create).mockResolvedValue(mockWarehouse as any)

      const result = await service.create({
        name: 'UK Warehouse',
        code: 'UK-LON'
      })

      expect(result).toEqual(mockWarehouse)
      expect(prisma.warehouse.create).toHaveBeenCalledWith({
        data: {
          name: 'UK Warehouse',
          code: 'UK-LON'
        }
      })
    })

    test('should throw error on duplicate code', async () => {
      const { Prisma } = await import('@prisma/client')
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['code'] }
      })

      vi.mocked(prisma.warehouse.create).mockRejectedValue(error)

      await expect(
        service.create({ name: 'Test', code: 'DUP' })
      ).rejects.toThrow('Warehouse with code DUP already exists')
    })

    test('should create warehouse with all fields', async () => {
      const input = {
        name: 'UK Warehouse - London',
        code: 'UK-LON',
        type: 'PHYSICAL' as const,
        status: 'ACTIVE' as const,
        addressLine1: '123 Street',
        city: 'London',
        country: 'GB',
        contactEmail: 'test@example.com'
      }

      vi.mocked(prisma.warehouse.create).mockResolvedValue({
        id: 1,
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      await service.create(input)

      expect(prisma.warehouse.create).toHaveBeenCalledWith({
        data: input
      })
    })
  })

  describe('findById', () => {
    test('should find warehouse by id', async () => {
      const mockWarehouse = {
        id: 1,
        name: 'Test Warehouse',
        code: 'TST'
      }

      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue(mockWarehouse as any)

      const result = await service.findById(1)

      expect(result).toEqual(mockWarehouse)
      expect(prisma.warehouse.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      })
    })

    test('should return null if warehouse not found', async () => {
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue(null)

      const result = await service.findById(999)

      expect(result).toBeNull()
    })
  })

  describe('findByCode', () => {
    test('should find warehouse by code', async () => {
      const mockWarehouse = {
        id: 1,
        name: 'UK Warehouse',
        code: 'UK-LON'
      }

      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue(mockWarehouse as any)

      const result = await service.findByCode('UK-LON')

      expect(result).toEqual(mockWarehouse)
      expect(prisma.warehouse.findUnique).toHaveBeenCalledWith({
        where: { code: 'UK-LON' }
      })
    })
  })

  describe('list', () => {
    test('should list warehouses with default pagination', async () => {
      const mockWarehouses = [
        { id: 1, name: 'WH1', code: 'WH1' },
        { id: 2, name: 'WH2', code: 'WH2' }
      ]

      vi.mocked(prisma.warehouse.findMany).mockResolvedValue(mockWarehouses as any)
      vi.mocked(prisma.warehouse.count).mockResolvedValue(2)

      const result = await service.list()

      expect(result.warehouses).toEqual(mockWarehouses)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.totalPages).toBe(1)
    })

    test('should filter by status', async () => {
      vi.mocked(prisma.warehouse.findMany).mockResolvedValue([])
      vi.mocked(prisma.warehouse.count).mockResolvedValue(0)

      await service.list({ status: 'ACTIVE' })

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' }
        })
      )
    })

    test('should filter by type', async () => {
      vi.mocked(prisma.warehouse.findMany).mockResolvedValue([])
      vi.mocked(prisma.warehouse.count).mockResolvedValue(0)

      await service.list({ type: 'VIRTUAL' })

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'VIRTUAL' }
        })
      )
    })

    test('should filter by isActive', async () => {
      vi.mocked(prisma.warehouse.findMany).mockResolvedValue([])
      vi.mocked(prisma.warehouse.count).mockResolvedValue(0)

      await service.list({ isActive: true })

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true }
        })
      )
    })

    test('should search across name, code, city, and country', async () => {
      vi.mocked(prisma.warehouse.findMany).mockResolvedValue([])
      vi.mocked(prisma.warehouse.count).mockResolvedValue(0)

      await service.list({ search: 'london' })

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'london', mode: 'insensitive' } },
              { code: { contains: 'london', mode: 'insensitive' } },
              { city: { contains: 'london', mode: 'insensitive' } },
              { country: { contains: 'london', mode: 'insensitive' } }
            ]
          }
        })
      )
    })

    test('should handle pagination correctly', async () => {
      vi.mocked(prisma.warehouse.findMany).mockResolvedValue([])
      vi.mocked(prisma.warehouse.count).mockResolvedValue(100)

      await service.list({ page: 3, limit: 10 })

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10
        })
      )
    })

    test('should calculate total pages correctly', async () => {
      vi.mocked(prisma.warehouse.findMany).mockResolvedValue([])
      vi.mocked(prisma.warehouse.count).mockResolvedValue(25)

      const result = await service.list({ limit: 10 })

      expect(result.totalPages).toBe(3) // Math.ceil(25/10)
    })
  })

  describe('update', () => {
    test('should update warehouse fields', async () => {
      const mockUpdated = {
        id: 1,
        name: 'Updated Name',
        code: 'UK-LON'
      }

      vi.mocked(prisma.warehouse.update).mockResolvedValue(mockUpdated as any)

      const result = await service.update(1, { name: 'Updated Name' })

      expect(result).toEqual(mockUpdated)
      expect(prisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated Name' }
      })
    })

    test('should throw error if warehouse not found', async () => {
      const { Prisma } = await import('@prisma/client')
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0'
      })
      vi.mocked(prisma.warehouse.update).mockRejectedValue(error)

      await expect(
        service.update(999, { name: 'Test' })
      ).rejects.toThrow('Warehouse not found')
    })

    test('should throw error on duplicate code update', async () => {
      const { Prisma } = await import('@prisma/client')
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['code'] }
      })
      vi.mocked(prisma.warehouse.update).mockRejectedValue(error)

      await expect(
        service.update(1, { code: 'EXISTING' })
      ).rejects.toThrow('Warehouse with code EXISTING already exists')
    })
  })

  describe('activate', () => {
    test('should activate warehouse', async () => {
      const mockActivated = {
        id: 1,
        status: 'ACTIVE',
        isActive: true
      }

      vi.mocked(prisma.warehouse.update).mockResolvedValue(mockActivated as any)

      const result = await service.activate(1)

      expect(result).toEqual(mockActivated)
      expect(prisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'ACTIVE',
          isActive: true
        }
      })
    })
  })

  describe('deactivate', () => {
    test('should deactivate warehouse', async () => {
      const mockDeactivated = {
        id: 1,
        status: 'INACTIVE',
        isActive: false
      }

      vi.mocked(prisma.warehouse.update).mockResolvedValue(mockDeactivated as any)

      const result = await service.deactivate(1)

      expect(result).toEqual(mockDeactivated)
      expect(prisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'INACTIVE',
          isActive: false
        }
      })
    })
  })

  describe('setMaintenance', () => {
    test('should set warehouse to maintenance status', async () => {
      const mockMaintenance = {
        id: 1,
        status: 'MAINTENANCE',
        isActive: false
      }

      vi.mocked(prisma.warehouse.update).mockResolvedValue(mockMaintenance as any)

      const result = await service.setMaintenance(1)

      expect(result).toEqual(mockMaintenance)
      expect(prisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'MAINTENANCE',
          isActive: false
        }
      })
    })
  })

  describe('delete', () => {
    test('should delete warehouse without inventory', async () => {
      const mockDeleted = {
        id: 1,
        name: 'Deleted Warehouse',
        code: 'DEL'
      }

      // Mock warehouse with no inventory
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({
        id: 1,
        inventory: []
      } as any)

      vi.mocked(prisma.warehouse.delete).mockResolvedValue(mockDeleted as any)

      const result = await service.delete(1)

      expect(result).toEqual(mockDeleted)
      expect(prisma.warehouse.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      })
    })

    test('should throw error if warehouse has inventory', async () => {
      // Mock warehouse with inventory
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({
        id: 1,
        inventory: [{ id: 1, quantity: 100 }]
      } as any)

      await expect(
        service.delete(1)
      ).rejects.toThrow('Cannot delete warehouse with existing inventory')
    })

    test('should throw error if warehouse not found', async () => {
      const { Prisma } = await import('@prisma/client')
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0'
      })
      vi.mocked(prisma.warehouse.delete).mockRejectedValue(error)
      vi.mocked(prisma.warehouse.findUnique).mockResolvedValue({
        id: 1,
        inventory: []
      } as any)

      await expect(
        service.delete(999)
      ).rejects.toThrow('Warehouse not found')
    })
  })

  describe('getActiveWarehouses', () => {
    test('should return only active warehouses', async () => {
      const mockActiveWarehouses = [
        { id: 1, name: 'Active 1', isActive: true },
        { id: 2, name: 'Active 2', isActive: true }
      ]

      vi.mocked(prisma.warehouse.findMany).mockResolvedValue(mockActiveWarehouses as any)

      const result = await service.getActiveWarehouses()

      expect(result).toEqual(mockActiveWarehouses)
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      })
    })
  })
})
