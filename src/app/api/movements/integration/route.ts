import { NextRequest, NextResponse } from 'next/server'
import MovementIntegrationService, {
  ExternalMovementRequest,
  BulkMovementRequest,
  MovementSyncRequest
} from '@/services/movementIntegrationService'
import { MovementType } from '@prisma/client'

// GET /api/movements/integration - Synchronize movement data for external systems
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Required parameters
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const externalSystemId = searchParams.get('externalSystemId')

    if (!dateFrom || !dateTo || !externalSystemId) {
      return NextResponse.json(
        {
          error: 'dateFrom, dateTo, and externalSystemId parameters are required'
        },
        { status: 400 }
      )
    }

    const startDate = new Date(dateFrom)
    const endDate = new Date(dateTo)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'dateFrom must be before dateTo' },
        { status: 400 }
      )
    }

    // Optional filters
    const warehouseIds = searchParams.get('warehouseIds')
    const movementTypes = searchParams.get('movementTypes')
    const includeMetadata = searchParams.get('includeMetadata') === 'true'

    const syncRequest: MovementSyncRequest = {
      dateFrom: startDate,
      dateTo: endDate,
      externalSystemId,
      includeMetadata
    }

    // Parse warehouse IDs
    if (warehouseIds) {
      syncRequest.warehouseIds = warehouseIds.split(',').map(id => {
        const num = parseInt(id.trim())
        if (isNaN(num)) {
          throw new Error(`Invalid warehouse ID: ${id}`)
        }
        return num
      })
    }

    // Parse movement types
    if (movementTypes) {
      const validTypes = [
        'PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES',
        'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES'
      ]

      syncRequest.movementTypes = movementTypes.split(',').map(type => {
        const trimmedType = type.trim() as MovementType
        if (!validTypes.includes(trimmedType)) {
          throw new Error(`Invalid movement type: ${type}`)
        }
        return trimmedType
      })
    }

    const syncResponse = await MovementIntegrationService.synchronizeMovements(syncRequest)

    return NextResponse.json({
      success: true,
      data: syncResponse
    })

  } catch (error) {
    console.error('Movement synchronization error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to synchronize movements',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/movements/integration - Process external movement data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if it's a bulk request
    if (body.movements && Array.isArray(body.movements)) {
      return await handleBulkMovements(body as BulkMovementRequest, request)
    } else {
      return await handleSingleMovement(body as ExternalMovementRequest, request)
    }

  } catch (error) {
    console.error('Movement integration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process movement',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleSingleMovement(
  movementRequest: ExternalMovementRequest,
  request: NextRequest
): Promise<NextResponse> {

  // Basic validation
  if (!movementRequest.externalId || !movementRequest.sourceSystem) {
    return NextResponse.json(
      {
        success: false,
        error: 'externalId and sourceSystem are required'
      },
      { status: 400 }
    )
  }

  if (!movementRequest.titleId || !movementRequest.warehouseId || !movementRequest.movementType) {
    return NextResponse.json(
      {
        success: false,
        error: 'titleId, warehouseId, and movementType are required'
      },
      { status: 400 }
    )
  }

  if (!movementRequest.quantity || movementRequest.quantity === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'quantity must be non-zero'
      },
      { status: 400 }
    )
  }

  // Validate movement type
  const validMovementTypes = [
    'PRINT_RECEIVED', 'WAREHOUSE_TRANSFER', 'ONLINE_SALES', 'UK_TRADE_SALES',
    'US_TRADE_SALES', 'ROW_TRADE_SALES', 'DIRECT_SALES', 'PULPED', 'DAMAGED', 'FREE_COPIES'
  ]

  if (!validMovementTypes.includes(movementRequest.movementType)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid movement type. Valid types: ${validMovementTypes.join(', ')}`
      },
      { status: 400 }
    )
  }

  // Extract user info from request (in production, this would come from authentication)
  const performedBy = extractUserFromRequest(request)

  const result = await MovementIntegrationService.processExternalMovement(
    movementRequest,
    performedBy
  )

  const statusCode = result.success ? 200 : 400

  return NextResponse.json(result, { status: statusCode })
}

async function handleBulkMovements(
  bulkRequest: BulkMovementRequest,
  request: NextRequest
): Promise<NextResponse> {

  // Basic validation
  if (!bulkRequest.movements || !Array.isArray(bulkRequest.movements)) {
    return NextResponse.json(
      {
        success: false,
        error: 'movements array is required'
      },
      { status: 400 }
    )
  }

  if (bulkRequest.movements.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'movements array cannot be empty'
      },
      { status: 400 }
    )
  }

  if (bulkRequest.movements.length > 1000) {
    return NextResponse.json(
      {
        success: false,
        error: 'Maximum 1000 movements per batch'
      },
      { status: 400 }
    )
  }

  if (!bulkRequest.sourceSystem) {
    return NextResponse.json(
      {
        success: false,
        error: 'sourceSystem is required for bulk operations'
      },
      { status: 400 }
    )
  }

  // Extract user info from request (in production, this would come from authentication)
  const performedBy = extractUserFromRequest(request)

  const result = await MovementIntegrationService.processBulkMovements(
    bulkRequest,
    performedBy
  )

  // Return partial success if some movements succeeded
  const statusCode = result.successCount > 0 ? 200 : 400

  return NextResponse.json({
    success: result.successCount > 0,
    data: result
  }, { status: statusCode })
}

function extractUserFromRequest(request: NextRequest): string {
  // In a production system, this would extract user info from JWT token or session
  // For now, we'll use a header or default to 'api-integration'

  const authHeader = request.headers.get('x-api-user')
  const apiKey = request.headers.get('x-api-key')

  if (authHeader) {
    return authHeader
  }

  if (apiKey) {
    return `api-key:${apiKey.substring(0, 8)}...`
  }

  return 'api-integration'
}

// PUT /api/movements/integration - Update integration settings or retry failed operations
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'retry_failed':
        return await handleRetryFailed(params, request)

      case 'get_metrics':
        return await handleGetMetrics(params, request)

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Invalid action: ${action}. Valid actions: retry_failed, get_metrics`
          },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Integration operation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute integration operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleRetryFailed(params: any, request: NextRequest): Promise<NextResponse> {
  // This would typically retry failed movements from a queue or database
  // For now, return a placeholder response
  return NextResponse.json({
    success: true,
    message: 'Retry functionality would be implemented here',
    data: {
      retriedCount: 0,
      pendingRetries: 0
    }
  })
}

async function handleGetMetrics(params: any, request: NextRequest): Promise<NextResponse> {
  const { systemId } = params

  if (!systemId) {
    return NextResponse.json(
      {
        success: false,
        error: 'systemId is required for metrics'
      },
      { status: 400 }
    )
  }

  const metrics = await MovementIntegrationService.getIntegrationMetrics(systemId)

  return NextResponse.json({
    success: true,
    data: metrics
  })
}