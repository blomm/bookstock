// src/lib/validators/title.ts

import { z } from 'zod'
import { Format } from '@prisma/client'
import { validateISBN } from './isbn'

/**
 * Zod Validation Schemas for Title Management
 *
 * These schemas provide comprehensive input validation for:
 * - Title creation
 * - Title updates
 * - Bulk import operations
 * - Bulk price updates
 */

/**
 * Base Title Schema - Core fields without business rules
 *
 * Used as foundation for CreateTitleSchema and UpdateTitleSchema
 */
const BaseTitleSchema = z.object({
  // Core Required Fields
  isbn: z.string()
    .min(10, 'ISBN must be at least 10 characters')
    .max(17, 'ISBN must not exceed 17 characters (including hyphens)')
    .regex(/^[\d\-\sXx]+$/, 'ISBN must contain only digits, hyphens, spaces, or X')
    .refine((isbn) => validateISBN(isbn), {
      message: 'Invalid ISBN format or checksum'
    }),

  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must not exceed 500 characters')
    .trim(),

  author: z.string()
    .min(1, 'Author is required')
    .max(255, 'Author must not exceed 255 characters')
    .trim(),

  format: z.nativeEnum(Format, {
    errorMap: () => ({ message: 'Invalid format. Must be one of: PAPERBACK, HARDCOVER, DIGITAL, AUDIOBOOK' })
  }),

  rrp: z.number()
    .positive('RRP must be positive')
    .max(99999.99, 'RRP must not exceed 99,999.99')
    .multipleOf(0.01, 'RRP must have at most 2 decimal places'),

  unitCost: z.number()
    .positive('Unit cost must be positive')
    .max(99999.99, 'Unit cost must not exceed 99,999.99')
    .multipleOf(0.01, 'Unit cost must have at most 2 decimal places'),

  // Publishing Metadata (Optional)
  publisher: z.string()
    .max(255, 'Publisher must not exceed 255 characters')
    .trim()
    .optional(),

  publicationDate: z.coerce.date()
    .optional()
    .refine((date) => {
      if (!date) return true
      const minDate = new Date('1900-01-01')
      const maxDate = new Date()
      maxDate.setFullYear(maxDate.getFullYear() + 10) // Allow up to 10 years in future
      return date >= minDate && date <= maxDate
    }, {
      message: 'Publication date must be between 1900 and 10 years in the future'
    }),

  pageCount: z.number()
    .int('Page count must be a whole number')
    .positive('Page count must be positive')
    .max(10000, 'Page count must not exceed 10,000')
    .optional(),

  description: z.string()
    .max(5000, 'Description must not exceed 5,000 characters')
    .optional(),

  category: z.string()
    .max(100, 'Category must not exceed 100 characters')
    .trim()
    .optional(),

  subcategory: z.string()
    .max(100, 'Subcategory must not exceed 100 characters')
    .trim()
    .optional(),

  // Physical Product Fields (Optional)
  dimensions: z.string()
    .regex(/^\d+x\d+x\d+$/, 'Dimensions must be in format LxWxH (e.g., 229x152x19)')
    .refine((dims) => {
      const [l, w, h] = dims.split('x').map(Number)
      return l > 0 && l <= 1000 && w > 0 && w <= 1000 && h > 0 && h <= 500
    }, {
      message: 'Dimensions must be valid (L: 1-1000mm, W: 1-1000mm, H: 1-500mm)'
    })
    .optional(),

  weight: z.number()
    .int('Weight must be a whole number')
    .positive('Weight must be positive')
    .max(50000, 'Weight must not exceed 50,000 grams')
    .optional(),

  bindingType: z.string()
    .max(50, 'Binding type must not exceed 50 characters')
    .trim()
    .optional(),

  coverFinish: z.string()
    .max(50, 'Cover finish must not exceed 50 characters')
    .trim()
    .optional(),

  // Commercial Terms (Optional)
  tradeDiscount: z.number()
    .min(0, 'Trade discount cannot be negative')
    .max(100, 'Trade discount cannot exceed 100%')
    .multipleOf(0.01, 'Trade discount must have at most 2 decimal places')
    .optional(),

  royaltyRate: z.number()
    .min(0, 'Royalty rate cannot be negative')
    .max(100, 'Royalty rate cannot exceed 100%')
    .multipleOf(0.01, 'Royalty rate must have at most 2 decimal places')
    .optional(),

  royaltyThreshold: z.number()
    .int('Royalty threshold must be a whole number')
    .nonnegative('Royalty threshold cannot be negative')
    .max(1000000, 'Royalty threshold must not exceed 1,000,000')
    .optional(),

  printRunSize: z.number()
    .int('Print run size must be a whole number')
    .positive('Print run size must be positive')
    .max(1000000, 'Print run size must not exceed 1,000,000')
    .optional(),

  reprintThreshold: z.number()
    .int('Reprint threshold must be a whole number')
    .nonnegative('Reprint threshold cannot be negative')
    .max(1000000, 'Reprint threshold must not exceed 1,000,000')
    .optional(),

  // Additional Metadata (Optional)
  keywords: z.string()
    .max(500, 'Keywords must not exceed 500 characters')
    .optional(),

  language: z.string()
    .length(2, 'Language must be a 2-character ISO 639-1 code')
    .regex(/^[a-z]{2}$/, 'Language must be lowercase ISO 639-1 code (e.g., en, fr, de)')
    .optional(),

  territoryRights: z.string()
    .max(200, 'Territory rights must not exceed 200 characters')
    .trim()
    .optional(),

  seriesId: z.number()
    .int('Series ID must be a whole number')
    .positive('Series ID must be positive')
    .optional()
})

