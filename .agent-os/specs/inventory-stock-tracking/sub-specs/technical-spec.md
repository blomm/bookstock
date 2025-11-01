# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-11-01-inventory-stock-tracking/spec.md

## Technical Requirements

### Database Layer (Prisma)

**Existing Models (Already in Schema):**
- `Inventory` - Tracks current and reserved stock per title per warehouse
- `StockMovement` - Records all inventory transactions
- `MovementType` enum - Defines movement categories

**Required Schema Updates:**
- Add `lowStockThreshold` field to `Title` model (nullable Int)
- Add `lastStockCheck` field to `Inventory` model (nullable DateTime)
- Ensure `Inventory` has proper indexes on `titleId`, `warehouseId`, and `currentStock`
- Ensure `StockMovement` has index on `movementDate` for historical queries

### API Layer (Next.js Route Handlers)

**New Endpoints:**
- `GET /api/inventory` - List inventory with filters (warehouse, low stock, search)
- `GET /api/inventory/[titleId]` - Get inventory details for a title across all warehouses
- `POST /api/inventory/adjust` - Manual stock adjustment (admin only)
- `GET /api/stock-movements` - List movements with pagination and filters
- `POST /api/stock-movements` - Create new stock movement
- `GET /api/stock-movements/[id]` - Get movement details
- `PATCH /api/titles/[id]/threshold` - Update low stock threshold (admin only)

**Authentication & Authorization:**
- All endpoints require Clerk authentication
- Read operations: `inventory:read` permission
- Write operations: `inventory:update` permission
- Adjustments: `inventory:adjust` permission (admin only)

### Service Layer

**InventoryService:**
- `getInventoryByTitle(titleId)` - Fetch all warehouse inventory for a title
- `getInventoryDashboard(filters)` - Get paginated inventory with warehouse breakdown
- `getLowStockTitles(warehouseId?)` - Get titles below threshold
- `adjustStock(titleId, warehouseId, newStock, reason, userId)` - Manual adjustment with audit

**StockMovementService:**
- `recordMovement(movementData)` - Create movement and update inventory atomically
- `validateMovement(movementData)` - Check sufficient stock for outbound movements
- `getMovementHistory(titleId, warehouseId?, dateRange?)` - Historical movements
- `processTransfer(titleId, sourceWarehouseId, destWarehouseId, quantity, userId)` - Handle transfers
- `calculateInventoryImpact(movementType, quantity)` - Determine +/- inventory change

**Business Logic:**
- PRINT_RECEIVED, REPRINT: Increases inventory (+quantity)
- SALES (all types), DAMAGE, RETURNED: Decreases inventory (-quantity)
- WAREHOUSE_TRANSFER: Decreases source, increases destination
- STOCK_ADJUSTMENT: Sets to absolute value (not delta)
- Validate sufficient stock before recording outbound movements
- Create audit log entry for every movement
- Check against low stock threshold after each movement

### UI Layer (React + refine.dev)

**Pages:**
- `/inventory` - Dashboard with DataGrid showing titles and stock per warehouse
- `/inventory/[id]` - Title inventory detail with stock history timeline
- `/inventory/movements` - Stock movements list with filters
- `/inventory/movements/new` - Record new stock movement form
- `/inventory/movements/[id]` - Movement detail view

**Components:**
- `InventoryDashboard` - Main inventory table with multi-warehouse columns
- `InventoryFilters` - Warehouse selector, low-stock toggle, search input
- `StockLevelIndicator` - Badge showing stock with color coding (green/yellow/red)
- `LowStockBadge` - Warning indicator when below threshold
- `StockMovementForm` - Form with dynamic fields based on movement type
- `StockHistoryTimeline` - Visualize movements over time
- `ManualAdjustmentModal` - Admin-only stock correction interface

**refine.dev Integration:**
- Use `useDataGrid` for inventory table with server-side pagination
- Use `useForm` for stock movement creation with Zod validation
- Use `useTable` for movements list
- Implement `dataProvider` methods for inventory and stock-movements resources

**UI/UX Specifications:**
- Low stock titles highlighted in yellow/orange
- Out of stock (0 units) highlighted in red
- Stock level changes in movement history shown as +/- deltas
- Transfer movements show both source and destination warehouses
- Real-time inventory updates after recording movements
- Confirmation modals for destructive operations (adjustments)
- Toast notifications for successful operations
- Loading skeletons during data fetch

### Performance Requirements

- Inventory dashboard loads in <500ms for 200 titles
- Stock movement recording completes in <200ms
- Use Redis caching for frequently accessed inventory data (5-minute TTL)
- Database indexes on title_id, warehouse_id, movement_date
- Implement pagination (20 items per page default)

### Testing Requirements

- Unit tests for InventoryService and StockMovementService methods
- Integration tests for all API endpoints
- E2E tests for critical workflows:
  - Record print receipt → verify inventory increase
  - Record warehouse transfer → verify source decrease + dest increase
  - Manual adjustment → verify audit log entry
  - Low stock alert → verify badge appears when threshold crossed
- Test concurrent movement recording (race conditions)
- Test transaction rollback on validation failures

### Error Handling

- Insufficient stock for outbound movement: 400 Bad Request with clear message
- Invalid movement type: 400 Bad Request
- Warehouse not found: 404 Not Found
- Permission denied for adjustments: 403 Forbidden
- Concurrent modification: 409 Conflict with retry suggestion
- Database transaction failures: 500 with rollback and user-friendly message

## External Dependencies

No new external dependencies required. The following existing dependencies will be used:

- **Prisma** - ORM for database operations and transactions
- **Zod** - Input validation for API endpoints
- **refine.dev** - Admin dashboard framework for inventory UI
- **Clerk** - Authentication and RBAC
- **Redis (Upstash)** - Caching for inventory data
- **Lucide React** - Icons for stock indicators and movement types
