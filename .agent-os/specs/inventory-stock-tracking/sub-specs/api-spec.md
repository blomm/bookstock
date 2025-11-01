# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-11-01-inventory-stock-tracking/spec.md

## Authentication & Authorization

All endpoints require:
- Clerk JWT authentication
- Appropriate RBAC permissions via User/Role/UserRole model

**Permission Matrix:**
| Endpoint | Required Permission | Notes |
|----------|-------------------|-------|
| GET /api/inventory | `inventory:read` | All authenticated users |
| GET /api/inventory/[id] | `inventory:read` | All authenticated users |
| POST /api/inventory/adjust | `inventory:adjust` | Admin only |
| GET /api/stock-movements | `movement:read` | Operations and above |
| POST /api/stock-movements | `movement:create` | Inventory clerk and above |
| PATCH /api/titles/[id]/threshold | `title:update` | Admin only |

## Endpoints

### GET /api/inventory

**Purpose:** Retrieve paginated inventory list with warehouse breakdown and filtering

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20, max: 100) - Items per page
- `warehouseId` (number, optional) - Filter by warehouse
- `lowStockOnly` (boolean, optional) - Only show titles below threshold
- `search` (string, optional) - Search by title or ISBN
- `sortBy` (string, optional: "title" | "isbn" | "stock") - Sort field
- `sortOrder` (string, optional: "asc" | "desc") - Sort direction

