import { NextRequest, NextResponse } from 'next/server'
import MovementApprovalService, { MovementApprovalRequest, ApprovalSearchOptions } from '@/services/movementApprovalService'

// GET /api/movements/approval - Search approval requests or get metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Get approval metrics
    if (action === 'metrics') {
      const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined
      const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined

      const metrics = await MovementApprovalService.getApprovalMetrics(dateFrom, dateTo)

      return NextResponse.json({
        success: true,
        data: metrics
      })
    }

    // Get workflow configuration
    if (action === 'config') {
      const config = MovementApprovalService.getWorkflowConfig()

      return NextResponse.json({
        success: true,
        data: config
      })
    }

    // Search approval requests
    const searchOptions: ApprovalSearchOptions = {}

    if (searchParams.get('status')) {
      searchOptions.status = searchParams.get('status') as any
    }
    if (searchParams.get('requestedBy')) {
      searchOptions.requestedBy = searchParams.get('requestedBy')!
    }
    if (searchParams.get('approvedBy')) {
      searchOptions.approvedBy = searchParams.get('approvedBy')!
    }
    if (searchParams.get('priority')) {
      searchOptions.priority = searchParams.get('priority') as any
    }
    if (searchParams.get('movementType')) {
      searchOptions.movementType = searchParams.get('movementType') as any
    }
    if (searchParams.get('dateFrom')) {
      searchOptions.dateFrom = new Date(searchParams.get('dateFrom')!)
    }
    if (searchParams.get('dateTo')) {
      searchOptions.dateTo = new Date(searchParams.get('dateTo')!)
    }
    if (searchParams.get('limit')) {
      searchOptions.limit = parseInt(searchParams.get('limit')!)
    }
    if (searchParams.get('offset')) {
      searchOptions.offset = parseInt(searchParams.get('offset')!)
    }

    const approvalRequests = await MovementApprovalService.searchApprovalRequests(searchOptions)

    return NextResponse.json({
      success: true,
      data: approvalRequests,
      pagination: {
        limit: searchOptions.limit || 50,
        offset: searchOptions.offset || 0,
        total: approvalRequests.length
      }
    })

  } catch (error) {
    console.error('Approval search error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search approval requests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/movements/approval - Submit new approval request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      movementId,
      movementRequest,
      requestedBy,
      reason,
      priority = 'MEDIUM',
      autoApprovalChecked = true,
      metadata
    } = body

    // Validation
    if (!requestedBy || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: requestedBy, reason' },
        { status: 400 }
      )
    }

    if (!movementId && !movementRequest) {
      return NextResponse.json(
        { error: 'Either movementId or movementRequest must be provided' },
        { status: 400 }
      )
    }

    const approvalRequest: MovementApprovalRequest = {
      movementId,
      movementRequest,
      requestedBy,
      reason,
      priority,
      autoApprovalChecked,
      metadata
    }

    const approvalRecord = await MovementApprovalService.submitApprovalRequest(approvalRequest)

    return NextResponse.json({
      success: true,
      data: approvalRecord
    }, { status: 201 })

  } catch (error) {
    console.error('Approval request submission error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit approval request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH /api/movements/approval - Update workflow configuration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { config } = body

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration object is required' },
        { status: 400 }
      )
    }

    MovementApprovalService.updateWorkflowConfig(config)

    const updatedConfig = MovementApprovalService.getWorkflowConfig()

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: 'Workflow configuration updated successfully'
    })

  } catch (error) {
    console.error('Configuration update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update workflow configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}