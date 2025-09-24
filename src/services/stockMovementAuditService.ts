import { PrismaClient, StockMovement, MovementType, Prisma } from '@prisma/client'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Audit Trail Types and Interfaces
export interface MovementAuditTrail {
  movementId: number
  movement: StockMovement & {
    title: { title: string; isbn: string }
    warehouse: { name: string; code: string }
    sourceWarehouse?: { name: string; code: string } | null
    destinationWarehouse?: { name: string; code: string } | null
    printer?: { name: string } | null
  }
  auditEntries: MovementAuditEntry[]
  relatedMovements: StockMovement[]
  chainId?: string
  timeline: MovementTimelineEntry[]
}

export interface MovementAuditEntry {
  id: number
  movementId: number
  action: AuditAction
  performedBy: string
  performedAt: Date
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  reason?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
}

export interface MovementTimelineEntry {
  timestamp: Date
  action: string
  description: string
  performedBy?: string
  metadata?: Record<string, any>
}

export interface MovementChainTracking {
  chainId: string
  movements: ChainedMovement[]
  startDate: Date
  endDate?: Date
  status: ChainStatus
  metadata: {
    initiatedBy: string
    purpose: string
    totalQuantity: number
    totalValue: number
  }
}

export interface ChainedMovement {
  movementId: number
  movement: StockMovement
  chainPosition: number
  parentMovementId?: number
  childMovementIds: number[]
}

export type AuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVERSED'
  | 'CANCELLED'
  | 'SYSTEM_UPDATE'

export type ChainStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export interface AuditSearchOptions {
  movementId?: number
  titleId?: number
  warehouseId?: number
  performedBy?: string
  action?: AuditAction
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
}

export interface MovementChainOptions {
  movementId?: number
  chainId?: string
  includeRelated?: boolean
  maxDepth?: number
}

class StockMovementAuditService {

  // Comprehensive Audit Trail for All Movements
  static async createAuditEntry(
    movementId: number,
    action: AuditAction,
    performedBy: string,
    options: {
      oldValues?: Record<string, any>
      newValues?: Record<string, any>
      reason?: string
      ipAddress?: string
      userAgent?: string
      metadata?: Record<string, any>
    } = {}
  ): Promise<MovementAuditEntry> {
    const auditEntry = {
      movementId,
      action,
      performedBy,
      performedAt: new Date(),
      ...options
    }

    // In a real implementation, this would create an audit entry in the database
    // For now, we'll simulate the entry creation
    const createdEntry: MovementAuditEntry = {
      id: Date.now(), // Temporary ID generation
      ...auditEntry
    }

    return createdEntry
  }

  static async getMovementAuditTrail(movementId: number): Promise<MovementAuditTrail | null> {
    try {
      // Get the movement with all related data
      const movement = await dbClient.stockMovement.findUnique({
        where: { id: movementId },
        include: {
          title: {
            select: { title: true, isbn: true }
          },
          warehouse: {
            select: { name: true, code: true }
          },
          sourceWarehouse: {
            select: { name: true, code: true }
          },
          destinationWarehouse: {
            select: { name: true, code: true }
          },
          printer: {
            select: { name: true }
          }
        }
      })

      if (!movement) {
        return null
      }

      // Get audit entries (simulated for now)
      const auditEntries = await this.getAuditEntries(movementId)

      // Get related movements in the same chain
      const relatedMovements = await this.getRelatedMovements(movementId)

      // Generate timeline
      const timeline = await this.generateMovementTimeline(movementId)

      // Get chain ID if part of a chain
      const chainId = await this.getMovementChainId(movementId)

      return {
        movementId,
        movement,
        auditEntries,
        relatedMovements,
        chainId,
        timeline
      }
    } catch (error) {
      throw new Error(`Failed to get audit trail: ${error}`)
    }
  }

  static async getAuditEntries(movementId: number): Promise<MovementAuditEntry[]> {
    // Simulated audit entries - in real implementation would query audit table
    const baseEntry: MovementAuditEntry = {
      id: 1,
      movementId,
      action: 'CREATED',
      performedBy: 'system',
      performedAt: new Date(),
      newValues: { status: 'created' }
    }

    return [baseEntry]
  }

