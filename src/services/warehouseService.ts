// src/services/warehouseService.ts

import { prisma } from '@/lib/database'
import { Prisma, Warehouse, WarehouseType, WarehouseStatus } from '@prisma/client'

/**
 * Input types for warehouse service operations
 */
export interface CreateWarehouseInput {
  name: string
  code: string
  type?: WarehouseType
  status?: WarehouseStatus
  addressLine1?: string
  addressLine2?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
  // Legacy fields for backward compatibility
  location?: string
  fulfillsChannels?: any
}

export interface UpdateWarehouseInput extends Partial<CreateWarehouseInput> {}

export interface ListWarehousesOptions {
  page?: number
  limit?: number
  search?: string
  status?: WarehouseStatus
  type?: WarehouseType
  isActive?: boolean
}

export interface ListWarehousesResult {
  warehouses: Warehouse[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Service class for warehouse management operations
 */
export class WarehouseService {
  /**
   * Create a new warehouse
   */
  async create(data: CreateWarehouseInput): Promise<Warehouse> {
    try {
      return await prisma.warehouse.create({
        data: data as any
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Warehouse with code ${data.code} already exists`)
        }
      }
      throw error
    }
  }

  /**
   * Find warehouse by ID
   */
  async findById(id: number): Promise<Warehouse | null> {
    return await prisma.warehouse.findUnique({
      where: { id }
    })
  }

  /**
   * Find warehouse by unique code
   */
  async findByCode(code: string): Promise<Warehouse | null> {
    return await prisma.warehouse.findUnique({
      where: { code }
    })
  }

  /**
   * List warehouses with pagination, filtering, and search
   */
  async list(options: ListWarehousesOptions = {}): Promise<ListWarehousesResult> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      type,
      isActive
    } = options

    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.WarehouseWhereInput = {}

    // Filter by status
    if (status !== undefined) {
      where.status = status
    }

    // Filter by type
    if (type !== undefined) {
      where.type = type
    }

    // Filter by isActive
    if (isActive !== undefined) {
      where.isActive = isActive
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Execute queries
    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      }),
      prisma.warehouse.count({ where })
    ])

    return {
      warehouses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  /**
   * Update warehouse details
   */
  async update(id: number, data: UpdateWarehouseInput): Promise<Warehouse> {
    try {
      return await prisma.warehouse.update({
        where: { id },
        data: data as any
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(`Warehouse with code ${data.code} already exists`)
        }
        if (error.code === 'P2025') {
          throw new Error('Warehouse not found')
        }
      }
      throw error
    }
  }

  /**
   * Activate a warehouse (set status to ACTIVE)
   */
  async activate(id: number): Promise<Warehouse> {
    return await prisma.warehouse.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        isActive: true
      }
    })
  }

  /**
   * Deactivate a warehouse (set status to INACTIVE)
   */
  async deactivate(id: number): Promise<Warehouse> {
    return await prisma.warehouse.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        isActive: false
      }
    })
  }

  /**
   * Set warehouse to maintenance status
   */
  async setMaintenance(id: number): Promise<Warehouse> {
    return await prisma.warehouse.update({
      where: { id },
      data: {
        status: 'MAINTENANCE',
        isActive: false
      }
    })
  }

  /**
   * Delete a warehouse
   * Note: Will fail if warehouse has inventory
   */
  async delete(id: number): Promise<Warehouse> {
    try {
      // Check if warehouse has inventory
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          inventory: true
        }
      })

      if (warehouse && warehouse.inventory && warehouse.inventory.length > 0) {
        throw new Error('Cannot delete warehouse with existing inventory')
      }

      return await prisma.warehouse.delete({
        where: { id }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Warehouse not found')
        }
      }
      throw error
    }
  }

  /**
   * Get all active warehouses
   */
  async getActiveWarehouses(): Promise<Warehouse[]> {
    return await prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
  }
}

// Export singleton instance
export const warehouseService = new WarehouseService()
