# Title Management System - Test Specification

> **Version:** 1.0
> **Last Updated:** 2025-01-13

## Testing Strategy

### Test Pyramid

```
                  ┌───────────────┐
                  │  E2E Tests    │  ~10 tests
                  │   (10%)       │
                  └───────────────┘
                 ┌─────────────────┐
                 │Integration Tests│  ~30 tests
                 │     (30%)       │
                 └─────────────────┘
              ┌──────────────────────┐
              │    Unit Tests        │  ~100 tests
              │       (60%)          │
              └──────────────────────┘
```

### Coverage Targets

- **Overall:** > 80%
- **Service Layer:** > 90%
- **API Routes:** > 85%
- **Utilities:** 100%
- **UI Components:** > 70%

## Unit Tests

### 1. ISBN Validator Tests

**File:** `src/test/lib/validators/isbn.test.ts`

```typescript
describe('ISBN Validator', () => {
  describe('validateISBN13', () => {
    test('should accept valid ISBN-13', () => {
      expect(validateISBN13('9780306406157')).toBe(true)
      expect(validateISBN13('978-0-306-40615-7')).toBe(true)
      expect(validateISBN13('978 0 306 40615 7')).toBe(true)
    })

    test('should reject invalid ISBN-13', () => {
      expect(validateISBN13('9780306406158')).toBe(false) // Bad checksum
      expect(validateISBN13('978030640615')).toBe(false) // Too short
      expect(validateISBN13('97803064061577')).toBe(false) // Too long
      expect(validateISBN13('abc0306406157')).toBe(false) // Non-numeric
      expect(validateISBN13('')).toBe(false) // Empty
    })

    test('should handle edge cases', () => {
      expect(validateISBN13('0000000000000')).toBe(true) // Valid checksum
      expect(validateISBN13('9999999999999')).toBe(false) // Invalid checksum
    })
  })

  describe('formatISBN13', () => {
    test('should format ISBN with hyphens', () => {
      expect(formatISBN13('9780306406157'))
        .toBe('978-0-306406-15-7')
    })

    test('should handle already formatted ISBN', () => {
      expect(formatISBN13('978-0-306406-15-7'))
        .toBe('978-0-306406-15-7')
    })
  })

  describe('normalizeISBN', () => {
    test('should remove hyphens and spaces', () => {
      expect(normalizeISBN('978-0-306-40615-7'))
        .toBe('9780306406157')
      expect(normalizeISBN('978 0 306 40615 7'))
        .toBe('9780306406157')
    })
  })

  describe('convertISBN10to13', () => {
    test('should convert valid ISBN-10 to ISBN-13', () => {
      expect(convertISBN10to13('0306406152'))
        .toBe('9780306406157')
    })

    test('should handle ISBN-10 with X checksum', () => {
      expect(convertISBN10to13('043942089X'))
        .toBe('9780439420891')
    })
  })
})
```

**Test Cases:** 20
**Coverage:** 100%

### 2. Title Service Tests

**File:** `src/test/services/titleService.test.ts`

