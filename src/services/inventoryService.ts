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
    const where: Prisma.InventoryWhereInput = {
      title: {
        lowStockThreshold: { not: null }
      }
    }

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
}

// Export singleton instance
export const inventoryService = new InventoryService()
