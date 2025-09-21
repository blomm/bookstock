import { NextRequest, NextResponse } from 'next/server'
import { StatusManagementService } from '@/services/statusManagementService'

export async function POST(request: NextRequest) {
  try {
    const result = await StatusManagementService.processAutomatedStatusUpdates()

    return NextResponse.json({
      data: result,
      message: `Processed ${result.processed} titles, updated ${result.updatedTitles.length} statuses`
    })

  } catch (error) {
    console.error('POST /api/titles/status/automated-update error:', error)

    return NextResponse.json(
      { error: 'Failed to process automated status updates' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return information about automated status update rules
    return NextResponse.json({
      data: {
        rules: [
          {
            type: 'PRE_ORDER_TO_ACTIVE',
            description: 'Activate pre-order titles when inventory is received',
            condition: 'PRE_ORDER status + inventory > 0'
          },
          {
            type: 'ACTIVE_TO_DISCONTINUED',
            description: 'Discontinue active titles with zero inventory',
            condition: 'ACTIVE status + inventory = 0'
          }
        ],
        lastRun: null,
        nextScheduledRun: null
      }
    })

  } catch (error) {
    console.error('GET /api/titles/status/automated-update error:', error)

    return NextResponse.json(
      { error: 'Failed to get automated update information' },
      { status: 500 }
    )
  }
}