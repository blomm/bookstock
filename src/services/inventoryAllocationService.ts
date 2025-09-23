import { PrismaClient, Inventory, Prisma } from '@prisma/client'
import RealTimeInventoryService from './realTimeInventoryService'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Types and Interfaces
export interface ReservationRequest {
  titleId: number
  warehouseId: number
  quantity: number
  orderId: string
  customerId: string
  expirationDate?: Date
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface AllocationRequest {
  titleId: number
  quantity: number
  customerId: string
  preferredWarehouseIds?: number[]
  maxWarehouses?: number
  customerTier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  channelType?: 'UK_TRADE_SALES' | 'US_TRADE_SALES' | 'ROW_TRADE_SALES' | 'ONLINE_SALES' | 'DIRECT_SALES'
}

export interface AllocationResult {
  success: boolean
  totalAllocated: number
  totalRequested: number
  allocations: Array<{
    warehouseId: number
    quantity: number
    reservationId: string
    warehouseName: string
    warehouseLocation: string
    cost: number
    distance?: number
  }>
  unallocatedQuantity: number
  recommendations?: Array<{
    type: 'REORDER' | 'TRANSFER' | 'BACKORDER'
    message: string
    warehouseId?: number
    estimatedDate?: Date
  }>
}

export interface AtpCalculation {
  titleId: number
  warehouseId: number
  currentStock: number
  reservedStock: number
  minStockLevel: number
  incomingStock: number
  atpQuantity: number
  effectiveDate: Date
  warehouseName: string
  notes?: string
}

export interface ReservationRecord {
  id: string
  titleId: number
  warehouseId: number
  quantity: number
  orderId: string
  customerId: string
  status: 'ACTIVE' | 'EXPIRED' | 'FULFILLED' | 'CANCELLED'
  createdAt: Date
  expirationDate: Date
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  notes?: string
}

export interface AllocationPriority {
  customerId: string
  customerTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  warehouseId: number
  warehouseName: string
  location: string
  fulfillmentCost: number
  distanceScore: number
  capacityScore: number
  totalScore: number
  isPreferred: boolean
}

export class InventoryAllocationService {
  private static reservations: Map<string, ReservationRecord> = new Map()

  // Clear all reservations (for testing and maintenance)
  static clearReservations(): void {
    this.reservations.clear()
  }

  /**
   * Sub-task 1: Implement inventory reservation for pending orders
   */

