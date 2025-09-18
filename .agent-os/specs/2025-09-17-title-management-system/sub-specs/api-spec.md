# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-17-title-management-system/spec.md

> Created: 2025-09-17
> Version: 1.0.0

## Endpoints

### Series Management

#### GET /api/series
**Purpose:** List all series with pagination support
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 10, max: 100)
- `search` (query, optional): Search term for series name

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "titleCount": "number",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

#### POST /api/series
**Purpose:** Create a new series
**Method:** POST
**Authentication:** Required (session-based)
**Request Body:**
```json
{
  "name": "string (required, 1-255 chars)",
  "description": "string (optional, max 1000 chars)"
}
```
**Response Format:**
```json
{
  "data": {
    "id": "string",
    "name": "string",
    "description": "string",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```
**Status Codes:** 201 (Created), 400 (Validation Error), 401 (Unauthorized), 409 (Duplicate Name), 500 (Server Error)

#### GET /api/series/[id]
**Purpose:** Get specific series with associated titles
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `id` (path, required): Series UUID
- `includeTitles` (query, optional): Include titles in response (default: false)

**Response Format:**
```json
{
  "data": {
    "id": "string",
    "name": "string",
    "description": "string",
    "titleCount": "number",
    "titles": [
      {
        "id": "string",
        "title": "string",
        "isbn": "string",
        "publicationYear": "number"
      }
    ],
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)

#### PUT /api/series/[id]
**Purpose:** Update existing series
**Method:** PUT
**Authentication:** Required (session-based)
**Parameters:**
- `id` (path, required): Series UUID
**Request Body:**
```json
{
  "name": "string (optional, 1-255 chars)",
  "description": "string (optional, max 1000 chars)"
}
```
**Response Format:** Same as GET /api/series/[id]
**Status Codes:** 200 (Success), 400 (Validation Error), 401 (Unauthorized), 404 (Not Found), 409 (Duplicate Name), 500 (Server Error)

#### DELETE /api/series/[id]
**Purpose:** Delete series (with validation for associated titles)
**Method:** DELETE
**Authentication:** Required (session-based)
**Parameters:**
- `id` (path, required): Series UUID
- `force` (query, optional): Force delete even with associated titles (default: false)

**Response Format:**
```json
{
  "message": "Series deleted successfully"
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 404 (Not Found), 409 (Has Associated Titles), 500 (Server Error)

### Title Management

#### GET /api/titles
**Purpose:** List titles with filtering, search, and pagination
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 10, max: 100)
- `search` (query, optional): Search term for title or author
- `seriesId` (query, optional): Filter by series UUID
- `publicationYear` (query, optional): Filter by publication year
- `sortBy` (query, optional): Sort field (title, publicationYear, createdAt)
- `sortOrder` (query, optional): Sort direction (asc, desc)

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "title": "string",
      "subtitle": "string",
      "author": "string",
      "isbn": "string",
      "publicationYear": "number",
      "publisher": "string",
      "series": {
        "id": "string",
        "name": "string"
      },
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

#### POST /api/titles
**Purpose:** Create new title with ISBN validation
**Method:** POST
**Authentication:** Required (session-based)
**Request Body:**
```json
{
  "title": "string (required, 1-500 chars)",
  "subtitle": "string (optional, max 500 chars)",
  "author": "string (required, 1-255 chars)",
  "isbn": "string (required, valid ISBN-10 or ISBN-13)",
  "publicationYear": "number (required, 1000-current year)",
  "publisher": "string (optional, max 255 chars)",
  "seriesId": "string (optional, valid series UUID)",
  "description": "string (optional, max 2000 chars)"
}
```
**Response Format:**
```json
{
  "data": {
    "id": "string",
    "title": "string",
    "subtitle": "string",
    "author": "string",
    "isbn": "string",
    "publicationYear": "number",
    "publisher": "string",
    "seriesId": "string",
    "description": "string",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```
**Status Codes:** 201 (Created), 400 (Validation Error), 401 (Unauthorized), 409 (Duplicate ISBN), 500 (Server Error)

#### GET /api/titles/[id]
**Purpose:** Get specific title details
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `id` (path, required): Title UUID

**Response Format:**
```json
{
  "data": {
    "id": "string",
    "title": "string",
    "subtitle": "string",
    "author": "string",
    "isbn": "string",
    "publicationYear": "number",
    "publisher": "string",
    "description": "string",
    "series": {
      "id": "string",
      "name": "string",
      "description": "string"
    },
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)

#### PUT /api/titles/[id]
**Purpose:** Update existing title
**Method:** PUT
**Authentication:** Required (session-based)
**Parameters:**
- `id` (path, required): Title UUID
**Request Body:** Same format as POST /api/titles (all fields optional)
**Response Format:** Same as GET /api/titles/[id]
**Status Codes:** 200 (Success), 400 (Validation Error), 401 (Unauthorized), 404 (Not Found), 409 (Duplicate ISBN), 500 (Server Error)

#### DELETE /api/titles/[id]
**Purpose:** Delete title
**Method:** DELETE
**Authentication:** Required (session-based)
**Parameters:**
- `id` (path, required): Title UUID

**Response Format:**
```json
{
  "message": "Title deleted successfully"
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)

