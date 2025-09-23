import { NextRequest, NextResponse } from 'next/server'
import { WarehouseManagementService, CreateWarehouseData } from '@/services/warehouseManagementService'

// GET /api/warehouses - List all warehouses with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      location: searchParams.get('location') || undefined,
      fulfillsChannel: searchParams.get('fulfillsChannel') || undefined
    }

    const warehouses = await WarehouseManagementService.listWarehouses(filters)

    return NextResponse.json({
      data: warehouses,
      count: warehouses.length
    })
  } catch (error) {
    console.error('GET /api/warehouses error:', error)

    return NextResponse.json(
      { error: 'Failed to retrieve warehouses' },
      { status: 500 }
    )
  }
}

// POST /api/warehouses - Create new warehouse
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateWarehouseData

    // Basic validation
    if (!body.name || !body.code || !body.location) {
      return NextResponse.json(
        { error: 'Name, code, and location are required' },
        { status: 400 }
      )
    }

    const warehouse = await WarehouseManagementService.createWarehouse(body)

    return NextResponse.json({
      data: warehouse,
      message: 'Warehouse created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/warehouses error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to create warehouse'
    const statusCode = errorMessage.includes('already exists') ? 409 : 500

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}