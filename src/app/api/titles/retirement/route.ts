import { NextRequest, NextResponse } from 'next/server'
import { StatusManagementService } from '@/services/statusManagementService'
import { z } from 'zod'

const processRetirementSchema = z.object({
  thresholdDays: z.number().min(1, 'Threshold must be at least 1 day'),
  batchSize: z.number().optional().default(100)
})

const archiveTitleSchema = z.object({
  titleId: z.number()
})

const retirementReportSchema = z.object({
  startDate: z.string().refine(date => !isNaN(Date.parse(date)), 'Invalid start date'),
  endDate: z.string().refine(date => !isNaN(Date.parse(date)), 'Invalid end date')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'process_retirement':
        const { thresholdDays, batchSize } = processRetirementSchema.parse(body)

        const retirementResult = await StatusManagementService.processRetirementCandidates(
          thresholdDays,
          { batchSize }
        )

        return NextResponse.json({
          data: retirementResult,
          message: `Processed ${retirementResult.totalCandidates} candidates, retired ${retirementResult.retiredTitles.length} titles`
        })

      case 'archive_title':
        const { titleId } = archiveTitleSchema.parse(body)

        const archiveResult = await StatusManagementService.archiveTitleData(titleId)

        return NextResponse.json({
          data: archiveResult,
          message: 'Title archived successfully'
        })

      case 'generate_report':
        const { startDate, endDate } = retirementReportSchema.parse(body)

        const report = await StatusManagementService.generateRetirementReport(
          new Date(startDate),
          new Date(endDate)
        )

        return NextResponse.json({
          data: report,
          message: `Generated retirement report for ${report.totalRetired} titles`
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: process_retirement, archive_title, or generate_report' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('POST /api/titles/retirement error:', error)

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

    if (error instanceof Error && error.message.includes('Failed to')) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process retirement request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action === 'candidates') {
      const thresholdDays = parseInt(url.searchParams.get('thresholdDays') || '120')
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000)

      const [candidates, total] = await Promise.all([
        prisma.title.findMany({
          where: {
            status: 'DISCONTINUED',
            isRetired: false,
            statusHistory: {
              some: {
                toStatus: 'DISCONTINUED',
                changedAt: { lt: thresholdDate }
              }
            }
          },
          include: {
            statusHistory: {
              where: { toStatus: 'DISCONTINUED' },
              orderBy: { changedAt: 'desc' },
              take: 1
            },
            stockMovements: {
              where: {
                movementDate: { gt: thresholdDate }
              },
              take: 1
            }
          },
          take: limit,
          skip: offset
        }),
        prisma.title.count({
          where: {
            status: 'DISCONTINUED',
            isRetired: false,
            statusHistory: {
              some: {
                toStatus: 'DISCONTINUED',
                changedAt: { lt: thresholdDate }
              }
            }
          }
        })
      ])

      return NextResponse.json({
        data: {
          candidates: candidates.map(title => ({
            id: title.id,
            isbn: title.isbn,
            title: title.title,
            discontinuedAt: title.statusHistory[0]?.changedAt,
            hasRecentActivity: title.stockMovements.length > 0,
            isRetirementCandidate: title.stockMovements.length === 0
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: total > offset + limit
          },
          thresholdDays
        }
      })
    }

    if (action === 'retired') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      const [retiredTitles, total] = await Promise.all([
        prisma.title.findMany({
          where: { isRetired: true },
          select: {
            id: true,
            isbn: true,
            title: true,
            retiredAt: true,
            isArchived: true,
            archivedAt: true
          },
          orderBy: { retiredAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.title.count({
          where: { isRetired: true }
        })
      ])

      return NextResponse.json({
        data: {
          retiredTitles,
          pagination: {
            total,
            limit,
            offset,
            hasMore: total > offset + limit
          }
        }
      })
    }

    return NextResponse.json({
      data: {
        availableActions: ['candidates', 'retired'],
        description: 'Use ?action=candidates or ?action=retired to get specific data'
      }
    })

  } catch (error) {
    console.error('GET /api/titles/retirement error:', error)

    return NextResponse.json(
      { error: 'Failed to get retirement information' },
      { status: 500 }
    )
  }
}