```typescript
describe('TitleService', () => {
  let testSeries: Series

  beforeEach(async () => {
    await cleanDatabase()
    testSeries = await createTestSeries()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  describe('create', () => {
    test('should create title with valid data', async () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
        seriesId: testSeries.id
      }

      const title = await titleService.create(data)

      expect(title.isbn).toBe('9780306406157')
      expect(title.title).toBe('Test Book')
      expect(title.seriesId).toBe(testSeries.id)
    })

    test('should create price history on title creation', async () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50
      }

      const title = await titleService.create(data)
      const history = await titleService.getPriceHistory(title.id)

      expect(history).toHaveLength(1)
      expect(history[0].rrp.toNumber()).toBe(29.99)
      expect(history[0].reason).toBe('Initial price')
    })

    test('should reject invalid ISBN', async () => {
      const data = {
        isbn: '9780306406158', // Invalid checksum
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50
      }

      await expect(titleService.create(data))
        .rejects.toThrow('Invalid ISBN-13 format')
    })

    test('should reject duplicate ISBN', async () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50
      }

      await titleService.create(data)

      await expect(titleService.create(data))
        .rejects.toThrow('already exists')
    })

    test('should normalize ISBN before creating', async () => {
      const data = {
        isbn: '978-0-306-40615-7', // With hyphens
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50
      }

      const title = await titleService.create(data)

      expect(title.isbn).toBe('9780306406157') // Normalized
    })
  })

  describe('update', () => {
    test('should update title fields', async () => {
      const title = await createTestTitle()

      const updated = await titleService.update(title.id, {
        title: 'Updated Title',
        author: 'Updated Author'
      })

      expect(updated.title).toBe('Updated Title')
      expect(updated.author).toBe('Updated Author')
    })

    test('should create price history when price changes', async () => {
      const title = await createTestTitle()

      await titleService.update(title.id, {
        rrp: 34.99,
        priceChangeReason: 'Price increase'
      })

      const history = await titleService.getPriceHistory(title.id)

      expect(history).toHaveLength(2)
      expect(history[0].rrp.toNumber()).toBe(34.99)
      expect(history[0].reason).toBe('Price increase')
      expect(history[1].effectiveTo).not.toBeNull()
    })

    test('should not create price history when price unchanged', async () => {
      const title = await createTestTitle()

      await titleService.update(title.id, {
        title: 'Updated Title'
      })

      const history = await titleService.getPriceHistory(title.id)

      expect(history).toHaveLength(1) // Only initial
    })

    test('should reject duplicate ISBN on update', async () => {
      const title1 = await createTestTitle({ isbn: '9780306406157' })
      const title2 = await createTestTitle({ isbn: '9780306406164' })

      await expect(
        titleService.update(title2.id, { isbn: '9780306406157' })
      ).rejects.toThrow('already exists')
    })

    test('should handle not found', async () => {
      await expect(
        titleService.update(999, { title: 'New Title' })
      ).rejects.toThrow('not found')
    })
  })

  describe('findById', () => {
    test('should return title with relationships', async () => {
      const title = await createTestTitle({ seriesId: testSeries.id })

      const found = await titleService.findById(title.id)

      expect(found.id).toBe(title.id)
      expect(found.series).toBeDefined()
      expect(found.series?.id).toBe(testSeries.id)
      expect(found.priceHistory).toBeDefined()
    })

    test('should throw error if not found', async () => {
      await expect(titleService.findById(999))
        .rejects.toThrow('not found')
    })
  })

  describe('findByISBN', () => {
    test('should find title by ISBN', async () => {
      const title = await createTestTitle({ isbn: '9780306406157' })

      const found = await titleService.findByISBN('9780306406157')

      expect(found?.id).toBe(title.id)
    })

    test('should normalize ISBN before searching', async () => {
      const title = await createTestTitle({ isbn: '9780306406157' })

      const found = await titleService.findByISBN('978-0-306-40615-7')

      expect(found?.id).toBe(title.id)
    })

    test('should return null if not found', async () => {
      const found = await titleService.findByISBN('9780306406164')

      expect(found).toBeNull()
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Create test titles
      await createTestTitle({ title: 'Alpha Book', format: Format.PAPERBACK })
      await createTestTitle({ title: 'Beta Book', format: Format.HARDCOVER })
      await createTestTitle({ title: 'Gamma Book', format: Format.PAPERBACK })
    })

    test('should return paginated list', async () => {
      const result = await titleService.list({
        page: 1,
        limit: 2
      })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(3)
      expect(result.pagination.totalPages).toBe(2)
    })

    test('should search by title', async () => {
      const result = await titleService.list({
        search: 'Alpha'
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('Alpha Book')
    })

    test('should filter by format', async () => {
      const result = await titleService.list({
        format: Format.PAPERBACK
      })

      expect(result.data).toHaveLength(2)
      expect(result.data.every(t => t.format === Format.PAPERBACK)).toBe(true)
    })

    test('should sort by title ascending', async () => {
      const result = await titleService.list({
        sortBy: 'title',
        sortOrder: 'asc'
      })

      expect(result.data[0].title).toBe('Alpha Book')
      expect(result.data[1].title).toBe('Beta Book')
    })

    test('should sort by title descending', async () => {
      const result = await titleService.list({
        sortBy: 'title',
        sortOrder: 'desc'
      })

      expect(result.data[0].title).toBe('Gamma Book')
    })

    test('should filter by series', async () => {
      await createTestTitle({ seriesId: testSeries.id, title: 'Series Book' })

      const result = await titleService.list({
        seriesId: testSeries.id
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].seriesId).toBe(testSeries.id)
    })
  })

  describe('delete', () => {
    test('should delete title without inventory', async () => {
      const title = await createTestTitle()

      await titleService.delete(title.id)

      const found = await prisma.title.findUnique({
        where: { id: title.id }
      })

      expect(found).toBeNull()
    })

    test('should fail to delete title with inventory', async () => {
      const title = await createTestTitle()
      await createTestInventory(title.id, 100)

      await expect(titleService.delete(title.id))
        .rejects.toThrow('has existing inventory')
    })

    test('should cascade delete price history', async () => {
      const title = await createTestTitle()
      await titleService.update(title.id, { rrp: 34.99 })

      await titleService.delete(title.id)

      const history = await prisma.priceHistory.findMany({
        where: { titleId: title.id }
      })

      expect(history).toHaveLength(0)
    })
  })

  describe('bulkImport', () => {
    test('should import valid titles', async () => {
      const titles = [
        {
          isbn: '9780306406157',
          title: 'Book 1',
          author: 'Author 1',
          format: Format.PAPERBACK,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: '9780306406164',
          title: 'Book 2',
          author: 'Author 2',
          format: Format.HARDCOVER,
          rrp: 39.99,
          unitCost: 12.00
        }
      ]

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
    })

    test('should report errors for invalid titles', async () => {
      const titles = [
        {
          isbn: '9780306406157',
          title: 'Valid Book',
          author: 'Author',
          format: Format.PAPERBACK,
          rrp: 29.99,
          unitCost: 8.50
        },
        {
          isbn: '9780306406158', // Invalid checksum
          title: 'Invalid Book',
          author: 'Author',
          format: Format.PAPERBACK,
          rrp: 29.99,
          unitCost: 8.50
        }
      ]

      const result = await titleService.bulkImport(titles)

      expect(result.success).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].isbn).toBe('9780306406158')
    })
  })

  describe('bulkUpdatePrices', () => {
    test('should update prices for multiple titles', async () => {
      const title1 = await createTestTitle()
      const title2 = await createTestTitle()

      const updates = [
        { id: title1.id, rrp: 34.99 },
        { id: title2.id, rrp: 44.99 }
      ]

      const results = await titleService.bulkUpdatePrices(
        updates,
        'Bulk price update'
      )

      expect(results.filter(r => r.success)).toHaveLength(2)

      const history1 = await titleService.getPriceHistory(title1.id)
      expect(history1).toHaveLength(2)
      expect(history1[0].reason).toBe('Bulk price update')
    })
  })
})
```

