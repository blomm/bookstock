import { PrismaClient, MovementType } from '@prisma/client'
import StockMovementService from './stockMovementService'
import { StockMovementAuditService } from './stockMovementAuditService'

export interface ExternalMovementRequest {
  externalId: string
  titleId: number
  warehouseId: number
  movementType: MovementType
  quantity: number
  unitCost?: number
  notes?: string
  sourceSystem: string
  sourceReference?: string
  metadata?: Record<string, any>
}

export interface ExternalMovementResponse {
  success: boolean
  movementId?: number
  externalId: string
  message?: string
  errors?: string[]
}

export interface BulkMovementRequest {
  movements: ExternalMovementRequest[]
  batchId?: string
  sourceSystem: string
  validateOnly?: boolean
}

export interface BulkMovementResponse {
  batchId: string
  totalCount: number
  successCount: number
  failureCount: number
  results: ExternalMovementResponse[]
  validationErrors?: string[]
}

export interface MovementSyncRequest {
  dateFrom: Date
  dateTo: Date
  warehouseIds?: number[]
  movementTypes?: MovementType[]
  externalSystemId: string
  includeMetadata?: boolean
}

export interface MovementSyncResponse {
  totalCount: number
  movements: MovementSyncData[]
  nextCursor?: string
  hasMore: boolean
}

export interface MovementSyncData {
  movementId: number
  externalId?: string
  titleId: number
  titleISBN: string
  titleName: string
  warehouseId: number
  warehouseName: string
  movementType: MovementType
  quantity: number
  unitCost: number
  totalValue: number
  movementDate: Date
  notes?: string
  metadata?: Record<string, any>
  auditTrail?: {
    createdBy: string
    createdAt: Date
    lastModifiedBy?: string
    lastModifiedAt?: Date
  }
}

export interface ExternalSystemCredentials {
  systemId: string
  apiKey: string
  secretKey?: string
  baseUrl?: string
  webhookUrl?: string
  isActive: boolean
}

export interface IntegrationMetrics {
  systemId: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  lastSyncTime?: Date
  errorRate: number
  uptime: number
}

class MovementIntegrationService {
  private static db: PrismaClient | null = null
  private static readonly BATCH_SIZE = 100
  private static readonly MAX_RETRY_ATTEMPTS = 3
  private static readonly SYNC_CURSOR_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

  static setDbClient(client: PrismaClient): void {
    this.db = client
  }

  private static getDb(): PrismaClient {
    if (!this.db) {
      throw new Error('Database client not initialized. Call setDbClient() first.')
    }
    return this.db
  }

  static async processExternalMovement(
    request: ExternalMovementRequest,
    performedBy: string
  ): Promise<ExternalMovementResponse> {
    const db = this.getDb()

    try {
      await this.validateExternalMovementRequest(request)

      const movementData = {
        titleId: request.titleId,
        warehouseId: request.warehouseId,
        movementType: request.movementType,
        quantity: request.quantity,
        unitCost: request.unitCost || 0,
        notes: request.notes,
        metadata: {
          ...request.metadata,
          externalId: request.externalId,
          sourceSystem: request.sourceSystem,
          sourceReference: request.sourceReference,
          processedAt: new Date().toISOString(),
          integrationVersion: '1.0'
        }
      }

      const movement = await StockMovementService.createMovement(
        movementData,
        performedBy
      )

      await StockMovementAuditService.createAuditEntry(
        movement.id,
        'CREATED',
        performedBy,
        {
          reason: `External integration from ${request.sourceSystem}`,
          metadata: {
            externalId: request.externalId,
            sourceSystem: request.sourceSystem,
            sourceReference: request.sourceReference,
            apiVersion: '1.0'
          }
        }
      )

      return {
        success: true,
        movementId: movement.id,
        externalId: request.externalId,
        message: 'Movement processed successfully'
      }

    } catch (error) {
      console.error('External movement processing error:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        success: false,
        externalId: request.externalId,
        message: 'Movement processing failed',
        errors: [errorMessage]
      }
    }
  }

