# Title Management API Documentation

## Overview

This document describes the RESTful API endpoints for the Title Management system. These endpoints allow you to programmatically create, read, update, delete, and search titles.

## Base URL

```
https://your-domain.com/api
```

## Authentication

All API endpoints require authentication using session-based auth or API tokens.

**Headers Required:**
```
Authorization: Bearer <your-token>
Content-Type: application/json
```

## Rate Limiting

- **Rate Limit**: 100 requests per minute per user
- **Bulk Operations**: 10 requests per minute
- **Export Operations**: 5 requests per minute

---

## Table of Contents

1. [List Titles](#list-titles)
2. [Get Title by ID](#get-title-by-id)
3. [Create Title](#create-title)
4. [Update Title](#update-title)
5. [Delete Title](#delete-title)
6. [Bulk Import](#bulk-import)
7. [Bulk Price Update](#bulk-price-update)
8. [Export Titles](#export-titles)
9. [Get Price History](#get-price-history)
10. [Error Responses](#error-responses)

---

## List Titles

Retrieve a paginated list of titles with optional search and filtering.

### Endpoint

```
GET /api/titles
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `search` | string | No | Search in title, author, ISBN |
| `format` | enum | No | Filter by format (PAPERBACK, HARDCOVER, EBOOK, AUDIOBOOK) |
| `category` | string | No | Filter by category |
| `publisher` | string | No | Filter by publisher |
| `seriesId` | integer | No | Filter by series ID |
| `sortBy` | string | No | Sort field (title, author, publicationDate, rrp) |
| `sortOrder` | string | No | Sort order (asc, desc) |

### Response

```json
{
  "data": [
    {
      "id": 1,
      "isbn": "9780306406157",
      "title": "React Programming Guide",
      "subtitle": "A Comprehensive Introduction",
      "author": "John Smith",
      "format": "PAPERBACK",
      "rrp": 29.99,
      "unitCost": 8.50,
      "publisher": "Tech Books Inc",
      "publicationDate": "2024-01-15T00:00:00.000Z",
      "category": "Technology",
      "seriesId": 1,
      "series": {
        "id": 1,
        "name": "React Mastery Series"
      },
      "dimensions": "229x152x19",
      "weight": 450,
      "pageCount": 350,
      "binding": "Perfect Binding",
      "tradeDiscount": 40.0,
      "royaltyRate": 10.0,
      "printRun": 5000,
      "reprintQuantity": 2000,
      "outOfPrintDate": null,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-15T14:30:00.000Z"
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

### Example Request

```bash
curl -X GET "https://your-domain.com/api/titles?page=1&limit=20&search=React&format=PAPERBACK" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

---

## Get Title by ID

Retrieve a single title with all details and relationships.

### Endpoint

```
GET /api/titles/:id
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Title ID |

### Response

```json
{
  "id": 1,
  "isbn": "9780306406157",
  "title": "React Programming Guide",
  "subtitle": "A Comprehensive Introduction",
  "author": "John Smith",
  "format": "PAPERBACK",
  "rrp": 29.99,
  "unitCost": 8.50,
  "publisher": "Tech Books Inc",
  "publicationDate": "2024-01-15T00:00:00.000Z",
  "category": "Technology",
  "seriesId": 1,
  "series": {
    "id": 1,
    "name": "React Mastery Series",
    "seriesOrder": 1
  },
  "dimensions": "229x152x19",
  "weight": 450,
  "pageCount": 350,
  "binding": "Perfect Binding",
  "tradeDiscount": 40.0,
  "royaltyRate": 10.0,
  "printRun": 5000,
  "reprintQuantity": 2000,
  "outOfPrintDate": null,
  "priceHistory": [
    {
      "id": 1,
      "titleId": 1,
      "rrp": 29.99,
      "unitCost": 8.50,
      "reason": "Initial creation",
      "effectiveFrom": "2024-01-01T12:00:00.000Z"
    }
  ],
  "inventory": [
    {
      "warehouseId": 1,
      "warehouseName": "Main Warehouse",
      "currentStock": 100,
      "availableStock": 80,
      "reservedStock": 20,
      "committedStock": 0
    }
  ],
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-15T14:30:00.000Z"
}
```

### Example Request

```bash
curl -X GET "https://your-domain.com/api/titles/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

---

## Create Title

Create a new title in the system.

### Endpoint

```
POST /api/titles
```

### Request Body

```json
{
  "isbn": "9780306406157",
  "title": "React Programming Guide",
  "subtitle": "A Comprehensive Introduction",
  "author": "John Smith",
  "format": "PAPERBACK",
  "rrp": 29.99,
  "unitCost": 8.50,
  "publisher": "Tech Books Inc",
  "publicationDate": "2024-01-15",
  "category": "Technology",
  "seriesId": 1,
  "dimensions": "229x152x19",
  "weight": 450,
  "pageCount": 350,
  "binding": "Perfect Binding",
  "tradeDiscount": 40.0,
  "royaltyRate": 10.0,
  "printRun": 5000,
  "reprintQuantity": 2000,
  "outOfPrintDate": null
}
```

### Required Fields

- `isbn` (string): Valid ISBN-13
- `title` (string): Book title
- `author` (string): Author name
- `format` (enum): PAPERBACK, HARDCOVER, EBOOK, AUDIOBOOK
- `rrp` (number): Recommended retail price
- `unitCost` (number): Unit cost

### Response

**Status**: `201 Created`

```json
{
  "id": 1,
  "isbn": "9780306406157",
  "title": "React Programming Guide",
  ...
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

### Example Request

```bash
curl -X POST "https://your-domain.com/api/titles" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "isbn": "9780306406157",
    "title": "React Programming Guide",
    "author": "John Smith",
    "format": "PAPERBACK",
    "rrp": 29.99,
    "unitCost": 8.50
  }'
```

---

## Update Title

Update an existing title.

### Endpoint

```
PUT /api/titles/:id
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Title ID |

### Request Body

All fields are optional. Only include fields you want to update.

```json
{
  "title": "React Programming Guide (2nd Edition)",
  "rrp": 34.99,
  "priceChangeReason": "Price increase for new edition"
}
```

### Price Change Handling

If updating `rrp` or `unitCost`, include `priceChangeReason`:

```json
{
  "rrp": 34.99,
  "unitCost": 9.50,
  "priceChangeReason": "Annual price adjustment 2024"
}
```

### Response

**Status**: `200 OK`

```json
{
  "id": 1,
  "isbn": "9780306406157",
  "title": "React Programming Guide (2nd Edition)",
  "rrp": 34.99,
  ...
  "updatedAt": "2024-01-15T14:30:00.000Z"
}
```

### Example Request

```bash
curl -X PUT "https://your-domain.com/api/titles/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rrp": 34.99,
    "priceChangeReason": "Price increase"
  }'
```

---

## Delete Title

Delete a title from the system.

### Endpoint

```
DELETE /api/titles/:id
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Title ID |

### Constraints

- Title must have zero inventory across all warehouses
- Cannot delete if current stock > 0
- Cannot delete if reserved or committed stock > 0

### Response

**Status**: `200 OK`

```json
{
  "message": "Title deleted successfully"
}
```

### Error Response

**Status**: `409 Conflict`

```json
{
  "error": "Cannot delete title with existing inventory",
  "currentStock": 100,
  "reservedStock": 20,
  "committedStock": 0
}
```

### Example Request

```bash
curl -X DELETE "https://your-domain.com/api/titles/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

---

## Bulk Import

Import multiple titles from CSV data.

### Endpoint

```
POST /api/titles/bulk-import
```

### Request Body

```json
{
  "titles": [
    {
      "isbn": "9780306406157",
      "title": "Book One",
      "author": "Author One",
      "format": "PAPERBACK",
      "rrp": 29.99,
      "unitCost": 8.50
    },
    {
      "isbn": "9780306406164",
      "title": "Book Two",
      "author": "Author Two",
      "format": "HARDCOVER",
      "rrp": 39.99,
      "unitCost": 12.00
    }
  ]
}
```

### Limits

- Maximum 1000 titles per request
- Each title must have required fields
- ISBNs must be unique

### Response

**Status**: `200 OK`

```json
{
  "success": 2,
  "failed": 0,
  "errors": []
}
```

### Partial Success Response

```json
{
  "success": 1,
  "failed": 1,
  "errors": [
    {
      "isbn": "9780306406158",
      "title": "Invalid Book",
      "error": "Invalid ISBN-13 checksum"
    }
  ]
}
```

### Example Request

```bash
curl -X POST "https://your-domain.com/api/titles/bulk-import" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "titles": [
      {
        "isbn": "9780306406157",
        "title": "Book One",
        "author": "Author One",
        "format": "PAPERBACK",
        "rrp": 29.99,
        "unitCost": 8.50
      }
    ]
  }'
```

---

## Bulk Price Update

Update prices for multiple titles simultaneously.

### Endpoint

```
PUT /api/titles/bulk-update-prices
```

### Request Body

```json
{
  "updates": [
    {
      "id": 1,
      "rrp": 34.99
    },
    {
      "id": 2,
      "rrp": 44.99,
      "unitCost": 13.00
    }
  ],
  "reason": "Annual price increase 2024"
}
```

### Required Fields

- `updates` (array): Array of price updates
- `reason` (string): Reason for all price changes

### Response

**Status**: `200 OK`

```json
{
  "results": [
    {
      "id": 1,
      "success": true
    },
    {
      "id": 2,
      "success": true
    }
  ],
  "successful": 2,
  "failed": 0
}
```

### Example Request

```bash
curl -X PUT "https://your-domain.com/api/titles/bulk-update-prices" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"id": 1, "rrp": 34.99},
      {"id": 2, "rrp": 44.99}
    ],
    "reason": "Annual price increase"
  }'
```

---

## Export Titles

Export titles to CSV format.

### Endpoint

```
GET /api/titles/export
```

### Query Parameters

Same as [List Titles](#list-titles) for filtering which titles to export.

### Response

**Content-Type**: `text/csv`

```csv
isbn,title,author,format,rrp,unitCost,publisher,category
9780306406157,"React Programming Guide","John Smith",PAPERBACK,29.99,8.50,"Tech Books Inc","Technology"
9780306406164,"Vue.js Masterclass","Jane Doe",HARDCOVER,39.99,12.00,"Tech Books Inc","Technology"
```

### Example Request

```bash
curl -X GET "https://your-domain.com/api/titles/export?format=PAPERBACK" \
  -H "Authorization: Bearer <token>" \
  -o titles-export.csv
```

---

## Get Price History

Retrieve price history for a specific title.

### Endpoint

```
GET /api/titles/:id/price-history
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Title ID |

### Response

**Status**: `200 OK`

```json
[
  {
    "id": 2,
    "titleId": 1,
    "rrp": 34.99,
    "unitCost": 9.50,
    "reason": "Annual price increase 2024",
    "effectiveFrom": "2024-01-15T00:00:00.000Z"
  },
  {
    "id": 1,
    "titleId": 1,
    "rrp": 29.99,
    "unitCost": 8.50,
    "reason": "Initial creation",
    "effectiveFrom": "2024-01-01T00:00:00.000Z"
  }
]
```

### Example Request

```bash
curl -X GET "https://your-domain.com/api/titles/1/price-history" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (authentication required) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `409` | Conflict (duplicate ISBN, has inventory) |
| `422` | Unprocessable Entity (invalid data) |
| `429` | Too Many Requests (rate limit exceeded) |
| `500` | Internal Server Error |

### Common Error Responses

**400 Bad Request**
```json
{
  "error": "Invalid input",
  "code": "VALIDATION_ERROR",
  "details": {
    "isbn": "Invalid ISBN-13 checksum",
    "rrp": "Must be a positive number"
  }
}
```

**401 Unauthorized**
```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden**
```json
{
  "error": "Insufficient permissions",
  "code": "FORBIDDEN",
  "required": "title:create"
}
```

**404 Not Found**
```json
{
  "error": "Title not found",
  "code": "NOT_FOUND"
}
```

**409 Conflict**
```json
{
  "error": "Title with ISBN 9780306406157 already exists",
  "code": "DUPLICATE_ISBN",
  "existingId": 5
}
```

**429 Too Many Requests**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT",
  "retryAfter": 60
}
```

---

## Webhooks

### Events

The system can send webhooks for the following events:

- `title.created` - New title created
- `title.updated` - Title updated
- `title.deleted` - Title deleted
- `title.price_changed` - Title price changed

### Webhook Payload Example

```json
{
  "event": "title.created",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "data": {
    "id": 1,
    "isbn": "9780306406157",
    "title": "React Programming Guide",
    ...
  }
}
```

---

## SDKs and Client Libraries

### JavaScript/TypeScript

```typescript
import { TitleAPI } from '@bookstock/api-client'

const api = new TitleAPI({ apiKey: 'your-api-key' })

// List titles
const titles = await api.list({ page: 1, limit: 20 })

// Create title
const newTitle = await api.create({
  isbn: '9780306406157',
  title: 'React Programming Guide',
  author: 'John Smith',
  format: 'PAPERBACK',
  rrp: 29.99,
  unitCost: 8.50
})
```

### Python

```python
from bookstock import TitleAPI

api = TitleAPI(api_key='your-api-key')

# List titles
titles = api.list(page=1, limit=20)

# Create title
new_title = api.create(
    isbn='9780306406157',
    title='React Programming Guide',
    author='John Smith',
    format='PAPERBACK',
    rrp=29.99,
    unit_cost=8.50
)
```

---

## Support

For API support:
- Contact: api-support@bookstock.com
- Documentation: https://docs.bookstock.com/api
- Status Page: https://status.bookstock.com

---

**Last Updated**: January 2025
**Version**: 1.0
**API Version**: v1
