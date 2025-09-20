import { describe, test, expect, beforeEach, afterAll } from 'vitest'
import { testDb, cleanDatabase, disconnectTestDb, createTestTitle } from '../utils/test-db'

// ISBN validation utility functions
function isValidISBNFormat(isbn: string): boolean {
  if (!isbn || typeof isbn !== 'string') return false

  // Remove any dashes or spaces for validation
  const cleanISBN = isbn.replace(/[-\s]/g, '')

  // Check length first (10 for ISBN-10, 13 for ISBN-13)
  if (cleanISBN.length !== 10 && cleanISBN.length !== 13) return false

  // For ISBN-10, allow digits 0-9 and X in last position
  if (cleanISBN.length === 10) {
    const digits = cleanISBN.slice(0, 9)
    const checkDigit = cleanISBN[9].toUpperCase()
    return /^\d{9}$/.test(digits) && (/^\d$/.test(checkDigit) || checkDigit === 'X')
  }

  // For ISBN-13, check if it's all digits
  if (cleanISBN.length === 13) {
    return /^\d{13}$/.test(cleanISBN)
  }

  return false
}

function calculateISBN10Checksum(isbn: string): string {
  const digits = isbn.slice(0, 9)
  let sum = 0

  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }

  const remainder = sum % 11
  const checkDigit = remainder === 0 ? '0' : remainder === 1 ? 'X' : (11 - remainder).toString()

  return checkDigit
}

function calculateISBN13Checksum(isbn: string): string {
  const digits = isbn.slice(0, 12)
  let sum = 0

  for (let i = 0; i < 12; i++) {
    const weight = i % 2 === 0 ? 1 : 3
    sum += parseInt(digits[i]) * weight
  }

  const remainder = sum % 10
  const checkDigit = remainder === 0 ? '0' : (10 - remainder).toString()

  return checkDigit
}

function isValidISBNChecksum(isbn: string): boolean {
  const cleanISBN = isbn.replace(/[-\s]/g, '')

  if (cleanISBN.length === 10) {
    const providedCheckDigit = cleanISBN[9].toUpperCase()
    const calculatedCheckDigit = calculateISBN10Checksum(cleanISBN)
    return providedCheckDigit === calculatedCheckDigit
  } else if (cleanISBN.length === 13) {
    const providedCheckDigit = cleanISBN[12]
    const calculatedCheckDigit = calculateISBN13Checksum(cleanISBN)
    return providedCheckDigit === calculatedCheckDigit
  }

  return false
}

function normalizeISBN(isbn: string): string {
  // Remove dashes and spaces, convert to uppercase for consistency
  return isbn.replace(/[-\s]/g, '').toUpperCase()
}

