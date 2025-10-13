# Title Management System - Technical Specification

> **Version:** 1.0
> **Last Updated:** 2025-01-13
> **Author:** Development Team

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Service Layer](#service-layer)
4. [API Endpoints](#api-endpoints)
5. [UI Components](#ui-components)
6. [Validation Rules](#validation-rules)
7. [Business Logic](#business-logic)
8. [Error Handling](#error-handling)
9. [Performance Optimization](#performance-optimization)
10. [Security Considerations](#security-considerations)

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Title List  │  │  Title Form  │  │  Title       │      │
│  │  Page        │  │  Component   │  │  Details     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Next.js)                        │
├──────────────────────────────────────────────────────────────┤
│  GET    /api/titles              → List titles               │
│  POST   /api/titles              → Create title              │
│  GET    /api/titles/[id]         → Get title details         │
│  PUT    /api/titles/[id]         → Update title              │
│  DELETE /api/titles/[id]         → Archive title             │
│  POST   /api/titles/bulk-import  → Import CSV                │
│  GET    /api/titles/export       → Export CSV                │
│  PUT    /api/titles/bulk-update  → Bulk price update         │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Service Layer (Business Logic)                  │
├──────────────────────────────────────────────────────────────┤
│  titleService                                                │
│  ├── create()          → Create with validation             │
│  ├── update()          → Update with price history          │
│  ├── findById()        → Get by ID with relationships        │
│  ├── list()            → Paginated list with filters         │
│  ├── delete()          → Soft delete                         │
│  ├── bulkImport()      → CSV import with validation          │
│  ├── bulkUpdatePrices()→ Update prices + history            │
│  └── validateISBN()    → ISBN validation logic              │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (Prisma ORM)                         │
├──────────────────────────────────────────────────────────────┤
│  Models: Title, PriceHistory, Series, Inventory             │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL)                       │
└──────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Frontend Layer**
- User interface and interaction
- Client-side validation
- State management
- Data fetching with SWR

**API Layer**
- Route handling
- Authentication/authorization
- Request validation (Zod)
- Audit logging
- Response formatting

**Service Layer**
- Business logic
- Complex validations
- Database transactions
- Price history management
- Data transformations

**Data Layer**
- Database queries
- Relationships
- Constraints
- Indexes

## Database Schema

### Title Model (Existing)

```prisma
model Title {
  // Core Publishing Fields
  id              Int       @id @default(autoincrement())
  isbn            String    @unique @db.VarChar(13)
  title           String    @db.VarChar(500)
  author          String    @db.VarChar(255)
  format          Format
  rrp             Decimal   @db.Decimal(8, 2)
  unitCost        Decimal   @db.Decimal(8, 2) @map("unit_cost")
  pageCount       Int?      @map("page_count")
  publicationDate DateTime? @map("publication_date")
  publisher       String?   @db.VarChar(255)
  category        String?   @db.VarChar(100)
  subcategory     String?   @db.VarChar(100)

  // Physical Product Fields
  dimensions      String?   @db.VarChar(50)  // L×W×H in mm
  weight          Int?      // Weight in grams
  bindingType     String?   @db.VarChar(50) @map("binding_type")
  coverFinish     String?   @db.VarChar(50) @map("cover_finish")

  // Commercial Fields
  tradeDiscount   Decimal?  @db.Decimal(5, 2) @map("trade_discount")
  royaltyRate     Decimal?  @db.Decimal(5, 2) @map("royalty_rate")
  royaltyThreshold Int?     @map("royalty_threshold")
  printRunSize    Int?      @map("print_run_size")
  reprintThreshold Int?     @map("reprint_threshold")

  // Additional Metadata
  description     String?   @db.Text
  keywords        String?   @db.VarChar(500)
  language        String?   @db.VarChar(10)
  territoryRights String?   @db.VarChar(200) @map("territory_rights")

  // Relationships
  seriesId        Int?      @map("series_id")
  series          Series?   @relation(fields: [seriesId], references: [id])
  inventory       Inventory[]
  stockMovements  StockMovement[]
  priceHistory    PriceHistory[]

  // System Fields
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("titles")
  @@index([isbn])
  @@index([title])
  @@index([author])
  @@index([seriesId])
  @@index([format])
  @@index([category])
  @@index([publisher])
  @@index([publicationDate])
}
```

### PriceHistory Model (Existing)

```prisma
model PriceHistory {
  id              Int      @id @default(autoincrement())
  titleId         Int      @map("title_id")
  rrp             Decimal  @db.Decimal(8, 2)
  unitCost        Decimal? @db.Decimal(8, 2) @map("unit_cost")
  tradeDiscount   Decimal? @db.Decimal(5, 2) @map("trade_discount")
  effectiveFrom   DateTime @map("effective_from")
  effectiveTo     DateTime? @map("effective_to")  // NULL = current
  reason          String?  @db.VarChar(255)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relationships
  title           Title    @relation(fields: [titleId], references: [id])

  @@map("price_history")
  @@index([titleId])
  @@index([effectiveFrom])
  @@index([effectiveTo])
  @@unique([titleId, effectiveFrom])
}
```

### Indexes & Performance

**Existing Indexes:**
- `isbn` - Unique lookup
- `title` - Text search
- `author` - Author filtering
- `seriesId` - Series filtering
- `format` - Format filtering
- `category` - Category filtering
- `publisher` - Publisher filtering
- `publicationDate` - Date range queries

**Query Patterns:**
- Single title lookup by ID or ISBN (indexed)
- List with pagination (default sort by title)
- Search by title/author (indexed)
- Filter by series, format, category (indexed)
- Price history lookup by title (indexed)

## Service Layer

### titleService.ts

```typescript
// src/services/titleService.ts

import { prisma } from '@/lib/database'
import { Prisma, Format } from '@prisma/client'
import { validateISBN13 } from '@/lib/validators/isbn'

export interface CreateTitleInput {
  isbn: string
  title: string
  author: string
  format: Format
  rrp: number
  unitCost: number
  publisher?: string
  publicationDate?: Date
  pageCount?: number
  description?: string
  category?: string
  subcategory?: string
  dimensions?: string
  weight?: number
  bindingType?: string
  coverFinish?: string
  tradeDiscount?: number
  royaltyRate?: number
  royaltyThreshold?: number
  printRunSize?: number
  reprintThreshold?: number
  keywords?: string
  language?: string
  territoryRights?: string
  seriesId?: number
}

export interface UpdateTitleInput extends Partial<CreateTitleInput> {
  priceChangeReason?: string // For price history
}

export interface ListTitlesOptions {
  page?: number
  limit?: number
  search?: string
  format?: Format
  seriesId?: number
  category?: string
  publisher?: string
  sortBy?: 'title' | 'author' | 'publicationDate' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface BulkImportResult {
  success: number
  failed: number
  errors: Array<{
    row: number
    isbn: string
    error: string
  }>
}

class TitleService {
  /**
   * Create a new title with validation
   */
  async create(data: CreateTitleInput) {
    // Validate ISBN
    const isbn = this.normalizeISBN(data.isbn)
    if (!validateISBN13(isbn)) {
      throw new Error('Invalid ISBN-13 format')
    }

    // Check for duplicate ISBN
    const existing = await prisma.title.findUnique({
      where: { isbn }
    })
    if (existing) {
      throw new Error(`Title with ISBN ${isbn} already exists`)
    }

    // Create title with price history
    return await prisma.$transaction(async (tx) => {
      const title = await tx.title.create({
        data: {
          ...data,
          isbn,
          rrp: new Prisma.Decimal(data.rrp),
          unitCost: new Prisma.Decimal(data.unitCost),
          tradeDiscount: data.tradeDiscount
            ? new Prisma.Decimal(data.tradeDiscount)
            : null,
          royaltyRate: data.royaltyRate
            ? new Prisma.Decimal(data.royaltyRate)
            : null
        },
        include: {
          series: true
        }
      })

      // Create initial price history record
      await tx.priceHistory.create({
        data: {
          titleId: title.id,
          rrp: new Prisma.Decimal(data.rrp),
          unitCost: new Prisma.Decimal(data.unitCost),
          tradeDiscount: data.tradeDiscount
            ? new Prisma.Decimal(data.tradeDiscount)
            : null,
          effectiveFrom: new Date(),
          reason: 'Initial price'
        }
      })

      return title
    })
  }

  /**
   * Update a title, with automatic price history
   */
  async update(id: number, data: UpdateTitleInput) {
    const existing = await prisma.title.findUnique({
      where: { id }
    })

    if (!existing) {
      throw new Error('Title not found')
    }

    // Check if ISBN is being changed and validate
    if (data.isbn && data.isbn !== existing.isbn) {
      const normalizedISBN = this.normalizeISBN(data.isbn)
      if (!validateISBN13(normalizedISBN)) {
        throw new Error('Invalid ISBN-13 format')
      }

      // Check for duplicate
      const duplicate = await prisma.title.findUnique({
        where: { isbn: normalizedISBN }
      })
      if (duplicate && duplicate.id !== id) {
        throw new Error(`ISBN ${normalizedISBN} already exists`)
      }
      data.isbn = normalizedISBN
    }

    // Check if price changed
    const priceChanged =
      (data.rrp && data.rrp !== existing.rrp.toNumber()) ||
      (data.unitCost && data.unitCost !== existing.unitCost.toNumber()) ||
      (data.tradeDiscount && data.tradeDiscount !== existing.tradeDiscount?.toNumber())

    return await prisma.$transaction(async (tx) => {
      // Update title
      const updated = await tx.title.update({
        where: { id },
        data: {
          ...data,
          rrp: data.rrp ? new Prisma.Decimal(data.rrp) : undefined,
          unitCost: data.unitCost ? new Prisma.Decimal(data.unitCost) : undefined,
          tradeDiscount: data.tradeDiscount
            ? new Prisma.Decimal(data.tradeDiscount)
            : undefined,
          royaltyRate: data.royaltyRate
            ? new Prisma.Decimal(data.royaltyRate)
            : undefined
        },
        include: {
          series: true,
          priceHistory: {
            where: {
              effectiveTo: null
            }
          }
        }
      })

      // If price changed, create price history
      if (priceChanged) {
        // Close current price record
        await tx.priceHistory.updateMany({
          where: {
            titleId: id,
            effectiveTo: null
          },
          data: {
            effectiveTo: new Date()
          }
        })

        // Create new price record
        await tx.priceHistory.create({
          data: {
            titleId: id,
            rrp: new Prisma.Decimal(data.rrp ?? updated.rrp),
            unitCost: data.unitCost
              ? new Prisma.Decimal(data.unitCost)
              : updated.unitCost,
            tradeDiscount: data.tradeDiscount
              ? new Prisma.Decimal(data.tradeDiscount)
              : updated.tradeDiscount,
            effectiveFrom: new Date(),
            reason: data.priceChangeReason || 'Price update'
          }
        })
      }

      return updated
    })
  }

  /**
   * Get title by ID with all relationships
   */
  async findById(id: number) {
    const title = await prisma.title.findUnique({
      where: { id },
      include: {
        series: true,
        priceHistory: {
          orderBy: {
            effectiveFrom: 'desc'
          }
        },
        inventory: {
          include: {
            warehouse: true
          }
        }
      }
    })

    if (!title) {
      throw new Error('Title not found')
    }

    return title
  }

  /**
   * Get title by ISBN
   */
  async findByISBN(isbn: string) {
    const normalizedISBN = this.normalizeISBN(isbn)

    return await prisma.title.findUnique({
      where: { isbn: normalizedISBN },
      include: {
        series: true,
        priceHistory: {
          where: {
            effectiveTo: null
          }
        }
      }
    })
  }

  /**
   * List titles with pagination and filtering
   */
  async list(options: ListTitlesOptions = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      format,
      seriesId,
      category,
      publisher,
      sortBy = 'title',
      sortOrder = 'asc'
    } = options

    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.TitleWhereInput = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search } }
      ]
    }

    if (format) {
      where.format = format
    }

    if (seriesId) {
      where.seriesId = seriesId
    }

    if (category) {
      where.category = category
    }

    if (publisher) {
      where.publisher = { contains: publisher, mode: 'insensitive' }
    }

    // Execute query with count
    const [titles, total] = await Promise.all([
      prisma.title.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          series: true
        }
      }),
      prisma.title.count({ where })
    ])

    return {
      data: titles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Soft delete a title
   */
  async delete(id: number) {
    // Check if title has inventory
    const inventory = await prisma.inventory.findFirst({
      where: {
        titleId: id,
        currentStock: { gt: 0 }
      }
    })

    if (inventory) {
      throw new Error('Cannot delete title with existing inventory')
    }

    // In Phase 1, we'll just prevent deletion if inventory exists
    // In future: implement soft delete with isActive flag
    return await prisma.title.delete({
      where: { id }
    })
  }

  /**
   * Bulk import titles from CSV
   */
  async bulkImport(titles: CreateTitleInput[]): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: 0,
      failed: 0,
      errors: []
    }

    for (let i = 0; i < titles.length; i++) {
      try {
        await this.create(titles[i])
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push({
          row: i + 1,
          isbn: titles[i].isbn,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return result
  }

  /**
   * Bulk update prices with history
   */
  async bulkUpdatePrices(
    updates: Array<{ id: number; rrp?: number; unitCost?: number; tradeDiscount?: number }>,
    reason: string
  ) {
    const results = []

    for (const update of updates) {
      try {
        const title = await this.update(update.id, {
          ...update,
          priceChangeReason: reason
        })
        results.push({ success: true, id: update.id, title })
      } catch (error) {
        results.push({
          success: false,
          id: update.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * Get price history for a title
   */
  async getPriceHistory(titleId: number) {
    return await prisma.priceHistory.findMany({
      where: { titleId },
      orderBy: {
        effectiveFrom: 'desc'
      }
    })
  }

  /**
   * Get all categories
   */
  async getCategories() {
    const categories = await prisma.title.findMany({
      where: {
        category: { not: null }
      },
      select: {
        category: true
      },
      distinct: ['category']
    })

    return categories
      .map(c => c.category)
      .filter(Boolean)
      .sort()
  }

  /**
   * Get all publishers
   */
  async getPublishers() {
    const publishers = await prisma.title.findMany({
      where: {
        publisher: { not: null }
      },
      select: {
        publisher: true
      },
      distinct: ['publisher']
    })

    return publishers
      .map(p => p.publisher)
      .filter(Boolean)
      .sort()
  }

  /**
   * Normalize ISBN (remove hyphens, spaces)
   */
  private normalizeISBN(isbn: string): string {
    return isbn.replace(/[-\s]/g, '')
  }
}

export const titleService = new TitleService()
```

## API Endpoints

### GET /api/titles

**Purpose:** List titles with pagination and filtering

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `search` (string, optional) - Search title, author, or ISBN
- `format` (Format enum, optional)
- `seriesId` (number, optional)
- `category` (string, optional)
- `publisher` (string, optional)
- `sortBy` (string, default: 'title')
- `sortOrder` ('asc' | 'desc', default: 'asc')

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "isbn": "9781234567890",
      "title": "The Opinionated Guide to React",
      "author": "Sara Drasner",
      "format": "PAPERBACK",
      "rrp": "29.99",
      "unitCost": "8.50",
      "publisher": "O'Reilly",
      "series": {
        "id": 1,
        "name": "Opinionated Guides"
      },
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-10T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 245,
    "totalPages": 13
  }
}
```

**Permissions:** `title:read`

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 403: Forbidden
- 500: Server error

### POST /api/titles

**Purpose:** Create a new title

**Request Body:**
```json
{
  "isbn": "978-1-234567-89-0",
  "title": "The Opinionated Guide to React",
  "author": "Sara Drasner",
  "format": "PAPERBACK",
  "rrp": 29.99,
  "unitCost": 8.50,
  "publisher": "O'Reilly",
  "publicationDate": "2025-03-01",
  "pageCount": 350,
  "category": "Technology",
  "subcategory": "Web Development",
  "dimensions": "229x152x19",
  "weight": 450,
  "bindingType": "Perfect Bound",
  "coverFinish": "Matte",
  "tradeDiscount": 40.0,
  "royaltyRate": 10.0,
  "royaltyThreshold": 1000,
  "printRunSize": 2000,
  "reprintThreshold": 500,
  "description": "A comprehensive guide to React best practices",
  "keywords": "react, javascript, web development",
  "language": "en",
  "territoryRights": "World English",
  "seriesId": 1
}
```

**Response:**
```json
{
  "id": 1,
  "isbn": "9781234567890",
  "title": "The Opinionated Guide to React",
  ...
  "createdAt": "2025-01-13T00:00:00Z",
  "updatedAt": "2025-01-13T00:00:00Z"
}
```

**Permissions:** `title:create`

**Status Codes:**
- 201: Created
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden
- 409: Duplicate ISBN
- 500: Server error

### GET /api/titles/[id]

**Purpose:** Get detailed title information

**Response:**
```json
{
  "id": 1,
  "isbn": "9781234567890",
  "title": "The Opinionated Guide to React",
  "author": "Sara Drasner",
  ...
  "series": {
    "id": 1,
    "name": "Opinionated Guides"
  },
  "priceHistory": [
    {
      "id": 1,
      "rrp": "29.99",
      "unitCost": "8.50",
      "effectiveFrom": "2025-01-01T00:00:00Z",
      "effectiveTo": null,
      "reason": "Initial price"
    }
  ],
  "inventory": [
    {
      "id": 1,
      "warehouseId": 1,
      "warehouse": {
        "id": 1,
        "name": "Turnaround UK",
        "code": "TRN"
      },
      "currentStock": 1500,
      "reservedStock": 50
    }
  ]
}
```

**Permissions:** `title:read`

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 500: Server error

### PUT /api/titles/[id]

**Purpose:** Update a title

**Request Body:** (all fields optional)
```json
{
  "rrp": 34.99,
  "unitCost": 9.00,
  "priceChangeReason": "Price increase due to printing costs"
}
```

**Response:** Updated title object

**Permissions:** `title:update`

**Status Codes:**
- 200: Success
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 409: Duplicate ISBN (if ISBN changed)
- 500: Server error

### DELETE /api/titles/[id]

**Purpose:** Delete/archive a title

**Response:**
```json
{
  "success": true,
  "message": "Title deleted successfully"
}
```

**Permissions:** `title:delete`

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 409: Cannot delete (has inventory)
- 500: Server error

### POST /api/titles/bulk-import

**Purpose:** Import multiple titles from CSV

**Request Body:**
```json
{
  "titles": [
    {
      "isbn": "9781234567890",
      "title": "Book Title",
      ...
    }
  ]
}
```

**Response:**
```json
{
  "success": 245,
  "failed": 5,
  "errors": [
    {
      "row": 10,
      "isbn": "9781234567890",
      "error": "Duplicate ISBN"
    }
  ]
}
```

**Permissions:** `title:create`

**Status Codes:**
- 200: Success (even with partial failures)
- 400: Invalid format
- 401: Unauthorized
- 403: Forbidden
- 500: Server error

### GET /api/titles/export

**Purpose:** Export titles to CSV

**Query Parameters:**
- Same as GET /api/titles (filtering)

**Response:** CSV file download

**Permissions:** `title:read`

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 403: Forbidden
- 500: Server error

### PUT /api/titles/bulk-update-prices

**Purpose:** Update prices for multiple titles

**Request Body:**
```json
{
  "updates": [
    {
      "id": 1,
      "rrp": 29.99,
      "unitCost": 8.50
    }
  ],
  "reason": "Annual price review 2025"
}
```

**Response:**
```json
{
  "success": 240,
  "failed": 5,
  "results": [...]
}
```

**Permissions:** `title:update`

## Validation Rules

### ISBN Validation

```typescript
// src/lib/validators/isbn.ts

export function validateISBN13(isbn: string): boolean {
  // Remove hyphens and spaces
  const cleaned = isbn.replace(/[-\s]/g, '')

  // Must be 13 digits
  if (!/^\d{13}$/.test(cleaned)) {
    return false
  }

  // Check ISBN-13 checksum
  const digits = cleaned.split('').map(Number)
  const checksum = digits.reduce((sum, digit, index) => {
    return sum + digit * (index % 2 === 0 ? 1 : 3)
  }, 0)

  return checksum % 10 === 0
}

export function formatISBN13(isbn: string): string {
  const cleaned = isbn.replace(/[-\s]/g, '')

  // Format as 978-1-234567-89-0
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 4)}-${cleaned.slice(4, 10)}-${cleaned.slice(10, 12)}-${cleaned.slice(12)}`
}

export function convertISBN10to13(isbn10: string): string {
  const cleaned = isbn10.replace(/[-\s]/g, '').slice(0, 9)
  const isbn13base = '978' + cleaned

  // Calculate checksum
  const digits = isbn13base.split('').map(Number)
  const checksum = digits.reduce((sum, digit, index) => {
    return sum + digit * (index % 2 === 0 ? 1 : 3)
  }, 0)

  const checksumDigit = (10 - (checksum % 10)) % 10

  return isbn13base + checksumDigit
}
```

### Zod Schemas

```typescript
// src/lib/validators/title.ts

import { z } from 'zod'
import { Format } from '@prisma/client'

export const CreateTitleSchema = z.object({
  isbn: z.string()
    .min(10, 'ISBN must be at least 10 characters')
    .max(17, 'ISBN must not exceed 17 characters')
    .regex(/^[\d\-\s]+$/, 'ISBN must contain only digits, hyphens, and spaces'),

  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must not exceed 500 characters'),

  author: z.string()
    .min(1, 'Author is required')
    .max(255, 'Author must not exceed 255 characters'),

  format: z.nativeEnum(Format, {
    errorMap: () => ({ message: 'Invalid format' })
  }),

  rrp: z.number()
    .positive('RRP must be positive')
    .max(9999.99, 'RRP too large'),

  unitCost: z.number()
    .positive('Unit cost must be positive')
    .max(9999.99, 'Unit cost too large'),

  publisher: z.string().max(255).optional(),
  publicationDate: z.coerce.date().optional(),
  pageCount: z.number().int().positive().optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),

  dimensions: z.string()
    .regex(/^\d+x\d+x\d+$/, 'Dimensions must be in format LxWxH')
    .optional(),

  weight: z.number().int().positive().optional(),
  bindingType: z.string().max(50).optional(),
  coverFinish: z.string().max(50).optional(),

  tradeDiscount: z.number()
    .min(0, 'Trade discount cannot be negative')
    .max(100, 'Trade discount cannot exceed 100%')
    .optional(),

  royaltyRate: z.number()
    .min(0, 'Royalty rate cannot be negative')
    .max(100, 'Royalty rate cannot exceed 100%')
    .optional(),

  royaltyThreshold: z.number().int().nonnegative().optional(),
  printRunSize: z.number().int().positive().optional(),
  reprintThreshold: z.number().int().nonnegative().optional(),

  keywords: z.string().max(500).optional(),
  language: z.string().length(2).optional(), // ISO 639-1 codes
  territoryRights: z.string().max(200).optional(),
  seriesId: z.number().int().positive().optional()
})

export const UpdateTitleSchema = CreateTitleSchema.partial().extend({
  priceChangeReason: z.string().max(255).optional()
})

export const BulkImportSchema = z.object({
  titles: z.array(CreateTitleSchema).min(1).max(1000)
})

export const BulkUpdatePricesSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    rrp: z.number().positive().optional(),
    unitCost: z.number().positive().optional(),
    tradeDiscount: z.number().min(0).max(100).optional()
  })).min(1).max(1000),
  reason: z.string().min(1).max(255)
})
```

## Business Logic

### Price History Management

**Rules:**
1. Every title creation creates initial price history record
2. Price changes automatically close current record and create new one
3. Current price always has `effectiveTo = null`
4. Historical prices have `effectiveTo` set to when they were superseded
5. Price history is immutable once created

**Implementation:**
```typescript
// When updating price:
// 1. Close current price record (set effectiveTo = now)
// 2. Create new price record (effectiveFrom = now, effectiveTo = null)
// 3. Update title with new prices
```

### ISBN Handling

**Rules:**
1. Store ISBNs without hyphens/spaces (normalized)
2. Accept ISBN-10 or ISBN-13 on input
3. Convert ISBN-10 to ISBN-13 automatically
4. Validate checksum digit
5. Display with proper formatting in UI

### Deletion Logic

**Phase 1 Rules:**
1. Cannot delete title with inventory > 0
2. Hard delete for titles without inventory
3. Cascading: Delete price history when title deleted

**Future (Phase 2):**
1. Soft delete with `isActive` flag
2. Maintain historical data
3. Allow "restore" functionality

## Error Handling

### Error Types

```typescript
// src/lib/errors/title-errors.ts

export class TitleNotFoundError extends Error {
  constructor(identifier: string | number) {
    super(`Title not found: ${identifier}`)
    this.name = 'TitleNotFoundError'
  }
}

export class DuplicateISBNError extends Error {
  constructor(isbn: string) {
    super(`Title with ISBN ${isbn} already exists`)
    this.name = 'DuplicateISBNError'
  }
}

export class InvalidISBNError extends Error {
  constructor(isbn: string) {
    super(`Invalid ISBN format: ${isbn}`)
    this.name = 'InvalidISBNError'
  }
}

export class TitleHasInventoryError extends Error {
  constructor(titleId: number) {
    super(`Cannot delete title ${titleId}: has existing inventory`)
    this.name = 'TitleHasInventoryError'
  }
}
```

### API Error Responses

```typescript
// Standard error response format
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional info
}
```

**Error Codes:**
- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ISBN` - ISBN already exists
- `INVALID_ISBN` - ISBN format invalid
- `HAS_INVENTORY` - Cannot delete (has inventory)
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `INTERNAL_ERROR` - Server error

## Performance Optimization

### Database Indexes

**Existing (from schema):**
- Primary key: `id`
- Unique: `isbn`
- Indexes: title, author, seriesId, format, category, publisher, publicationDate

**Query Performance Targets:**
- Single title lookup: < 10ms
- List with pagination: < 100ms
- Search across 200 titles: < 200ms
- Bulk import 100 titles: < 5 seconds

### Caching Strategy

**Phase 1: No caching**
- Direct database queries
- Acceptable for 200-500 titles

**Future (if needed):**
- Redis cache for frequently accessed titles
- Cache category/publisher lists (change rarely)
- Cache search results (5 min TTL)

### Pagination

**Cursor-based pagination** (future optimization):
```typescript
// Instead of page/limit, use cursor
{
  cursor: "lastTitleId",
  limit: 20
}

// More efficient for large datasets
// Prevents issues with concurrent modifications
```

**Offset-based pagination** (Phase 1):
```typescript
// Current implementation
{
  page: 1,
  limit: 20
}

// Simpler, good for < 1000 titles
```

## Security Considerations

### Input Validation

1. **Server-side validation** (primary)
   - Zod schemas on all API routes
   - Type checking with TypeScript
   - Business rule validation in service layer

2. **Client-side validation** (UX)
   - React Hook Form + Zod
   - Immediate feedback
   - Not trusted for security

### SQL Injection Prevention

- Prisma ORM handles parameterization
- No raw SQL queries
- All inputs validated

### Authorization

- Every API route protected with middleware
- Permission checks: `title:read`, `title:create`, `title:update`, `title:delete`
- Row-level security: Not needed (titles are global)

### Audit Logging

- All mutations logged automatically
- Track: create, update, delete, bulk operations
- Include: userId, timestamp, changed fields

### Rate Limiting

**Phase 1:** Not implemented

**Future:**
- Bulk operations: 10 requests/hour per user
- Standard operations: 100 requests/minute per user

## Testing Strategy

### Unit Tests

**Service Layer:**
- Create title with valid data
- Create title with invalid ISBN
- Create title with duplicate ISBN
- Update title prices (verify price history)
- Delete title with inventory (should fail)
- Delete title without inventory
- Search and filter titles
- Bulk import with mixed results

**Validators:**
- ISBN-13 validation (valid/invalid cases)
- ISBN-10 to ISBN-13 conversion
- Zod schema validation

**Coverage Target:** > 80%

### Integration Tests

**API Routes:**
- GET /api/titles (pagination, filtering, sorting)
- POST /api/titles (success, validation errors, duplicate)
- GET /api/titles/[id] (found, not found)
- PUT /api/titles/[id] (success, not found, validation)
- DELETE /api/titles/[id] (success, has inventory)
- POST /api/titles/bulk-import (success, partial failure)

**Database:**
- Price history created on title creation
- Price history updated on price change
- Cascading deletes work correctly

**Coverage Target:** > 90%

### E2E Tests

**User Journeys:**
1. Create new title → View in list → Edit → View changes
2. Search for title → Filter by format → Sort results
3. Bulk import CSV → Review errors → Fix and retry
4. Update prices → View price history
5. Attempt to delete title with inventory → See error

**Coverage Target:** Core flows covered

## Implementation Phases

### Phase 1: Core CRUD (Days 1-2)
- titleService implementation
- Basic API routes (GET, POST, PUT, DELETE single)
- ISBN validation
- Price history creation
- Unit tests

### Phase 2: List & Search (Day 3)
- Pagination
- Search functionality
- Filtering (format, series, category)
- Sorting
- Integration tests

### Phase 3: Bulk Operations (Days 4-5)
- CSV import
- CSV export
- Bulk price updates
- Error handling and reporting

### Phase 4: UI Components (Days 6-7)
- Title list page
- Title detail page
- Title form (create/edit)
- Search and filters
- Bulk import interface

### Phase 5: Testing & Polish (Days 8-9)
- E2E tests
- Error handling refinement
- Performance optimization
- Documentation

### Phase 6: Launch (Day 10)
- Deploy to production
- Data migration (if existing data)
- User training
- Monitor and fix issues