  static async searchAuditEntries(options: AuditSearchOptions): Promise<MovementAuditEntry[]> {
    // Simulated search - would implement proper database query
    return []
  }

  // Movement Chain Tracking from Source to Destination
  static async createMovementChain(
    initiatedBy: string,
    purpose: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const chainId = `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // In real implementation, would create chain record in database
    const chainData: MovementChainTracking = {
      chainId,
      movements: [],
      startDate: new Date(),
      status: 'ACTIVE',
      metadata: {
        initiatedBy,
        purpose,
        totalQuantity: 0,
        totalValue: 0,
        ...metadata
      }
    }

    return chainId
  }

  static async addMovementToChain(movementId: number, chainId: string, parentMovementId?: number): Promise<void> {
    // Get current chain
    const chain = await this.getMovementChain(chainId)

    if (!chain) {
      throw new Error(`Movement chain ${chainId} not found`)
    }

    // Get movement
    const movement = await dbClient.stockMovement.findUnique({
      where: { id: movementId }
    })

    if (!movement) {
      throw new Error(`Movement ${movementId} not found`)
    }

    // Add to chain (simulated)
    const chainedMovement: ChainedMovement = {
      movementId,
      movement,
      chainPosition: chain.movements.length + 1,
      parentMovementId,
      childMovementIds: []
    }

    // Update parent's children if applicable
    if (parentMovementId) {
      const parentIndex = chain.movements.findIndex(m => m.movementId === parentMovementId)
      if (parentIndex >= 0) {
        chain.movements[parentIndex].childMovementIds.push(movementId)
      }
    }

    chain.movements.push(chainedMovement)

    // Create audit entry
    await this.createAuditEntry(movementId, 'SYSTEM_UPDATE', 'system', {
      newValues: { chainId, chainPosition: chainedMovement.chainPosition },
      metadata: { action: 'added_to_chain' }
    })
  }

  static async getMovementChain(chainId: string): Promise<MovementChainTracking | null> {
    // Simulated chain retrieval - would query database
    const mockChain: MovementChainTracking = {
      chainId,
      movements: [],
      startDate: new Date(),
      status: 'ACTIVE',
      metadata: {
        initiatedBy: 'system',
        purpose: 'test_chain',
        totalQuantity: 0,
        totalValue: 0
      }
    }

    return mockChain
  }

  static async getMovementChainId(movementId: number): Promise<string | undefined> {
    // Look for chain ID in movement metadata or related chain table
    // Simulated for now
    return undefined
  }

  static async getRelatedMovements(movementId: number): Promise<StockMovement[]> {
    try {
      const movement = await dbClient.stockMovement.findUnique({
        where: { id: movementId }
      })

      if (!movement) {
        return []
      }

      // Find related movements by various criteria
      const relatedQueries = []

      // 1. Movements with same reference number
      if (movement.referenceNumber) {
        relatedQueries.push({
          referenceNumber: movement.referenceNumber,
          id: { not: movementId }
        })
      }

      // 2. Movements with same batch number
      if (movement.batchNumber) {
        relatedQueries.push({
          batchNumber: movement.batchNumber,
          id: { not: movementId }
        })
      }

      // 3. Transfer counterparts
      if (movement.movementType === 'WAREHOUSE_TRANSFER') {
        relatedQueries.push({
          movementType: 'WAREHOUSE_TRANSFER',
          titleId: movement.titleId,
          movementDate: {
            gte: new Date(movement.movementDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
            lte: new Date(movement.movementDate.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
          },
          id: { not: movementId }
        })
      }

      // Execute queries
      const relatedMovements: StockMovement[] = []
      for (const query of relatedQueries) {
        const movements = await dbClient.stockMovement.findMany({
          where: query,
          orderBy: { movementDate: 'asc' }
        })
        relatedMovements.push(...movements)
      }

      // Remove duplicates
      const uniqueMovements = relatedMovements.filter((movement, index, self) =>
        index === self.findIndex(m => m.id === movement.id)
      )

      return uniqueMovements
    } catch (error) {
      throw new Error(`Failed to get related movements: ${error}`)
    }
  }

  static async traceMovementChain(options: MovementChainOptions): Promise<MovementChainTracking | null> {
    if (options.chainId) {
      return this.getMovementChain(options.chainId)
    }

    if (options.movementId) {
      const chainId = await this.getMovementChainId(options.movementId)
      if (chainId) {
        return this.getMovementChain(chainId)
      }

      // Build chain from related movements
      return this.buildMovementChainFromMovement(options.movementId, options)
    }

    return null
  }

  static async buildMovementChainFromMovement(
    movementId: number,
    options: MovementChainOptions = {}
  ): Promise<MovementChainTracking | null> {
    const maxDepth = options.maxDepth || 10
    const visited = new Set<number>()
    const movements: ChainedMovement[] = []

    const buildChain = async (currentMovementId: number, depth: number = 0, position: number = 0): Promise<void> => {
      if (depth >= maxDepth || visited.has(currentMovementId)) {
        return
      }

      visited.add(currentMovementId)

      const movement = await dbClient.stockMovement.findUnique({
        where: { id: currentMovementId }
      })

      if (!movement) {
        return
      }

      const chainedMovement: ChainedMovement = {
        movementId: currentMovementId,
        movement,
        chainPosition: position,
        childMovementIds: []
      }

      movements.push(chainedMovement)

      // Find related movements
      const related = await this.getRelatedMovements(currentMovementId)
      for (let i = 0; i < related.length; i++) {
        const relatedMovement = related[i]
        if (!visited.has(relatedMovement.id)) {
          chainedMovement.childMovementIds.push(relatedMovement.id)
          await buildChain(relatedMovement.id, depth + 1, movements.length)
        }
      }
    }

    await buildChain(movementId)

    if (movements.length === 0) {
      return null
    }

    const firstMovement = movements[0].movement
    const lastMovement = movements[movements.length - 1].movement

    return {
      chainId: `derived_${movementId}`,
      movements,
      startDate: firstMovement.movementDate,
      endDate: lastMovement.movementDate,
      status: 'COMPLETED',
      metadata: {
        initiatedBy: 'system',
        purpose: 'chain_tracing',
        totalQuantity: movements.reduce((sum, m) => sum + Math.abs(m.movement.quantity), 0),
        totalValue: movements.reduce((sum, m) => {
          const value = m.movement.rrpAtTime ? parseFloat(m.movement.rrpAtTime.toString()) : 0
          return sum + (value * Math.abs(m.movement.quantity))
        }, 0)
      }
    }
  }

  // Generate Movement Timeline
  static async generateMovementTimeline(movementId: number): Promise<MovementTimelineEntry[]> {
    const timeline: MovementTimelineEntry[] = []

    try {
      // Get movement
      const movement = await dbClient.stockMovement.findUnique({
        where: { id: movementId },
        include: {
          title: { select: { title: true, isbn: true } },
          warehouse: { select: { name: true, code: true } },
          sourceWarehouse: { select: { name: true, code: true } },
          destinationWarehouse: { select: { name: true, code: true } }
        }
      })

      if (!movement) {
        return timeline
      }

      // Movement creation
      timeline.push({
        timestamp: movement.createdAt,
        action: 'MOVEMENT_CREATED',
        description: `${movement.movementType} movement created for ${Math.abs(movement.quantity)} units of "${movement.title.title}"`,
        performedBy: 'system',
        metadata: {
          movementType: movement.movementType,
          quantity: movement.quantity,
          warehouse: movement.warehouse.name
        }
      })

      // Movement execution (if different from creation)
      if (movement.movementDate.getTime() !== movement.createdAt.getTime()) {
        timeline.push({
          timestamp: movement.movementDate,
          action: 'MOVEMENT_EXECUTED',
          description: `Movement executed: ${movement.quantity > 0 ? 'Added' : 'Removed'} ${Math.abs(movement.quantity)} units`,
          performedBy: 'system',
          metadata: {
            warehouse: movement.warehouse.name,
            referenceNumber: movement.referenceNumber
          }
        })
      }

      // Transfer specific timeline
      if (movement.movementType.includes('TRANSFER')) {
        if (movement.sourceWarehouse) {
          timeline.push({
            timestamp: movement.movementDate,
            action: 'TRANSFER_SOURCE',
            description: `Units removed from ${movement.sourceWarehouse.name}`,
            performedBy: 'system',
            metadata: {
              sourceWarehouse: movement.sourceWarehouse.name,
              quantity: Math.abs(movement.quantity)
            }
          })
        }

        if (movement.destinationWarehouse) {
          timeline.push({
            timestamp: movement.movementDate,
            action: 'TRANSFER_DESTINATION',
            description: `Units added to ${movement.destinationWarehouse.name}`,
            performedBy: 'system',
            metadata: {
              destinationWarehouse: movement.destinationWarehouse.name,
              quantity: Math.abs(movement.quantity)
            }
          })
        }
      }

      // Get audit entries and add to timeline
      const auditEntries = await this.getAuditEntries(movementId)
      for (const entry of auditEntries) {
        timeline.push({
          timestamp: entry.performedAt,
          action: entry.action,
          description: this.getAuditActionDescription(entry),
          performedBy: entry.performedBy,
          metadata: entry.metadata
        })
      }

      // Sort timeline by timestamp
      timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      return timeline
    } catch (error) {
      throw new Error(`Failed to generate movement timeline: ${error}`)
    }
  }

  static getAuditActionDescription(entry: MovementAuditEntry): string {
    switch (entry.action) {
      case 'CREATED':
        return 'Movement record created'
      case 'UPDATED':
        return 'Movement record updated'
      case 'DELETED':
        return 'Movement record deleted'
      case 'APPROVED':
        return 'Movement approved for processing'
      case 'REJECTED':
        return 'Movement rejected'
      case 'REVERSED':
        return 'Movement reversed'
      case 'CANCELLED':
        return 'Movement cancelled'
      case 'SYSTEM_UPDATE':
        return 'System automatic update'
      default:
        return `${entry.action} action performed`
    }
  }

  // Utility Methods
  static async getMovementAuditSummary(movementId: number): Promise<{
    totalAuditEntries: number
    lastAuditAction: AuditAction | null
    lastAuditDate: Date | null
    isPartOfChain: boolean
    chainId?: string
  }> {
    const auditEntries = await this.getAuditEntries(movementId)
    const chainId = await this.getMovementChainId(movementId)

    return {
      totalAuditEntries: auditEntries.length,
      lastAuditAction: auditEntries.length > 0 ? auditEntries[auditEntries.length - 1].action : null,
      lastAuditDate: auditEntries.length > 0 ? auditEntries[auditEntries.length - 1].performedAt : null,
      isPartOfChain: !!chainId,
      chainId
    }
  }

  static async getComprehensiveMovementHistory(
    titleId?: number,
    warehouseId?: number,
    dateFrom?: Date,
    dateTo?: Date,
    limit: number = 100
  ): Promise<MovementAuditTrail[]> {
    try {
      const whereClause: any = {}

      if (titleId) whereClause.titleId = titleId
      if (warehouseId) whereClause.warehouseId = warehouseId
      if (dateFrom || dateTo) {
        whereClause.movementDate = {}
        if (dateFrom) whereClause.movementDate.gte = dateFrom
        if (dateTo) whereClause.movementDate.lte = dateTo
      }

      const movements = await dbClient.stockMovement.findMany({
        where: whereClause,
        orderBy: { movementDate: 'desc' },
        take: limit
      })

      const auditTrails: MovementAuditTrail[] = []
      for (const movement of movements) {
        const trail = await this.getMovementAuditTrail(movement.id)
        if (trail) {
          auditTrails.push(trail)
        }
      }

      return auditTrails
    } catch (error) {
      throw new Error(`Failed to get comprehensive movement history: ${error}`)
    }
  }
}

export default StockMovementAuditService