**Response:** 200 OK
```json
{
  "data": [
    {
      "title": {
        "id": 1,
        "title": "The Opinionated Guide to TypeScript",
        "isbn": "9781234567890",
        "lowStockThreshold": 500
      },
      "inventory": [
        {
          "warehouseId": 1,
          "warehouseName": "UK Warehouse - London",
          "warehouseCode": "UK-LON",
          "currentStock": 2400,
          "reservedStock": 50,
          "isLowStock": false,
          "lastMovementDate": "2024-03-15T10:30:00Z",
          "lastStockCheck": null
        },
        {
          "warehouseId": 2,
          "warehouseName": "US Warehouse - New York",
          "warehouseCode": "US-NYC",
          "currentStock": 450,
          "reservedStock": 25,
          "isLowStock": true,
          "lastMovementDate": "2024-03-15T10:30:00Z",
          "lastStockCheck": null
        }
      ],
      "totalStock": 2850,
      "totalReserved": 75,
      "hasLowStock": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Errors:**
- 401 Unauthorized - Missing or invalid authentication
- 403 Forbidden - Insufficient permissions

---

### GET /api/inventory/[titleId]

**Purpose:** Get detailed inventory for a specific title across all warehouses with stock history

**Path Parameters:**
- `titleId` (number) - Title ID

**Query Parameters:**
- `includeHistory` (boolean, default: true) - Include stock movement history
- `historyDays` (number, default: 90) - Days of history to include

**Response:** 200 OK
```json
{
  "title": {
    "id": 1,
    "title": "The Opinionated Guide to TypeScript",
    "isbn": "9781234567890",
    "author": "Jane Developer",
    "lowStockThreshold": 500
  },
  "inventory": [
    {
      "id": 1,
      "warehouseId": 1,
      "warehouse": {
        "id": 1,
        "name": "UK Warehouse - London",
        "code": "UK-LON"
      },
      "currentStock": 2400,
      "reservedStock": 50,
      "availableStock": 2350,
      "isLowStock": false,
      "lastMovementDate": "2024-03-15T10:30:00Z",
      "lastStockCheck": null,
      "createdAt": "2024-03-15T10:00:00Z",
      "updatedAt": "2024-03-15T10:30:00Z"
    }
  ],
  "movements": [
    {
      "id": 1,
      "movementType": "PRINT_RECEIVED",
      "quantity": 3000,
      "movementDate": "2024-03-15T10:30:00Z",
      "warehouseId": 1,
      "warehouse": { "name": "UK Warehouse - London", "code": "UK-LON" },
      "notes": "Initial print run",
      "referenceNumber": "LS-2024-001",
      "createdBy": 5,
      "creator": { "firstName": "John", "lastName": "Admin" }
    }
  ],
  "summary": {
    "totalStock": 2850,
    "totalReserved": 75,
    "totalAvailable": 2775,
    "warehouseCount": 3,
    "hasLowStock": true,
    "lowStockWarehouses": ["US-NYC"]
  }
}
```

**Errors:**
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found - Title doesn't exist

---

### POST /api/inventory/adjust

**Purpose:** Manually adjust stock level for a title in a specific warehouse (admin only)

**Request Body:**
```json
{
  "titleId": 1,
  "warehouseId": 1,
  "newStock": 2475,
  "reason": "Physical inventory count - found 75 extra units"
}
```

**Validation Rules:**
- `titleId` (required, number) - Must exist in database
- `warehouseId` (required, number) - Must exist in database
- `newStock` (required, number, >= 0) - New absolute stock level
- `reason` (required, string, min: 10 chars, max: 500 chars) - Justification for adjustment

**Response:** 200 OK
```json
{
  "movement": {
    "id": 45,
    "movementType": "STOCK_ADJUSTMENT",
    "quantity": 75,
    "movementDate": "2024-03-20T14:15:00Z",
    "notes": "Physical inventory count - found 75 extra units",
    "createdBy": 5
  },
  "inventory": {
    "id": 1,
    "currentStock": 2475,
    "previousStock": 2400,
    "delta": 75,
    "lastMovementDate": "2024-03-20T14:15:00Z",
    "lastStockCheck": "2024-03-20T14:15:00Z"
  }
}
```

**Errors:**
- 400 Bad Request - Invalid input (negative stock, missing reason)
- 401 Unauthorized
- 403 Forbidden - User doesn't have `inventory:adjust` permission
- 404 Not Found - Title or warehouse not found
- 500 Internal Server Error - Database transaction failed

---

### GET /api/stock-movements

**Purpose:** List stock movements with filtering and pagination

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `titleId` (number, optional) - Filter by title
- `warehouseId` (number, optional) - Filter by warehouse
- `movementType` (MovementType, optional) - Filter by type
- `startDate` (ISO date, optional) - Filter movements after this date
- `endDate` (ISO date, optional) - Filter movements before this date
- `createdBy` (number, optional) - Filter by user who created movement

**Response:** 200 OK
```json
{
  "data": [
    {
      "id": 1,
      "movementType": "PRINT_RECEIVED",
      "quantity": 3000,
      "movementDate": "2024-03-15T10:30:00Z",
      "title": {
        "id": 1,
        "title": "The Opinionated Guide to TypeScript",
        "isbn": "9781234567890"
      },
      "warehouse": {
        "id": 1,
        "name": "UK Warehouse - London",
        "code": "UK-LON"
      },
      "printer": {
        "id": 1,
        "name": "Lightning Source UK"
      },
      "referenceNumber": "LS-2024-001",
      "notes": "Initial print run",
      "createdBy": 5,
      "creator": {
        "firstName": "John",
        "lastName": "Admin",
        "email": "john@example.com"
      },
      "createdAt": "2024-03-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 450,
    "totalPages": 23
  }
}
```

**Errors:**
- 401 Unauthorized
- 403 Forbidden - User doesn't have `movement:read` permission

---

### POST /api/stock-movements

**Purpose:** Record a new stock movement and automatically update inventory

**Request Body Examples:**

**Print Receipt:**
```json
{
  "movementType": "PRINT_RECEIVED",
  "titleId": 1,
  "warehouseId": 1,
  "quantity": 1000,
  "printerId": 1,
  "referenceNumber": "LS-2024-042",
  "notes": "Reprint order for Q2 demand"
}
```

**Warehouse Transfer:**
```json
{
  "movementType": "WAREHOUSE_TRANSFER",
  "titleId": 1,
  "sourceWarehouseId": 1,
  "destinationWarehouseId": 2,
  "quantity": 100,
  "referenceNumber": "TRANSFER-2024-015",
  "notes": "Restocking US warehouse for anticipated demand"
}
```

**Sales:**
```json
{
  "movementType": "UK_TRADE_SALES",
  "titleId": 1,
  "warehouseId": 1,
  "quantity": 350,
  "referenceNumber": "SALES-2024-MAR",
  "notes": "March trade sales to Waterstones"
}
```

**Validation Rules:**
- `movementType` (required, enum) - Must be valid MovementType
- `titleId` (required, number) - Must exist
- `quantity` (required, number, > 0) - Must be positive
- `warehouseId` (conditional) - Required for non-transfer movements
- `sourceWarehouseId` (conditional) - Required for WAREHOUSE_TRANSFER
- `destinationWarehouseId` (conditional) - Required for WAREHOUSE_TRANSFER
- `printerId` (optional, number) - For PRINT_RECEIVED movements
- `referenceNumber` (optional, string, max: 100 chars)
- `notes` (optional, string, max: 1000 chars)

**Business Logic:**
1. Validate movement type and required fields
2. For outbound movements (sales, damage, transfer source), verify sufficient stock
3. Calculate inventory impact:
   - Inbound (prints, reprints): `+quantity`
   - Outbound (sales, damage, returned): `-quantity`
   - Transfer: `-quantity` from source, `+quantity` to destination
4. Create StockMovement record
5. Update Inventory records atomically
6. Check low stock threshold and create alert if needed
7. Create audit log entry

**Response:** 201 Created
```json
{
  "movement": {
    "id": 46,
    "movementType": "PRINT_RECEIVED",
    "quantity": 1000,
    "titleId": 1,
    "warehouseId": 1,
    "movementDate": "2024-03-20T15:00:00Z",
    "referenceNumber": "LS-2024-042",
    "notes": "Reprint order for Q2 demand",
    "createdBy": 5,
    "createdAt": "2024-03-20T15:00:00Z"
  },
  "inventoryUpdates": [
    {
      "warehouseId": 1,
      "warehouseName": "UK Warehouse - London",
      "previousStock": 2400,
      "newStock": 3400,
      "delta": 1000
    }
  ],
  "lowStockAlert": null
}
```

**Response for Transfer:** 201 Created
```json
{
  "movement": {
    "id": 47,
    "movementType": "WAREHOUSE_TRANSFER",
    "quantity": 100,
    "titleId": 1,
    "warehouseId": 1,
    "sourceWarehouseId": 1,
    "destinationWarehouseId": 2,
    "movementDate": "2024-03-20T16:00:00Z",
    "referenceNumber": "TRANSFER-2024-015",
    "notes": "Restocking US warehouse",
    "createdBy": 5
  },
  "inventoryUpdates": [
    {
      "warehouseId": 1,
      "warehouseName": "UK Warehouse - London",
      "previousStock": 3400,
      "newStock": 3300,
      "delta": -100
    },
    {
      "warehouseId": 2,
      "warehouseName": "US Warehouse - New York",
      "previousStock": 450,
      "newStock": 550,
      "delta": 100
    }
  ],
  "lowStockAlert": {
    "warehouseId": 1,
    "warehouseName": "UK Warehouse - London",
    "currentStock": 3300,
    "threshold": 500,
    "belowThreshold": false
  }
}
```

**Errors:**
- 400 Bad Request - Validation error (invalid type, negative quantity, insufficient stock)
- 401 Unauthorized
- 403 Forbidden - User doesn't have `movement:create` permission
- 404 Not Found - Title, warehouse, or printer not found
- 409 Conflict - Concurrent modification detected
- 500 Internal Server Error - Database transaction failed

---

### GET /api/stock-movements/[id]

**Purpose:** Get detailed information about a specific stock movement

**Path Parameters:**
- `id` (number) - Movement ID

**Response:** 200 OK
```json
{
  "id": 46,
  "movementType": "PRINT_RECEIVED",
  "quantity": 1000,
  "movementDate": "2024-03-20T15:00:00Z",
  "title": {
    "id": 1,
    "title": "The Opinionated Guide to TypeScript",
    "isbn": "9781234567890"
  },
  "warehouse": {
    "id": 1,
    "name": "UK Warehouse - London",
    "code": "UK-LON"
  },
  "printer": {
    "id": 1,
    "name": "Lightning Source UK",
    "code": "LSUK"
  },
  "referenceNumber": "LS-2024-042",
  "notes": "Reprint order for Q2 demand",
  "rrpAtTime": 34.99,
  "unitCostAtTime": 8.75,
  "tradeDiscountAtTime": 45.0,
  "createdBy": 5,
  "creator": {
    "id": 5,
    "firstName": "John",
    "lastName": "Admin",
    "email": "john@example.com"
  },
  "createdAt": "2024-03-20T15:00:00Z",
  "updatedAt": "2024-03-20T15:00:00Z"
}
```

**Errors:**
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found - Movement doesn't exist

---

### PATCH /api/titles/[id]/threshold

**Purpose:** Update low stock threshold for a title (admin only)

**Path Parameters:**
- `id` (number) - Title ID

**Request Body:**
```json
{
  "lowStockThreshold": 600
}
```

**Validation Rules:**
- `lowStockThreshold` (required, number, >= 0, or null) - New threshold value

**Response:** 200 OK
```json
{
  "id": 1,
  "title": "The Opinionated Guide to TypeScript",
  "lowStockThreshold": 600,
  "previousThreshold": 500,
  "updatedAt": "2024-03-20T16:30:00Z"
}
```

**Errors:**
- 400 Bad Request - Invalid threshold value
- 401 Unauthorized
- 403 Forbidden - User doesn't have `title:update` permission
- 404 Not Found - Title doesn't exist

---

## Error Response Format

All errors follow this consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific validation error"
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Input validation failed
- `INSUFFICIENT_STOCK` - Not enough stock for outbound movement
- `CONCURRENT_MODIFICATION` - Resource modified by another user
- `DATABASE_ERROR` - Internal database error

## Rate Limiting

- Authenticated users: 100 requests/minute
- Stock movement creation: 30 requests/minute (prevent abuse)
- Inventory queries: No specific limit (cached responses)

## Caching Strategy

- Inventory list: 5-minute Redis cache (invalidate on movement creation)
- Individual title inventory: 2-minute cache
- Stock movements: No caching (always fresh data)
- Low stock alerts: 10-minute cache
