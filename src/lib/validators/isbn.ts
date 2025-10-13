/**
 * ISBN Validation and Utility Functions
 *
 * Provides validation, conversion, formatting, and normalization
 * for ISBN-10 and ISBN-13 identifiers.
 */

/**
 * Normalize ISBN by removing hyphens, spaces, and converting to uppercase
 * @param isbn - ISBN string to normalize
 * @returns Normalized ISBN (digits only, uppercase X for ISBN-10 checksum)
 */
export function normalizeISBN(isbn: string): string {
  if (!isbn) return ''
  return isbn.replace(/[-\s]/g, '').toUpperCase()
}

/**
 * Validate ISBN-13 with checksum verification
 * @param isbn - ISBN-13 string to validate
 * @returns true if valid ISBN-13, false otherwise
 */
export function validateISBN13(isbn: string): boolean {
  // Normalize first
  const cleaned = normalizeISBN(isbn)

  // Must be exactly 13 digits
  if (!/^\d{13}$/.test(cleaned)) {
    return false
  }

  // Calculate checksum
  const digits = cleaned.split('').map(Number)
  const checksum = digits.reduce((sum, digit, index) => {
    // Multiply alternating digits by 1 and 3
    return sum + digit * (index % 2 === 0 ? 1 : 3)
  }, 0)

  // Checksum must be divisible by 10
  return checksum % 10 === 0
}

/**
 * Validate ISBN-10 with checksum verification
 * @param isbn - ISBN-10 string to validate
 * @returns true if valid ISBN-10, false otherwise
 */
export function validateISBN10(isbn: string): boolean {
  // Normalize first
  const cleaned = normalizeISBN(isbn)

  // Must be exactly 10 characters (9 digits + checksum which can be X)
  if (!/^\d{9}[\dX]$/.test(cleaned)) {
    return false
  }

  // Calculate checksum
  const digits = cleaned.substring(0, 9).split('').map(Number)
  let checksum = 0

  for (let i = 0; i < 9; i++) {
    checksum += digits[i] * (10 - i)
  }

  // Add check digit (X = 10)
  const checkDigit = cleaned[9] === 'X' ? 10 : parseInt(cleaned[9], 10)
  checksum += checkDigit

  // Checksum must be divisible by 11
  return checksum % 11 === 0
}

/**
 * Convert ISBN-10 to ISBN-13
 * @param isbn10 - ISBN-10 string to convert
 * @returns ISBN-13 string, or empty string if invalid ISBN-10
 */
export function convertISBN10to13(isbn10: string): string {
  // Normalize first
  const cleaned = normalizeISBN(isbn10)

  // Validate it's a proper ISBN-10
  if (!validateISBN10(cleaned)) {
    return ''
  }

  // Take first 9 digits (remove check digit)
  const base = cleaned.substring(0, 9)

  // Prepend 978 (EAN prefix for books)
  const isbn13base = '978' + base

  // Calculate new checksum for ISBN-13
  const digits = isbn13base.split('').map(Number)
  const checksum = digits.reduce((sum, digit, index) => {
    return sum + digit * (index % 2 === 0 ? 1 : 3)
  }, 0)

  // Calculate check digit (10 - (checksum % 10)) mod 10
  const checksumDigit = (10 - (checksum % 10)) % 10

  return isbn13base + checksumDigit
}

/**
 * Format ISBN-13 with hyphens for display
 * Format: 978-1-234567-89-0
 * @param isbn - ISBN-13 string to format
 * @returns Formatted ISBN-13 with hyphens
 */
export function formatISBN13(isbn: string): string {
  // Normalize first
  const cleaned = normalizeISBN(isbn)

  // Must be 13 digits
  if (!/^\d{13}$/.test(cleaned)) {
    return isbn // Return original if invalid
  }

  // Format as: 978-1-234567-89-0
  // EAN prefix (3) - Group (1) - Publisher (6) - Title (2) - Check (1)
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 4)}-${cleaned.slice(4, 10)}-${cleaned.slice(10, 12)}-${cleaned.slice(12)}`
}

/**
 * Format ISBN-10 with hyphens for display
 * Format: 1-234567-89-X
 * @param isbn - ISBN-10 string to format
 * @returns Formatted ISBN-10 with hyphens
 */
export function formatISBN10(isbn: string): string {
  // Normalize first
  const cleaned = normalizeISBN(isbn)

  // Must be 10 characters (9 digits + checksum)
  if (!/^\d{9}[\dX]$/.test(cleaned)) {
    return isbn // Return original if invalid
  }

  // Format as: 1-234567-89-X
  // Group (1) - Publisher (6) - Title (2) - Check (1)
  return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`
}

/**
 * Determine if an ISBN string is ISBN-10 or ISBN-13
 * @param isbn - ISBN string to check
 * @returns '10', '13', or 'invalid'
 */
export function detectISBNType(isbn: string): '10' | '13' | 'invalid' {
  const cleaned = normalizeISBN(isbn)

  if (validateISBN13(cleaned)) {
    return '13'
  }

  if (validateISBN10(cleaned)) {
    return '10'
  }

  return 'invalid'
}

/**
 * Validate and convert ISBN to ISBN-13 format
 * Accepts both ISBN-10 and ISBN-13, returns normalized ISBN-13
 * @param isbn - ISBN string (10 or 13)
 * @returns Normalized ISBN-13, or empty string if invalid
 */
export function toISBN13(isbn: string): string {
  const cleaned = normalizeISBN(isbn)

  // Check if it's already ISBN-13
  if (validateISBN13(cleaned)) {
    return cleaned
  }

  // Try to convert from ISBN-10
  if (validateISBN10(cleaned)) {
    return convertISBN10to13(cleaned)
  }

  // Invalid ISBN
  return ''
}

/**
 * Validate ISBN (accepts both ISBN-10 and ISBN-13)
 * @param isbn - ISBN string to validate
 * @returns true if valid ISBN-10 or ISBN-13, false otherwise
 */
export function validateISBN(isbn: string): boolean {
  const cleaned = normalizeISBN(isbn)
  return validateISBN13(cleaned) || validateISBN10(cleaned)
}

/**
 * Format ISBN for display (auto-detects ISBN-10 or ISBN-13)
 * @param isbn - ISBN string to format
 * @returns Formatted ISBN with hyphens
 */
export function formatISBN(isbn: string): string {
  const cleaned = normalizeISBN(isbn)

  if (validateISBN13(cleaned)) {
    return formatISBN13(cleaned)
  }

  if (validateISBN10(cleaned)) {
    return formatISBN10(cleaned)
  }

  return isbn // Return original if invalid
}
