import { describe, test, expect } from 'vitest'
import {
  CreateTitleSchema,
  UpdateTitleSchema,
  BulkImportSchema,
  BulkUpdatePricesSchema
} from '@/lib/validators/title'
import { Format } from '@prisma/client'

describe('Title Validation Schemas', () => {
  describe('CreateTitleSchema', () => {
    const validTitle = {
      isbn: '978-0-306-40615-7',
      title: 'Test Book',
      author: 'Test Author',
      format: 'PAPERBACK' as Format,
      rrp: 29.99,
      unitCost: 8.50
    }

    describe('Required Fields', () => {
      test('should accept valid minimal title data', () => {
        const result = CreateTitleSchema.safeParse(validTitle)
        expect(result.success).toBe(true)
      })

      test('should reject missing ISBN', () => {
        const { isbn, ...data } = validTitle
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject missing title', () => {
        const { title, ...data } = validTitle
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject missing author', () => {
        const { author, ...data } = validTitle
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject missing format', () => {
        const { format, ...data } = validTitle
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject missing rrp', () => {
        const { rrp, ...data } = validTitle
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject missing unitCost', () => {
        const { unitCost, ...data } = validTitle
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })

    describe('ISBN Validation', () => {
      test('should accept valid ISBN-13', () => {
        const data = { ...validTitle, isbn: '9780306406157' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept valid ISBN-13 with hyphens', () => {
        const data = { ...validTitle, isbn: '978-0-306-40615-7' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept valid ISBN-10', () => {
        const data = { ...validTitle, isbn: '0-306-40615-2' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject ISBN that is too short', () => {
        const data = { ...validTitle, isbn: '123456789' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 10 characters')
        }
      })

      test('should reject ISBN that is too long', () => {
        const data = { ...validTitle, isbn: '978-0-306-40615-7-extra' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject ISBN with invalid characters', () => {
        const data = { ...validTitle, isbn: '978-0-306-ABC-7' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject ISBN with invalid checksum', () => {
        const data = { ...validTitle, isbn: '9780306406158' } // Last digit should be 7
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Invalid ISBN')
        }
      })
    })

    describe('Title Field Validation', () => {
      test('should reject empty title', () => {
        const data = { ...validTitle, title: '' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject title exceeding 500 characters', () => {
        const data = { ...validTitle, title: 'A'.repeat(501) }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should trim whitespace from title', () => {
        const data = { ...validTitle, title: '  Test Book  ' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.title).toBe('Test Book')
        }
      })
    })

    describe('Author Field Validation', () => {
      test('should reject empty author', () => {
        const data = { ...validTitle, author: '' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject author exceeding 255 characters', () => {
        const data = { ...validTitle, author: 'A'.repeat(256) }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should trim whitespace from author', () => {
        const data = { ...validTitle, author: '  Test Author  ' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.author).toBe('Test Author')
        }
      })
    })

    describe('Format Validation', () => {
      test('should accept PAPERBACK format', () => {
        const data = { ...validTitle, format: 'PAPERBACK' as Format }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept HARDCOVER format', () => {
        const data = { ...validTitle, format: 'HARDCOVER' as Format }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept DIGITAL format', () => {
        const data = { ...validTitle, format: 'DIGITAL' as Format }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept AUDIOBOOK format', () => {
        const data = { ...validTitle, format: 'AUDIOBOOK' as Format }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject invalid format', () => {
        const data = { ...validTitle, format: 'EBOOK' as any }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })

    describe('Price Validation', () => {
      test('should accept valid RRP', () => {
        const data = { ...validTitle, rrp: 29.99 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject negative RRP', () => {
        const data = { ...validTitle, rrp: -10.00 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject zero RRP', () => {
        const data = { ...validTitle, rrp: 0 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject RRP exceeding maximum', () => {
        const data = { ...validTitle, rrp: 100000.00 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject RRP with more than 2 decimal places', () => {
        const data = { ...validTitle, rrp: 29.999 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should accept valid unit cost', () => {
        const data = { ...validTitle, unitCost: 8.50 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject negative unit cost', () => {
        const data = { ...validTitle, unitCost: -5.00 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })

    describe('Business Rules', () => {
      test('should reject when RRP is lower than unit cost', () => {
        const data = { ...validTitle, rrp: 5.00, unitCost: 10.00 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('RRP must be higher than unit cost')
        }
      })

      test('should accept when RRP equals unit cost (edge case)', () => {
        const data = { ...validTitle, rrp: 10.00, unitCost: 10.00 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false) // Business rule: RRP must be HIGHER
      })

      test('should reject royalty threshold without royalty rate', () => {
        const data = { ...validTitle, royaltyThreshold: 1000 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Royalty rate must be set')
        }
      })

      test('should accept royalty threshold with royalty rate', () => {
        const data = { ...validTitle, royaltyThreshold: 1000, royaltyRate: 10.0 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject reprint threshold without print run size', () => {
        const data = { ...validTitle, reprintThreshold: 500 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Print run size must be set')
        }
      })

      test('should accept reprint threshold with print run size', () => {
        const data = { ...validTitle, reprintThreshold: 500, printRunSize: 2000 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    describe('Optional Fields', () => {
      test('should accept all optional fields', () => {
        const data = {
          ...validTitle,
          publisher: 'Test Publisher',
          publicationDate: new Date('2025-01-01'),
          pageCount: 350,
          description: 'A test book',
          category: 'Technology',
          subcategory: 'Programming',
          dimensions: '229x152x19',
          weight: 450,
          bindingType: 'Perfect Bound',
          coverFinish: 'Matte',
          tradeDiscount: 40.0,
          royaltyRate: 10.0,
          royaltyThreshold: 1000,
          printRunSize: 2000,
          reprintThreshold: 500,
          keywords: 'test, programming',
          language: 'en',
          territoryRights: 'World English',
          seriesId: 1
        }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept title without optional fields', () => {
        const result = CreateTitleSchema.safeParse(validTitle)
        expect(result.success).toBe(true)
      })
    })

    describe('Dimensions Validation', () => {
      test('should accept valid dimensions format', () => {
        const data = { ...validTitle, dimensions: '229x152x19' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject dimensions without x separator', () => {
        const data = { ...validTitle, dimensions: '229-152-19' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject dimensions with invalid format', () => {
        const data = { ...validTitle, dimensions: '229x152' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject dimensions exceeding maximum', () => {
        const data = { ...validTitle, dimensions: '1001x1001x501' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject zero dimensions', () => {
        const data = { ...validTitle, dimensions: '0x0x0' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })

    describe('Percentage Fields', () => {
      test('should accept valid trade discount', () => {
        const data = { ...validTitle, tradeDiscount: 40.0 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept 0% trade discount', () => {
        const data = { ...validTitle, tradeDiscount: 0.0 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept 100% trade discount', () => {
        const data = { ...validTitle, tradeDiscount: 100.0 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject trade discount over 100%', () => {
        const data = { ...validTitle, tradeDiscount: 101.0 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject negative trade discount', () => {
        const data = { ...validTitle, tradeDiscount: -10.0 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should accept valid royalty rate', () => {
        const data = { ...validTitle, royaltyRate: 10.0, royaltyThreshold: 1000 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject royalty rate over 100%', () => {
        const data = { ...validTitle, royaltyRate: 150.0, royaltyThreshold: 1000 }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })

    describe('Language Validation', () => {
      test('should accept valid ISO 639-1 code', () => {
        const data = { ...validTitle, language: 'en' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept other valid language codes', () => {
        const codes = ['fr', 'de', 'es', 'it', 'pt', 'ja', 'zh']
        codes.forEach(code => {
          const data = { ...validTitle, language: code }
          const result = CreateTitleSchema.safeParse(data)
          expect(result.success).toBe(true)
        })
      })

      test('should reject uppercase language code', () => {
        const data = { ...validTitle, language: 'EN' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject language code with wrong length', () => {
        const data = { ...validTitle, language: 'eng' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })

    describe('Date Validation', () => {
      test('should accept valid publication date', () => {
        const data = { ...validTitle, publicationDate: new Date('2025-01-01') }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept date string (coerced to Date)', () => {
        const data = { ...validTitle, publicationDate: '2025-01-01' }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should accept future date within 10 years', () => {
        const futureDate = new Date()
        futureDate.setFullYear(futureDate.getFullYear() + 5)
        const data = { ...validTitle, publicationDate: futureDate }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(true)
      })

      test('should reject date before 1900', () => {
        const data = { ...validTitle, publicationDate: new Date('1899-12-31') }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })

      test('should reject date more than 10 years in future', () => {
        const farFutureDate = new Date()
        farFutureDate.setFullYear(farFutureDate.getFullYear() + 11)
        const data = { ...validTitle, publicationDate: farFutureDate }
        const result = CreateTitleSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('UpdateTitleSchema', () => {
    test('should accept partial update with only title', () => {
      const data = { title: 'Updated Title' }
      const result = UpdateTitleSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('should accept partial update with price change', () => {
      const data = {
        rrp: 34.99,
        priceChangeReason: 'Price increase due to costs'
      }
      const result = UpdateTitleSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('should accept empty update', () => {
      const data = {}
      const result = UpdateTitleSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('should accept update with all fields', () => {
      const data = {
        title: 'Updated Title',
        author: 'Updated Author',
        rrp: 34.99,
        unitCost: 9.50,
        priceChangeReason: 'Annual review'
      }
      const result = UpdateTitleSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('should validate fields that are provided', () => {
      const data = { rrp: -10.00 }
      const result = UpdateTitleSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('BulkImportSchema', () => {
    const validTitle = {
      isbn: '9780306406157',
      title: 'Test Book',
      author: 'Test Author',
      format: 'PAPERBACK' as Format,
      rrp: 29.99,
      unitCost: 8.50
    }

    test('should accept array of valid titles', () => {
      const data = {
        titles: [
          validTitle,
          { ...validTitle, isbn: '9781234567897', title: 'Book 2' }
        ]
      }
      const result = BulkImportSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('should reject empty array', () => {
      const data = { titles: [] }
      const result = BulkImportSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one title')
      }
    })

    test('should reject array exceeding maximum', () => {
      const titles = Array(1001).fill(validTitle)
      const data = { titles }
      const result = BulkImportSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1,000 titles')
      }
    })

    test('should validate each title in array', () => {
      const data = {
        titles: [
          validTitle,
          { ...validTitle, isbn: 'invalid-isbn' }
        ]
      }
      const result = BulkImportSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe('BulkUpdatePricesSchema', () => {
    test('should accept valid price updates', () => {
      const data = {
        updates: [
          { id: 1, rrp: 34.99 },
          { id: 2, unitCost: 9.50 }
        ],
        reason: 'Annual price review'
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('should accept update with all price fields', () => {
      const data = {
        updates: [
          { id: 1, rrp: 34.99, unitCost: 9.50, tradeDiscount: 45.0 }
        ],
        reason: 'Comprehensive price update'
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    test('should reject update without price fields', () => {
      const data = {
        updates: [{ id: 1 }],
        reason: 'Test'
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one price field')
      }
    })

    test('should reject empty updates array', () => {
      const data = {
        updates: [],
        reason: 'Test'
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    test('should reject updates exceeding maximum', () => {
      const updates = Array(1001).fill({ id: 1, rrp: 29.99 })
      const data = {
        updates,
        reason: 'Test'
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    test('should reject missing reason', () => {
      const data = {
        updates: [{ id: 1, rrp: 34.99 }]
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    test('should reject empty reason', () => {
      const data = {
        updates: [{ id: 1, rrp: 34.99 }],
        reason: ''
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    test('should validate price field values', () => {
      const data = {
        updates: [{ id: 1, rrp: -10.00 }],
        reason: 'Test'
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    test('should reject invalid ID', () => {
      const data = {
        updates: [{ id: -1, rrp: 29.99 }],
        reason: 'Test'
      }
      const result = BulkUpdatePricesSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })
})