**Test Cases:** 35
**Coverage Target:** > 90%

### 3. Zod Schema Tests

**File:** `src/test/lib/validators/title.test.ts`

```typescript
describe('Title Validation Schemas', () => {
  describe('CreateTitleSchema', () => {
    test('should accept valid title data', () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50
      }

      const result = CreateTitleSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    test('should reject missing required fields', () => {
      const data = {
        isbn: '9780306406157',
        // Missing title, author, format, rrp, unitCost
      }

      const result = CreateTitleSchema.safeParse(data)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    test('should reject invalid ISBN format', () => {
      const data = {
        isbn: 'invalid',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50
      }

      const result = CreateTitleSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    test('should reject negative prices', () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: -10,
        unitCost: 8.50
      }

      const result = CreateTitleSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    test('should accept optional fields', () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
        publisher: 'Test Publisher',
        pageCount: 350,
        category: 'Technology'
      }

      const result = CreateTitleSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    test('should validate dimensions format', () => {
      const validData = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
        dimensions: '229x152x19'
      }

      expect(CreateTitleSchema.safeParse(validData).success).toBe(true)

      const invalidData = {
        ...validData,
        dimensions: '229-152-19'
      }

      expect(CreateTitleSchema.safeParse(invalidData).success).toBe(false)
    })

    test('should validate percentage fields', () => {
      const validData = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: Format.PAPERBACK,
        rrp: 29.99,
        unitCost: 8.50,
        tradeDiscount: 40.0,
        royaltyRate: 10.0
      }

      expect(CreateTitleSchema.safeParse(validData).success).toBe(true)

      const invalidData = {
        ...validData,
        tradeDiscount: 150
      }

      expect(CreateTitleSchema.safeParse(invalidData).success).toBe(false)
    })
  })

  describe('UpdateTitleSchema', () => {
    test('should accept partial updates', () => {
      const data = {
        rrp: 34.99
      }

      const result = UpdateTitleSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    test('should accept empty updates', () => {
      const data = {}

      const result = UpdateTitleSchema.safeParse(data)

      expect(result.success).toBe(true)
    })
  })

  describe('BulkImportSchema', () => {
    test('should accept array of titles', () => {
      const data = {
        titles: [
          {
            isbn: '9780306406157',
            title: 'Book 1',
            author: 'Author 1',
            format: Format.PAPERBACK,
            rrp: 29.99,
            unitCost: 8.50
          }
        ]
      }

      const result = BulkImportSchema.safeParse(data)

      expect(result.success).toBe(true)
    })

    test('should reject empty array', () => {
      const data = {
        titles: []
      }

      const result = BulkImportSchema.safeParse(data)

      expect(result.success).toBe(false)
    })

    test('should reject arrays exceeding 1000 items', () => {
      const data = {
        titles: Array(1001).fill({
          isbn: '9780306406157',
          title: 'Book',
          author: 'Author',
          format: Format.PAPERBACK,
          rrp: 29.99,
          unitCost: 8.50
        })
      }

      const result = BulkImportSchema.safeParse(data)

      expect(result.success).toBe(false)
    })
  })
})
```