describe('ISBN Validation', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectTestDb()
  })

  describe('Format Validation', () => {
    test('should validate ISBN-13 format correctly', () => {
      const validISBN13s = [
        '9781234567890',
        '9780123456789',
        '9789876543210'
      ]

      const invalidISBN13s = [
        '978123456789',    // Too short
        '97812345678901',  // Too long
        '9781234567X90',   // Contains letter X in wrong position
        'abcd1234567890'   // Contains letters
      ]

      validISBN13s.forEach(isbn => {
        expect(isValidISBNFormat(isbn)).toBe(true)
      })

      invalidISBN13s.forEach(isbn => {
        expect(isValidISBNFormat(isbn)).toBe(false)
      })
    })

    test('should validate ISBN-10 format correctly', () => {
      const validISBN10s = [
        '0123456789',
        '1234567890',
        '012345678X'  // X as check digit
      ]

      const invalidISBN10s = [
        '012345678',   // Too short
        '01234567890', // Too long
        '01234X6789',  // X in wrong position
        'abcd567890'   // Contains letters (other than X at end)
      ]

      validISBN10s.forEach(isbn => {
        expect(isValidISBNFormat(isbn)).toBe(true)
      })

      invalidISBN10s.forEach(isbn => {
        expect(isValidISBNFormat(isbn)).toBe(false)
      })
    })

    test('should handle edge cases in format validation', () => {
      const edgeCases = [
        '',              // Empty string
        null,            // Null value
        undefined,       // Undefined value
        123456789012     // Number instead of string
      ]

      edgeCases.forEach(isbn => {
        expect(isValidISBNFormat(isbn as string)).toBe(false)
      })
    })

    test('should handle formatted ISBNs with dashes and spaces', () => {
      const formattedISBNs = [
        '978 123 456 789 0', // With spaces
        '978-123-456-789-0', // With dashes
        '0-123-456-78-9',    // ISBN-10 with dashes
        '0 123 456 78 9'     // ISBN-10 with spaces
      ]

      formattedISBNs.forEach(isbn => {
        expect(isValidISBNFormat(isbn)).toBe(true)
      })
    })
  })

  describe('Checksum Validation', () => {
    test('should validate ISBN-13 checksums correctly', () => {
      const validISBN13s = [
        '9780306406157', // Valid checksum: 7
        '9781234567897', // Valid checksum: 7
        '9780123456786'  // Valid checksum: 6
      ]

      const invalidISBN13s = [
        '9780306406156', // Wrong checksum (should be 7)
        '9781234567896', // Wrong checksum (should be 7)
        '9780123456785'  // Wrong checksum (should be 6)
      ]

      validISBN13s.forEach(isbn => {
        expect(isValidISBNChecksum(isbn)).toBe(true)
      })

      invalidISBN13s.forEach(isbn => {
        expect(isValidISBNChecksum(isbn)).toBe(false)
      })
    })

    test('should validate ISBN-10 checksums correctly', () => {
      const validISBN10s = [
        '0306406152', // Valid checksum: 2
        '123456789X', // Valid checksum: X
        '0123456789'  // Valid checksum: 9
      ]

      const invalidISBN10s = [
        '0306406151', // Wrong checksum (should be 2)
        '1234567890', // Wrong checksum (should be X)
        '0123456788'  // Wrong checksum (should be 9)
      ]

      validISBN10s.forEach(isbn => {
        expect(isValidISBNChecksum(isbn)).toBe(true)
      })

      invalidISBN10s.forEach(isbn => {
        expect(isValidISBNChecksum(isbn)).toBe(false)
      })
    })

    test('should calculate ISBN-13 checksum correctly', () => {
      const testCases = [
        { isbn: '978030640615', expected: '7' },
        { isbn: '978123456789', expected: '7' },
        { isbn: '978012345678', expected: '6' }
      ]

      testCases.forEach(({ isbn, expected }) => {
        expect(calculateISBN13Checksum(isbn)).toBe(expected)
      })
    })

    test('should calculate ISBN-10 checksum correctly', () => {
      const testCases = [
        { isbn: '030640615', expected: '2' },
        { isbn: '123456789', expected: 'X' },
        { isbn: '012345678', expected: '9' }
      ]

      testCases.forEach(({ isbn, expected }) => {
        expect(calculateISBN10Checksum(isbn)).toBe(expected)
      })
    })
  })

  describe('Normalization', () => {
    test('should normalize ISBN formats consistently', () => {
      const testCases = [
        { input: '978-0-306-40615-7', expected: '9780306406157' },
        { input: '978 0 306 40615 7', expected: '9780306406157' },
        { input: '0-306-40615-2', expected: '0306406152' },
        { input: '0 306 40615 2', expected: '0306406152' },
        { input: '123456789x', expected: '123456789X' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(normalizeISBN(input)).toBe(expected)
      })
    })

    test('should handle mixed formatting', () => {
      const input = '978-0 306 40615-7'
      const expected = '9780306406157'
      expect(normalizeISBN(input)).toBe(expected)
    })
  })

  describe('Database Integration', () => {
    test('should store valid ISBN-13 in database', async () => {
      const validISBN = '9780306406157'
      const title = await createTestTitle({ isbn: validISBN })

      expect(title.isbn).toBe(validISBN)
      expect(isValidISBNFormat(title.isbn)).toBe(true)
      expect(isValidISBNChecksum(title.isbn)).toBe(true)
    })

    test('should store valid ISBN-10 in database', async () => {
      const validISBN = '0306406152'
      const title = await createTestTitle({ isbn: validISBN })

      expect(title.isbn).toBe(validISBN)
      expect(isValidISBNFormat(title.isbn)).toBe(true)
      expect(isValidISBNChecksum(title.isbn)).toBe(true)
    })

    test('should prevent duplicate ISBNs in database', async () => {
      const isbn = '9780306406157'
      await createTestTitle({ isbn })

      await expect(
        createTestTitle({ isbn })
      ).rejects.toThrow()
    })

    test('should handle ISBN normalization in database queries', async () => {
      const isbn = '9780306406157'
      await createTestTitle({ isbn })

      // Should find by exact match
      const exactMatch = await testDb.title.findUnique({
        where: { isbn }
      })
      expect(exactMatch).toBeTruthy()

      // Different formatting should be handled in application layer
      const formattedISBN = '978-0-306-40615-7'
      const normalizedISBN = normalizeISBN(formattedISBN)

      const normalizedMatch = await testDb.title.findUnique({
        where: { isbn: normalizedISBN }
      })
      expect(normalizedMatch).toBeTruthy()
    })
  })

  describe('Comprehensive Validation Suite', () => {
    test('should validate complete ISBN workflow', async () => {
      const testISBNs = [
        {
          input: '978-0-306-40615-7',
          normalized: '9780306406157',
          type: 'ISBN-13',
          shouldPass: true
        },
        {
          input: '0-306-40615-2',
          normalized: '0306406152',
          type: 'ISBN-10',
          shouldPass: true
        },
        {
          input: '123-456-789-X',
          normalized: '123456789X',
          type: 'ISBN-10',
          shouldPass: true
        },
        {
          input: '978-123-456-789-0',
          normalized: '9781234567890',
          type: 'ISBN-13',
          shouldPass: false // Invalid checksum
        }
      ]

      for (const testCase of testISBNs) {
        const normalized = normalizeISBN(testCase.input)
        expect(normalized).toBe(testCase.normalized)

        const formatValid = isValidISBNFormat(normalized)
        expect(formatValid).toBe(true)

        const checksumValid = isValidISBNChecksum(normalized)
        expect(checksumValid).toBe(testCase.shouldPass)

        if (testCase.shouldPass) {
          // Should be able to create title with valid ISBN
          const title = await createTestTitle({
            isbn: normalized,
            title: `Test ${testCase.type} Book`
          })
          expect(title.isbn).toBe(normalized)
        } else {
          // Should validate at application level before database
          expect(checksumValid).toBe(false)
        }
      }
    })

    test('should handle international ISBN variations', async () => {
      const internationalISBNs = [
        '9780545010221', // US publisher
        '9781408855652', // UK publisher
        '9783161484100', // German publisher
        '9784087203523', // Japanese publisher
        '9788483835234'  // Spanish publisher
      ]

      for (const isbn of internationalISBNs) {
        expect(isValidISBNFormat(isbn)).toBe(true)

        // Create title for each international ISBN
        const title = await createTestTitle({
          isbn,
          title: `International Book ${isbn.slice(-4)}`
        })
        expect(title.isbn).toBe(isbn)
      }

      // Verify all were created
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(internationalISBNs.length)
    })

    test('should prevent ISBN conflicts across format conversions', async () => {
      // Some ISBN-10s can be converted to ISBN-13 by adding 978 prefix
      const isbn10 = '0306406152'
      const isbn13 = '9780306406152' // Different from actual conversion

      await createTestTitle({ isbn: isbn10 })

      // Should be able to create with different ISBN-13
      const title13 = await createTestTitle({ isbn: isbn13 })
      expect(title13.isbn).toBe(isbn13)

      // Verify both exist
      const allTitles = await testDb.title.findMany()
      expect(allTitles).toHaveLength(2)
    })
  })

  describe('Performance and Edge Cases', () => {
    test('should handle rapid ISBN validation efficiently', () => {
      const startTime = Date.now()

      const testISBNs = Array.from({ length: 1000 }, (_, i) =>
        `978${i.toString().padStart(10, '0')}`
      )

      testISBNs.forEach(isbn => {
        isValidISBNFormat(isbn)
        calculateISBN13Checksum(isbn)
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(100) // Should complete in under 100ms
    })

    test('should handle malformed input gracefully', () => {
      const malformedInputs = [
        null,
        undefined,
        {},
        [],
        123456789,
        true,
        false,
        NaN,
        Infinity
      ]

      malformedInputs.forEach(input => {
        expect(() => isValidISBNFormat(input as string)).not.toThrow()
        expect(isValidISBNFormat(input as string)).toBe(false)
      })
    })

    test('should validate extreme edge cases', () => {
      const edgeCases = [
        '0000000000', // All zeros ISBN-10
        '0000000001', // Minimal ISBN-10
        '9999999999', // Maximum ISBN-10
        '9780000000002', // Minimal ISBN-13
        '9999999999999'  // Maximum ISBN-13
      ]

      edgeCases.forEach(isbn => {
        const formatValid = isValidISBNFormat(isbn)
        expect(formatValid).toBe(true)

        // Test checksum calculation doesn't crash
        expect(() => {
          if (isbn.length === 10) {
            calculateISBN10Checksum(isbn)
          } else {
            calculateISBN13Checksum(isbn)
          }
        }).not.toThrow()
      })
    })
  })
})