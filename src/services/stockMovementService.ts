import { PrismaClient, StockMovement, Inventory, MovementType, Prisma } from '@prisma/client'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Types and Interfaces
export interface MovementRequest {
  titleId: number
  warehouseId: number
  movementType: MovementType
  quantity: number
  movementDate: Date
  referenceNumber?: string
  notes?: string

  // Financial fields
  rrpAtTime?: number
  unitCostAtTime?: number
  tradeDiscountAtTime?: number

  // Transfer fields
  sourceWarehouseId?: number
  destinationWarehouseId?: number

  // Print fields
  printerId?: number
  batchNumber?: string
  lotId?: string
  expiryDate?: Date
  manufacturingDate?: Date
  supplierBatchRef?: string
}

export interface MovementResult {
  success: boolean
  message: string
  movement?: StockMovement
  inventoryUpdated?: boolean
  error?: string
}

export interface BatchMovementRequest {
  movements: MovementRequest[]
  validateOnly?: boolean
  continueOnError?: boolean
}

export interface BatchMovementResult {
  success: boolean
  totalRequested: number
  successCount: number
  failureCount: number
  results: MovementResult[]
  errors: Array<{
    index: number
    error: string
    movement: MovementRequest
  }>
}

export interface MovementValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface TransactionRollbackRequest {
  movementId: number
  reason: string
  approvedBy: string
  createReversalMovement?: boolean
}

export interface TransactionRollbackResult {
  success: boolean
  message: string
  originalMovement?: StockMovement
  reversalMovement?: StockMovement
  inventoryReverted?: boolean
}

export interface BulkProcessingOptions {
  batchSize?: number
  concurrency?: number
  timeoutMs?: number
  retryAttempts?: number
  validateFirst?: boolean
}

class StockMovementService {