  // Reserve inventory for a specific order
  static async reserveInventory(request: ReservationRequest): Promise<{
    success: boolean
    reservationId?: string
    message: string
    atpRemaining?: number
  }> {
    try {
      const atp = await this.calculateAtp(request.titleId, request.warehouseId)

      if (atp.atpQuantity < request.quantity) {
        return {
          success: false,
          message: `Insufficient ATP. Available: ${atp.atpQuantity}, Requested: ${request.quantity}`,
          atpRemaining: atp.atpQuantity
        }
      }

      const result = await dbClient.$transaction(async (tx) => {
        // Update reserved stock
        const inventory = await tx.inventory.findFirst({
          where: {
            titleId: request.titleId,
            warehouseId: request.warehouseId
          }
        })

        if (!inventory) {
          throw new Error('Inventory not found')
        }

        const updatedInventory = await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedStock: inventory.reservedStock + request.quantity,
            lastMovementDate: new Date()
          }
        })

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            titleId: request.titleId,
            warehouseId: request.warehouseId,
            movementType: 'ONLINE_SALES',
            quantity: -request.quantity,
            movementDate: new Date(),
            referenceNumber: request.orderId,
            notes: `Reservation for order ${request.orderId}`,
            rrpAtTime: new Prisma.Decimal(0)
          }
        })

        return updatedInventory
      })

      // Create reservation record
      const reservationId = `RES_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const reservation: ReservationRecord = {
        id: reservationId,
        titleId: request.titleId,
        warehouseId: request.warehouseId,
        quantity: request.quantity,
        orderId: request.orderId,
        customerId: request.customerId,
        status: 'ACTIVE',
        createdAt: new Date(),
        expirationDate: request.expirationDate || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
        priority: request.priority || 'MEDIUM'
      }

      this.reservations.set(reservationId, reservation)

      // Emit real-time event
      const realTimeService = RealTimeInventoryService.getInstance()
      realTimeService.emitInventoryEvent({
        type: 'RESERVATION_CHANGE',
        inventoryId: result.id,
        warehouseId: request.warehouseId,
        titleId: request.titleId,
        previousStock: result.reservedStock - request.quantity,
        newStock: result.reservedStock,
        changeAmount: request.quantity,
        reason: `Reserved for order ${request.orderId}`,
        timestamp: new Date()
      })

      return {
        success: true,
        reservationId,
        message: 'Inventory reserved successfully',
        atpRemaining: atp.atpQuantity - request.quantity
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reserve inventory'
      }
    }
  }

  // Release inventory reservation
  static async releaseReservation(reservationId: string, reason: string = 'Manual release'): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const reservation = this.reservations.get(reservationId)
      if (!reservation || reservation.status !== 'ACTIVE') {
        return {
          success: false,
          message: 'Reservation not found or not active'
        }
      }

      await dbClient.$transaction(async (tx) => {
        // Update reserved stock
        const inventory = await tx.inventory.findFirst({
          where: {
            titleId: reservation.titleId,
            warehouseId: reservation.warehouseId
          }
        })

        if (!inventory) {
          throw new Error('Inventory not found')
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedStock: Math.max(0, inventory.reservedStock - reservation.quantity),
            lastMovementDate: new Date()
          }
        })

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            titleId: reservation.titleId,
            warehouseId: reservation.warehouseId,
            movementType: 'WAREHOUSE_TRANSFER',
            quantity: reservation.quantity,
            movementDate: new Date(),
            referenceNumber: reservation.orderId,
            notes: `Released reservation: ${reason}`,
            rrpAtTime: new Prisma.Decimal(0)
          }
        })
      })

      // Update reservation status
      reservation.status = 'CANCELLED'
      this.reservations.set(reservationId, reservation)

      return {
        success: true,
        message: 'Reservation released successfully'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to release reservation'
      }
    }
  }

  // Get all active reservations
  static getActiveReservations(titleId?: number, warehouseId?: number): ReservationRecord[] {
    return Array.from(this.reservations.values()).filter(reservation =>
      reservation.status === 'ACTIVE' &&
      (!titleId || reservation.titleId === titleId) &&
      (!warehouseId || reservation.warehouseId === warehouseId)
    )
  }

  /**
   * Sub-task 2: Build allocation prioritization by warehouse and customer
   */

  // Intelligent allocation across multiple warehouses
  static async allocateInventory(request: AllocationRequest): Promise<AllocationResult> {
    try {
      // Handle zero quantity request as valid success case
      if (request.quantity === 0) {
        return {
          success: true,
          totalAllocated: 0,
          totalRequested: 0,
          allocations: [],
          unallocatedQuantity: 0
        }
      }
      // Get available warehouses and inventory
      const warehousePriorities = await this.calculateWarehousePriorities(
        request.titleId,
        request.customerId,
        request.customerTier || 'BRONZE',
        request.preferredWarehouseIds
      )

      let remainingQuantity = request.quantity
      const allocations: AllocationResult['allocations'] = []
      const recommendations: AllocationResult['recommendations'] = []

      // Allocate from highest priority warehouses first
      for (const priority of warehousePriorities) {
        if (remainingQuantity <= 0) break
        if (request.maxWarehouses && allocations.length >= request.maxWarehouses) break

        const atp = await this.calculateAtp(request.titleId, priority.warehouseId)

        if (atp.atpQuantity > 0) {
          const allocationQuantity = Math.min(remainingQuantity, atp.atpQuantity)

          // Create reservation for this allocation
          const reservationResult = await this.reserveInventory({
            titleId: request.titleId,
            warehouseId: priority.warehouseId,
            quantity: allocationQuantity,
            orderId: `AUTO_${Date.now()}`,
            customerId: request.customerId,
            priority: this.getCustomerPriority(request.customerTier || 'BRONZE')
          })

          if (reservationResult.success) {
            allocations.push({
              warehouseId: priority.warehouseId,
              quantity: allocationQuantity,
              reservationId: reservationResult.reservationId!,
              warehouseName: priority.warehouseName,
              warehouseLocation: priority.location,
              cost: priority.fulfillmentCost * allocationQuantity,
              distance: priority.distanceScore
            })

            remainingQuantity -= allocationQuantity
          }
        } else {
          // Add recommendation for reorder or transfer
          recommendations.push({
            type: 'REORDER',
            message: `${priority.warehouseName} is out of stock. Consider reordering.`,
            warehouseId: priority.warehouseId
          })
        }
      }

      // Add transfer recommendations if still unallocated
      if (remainingQuantity > 0) {
        recommendations.push({
          type: 'TRANSFER',
          message: `${remainingQuantity} units could not be allocated. Consider inter-warehouse transfer.`,
          estimatedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        })
      }

      return {
        success: remainingQuantity === 0,
        totalAllocated: request.quantity - remainingQuantity,
        totalRequested: request.quantity,
        allocations,
        unallocatedQuantity: remainingQuantity,
        recommendations: recommendations.length > 0 ? recommendations : undefined
      }
    } catch (error) {
      return {
        success: false,
        totalAllocated: 0,
        totalRequested: request.quantity,
        allocations: [],
        unallocatedQuantity: request.quantity,
        recommendations: [{
          type: 'REORDER',
          message: error instanceof Error ? error.message : 'Allocation failed'
        }]
      }
    }
  }

  // Calculate warehouse priorities for allocation
  private static async calculateWarehousePriorities(
    titleId: number,
    customerId: string,
    customerTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM',
    preferredWarehouseIds?: number[]
  ): Promise<AllocationPriority[]> {
    try {
      const inventories = await dbClient.inventory.findMany({
        where: { titleId },
        include: {
          warehouse: true
        }
      })

      const priorities: AllocationPriority[] = []

      for (const inventory of inventories) {
        const atp = await this.calculateAtp(titleId, inventory.warehouseId)

        // Customer tier scoring (higher tier = higher priority)
        const tierScore = {
          'BRONZE': 1,
          'SILVER': 2,
          'GOLD': 3,
          'PLATINUM': 4
        }[customerTier]

        // Warehouse preference scoring
        const preferenceScore = preferredWarehouseIds?.includes(inventory.warehouseId) ? 10 : 0

        // Distance scoring (simplified - based on location strings)
        const distanceScore = this.calculateDistanceScore(inventory.warehouse.location, 'Customer Location')

        // Capacity scoring (higher ATP = higher score)
        const capacityScore = Math.min(atp.atpQuantity / 100, 10) // Cap at 10

        // Fulfillment cost (simplified)
        const baseCost = 5.0
        const fulfillmentCost = baseCost + (distanceScore * 0.5)

        const totalScore = tierScore + preferenceScore + capacityScore - distanceScore

        priorities.push({
          customerId,
          customerTier,
          warehouseId: inventory.warehouseId,
          warehouseName: inventory.warehouse.name,
          location: inventory.warehouse.location,
          fulfillmentCost,
          distanceScore,
          capacityScore,
          totalScore,
          isPreferred: preferredWarehouseIds?.includes(inventory.warehouseId) || false
        })
      }

      // Sort by total score (highest first)
      return priorities.sort((a, b) => b.totalScore - a.totalScore)
    } catch (error) {
      throw new Error('Failed to calculate warehouse priorities')
    }
  }

  // Simplified distance calculation (in a real system, would use geolocation)
  private static calculateDistanceScore(warehouseLocation: string, customerLocation: string): number {
    // Simplified scoring based on location string matching
    if (warehouseLocation.includes('London') && customerLocation.includes('London')) return 1
    if (warehouseLocation.includes('UK') && customerLocation.includes('UK')) return 2
    if (warehouseLocation.includes('US') && customerLocation.includes('US')) return 3
    return 5 // International
  }

  // Get customer priority level
  private static getCustomerPriority(tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (tier) {
      case 'BRONZE': return 'LOW'
      case 'SILVER': return 'MEDIUM'
      case 'GOLD': return 'HIGH'
      case 'PLATINUM': return 'CRITICAL'
      default: return 'MEDIUM'
    }
  }

  /**
   * Sub-task 3: Add available-to-promise (ATP) calculations
   */

  // Calculate Available-to-Promise for a specific warehouse and title
  static async calculateAtp(titleId: number, warehouseId: number): Promise<AtpCalculation> {
    try {
      const inventory = await dbClient.inventory.findFirst({
        where: {
          titleId,
          warehouseId
        },
        include: {
          warehouse: true
        }
      })

      if (!inventory) {
        throw new Error('Inventory not found')
      }

      // Get incoming stock (future receipts) - simplified for now
      const incomingStock = await this.calculateIncomingStock(titleId, warehouseId)

      // ATP = Current Stock - Reserved Stock - Safety Stock + Incoming Stock
      const safetyStock = inventory.minStockLevel || 0
      const atpQuantity = Math.max(
        0,
        inventory.currentStock - inventory.reservedStock - safetyStock + incomingStock
      )

      return {
        titleId,
        warehouseId,
        currentStock: inventory.currentStock,
        reservedStock: inventory.reservedStock,
        minStockLevel: safetyStock,
        incomingStock,
        atpQuantity,
        effectiveDate: new Date(),
        warehouseName: inventory.warehouse.name,
        notes: `ATP calculated at ${new Date().toISOString()}`
      }
    } catch (error) {
      throw new Error(`Failed to calculate ATP: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Calculate ATP across all warehouses for a title
  static async calculateMultiWarehouseAtp(titleId: number): Promise<{
    totalAtp: number
    warehouseAtps: AtpCalculation[]
    aggregatedDate: Date
  }> {
    try {
      const inventories = await dbClient.inventory.findMany({
        where: { titleId },
        include: { warehouse: true }
      })

      const warehouseAtps: AtpCalculation[] = []
      let totalAtp = 0

      for (const inventory of inventories) {
        const atp = await this.calculateAtp(titleId, inventory.warehouseId)
        warehouseAtps.push(atp)
        totalAtp += atp.atpQuantity
      }

      return {
        totalAtp,
        warehouseAtps,
        aggregatedDate: new Date()
      }
    } catch (error) {
      throw new Error('Failed to calculate multi-warehouse ATP')
    }
  }

  // Calculate incoming stock (simplified - would integrate with purchase orders in real system)
  private static async calculateIncomingStock(titleId: number, warehouseId: number): Promise<number> {
    try {
      // In a real system, this would query purchase orders, transfers, production schedules
      // For now, return 0 as baseline
      return 0
    } catch (error) {
      return 0
    }
  }

  /**
   * Sub-task 4: Create allocation expiration and cleanup processes
   */

  // Clean up expired reservations
  static async cleanupExpiredReservations(): Promise<{
    cleaned: number
    releasedQuantity: number
    details: Array<{ reservationId: string; orderId: string; quantity: number; reason: string }>
  }> {
    try {
      const now = new Date()
      const expiredReservations = Array.from(this.reservations.values()).filter(
        reservation => reservation.status === 'ACTIVE' && reservation.expirationDate < now
      )

      let cleaned = 0
      let releasedQuantity = 0
      const details: Array<{ reservationId: string; orderId: string; quantity: number; reason: string }> = []

      for (const reservation of expiredReservations) {
        const releaseResult = await this.releaseReservation(
          reservation.id,
          `Expired at ${reservation.expirationDate.toISOString()}`
        )

        if (releaseResult.success) {
          cleaned++
          releasedQuantity += reservation.quantity
          details.push({
            reservationId: reservation.id,
            orderId: reservation.orderId,
            quantity: reservation.quantity,
            reason: 'Expired'
          })
        }
      }

      return {
        cleaned,
        releasedQuantity,
        details
      }
    } catch (error) {
      throw new Error('Failed to cleanup expired reservations')
    }
  }

  // Extend reservation expiration
  static async extendReservation(reservationId: string, newExpirationDate: Date): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const reservation = this.reservations.get(reservationId)

      if (!reservation || reservation.status !== 'ACTIVE') {
        return {
          success: false,
          message: 'Reservation not found or not active'
        }
      }

      reservation.expirationDate = newExpirationDate
      this.reservations.set(reservationId, reservation)

      return {
        success: true,
        message: 'Reservation extended successfully'
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to extend reservation'
      }
    }
  }

  // Get allocation statistics
  static async getAllocationStatistics(titleId?: number, warehouseId?: number): Promise<{
    totalReservations: number
    activeReservations: number
    expiredReservations: number
    totalReservedQuantity: number
    averageReservationAge: number
    topCustomers: Array<{ customerId: string; totalQuantity: number; orderCount: number }>
  }> {
    try {
      const allReservations = Array.from(this.reservations.values()).filter(
        reservation =>
          (!titleId || reservation.titleId === titleId) &&
          (!warehouseId || reservation.warehouseId === warehouseId)
      )

      const activeReservations = allReservations.filter(r => r.status === 'ACTIVE')
      const expiredReservations = allReservations.filter(r => r.status === 'EXPIRED')

      const totalReservedQuantity = activeReservations.reduce((sum, r) => sum + r.quantity, 0)

      const totalAge = activeReservations.reduce((sum, r) =>
        sum + (new Date().getTime() - r.createdAt.getTime()), 0
      )
      const averageReservationAge = activeReservations.length > 0 ? totalAge / activeReservations.length : 0

      // Calculate top customers
      const customerStats = new Map<string, { totalQuantity: number; orderCount: number }>()
      allReservations.forEach(reservation => {
        const existing = customerStats.get(reservation.customerId) || { totalQuantity: 0, orderCount: 0 }
        existing.totalQuantity += reservation.quantity
        existing.orderCount++
        customerStats.set(reservation.customerId, existing)
      })

      const topCustomers = Array.from(customerStats.entries())
        .map(([customerId, stats]) => ({ customerId, ...stats }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10)

      return {
        totalReservations: allReservations.length,
        activeReservations: activeReservations.length,
        expiredReservations: expiredReservations.length,
        totalReservedQuantity,
        averageReservationAge,
        topCustomers
      }
    } catch (error) {
      throw new Error('Failed to get allocation statistics')
    }
  }

  // Force cleanup old reservations (maintenance operation)
  static async performMaintenanceCleanup(olderThanDays: number = 30): Promise<{
    removedReservations: number
    reclaimedMemory: boolean
  }> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
      let removedCount = 0

      for (const [reservationId, reservation] of this.reservations.entries()) {
        if (reservation.createdAt < cutoffDate && reservation.status !== 'ACTIVE') {
          this.reservations.delete(reservationId)
          removedCount++
        }
      }

      return {
        removedReservations: removedCount,
        reclaimedMemory: true
      }
    } catch (error) {
      throw new Error('Failed to perform maintenance cleanup')
    }
  }
}

// Export service and types
export default InventoryAllocationService