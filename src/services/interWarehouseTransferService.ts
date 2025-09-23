import { PrismaClient, TransferStatus, MovementType } from '@prisma/client'
import RealTimeInventoryService, { setDbClient as setRealTimeDbClient } from './realTimeInventoryService'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
  setRealTimeDbClient(client)
}

// Types and Interfaces
export interface TransferRequest {
  titleId: number
  sourceWarehouseId: number
  destinationWarehouseId: number
  quantity: number
  requestedBy: string
  reason: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  requestedDate?: Date
  notes?: string
}

export interface TransferApproval {
  transferId: string
  approvedBy: string
  approvalNotes?: string
  scheduledDate?: Date
}

export interface TransferTracking {
  transferId: string
  status: TransferStatus
  location?: string
  estimatedArrival?: Date
  carrier?: string
  trackingNumber?: string
  notes?: string
}

export interface TransferCost {
  baseCost: number
  distanceCost: number
  priorityCost: number
  handlingCost: number
  totalCost: number
  currency: string
}

export interface TransferAnalytics {
  transferId: string
  duration: number // hours
  cost: number
  efficiency: number // 0-100 score
  onTimeDelivery: boolean
  qualityIssues: number
}

export interface TransferResult {
  success: boolean
  transferId?: string
  message: string
  estimatedCost?: TransferCost
  estimatedDuration?: number
  trackingInfo?: any
}

export interface TransferSummary {
  totalTransfers: number
  completedTransfers: number
  pendingTransfers: number
  averageDuration: number
  averageCost: number
  onTimePercentage: number
  totalValue: number
}

class InterWarehouseTransferService {
  // Helper methods for metadata management
  private static parseMetadata(notes: string | null): any {
    if (!notes) return {}

    const metadataMatch = notes.match(/Metadata: ({.*})/)
    if (metadataMatch) {
      try {
        return JSON.parse(metadataMatch[1])
      } catch (e) {
        return {}
      }
    }
    return {}
  }

