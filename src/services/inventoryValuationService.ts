import { PrismaClient, Prisma } from '@prisma/client'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Types and Interfaces
export interface ValuationMethod {
  method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'
  calculateValue: (movements: StockMovementData[], currentStock: number) => ValuationResult
}

export interface StockMovementData {
  id: number
  quantity: number
  unitCostAtTime: number
  movementDate: Date
  movementType: string
  warehouseId: number
  titleId: number
}

export interface ValuationResult {
  totalValue: number
  unitCost: number
  method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'
  breakdown: CostLayer[]
  calculatedAt: Date
  remainingStock: number
}

export interface CostLayer {
  quantity: number
  unitCost: number
  totalCost: number
  acquisitionDate: Date
  batchReference?: string
}

export interface WarehouseValuation {
  warehouseId: number
  warehouseName: string
  titleId: number
  titleName: string
  isbn: string
  currentStock: number
  fifoValuation: ValuationResult
  lifoValuation: ValuationResult
  weightedAverageValuation: ValuationResult
  recommendedMethod: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'
  lastUpdated: Date
}

export interface AgingReport {
  titleId: number
  warehouseId: number
  ageInDays: number
  quantity: number
  unitCost: number
  totalValue: number
  obsolescenceRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendedAction: 'NONE' | 'MONITOR' | 'DISCOUNT' | 'WRITE_OFF'
}

export interface ValuationAdjustment {
  id?: number
  titleId: number
  warehouseId: number
  adjustmentType: 'WRITE_DOWN' | 'WRITE_UP' | 'WRITE_OFF' | 'OBSOLESCENCE'
  originalValue: number
  adjustedValue: number
  adjustmentAmount: number
  reason: string
  approvedBy: string
  effectiveDate: Date
}

class InventoryValuationService {