**Test Cases:** 15
**Coverage Target:** 100%

## Integration Tests

### 4. API Route Tests

**File:** `src/test/api/titles.test.ts`

```typescript
describe('Title API Routes', () => {
  let adminUser: User
  let readOnlyUser: User

  beforeEach(async () => {
    await cleanDatabase()
    adminUser = await createTestUser({ role: 'admin' })
    readOnlyUser = await createTestUser({ role: 'read_only_user' })
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  describe('GET /api/titles', () => {
    test('should return paginated titles', async () => {
      await createMultipleTestTitles(25)

      const response = await authenticatedRequest(adminUser)
        .get('/api/titles?page=1&limit=20')

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveLength(20)
      expect(response.body.pagination.total).toBe(25)
    })

    test('should search titles', async () => {
      await createTestTitle({ title: 'React Guide' })
      await createTestTitle({ title: 'Vue Guide' })

      const response = await authenticatedRequest(adminUser)
        .get('/api/titles?search=React')

      expect(response.status).toBe(200)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].title).toBe('React Guide')
    })

    test('should require authentication', async () => {
      const response = await request(app).get('/api/titles')

      expect(response.status).toBe(401)
    })

    test('should allow read permission', async () => {
      const response = await authenticatedRequest(readOnlyUser)
        .get('/api/titles')

      expect(response.status).toBe(200)
    })
  })

  describe('POST /api/titles', () => {
    test('should create title', async () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 29.99,
        unitCost: 8.50
      }

      const response = await authenticatedRequest(adminUser)
        .post('/api/titles')
        .send(data)

      expect(response.status).toBe(201)
      expect(response.body.isbn).toBe('9780306406157')
    })

    test('should reject invalid data', async () => {
      const data = {
        isbn: 'invalid',
        // Missing required fields
      }

      const response = await authenticatedRequest(adminUser)
        .post('/api/titles')
        .send(data)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid input')
    })

    test('should reject duplicate ISBN', async () => {
      await createTestTitle({ isbn: '9780306406157' })

      const data = {
        isbn: '9780306406157',
        title: 'Duplicate Book',
        author: 'Author',
        format: 'PAPERBACK',
        rrp: 29.99,
        unitCost: 8.50
      }

      const response = await authenticatedRequest(adminUser)
        .post('/api/titles')
        .send(data)

      expect(response.status).toBe(409)
    })

    test('should require create permission', async () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 29.99,
        unitCost: 8.50
      }

      const response = await authenticatedRequest(readOnlyUser)
        .post('/api/titles')
        .send(data)

      expect(response.status).toBe(403)
    })

    test('should create audit log', async () => {
      const data = {
        isbn: '9780306406157',
        title: 'Test Book',
        author: 'Test Author',
        format: 'PAPERBACK',
        rrp: 29.99,
        unitCost: 8.50
      }

      await authenticatedRequest(adminUser)
        .post('/api/titles')
        .send(data)

      const auditLogs = await prisma.auditLog.findMany({
        where: { action: 'title:create' }
      })

      expect(auditLogs).toHaveLength(1)
    })
  })

  describe('GET /api/titles/[id]', () => {
    test('should return title with relationships', async () => {
      const title = await createTestTitle()

      const response = await authenticatedRequest(adminUser)
        .get(`/api/titles/${title.id}`)

      expect(response.status).toBe(200)
      expect(response.body.id).toBe(title.id)
      expect(response.body.priceHistory).toBeDefined()
    })

    test('should return 404 for non-existent title', async () => {
      const response = await authenticatedRequest(adminUser)
        .get('/api/titles/999')

      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/titles/[id]', () => {
    test('should update title', async () => {
      const title = await createTestTitle()

      const response = await authenticatedRequest(adminUser)
        .put(`/api/titles/${title.id}`)
        .send({ title: 'Updated Title' })

      expect(response.status).toBe(200)
      expect(response.body.title).toBe('Updated Title')
    })

    test('should create price history on price change', async () => {
      const title = await createTestTitle()

      await authenticatedRequest(adminUser)
        .put(`/api/titles/${title.id}`)
        .send({
          rrp: 34.99,
          priceChangeReason: 'Price increase'
        })

      const history = await prisma.priceHistory.findMany({
        where: { titleId: title.id }
      })

      expect(history).toHaveLength(2)
    })

    test('should require update permission', async () => {
      const title = await createTestTitle()

      const response = await authenticatedRequest(readOnlyUser)
        .put(`/api/titles/${title.id}`)
        .send({ title: 'Updated' })

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/titles/[id]', () => {
    test('should delete title without inventory', async () => {
      const title = await createTestTitle()

      const response = await authenticatedRequest(adminUser)
        .delete(`/api/titles/${title.id}`)

      expect(response.status).toBe(200)

      const found = await prisma.title.findUnique({
        where: { id: title.id }
      })

      expect(found).toBeNull()
    })

    test('should fail to delete title with inventory', async () => {
      const title = await createTestTitle()
      await createTestInventory(title.id, 100)

      const response = await authenticatedRequest(adminUser)
        .delete(`/api/titles/${title.id}`)

      expect(response.status).toBe(409)
    })

    test('should require delete permission', async () => {
      const title = await createTestTitle()

      const response = await authenticatedRequest(readOnlyUser)
        .delete(`/api/titles/${title.id}`)

      expect(response.status).toBe(403)
    })
  })

  describe('POST /api/titles/bulk-import', () => {
    test('should import multiple titles', async () => {
      const data = {
        titles: [
          {
            isbn: '9780306406157',
            title: 'Book 1',
            author: 'Author 1',
            format: 'PAPERBACK',
            rrp: 29.99,
            unitCost: 8.50
          },
          {
            isbn: '9780306406164',
            title: 'Book 2',
            author: 'Author 2',
            format: 'HARDCOVER',
            rrp: 39.99,
            unitCost: 12.00
          }
        ]
      }

      const response = await authenticatedRequest(adminUser)
        .post('/api/titles/bulk-import')
        .send(data)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(2)
      expect(response.body.failed).toBe(0)
    })

    test('should report errors', async () => {
      const data = {
        titles: [
          {
            isbn: '9780306406157',
            title: 'Valid Book',
            author: 'Author',
            format: 'PAPERBACK',
            rrp: 29.99,
            unitCost: 8.50
          },
          {
            isbn: '9780306406158', // Invalid
            title: 'Invalid Book',
            author: 'Author',
            format: 'PAPERBACK',
            rrp: 29.99,
            unitCost: 8.50
          }
        ]
      }

      const response = await authenticatedRequest(adminUser)
        .post('/api/titles/bulk-import')
        .send(data)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(1)
      expect(response.body.failed).toBe(1)
      expect(response.body.errors).toHaveLength(1)
    })
  })
})
```