#### POST /api/titles/bulk-import
**Purpose:** Handle CSV/spreadsheet upload for bulk title import
**Method:** POST
**Authentication:** Required (session-based)
**Content-Type:** multipart/form-data
**Request Body:**
- `file` (required): CSV file with headers: title, subtitle, author, isbn, publicationYear, publisher, seriesName, description
- `validateOnly` (optional): Boolean to only validate without importing

**Response Format:**
```json
{
  "data": {
    "processed": "number",
    "successful": "number",
    "failed": "number",
    "errors": [
      {
        "row": "number",
        "field": "string",
        "message": "string",
        "value": "string"
      }
    ],
    "results": [
      {
        "row": "number",
        "status": "success|error",
        "titleId": "string",
        "message": "string"
      }
    ]
  }
}
```
**Status Codes:** 200 (Success), 400 (Invalid File/Format), 401 (Unauthorized), 413 (File Too Large), 500 (Server Error)

### Utility Endpoints

#### POST /api/titles/validate-isbn
**Purpose:** Validate ISBN format and check availability
**Method:** POST
**Authentication:** Required (session-based)
**Request Body:**
```json
{
  "isbn": "string (required)",
  "excludeId": "string (optional, UUID to exclude from duplicate check)"
}
```
**Response Format:**
```json
{
  "data": {
    "isValid": "boolean",
    "isAvailable": "boolean",
    "formattedIsbn": "string",
    "type": "ISBN-10|ISBN-13",
    "existingTitle": {
      "id": "string",
      "title": "string",
      "author": "string"
    }
  }
}
```
**Status Codes:** 200 (Success), 400 (Invalid Request), 401 (Unauthorized), 500 (Server Error)

#### GET /api/titles/check-duplicate/[isbn]
**Purpose:** Check for duplicate ISBN in the system
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `isbn` (path, required): ISBN to check
- `excludeId` (query, optional): Title UUID to exclude from check

