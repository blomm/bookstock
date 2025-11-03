import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, type AuthenticatedRequest } from '@/middleware/apiAuthMiddleware'
import { stockMovementService } from '@/services/stockMovementService'
import { CreateStockMovementSchema, GetMovementHistorySchema } from '@/lib/validators/inventory'
import { z } from 'zod'

/**
 * GET /api/stock-movements
 *
 * Returns paginated movement history with filters
 *
 * Query Parameters:
 * - titleId: number (optional)
 * - warehouseId: number (optional)
 * - movementType: MovementType enum (optional)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * Returns: { data: StockMovement[], pagination: { page, limit, total, totalPages } }
 */
async function getStockMovementsHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Parse query parameters
    const params: any = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
    }

    if (searchParams.get('titleId')) {
      params.titleId = parseInt(searchParams.get('titleId')!)
    }

    if (searchParams.get('warehouseId')) {
      params.warehouseId = parseInt(searchParams.get('warehouseId')!)
    }

    if (searchParams.get('movementType')) {
      params.movementType = searchParams.get('movementType')!
    }

    if (searchParams.get('startDate')) {
      params.startDate = new Date(searchParams.get('startDate')!)
    }

    if (searchParams.get('endDate')) {
      params.endDate = new Date(searchParams.get('endDate')!)
    }

    // Validate with Zod schema
    const validated = GetMovementHistorySchema.parse(params)

    // Get movement history
    const movements = await stockMovementService.getMovementHistory({
      titleId: validated.titleId,
      warehouseId: validated.warehouseId,
      movementType: validated.movementType,
      startDate: validated.startDate,
      endDate: validated.endDate
    })

    // Apply pagination
    const skip = (validated.page - 1) * validated.limit
    const paginatedMovements = movements.slice(skip, skip + validated.limit)

    return NextResponse.json({
      data: paginatedMovements,
      pagination: {
        page: validated.page,
        limit: validated.limit,
        total: movements.length,
        totalPages: Math.ceil(movements.length / validated.limit)
      }
    })
  } catch (error) {
    // Validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('Error fetching stock movements:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stock movements',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/stock-movements
 *
 * Creates movement and updates inventory atomically
 *
 * Request Body: CreateStockMovementInput (validated by CreateStockMovementSchema)
 * - titleId: number
 * - warehouseId: number (not required for transfers)
 * - movementType: MovementType enum
 * - quantity: number (positive for inbound, can be negative for adjustments)
 * - movementDate: Date (optional, defaults to now)
 * - rrpAtTime: number (optional)
 * - unitCostAtTime: number (optional)
 * - tradeDiscountAtTime: number (optional)
 * - sourceWarehouseId: number (required for transfers)
 * - destinationWarehouseId: number (required for transfers)
 * - printerId: number (optional)
 * - referenceNumber: string (optional)
 * - notes: string (required for adjustments, optional otherwise)
 * - createdBy: string (optional, will be set from auth context)
 *
 * Returns: { data: { movement, inventoryUpdate } } (status 201)
 *
 * Errors:
 * - 400: Validation error
 * - 404: Title or warehouse not found
 * - 409: Insufficient stock
 * - 500: Internal server error
 */
async function createStockMovementHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json()

    // Add createdBy from authenticated user if not provided
    if (req.user && !body.createdBy) {
      body.createdBy = req.user.id
    }

    // Validate with Zod schema
    const data = CreateStockMovementSchema.parse(body)

    // Record the movement (includes inventory update in transaction)
    const result = await stockMovementService.recordMovement({
      ...data,
      movementDate: data.movementDate ? new Date(data.movementDate) : undefined
    })

    return NextResponse.json(
      {
        data: result,
        message: 'Stock movement recorded successfully'
      },
      { status: 201 }
    )
  } catch (error) {
    // Validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    // Business logic errors
    if (error instanceof Error) {
      // Not found errors
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'NOT_FOUND'
          },
          { status: 404 }
        )
      }

      // Insufficient stock errors
      if (error.message.includes('Insufficient stock')) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'INSUFFICIENT_STOCK'
          },
          { status: 409 }
        )
      }

      // Validation errors from service layer
      if (
        error.message.includes('requires') ||
        error.message.includes('must') ||
        error.message.includes('Invalid')
      ) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        )
      }
    }

    console.error('Error creating stock movement:', error)
    return NextResponse.json(
      {
        error: 'Failed to create stock movement',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'inventory:read',
  getStockMovementsHandler
)

export const POST = requirePermission(
  'inventory:update',
  createStockMovementHandler,
  {
    enableAuditLog: true,
    action: 'stock_movement:create',
    resource: 'stock_movement'
  }
)