**Test Cases:** 22
**Coverage Target:** > 85%

## End-to-End Tests

### 5. Title Management E2E Tests

**File:** `src/test/e2e/title-management.test.ts`

```typescript
describe('Title Management E2E', () => {
  beforeEach(async () => {
    await resetTestDatabase()
    await seedTestData()
  })

  test('complete title creation flow', async () => {
    // 1. Navigate to titles page
    await page.goto('/titles')
    await expect(page.locator('h1')).toContainText('Titles')

    // 2. Click create button
    await page.click('button:has-text("Create Title")')

    // 3. Fill form
    await page.fill('[name="isbn"]', '978-0-306-40615-7')
    await page.fill('[name="title"]', 'Test Book')
    await page.fill('[name="author"]', 'Test Author')
    await page.selectOption('[name="format"]', 'PAPERBACK')
    await page.fill('[name="rrp"]', '29.99')
    await page.fill('[name="unitCost"]', '8.50')

    // 4. Submit
    await page.click('button[type="submit"]')

    // 5. Verify redirect to detail page
    await expect(page).toHaveURL(/\/titles\/\d+/)
    await expect(page.locator('h1')).toContainText('Test Book')

    // 6. Verify data displayed
    await expect(page.locator('text=978-0-306-40615-7')).toBeVisible()
    await expect(page.locator('text=£29.99')).toBeVisible()
  })

  test('search and filter flow', async () => {
    // 1. Navigate to titles
    await page.goto('/titles')

    // 2. Enter search term
    await page.fill('[placeholder="Search titles..."]', 'React')
    await page.waitForTimeout(500) // Debounce

    // 3. Verify filtered results
    await expect(page.locator('table tbody tr')).toHaveCount(2)

    // 4. Apply format filter
    await page.selectOption('[name="format"]', 'PAPERBACK')

    // 5. Verify further filtered
    await expect(page.locator('table tbody tr')).toHaveCount(1)

    // 6. Clear filters
    await page.click('button:has-text("Clear")')

    // 7. Verify all titles shown
    await expect(page.locator('table tbody tr')).toHaveCount(10)
  })

  test('edit title with price change flow', async () => {
    // 1. Navigate to title detail
    await page.goto('/titles/1')

    // 2. Click edit
    await page.click('button:has-text("Edit")')

    // 3. Change price
    await page.fill('[name="rrp"]', '34.99')
    await page.fill('[name="priceChangeReason"]', 'Price increase')

    // 4. Submit
    await page.click('button[type="submit"]')

    // 5. Verify updated
    await expect(page).toHaveURL('/titles/1')
    await expect(page.locator('text=£34.99')).toBeVisible()

    // 6. Check price history
    await page.click('text=Price History')
    await expect(page.locator('text=Price increase')).toBeVisible()
    await expect(page.locator('table:has-text("Price History") tbody tr'))
      .toHaveCount(2)
  })

  test('bulk import flow', async () => {
    // 1. Navigate to import page
    await page.goto('/titles/import')

    // 2. Upload CSV
    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles('./test-data/titles.csv')

    // 3. Verify preview
    await expect(page.locator('text=10 titles found')).toBeVisible()

    // 4. Click import
    await page.click('button:has-text("Import")')

    // 5. Wait for completion
    await expect(page.locator('text=Import complete')).toBeVisible()

    // 6. Verify results
    await expect(page.locator('text=Success: 8')).toBeVisible()
    await expect(page.locator('text=Failed: 2')).toBeVisible()

    // 7. Check error details
    await page.click('text=View Errors')
    await expect(page.locator('table tbody tr')).toHaveCount(2)
  })

  test('delete validation flow', async () => {
    // 1. Navigate to title with inventory
    await page.goto('/titles/1')

    // 2. Click delete
    await page.click('button:has-text("Delete")')

    // 3. Confirm deletion
    await page.click('button:has-text("Confirm")')

    // 4. Verify error message
    await expect(page.locator('text=Cannot delete title with inventory'))
      .toBeVisible()

    // 5. Verify still on detail page
    await expect(page).toHaveURL('/titles/1')

    // 6. Navigate to title without inventory
    await page.goto('/titles/99')

    // 7. Delete successfully
    await page.click('button:has-text("Delete")')
    await page.click('button:has-text("Confirm")')

    // 8. Verify redirect to list
    await expect(page).toHaveURL('/titles')
    await expect(page.locator('text=Title deleted successfully')).toBeVisible()
  })

  test('pagination flow', async () => {
    // 1. Navigate to titles
    await page.goto('/titles')

    // 2. Verify page 1
    await expect(page.locator('[aria-label="Current page"]')).toHaveText('1')

    // 3. Click next page
    await page.click('button:has-text("Next")')

    // 4. Verify page 2
    await expect(page.locator('[aria-label="Current page"]')).toHaveText('2')
    await expect(page).toHaveURL(/page=2/)

    // 5. Click specific page
    await page.click('button:has-text("5")')

    // 6. Verify page 5
    await expect(page).toHaveURL(/page=5/)
  })
})
```

