import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { auditLogger } from '@/middleware/auditMiddleware'
import { z } from 'zod'

const UserAuditQuerySchema = z.object({
  action: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50)
})

async function getUserAuditLogsHandler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const filters = UserAuditQuerySchema.parse(queryParams)

    const result = await auditLogger.getAuditLogs({
      ...filters,
      userId: parseInt(params.id)
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching user audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user audit logs' },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'audit:read',
  getUserAuditLogsHandler
)