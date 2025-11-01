# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/multi-warehouse-setup/spec.md

## Base Configuration

- **Base Path:** `/api/warehouses`
- **Authentication:** All endpoints require Clerk authentication
- **Content Type:** `application/json`
- **Error Format:** Standard JSON error responses with `error` field and optional `details`

## Endpoints

### GET /api/warehouses

**Purpose:** Retrieve a paginated list of warehouses with optional filtering and search

**Authentication:** Required (Clerk JWT)

**Authorization:** `warehouse:read` permission

**Query Parameters:**
- `page` (optional, default: 1): Page number for pagination
- `limit` (optional, default: 20): Items per page
- `status` (optional): Filter by status ("ACTIVE", "INACTIVE", "MAINTENANCE")
- `type` (optional): Filter by type ("PHYSICAL", "VIRTUAL", "THIRD_PARTY")
- `search` (optional): Search term for name, code, city, or country
- `isActive` (optional): Filter by active status (true/false)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "clxyz123456",
      "name": "UK Warehouse - London",
      "code": "UK-LON",
      "type": "PHYSICAL",
      "status": "ACTIVE",
      "isActive": true,
      "addressLine1": "123 Publishing Street",
      "addressLine2": null,
      "city": "London",
      "stateProvince": null,
      "postalCode": "EC1A 1BB",
      "country": "GB",
      "contactName": null,
      "contactEmail": "uk-warehouse@bookstock.example",
      "contactPhone": "+44 20 7946 0958",
      "notes": null,
      "createdAt": "2025-10-31T10:00:00Z",
      "updatedAt": "2025-10-31T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks `warehouse:read` permission
- `500 Internal Server Error`: Database or server error

---

### POST /api/warehouses

**Purpose:** Create a new warehouse

**Authentication:** Required (Clerk JWT)

**Authorization:** `warehouse:create` permission (admin only)

**Request Body:**
```json
{
  "name": "UK Warehouse - London",
  "code": "UK-LON",
  "type": "PHYSICAL",
  "status": "ACTIVE",
  "addressLine1": "123 Publishing Street",
  "addressLine2": null,
  "city": "London",
  "stateProvince": null,
  "postalCode": "EC1A 1BB",
  "country": "GB",
  "contactName": null,
  "contactEmail": "uk-warehouse@bookstock.example",
  "contactPhone": "+44 20 7946 0958",
  "notes": null
}
```