  // Atomic Transaction Processing
  static async processMovement(request: MovementRequest): Promise<MovementResult> {
    try {
      return await dbClient.$transaction(async (tx) => {
        // Validate movement
        const validation = await this.validateMovement(request)
        if (!validation.isValid) {
          throw new Error(`Movement validation failed: ${validation.errors.join(', ')}`)
        }

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            titleId: request.titleId,
            warehouseId: request.warehouseId,
            movementType: request.movementType,
            quantity: request.quantity,
            movementDate: request.movementDate,
            referenceNumber: request.referenceNumber,
            notes: request.notes,
            rrpAtTime: request.rrpAtTime ? new Prisma.Decimal(request.rrpAtTime) : null,
            unitCostAtTime: request.unitCostAtTime ? new Prisma.Decimal(request.unitCostAtTime) : null,
            tradeDiscountAtTime: request.tradeDiscountAtTime ? new Prisma.Decimal(request.tradeDiscountAtTime) : null,
            sourceWarehouseId: request.sourceWarehouseId,
            destinationWarehouseId: request.destinationWarehouseId,
            printerId: request.printerId,
            batchNumber: request.batchNumber,
            lotId: request.lotId,
            expiryDate: request.expiryDate,
            manufacturingDate: request.manufacturingDate,
            supplierBatchRef: request.supplierBatchRef
          }
        })

        // Update inventory atomically
        const inventoryUpdated = await this.updateInventoryAtomic(tx, request)

        return {
          success: true,
          message: `Movement ${movement.id} processed successfully`,
          movement,
          inventoryUpdated
        }
      })
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process movement',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Movement Validation and Business Rules
  static async validateMovement(request: MovementRequest): Promise<MovementValidation> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Basic field validation
      if (!request.titleId || request.titleId <= 0) {
        errors.push('Valid titleId is required')
      }

      if (!request.warehouseId || request.warehouseId <= 0) {
        errors.push('Valid warehouseId is required')
      }

      if (!request.movementType) {
        errors.push('Movement type is required')
      }

      if (request.quantity === 0) {
        errors.push('Movement quantity cannot be zero')
      }

      if (!request.movementDate) {
        errors.push('Movement date is required')
      }

      // Date validation - no future dates for historical accuracy
      if (request.movementDate && request.movementDate > new Date()) {
        errors.push('Movement date cannot be in the future')
      }

      // Business rule validation
      if (request.titleId && request.warehouseId) {
        // Check if title exists
        const title = await dbClient.title.findUnique({
          where: { id: request.titleId }
        })
        if (!title) {
          errors.push('Title not found')
        }

        // Check if warehouse exists
        const warehouse = await dbClient.warehouse.findUnique({
          where: { id: request.warehouseId }
        })
        if (!warehouse) {
          errors.push('Warehouse not found')
        }

        // Validate warehouse can handle movement type
        if (warehouse && request.movementType) {
          const channelValidation = this.validateWarehouseChannelCompatibility(
            warehouse,
            request.movementType
          )
          if (!channelValidation.isValid) {
            warnings.push(channelValidation.message)
          }
        }

        // Stock availability validation for outbound movements
        if (request.quantity < 0) {
          const inventory = await dbClient.inventory.findUnique({
            where: {
              titleId_warehouseId: {
                titleId: request.titleId,
                warehouseId: request.warehouseId
              }
            }
          })

          if (inventory) {
            const availableStock = inventory.currentStock - inventory.reservedStock
            const requestedQuantity = Math.abs(request.quantity)

            if (availableStock < requestedQuantity) {
              errors.push(`Insufficient stock: ${availableStock} available, ${requestedQuantity} requested`)
            }

            if (availableStock - requestedQuantity < 0) {
              warnings.push('Movement will result in negative stock levels')
            }
          } else {
            errors.push('No inventory record found for this title and warehouse')
          }
        }
      }

      // Transfer-specific validation
      if (request.movementType === 'WAREHOUSE_TRANSFER') {
        if (!request.sourceWarehouseId && !request.destinationWarehouseId) {
          errors.push('Warehouse transfers require source or destination warehouse')
        }

        if (request.sourceWarehouseId === request.destinationWarehouseId) {
          errors.push('Source and destination warehouses cannot be the same')
        }
      }

      // Print-specific validation
      if (request.movementType === 'PRINT_RECEIVED') {
        if (request.quantity <= 0) {
          errors.push('Print received movements must have positive quantity')
        }

        if (!request.printerId && !request.batchNumber) {
          warnings.push('Print movements should include printer or batch information')
        }
      }

      // Reference number validation
      if (request.referenceNumber) {
        const existingMovement = await dbClient.stockMovement.findFirst({
          where: { referenceNumber: request.referenceNumber }
        })
        if (existingMovement) {
          warnings.push('Reference number already exists - consider using unique reference')
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      }
    }
  }

  // Warehouse channel compatibility validation
  private static validateWarehouseChannelCompatibility(
    warehouse: any,
    movementType: MovementType
  ): { isValid: boolean; message: string } {
    const channelMappings: Record<string, string[]> = {
      'UK_TRADE_SALES': ['UK_TRADE', 'wholesale'],
      'US_TRADE_SALES': ['US_TRADE', 'wholesale'],
      'ROW_TRADE_SALES': ['ROW_TRADE', 'export'],
      'ONLINE_SALES': ['online', 'retail'],
      'DIRECT_SALES': ['direct', 'retail']
    }

    const requiredChannels = channelMappings[movementType]
    if (!requiredChannels) {
      return { isValid: true, message: 'Movement type does not require channel validation' }
    }

    // Get fulfillsChannels from JSON field
    const warehouseChannels = Array.isArray(warehouse.fulfillsChannels)
      ? warehouse.fulfillsChannels
      : []

    const hasCompatibleChannel = requiredChannels.some(channel =>
      warehouseChannels.includes(channel)
    )

    if (!hasCompatibleChannel) {
      return {
        isValid: false,
        message: `Warehouse ${warehouse.code} does not support ${movementType} (requires: ${requiredChannels.join(' or ')})`
      }
    }

    return { isValid: true, message: 'Channel compatibility validated' }
  }

  // Atomic inventory update within transaction
  private static async updateInventoryAtomic(
    tx: Prisma.TransactionClient,
    request: MovementRequest
  ): Promise<boolean> {
    try {
      // Find or create inventory record
      const inventory = await tx.inventory.upsert({
        where: {
          titleId_warehouseId: {
            titleId: request.titleId,
            warehouseId: request.warehouseId
          }
        },
        create: {
          titleId: request.titleId,
          warehouseId: request.warehouseId,
          currentStock: Math.max(0, request.quantity),
          reservedStock: 0,
          lastMovementDate: request.movementDate
        },
        update: {
          currentStock: {
            increment: request.quantity
          },
          lastMovementDate: request.movementDate
        }
      })

      // Ensure stock doesn't go negative
      if (inventory.currentStock + request.quantity < 0) {
        throw new Error('Movement would result in negative stock')
      }

      return true
    } catch (error) {
      throw new Error(`Failed to update inventory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Batch Processing
  static async processBatchMovements(
    request: BatchMovementRequest,
    options: BulkProcessingOptions = {}
  ): Promise<BatchMovementResult> {
    const {
      batchSize = 50,
      validateFirst = true,
      continueOnError = false
    } = options

    const results: MovementResult[] = []
    const errors: Array<{ index: number; error: string; movement: MovementRequest }> = []
    let successCount = 0
    let failureCount = 0

    try {
      // Validation phase
      if (validateFirst) {
        for (let i = 0; i < request.movements.length; i++) {
          const validation = await this.validateMovement(request.movements[i])
          if (!validation.isValid) {
            const error = `Validation failed: ${validation.errors.join(', ')}`
            errors.push({ index: i, error, movement: request.movements[i] })

            if (!continueOnError) {
              return {
                success: false,
                totalRequested: request.movements.length,
                successCount: 0,
                failureCount: request.movements.length,
                results: [],
                errors
              }
            }
          }
        }

        if (request.validateOnly) {
          return {
            success: errors.length === 0,
            totalRequested: request.movements.length,
            successCount: request.movements.length - errors.length,
            failureCount: errors.length,
            results: [],
            errors
          }
        }
      }

      // Process in batches
      for (let i = 0; i < request.movements.length; i += batchSize) {
        const batch = request.movements.slice(i, i + batchSize)

        const batchResults = await Promise.allSettled(
          batch.map(movement => this.processMovement(movement))
        )

        batchResults.forEach((result, batchIndex) => {
          const globalIndex = i + batchIndex

          if (result.status === 'fulfilled') {
            results.push(result.value)
            if (result.value.success) {
              successCount++
            } else {
              failureCount++
              errors.push({
                index: globalIndex,
                error: result.value.error || 'Unknown error',
                movement: batch[batchIndex]
              })
            }
          } else {
            failureCount++
            results.push({
              success: false,
              message: 'Promise rejected',
              error: result.reason
            })
            errors.push({
              index: globalIndex,
              error: result.reason,
              movement: batch[batchIndex]
            })
          }
        })

        // Stop on first error if continueOnError is false
        if (!continueOnError && errors.length > 0) {
          break
        }
      }

      return {
        success: failureCount === 0,
        totalRequested: request.movements.length,
        successCount,
        failureCount,
        results,
        errors
      }
    } catch (error) {
      return {
        success: false,
        totalRequested: request.movements.length,
        successCount,
        failureCount: request.movements.length - successCount,
        results,
        errors: [{
          index: -1,
          error: error instanceof Error ? error.message : 'Batch processing failed',
          movement: {} as MovementRequest
        }]
      }
    }
  }

  // Transaction Rollback and Compensation
  static async rollbackMovement(request: TransactionRollbackRequest): Promise<TransactionRollbackResult> {
    try {
      return await dbClient.$transaction(async (tx) => {
        // Find original movement
        const originalMovement = await tx.stockMovement.findUnique({
          where: { id: request.movementId },
          include: {
            title: true,
            warehouse: true
          }
        })

        if (!originalMovement) {
          throw new Error('Original movement not found')
        }

        // Create reversal movement if requested
        let reversalMovement: StockMovement | undefined

        if (request.createReversalMovement) {
          reversalMovement = await tx.stockMovement.create({
            data: {
              titleId: originalMovement.titleId,
              warehouseId: originalMovement.warehouseId,
              movementType: originalMovement.movementType,
              quantity: -originalMovement.quantity, // Reverse the quantity
              movementDate: new Date(),
              referenceNumber: `ROLLBACK-${originalMovement.id}-${Date.now()}`,
              notes: `Rollback of movement ${originalMovement.id}. Reason: ${request.reason}. Approved by: ${request.approvedBy}`,
              rrpAtTime: originalMovement.rrpAtTime,
              unitCostAtTime: originalMovement.unitCostAtTime,
              tradeDiscountAtTime: originalMovement.tradeDiscountAtTime,
              sourceWarehouseId: originalMovement.destinationWarehouseId, // Reverse transfer direction
              destinationWarehouseId: originalMovement.sourceWarehouseId,
              printerId: originalMovement.printerId,
              batchNumber: originalMovement.batchNumber,
              lotId: originalMovement.lotId
            }
          })
        }

        // Revert inventory changes
        const inventoryReverted = await this.revertInventoryChanges(
          tx,
          originalMovement.titleId,
          originalMovement.warehouseId,
          originalMovement.quantity
        )

        return {
          success: true,
          message: `Movement ${request.movementId} rolled back successfully`,
          originalMovement,
          reversalMovement,
          inventoryReverted
        }
      })
    } catch (error) {
      return {
        success: false,
        message: 'Failed to rollback movement',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Revert inventory changes
  private static async revertInventoryChanges(
    tx: Prisma.TransactionClient,
    titleId: number,
    warehouseId: number,
    originalQuantity: number
  ): Promise<boolean> {
    try {
      await tx.inventory.update({
        where: {
          titleId_warehouseId: {
            titleId,
            warehouseId
          }
        },
        data: {
          currentStock: {
            increment: -originalQuantity // Reverse the original change
          },
          lastMovementDate: new Date()
        }
      })

      return true
    } catch (error) {
      throw new Error(`Failed to revert inventory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Utility Methods
  static async getMovementHistory(
    titleId?: number,
    warehouseId?: number,
    movementType?: MovementType,
    dateFrom?: Date,
    dateTo?: Date,
    limit?: number
  ): Promise<StockMovement[]> {
    const where: Prisma.StockMovementWhereInput = {}

    if (titleId) where.titleId = titleId
    if (warehouseId) where.warehouseId = warehouseId
    if (movementType) where.movementType = movementType
    if (dateFrom || dateTo) {
      where.movementDate = {}
      if (dateFrom) where.movementDate.gte = dateFrom
      if (dateTo) where.movementDate.lte = dateTo
    }

    return await dbClient.stockMovement.findMany({
      where,
      include: {
        title: true,
        warehouse: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        printer: true
      },
      orderBy: { movementDate: 'desc' },
      take: limit
    })
  }

  static async getMovementStats(
    dateFrom: Date,
    dateTo: Date,
    warehouseId?: number
  ): Promise<{
    totalMovements: number
    inboundQuantity: number
    outboundQuantity: number
    movementsByType: Record<string, number>
    valueByType: Record<string, number>
  }> {
    const where: Prisma.StockMovementWhereInput = {
      movementDate: {
        gte: dateFrom,
        lte: dateTo
      }
    }

    if (warehouseId) {
      where.warehouseId = warehouseId
    }

    const movements = await dbClient.stockMovement.findMany({
      where,
      select: {
        movementType: true,
        quantity: true,
        rrpAtTime: true,
        unitCostAtTime: true
      }
    })

    const stats = {
      totalMovements: movements.length,
      inboundQuantity: 0,
      outboundQuantity: 0,
      movementsByType: {} as Record<string, number>,
      valueByType: {} as Record<string, number>
    }

    movements.forEach(movement => {
      // Quantity tracking
      if (movement.quantity > 0) {
        stats.inboundQuantity += movement.quantity
      } else {
        stats.outboundQuantity += Math.abs(movement.quantity)
      }

      // Type tracking
      const type = movement.movementType
      stats.movementsByType[type] = (stats.movementsByType[type] || 0) + 1

      // Value tracking
      if (movement.rrpAtTime || movement.unitCostAtTime) {
        const value = parseFloat(movement.rrpAtTime?.toString() || movement.unitCostAtTime?.toString() || '0')
        const totalValue = value * Math.abs(movement.quantity)
        stats.valueByType[type] = (stats.valueByType[type] || 0) + totalValue
      }
    })

    return stats
  }
}

export default StockMovementService