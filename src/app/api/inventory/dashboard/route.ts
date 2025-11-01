import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/middleware/apiAuthMiddleware'
import { inventoryService } from '@/services/inventoryService'
import { z } from 'zod'

/**
 * GET /api/inventory/dashboard
 *
 * Returns inventory grouped by warehouse with current stock levels
 *
 * Query Parameters:
 * - warehouseId: number (optional - filter by specific warehouse)
 *
 * Returns: { data: InventoryWithRelations[] }
 *
 * Response includes:
 * - Inventory records with title and warehouse details
 * - Current stock and reserved stock levels
 * - Low stock indicators based on thresholds
 */
async function getInventoryDashboardHandler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const warehouseId = searchParams.get('warehouseId')
      ? parseInt(searchParams.get('warehouseId')!)
      : undefined

    // Validate warehouseId if provided
    if (warehouseId !== undefined && (isNaN(warehouseId) || warehouseId <= 0)) {
      return NextResponse.json(
        {
          error: 'Invalid warehouse ID',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    // NOTE: Authorization is enforced via requirePermission middleware
    // Future enhancement: Add organization-level filtering when multi-tenant support is added
    // This would ensure users can only access inventory from their organization's warehouses

    let inventory

    if (warehouseId) {
      // Get inventory for specific warehouse
      inventory = await inventoryService.getInventoryByWarehouse(warehouseId)
    } else {
      // Get all inventory across all warehouses
      const { prisma } = await import('@/lib/database')
      inventory = await prisma.inventory.findMany({
        include: {
          title: true,
          warehouse: true
        },
        orderBy: [
          { warehouse: { name: 'asc' } },
          { title: { title: 'asc' } }
        ]
      })
    }

    // Add low stock indicators
    const enrichedInventory = inventory.map(item => ({
      ...item,
      isLowStock: item.title.lowStockThreshold !== null &&
                  item.currentStock < item.title.lowStockThreshold,
      availableStock: item.currentStock - item.reservedStock
    }))

    return NextResponse.json({
      data: enrichedInventory
    })
  } catch (error) {
    console.error('Error fetching inventory dashboard:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory dashboard',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

export const GET = requirePermission(
  'inventory:read',
  getInventoryDashboardHandler
)
