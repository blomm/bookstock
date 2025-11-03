import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { auditLogService } from '@/services/auditLogService'
import { z } from 'zod'

const AuditQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50)
})

async function getAuditLogsHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const filters = AuditQuerySchema.parse(queryParams)

    const result = await auditLogService.listLogs(filters)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'audit:read',
  getAuditLogsHandler
)