**Test Cases:** 6
**Coverage:** Core user journeys

## Performance Tests

### 6. Title API Performance Tests

**File:** `src/test/performance/title-api.test.ts`

```typescript
describe('Title API Performance', () => {
  beforeAll(async () => {
    await cleanDatabase()
    await createMultipleTestTitles(500)
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  test('GET /api/titles should respond in < 500ms', async () => {
    const start = Date.now()

    await authenticatedRequest(adminUser).get('/api/titles?page=1&limit=20')

    const duration = Date.now() - start
    expect(duration).toBeLessThan(500)
  })

  test('GET /api/titles/[id] should respond in < 100ms', async () => {
    const title = await createTestTitle()

    const start = Date.now()

    await authenticatedRequest(adminUser).get(`/api/titles/${title.id}`)

    const duration = Date.now() - start
    expect(duration).toBeLessThan(100)
  })

  test('search should respond in < 500ms', async () => {
    const start = Date.now()

    await authenticatedRequest(adminUser)
      .get('/api/titles?search=React')

    const duration = Date.now() - start
    expect(duration).toBeLessThan(500)
  })

  test('bulk import 100 titles should complete in < 5s', async () => {
    const titles = generateTestTitles(100)

    const start = Date.now()

    await authenticatedRequest(adminUser)
      .post('/api/titles/bulk-import')
      .send({ titles })

    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000)
  })
})
```

