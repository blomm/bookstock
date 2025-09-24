import { NextRequest, NextResponse } from 'next/server'
import MovementApprovalService from '@/services/movementApprovalService'

// GET /api/movements/approval/[approvalId] - Get specific approval record
export async function GET(
  request: NextRequest,
  { params }: { params: { approvalId: string } }
) {
  try {
    const { approvalId } = params

    if (!approvalId) {
      return NextResponse.json(
        { error: 'approvalId parameter is required' },
        { status: 400 }
      )
    }

    const id = parseInt(approvalId)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid approvalId parameter' },
        { status: 400 }
      )
    }

    const approvalRecord = await MovementApprovalService.getApprovalRecord(id)

    if (!approvalRecord) {
      return NextResponse.json(
        { error: 'Approval record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: approvalRecord
    })

  } catch (error) {
    console.error('Approval record retrieval error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve approval record',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH /api/movements/approval/[approvalId] - Update approval status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { approvalId: string } }
) {
  try {
    const { approvalId } = params
    const body = await request.json()
    const { action, performedBy, notes, rejectionReason, escalateTo } = body

    if (!approvalId) {
      return NextResponse.json(
        { error: 'approvalId parameter is required' },
        { status: 400 }
      )
    }

    const id = parseInt(approvalId)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid approvalId parameter' },
        { status: 400 }
      )
    }

    if (!action || !performedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: action, performedBy' },
        { status: 400 }
      )
    }

    let updatedRecord

    switch (action) {
      case 'approve':
        updatedRecord = await MovementApprovalService.approveMovement(id, performedBy, notes)
        break

      case 'reject':
        if (!rejectionReason) {
          return NextResponse.json(
            { error: 'rejectionReason is required for rejection' },
            { status: 400 }
          )
        }
        updatedRecord = await MovementApprovalService.rejectMovement(id, performedBy, rejectionReason)
        break

      case 'escalate':
        if (!escalateTo) {
          return NextResponse.json(
            { error: 'escalateTo is required for escalation' },
            { status: 400 }
          )
        }
        updatedRecord = await MovementApprovalService.escalateApproval(id, performedBy, escalateTo, notes)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: approve, reject, escalate' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: `Approval ${action}d successfully`
    })

  } catch (error) {
    console.error('Approval update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to ${body?.action || 'update'} approval`,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}