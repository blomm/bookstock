import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { inventoryService } from '@/services/inventoryService'
import { GetLowStockItemsSchema } from '@/lib/validators/inventory'
import { z } from 'zod'

/**
 * GET /api/inventory/low-stock
 *
 * Returns titles below threshold with warehouse breakdown
 *
 * Query Parameters:
 * - warehouseId: number (optional - filter by specific warehouse)
 *
 * Returns: { data: InventoryWithRelations[] }
 *
 * Response includes:
 * - Only items where currentStock < lowStockThreshold
 * - Items without threshold are excluded
 * - Grouped by title with warehouse details
 */
async function getLowStockHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Parse and validate query parameters
    const params = {
      warehouseId: searchParams.get('warehouseId')
        ? parseInt(searchParams.get('warehouseId')!)
        : undefined
    }

    // Validate with Zod schema
    const validated = GetLowStockItemsSchema.parse(params)

    // Get low stock items
    const lowStockItems = await inventoryService.getLowStockItems(validated.warehouseId)

    // Enrich with additional information
    const enrichedItems = lowStockItems.map(item => ({
      ...item,
      stockDeficit: item.title.lowStockThreshold
        ? item.title.lowStockThreshold - item.currentStock
        : 0,
      availableStock: item.currentStock - item.reservedStock,
      threshold: item.title.lowStockThreshold
    }))

    // Group by title for easier consumption
    const groupedByTitle = enrichedItems.reduce((acc, item) => {
      const titleId = item.titleId
      if (!acc[titleId]) {
        acc[titleId] = {
          title: item.title,
          warehouses: [],
          totalStock: 0,
          totalDeficit: 0
        }
      }
      acc[titleId].warehouses.push({
        warehouse: item.warehouse,
        currentStock: item.currentStock,
        reservedStock: item.reservedStock,
        availableStock: item.availableStock,
        stockDeficit: item.stockDeficit
      })
      acc[titleId].totalStock += item.currentStock
      acc[titleId].totalDeficit += item.stockDeficit
      return acc
    }, {} as Record<number, any>)

    return NextResponse.json({
      data: Object.values(groupedByTitle),
      summary: {
        totalTitlesLow: Object.keys(groupedByTitle).length,
        totalWarehousesAffected: enrichedItems.length
      }
    })
  } catch (error) {
    // Validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    console.error('Error fetching low stock items:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch low stock items',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'inventory:read',
  getLowStockHandler
)
