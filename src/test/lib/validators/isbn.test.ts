import { describe, test, expect } from 'vitest'
import {
  normalizeISBN,
  validateISBN13,
  validateISBN10,
  convertISBN10to13,
  formatISBN13,
  formatISBN10,
  detectISBNType,
  toISBN13,
  validateISBN,
  formatISBN
} from '@/lib/validators/isbn'

describe('ISBN Validator', () => {
  describe('normalizeISBN', () => {
    test('should remove hyphens from ISBN', () => {
      expect(normalizeISBN('978-0-306-40615-7')).toBe('9780306406157')
    })

    test('should remove spaces from ISBN', () => {
      expect(normalizeISBN('978 0 306 40615 7')).toBe('9780306406157')
    })

    test('should remove both hyphens and spaces', () => {
      expect(normalizeISBN('978-0 306-40615 7')).toBe('9780306406157')
    })

    test('should convert lowercase x to uppercase X', () => {
      expect(normalizeISBN('043942089x')).toBe('043942089X')
    })

    test('should handle already normalized ISBN', () => {
      expect(normalizeISBN('9780306406157')).toBe('9780306406157')
    })

    test('should handle empty string', () => {
      expect(normalizeISBN('')).toBe('')
    })

    test('should handle null/undefined gracefully', () => {
      expect(normalizeISBN(null as any)).toBe('')
      expect(normalizeISBN(undefined as any)).toBe('')
    })
  })

  describe('validateISBN13', () => {
    test('should accept valid ISBN-13', () => {
      expect(validateISBN13('9780306406157')).toBe(true)
      expect(validateISBN13('9781234567897')).toBe(true)
      expect(validateISBN13('9780000000002')).toBe(true)
    })

    test('should accept valid ISBN-13 with hyphens', () => {
      expect(validateISBN13('978-0-306-40615-7')).toBe(true)
      expect(validateISBN13('978-1-234567-89-7')).toBe(true)
    })

    test('should accept valid ISBN-13 with spaces', () => {
      expect(validateISBN13('978 0 306 40615 7')).toBe(true)
      expect(validateISBN13('978 1 234567 89 7')).toBe(true)
    })

    test('should reject ISBN-13 with invalid checksum', () => {
      expect(validateISBN13('9780306406158')).toBe(false) // Should be ...7
      expect(validateISBN13('9781234567898')).toBe(false) // Should be ...7
    })

    test('should reject ISBN with wrong length', () => {
      expect(validateISBN13('978030640615')).toBe(false) // 12 digits
      expect(validateISBN13('97803064061577')).toBe(false) // 14 digits
      expect(validateISBN13('978')).toBe(false) // Too short
    })

    test('should reject ISBN with non-numeric characters', () => {
      expect(validateISBN13('978ABC0406157')).toBe(false)
      expect(validateISBN13('978-0-306-40615-X')).toBe(false) // X not valid in ISBN-13
    })

    test('should reject empty string', () => {
      expect(validateISBN13('')).toBe(false)
    })

    test('should handle ISBN with many zeros', () => {
      // Valid ISBN-13: 9780000000002 has valid checksum
      expect(validateISBN13('9780000000002')).toBe(true)
    })

    test('should handle all nines', () => {
      expect(validateISBN13('9999999999999')).toBe(false) // Invalid checksum
    })
  })

  describe('validateISBN10', () => {
    test('should accept valid ISBN-10', () => {
      expect(validateISBN10('0306406152')).toBe(true)
      expect(validateISBN10('0000000000')).toBe(true) // Valid ISBN-10 with all zeros
    })

    test('should accept valid ISBN-10 with X checksum', () => {
      expect(validateISBN10('043942089X')).toBe(true)
      expect(validateISBN10('080442957X')).toBe(true)
    })

    test('should accept valid ISBN-10 with hyphens', () => {
      expect(validateISBN10('0-306-40615-2')).toBe(true)
      expect(validateISBN10('0-439-42089-X')).toBe(true)
    })

    test('should accept lowercase x', () => {
      expect(validateISBN10('043942089x')).toBe(true)
    })

    test('should reject ISBN-10 with invalid checksum', () => {
      expect(validateISBN10('0306406153')).toBe(false) // Should be ...2
      expect(validateISBN10('1234567891')).toBe(false) // Should be ...0
    })

    test('should reject ISBN with wrong length', () => {
      expect(validateISBN10('030640615')).toBe(false) // 9 digits
      expect(validateISBN10('03064061522')).toBe(false) // 11 digits
    })

    test('should reject ISBN-10 with X in wrong position', () => {
      expect(validateISBN10('X306406152')).toBe(false)
      expect(validateISBN10('03064X6152')).toBe(false)
    })

    test('should reject empty string', () => {
      expect(validateISBN10('')).toBe(false)
    })
  })

  describe('convertISBN10to13', () => {
    test('should convert valid ISBN-10 to ISBN-13', () => {
      expect(convertISBN10to13('0306406152')).toBe('9780306406157')
      expect(convertISBN10to13('0000000000')).toBe('9780000000002') // Convert zeros
    })

    test('should convert ISBN-10 with X checksum', () => {
      expect(convertISBN10to13('043942089X')).toBe('9780439420891')
    })

    test('should handle ISBN-10 with hyphens', () => {
      expect(convertISBN10to13('0-306-40615-2')).toBe('9780306406157')
    })

    test('should return empty string for invalid ISBN-10', () => {
      expect(convertISBN10to13('0306406153')).toBe('') // Invalid checksum
      expect(convertISBN10to13('invalid')).toBe('')
      expect(convertISBN10to13('')).toBe('')
    })

    test('should return empty string for ISBN-13', () => {
      expect(convertISBN10to13('9780306406157')).toBe('') // Already ISBN-13
    })

    test('converted ISBN-13 should be valid', () => {
      const isbn13 = convertISBN10to13('0306406152')
      expect(validateISBN13(isbn13)).toBe(true)
    })
  })

  describe('formatISBN13', () => {
    test('should format ISBN-13 with hyphens', () => {
      expect(formatISBN13('9780306406157')).toBe('978-0-306406-15-7')
      expect(formatISBN13('9781234567897')).toBe('978-1-234567-89-7')
    })

    test('should handle already formatted ISBN-13', () => {
      expect(formatISBN13('978-0-306406-15-7')).toBe('978-0-306406-15-7')
    })

    test('should return original for invalid ISBN-13', () => {
      expect(formatISBN13('invalid')).toBe('invalid')
      expect(formatISBN13('978030640615')).toBe('978030640615') // Too short
    })

    test('should return original for empty string', () => {
      expect(formatISBN13('')).toBe('')
    })
  })

  describe('formatISBN10', () => {
    test('should format ISBN-10 with hyphens', () => {
      expect(formatISBN10('0306406152')).toBe('0-306406-15-2')
      expect(formatISBN10('043942089X')).toBe('0-439420-89-X')
    })

    test('should handle already formatted ISBN-10', () => {
      expect(formatISBN10('0-306406-15-2')).toBe('0-306406-15-2')
    })

    test('should return original for invalid ISBN-10', () => {
      expect(formatISBN10('invalid')).toBe('invalid')
      expect(formatISBN10('030640615')).toBe('030640615') // Too short
    })

    test('should return original for empty string', () => {
      expect(formatISBN10('')).toBe('')
    })
  })

  describe('detectISBNType', () => {
    test('should detect ISBN-13', () => {
      expect(detectISBNType('9780306406157')).toBe('13')
      expect(detectISBNType('978-0-306-40615-7')).toBe('13')
    })

    test('should detect ISBN-10', () => {
      expect(detectISBNType('0306406152')).toBe('10')
      expect(detectISBNType('043942089X')).toBe('10')
      expect(detectISBNType('0-306-40615-2')).toBe('10')
    })

    test('should detect invalid ISBN', () => {
      expect(detectISBNType('invalid')).toBe('invalid')
      expect(detectISBNType('9780306406158')).toBe('invalid') // Bad checksum
      expect(detectISBNType('0306406153')).toBe('invalid') // Bad checksum
      expect(detectISBNType('')).toBe('invalid')
    })
  })

  describe('toISBN13', () => {
    test('should return ISBN-13 unchanged', () => {
      expect(toISBN13('9780306406157')).toBe('9780306406157')
      expect(toISBN13('978-0-306-40615-7')).toBe('9780306406157')
    })

    test('should convert ISBN-10 to ISBN-13', () => {
      expect(toISBN13('0306406152')).toBe('9780306406157')
      expect(toISBN13('043942089X')).toBe('9780439420891')
      expect(toISBN13('0-306-40615-2')).toBe('9780306406157')
    })

    test('should return empty string for invalid ISBN', () => {
      expect(toISBN13('invalid')).toBe('')
      expect(toISBN13('9780306406158')).toBe('') // Invalid checksum
      expect(toISBN13('')).toBe('')
    })

    test('converted ISBN should be valid ISBN-13', () => {
      const isbn13 = toISBN13('0306406152')
      expect(validateISBN13(isbn13)).toBe(true)
    })
  })

  describe('validateISBN', () => {
    test('should accept valid ISBN-13', () => {
      expect(validateISBN('9780306406157')).toBe(true)
      expect(validateISBN('978-0-306-40615-7')).toBe(true)
    })

    test('should accept valid ISBN-10', () => {
      expect(validateISBN('0306406152')).toBe(true)
      expect(validateISBN('043942089X')).toBe(true)
      expect(validateISBN('0-306-40615-2')).toBe(true)
    })

    test('should reject invalid ISBN', () => {
      expect(validateISBN('invalid')).toBe(false)
      expect(validateISBN('9780306406158')).toBe(false) // Bad ISBN-13 checksum
      expect(validateISBN('0306406153')).toBe(false) // Bad ISBN-10 checksum
      expect(validateISBN('')).toBe(false)
    })
  })

  describe('formatISBN', () => {
    test('should format ISBN-13', () => {
      expect(formatISBN('9780306406157')).toBe('978-0-306406-15-7')
      expect(formatISBN('978-0-306-40615-7')).toBe('978-0-306406-15-7')
    })

    test('should format ISBN-10', () => {
      expect(formatISBN('0306406152')).toBe('0-306406-15-2')
      expect(formatISBN('043942089X')).toBe('0-439420-89-X')
    })

    test('should return original for invalid ISBN', () => {
      expect(formatISBN('invalid')).toBe('invalid')
      expect(formatISBN('9780306406158')).toBe('9780306406158') // Invalid
      expect(formatISBN('')).toBe('')
    })
  })

  describe('Edge Cases', () => {
    test('should handle ISBNs with mixed formatting', () => {
      expect(validateISBN('978- 0-306 40615-7')).toBe(true)
      expect(toISBN13('0-306 40615-2')).toBe('9780306406157')
    })

    test('should handle very short strings', () => {
      expect(validateISBN('1')).toBe(false)
      expect(validateISBN('12345')).toBe(false)
    })

    test('should handle very long strings', () => {
      expect(validateISBN('12345678901234567890')).toBe(false)
    })

    test('should handle strings with special characters', () => {
      expect(validateISBN('978@0306$40615#7')).toBe(false)
    })

    test('should handle Unicode characters', () => {
      expect(validateISBN('978🔥0306406157')).toBe(false)
    })
  })

  describe('Real World ISBNs', () => {
    test('should validate real ISBN-13 examples', () => {
      // Harry Potter and the Philosopher's Stone
      expect(validateISBN13('9780747532699')).toBe(true)

      // The Lord of the Rings
      expect(validateISBN13('9780618640157')).toBe(true)

      // 1984 by George Orwell
      expect(validateISBN13('9780451524935')).toBe(true)
    })

    test('should validate real ISBN-10 examples', () => {
      // Harry Potter and the Philosopher's Stone
      expect(validateISBN10('0747532699')).toBe(true)

      // The Lord of the Rings
      expect(validateISBN10('0618640150')).toBe(true)

      // 1984 by George Orwell
      expect(validateISBN10('0451524934')).toBe(true)
    })

    test('should convert real ISBN-10 to ISBN-13', () => {
      expect(convertISBN10to13('0747532699')).toBe('9780747532699')
      expect(convertISBN10to13('0618640150')).toBe('9780618640157')
      expect(convertISBN10to13('0451524934')).toBe('9780451524935')
    })
  })
})
