import { NextRequest, NextResponse } from 'next/server'
import MovementIntegrationService, {
  BulkMovementRequest,
  BulkMovementResponse
} from '@/services/movementIntegrationService'
import WebhookService from '@/services/webhookService'
import { MovementType } from '@prisma/client'

export interface BatchProcessingJob {
  batchId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  sourceSystem: string
  totalMovements: number
  processedMovements: number
  successfulMovements: number
  failedMovements: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  errors?: string[]
  performedBy: string
}

// In-memory storage for batch jobs (in production, this would be a database or queue system)
const batchJobs = new Map<string, BatchProcessingJob>()

// POST /api/movements/batch - Submit batch of movements for processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate batch request
    const validationResult = validateBatchRequest(body)
    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch validation failed',
          details: validationResult.errors
        },
        { status: 400 }
      )
    }

    const bulkRequest: BulkMovementRequest = body
    const performedBy = extractUserFromRequest(request)

    // Generate batch ID if not provided
    if (!bulkRequest.batchId) {
      bulkRequest.batchId = generateBatchId()
    }

    // Check for validation-only mode
    if (bulkRequest.validateOnly) {
      const result = await MovementIntegrationService.processBulkMovements(
        bulkRequest,
        performedBy
      )

      return NextResponse.json({
        success: true,
        validationOnly: true,
        data: result
      })
    }

    // Create batch job record
    const batchJob: BatchProcessingJob = {
      batchId: bulkRequest.batchId,
      status: 'pending',
      sourceSystem: bulkRequest.sourceSystem,
      totalMovements: bulkRequest.movements.length,
      processedMovements: 0,
      successfulMovements: 0,
      failedMovements: 0,
      createdAt: new Date(),
      performedBy
    }

    batchJobs.set(bulkRequest.batchId, batchJob)

    // Process batch asynchronously
    processBatchAsync(bulkRequest, performedBy)

    return NextResponse.json({
      success: true,
      message: 'Batch processing started',
      batchId: bulkRequest.batchId,
      totalMovements: bulkRequest.movements.length,
      estimatedCompletionTime: calculateEstimatedCompletion(bulkRequest.movements.length)
    })

  } catch (error) {
    console.error('Batch processing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process batch request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET /api/movements/batch - Get batch processing status and history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')
    const status = searchParams.get('status')
    const sourceSystem = searchParams.get('sourceSystem')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (batchId) {
      return handleGetBatchStatus(batchId)
    }

    return handleListBatches({ status, sourceSystem, limit, offset })

  } catch (error) {
    console.error('Batch status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve batch information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT /api/movements/batch - Update or retry batch processing
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchId, action } = body

    if (!batchId) {
      return NextResponse.json(
        {
          success: false,
          error: 'batchId is required'
        },
        { status: 400 }
      )
    }

    const batchJob = batchJobs.get(batchId)
    if (!batchJob) {
      return NextResponse.json(
        {
          success: false,
          error: `Batch with id '${batchId}' not found`
        },
        { status: 404 }
      )
    }

    switch (action) {
      case 'cancel':
        return handleCancelBatch(batchId, batchJob)

      case 'retry':
        return handleRetryBatch(batchId, batchJob, request)

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Invalid action: ${action}. Valid actions: cancel, retry`
          },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Batch update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update batch',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/movements/batch - Remove completed batch records
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')
    const olderThan = searchParams.get('olderThan')

    if (batchId) {
      return handleDeleteBatch(batchId)
    }

    if (olderThan) {
      return handleCleanupOldBatches(olderThan)
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Either batchId or olderThan parameter is required'
      },
      { status: 400 }
    )

  } catch (error) {
    console.error('Batch deletion error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete batch records',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function validateBatchRequest(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!body.movements || !Array.isArray(body.movements)) {
    errors.push('movements array is required')
  } else {
    if (body.movements.length === 0) {
      errors.push('movements array cannot be empty')
    }

    if (body.movements.length > 10000) {
      errors.push('maximum 10,000 movements per batch')
    }

    // Validate each movement
    body.movements.forEach((movement: any, index: number) => {
      const movementErrors = validateSingleMovement(movement, index)
      errors.push(...movementErrors)
    })
  }

  if (!body.sourceSystem || typeof body.sourceSystem !== 'string') {
    errors.push('sourceSystem is required and must be a string')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

function validateSingleMovement(movement: any, index: number): string[] {
  const errors: string[] = []
  const prefix = `Movement ${index + 1}:`

  if (!movement.externalId) {
    errors.push(`${prefix} externalId is required`)
  }

  if (!movement.titleId || typeof movement.titleId !== 'number') {
    errors.push(`${prefix} titleId is required and must be a number`)
  }

  if (!movement.warehouseId || typeof movement.warehouseId !== 'number') {
    errors.push(`${prefix} warehouseId is required and must be a number`)
  }

  if (!movement.movementType) {
    errors.push(`${prefix} movementType is required`)
  } else {
    const validTypes = [
      'PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES',
      'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES'
    ]
    if (!validTypes.includes(movement.movementType)) {
      errors.push(`${prefix} invalid movementType '${movement.movementType}'`)
    }
  }

  if (!movement.quantity || typeof movement.quantity !== 'number' || movement.quantity === 0) {
    errors.push(`${prefix} quantity is required and must be a non-zero number`)
  }

  return errors
}

async function processBatchAsync(bulkRequest: BulkMovementRequest, performedBy: string): Promise<void> {
  const batchJob = batchJobs.get(bulkRequest.batchId!)!

  try {
    batchJob.status = 'processing'
    batchJob.startedAt = new Date()

    const result = await MovementIntegrationService.processBulkMovements(
      bulkRequest,
      performedBy
    )

    batchJob.processedMovements = result.totalCount
    batchJob.successfulMovements = result.successCount
    batchJob.failedMovements = result.failureCount
    batchJob.status = 'completed'
    batchJob.completedAt = new Date()

    // Collect errors from failed movements
    batchJob.errors = result.results
      .filter(r => !r.success && r.errors)
      .flatMap(r => r.errors || [])

    // Trigger webhook for batch completion
    await WebhookService.triggerBatchEvent(
      batchJob.failedMovements > 0 ? 'batch.failed' : 'batch.completed',
      {
        batchId: batchJob.batchId,
        sourceSystem: batchJob.sourceSystem,
        totalCount: batchJob.totalMovements,
        successCount: batchJob.successfulMovements,
        failureCount: batchJob.failedMovements,
        startedAt: batchJob.startedAt!,
        completedAt: batchJob.completedAt!,
        errors: batchJob.errors
      }
    )

  } catch (error) {
    batchJob.status = 'failed'
    batchJob.completedAt = new Date()
    batchJob.errors = [error instanceof Error ? error.message : 'Unknown error']

    console.error('Batch processing failed:', error)

    // Trigger webhook for batch failure
    await WebhookService.triggerBatchEvent('batch.failed', {
      batchId: batchJob.batchId,
      sourceSystem: batchJob.sourceSystem,
      totalCount: batchJob.totalMovements,
      successCount: batchJob.successfulMovements,
      failureCount: batchJob.totalMovements - batchJob.successfulMovements,
      startedAt: batchJob.startedAt!,
      completedAt: batchJob.completedAt!,
      errors: batchJob.errors
    })
  }
}

function handleGetBatchStatus(batchId: string): NextResponse {
  const batchJob = batchJobs.get(batchId)

  if (!batchJob) {
    return NextResponse.json(
      {
        success: false,
        error: `Batch with id '${batchId}' not found`
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      batchId: batchJob.batchId,
      status: batchJob.status,
      sourceSystem: batchJob.sourceSystem,
      totalMovements: batchJob.totalMovements,
      processedMovements: batchJob.processedMovements,
      successfulMovements: batchJob.successfulMovements,
      failedMovements: batchJob.failedMovements,
      createdAt: batchJob.createdAt,
      startedAt: batchJob.startedAt,
      completedAt: batchJob.completedAt,
      errors: batchJob.errors,
      progressPercentage: batchJob.totalMovements > 0 ?
        Math.round((batchJob.processedMovements / batchJob.totalMovements) * 100) : 0
    }
  })
}

function handleListBatches(filters: {
  status?: string | null
  sourceSystem?: string | null
  limit: number
  offset: number
}): NextResponse {
  let filteredBatches = Array.from(batchJobs.values())

  if (filters.status) {
    filteredBatches = filteredBatches.filter(batch => batch.status === filters.status)
  }

  if (filters.sourceSystem) {
    filteredBatches = filteredBatches.filter(batch => batch.sourceSystem === filters.sourceSystem)
  }

  // Sort by creation date (newest first)
  filteredBatches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  // Apply pagination
  const paginatedBatches = filteredBatches.slice(filters.offset, filters.offset + filters.limit)

  const batchSummaries = paginatedBatches.map(batch => ({
    batchId: batch.batchId,
    status: batch.status,
    sourceSystem: batch.sourceSystem,
    totalMovements: batch.totalMovements,
    processedMovements: batch.processedMovements,
    successfulMovements: batch.successfulMovements,
    failedMovements: batch.failedMovements,
    createdAt: batch.createdAt,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    progressPercentage: batch.totalMovements > 0 ?
      Math.round((batch.processedMovements / batch.totalMovements) * 100) : 0
  }))

  return NextResponse.json({
    success: true,
    data: {
      batches: batchSummaries,
      total: filteredBatches.length,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + filters.limit < filteredBatches.length
    }
  })
}

function handleCancelBatch(batchId: string, batchJob: BatchProcessingJob): NextResponse {
  if (batchJob.status === 'completed' || batchJob.status === 'failed') {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot cancel batch with status '${batchJob.status}'`
      },
      { status: 400 }
    )
  }

  batchJob.status = 'failed'
  batchJob.completedAt = new Date()
  batchJob.errors = ['Batch cancelled by user']

  return NextResponse.json({
    success: true,
    message: 'Batch cancelled successfully'
  })
}