  private static updateMetadata(notes: string | null, updatedMetadata: any): string {
    const baseNotes = notes?.split(' Metadata:')[0] || ''
    return `${baseNotes} Metadata: ${JSON.stringify(updatedMetadata)}`
  }
  // Transfer Request Management
  static async createTransferRequest(request: TransferRequest): Promise<TransferResult> {
    try {
      return await dbClient.$transaction(async (tx) => {
        // Validate source inventory
        const sourceInventory = await tx.inventory.findFirst({
          where: {
            titleId: request.titleId,
            warehouseId: request.sourceWarehouseId
          },
          include: {
            title: { select: { title: true, isbn: true } },
            warehouse: { select: { name: true, location: true } }
          }
        })

        if (!sourceInventory) {
          throw new Error('Source inventory not found')
        }

        if (sourceInventory.currentStock < request.quantity) {
          throw new Error(`Insufficient stock. Available: ${sourceInventory.currentStock}, Requested: ${request.quantity}`)
        }

        // Validate destination warehouse
        const destinationWarehouse = await tx.warehouse.findUnique({
          where: { id: request.destinationWarehouseId },
          select: { name: true, location: true }
        })

        if (!destinationWarehouse) {
          throw new Error('Destination warehouse not found')
        }

        // Calculate estimated cost
        const estimatedCost = await this.calculateTransferCost(
          request.sourceWarehouseId,
          request.destinationWarehouseId,
          request.quantity,
          request.priority || 'MEDIUM'
        )

        // Create transfer record
        const transferId = `TXF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`

        const transferMetadata = {
          destinationWarehouseId: request.destinationWarehouseId,
          requestedBy: request.requestedBy,
          priority: request.priority || 'MEDIUM',
          estimatedCost: estimatedCost.totalCost,
          status: 'PENDING_APPROVAL',
          requestedDate: request.requestedDate || new Date(),
          notes: request.notes
        }

        const transfer = await tx.stockMovement.create({
          data: {
            titleId: request.titleId,
            warehouseId: request.sourceWarehouseId,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: -request.quantity, // Negative for outbound
            referenceNumber: transferId,
            movementDate: new Date(),
            destinationWarehouseId: request.destinationWarehouseId,
            notes: `Transfer to ${destinationWarehouse.name} - ${request.reason}. Metadata: ${JSON.stringify(transferMetadata)}`
          }
        })

        // Reserve stock at source
        await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: {
            reservedStock: sourceInventory.reservedStock + request.quantity
          }
        })

        return {
          success: true,
          transferId,
          message: `Transfer request created successfully`,
          estimatedCost,
          estimatedDuration: this.estimateTransferDuration(
            sourceInventory.warehouse.location,
            destinationWarehouse.location,
            request.priority || 'MEDIUM'
          )
        }
      })
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create transfer request'
      }
    }
  }

  // Transfer Approval Workflow
  static async approveTransfer(approval: TransferApproval): Promise<TransferResult> {
    try {
      return await dbClient.$transaction(async (tx) => {
        // Find transfer request
        const transfer = await tx.stockMovement.findFirst({
          where: {
            referenceNumber: approval.transferId,
            movementType: 'WAREHOUSE_TRANSFER'
          },
          include: {
            title: { select: { title: true, isbn: true } },
            warehouse: { select: { name: true, location: true } }
          }
        })

        if (!transfer) {
          throw new Error('Transfer request not found')
        }

        const metadata = this.parseMetadata(transfer.notes)

        if (metadata?.status !== 'PENDING_APPROVAL') {
          throw new Error('Transfer is not pending approval')
        }

        // Update metadata with approval information
        const updatedMetadata = {
          ...metadata,
          status: 'APPROVED',
          approvedBy: approval.approvedBy,
          approvedDate: new Date(),
          approvalNotes: approval.approvalNotes,
          scheduledDate: approval.scheduledDate || new Date()
        }

        await tx.stockMovement.update({
          where: { id: transfer.id },
          data: {
            notes: this.updateMetadata(transfer.notes, updatedMetadata)
          }
        })

        return {
          success: true,
          transferId: approval.transferId,
          message: 'Transfer approved successfully'
        }
      })
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to approve transfer'
      }
    }
  }

  // Transfer Execution
  static async executeTransfer(transferId: string, executedBy: string): Promise<TransferResult> {
    try {
      return await dbClient.$transaction(async (tx) => {
        // Find approved transfer
        const transfer = await tx.stockMovement.findFirst({
          where: {
            referenceNumber: transferId,
            movementType: 'WAREHOUSE_TRANSFER'
          }
        })

        if (!transfer) {
          throw new Error('Transfer not found')
        }

        const metadata = this.parseMetadata(transfer.notes)
        if (metadata?.status !== 'APPROVED') {
          throw new Error('Transfer is not approved')
        }

        const destinationWarehouseId = metadata.destinationWarehouseId
        const quantity = Math.abs(transfer.quantity)

        // Execute the actual transfer using RealTimeInventoryService
        const transferResult = await RealTimeInventoryService.synchronizeTransfer(
          transfer.warehouseId,
          destinationWarehouseId,
          transfer.titleId,
          quantity,
          transferId
        )

        // Update transfer status to in transit
        const updatedMetadata = {
          ...metadata,
          status: 'IN_TRANSIT',
          executedBy,
          executedDate: new Date()
        }

        await tx.stockMovement.update({
          where: { id: transfer.id },
          data: {
            notes: this.updateMetadata(transfer.notes, updatedMetadata)
          }
        })

        return {
          success: true,
          transferId,
          message: 'Transfer executed successfully',
          trackingInfo: transferResult
        }
      })
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to execute transfer'
      }
    }
  }

  // Transfer Tracking and Status Updates
  static async updateTransferTracking(tracking: TransferTracking): Promise<TransferResult> {
    try {
      const transfer = await dbClient.stockMovement.findFirst({
        where: {
          referenceNumber: tracking.transferId,
          movementType: 'WAREHOUSE_TRANSFER'
        }
      })

      if (!transfer) {
        throw new Error('Transfer not found')
      }

      const metadata = this.parseMetadata(transfer.notes)

      const updatedMetadata = {
        ...metadata,
        status: tracking.status,
        tracking: {
          location: tracking.location,
          estimatedArrival: tracking.estimatedArrival,
          carrier: tracking.carrier,
          trackingNumber: tracking.trackingNumber,
          notes: tracking.notes,
          lastUpdated: new Date()
        }
      }

      await dbClient.stockMovement.update({
        where: { id: transfer.id },
        data: {
          notes: this.updateMetadata(transfer.notes, updatedMetadata)
        }
      })

      return {
        success: true,
        transferId: tracking.transferId,
        message: 'Tracking updated successfully'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update tracking'
      }
    }
  }

  // Complete Transfer
  static async completeTransfer(transferId: string, completedBy: string): Promise<TransferResult> {
    try {
      return await dbClient.$transaction(async (tx) => {
        const transfer = await tx.stockMovement.findFirst({
          where: {
            referenceNumber: transferId,
            movementType: 'WAREHOUSE_TRANSFER'
          }
        })

        if (!transfer) {
          throw new Error('Transfer not found')
        }

        const metadata = this.parseMetadata(transfer.notes)

        // Update transfer status
        const updatedMetadata = {
          ...metadata,
          status: 'COMPLETED',
          completedBy,
          completedDate: new Date()
        }

        await tx.stockMovement.update({
          where: { id: transfer.id },
          data: {
            notes: this.updateMetadata(transfer.notes, updatedMetadata)
          }
        })

        // Generate analytics
        const analytics = await this.generateTransferAnalytics(transferId)

        return {
          success: true,
          transferId,
          message: 'Transfer completed successfully',
          trackingInfo: { analytics }
        }
      })
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to complete transfer'
      }
    }
  }

  // Cost Calculation
  static async calculateTransferCost(
    sourceWarehouseId: number,
    destinationWarehouseId: number,
    quantity: number,
    priority: string
  ): Promise<TransferCost> {
    try {
      const [sourceWarehouse, destinationWarehouse] = await Promise.all([
        dbClient.warehouse.findUnique({
          where: { id: sourceWarehouseId },
          select: { location: true }
        }),
        dbClient.warehouse.findUnique({
          where: { id: destinationWarehouseId },
          select: { location: true }
        })
      ])

      if (!sourceWarehouse || !destinationWarehouse) {
        throw new Error('Warehouse not found')
      }

      // Base cost calculation (simplified)
      const baseCost = quantity * 0.50 // £0.50 per unit
      const distance = this.estimateDistance(sourceWarehouse.location, destinationWarehouse.location)
      const distanceCost = distance * 0.02 // £0.02 per km per unit

      const priorityMultiplier = {
        'LOW': 0.8,
        'MEDIUM': 1.0,
        'HIGH': 1.5,
        'URGENT': 2.0
      }[priority] || 1.0

      const priorityCost = baseCost * (priorityMultiplier - 1)
      const handlingCost = quantity * 0.25 // £0.25 handling per unit

      return {
        baseCost: Math.round(baseCost * 100) / 100,
        distanceCost: Math.round(distanceCost * 100) / 100,
        priorityCost: Math.round(priorityCost * 100) / 100,
        handlingCost: Math.round(handlingCost * 100) / 100,
        totalCost: Math.round((baseCost + distanceCost + priorityCost + handlingCost) * 100) / 100,
        currency: 'GBP'
      }
    } catch (error) {
      // Return default cost if calculation fails
      return {
        baseCost: quantity * 0.50,
        distanceCost: 0,
        priorityCost: 0,
        handlingCost: quantity * 0.25,
        totalCost: quantity * 0.75,
        currency: 'GBP'
      }
    }
  }

  // Analytics and Performance
  static async generateTransferAnalytics(transferId: string): Promise<TransferAnalytics> {
    try {
      const transfer = await dbClient.stockMovement.findFirst({
        where: {
          referenceNumber: transferId,
          movementType: 'WAREHOUSE_TRANSFER'
        }
      })

      if (!transfer) {
        throw new Error('Transfer not found')
      }

      const metadata = this.parseMetadata(transfer.notes)

      if (!metadata) {
        throw new Error('Transfer metadata not found')
      }

      const startDate = new Date(metadata.executedDate || metadata.approvedDate)
      const endDate = new Date(metadata.completedDate || new Date())
      const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) // hours

      // Calculate efficiency score (0-100)
      const expectedDuration = this.estimateTransferDuration(
        '', '', metadata.priority || 'MEDIUM'
      )
      const efficiency = Math.max(0, Math.min(100, 100 - ((duration - expectedDuration) / expectedDuration) * 50))

      return {
        transferId,
        duration: Math.round(duration * 100) / 100,
        cost: metadata.estimatedCost || 0,
        efficiency: Math.round(efficiency),
        onTimeDelivery: duration <= expectedDuration * 1.1, // 10% tolerance
        qualityIssues: 0 // Would be tracked separately
      }
    } catch (error) {
      return {
        transferId,
        duration: 0,
        cost: 0,
        efficiency: 0,
        onTimeDelivery: false,
        qualityIssues: 0
      }
    }
  }

  static async getTransferSummary(warehouseId?: number, dateFrom?: Date, dateTo?: Date): Promise<TransferSummary> {
    try {
      const whereClause: any = {
        movementType: 'WAREHOUSE_TRANSFER'
      }

      if (warehouseId) {
        whereClause.warehouseId = warehouseId
      }

      if (dateFrom || dateTo) {
        whereClause.createdAt = {}
        if (dateFrom) whereClause.createdAt.gte = dateFrom
        if (dateTo) whereClause.createdAt.lte = dateTo
      }

      const transfers = await dbClient.stockMovement.findMany({
        where: whereClause,
        include: {
          title: { select: { rrp: true } }
        }
      })

      let completedTransfers = 0
      let totalDuration = 0
      let totalCost = 0
      let onTimeCount = 0
      let totalValue = 0

      for (const transfer of transfers) {
        const metadata = this.parseMetadata(transfer.notes)

        if (metadata?.status === 'COMPLETED') {
          completedTransfers++

          if (metadata.completedDate && metadata.executedDate) {
            const duration = (new Date(metadata.completedDate).getTime() - new Date(metadata.executedDate).getTime()) / (1000 * 60 * 60)
            totalDuration += duration

            const expectedDuration = this.estimateTransferDuration('', '', metadata.priority || 'MEDIUM')
            if (duration <= expectedDuration * 1.1) {
              onTimeCount++
            }
          }

          if (metadata.estimatedCost) {
            totalCost += metadata.estimatedCost
          }
        }

        totalValue += Math.abs(transfer.quantity) * (transfer.title.rrp || 0)
      }

      return {
        totalTransfers: transfers.length,
        completedTransfers,
        pendingTransfers: transfers.length - completedTransfers,
        averageDuration: completedTransfers > 0 ? Math.round((totalDuration / completedTransfers) * 100) / 100 : 0,
        averageCost: completedTransfers > 0 ? Math.round((totalCost / completedTransfers) * 100) / 100 : 0,
        onTimePercentage: completedTransfers > 0 ? Math.round((onTimeCount / completedTransfers) * 100) : 0,
        totalValue: Math.round(totalValue * 100) / 100
      }
    } catch (error) {
      return {
        totalTransfers: 0,
        completedTransfers: 0,
        pendingTransfers: 0,
        averageDuration: 0,
        averageCost: 0,
        onTimePercentage: 0,
        totalValue: 0
      }
    }
  }

  // Helper Methods
  private static estimateDistance(location1: string, location2: string): number {
    // Simplified distance calculation based on UK locations
    const distances: { [key: string]: number } = {
      'Manchester-London': 330,
      'London-Manchester': 330,
      'Birmingham-London': 190,
      'London-Birmingham': 190,
      'Manchester-Birmingham': 140,
      'Birmingham-Manchester': 140
    }

    const key = `${location1.split(',')[0]}-${location2.split(',')[0]}`
    return distances[key] || 200 // Default 200km
  }

  private static estimateTransferDuration(location1: string, location2: string, priority: string): number {
    const distance = this.estimateDistance(location1, location2)
    const baseHours = Math.max(2, distance / 50) // 50km/h average including loading

    const priorityMultiplier = {
      'LOW': 1.5,
      'MEDIUM': 1.0,
      'HIGH': 0.7,
      'URGENT': 0.5
    }[priority] || 1.0

    return Math.round(baseHours * priorityMultiplier * 100) / 100
  }
}

export default InterWarehouseTransferService