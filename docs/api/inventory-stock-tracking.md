# Inventory & Stock Tracking API Documentation

## Overview

This document describes the REST API endpoints for the Inventory and Stock Tracking system. All endpoints require authentication and proper authorization.

## Base URL

```
/api
```

## Authentication

All requests must include a valid authentication token. The system uses Clerk for authentication.

```
Authorization: Bearer <token>
```

## Endpoints

### Inventory Management

#### GET /api/inventory/dashboard

Returns inventory grouped by warehouse with current stock levels.

**Authorization Required:** `inventory:read`

**Query Parameters:**
- `warehouseId` (optional): Filter by specific warehouse ID

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "titleId": 123,
      "warehouseId": 456,
      "currentStock": 150,
      "reservedStock": 20,
      "availableStock": 130,
      "isLowStock": false,
      "lastMovementDate": "2025-01-15T10:30:00Z",
      "lastStockCheck": "2025-01-20T14:00:00Z",
      "title": {
        "id": 123,
        "isbn": "9781234567890",
        "title": "Example Book",
        "author": "John Doe",
        "lowStockThreshold": 50
      },
      "warehouse": {
        "id": 456,
        "name": "Main Warehouse",
        "code": "MAIN"
      }
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid warehouse ID
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

---

#### GET /api/inventory/low-stock

Returns titles below their configured low stock threshold with warehouse breakdown.

**Authorization Required:** `inventory:read`

**Query Parameters:**
- `warehouseId` (optional): Filter by specific warehouse ID

**Response:**
```json
{
  "data": [
    {
      "title": {
        "id": 123,
        "isbn": "9781234567890",
        "title": "Example Book",
        "author": "John Doe",
        "lowStockThreshold": 100
      },
      "totalStock": 45,
      "totalDeficit": 55,
      "warehouses": [
        {
          "warehouse": {
            "id": 456,
            "name": "Main Warehouse",
            "code": "MAIN"
          },
          "currentStock": 30,
          "reservedStock": 5,
          "availableStock": 25,
          "stockDeficit": 70
        },
        {
          "warehouse": {
            "id": 789,
            "name": "Secondary Warehouse",
            "code": "SEC"
          },
          "currentStock": 15,
          "reservedStock": 0,
          "availableStock": 15,
          "stockDeficit": 85
        }
      ]
    }
  ],
  "summary": {
    "totalTitlesLow": 1,
    "totalWarehousesAffected": 2
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid warehouse ID
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

---

### Stock Movements

#### POST /api/stock-movements

Creates a new stock movement and updates inventory accordingly.

**Authorization Required:** `inventory:update`

**Request Body:**
```json
{
  "titleId": 123,
  "warehouseId": 456,
  "movementType": "PRINT_RECEIVED",
  "quantity": 100,
  "referenceNumber": "PO-12345",
  "notes": "Initial print run",
  "sourceWarehouseId": null,
  "destinationWarehouseId": null
}
```

**Movement Types:**
- `PRINT_RECEIVED`: New stock from printer (positive quantity)
- `REPRINT`: Additional print run (positive quantity)
- `ONLINE_SALES`: Online sales (positive quantity, stored as negative)
- `UK_TRADE_SALES`: UK trade sales (positive quantity, stored as negative)
- `US_TRADE_SALES`: US trade sales (positive quantity, stored as negative)
- `ROW_TRADE_SALES`: Rest of world trade sales (positive quantity, stored as negative)
- `DIRECT_SALES`: Direct sales (positive quantity, stored as negative)
- `WAREHOUSE_TRANSFER`: Transfer between warehouses (requires sourceWarehouseId and destinationWarehouseId)
- `DAMAGED`: Damaged stock write-off (positive quantity, stored as negative)
- `PULPED`: Stock pulped/destroyed (positive quantity, stored as negative)
- `FREE_COPIES`: Free copies given away (positive quantity, stored as negative)
- `STOCK_ADJUSTMENT`: Manual stock adjustment (positive or negative quantity)

**Field Requirements:**
- `titleId`: Required, must exist
- `movementType`: Required
- `quantity`: Required, must be > 0 (except STOCK_ADJUSTMENT which can be negative)
- `warehouseId`: Required for all types except WAREHOUSE_TRANSFER
- `sourceWarehouseId`: Required for WAREHOUSE_TRANSFER
- `destinationWarehouseId`: Required for WAREHOUSE_TRANSFER
- `referenceNumber`: Optional (max 50 characters)
- `notes`: Optional for most types, Required for STOCK_ADJUSTMENT (min 10 characters)

**Response:**
```json
{
  "id": 789,
  "titleId": 123,
  "warehouseId": 456,
  "movementType": "PRINT_RECEIVED",
  "quantity": 100,
  "referenceNumber": "PO-12345",
  "notes": "Initial print run",
  "sourceWarehouseId": null,
  "destinationWarehouseId": null,
  "createdBy": "user_abc123",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error (invalid data, negative stock would result, etc.)
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Title or warehouse not found
- `500 Internal Server Error`: Server error

**Validation Rules:**
1. Quantity must be positive (except STOCK_ADJUSTMENT)
2. Cannot create negative stock (insufficient stock for outbound movements)
3. WAREHOUSE_TRANSFER requires both source and destination
4. Source and destination warehouses cannot be the same
5. STOCK_ADJUSTMENT requires notes with minimum 10 characters
6. Reserved stock is not checked (movements can proceed even with reservations)

---

#### GET /api/stock-movements

Returns paginated movement history with optional filters.

**Authorization Required:** `inventory:read`

**Query Parameters:**
- `titleId` (optional): Filter by title ID
- `warehouseId` (optional): Filter by warehouse ID
- `movementType` (optional): Filter by movement type
- `dateFrom` (optional): Filter movements from this date (ISO 8601)
- `dateTo` (optional): Filter movements until this date (ISO 8601)
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20, max: 100): Items per page