function handleRetryBatch(batchId: string, batchJob: BatchProcessingJob, request: NextRequest): NextResponse {
  if (batchJob.status === 'processing' || batchJob.status === 'pending') {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot retry batch with status '${batchJob.status}'`
      },
      { status: 400 }
    )
  }

  // Reset batch job for retry
  batchJob.status = 'pending'
  batchJob.processedMovements = 0
  batchJob.successfulMovements = 0
  batchJob.failedMovements = 0
  batchJob.startedAt = undefined
  batchJob.completedAt = undefined
  batchJob.errors = undefined

  // Note: In a full implementation, we would need to recreate the original request
  // For now, we'll just indicate that retry would be implemented
  return NextResponse.json({
    success: true,
    message: 'Batch retry functionality would be implemented here',
    batchId
  })
}

function handleDeleteBatch(batchId: string): NextResponse {
  const batchJob = batchJobs.get(batchId)

  if (!batchJob) {
    return NextResponse.json(
      {
        success: false,
        error: `Batch with id '${batchId}' not found`
      },
      { status: 404 }
    )
  }

  if (batchJob.status === 'processing' || batchJob.status === 'pending') {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot delete batch with status '${batchJob.status}'. Cancel or wait for completion first.`
      },
      { status: 400 }
    )
  }

  batchJobs.delete(batchId)

  return NextResponse.json({
    success: true,
    message: 'Batch record deleted successfully'
  })
}