  static async processBulkMovements(
    request: BulkMovementRequest,
    performedBy: string
  ): Promise<BulkMovementResponse> {
    const batchId = request.batchId || this.generateBatchId()

    if (request.validateOnly) {
      return await this.validateBulkMovements(request, batchId)
    }

    const results: ExternalMovementResponse[] = []
    let successCount = 0
    let failureCount = 0

    try {
      for (const movement of request.movements) {
        const result = await this.processExternalMovement(movement, performedBy)
        results.push(result)

        if (result.success) {
          successCount++
        } else {
          failureCount++
        }
      }

      await this.recordBulkOperationMetrics(
        request.sourceSystem,
        request.movements.length,
        successCount,
        failureCount
      )

      return {
        batchId,
        totalCount: request.movements.length,
        successCount,
        failureCount,
        results
      }

    } catch (error) {
      console.error('Bulk movement processing error:', error)
      throw new Error(`Bulk processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async synchronizeMovements(
    request: MovementSyncRequest
  ): Promise<MovementSyncResponse> {
    const db = this.getDb()

    try {
      const whereClause: any = {
        movementDate: {
          gte: request.dateFrom,
          lte: request.dateTo
        }
      }

      if (request.warehouseIds && request.warehouseIds.length > 0) {
        whereClause.warehouseId = {
          in: request.warehouseIds
        }
      }

      if (request.movementTypes && request.movementTypes.length > 0) {
        whereClause.movementType = {
          in: request.movementTypes
        }
      }

      const movements = await db.stockMovement.findMany({
        where: whereClause,
        include: {
          title: {
            select: {
              isbn: true,
              title: true
            }
          },
          warehouse: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          movementDate: 'asc'
        },
        take: this.BATCH_SIZE + 1 // Get one extra to check if there are more
      })

      const hasMore = movements.length > this.BATCH_SIZE
      const movementsToReturn = hasMore ? movements.slice(0, -1) : movements

      const syncData: MovementSyncData[] = await Promise.all(
        movementsToReturn.map(async (movement) => {
          const auditTrail = request.includeMetadata ?
            await this.getMovementAuditSummary(movement.id) : undefined

          return {
            movementId: movement.id,
            externalId: movement.metadata?.externalId as string,
            titleId: movement.titleId,
            titleISBN: movement.title.isbn,
            titleName: movement.title.title,
            warehouseId: movement.warehouseId,
            warehouseName: movement.warehouse.name,
            movementType: movement.movementType,
            quantity: movement.quantity,
            unitCost: movement.unitCost,
            totalValue: movement.quantity * movement.unitCost,
            movementDate: movement.movementDate,
            notes: movement.notes,
            metadata: request.includeMetadata ? movement.metadata as Record<string, any> : undefined,
            auditTrail
          }
        })
      )

      let nextCursor: string | undefined
      if (hasMore && movementsToReturn.length > 0) {
        const lastMovement = movementsToReturn[movementsToReturn.length - 1]
        nextCursor = this.generateSyncCursor(lastMovement.movementDate, lastMovement.id)
      }

      return {
        totalCount: syncData.length,
        movements: syncData,
        nextCursor,
        hasMore
      }

    } catch (error) {
      console.error('Movement synchronization error:', error)
      throw new Error(`Synchronization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async getIntegrationMetrics(systemId: string): Promise<IntegrationMetrics> {
    // This would typically come from a dedicated metrics store or monitoring system
    // For now, we'll calculate basic metrics from audit logs

    try {
      const db = this.getDb()

      // Get movements from this system in the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const movements = await db.stockMovement.findMany({
        where: {
          movementDate: {
            gte: thirtyDaysAgo
          },
          metadata: {
            path: ['sourceSystem'],
            equals: systemId
          }
        },
        include: {
          MovementAuditEntry: {
            where: {
              action: 'CREATED'
            },
            orderBy: {
              performedAt: 'desc'
            },
            take: 1
          }
        }
      })

      const totalRequests = movements.length
      const successfulRequests = movements.filter(m =>
        m.MovementAuditEntry.length > 0
      ).length
      const failedRequests = totalRequests - successfulRequests

      const lastSyncTime = movements.length > 0 ?
        movements.reduce((latest, movement) => {
          const movementDate = movement.movementDate
          return movementDate > latest ? movementDate : latest
        }, movements[0].movementDate) : undefined

      return {
        systemId,
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: 0, // Would need separate tracking
        lastSyncTime,
        errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
        uptime: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100
      }

    } catch (error) {
      console.error('Integration metrics error:', error)
      throw new Error(`Failed to get integration metrics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private static async validateExternalMovementRequest(
    request: ExternalMovementRequest
  ): Promise<void> {
    const db = this.getDb()
    const errors: string[] = []

    if (!request.externalId || request.externalId.trim() === '') {
      errors.push('External ID is required')
    }

    if (!request.sourceSystem || request.sourceSystem.trim() === '') {
      errors.push('Source system is required')
    }

    if (!request.titleId || request.titleId <= 0) {
      errors.push('Valid title ID is required')
    }

    if (!request.warehouseId || request.warehouseId <= 0) {
      errors.push('Valid warehouse ID is required')
    }

    if (!request.movementType) {
      errors.push('Movement type is required')
    }

    if (!request.quantity || request.quantity === 0) {
      errors.push('Quantity must be non-zero')
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }

    // Check if title exists
    const title = await db.title.findUnique({
      where: { id: request.titleId }
    })
    if (!title) {
      throw new Error(`Title with ID ${request.titleId} not found`)
    }

    // Check if warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: request.warehouseId }
    })
    if (!warehouse) {
      throw new Error(`Warehouse with ID ${request.warehouseId} not found`)
    }

    // Check for duplicate external ID
    const existingMovement = await db.stockMovement.findFirst({
      where: {
        metadata: {
          path: ['externalId'],
          equals: request.externalId
        }
      }
    })
    if (existingMovement) {
      throw new Error(`Movement with external ID ${request.externalId} already exists`)
    }
  }

  private static async validateBulkMovements(
    request: BulkMovementRequest,
    batchId: string
  ): Promise<BulkMovementResponse> {
    const validationErrors: string[] = []
    const results: ExternalMovementResponse[] = []

    for (let i = 0; i < request.movements.length; i++) {
      const movement = request.movements[i]
      try {
        await this.validateExternalMovementRequest(movement)
        results.push({
          success: true,
          externalId: movement.externalId,
          message: 'Validation passed'
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        validationErrors.push(`Movement ${i + 1} (${movement.externalId}): ${errorMessage}`)
        results.push({
          success: false,
          externalId: movement.externalId,
          message: 'Validation failed',
          errors: [errorMessage]
        })
      }
    }

    return {
      batchId,
      totalCount: request.movements.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      results,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined
    }
  }

  private static generateBatchId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `batch_${timestamp}_${random}`
  }

  private static generateSyncCursor(date: Date, movementId: number): string {
    const payload = {
      date: date.toISOString(),
      id: movementId,
      expires: Date.now() + this.SYNC_CURSOR_EXPIRY
    }
    return Buffer.from(JSON.stringify(payload)).toString('base64')
  }

  private static async getMovementAuditSummary(movementId: number) {
    const auditEntries = await StockMovementAuditService.getMovementAuditTrail(movementId)

    if (auditEntries.length === 0) {
      return undefined
    }

    const createdEntry = auditEntries.find(entry => entry.action === 'CREATED')
    const lastModified = auditEntries[0] // Most recent entry

    return {
      createdBy: createdEntry?.performedBy || 'system',
      createdAt: createdEntry?.performedAt || new Date(),
      lastModifiedBy: lastModified?.action !== 'CREATED' ? lastModified?.performedBy : undefined,
      lastModifiedAt: lastModified?.action !== 'CREATED' ? lastModified?.performedAt : undefined
    }
  }

  private static async recordBulkOperationMetrics(
    sourceSystem: string,
    totalCount: number,
    successCount: number,
    failureCount: number
  ): Promise<void> {
    // In a production system, this would record metrics to a monitoring system
    console.log(`Bulk operation metrics for ${sourceSystem}:`, {
      totalCount,
      successCount,
      failureCount,
      successRate: (successCount / totalCount) * 100
    })
  }
}

export default MovementIntegrationService