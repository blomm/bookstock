import { NextRequest, NextResponse } from 'next/server'
import StockMovementAuditService, { MovementChainOptions } from '@/services/stockMovementAuditService'

// GET /api/movements/chain/[chainId] - Get movement chain details
export async function GET(
  request: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const { chainId } = params

    if (!chainId) {
      return NextResponse.json(
        { error: 'chainId parameter is required' },
        { status: 400 }
      )
    }

    // Parse options
    const options: MovementChainOptions = {
      chainId,
      includeRelated: searchParams.get('includeRelated') === 'true',
      maxDepth: searchParams.get('maxDepth') ? parseInt(searchParams.get('maxDepth')!) : 10
    }

    // Check if specific movement ID is provided for chain tracing
    const movementId = searchParams.get('movementId')
    if (movementId) {
      options.movementId = parseInt(movementId)
    }

    const chainTracking = await StockMovementAuditService.traceMovementChain(options)

    if (!chainTracking) {
      return NextResponse.json(
        { error: 'Movement chain not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: chainTracking
    })

  } catch (error) {
    console.error('Chain tracking error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trace movement chain',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/movements/chain/[chainId] - Add movement to chain
export async function POST(
  request: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const { chainId } = params
    const body = await request.json()
    const { movementId, parentMovementId } = body

    if (!chainId || !movementId) {
      return NextResponse.json(
        { error: 'chainId and movementId are required' },
        { status: 400 }
      )
    }

    await StockMovementAuditService.addMovementToChain(
      movementId,
      chainId,
      parentMovementId
    )

    // Return updated chain
    const updatedChain = await StockMovementAuditService.getMovementChain(chainId)

    return NextResponse.json({
      success: true,
      data: updatedChain,
      message: 'Movement added to chain successfully'
    })

  } catch (error) {
    console.error('Add to chain error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add movement to chain',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}