function handleCleanupOldBatches(olderThan: string): NextResponse {
  const cutoffDate = new Date(olderThan)

  if (isNaN(cutoffDate.getTime())) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid olderThan date format. Use ISO 8601 format (YYYY-MM-DD)'
      },
      { status: 400 }
    )
  }

  let deletedCount = 0

  for (const [batchId, batchJob] of batchJobs.entries()) {
    if (batchJob.createdAt < cutoffDate &&
        (batchJob.status === 'completed' || batchJob.status === 'failed')) {
      batchJobs.delete(batchId)
      deletedCount++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Cleaned up ${deletedCount} old batch records`,
    deletedCount
  })
}

function generateBatchId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `batch_${timestamp}_${random}`
}

function calculateEstimatedCompletion(movementCount: number): Date {
  // Estimate ~100 movements per second processing time
  const estimatedSeconds = Math.ceil(movementCount / 100)
  const completion = new Date()
  completion.setSeconds(completion.getSeconds() + estimatedSeconds)
  return completion
}

function extractUserFromRequest(request: NextRequest): string {
  const authHeader = request.headers.get('x-api-user')
  const apiKey = request.headers.get('x-api-key')

  if (authHeader) {
    return authHeader
  }

  if (apiKey) {
    return `api-key:${apiKey.substring(0, 8)}...`
  }

  return 'batch-api'
}