**Test Cases:** 4
**Targets:** < 500ms API, < 5s bulk operations

## Test Coverage Requirements

### Coverage by Layer

| Layer | Target | Rationale |
|-------|--------|-----------|
| ISBN Utilities | 100% | Critical validation logic |
| Title Service | > 90% | Core business logic |
| Zod Schemas | 100% | Input validation |
| API Routes | > 85% | Entry points |
| UI Components | > 70% | User interface |
| E2E Tests | Core Flows | User journeys |

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm test -- --testPathPattern=unit

# Integration tests only
npm test -- --testPathPattern=integration

# E2E tests only
npm test -- --testPathPattern=e2e

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### CI/CD Integration

**Pre-merge Requirements:**
- All tests pass (100%)
- Code coverage > 80%
- No TypeScript errors
- No ESLint errors
- Performance tests pass

**Test Execution Order:**
1. Unit tests (fastest)
2. Integration tests
3. E2E tests (slowest)
4. Performance tests

## Test Data Management

### Test Database

- Separate test database: `bookstock_test`
- Clean before each test suite
- Seed minimal required data
- Use factories for test data creation

### Test Factories

```typescript
// Test data factories
export async function createTestTitle(overrides = {}) {
  return await prisma.title.create({
    data: {
      isbn: generateUniqueISBN(),
      title: 'Test Book',
      author: 'Test Author',
      format: Format.PAPERBACK,
      rrp: 29.99,
      unitCost: 8.50,
      ...overrides
    }
  })
}

export async function createTestSeries(overrides = {}) {
  return await prisma.series.create({
    data: {
      name: 'Test Series',
      ...overrides
    }
  })
}

export async function createTestInventory(
  titleId: number,
  quantity: number,
  warehouseId: number = 1
) {
  return await prisma.inventory.create({
    data: {
      titleId,
      warehouseId,
      currentStock: quantity
    }
  })
}
```

## Continuous Testing

### During Development
- Run unit tests on file save (watch mode)
- Run integration tests before commit
- Run E2E tests before PR

### In CI/CD
- Run full test suite on PR
- Block merge if tests fail
- Generate coverage report
- Performance regression detection

## Conclusion

This comprehensive test specification ensures the Title Management System is robust, reliable, and performs well under various conditions. The test pyramid approach provides fast feedback during development while ensuring confidence in production deployments.