/**
 * CreateTitleSchema - Validates data for creating a new title
 *
 * Includes business rule validation
 */
export const CreateTitleSchema = BaseTitleSchema
  .refine((data) => {
    // Business rule: RRP should be higher than unit cost
    return data.rrp > data.unitCost
  }, {
    message: 'RRP must be higher than unit cost',
    path: ['rrp']
  })
  .refine((data) => {
    // Business rule: If royalty threshold is set, royalty rate should also be set
    if (data.royaltyThreshold !== undefined && data.royaltyThreshold > 0) {
      return data.royaltyRate !== undefined && data.royaltyRate > 0
    }
    return true
  }, {
    message: 'Royalty rate must be set when royalty threshold is provided',
    path: ['royaltyRate']
  })
  .refine((data) => {
    // Business rule: If reprint threshold is set, print run size should also be set
    if (data.reprintThreshold !== undefined && data.reprintThreshold > 0) {
      return data.printRunSize !== undefined && data.printRunSize > 0
    }
    return true
  }, {
    message: 'Print run size must be set when reprint threshold is provided',
    path: ['printRunSize']
  })

/**
 * UpdateTitleSchema - Validates data for updating an existing title
 *
 * All fields are optional (partial update)
 * Includes priceChangeReason for price history tracking
 */
export const UpdateTitleSchema = BaseTitleSchema.partial().extend({
  priceChangeReason: z.string()
    .min(1, 'Price change reason is required when updating prices')
    .max(255, 'Price change reason must not exceed 255 characters')
    .trim()
    .optional()
})

/**
 * BulkImportSchema - Validates data for bulk title import
 *
 * Accepts an array of title creation data
 * Minimum 1 title, maximum 1000 titles per import
 */
export const BulkImportSchema = z.object({
  titles: z.array(CreateTitleSchema)
    .min(1, 'At least one title is required')
    .max(1000, 'Cannot import more than 1,000 titles at once')
})

/**
 * BulkUpdatePricesSchema - Validates data for bulk price updates
 *
 * Accepts an array of price updates with a reason
 * Minimum 1 update, maximum 1000 updates per request
 */
export const BulkUpdatePricesSchema = z.object({
  updates: z.array(
    z.object({
      id: z.number()
        .int('Title ID must be a whole number')
        .positive('Title ID must be positive'),

      rrp: z.number()
        .positive('RRP must be positive')
        .max(99999.99, 'RRP must not exceed 99,999.99')
        .multipleOf(0.01, 'RRP must have at most 2 decimal places')
        .optional(),

      unitCost: z.number()
        .positive('Unit cost must be positive')
        .max(99999.99, 'Unit cost must not exceed 99,999.99')
        .multipleOf(0.01, 'Unit cost must have at most 2 decimal places')
        .optional(),

      tradeDiscount: z.number()
        .min(0, 'Trade discount cannot be negative')
        .max(100, 'Trade discount cannot exceed 100%')
        .multipleOf(0.01, 'Trade discount must have at most 2 decimal places')
        .optional()
    })
      .refine((data) => {
        // At least one price field must be provided
        return data.rrp !== undefined || data.unitCost !== undefined || data.tradeDiscount !== undefined
      }, {
        message: 'At least one price field (rrp, unitCost, or tradeDiscount) must be provided'
      })
  )
    .min(1, 'At least one price update is required')
    .max(1000, 'Cannot update more than 1,000 titles at once'),

  reason: z.string()
    .min(1, 'Price change reason is required')
    .max(255, 'Price change reason must not exceed 255 characters')
    .trim()
})

/**
 * Type exports for TypeScript
 */
export type CreateTitleInput = z.infer<typeof CreateTitleSchema>
export type UpdateTitleInput = z.infer<typeof UpdateTitleSchema>
export type BulkImportInput = z.infer<typeof BulkImportSchema>
export type BulkUpdatePricesInput = z.infer<typeof BulkUpdatePricesSchema>
