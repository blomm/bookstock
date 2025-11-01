# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-11-01-inventory-stock-tracking/spec.md

## Schema Changes

### Inventory Model (Already Exists - Verify Fields)

The `Inventory` model should already exist with these fields. Verify and add missing fields if needed:

```prisma
model Inventory {
  id                 Int       @id @default(autoincrement())
  titleId            Int       @map("title_id")
  warehouseId        Int       @map("warehouse_id")
  currentStock       Int       @map("current_stock")
  reservedStock      Int       @default(0) @map("reserved_stock")
  lastMovementDate   DateTime? @map("last_movement_date")
  lastStockCheck     DateTime? @map("last_stock_check")  // NEW FIELD
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  title              Title     @relation(fields: [titleId], references: [id])
  warehouse          Warehouse @relation(fields: [warehouseId], references: [id])

  @@unique([titleId, warehouseId])
  @@map("inventory")
  @@index([titleId])
  @@index([warehouseId])
  @@index([currentStock])
}
```

**New Field:**
- `lastStockCheck` - Timestamp of last manual stock verification/adjustment

### Title Model Update

Add low stock threshold field to existing `Title` model:

```prisma
model Title {
  // ... existing fields ...
  lowStockThreshold  Int?      @map("low_stock_threshold")
  // ... rest of fields ...
}
```

**Rationale:** Storing threshold per title allows flexible configuration. Some titles need higher thresholds (bestsellers) while others can operate with lower safety stock.

### StockMovement Model (Already Exists - Verify)

Verify the `StockMovement` model has all required fields:

```prisma
model StockMovement {
  id                    Int          @id @default(autoincrement())
  titleId               Int          @map("title_id")
  warehouseId           Int          @map("warehouse_id")
  movementType          MovementType @map("movement_type")
  quantity              Int
  movementDate          DateTime     @map("movement_date")

  // Financial snapshot
  rrpAtTime             Decimal?     @db.Decimal(8, 2) @map("rrp_at_time")
  unitCostAtTime        Decimal?     @db.Decimal(8, 2) @map("unit_cost_at_time")
  tradeDiscountAtTime   Decimal?     @db.Decimal(5, 2) @map("trade_discount_at_time")

  // Transfer fields
  sourceWarehouseId     Int?         @map("source_warehouse_id")
  destinationWarehouseId Int?        @map("destination_warehouse_id")

  // Metadata
  printerId             Int?         @map("printer_id")
  referenceNumber       String?      @db.VarChar(100) @map("reference_number")
  notes                 String?      @db.Text
  createdBy             Int?         @map("created_by")  // User ID who created movement

  createdAt             DateTime     @default(now()) @map("created_at")
  updatedAt             DateTime     @updatedAt @map("updated_at")

  title                 Title        @relation(fields: [titleId], references: [id])
  warehouse             Warehouse    @relation(fields: [warehouseId], references: [id])
  printer               Printer?     @relation(fields: [printerId], references: [id])
  sourceWarehouse       Warehouse?   @relation("TransferSource", fields: [sourceWarehouseId], references: [id])
  destinationWarehouse  Warehouse?   @relation("TransferDestination", fields: [destinationWarehouseId], references: [id])
  creator               User?        @relation(fields: [createdBy], references: [id])

  @@map("stock_movements")
  @@index([titleId])
  @@index([warehouseId])
  @@index([movementType])
  @@index([movementDate])
  @@index([createdBy])
}
```

**Notes:**
- `createdBy` field should be added if it doesn't exist for audit trail
- Indexes on `movementDate` and `createdBy` needed for historical queries

### MovementType Enum (Already Exists - Verify)

Verify the enum includes all required movement types:

```prisma
enum MovementType {
  PRINT_RECEIVED
  REPRINT
  UK_TRADE_SALES
  ROW_TRADE_SALES
  US_TRADE_SALES
  ONLINE_SALES
  DAMAGE
  RETURNED
  WAREHOUSE_TRANSFER
  STOCK_ADJUSTMENT
}
```

**Rationale:**
- STOCK_ADJUSTMENT is critical for manual corrections
- All other types should already exist from the initial schema

## Migration Steps

### Migration 1: Add Low Stock Threshold to Titles

```sql
-- Add low_stock_threshold column to titles table
ALTER TABLE titles
ADD COLUMN low_stock_threshold INTEGER NULL;

-- Optional: Set default thresholds for existing titles based on print run size
UPDATE titles
SET low_stock_threshold = CASE
  WHEN print_run_size >= 3000 THEN 600
  WHEN print_run_size >= 2000 THEN 400
  ELSE 200
END
WHERE print_run_size IS NOT NULL;
```

**Rationale:** Nullable field allows gradual rollout. Can set defaults based on existing print run data.

### Migration 2: Add Last Stock Check to Inventory

```sql
-- Add last_stock_check column to inventory table
ALTER TABLE inventory
ADD COLUMN last_stock_check TIMESTAMP NULL;

-- Create index on current_stock for low-stock queries
CREATE INDEX IF NOT EXISTS idx_inventory_current_stock
ON inventory(current_stock);
```

**Rationale:** Tracking when stock was last physically verified helps identify stale records needing audit.

### Migration 3: Add Created By to Stock Movements

```sql
-- Add created_by column to stock_movements table
ALTER TABLE stock_movements
ADD COLUMN created_by INTEGER NULL;

-- Add foreign key constraint
ALTER TABLE stock_movements
ADD CONSTRAINT fk_stock_movements_created_by
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by
ON stock_movements(created_by);

-- Create index on movement_date for historical queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_date
ON stock_movements(movement_date DESC);
```

**Rationale:** Audit trail requires knowing who created each movement. SET NULL on user deletion preserves movement history even if user account is removed.

### Migration 4: Add Stock Adjustment Movement Type (If Missing)

```sql
-- Add STOCK_ADJUSTMENT to MovementType enum if not present
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTMENT';
```

**Rationale:** Required for manual inventory corrections and reconciliations.

## Data Integrity Constraints

### Business Rules

1. **Inventory Cannot Be Negative:**
   - Enforce at service layer (not database constraint)
   - Reject outbound movements that would result in negative stock
   - Allow manual adjustments to set to 0 but not negative

2. **Transfer Movements Must Have Both Warehouses:**
   - `movementType = 'WAREHOUSE_TRANSFER'` requires both `sourceWarehouseId` and `destinationWarehouseId`
   - Enforce at API validation layer with Zod

3. **Manual Adjustments Require Notes:**
   - `movementType = 'STOCK_ADJUSTMENT'` must have non-null `notes` field
   - Enforce at API validation layer

4. **Unique Inventory Per Title-Warehouse:**
   - Already enforced by `@@unique([titleId, warehouseId])`
   - Prevents duplicate inventory records

### Performance Considerations

**Indexes Required:**
- `inventory(title_id)` - For fetching all warehouses for a title
- `inventory(warehouse_id)` - For warehouse-specific inventory views
- `inventory(current_stock)` - For low-stock queries
- `stock_movements(title_id)` - For title movement history
- `stock_movements(movement_date DESC)` - For recent movements
- `stock_movements(created_by)` - For user audit trails

**Query Optimization:**
- Low stock query: `SELECT * FROM inventory WHERE current_stock < (SELECT low_stock_threshold FROM titles WHERE id = inventory.title_id)`
- Use Redis caching (5-min TTL) for inventory dashboard to avoid repeated database hits

## Prisma Migration Command

```bash
npx prisma migrate dev --name add_inventory_tracking_fields
```

This will generate the migration SQL and update the Prisma client types.