  // FIFO (First In, First Out) Calculation
  static calculateFIFO(movements: StockMovementData[], currentStock: number): ValuationResult {
    if (currentStock <= 0) {
      return {
        totalValue: 0,
        unitCost: 0,
        method: 'FIFO',
        breakdown: [],
        calculatedAt: new Date(),
        remainingStock: currentStock
      }
    }

    // Sort movements by date (oldest first for FIFO)
    const sortedMovements = movements
      .filter(m => m.quantity > 0 && m.unitCostAtTime > 0) // Only inbound with cost
      .sort((a, b) => a.movementDate.getTime() - b.movementDate.getTime())

    const costLayers: CostLayer[] = []
    let remainingToAllocate = currentStock
    let totalValue = 0

    for (const movement of sortedMovements) {
      if (remainingToAllocate <= 0) break

      const quantityToUse = Math.min(remainingToAllocate, movement.quantity)
      const layerCost = quantityToUse * movement.unitCostAtTime

      costLayers.push({
        quantity: quantityToUse,
        unitCost: movement.unitCostAtTime,
        totalCost: layerCost,
        acquisitionDate: movement.movementDate,
        batchReference: `FIFO-${movement.id}`
      })

      totalValue += layerCost
      remainingToAllocate -= quantityToUse
    }

    const weightedAverageUnitCost = currentStock > 0 ? totalValue / currentStock : 0

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      unitCost: Math.round(weightedAverageUnitCost * 100) / 100,
      method: 'FIFO',
      breakdown: costLayers,
      calculatedAt: new Date(),
      remainingStock: currentStock
    }
  }

  // LIFO (Last In, First Out) Calculation
  static calculateLIFO(movements: StockMovementData[], currentStock: number): ValuationResult {
    if (currentStock <= 0) {
      return {
        totalValue: 0,
        unitCost: 0,
        method: 'LIFO',
        breakdown: [],
        calculatedAt: new Date(),
        remainingStock: currentStock
      }
    }

    // Sort movements by date (newest first for LIFO)
    const sortedMovements = movements
      .filter(m => m.quantity > 0 && m.unitCostAtTime > 0) // Only inbound with cost
      .sort((a, b) => b.movementDate.getTime() - a.movementDate.getTime())

    const costLayers: CostLayer[] = []
    let remainingToAllocate = currentStock
    let totalValue = 0

    for (const movement of sortedMovements) {
      if (remainingToAllocate <= 0) break

      const quantityToUse = Math.min(remainingToAllocate, movement.quantity)
      const layerCost = quantityToUse * movement.unitCostAtTime

      costLayers.push({
        quantity: quantityToUse,
        unitCost: movement.unitCostAtTime,
        totalCost: layerCost,
        acquisitionDate: movement.movementDate,
        batchReference: `LIFO-${movement.id}`
      })

      totalValue += layerCost
      remainingToAllocate -= quantityToUse
    }

    const weightedAverageUnitCost = currentStock > 0 ? totalValue / currentStock : 0

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      unitCost: Math.round(weightedAverageUnitCost * 100) / 100,
      method: 'LIFO',
      breakdown: costLayers,
      calculatedAt: new Date(),
      remainingStock: currentStock
    }
  }

  // Weighted Average Cost Calculation
  static calculateWeightedAverage(movements: StockMovementData[], currentStock: number): ValuationResult {
    if (currentStock <= 0) {
      return {
        totalValue: 0,
        unitCost: 0,
        method: 'WEIGHTED_AVERAGE',
        breakdown: [],
        calculatedAt: new Date(),
        remainingStock: currentStock
      }
    }

    // Calculate weighted average from all inbound movements
    const inboundMovements = movements.filter(m => m.quantity > 0 && m.unitCostAtTime > 0)

    let totalQuantity = 0
    let totalCost = 0

    // Calculate total cost and quantity
    for (const movement of inboundMovements) {
      totalQuantity += movement.quantity
      totalCost += movement.quantity * movement.unitCostAtTime
    }

    const weightedAverageUnitCost = totalQuantity > 0 ? totalCost / totalQuantity : 0
    const totalValue = currentStock * weightedAverageUnitCost

    // Create single cost layer for weighted average
    const costLayer: CostLayer = {
      quantity: currentStock,
      unitCost: weightedAverageUnitCost,
      totalCost: totalValue,
      acquisitionDate: new Date(), // Use current date for weighted average
      batchReference: 'WEIGHTED_AVERAGE'
    }

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      unitCost: Math.round(weightedAverageUnitCost * 100) / 100,
      method: 'WEIGHTED_AVERAGE',
      breakdown: [costLayer],
      calculatedAt: new Date(),
      remainingStock: currentStock
    }
  }

  // Calculate valuation for a specific title in a warehouse
  static async calculateTitleWarehouseValuation(
    titleId: number,
    warehouseId: number
  ): Promise<WarehouseValuation | null> {
    try {
      // Get inventory record
      const inventory = await dbClient.inventory.findFirst({
        where: {
          titleId,
          warehouseId
        },
        include: {
          title: {
            select: {
              title: true,
              isbn: true
            }
          },
          warehouse: {
            select: {
              name: true
            }
          }
        }
      })

      if (!inventory) {
        return null
      }

      // Get all stock movements for this title-warehouse combination
      const movements = await dbClient.stockMovement.findMany({
        where: {
          titleId,
          warehouseId,
          unitCostAtTime: {
            not: null
          }
        },
        select: {
          id: true,
          quantity: true,
          unitCostAtTime: true,
          movementDate: true,
          movementType: true,
          warehouseId: true,
          titleId: true
        },
        orderBy: {
          movementDate: 'asc'
        }
      })

      const movementData: StockMovementData[] = movements.map(m => ({
        id: m.id,
        quantity: m.quantity,
        unitCostAtTime: Number(m.unitCostAtTime || 0),
        movementDate: m.movementDate,
        movementType: m.movementType,
        warehouseId: m.warehouseId,
        titleId: m.titleId
      }))

      // Calculate all three valuation methods
      const fifoValuation = this.calculateFIFO(movementData, inventory.currentStock)
      const lifoValuation = this.calculateLIFO(movementData, inventory.currentStock)
      const weightedAverageValuation = this.calculateWeightedAverage(movementData, inventory.currentStock)

      // Determine recommended method (for publishing, FIFO is typically preferred for tax purposes)
      let recommendedMethod: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE' = 'FIFO'

      return {
        warehouseId,
        warehouseName: inventory.warehouse.name,
        titleId,
        titleName: inventory.title.title,
        isbn: inventory.title.isbn,
        currentStock: inventory.currentStock,
        fifoValuation,
        lifoValuation,
        weightedAverageValuation,
        recommendedMethod,
        lastUpdated: new Date()
      }
    } catch (error) {
      console.error('Error calculating warehouse valuation:', error)
      return null
    }
  }

  // Update inventory valuation using specified method
  static async updateInventoryValuation(
    titleId: number,
    warehouseId: number,
    method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'
  ): Promise<{ success: boolean; message: string; valuation?: ValuationResult }> {
    try {
      const warehouseValuation = await this.calculateTitleWarehouseValuation(titleId, warehouseId)

      if (!warehouseValuation) {
        return {
          success: false,
          message: 'Inventory record not found'
        }
      }

      let selectedValuation: ValuationResult

      switch (method) {
        case 'FIFO':
          selectedValuation = warehouseValuation.fifoValuation
          break
        case 'LIFO':
          selectedValuation = warehouseValuation.lifoValuation
          break
        case 'WEIGHTED_AVERAGE':
          selectedValuation = warehouseValuation.weightedAverageValuation
          break
      }

      // Update inventory record with new valuation
      await dbClient.inventory.update({
        where: {
          titleId_warehouseId: {
            titleId,
            warehouseId
          }
        },
        data: {
          averageCost: selectedValuation.unitCost,
          totalValue: selectedValuation.totalValue,
          lastCostUpdate: new Date()
        }
      })

      return {
        success: true,
        message: `Inventory valuation updated using ${method} method`,
        valuation: selectedValuation
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update inventory valuation'
      }
    }
  }

  // Generate aging report for inventory
  static async generateAgingReport(warehouseId?: number): Promise<AgingReport[]> {
    try {
      const whereClause: any = {
        currentStock: {
          gt: 0
        }
      }

      if (warehouseId) {
        whereClause.warehouseId = warehouseId
      }

      const inventoryItems = await dbClient.inventory.findMany({
        where: whereClause,
        include: {
          title: {
            select: {
              title: true,
              isbn: true,
              publicationDate: true
            }
          },
          warehouse: {
            select: {
              name: true
            }
          }
        }
      })

      const agingReports: AgingReport[] = []

      for (const inventory of inventoryItems) {
        // Get the first inbound movement (earliest acquisition)
        const firstMovement = await dbClient.stockMovement.findFirst({
          where: {
            titleId: inventory.titleId,
            warehouseId: inventory.warehouseId,
            quantity: {
              gt: 0
            }
          },
          orderBy: {
            movementDate: 'asc'
          }
        })

        if (firstMovement) {
          const ageInDays = Math.floor(
            (new Date().getTime() - firstMovement.movementDate.getTime()) / (1000 * 60 * 60 * 24)
          )

          // Determine obsolescence risk based on age
          let obsolescenceRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
          let recommendedAction: 'NONE' | 'MONITOR' | 'DISCOUNT' | 'WRITE_OFF'

          if (ageInDays < 365) {
            obsolescenceRisk = 'LOW'
            recommendedAction = 'NONE'
          } else if (ageInDays < 730) {
            obsolescenceRisk = 'MEDIUM'
            recommendedAction = 'MONITOR'
          } else if (ageInDays < 1095) {
            obsolescenceRisk = 'HIGH'
            recommendedAction = 'DISCOUNT'
          } else {
            obsolescenceRisk = 'CRITICAL'
            recommendedAction = 'WRITE_OFF'
          }

          agingReports.push({
            titleId: inventory.titleId,
            warehouseId: inventory.warehouseId,
            ageInDays,
            quantity: inventory.currentStock,
            unitCost: Number(inventory.averageCost || 0),
            totalValue: Number(inventory.totalValue || 0),
            obsolescenceRisk,
            recommendedAction
          })
        }
      }

      return agingReports.sort((a, b) => b.ageInDays - a.ageInDays) // Oldest first
    } catch (error) {
      console.error('Error generating aging report:', error)
      return []
    }
  }

  // Create valuation adjustment
  static async createValuationAdjustment(adjustment: ValuationAdjustment): Promise<{
    success: boolean
    message: string
    adjustmentId?: number
  }> {
    try {
      return await dbClient.$transaction(async (tx) => {
        // Verify inventory exists
        const inventory = await tx.inventory.findFirst({
          where: {
            titleId: adjustment.titleId,
            warehouseId: adjustment.warehouseId
          }
        })

        if (!inventory) {
          throw new Error('Inventory record not found')
        }

        // Create stock movement record for the adjustment
        const movementType = adjustment.adjustmentType === 'WRITE_OFF' ? 'DAMAGED' : 'DAMAGED' // Could add new enum values

        const stockMovement = await tx.stockMovement.create({
          data: {
            titleId: adjustment.titleId,
            warehouseId: adjustment.warehouseId,
            movementType: movementType as any,
            quantity: adjustment.adjustmentType === 'WRITE_OFF' ? -inventory.currentStock : 0,
            movementDate: adjustment.effectiveDate,
            unitCostAtTime: Number(inventory.averageCost || 0),
            notes: `Valuation adjustment: ${adjustment.adjustmentType} - ${adjustment.reason}`
          }
        })

        // Update inventory valuation
        const newAverageCost = adjustment.adjustmentType === 'WRITE_OFF' ? 0 :
                               (adjustment.adjustedValue / inventory.currentStock)

        await tx.inventory.update({
          where: {
            titleId_warehouseId: {
              titleId: adjustment.titleId,
              warehouseId: adjustment.warehouseId
            }
          },
          data: {
            averageCost: newAverageCost,
            totalValue: adjustment.adjustmentType === 'WRITE_OFF' ? 0 : adjustment.adjustedValue,
            lastCostUpdate: new Date(),
            ...(adjustment.adjustmentType === 'WRITE_OFF' && { currentStock: 0 })
          }
        })

        return {
          success: true,
          message: `Valuation adjustment applied: ${adjustment.adjustmentType}`,
          adjustmentId: stockMovement.id
        }
      })
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create valuation adjustment'
      }
    }
  }

  // Get summary valuation across all warehouses for a title
  static async getTitleValuationSummary(titleId: number): Promise<{
    titleId: number
    titleName: string
    isbn: string
    totalStock: number
    totalValue: number
    averageUnitCost: number
    warehouseBreakdown: WarehouseValuation[]
  } | null> {
    try {
      const title = await dbClient.title.findUnique({
        where: { id: titleId },
        select: { title: true, isbn: true }
      })

      if (!title) {
        return null
      }

      const inventoryRecords = await dbClient.inventory.findMany({
        where: {
          titleId,
          currentStock: {
            gt: 0
          }
        }
      })

      const warehouseBreakdown: WarehouseValuation[] = []
      let totalStock = 0
      let totalValue = 0

      for (const inventory of inventoryRecords) {
        const warehouseValuation = await this.calculateTitleWarehouseValuation(
          titleId,
          inventory.warehouseId
        )

        if (warehouseValuation) {
          warehouseBreakdown.push(warehouseValuation)
          totalStock += warehouseValuation.currentStock
          totalValue += warehouseValuation.fifoValuation.totalValue // Using FIFO as default
        }
      }

      const averageUnitCost = totalStock > 0 ? totalValue / totalStock : 0

      return {
        titleId,
        titleName: title.title,
        isbn: title.isbn,
        totalStock,
        totalValue: Math.round(totalValue * 100) / 100,
        averageUnitCost: Math.round(averageUnitCost * 100) / 100,
        warehouseBreakdown
      }
    } catch (error) {
      console.error('Error generating title valuation summary:', error)
      return null
    }
  }
}

export default InventoryValuationService