// src/services/inventoryService.ts

import { prisma } from '@/lib/database'
import { Prisma, Inventory, Title } from '@prisma/client'

/**
 * Inventory with relationships
 */
export interface InventoryWithRelations extends Inventory {
  title: Title
  warehouse: {
    id: number
    name: string
    code: string
  }
}

/**
 * Total stock summary across warehouses
 */
export interface TotalStockSummary {
  totalStock: number
  totalReserved: number
  totalAvailable: number
}

/**
 * Paginated list result
 */
export interface PaginatedInventoryResult {
  data: InventoryWithRelations[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * List query filters
 */
export interface InventoryListFilters {
  page?: number
  limit?: number
  warehouseId?: string
  titleId?: string
  lowStock?: boolean
  search?: string
}

/**
 * Service class for inventory management operations
 */
export class InventoryService {
  /**
   * Get all inventory for a specific warehouse
   */
  async getInventoryByWarehouse(warehouseId: number): Promise<InventoryWithRelations[]> {
    return await prisma.inventory.findMany({
      where: { warehouseId },
      include: {
        title: true,
        warehouse: true
      },
      orderBy: {
        title: { title: 'asc' }
      }
    }) as InventoryWithRelations[]
  }

  /**
   * Get inventory for a title across all warehouses
   */
  async getInventoryByTitle(titleId: number): Promise<Inventory[]> {
    return await prisma.inventory.findMany({
      where: { titleId },
      include: {
        warehouse: true
      },
      orderBy: {
        warehouse: { name: 'asc' }
      }
    })
  }

  /**
   * Get titles below low stock threshold
   * Optionally filter by warehouse
   */
  async getLowStockItems(warehouseId?: number): Promise<InventoryWithRelations[]> {
    const where: Prisma.InventoryWhereInput = {}

    if (warehouseId !== undefined) {
      where.warehouseId = warehouseId
    }

    const allInventory = await prisma.inventory.findMany({
      where,
      include: {
        title: true,
        warehouse: true
      }
    }) as InventoryWithRelations[]

    // Filter client-side for items below threshold
    return allInventory.filter(item =>
      item.title.lowStockThreshold !== null &&
      item.currentStock < item.title.lowStockThreshold
    )
  }

  /**
   * Update low stock threshold for a title
   */
  async updateStockThreshold(titleId: number, threshold: number | null): Promise<Title> {
    try {
      return await prisma.title.update({
        where: { id: titleId },
        data: { lowStockThreshold: threshold }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Title not found')
        }
      }
      throw error
    }
  }

  /**
   * Get total stock across all warehouses for a title
   */
  async getTotalStock(titleId: number): Promise<TotalStockSummary> {
    const inventory = await prisma.inventory.findMany({
      where: { titleId }
    })

    const totalStock = inventory.reduce((sum, inv) => sum + inv.currentStock, 0)
    const totalReserved = inventory.reduce((sum, inv) => sum + inv.reservedStock, 0)

    return {
      totalStock,
      totalReserved,
      totalAvailable: totalStock - totalReserved
    }
  }

  /**
   * Get or create inventory record for title-warehouse combination
   */
  async getOrCreateInventory(titleId: number, warehouseId: number): Promise<Inventory> {
    const existing = await prisma.inventory.findUnique({
      where: {
        titleId_warehouseId: {
          titleId,
          warehouseId
        }
      }
    })

    if (existing) {
      return existing
    }

    // Create new inventory record with zero stock
    return await prisma.inventory.create({
      data: {
        titleId,
        warehouseId,
        currentStock: 0,
        reservedStock: 0
      }
    })
  }

  /**
   * Update inventory stock levels
   * Internal method used by StockMovementService
   */
  async updateStock(
    titleId: number,
    warehouseId: number,
    stockDelta: number,
    updateLastCheck: boolean = false
  ): Promise<Inventory> {
    const inventory = await this.getOrCreateInventory(titleId, warehouseId)

    const data: any = {
      currentStock: inventory.currentStock + stockDelta,
      lastMovementDate: new Date()
    }

    if (updateLastCheck) {
      data.lastStockCheck = new Date()
    }

    return await prisma.inventory.update({
      where: { id: inventory.id },
      data
    })
  }

  /**
   * Find inventory by ID
   */
  async findById(id: number): Promise<InventoryWithRelations | null> {
    return await prisma.inventory.findUnique({
      where: { id },
      include: {
        title: true,
        warehouse: true
      }
    }) as InventoryWithRelations | null
  }

  /**
   * Update inventory record
   */
  async update(id: number, data: Partial<Inventory>): Promise<Inventory | null> {
    try {
      return await prisma.inventory.update({
        where: { id },
        data
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return null // Record not found
        }
      }
      throw error
    }
  }

  /**
   * Delete inventory record
   */
  async delete(id: number): Promise<boolean> {
    try {
      await prisma.inventory.delete({
        where: { id }
      })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return false // Record not found
        }
      }
      throw error
    }
  }

  /**
   * List inventory with pagination and filters
   */
  async list(filters: InventoryListFilters = {}): Promise<PaginatedInventoryResult> {
    const page = filters.page || 1
    const limit = filters.limit || 50
    const skip = (page - 1) * limit

    const where: Prisma.InventoryWhereInput = {}

    if (filters.warehouseId) {
      where.warehouseId = parseInt(filters.warehouseId, 10)
    }

    if (filters.titleId) {
      where.titleId = parseInt(filters.titleId, 10)
    }

    if (filters.search) {
      where.title = {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { isbn: { contains: filters.search, mode: 'insensitive' } }
        ]
      }
    }

    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: {
          title: true,
          warehouse: true
        },
        skip,
        take: limit,
        orderBy: {
          title: { title: 'asc' }
        }
      }) as Promise<InventoryWithRelations[]>,
      prisma.inventory.count({ where })
    ])

    // Filter for low stock if requested
    let finalData = data
    if (filters.lowStock) {
      finalData = data.filter(item =>
        item.title.lowStockThreshold !== null &&
        item.currentStock < item.title.lowStockThreshold
      )
    }

    return {
      data: finalData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Create inventory record
   */
  async create(data: {
    titleId: number
    warehouseId: number
    currentStock?: number
    reservedStock?: number
  }): Promise<Inventory> {
    return await prisma.inventory.create({
      data: {
        titleId: data.titleId,
        warehouseId: data.warehouseId,
        currentStock: data.currentStock || 0,
        reservedStock: data.reservedStock || 0
      }
    })
  }
}

// Export singleton instance
export const inventoryService = new InventoryService()