**Response Format:**
```json
{
  "data": {
    "isDuplicate": "boolean",
    "existingTitle": {
      "id": "string",
      "title": "string",
      "author": "string",
      "isbn": "string"
    }
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

### Warehouse Management

#### GET /api/warehouses
**Purpose:** List all active warehouses
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:** None

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "code": "string",
      "location": "string",
      "fulfillsChannels": ["string"],
      "isActive": "boolean",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

### Inventory Management

#### GET /api/inventory
**Purpose:** Get inventory levels with filtering options
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `titleId` (query, optional): Filter by specific title
- `warehouseId` (query, optional): Filter by specific warehouse
- `lowStock` (query, optional): Filter items below threshold
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 50, max: 100)

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "title": {
        "id": "string",
        "title": "string",
        "isbn": "string",
        "author": "string"
      },
      "warehouse": {
        "id": "string",
        "name": "string",
        "code": "string"
      },
      "currentStock": "number",
      "reservedStock": "number",
      "availableStock": "number",
      "lastMovementDate": "ISO8601",
      "monthsOfStockRemaining": "number"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

#### GET /api/inventory/title/[titleId]
**Purpose:** Get inventory levels for specific title across all warehouses
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `titleId` (path, required): Title UUID

**Response Format:**
```json
{
  "data": {
    "title": {
      "id": "string",
      "title": "string",
      "isbn": "string",
      "author": "string"
    },
    "totalStock": "number",
    "warehouseStock": [
      {
        "warehouse": {
          "id": "string",
          "name": "string",
          "code": "string"
        },
        "currentStock": "number",
        "reservedStock": "number",
        "availableStock": "number",
        "monthsOfStockRemaining": "number"
      }
    ]
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)

### Stock Movement Management

#### GET /api/stock-movements
**Purpose:** List stock movements with filtering and pagination
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `titleId` (query, optional): Filter by title
- `warehouseId` (query, optional): Filter by warehouse
- `movementType` (query, optional): Filter by movement type
- `dateFrom` (query, optional): Start date filter (ISO8601)
- `dateTo` (query, optional): End date filter (ISO8601)
- `page` (query, optional): Page number (default: 1)
- `limit` (query, optional): Items per page (default: 50, max: 100)

**Response Format:**
```json
{
  "data": [
    {
      "id": "string",
      "title": {
        "id": "string",
        "title": "string",
        "isbn": "string"
      },
      "warehouse": {
        "id": "string",
        "name": "string",
        "code": "string"
      },
      "movementType": "string",
      "quantity": "number",
      "movementDate": "ISO8601",
      "sourceWarehouse": {
        "id": "string",
        "name": "string"
      },
      "destinationWarehouse": {
        "id": "string",
        "name": "string"
      },
      "printerName": "string",
      "referenceNumber": "string",
      "notes": "string",
      "createdAt": "ISO8601"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

#### POST /api/stock-movements
**Purpose:** Create new stock movement
**Method:** POST
**Authentication:** Required (session-based)
**Request Body:**
```json
{
  "titleId": "string (required)",
  "warehouseId": "string (required)",
  "movementType": "string (required, enum value)",
  "quantity": "number (required, positive for inbound, negative for outbound)",
  "movementDate": "ISO8601 (required)",
  "sourceWarehouseId": "string (optional, for transfers)",
  "destinationWarehouseId": "string (optional, for transfers)",
  "printerName": "string (optional, for PRINT_RECEIVED)",
  "referenceNumber": "string (optional)",
  "notes": "string (optional)"
}
```
**Response Format:**
```json
{
  "data": {
    "id": "string",
    "titleId": "string",
    "warehouseId": "string",
    "movementType": "string",
    "quantity": "number",
    "movementDate": "ISO8601",
    "sourceWarehouseId": "string",
    "destinationWarehouseId": "string",
    "printerName": "string",
    "referenceNumber": "string",
    "notes": "string",
    "createdAt": "ISO8601"
  }
}
```
**Status Codes:** 201 (Created), 400 (Validation Error), 401 (Unauthorized), 500 (Server Error)

#### POST /api/stock-movements/bulk-import
**Purpose:** Handle monthly warehouse data import
**Method:** POST
**Authentication:** Required (session-based)
**Content-Type:** multipart/form-data
**Request Body:**
- `file` (required): CSV file with warehouse movement data
- `warehouseId` (required): Warehouse UUID for the data source
- `movementMonth` (required): YYYY-MM format for the data period
- `validateOnly` (optional): Boolean to only validate without importing

**Response Format:**
```json
{
  "data": {
    "processed": "number",
    "successful": "number",
    "failed": "number",
    "warehouseUpdated": "string",
    "movementMonth": "string",
    "errors": [
      {
        "row": "number",
        "field": "string",
        "message": "string",
        "value": "string"
      }
    ],
    "summary": {
      "totalMovements": "number",
      "inboundMovements": "number",
      "outboundMovements": "number",
      "salesByChannel": {
        "ONLINE_SALES": "number",
        "UK_TRADE_SALES": "number",
        "US_TRADE_SALES": "number",
        "ROW_TRADE_SALES": "number",
        "DIRECT_SALES": "number"
      }
    }
  }
}
```
**Status Codes:** 200 (Success), 400 (Invalid File/Format), 401 (Unauthorized), 413 (File Too Large), 500 (Server Error)

### Analytics & Reporting

#### GET /api/analytics/stock-alerts
**Purpose:** Get titles with low stock requiring attention
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `threshold` (query, optional): Months of stock threshold (default: 3)
- `warehouseId` (query, optional): Filter by specific warehouse

**Response Format:**
```json
{
  "data": [
    {
      "title": {
        "id": "string",
        "title": "string",
        "isbn": "string",
        "author": "string"
      },
      "warehouse": {
        "id": "string",
        "name": "string",
        "code": "string"
      },
      "currentStock": "number",
      "monthsRemaining": "number",
      "averageMonthlySales": "number",
      "recommendedReprint": "number",
      "lastMovementDate": "ISO8601"
    }
  ]
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

#### GET /api/analytics/sales-velocity
**Purpose:** Get sales velocity analysis by title and warehouse
**Method:** GET
**Authentication:** Required (session-based)
**Parameters:**
- `titleId` (query, optional): Filter by specific title
- `warehouseId` (query, optional): Filter by specific warehouse
- `period` (query, optional): Analysis period (3m, 6m, 12m, default: 12m)

**Response Format:**
```json
{
  "data": [
    {
      "title": {
        "id": "string",
        "title": "string",
        "isbn": "string"
      },
      "warehouse": {
        "id": "string",
        "name": "string"
      },
      "salesVelocity": {
        "averageMonthly": "number",
        "last3Months": "number",
        "last6Months": "number",
        "last12Months": "number",
        "totalLifetime": "number"
      },
      "profitAnalysis": {
        "profitMargin": "number",
        "totalProfit": "number",
        "profitPerUnit": "number"
      }
    }
  ]
}
```
**Status Codes:** 200 (Success), 401 (Unauthorized), 500 (Server Error)

## Controllers

### Series Controller Business Logic

**Data Validation:**
- Series name: Required, 1-255 characters, unique within system
- Description: Optional, maximum 1000 characters
- Input sanitization for XSS prevention

**Prisma ORM Integration:**
- Use Prisma Client for all database operations
- Implement proper transaction handling for related operations
- Utilize Prisma's built-in validation and type safety

**Error Handling Patterns:**
- Validation errors return 400 with detailed field-level messages
- Duplicate name conflicts return 409 with specific error message
- Database connection errors return 500 with generic message
- Not found errors return 404 with resource-specific message

**Business Rules:**
- Series deletion requires force parameter if titles are associated
- Series name uniqueness validation before create/update operations
- Cascade handling for series deletion with associated titles

### Title Controller Business Logic

**Data Validation:**
- Title: Required, 1-500 characters
- Author: Required, 1-255 characters
- ISBN: Required, valid ISBN-10 or ISBN-13 format with checksum validation
- Publication Year: Required, between 1000 and current year
- Series association: Validate series exists if seriesId provided
- Input sanitization for all text fields

**ISBN Processing:**
- Strip hyphens and spaces for storage
- Validate checksum using appropriate algorithm
- Check for duplicates across entire system
- Support both ISBN-10 and ISBN-13 formats

**Prisma ORM Integration:**
- Use Prisma transactions for complex operations
- Implement proper foreign key constraint handling
- Utilize Prisma's relationship loading for series data
- Implement proper indexing strategy for search performance

**Error Handling Patterns:**
- ISBN validation errors with specific format requirements
- Duplicate ISBN conflicts with existing title information
- Series association errors when invalid seriesId provided
- File upload errors with detailed validation messages for bulk import

**Bulk Import Business Logic:**
- CSV parsing with proper error handling for malformed data
- Row-by-row validation with detailed error reporting
- Transaction handling to ensure data consistency
- Support for series creation during import if series name provided but doesn't exist
- Progress tracking and partial success handling

**Search and Filtering:**
- Full-text search across title, subtitle, and author fields
- Efficient pagination using cursor-based approach for large datasets
- Proper SQL injection prevention for dynamic queries
- Case-insensitive search with accent-insensitive matching

### Inventory Controller Business Logic

**Real-time Stock Calculations:**
- Automatic calculation of available stock (current - reserved)
- Dynamic months of stock remaining based on sales velocity
- Cross-warehouse inventory aggregation for title-level views
- Stock level threshold alerts with configurable parameters

**Data Validation:**
- Stock quantity validation (non-negative integers)
- Warehouse assignment validation against active warehouses
- Title existence validation before inventory operations
- Reserved stock cannot exceed current stock

**Performance Optimization:**
- Indexed queries for warehouse and title filtering
- Efficient joins across inventory, titles, and warehouses tables
- Cached calculations for frequently accessed stock levels
- Bulk query optimization for dashboard views

### Stock Movement Controller Business Logic

**Movement Validation:**
- Movement type validation against enum values
- Quantity validation (positive for inbound, negative for outbound)
- Date validation (not future dates for historical imports)
- Warehouse channel validation (movement type matches warehouse capabilities)
- Source/destination warehouse validation for transfers

**Automated Inventory Updates:**
- Real-time inventory level adjustments on movement creation
- Transaction handling to ensure data consistency
- Automatic calculation of running totals
- Inventory reconciliation for bulk imports

**Movement Type Business Rules:**
- **PRINT_RECEIVED**: Requires printer name, updates UK warehouse (Turnaround)
- **WAREHOUSE_TRANSFER**: Requires source and destination warehouses
- **Sales movements**: Must match warehouse fulfillment channels
  - ONLINE_SALES only via Flostream
  - UK_TRADE_SALES and ROW_TRADE_SALES only via Turnaround
  - US_TRADE_SALES only via ACC
- **PULPED/DAMAGED**: Negative quantities, updates current stock

**Bulk Import Processing:**
- CSV parsing with row-by-row validation
- Movement type auto-detection based on data patterns
- Warehouse-specific import templates
- Error handling with detailed feedback for invalid records
- Transaction rollback on validation failures
- Progress tracking for large datasets

**Analytics Calculations:**
- Sales velocity computation over configurable periods
- Profit margin calculations using RRP and unit cost
- Stock turnover analysis by warehouse and sales channel
- Automated reprint recommendations based on velocity and thresholds

**Audit Trail Management:**
- Complete transaction history preservation
- Movement source tracking (manual entry vs. bulk import)
- Reference number correlation with external systems
- User action logging for compliance requirements