**Response (201 Created):**
```json
{
  "id": "clxyz123456",
  "name": "UK Warehouse - London",
  "code": "UK-LON",
  "type": "PHYSICAL",
  "status": "ACTIVE",
  "isActive": true,
  "addressLine1": "123 Publishing Street",
  "addressLine2": null,
  "city": "London",
  "stateProvince": null,
  "postalCode": "EC1A 1BB",
  "country": "GB",
  "contactName": null,
  "contactEmail": "uk-warehouse@bookstock.example",
  "contactPhone": "+44 20 7946 0958",
  "notes": null,
  "createdAt": "2025-10-31T10:00:00Z",
  "updatedAt": "2025-10-31T10:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Validation errors (invalid format, missing required fields)
  ```json
  {
    "error": "Validation failed",
    "details": [
      {
        "field": "code",
        "message": "Code must be 2-20 uppercase alphanumeric characters with hyphens"
      }
    ]
  }
  ```
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks `warehouse:create` permission
- `409 Conflict`: Warehouse with this code already exists
  ```json
  {
    "error": "Warehouse with code 'UK-LON' already exists"
  }
  ```
- `500 Internal Server Error`: Database or server error

---

### GET /api/warehouses/[id]

**Purpose:** Retrieve a single warehouse by ID

**Authentication:** Required (Clerk JWT)

**Authorization:** `warehouse:read` permission

**Path Parameters:**
- `id` (required): Warehouse ID (CUID)

**Response (200 OK):**
```json
{
  "id": "clxyz123456",
  "name": "UK Warehouse - London",
  "code": "UK-LON",
  "type": "PHYSICAL",
  "status": "ACTIVE",
  "isActive": true,
  "addressLine1": "123 Publishing Street",
  "addressLine2": null,
  "city": "London",
  "stateProvince": null,
  "postalCode": "EC1A 1BB",
  "country": "GB",
  "contactName": null,
  "contactEmail": "uk-warehouse@bookstock.example",
  "contactPhone": "+44 20 7946 0958",
  "notes": null,
  "createdAt": "2025-10-31T10:00:00Z",
  "updatedAt": "2025-10-31T10:00:00Z"
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks `warehouse:read` permission
- `404 Not Found`: Warehouse with this ID does not exist
- `500 Internal Server Error`: Database or server error

---

### PUT /api/warehouses/[id]

**Purpose:** Update an existing warehouse

**Authentication:** Required (Clerk JWT)

**Authorization:** `warehouse:update` permission (admin only)

**Path Parameters:**
- `id` (required): Warehouse ID (CUID)

**Request Body:** (all fields optional, partial update)
```json
{
  "name": "UK Warehouse - London (Updated)",
  "status": "MAINTENANCE",
  "notes": "Undergoing inventory audit"
}
```

**Response (200 OK):**
```json
{
  "id": "clxyz123456",
  "name": "UK Warehouse - London (Updated)",
  "code": "UK-LON",
  "type": "PHYSICAL",
  "status": "MAINTENANCE",
  "isActive": false,
  "addressLine1": "123 Publishing Street",
  "addressLine2": null,
  "city": "London",
  "stateProvince": null,
  "postalCode": "EC1A 1BB",
  "country": "GB",
  "contactName": null,
  "contactEmail": "uk-warehouse@bookstock.example",
  "contactPhone": "+44 20 7946 0958",
  "notes": "Undergoing inventory audit",
  "createdAt": "2025-10-31T10:00:00Z",
  "updatedAt": "2025-10-31T11:30:00Z"
}
```

**Errors:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks `warehouse:update` permission
- `404 Not Found`: Warehouse with this ID does not exist
- `409 Conflict`: Code already exists (if trying to change code to existing one)
- `500 Internal Server Error`: Database or server error

---

### DELETE /api/warehouses/[id]

**Purpose:** Delete a warehouse (soft delete or hard delete based on dependencies)

**Authentication:** Required (Clerk JWT)

**Authorization:** `warehouse:delete` permission (admin only)

**Path Parameters:**
- `id` (required): Warehouse ID (CUID)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Warehouse deleted successfully"
}
```

**Errors:**
- `400 Bad Request`: Cannot delete warehouse with active inventory
  ```json
  {
    "error": "Cannot delete warehouse with existing inventory. Please transfer or remove inventory first."
  }
  ```
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks `warehouse:delete` permission
- `404 Not Found`: Warehouse with this ID does not exist
- `500 Internal Server Error`: Database or server error

**Note:** In Phase 1, deletion will check if warehouse has inventory relationships (future feature). If no inventory exists, perform hard delete. If inventory exists, return 400 error.

---

### PATCH /api/warehouses/[id]/activate

**Purpose:** Activate a warehouse (set status to ACTIVE)

**Authentication:** Required (Clerk JWT)

**Authorization:** `warehouse:update` permission (admin only)

**Path Parameters:**
- `id` (required): Warehouse ID (CUID)

**Response (200 OK):**
```json
{
  "id": "clxyz123456",
  "name": "UK Warehouse - London",
  "status": "ACTIVE",
  "isActive": true,
  "updatedAt": "2025-10-31T12:00:00Z"
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks `warehouse:update` permission
- `404 Not Found`: Warehouse with this ID does not exist
- `500 Internal Server Error`: Database or server error

---

### PATCH /api/warehouses/[id]/deactivate

**Purpose:** Deactivate a warehouse (set status to INACTIVE)

**Authentication:** Required (Clerk JWT)

**Authorization:** `warehouse:update` permission (admin only)

**Path Parameters:**
- `id` (required): Warehouse ID (CUID)

**Response (200 OK):**
```json
{
  "id": "clxyz123456",
  "name": "UK Warehouse - London",
  "status": "INACTIVE",
  "isActive": false,
  "updatedAt": "2025-10-31T12:00:00Z"
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User lacks `warehouse:update` permission
- `404 Not Found`: Warehouse with this ID does not exist
- `500 Internal Server Error`: Database or server error

---

## Error Response Format

All error responses follow this structure:

```json
{
  "error": "Human-readable error message",
  "details": [] // Optional, array of detailed errors (for validation)
}
```

## Authentication & Authorization

### Authentication Flow
1. Client sends request with Clerk JWT in `Authorization: Bearer <token>` header
2. API middleware validates token with Clerk
3. If invalid, return 401 Unauthorized
4. If valid, extract user information and proceed to authorization

### Authorization Flow
1. After authentication, extract user permissions from database
2. Check if user has required permission for endpoint
3. If missing permission, return 403 Forbidden
4. If has permission, proceed to business logic

### Permission Matrix

| Endpoint | Required Permission | Typical Roles |
|----------|-------------------|---------------|
| GET /api/warehouses | `warehouse:read` | All authenticated users |
| GET /api/warehouses/[id] | `warehouse:read` | All authenticated users |
| POST /api/warehouses | `warehouse:create` | Admin, Operations Manager |
| PUT /api/warehouses/[id] | `warehouse:update` | Admin, Operations Manager |
| DELETE /api/warehouses/[id] | `warehouse:delete` | Admin only |
| PATCH /api/warehouses/[id]/activate | `warehouse:update` | Admin, Operations Manager |
| PATCH /api/warehouses/[id]/deactivate | `warehouse:update` | Admin, Operations Manager |

## Middleware Stack

Each endpoint applies middleware in this order:

1. **CORS Middleware** - Handle cross-origin requests (Next.js default)
2. **Authentication Middleware** - Verify Clerk JWT token
3. **Authorization Middleware** - Check user permissions
4. **Audit Logging Middleware** - Log mutations (POST, PUT, DELETE, PATCH)
5. **Route Handler** - Business logic execution
6. **Error Handler** - Catch and format errors

## Validation Rules

### Code Field
- Pattern: `^[A-Z0-9-]{2,20}$`
- Auto-uppercase transformation
- Must be unique across all warehouses

### Name Field
- Required
- Length: 1-100 characters
- No special validation

### Email Field
- Optional
- Must be valid email format
- Max length: 255 characters

### Country Field
- Optional
- Must be 2-character ISO 3166-1 alpha-2 code
- Auto-uppercase transformation
- Examples: GB, US, CA, AU

### Status Field
- Must be one of: ACTIVE, INACTIVE, MAINTENANCE
- Default: ACTIVE

### Type Field
- Must be one of: PHYSICAL, VIRTUAL, THIRD_PARTY
- Default: PHYSICAL

## Performance Targets

- **List Endpoint:** < 200ms response time
- **Single Item Endpoints:** < 100ms response time
- **Create/Update Endpoints:** < 300ms response time
- **Pagination:** Support up to 100 items per page (default 20)

## Future Enhancements

Future API versions may include:

1. **Bulk Operations:**
   - POST /api/warehouses/bulk - Create multiple warehouses
   - PUT /api/warehouses/bulk - Update multiple warehouses

2. **Inventory Integration:**
   - GET /api/warehouses/[id]/inventory - Get inventory for warehouse
   - GET /api/warehouses/[id]/stock-levels - Get stock levels summary

3. **Analytics:**
   - GET /api/warehouses/[id]/stats - Warehouse statistics
   - GET /api/warehouses/[id]/activity - Recent activity log

4. **Transfer Support:**
   - GET /api/warehouses/[id]/transfers - Stock transfers for warehouse
   - POST /api/warehouses/[id]/transfers - Create transfer from/to warehouse
