import { z } from 'zod'

// Movement Type Enum Schema
export const MovementTypeSchema = z.enum([
  'PRINT_RECEIVED',
  'REPRINT',
  'WAREHOUSE_TRANSFER',
  'ONLINE_SALES',
  'UK_TRADE_SALES',
  'US_TRADE_SALES',
  'ROW_TRADE_SALES',
  'DIRECT_SALES',
  'PULPED',
  'DAMAGED',
  'FREE_COPIES',
  'STOCK_ADJUSTMENT'
])

// Base Stock Movement Schema
export const CreateStockMovementSchema = z.object({
  titleId: z.number().int().positive('Title ID must be a positive integer'),
  warehouseId: z.number().int().positive('Warehouse ID must be a positive integer'),
  movementType: MovementTypeSchema,
  quantity: z.number().int('Quantity must be an integer'),
  movementDate: z.coerce.date().optional(),

  // Financial snapshot (optional)
  rrpAtTime: z.number().positive().optional(),
  unitCostAtTime: z.number().positive().optional(),
  tradeDiscountAtTime: z.number().min(0).max(100).optional(),

  // Transfer-specific fields
  sourceWarehouseId: z.number().int().positive().optional(),
  destinationWarehouseId: z.number().int().positive().optional(),

  // Printer reference
  printerId: z.number().int().positive().optional(),

  // Reference and notes
  referenceNumber: z.string().max(100, 'Reference number must be 100 characters or less').optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),

  // Audit trail
  createdBy: z.string().optional()
}).refine(
  (data) => {
    // Warehouse transfers must have both source and destination
    if (data.movementType === 'WAREHOUSE_TRANSFER') {
      return data.sourceWarehouseId && data.destinationWarehouseId
    }
    return true
  },
  {
    message: 'Warehouse transfers require both sourceWarehouseId and destinationWarehouseId',
    path: ['movementType']
  }
).refine(
  (data) => {
    // Stock adjustments must have notes explaining the reason
    if (data.movementType === 'STOCK_ADJUSTMENT') {
      return data.notes && data.notes.length >= 10
    }
    return true
  },
  {
    message: 'Stock adjustments require notes (minimum 10 characters) explaining the reason',
    path: ['notes']
  }
).refine(
  (data) => {
    // Validate quantity based on movement type
    const outboundTypes = [
      'ONLINE_SALES',
      'UK_TRADE_SALES',
      'US_TRADE_SALES',
      'ROW_TRADE_SALES',
      'DIRECT_SALES',
      'PULPED',
      'DAMAGED',
      'FREE_COPIES'
    ]

    const inboundTypes = [
      'PRINT_RECEIVED',
      'REPRINT'
    ]

    // Outbound movements should have negative quantity (or will be made negative by service)
    // Inbound movements should have positive quantity
    // Transfers and adjustments can be either
    if (inboundTypes.includes(data.movementType)) {
      return data.quantity > 0
    }

    return true
  },
  {
    message: 'Inbound movements (PRINT_RECEIVED, REPRINT) must have positive quantity',
    path: ['quantity']
  }
)

// Low Stock Threshold Update Schema
export const UpdateLowStockThresholdSchema = z.object({
  lowStockThreshold: z.number().int().nonnegative('Threshold must be non-negative').nullable()
})

// Manual Stock Adjustment Schema (stricter validation)
export const ManualStockAdjustmentSchema = z.object({
  titleId: z.number().int().positive('Title ID must be a positive integer'),
  warehouseId: z.number().int().positive('Warehouse ID must be a positive integer'),
  newStock: z.number().int().nonnegative('New stock level must be non-negative'),
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must be 500 characters or less'),
  createdBy: z.string().min(1, 'User ID is required for audit trail')
})

// Get Movement History Query Parameters Schema
export const GetMovementHistorySchema = z.object({
  titleId: z.number().int().positive().optional(),
  warehouseId: z.number().int().positive().optional(),
  movementType: MovementTypeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
})

// Get Low Stock Items Query Parameters Schema
export const GetLowStockItemsSchema = z.object({
  warehouseId: z.number().int().positive().optional()
})

// Type exports for TypeScript
export type CreateStockMovementInput = z.infer<typeof CreateStockMovementSchema>
export type UpdateLowStockThresholdInput = z.infer<typeof UpdateLowStockThresholdSchema>
export type ManualStockAdjustmentInput = z.infer<typeof ManualStockAdjustmentSchema>
export type GetMovementHistoryParams = z.infer<typeof GetMovementHistorySchema>
export type GetLowStockItemsParams = z.infer<typeof GetLowStockItemsSchema>
export type MovementType = z.infer<typeof MovementTypeSchema>
