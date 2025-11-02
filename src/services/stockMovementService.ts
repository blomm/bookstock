// src/services/stockMovementService.ts

import { prisma } from '@/lib/database'
import { Prisma, StockMovement, MovementType } from '@prisma/client'
import { inventoryService } from './inventoryService'

/**
 * Input for recording a stock movement
 */
export interface RecordMovementInput {
  titleId: number
  warehouseId?: number
  movementType: MovementType
  quantity: number
  movementDate?: Date
  rrpAtTime?: number
  unitCostAtTime?: number
  tradeDiscountAtTime?: number
  sourceWarehouseId?: number
  destinationWarehouseId?: number
  printerId?: number
  referenceNumber?: string
  notes?: string
  createdBy?: string
}

/**
 * Result of recording a movement
 */
export interface RecordMovementResult {
  movement: StockMovement
  inventoryUpdate: any
}

/**
 * Movement history query parameters
 */
export interface MovementHistoryFilters {
  titleId?: number
  warehouseId?: number
  movementType?: MovementType
  startDate?: Date
  endDate?: Date
}

/**
 * Service class for stock movement operations
 */
export class StockMovementService {
  /**
   * Record a stock movement and update inventory atomically
   * Handles all movement types including transfers and adjustments
   */
  async recordMovement(input: RecordMovementInput): Promise<RecordMovementResult> {
    // Validate input
    await this.validateMovement(input)

    // Use transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      const movementDate = input.movementDate || new Date()
      const isAdjustment = input.movementType === 'STOCK_ADJUSTMENT'
      const isTransfer = input.movementType === 'WAREHOUSE_TRANSFER'

      // For transfers, use destination warehouse as primary warehouse
      const primaryWarehouseId = isTransfer ? input.destinationWarehouseId! : input.warehouseId!

      // Create the stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          titleId: input.titleId,
          warehouseId: primaryWarehouseId,
          movementType: input.movementType,
          quantity: input.quantity,
          movementDate,
          rrpAtTime: input.rrpAtTime,
          unitCostAtTime: input.unitCostAtTime,
          tradeDiscountAtTime: input.tradeDiscountAtTime,
          sourceWarehouseId: input.sourceWarehouseId,
          destinationWarehouseId: input.destinationWarehouseId,
          printerId: input.printerId,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          createdBy: input.createdBy
        }
      })

      let inventoryUpdate: any

      if (isTransfer) {
        // Handle warehouse transfer (update both warehouses)
        const sourceWarehouseId = input.sourceWarehouseId!
        const destinationWarehouseId = input.destinationWarehouseId!

        // Deduct from source warehouse
        const sourceInventory = await tx.inventory.findUnique({
          where: {
            titleId_warehouseId: {
              titleId: input.titleId,
              warehouseId: sourceWarehouseId
            }
          }
        })

        if (!sourceInventory) {
          throw new Error(`No inventory found for title ${input.titleId} in source warehouse ${sourceWarehouseId}`)
        }

        if (sourceInventory.currentStock < input.quantity) {
          throw new Error(`Insufficient stock in source warehouse. Available: ${sourceInventory.currentStock}, Required: ${input.quantity}`)
        }

        await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: {
            currentStock: sourceInventory.currentStock - input.quantity,
            lastMovementDate: movementDate
          }
        })

        // Add to destination warehouse
        const destInventory = await tx.inventory.upsert({
          where: {
            titleId_warehouseId: {
              titleId: input.titleId,
              warehouseId: destinationWarehouseId
            }
          },
          create: {
            titleId: input.titleId,
            warehouseId: destinationWarehouseId,
            currentStock: input.quantity,
            reservedStock: 0,
            lastMovementDate: movementDate
          },
          update: {
            currentStock: { increment: input.quantity },
            lastMovementDate: movementDate
          }
        })

        inventoryUpdate = {
          source: {
            warehouseId: sourceWarehouseId,
            currentStock: sourceInventory.currentStock - input.quantity
          },
          destination: {
            warehouseId: destinationWarehouseId,
            currentStock: destInventory.currentStock
          }
        }
      } else {
        // Regular movement (non-transfer)
        const delta = this.calculateInventoryImpact(input.movementType, input.quantity)

        // Get or create inventory record
        const inventory = await tx.inventory.upsert({
          where: {
            titleId_warehouseId: {
              titleId: input.titleId,
              warehouseId: primaryWarehouseId
            }
          },
          create: {
            titleId: input.titleId,
            warehouseId: primaryWarehouseId,
            currentStock: Math.max(0, delta),
            reservedStock: 0,
            lastMovementDate: movementDate,
            lastStockCheck: isAdjustment ? movementDate : undefined
          },
          update: {
            currentStock: { increment: delta },
            lastMovementDate: movementDate,
            lastStockCheck: isAdjustment ? movementDate : undefined
          }
        })

        // Validate stock won't go negative (except for adjustments)
        if (!isAdjustment && inventory.currentStock < 0) {
          throw new Error(`Insufficient stock. Current: ${inventory.currentStock - delta}, Required: ${Math.abs(delta)}`)
        }

        inventoryUpdate = inventory
      }

      return {
        movement,
        inventoryUpdate
      }
    })
  }

  /**
   * Get movement history with filters
   */
  async getMovementHistory(filters: MovementHistoryFilters): Promise<StockMovement[]> {
    const where: Prisma.StockMovementWhereInput = {}

    if (filters.titleId) {
      where.titleId = filters.titleId
    }

    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId
    }

    if (filters.movementType) {
      where.movementType = filters.movementType
    }

    if (filters.startDate || filters.endDate) {
      where.movementDate = {}
      if (filters.startDate) {
        where.movementDate.gte = filters.startDate
      }
      if (filters.endDate) {
        where.movementDate.lte = filters.endDate
      }
    }

    return await prisma.stockMovement.findMany({
      where,
      include: {
        title: true,
        warehouse: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        printer: true
      },
      orderBy: {
        movementDate: 'desc'
      }
    })
  }

  /**
   * Calculate inventory impact based on movement type
   * Returns positive for inbound, negative for outbound
   */
  calculateInventoryImpact(movementType: MovementType, quantity: number): number {
    const inboundTypes: MovementType[] = ['PRINT_RECEIVED', 'REPRINT']
    const outboundTypes: MovementType[] = [
      'ONLINE_SALES',
      'UK_TRADE_SALES',
      'US_TRADE_SALES',
      'ROW_TRADE_SALES',
      'DIRECT_SALES',
      'PULPED',
      'DAMAGED',
      'FREE_COPIES'
    ]

    if (inboundTypes.includes(movementType)) {
      return Math.abs(quantity)
    }

    if (outboundTypes.includes(movementType)) {
      return -Math.abs(quantity)
    }

    if (movementType === 'STOCK_ADJUSTMENT') {
      return quantity // Adjustments can be positive or negative
    }

    if (movementType === 'WAREHOUSE_TRANSFER') {
      return 0 // Transfers handled separately
    }

    return 0
  }

  /**
   * Validate movement data before recording
   */
  async validateMovement(input: RecordMovementInput): Promise<void> {
    // Validate title exists
    const title = await prisma.title.findUnique({
      where: { id: input.titleId }
    })
    if (!title) {
      throw new Error('Title not found')
    }

    // Validate warehouse(s) exist
    if (input.movementType === 'WAREHOUSE_TRANSFER') {
      if (!input.sourceWarehouseId || !input.destinationWarehouseId) {
        throw new Error('Warehouse transfer requires source and destination warehouses')
      }

      const [source, destination] = await Promise.all([
        prisma.warehouse.findUnique({ where: { id: input.sourceWarehouseId } }),
        prisma.warehouse.findUnique({ where: { id: input.destinationWarehouseId } })
      ])

      if (!source) throw new Error('Source warehouse not found')
      if (!destination) throw new Error('Destination warehouse not found')
    } else {
      if (!input.warehouseId) {
        throw new Error('Warehouse ID is required for non-transfer movements')
      }

      const warehouse = await prisma.warehouse.findUnique({
        where: { id: input.warehouseId }
      })
      if (!warehouse) {
        throw new Error('Warehouse not found')
      }
    }

    // Validate quantity is positive for inbound movements
    const inboundTypes: MovementType[] = ['PRINT_RECEIVED', 'REPRINT']
    if (inboundTypes.includes(input.movementType) && input.quantity <= 0) {
      throw new Error('Quantity must be positive for inbound movements')
    }

    // Validate adjustments have notes
    if (input.movementType === 'STOCK_ADJUSTMENT' && (!input.notes || input.notes.length < 10)) {
      throw new Error('Stock adjustments require notes explaining the reason (minimum 10 characters)')
    }
  }
}

// Export singleton instance
export const stockMovementService = new StockMovementService()
