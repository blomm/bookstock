import { NextRequest, NextResponse } from 'next/server'
import RealTimeInventoryService from '@/services/realTimeInventoryService'
import InventoryDiscrepancyService from '@/services/inventoryDiscrepancyService'

// GET /api/inventory/synchronization - Get synchronization status and discrepancies
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const titleId = searchParams.get('titleId')
    const warehouseIds = searchParams.get('warehouseIds')
    const scanType = searchParams.get('scanType') || 'discrepancies'

    if (scanType === 'comprehensive') {
      // Perform comprehensive discrepancy scan
      const warehouseId = searchParams.get('warehouseId')
      const scanResult = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
        warehouseId ? parseInt(warehouseId) : undefined
      )

      return NextResponse.json({
        data: scanResult,
        type: 'comprehensive_scan'
      })
    } else if (titleId) {
      // Get synchronization discrepancies for a specific title
      const warehouseIdArray = warehouseIds ?
        warehouseIds.split(',').map(id => parseInt(id.trim())) :
        undefined

      const discrepancies = await InventoryDiscrepancyService.detectSynchronizationDiscrepancies(
        parseInt(titleId),
        warehouseIdArray
      )

      return NextResponse.json({
        data: discrepancies,
        count: discrepancies.length,
        type: 'title_sync_discrepancies'
      })
    } else {
      return NextResponse.json(
        { error: 'titleId parameter is required for discrepancy detection' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('GET /api/inventory/synchronization error:', error)

    return NextResponse.json(
      { error: 'Failed to retrieve synchronization status' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/synchronization - Create inventory snapshots for comparison
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.warehouseId) {
      return NextResponse.json(
        { error: 'warehouseId is required' },
        { status: 400 }
      )
    }

    const snapshot = await RealTimeInventoryService.createInventorySnapshot(body.warehouseId)

    return NextResponse.json({
      data: snapshot,
      message: 'Inventory snapshot created successfully'
    })
  } catch (error) {
    console.error('POST /api/inventory/synchronization error:', error)

    return NextResponse.json(
      { error: 'Failed to create inventory snapshot' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/synchronization - Compare inventory snapshots
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.snapshot1 || !body.snapshot2) {
      return NextResponse.json(
        { error: 'snapshot1 and snapshot2 are required' },
        { status: 400 }
      )
    }

    const comparison = await RealTimeInventoryService.compareInventorySnapshots(
      body.snapshot1,
      body.snapshot2
    )

    return NextResponse.json({
      data: comparison,
      message: 'Inventory snapshots compared successfully'
    })
  } catch (error) {
    console.error('PUT /api/inventory/synchronization error:', error)

    return NextResponse.json(
      { error: 'Failed to compare inventory snapshots' },
      { status: 500 }
    )
  }
}