**Response:**
```json
{
  "data": [
    {
      "id": 789,
      "titleId": 123,
      "warehouseId": 456,
      "movementType": "PRINT_RECEIVED",
      "quantity": 100,
      "referenceNumber": "PO-12345",
      "notes": "Initial print run",
      "sourceWarehouseId": null,
      "destinationWarehouseId": null,
      "createdBy": "user_abc123",
      "createdAt": "2025-01-15T10:30:00Z",
      "title": {
        "id": 123,
        "title": "Example Book",
        "isbn": "9781234567890"
      },
      "warehouse": {
        "id": 456,
        "name": "Main Warehouse",
        "code": "MAIN"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

---

### Title Stock Threshold

#### PATCH /api/titles/:id/stock-threshold

Updates the low stock threshold for a specific title.

**Authorization Required:** `titles:update`

**URL Parameters:**
- `id`: Title ID

**Request Body:**
```json
{
  "lowStockThreshold": 50
}
```

**Field Requirements:**
- `lowStockThreshold`: Optional (null to disable alerts, positive integer to set threshold)

**Response:**
```json
{
  "id": 123,
  "isbn": "9781234567890",
  "title": "Example Book",
  "author": "John Doe",
  "lowStockThreshold": 50,
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid threshold value (must be null or positive integer)
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Title not found
- `500 Internal Server Error`: Server error

---

## Database Indexes

The following indexes have been created for optimal performance:

### Inventory Table
- `idx_inventory_title_warehouse` on `(titleId, warehouseId)` - Compound unique index for lookups
- `idx_inventory_title` on `(titleId)` - For title-based queries

### StockMovement Table
- `idx_stock_movement_inventory_date` on `(inventoryId, createdAt)` - For movement history queries
- `idx_stock_movement_title` on `(titleId)` - For title-based movement filtering
- `idx_stock_movement_warehouse` on `(warehouseId)` - For warehouse-based movement filtering
- `idx_stock_movement_type` on `(movementType)` - For movement type filtering
- `idx_stock_movement_created` on `(createdAt DESC)` - For chronological queries

### Performance Expectations
- Inventory dashboard with 1000+ titles across 10+ warehouses: < 500ms
- Low stock items query: < 200ms
- Movement history with filters: < 300ms
- Individual movement recording: < 100ms

---

## Authorization

### Required Permissions

- `inventory:read` - View inventory and stock movements
- `inventory:update` - Create stock movements
- `titles:update` - Update title stock thresholds

### Organization Isolation

All queries are automatically scoped to the authenticated user's organization. Users cannot:
- View inventory from other organizations
- Create movements for other organizations' inventory
- Access movement history from other organizations

---

## Audit Trail

All stock movements are immutable once created. The system maintains a complete audit trail including:

- User who created the movement (`createdBy`)
- Timestamp of creation (`createdAt`)
- All movement details (type, quantity, reference, notes)
- Source and destination for transfers

Movements cannot be edited or deleted to maintain data integrity.

---

## Common Use Cases

### 1. Receiving New Stock

```bash
POST /api/stock-movements
{
  "titleId": 123,
  "warehouseId": 456,
  "movementType": "PRINT_RECEIVED",
  "quantity": 1000,
  "referenceNumber": "PO-2025-001",
  "notes": "Initial print run of 1000 copies"
}
```

### 2. Recording a Sale

```bash
POST /api/stock-movements
{
  "titleId": 123,
  "warehouseId": 456,
  "movementType": "ONLINE_SALES",
  "quantity": 5,
  "referenceNumber": "ORD-12345"
}
```

### 3. Transferring Between Warehouses

```bash
POST /api/stock-movements
{
  "titleId": 123,
  "movementType": "WAREHOUSE_TRANSFER",
  "quantity": 100,
  "sourceWarehouseId": 456,
  "destinationWarehouseId": 789,
  "referenceNumber": "TRF-001",
  "notes": "Rebalancing stock for regional demand"
}
```

### 4. Stock Adjustment

```bash
POST /api/stock-movements
{
  "titleId": 123,
  "warehouseId": 456,
  "movementType": "STOCK_ADJUSTMENT",
  "quantity": -15,
  "notes": "Physical count discrepancy - 15 units unaccounted for during annual audit"
}
```

### 5. Setting Low Stock Threshold

```bash
PATCH /api/titles/123/stock-threshold
{
  "lowStockThreshold": 50
}
```

### 6. Viewing Low Stock Alerts

```bash
GET /api/inventory/low-stock
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `INSUFFICIENT_STOCK` | Not enough stock for requested operation |
| `NEGATIVE_STOCK_NOT_ALLOWED` | Operation would result in negative stock |
| `SAME_WAREHOUSE_TRANSFER` | Transfer source and destination are the same |
| `MISSING_TRANSFER_WAREHOUSES` | Transfer missing source or destination |
| `TITLE_NOT_FOUND` | Specified title does not exist |
| `WAREHOUSE_NOT_FOUND` | Specified warehouse does not exist |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `INTERNAL_ERROR` | Server error occurred |

---

## Rate Limiting

API requests are rate limited to:
- 100 requests per minute per user for read operations
- 30 requests per minute per user for write operations

Exceeding these limits will result in a `429 Too Many Requests` response.

---

## Changelog

### Version 1.0.0 (2025-01-15)
- Initial release of Inventory & Stock Tracking API
- Inventory dashboard endpoint
- Low stock alerts endpoint
- Stock movements CRUD endpoints
- Stock threshold management
- Audit trail support
