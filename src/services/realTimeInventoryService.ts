import { PrismaClient, Inventory, StockMovement, Warehouse, Prisma } from '@prisma/client'
import { EventEmitter } from 'events'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Types and Interfaces
export interface InventoryUpdateEvent {
  type: 'STOCK_CHANGE' | 'RESERVATION_CHANGE' | 'TRANSFER' | 'ADJUSTMENT'
  inventoryId: number
  warehouseId: number
  titleId: number
  previousStock: number
  newStock: number
  changeAmount: number
  reason: string
  timestamp: Date
  userId?: string
  batchId?: string
}

export interface LiveInventoryLevel {
  inventoryId: number
  titleId: number
  warehouseId: number
  currentStock: number
  reservedStock: number
  availableStock: number
  lastUpdated: Date
  title: {
    isbn: string
    title: string
    author: string
  }
  warehouse: {
    name: string
    code: string
    location: string
  }
}

export interface StockLevelSubscription {
  subscriberId: string
  warehouseIds?: number[]
  titleIds?: number[]
  threshold?: number
  callback: (update: InventoryUpdateEvent) => void
}

export interface InventorySnapshot {
  timestamp: Date
  warehouseId: number
  totalSkus: number
  totalStock: number
  totalValue: number
  inventoryItems: Array<{
    titleId: number
    currentStock: number
    reservedStock: number
    availableStock: number
    averageCost: number
    totalValue: number
  }>
}

export interface StockMovementRequest {
  titleId: number
  warehouseId: number
  movementType: 'PRINT_RECEIVED' | 'WAREHOUSE_TRANSFER' | 'ONLINE_SALES' | 'UK_TRADE_SALES' | 'US_TRADE_SALES' | 'ROW_TRADE_SALES' | 'DIRECT_SALES'
  quantity: number
  reason: string
  reference?: string
  userId?: string
  batchId?: string
  sourceWarehouseId?: number
  destinationWarehouseId?: number
}

export class RealTimeInventoryService extends EventEmitter {
  private static instance: RealTimeInventoryService
  private subscribers: Map<string, StockLevelSubscription> = new Map()
  private updateQueue: InventoryUpdateEvent[] = []
  private processing = false

  private constructor() {
    super()
    this.setMaxListeners(100) // Allow many subscribers
  }

  static getInstance(): RealTimeInventoryService {
    if (!RealTimeInventoryService.instance) {
      RealTimeInventoryService.instance = new RealTimeInventoryService()
    }
    return RealTimeInventoryService.instance
  }

  /**
   * Sub-task 1: Implement live inventory level updates across warehouses
   */

  // Get real-time inventory levels for a warehouse
  static async getLiveInventoryLevels(warehouseId: number): Promise<LiveInventoryLevel[]> {
    try {
      const inventoryItems = await dbClient.inventory.findMany({
        where: { warehouseId },
        include: {
          title: {
            select: {
              isbn: true,
              title: true,
              author: true
            }
          },
          warehouse: {
            select: {
              name: true,
              code: true,
              location: true
            }
          }
        },
        orderBy: {
          title: {
            title: 'asc'
          }
        }
      })

      return inventoryItems.map(item => ({
        inventoryId: item.id,
        titleId: item.titleId,
        warehouseId: item.warehouseId,
        currentStock: item.currentStock,
        reservedStock: item.reservedStock,
        availableStock: item.currentStock - item.reservedStock,
        lastUpdated: item.updatedAt,
        title: item.title,
        warehouse: item.warehouse
      }))
    } catch (error) {
      throw new Error('Failed to get live inventory levels')
    }
  }

  // Get real-time inventory levels for a specific title across all warehouses
  static async getTitleInventoryAcrossWarehouses(titleId: number): Promise<LiveInventoryLevel[]> {
    try {
      const inventoryItems = await dbClient.inventory.findMany({
        where: { titleId },
        include: {
          title: {
            select: {
              isbn: true,
              title: true,
              author: true
            }
          },
          warehouse: {
            select: {
              name: true,
              code: true,
              location: true
            }
          }
        },
        orderBy: {
          warehouse: {
            name: 'asc'
          }
        }
      })

      return inventoryItems.map(item => ({
        inventoryId: item.id,
        titleId: item.titleId,
        warehouseId: item.warehouseId,
        currentStock: item.currentStock,
        reservedStock: item.reservedStock,
        availableStock: item.currentStock - item.reservedStock,
        lastUpdated: item.updatedAt,
        title: item.title,
        warehouse: item.warehouse
      }))
    } catch (error) {
      throw new Error('Failed to get title inventory across warehouses')
    }
  }

