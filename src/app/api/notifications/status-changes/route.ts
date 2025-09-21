import { NextRequest, NextResponse } from 'next/server'
import { StatusManagementService } from '@/services/statusManagementService'
import { TitleStatus } from '@prisma/client'
import { z } from 'zod'

const batchNotificationSchema = z.object({
  notifications: z.array(z.object({
    titleId: z.number(),
    fromStatus: z.enum(['ACTIVE', 'DISCONTINUED', 'PRE_ORDER']),
    toStatus: z.enum(['ACTIVE', 'DISCONTINUED', 'PRE_ORDER']),
    reason: z.string()
  }))
})

const singleNotificationSchema = z.object({
  titleId: z.number(),
  fromStatus: z.enum(['ACTIVE', 'DISCONTINUED', 'PRE_ORDER']),
  toStatus: z.enum(['ACTIVE', 'DISCONTINUED', 'PRE_ORDER']),
  reason: z.string()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if it's a batch notification or single notification
    if (body.notifications) {
      // Batch notification
      const { notifications } = batchNotificationSchema.parse(body)

      const result = await StatusManagementService.queueBatchNotifications(
        notifications.map(n => ({
          ...n,
          fromStatus: n.fromStatus as TitleStatus,
          toStatus: n.toStatus as TitleStatus
        }))
      )

      return NextResponse.json({
        data: result,
        message: `Queued ${result.queued} notifications, ${result.failed} failed`
      })
    } else {
      // Single notification
      const { titleId, fromStatus, toStatus, reason } = singleNotificationSchema.parse(body)

      const result = await StatusManagementService.sendStatusChangeNotification(
        titleId,
        fromStatus as TitleStatus,
        toStatus as TitleStatus,
        reason
      )

      return NextResponse.json({
        data: result,
        message: result.length > 0 ? 'Notification sent successfully' : 'No notification sent'
      })
    }

  } catch (error) {
    console.error('POST /api/notifications/status-changes error:', error)

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

    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const titleId = url.searchParams.get('titleId')
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    const where: any = {}
    if (titleId) where.titleId = parseInt(titleId)
    if (status) where.status = status

    const [notifications, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        include: {
          title: {
            select: { isbn: true, title: true, publisher: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.notificationLog.count({ where })
    ])

    return NextResponse.json({
      data: {
        notifications,
        pagination: {
          total,
          limit,
          offset,
          hasMore: total > offset + limit
        }
      }
    })

  } catch (error) {
    console.error('GET /api/notifications/status-changes error:', error)

    return NextResponse.json(
      { error: 'Failed to get notifications' },
      { status: 500 }
    )
  }
}