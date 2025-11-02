# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/series-management/spec.md

## Base URL

All endpoints are relative to `/api`

## Authentication

All requests require authentication via Clerk JWT token in Authorization header.

## Endpoints

### GET /api/series

List all series for the authenticated user's organization.

**Authorization Required:** `series:read`

**Query Parameters:**
- `status` (optional): Filter by status (ACTIVE | ARCHIVED | ALL), default: ACTIVE
- `search` (optional): Search by series name (case-insensitive partial match)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Opinionated Guides",
      "description": "A series of concise, opinionated technical guides",
      "status": "ACTIVE",
      "titleCount": 15,
      "totalStock": 2500,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-20T14:30:00Z"
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

---

### POST /api/series

Create a new series.

**Authorization Required:** `series:create`

**Request Body:**
```json
{
  "name": "History Series",
  "description": "Comprehensive historical narratives",
  "status": "ACTIVE"
}
```

**Validation:**
- `name`: Required, 1-100 characters, unique within organization
- `description`: Optional, max 1000 characters
- `status`: Optional, must be ACTIVE or ARCHIVED (default: ACTIVE)

**Response:** (201 Created)
```json
{
  "id": 2,
  "name": "History Series",
  "description": "Comprehensive historical narratives",
  "status": "ACTIVE",
  "organizationId": "org_abc123",
  "createdAt": "2025-11-02T10:00:00Z",
  "updatedAt": "2025-11-02T10:00:00Z",
  "createdBy": "user_xyz789"
}
```

**Errors:**
- `400 Bad Request`: Validation error (duplicate name, invalid status)
- `401 Unauthorized`: Missing authentication
- `403 Forbidden`: Insufficient permissions

---

### GET /api/series/:id

Get series details with member titles.

**Authorization Required:** `series:read`

**Response:**
```json
{
  "id": 1,
  "name": "Opinionated Guides",
  "description": "A series of concise, opinionated technical guides",
  "status": "ACTIVE",
  "organizationId": "org_abc123",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-20T14:30:00Z",
  "titles": [
    {
      "id": 123,
      "isbn": "9781234567890",
      "title": "The Opinionated Guide to JavaScript",
      "author": "Jane Doe",
      "currentStock": 150,
      "rrp": 29.99
    }
  ],
  "metrics": {
    "titleCount": 15,
    "totalStock": 2500,
    "totalSales12Month": 3200,
    "totalRevenueYTD": 48000,
    "totalProfitLifetime": 125000
  }
}
```

**Errors:**
- `404 Not Found`: Series doesn't exist or belongs to different organization

---

### PATCH /api/series/:id

Update series details.

**Authorization Required:** `series:update`

**Request Body:**
```json
{
  "name": "Updated Series Name",
  "description": "Updated description",
  "status": "ARCHIVED"
}
```

**Validation:** Same as POST /api/series

**Response:** (200 OK) - Returns updated series object

**Errors:**
- `400 Bad Request`: Validation error
- `404 Not Found`: Series doesn't exist

---

### DELETE /api/series/:id

Archive a series (soft delete).

**Authorization Required:** `series:delete`

**Response:** (200 OK)
```json
{
  "message": "Series archived successfully",
  "id": 1
}
```

**Note:** This sets status to ARCHIVED and keeps all data intact. Member titles' seriesId remains set.

---

### GET /api/series/:id/metrics

Get aggregated metrics for a series.

**Authorization Required:** `series:read`

**Response:**
```json
{
  "seriesId": 1,
  "titleCount": 15,
  "totalCurrentStock": 2500,
  "totalReservedStock": 150,
  "totalAvailableStock": 2350,
  "salesMetrics": {
    "month": 250,
    "twelveMonth": 3200,
    "yearToDate": 2800,
    "lifetime": 15000
  },
  "revenueMetrics": {
    "month": 7500,
    "twelveMonth": 96000,
    "yearToDate": 84000,
    "lifetime": 450000
  },
  "profitMetrics": {
    "month": 3750,
    "twelveMonth": 48000,
    "yearToDate": 42000,
    "lifetime": 225000
  },
  "lowStockTitles": 3
}
```

---

### PATCH /api/series/:id/bulk-update

Update specified fields across all titles in the series.

**Authorization Required:** `series:update`

**Request Body:**
```json
{
  "updates": {
    "rrp": 34.99,
    "lowStockThreshold": 100
  }
}
```

**Allowed Fields:**
- `rrp`: Positive decimal
- `lowStockThreshold`: Positive integer or null
- `unitCost`: Positive decimal

**Response:** (200 OK)
```json
{
  "message": "Bulk update completed",
  "seriesId": 1,
  "titlesUpdated": 15,
  "updates": {
    "rrp": 34.99,
    "lowStockThreshold": 100
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid field values or unsupported fields
- `404 Not Found`: Series doesn't exist
- `500 Internal Server Error`: Transaction failed (no partial updates)

---

### PATCH /api/titles/:id (Extended)

Existing endpoint extended to support series assignment.

**New Field:**
- `seriesId`: Integer (optional, null to remove from series)

**Request Body Example:**
```json
{
  "seriesId": 1
}
```

**Validation:**
- Series must exist and belong to same organization
- Can be set to null to remove title from series

**Response:** Standard title response including series data if assigned

---

## Error Codes

| Code | Description |
|------|-------------|
| `SERIES_NAME_DUPLICATE` | Series name already exists in organization |
| `SERIES_NOT_FOUND` | Series doesn't exist or wrong organization |
| `INVALID_STATUS` | Status must be ACTIVE or ARCHIVED |
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `BULK_UPDATE_FAILED` | Transaction failed during bulk update |

---

## Organization Isolation

All endpoints automatically filter by `organizationId` from authenticated user's Clerk session. Users cannot:
- View series from other organizations
- Create series in other organizations
- Update or delete series from other organizations
- Assign titles to series from other organizations