  // Update inventory levels and trigger real-time events
  static async updateInventoryLevel(
    inventoryId: number,
    stockChange: number,
    reason: string,
    userId?: string,
    batchId?: string
  ): Promise<LiveInventoryLevel> {
    try {
      const result = await dbClient.$transaction(async (tx) => {
        // Get current inventory state
        const currentInventory = await tx.inventory.findUnique({
          where: { id: inventoryId },
          include: {
            title: {
              select: {
                isbn: true,
                title: true,
                author: true
              }
            },
            warehouse: {
              select: {
                name: true,
                code: true,
                location: true
              }
            }
          }
        })

        if (!currentInventory) {
          throw new Error('Inventory record not found')
        }

        const previousStock = currentInventory.currentStock
        const newStock = Math.max(0, previousStock + stockChange)

        // Update inventory record
        const updatedInventory = await tx.inventory.update({
          where: { id: inventoryId },
          data: {
            currentStock: newStock,
            lastMovementDate: new Date()
          },
          include: {
            title: {
              select: {
                isbn: true,
                title: true,
                author: true
              }
            },
            warehouse: {
              select: {
                name: true,
                code: true,
                location: true
              }
            }
          }
        })

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            titleId: currentInventory.titleId,
            warehouseId: currentInventory.warehouseId,
            movementType: stockChange > 0 ? 'PRINT_RECEIVED' : stockChange < 0 ? 'ONLINE_SALES' : 'WAREHOUSE_TRANSFER',
            quantity: stockChange,
            movementDate: new Date(),
            referenceNumber: reason,
            notes: `Live update: ${reason}`,
            rrpAtTime: currentInventory.title.rrp || new Prisma.Decimal(0),
            batchNumber: batchId
          }
        })

        return updatedInventory
      })

      // Create update event
      const updateEvent: InventoryUpdateEvent = {
        type: 'STOCK_CHANGE',
        inventoryId,
        warehouseId: result.warehouseId,
        titleId: result.titleId,
        previousStock: result.currentStock - stockChange,
        newStock: result.currentStock,
        changeAmount: stockChange,
        reason,
        timestamp: new Date(),
        userId,
        batchId
      }

      // Emit real-time event
      const service = RealTimeInventoryService.getInstance()
      service.emit('inventory-update', updateEvent)

      return {
        inventoryId: result.id,
        titleId: result.titleId,
        warehouseId: result.warehouseId,
        currentStock: result.currentStock,
        reservedStock: result.reservedStock,
        availableStock: result.currentStock - result.reservedStock,
        lastUpdated: result.updatedAt,
        title: result.title,
        warehouse: result.warehouse
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to update inventory level')
    }
  }

  // Process bulk inventory updates atomically
  static async processBulkInventoryUpdates(
    updates: Array<{
      inventoryId: number
      stockChange: number
      reason: string
    }>,
    userId?: string,
    batchId?: string
  ): Promise<LiveInventoryLevel[]> {
    try {
      const results = await dbClient.$transaction(async (tx) => {
        const updateResults: LiveInventoryLevel[] = []

        for (const update of updates) {
          const currentInventory = await tx.inventory.findUnique({
            where: { id: update.inventoryId },
            include: {
              title: {
                select: {
                  isbn: true,
                  title: true,
                  author: true,
                  rrp: true
                }
              },
              warehouse: {
                select: {
                  name: true,
                  code: true,
                  location: true
                }
              }
            }
          })

          if (!currentInventory) {
            throw new Error(`Inventory record ${update.inventoryId} not found`)
          }

          const previousStock = currentInventory.currentStock
          const newStock = Math.max(0, previousStock + update.stockChange)

          const updatedInventory = await tx.inventory.update({
            where: { id: update.inventoryId },
            data: {
              currentStock: newStock,
              lastMovementDate: new Date()
            },
            include: {
              title: {
                select: {
                  isbn: true,
                  title: true,
                  author: true
                }
              },
              warehouse: {
                select: {
                  name: true,
                  code: true,
                  location: true
                }
              }
            }
          })

          await tx.stockMovement.create({
            data: {
              titleId: currentInventory.titleId,
              warehouseId: currentInventory.warehouseId,
              movementType: update.stockChange > 0 ? 'PRINT_RECEIVED' : update.stockChange < 0 ? 'ONLINE_SALES' : 'WAREHOUSE_TRANSFER',
              quantity: update.stockChange,
              movementDate: new Date(),
              referenceNumber: update.reason,
              notes: `Bulk update: ${update.reason}`,
              rrpAtTime: currentInventory.title.rrp || new Prisma.Decimal(0),
              batchNumber: batchId
            }
          })

          updateResults.push({
            inventoryId: updatedInventory.id,
            titleId: updatedInventory.titleId,
            warehouseId: updatedInventory.warehouseId,
            currentStock: updatedInventory.currentStock,
            reservedStock: updatedInventory.reservedStock,
            availableStock: updatedInventory.currentStock - updatedInventory.reservedStock,
            lastUpdated: updatedInventory.updatedAt,
            title: updatedInventory.title,
            warehouse: updatedInventory.warehouse
          })
        }

        return updateResults
      })

      // Emit bulk update events
      const service = RealTimeInventoryService.getInstance()
      results.forEach((result, index) => {
        const update = updates[index]
        const updateEvent: InventoryUpdateEvent = {
          type: 'STOCK_CHANGE',
          inventoryId: result.inventoryId,
          warehouseId: result.warehouseId,
          titleId: result.titleId,
          previousStock: result.currentStock - update.stockChange,
          newStock: result.currentStock,
          changeAmount: update.stockChange,
          reason: update.reason,
          timestamp: new Date(),
          userId,
          batchId
        }
        service.emit('inventory-update', updateEvent)
      })

      return results
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to process bulk inventory updates')
    }
  }

  /**
   * Sub-task 2: Add inventory change event streaming
   */

  // Subscribe to inventory updates for specific criteria
  subscribe(subscription: StockLevelSubscription): void {
    this.subscribers.set(subscription.subscriberId, subscription)

    // Listen for inventory updates and notify relevant subscribers
    this.on('inventory-update', (event: InventoryUpdateEvent) => {
      const subscriber = this.subscribers.get(subscription.subscriberId)
      if (!subscriber) return

      // Check if this update matches subscriber criteria
      const matchesWarehouse = !subscriber.warehouseIds ||
        subscriber.warehouseIds.includes(event.warehouseId)

      const matchesTitle = !subscriber.titleIds ||
        subscriber.titleIds.includes(event.titleId)

      const meetsThreshold = !subscriber.threshold ||
        Math.abs(event.changeAmount) >= subscriber.threshold

      if (matchesWarehouse && matchesTitle && meetsThreshold) {
        try {
          subscriber.callback(event)
        } catch (error) {
          console.error(`Error in subscriber callback: ${error}`)
        }
      }
    })
  }

  // Unsubscribe from inventory updates
  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId)
    this.removeAllListeners(subscriberId)
  }

  // Get all active subscriptions
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscribers.keys())
  }

  // Emit custom inventory event
  emitInventoryEvent(event: InventoryUpdateEvent): void {
    this.emit('inventory-update', event)
  }

  /**
   * Sub-task 3: Create inventory synchronization between locations
   */

  // Create inventory snapshot for synchronization
  static async createInventorySnapshot(warehouseId: number): Promise<InventorySnapshot> {
    try {
      const inventoryItems = await dbClient.inventory.findMany({
        where: { warehouseId },
        include: {
          title: {
            select: {
              rrp: true
            }
          }
        }
      })

      const totalSkus = inventoryItems.length
      const totalStock = inventoryItems.reduce((sum, item) => sum + item.currentStock, 0)
      const totalValue = inventoryItems.reduce((sum, item) => {
        const averageCost = Number(item.averageCost || 0)
        return sum + (item.currentStock * averageCost)
      }, 0)

      return {
        timestamp: new Date(),
        warehouseId,
        totalSkus,
        totalStock,
        totalValue,
        inventoryItems: inventoryItems.map(item => ({
          titleId: item.titleId,
          currentStock: item.currentStock,
          reservedStock: item.reservedStock,
          availableStock: item.currentStock - item.reservedStock,
          averageCost: Number(item.averageCost || 0),
          totalValue: item.currentStock * Number(item.averageCost || 0)
        }))
      }
    } catch (error) {
      throw new Error('Failed to create inventory snapshot')
    }
  }

  // Compare inventory snapshots between warehouses
  static async compareInventorySnapshots(
    snapshot1: InventorySnapshot,
    snapshot2: InventorySnapshot
  ): Promise<{
    warehouseComparison: {
      warehouse1: number
      warehouse2: number
      timestamp1: Date
      timestamp2: Date
    }
    summary: {
      totalSkuDifference: number
      totalStockDifference: number
      totalValueDifference: number
    }
    titleDifferences: Array<{
      titleId: number
      warehouse1Stock: number
      warehouse2Stock: number
      stockDifference: number
      warehouse1Value: number
      warehouse2Value: number
      valueDifference: number
    }>
  }> {
    try {
      const summary = {
        totalSkuDifference: snapshot1.totalSkus - snapshot2.totalSkus,
        totalStockDifference: snapshot1.totalStock - snapshot2.totalStock,
        totalValueDifference: snapshot1.totalValue - snapshot2.totalValue
      }

      // Create maps for easy lookup
      const warehouse1Items = new Map(
        snapshot1.inventoryItems.map(item => [item.titleId, item])
      )
      const warehouse2Items = new Map(
        snapshot2.inventoryItems.map(item => [item.titleId, item])
      )

      // Find all unique title IDs from both snapshots
      const allTitleIds = new Set([
        ...warehouse1Items.keys(),
        ...warehouse2Items.keys()
      ])

      const titleDifferences = Array.from(allTitleIds).map(titleId => {
        const item1 = warehouse1Items.get(titleId)
        const item2 = warehouse2Items.get(titleId)

        const warehouse1Stock = item1?.currentStock || 0
        const warehouse2Stock = item2?.currentStock || 0
        const warehouse1Value = item1?.totalValue || 0
        const warehouse2Value = item2?.totalValue || 0

        return {
          titleId,
          warehouse1Stock,
          warehouse2Stock,
          stockDifference: warehouse1Stock - warehouse2Stock,
          warehouse1Value,
          warehouse2Value,
          valueDifference: warehouse1Value - warehouse2Value
        }
      }).filter(diff => diff.stockDifference !== 0 || diff.valueDifference !== 0)

      return {
        warehouseComparison: {
          warehouse1: snapshot1.warehouseId,
          warehouse2: snapshot2.warehouseId,
          timestamp1: snapshot1.timestamp,
          timestamp2: snapshot2.timestamp
        },
        summary,
        titleDifferences
      }
    } catch (error) {
      throw new Error('Failed to compare inventory snapshots')
    }
  }

  // Synchronize inventory levels between warehouses (for transfers)
  static async synchronizeTransfer(
    sourceWarehouseId: number,
    destinationWarehouseId: number,
    titleId: number,
    quantity: number,
    reason: string,
    userId?: string
  ): Promise<{
    sourceInventory: LiveInventoryLevel
    destinationInventory: LiveInventoryLevel
    transferId: string
  }> {
    try {
      const transferId = `TRANSFER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const result = await dbClient.$transaction(async (tx) => {
        // Verify source has sufficient stock
        const sourceInventory = await tx.inventory.findFirst({
          where: {
            titleId,
            warehouseId: sourceWarehouseId
          }
        })

        if (!sourceInventory || sourceInventory.currentStock < quantity) {
          throw new Error('Insufficient stock in source warehouse')
        }

        // Update source warehouse (reduce stock)
        const updatedSource = await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: {
            currentStock: sourceInventory.currentStock - quantity,
            lastMovementDate: new Date()
          },
          include: {
            title: {
              select: {
                isbn: true,
                title: true,
                author: true,
                rrp: true
              }
            },
            warehouse: {
              select: {
                name: true,
                code: true,
                location: true
              }
            }
          }
        })

        // Find or create destination inventory
        let destinationInventory = await tx.inventory.findFirst({
          where: {
            titleId,
            warehouseId: destinationWarehouseId
          }
        })

        if (!destinationInventory) {
          destinationInventory = await tx.inventory.create({
            data: {
              titleId,
              warehouseId: destinationWarehouseId,
              currentStock: quantity,
              reservedStock: 0,
              averageCost: sourceInventory.averageCost,
              lastMovementDate: new Date()
            }
          })
        } else {
          destinationInventory = await tx.inventory.update({
            where: { id: destinationInventory.id },
            data: {
              currentStock: destinationInventory.currentStock + quantity,
              lastMovementDate: new Date()
            }
          })
        }

        // Get updated destination with relations
        const updatedDestination = await tx.inventory.findUnique({
          where: { id: destinationInventory.id },
          include: {
            title: {
              select: {
                isbn: true,
                title: true,
                author: true,
                rrp: true
              }
            },
            warehouse: {
              select: {
                name: true,
                code: true,
                location: true
              }
            }
          }
        })

        if (!updatedDestination) {
          throw new Error('Failed to retrieve updated destination inventory')
        }

        // Create stock movement records
        await tx.stockMovement.create({
          data: {
            titleId,
            warehouseId: sourceWarehouseId,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -quantity,
            movementDate: new Date(),
            referenceNumber: `Transfer to ${updatedDestination.warehouse.name}`,
            notes: reason,
            rrpAtTime: updatedSource.title.rrp || new Prisma.Decimal(0),
            destinationWarehouseId,
            batchNumber: transferId
          }
        })

        await tx.stockMovement.create({
          data: {
            titleId,
            warehouseId: destinationWarehouseId,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity,
            movementDate: new Date(),
            referenceNumber: `Transfer from ${updatedSource.warehouse.name}`,
            notes: reason,
            rrpAtTime: updatedDestination.title.rrp || new Prisma.Decimal(0),
            sourceWarehouseId,
            batchNumber: transferId
          }
        })

        return { updatedSource, updatedDestination }
      })

      // Emit transfer events
      const service = RealTimeInventoryService.getInstance()

      service.emit('inventory-update', {
        type: 'TRANSFER',
        inventoryId: result.updatedSource.id,
        warehouseId: sourceWarehouseId,
        titleId,
        previousStock: result.updatedSource.currentStock + quantity,
        newStock: result.updatedSource.currentStock,
        changeAmount: -quantity,
        reason: `Transfer to warehouse ${destinationWarehouseId}`,
        timestamp: new Date(),
        userId,
        batchId: transferId
      })

      service.emit('inventory-update', {
        type: 'TRANSFER',
        inventoryId: result.updatedDestination.id,
        warehouseId: destinationWarehouseId,
        titleId,
        previousStock: result.updatedDestination.currentStock - quantity,
        newStock: result.updatedDestination.currentStock,
        changeAmount: quantity,
        reason: `Transfer from warehouse ${sourceWarehouseId}`,
        timestamp: new Date(),
        userId,
        batchId: transferId
      })

      return {
        sourceInventory: {
          inventoryId: result.updatedSource.id,
          titleId: result.updatedSource.titleId,
          warehouseId: result.updatedSource.warehouseId,
          currentStock: result.updatedSource.currentStock,
          reservedStock: result.updatedSource.reservedStock,
          availableStock: result.updatedSource.currentStock - result.updatedSource.reservedStock,
          lastUpdated: result.updatedSource.updatedAt,
          title: result.updatedSource.title,
          warehouse: result.updatedSource.warehouse
        },
        destinationInventory: {
          inventoryId: result.updatedDestination.id,
          titleId: result.updatedDestination.titleId,
          warehouseId: result.updatedDestination.warehouseId,
          currentStock: result.updatedDestination.currentStock,
          reservedStock: result.updatedDestination.reservedStock,
          availableStock: result.updatedDestination.currentStock - result.updatedDestination.reservedStock,
          lastUpdated: result.updatedDestination.updatedAt,
          title: result.updatedDestination.title,
          warehouse: result.updatedDestination.warehouse
        },
        transferId
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to synchronize transfer')
    }
  }
}

// Export service and types
export default RealTimeInventoryService