import { NextRequest, NextResponse } from 'next/server'
import InventoryDiscrepancyService from '@/services/inventoryDiscrepancyService'

// GET /api/inventory/alerts - Get inventory discrepancy alerts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const alertType = searchParams.get('type')
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const warehouseId = searchParams.get('warehouseId')
    const titleId = searchParams.get('titleId')

    let alerts = InventoryDiscrepancyService.getActiveAlerts()

    // Apply filters
    if (alertType) {
      alerts = alerts.filter(alert => alert.type === alertType)
    }

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity)
    }

    if (status) {
      alerts = alerts.filter(alert => alert.status === status)
    }

    if (warehouseId) {
      alerts = alerts.filter(alert => alert.warehouseId === parseInt(warehouseId))
    }

    if (titleId) {
      alerts = alerts.filter(alert => alert.titleId === parseInt(titleId))
    }

    // Sort by severity and detection time
    const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
    alerts.sort((a, b) => {
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
      if (severityDiff !== 0) return severityDiff
      return b.detectedAt.getTime() - a.detectedAt.getTime()
    })

    return NextResponse.json({
      data: alerts,
      count: alerts.length,
      summary: {
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        high: alerts.filter(a => a.severity === 'HIGH').length,
        medium: alerts.filter(a => a.severity === 'MEDIUM').length,
        low: alerts.filter(a => a.severity === 'LOW').length,
        open: alerts.filter(a => a.status === 'OPEN').length,
        acknowledged: alerts.filter(a => a.status === 'ACKNOWLEDGED').length
      }
    })
  } catch (error) {
    console.error('GET /api/inventory/alerts error:', error)

    return NextResponse.json(
      { error: 'Failed to retrieve inventory alerts' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/alerts - Initialize discrepancy monitoring
export async function POST(request: NextRequest) {
  try {
    await InventoryDiscrepancyService.initializeMonitoring()

    return NextResponse.json({
      message: 'Inventory discrepancy monitoring initialized successfully'
    })
  } catch (error) {
    console.error('POST /api/inventory/alerts error:', error)

    return NextResponse.json(
      { error: 'Failed to initialize discrepancy monitoring' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/alerts/[alertId] - Resolve or acknowledge alert
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const url = new URL(request.url)
    const alertId = url.pathname.split('/').pop()

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      )
    }

    const validStatuses = ['RESOLVED', 'FALSE_POSITIVE', 'ACKNOWLEDGED']
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: 'Valid status is required (RESOLVED, FALSE_POSITIVE, ACKNOWLEDGED)' },
        { status: 400 }
      )
    }

    const success = InventoryDiscrepancyService.resolveAlert(
      alertId,
      body.status
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `Alert ${body.status.toLowerCase()} successfully`
    })
  } catch (error) {
    console.error('PUT /api/inventory/alerts error:', error)

    return NextResponse.json(
      { error: 'Failed to update alert status' },
      { status: 500 }
    )
  }
}