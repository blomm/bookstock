import { NextRequest, NextResponse } from 'next/server'
import { StatusManagementService } from '@/services/statusManagementService'
import { TitleStatus } from '@prisma/client'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISCONTINUED', 'PRE_ORDER']),
  reason: z.string().min(1, 'Reason is required')
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const titleId = parseInt(params.id)

    if (isNaN(titleId)) {
      return NextResponse.json(
        { error: 'Invalid title ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status, reason } = updateStatusSchema.parse(body)

    const result = await StatusManagementService.updateTitleStatus(
      titleId,
      status as TitleStatus,
      reason
    )

    return NextResponse.json({
      data: result,
      message: 'Title status updated successfully'
    })

  } catch (error) {
    console.error(`PUT /api/titles/${params.id}/status error:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'Title not found') {
        return NextResponse.json(
          { error: 'Title not found' },
          { status: 404 }
        )
      }

      if (error.message.includes('Invalid status transition')) {
        return NextResponse.json(
          { error: error.message, code: 'INVALID_TRANSITION' },
          { status: 409 }
        )
      }

      if (error.message.includes('Cannot discontinue title with existing inventory')) {
        return NextResponse.json(
          { error: error.message, code: 'BUSINESS_RULE_VIOLATION' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to update title status' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const titleId = parseInt(params.id)

    if (isNaN(titleId)) {
      return NextResponse.json(
        { error: 'Invalid title ID' },
        { status: 400 }
      )
    }

    // Get title with status history
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    const title = await prisma.title.findUnique({
      where: { id: titleId },
      include: {
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        }
      }
    })

    if (!title) {
      return NextResponse.json(
        { error: 'Title not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: {
        currentStatus: title.status,
        statusHistory: title.statusHistory
      }
    })

  } catch (error) {
    console.error(`GET /api/titles/${params.id}/status error:`, error)

    return NextResponse.json(
      { error: 'Failed to get title status' },
      { status: 500 }
    )
  }
}