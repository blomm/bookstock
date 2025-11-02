// src/lib/validators/series.ts

import { z } from 'zod'
import { SeriesStatus } from '@prisma/client'

/**
 * Zod Validation Schemas for Series Management
 *
 * These schemas provide comprehensive input validation for:
 * - Series creation
 * - Series updates
 * - Bulk operations on series titles
 */

/**
 * Base Series Schema - Core fields without business rules
 *
 * Used as foundation for CreateSeriesSchema and UpdateSeriesSchema
 */
const BaseSeriesSchema = z.object({
  // Core Required Fields
  name: z.string()
    .min(1, 'Series name is required')
    .max(100, 'Series name must not exceed 100 characters')
    .trim(),

  // Optional Fields
  description: z.string()
    .max(1000, 'Description must not exceed 1,000 characters')
    .trim()
    .optional()
    .nullable(),

  status: z.nativeEnum(SeriesStatus, {
    errorMap: () => ({ message: 'Invalid status. Must be either ACTIVE or ARCHIVED' })
  })
    .optional()
    .default(SeriesStatus.ACTIVE),

  organizationId: z.string()
    .min(1, 'Organization ID is required')
    .max(255, 'Organization ID must not exceed 255 characters')
    .trim(),

  createdBy: z.string()
    .max(255, 'Created by must not exceed 255 characters')
    .trim()
    .optional()
    .nullable()
})

/**
 * CreateSeriesSchema - Validates data for creating a new series
 *
 * organizationId and name are required
 * status defaults to ACTIVE if not provided
 */
export const CreateSeriesSchema = BaseSeriesSchema
  .omit({ status: true })
  .extend({
    status: z.nativeEnum(SeriesStatus)
      .optional()
      .default(SeriesStatus.ACTIVE)
  })

/**
 * UpdateSeriesSchema - Validates data for updating an existing series
 *
 * All fields are optional (partial update)
 * organizationId cannot be changed (omitted)
 */
export const UpdateSeriesSchema = BaseSeriesSchema
  .omit({ organizationId: true, createdBy: true })
  .partial()

/**
 * SeriesListFiltersSchema - Validates query parameters for listing series
 */
export const SeriesListFiltersSchema = z.object({
  organizationId: z.string()
    .min(1, 'Organization ID is required'),

  status: z.nativeEnum(SeriesStatus)
    .optional(),

  search: z.string()
    .max(100, 'Search query must not exceed 100 characters')
    .trim()
    .optional(),

  page: z.number()
    .int('Page must be a whole number')
    .positive('Page must be positive')
    .default(1),

  limit: z.number()
    .int('Limit must be a whole number')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(20)
})

/**
 * BulkUpdateTitlesSchema - Validates data for bulk updates to all titles in a series
 *
 * At least one field must be provided
 * Maximum 1000 titles can be updated at once (enforced in service)
 */
export const BulkUpdateTitlesSchema = z.object({
  updates: z.object({
    rrp: z.number()
      .positive('RRP must be positive')
      .max(99999.99, 'RRP must not exceed 99,999.99')
      .multipleOf(0.01, 'RRP must have at most 2 decimal places')
      .optional(),

    lowStockThreshold: z.number()
      .int('Low stock threshold must be a whole number')
      .nonnegative('Low stock threshold cannot be negative')
      .max(1000000, 'Low stock threshold must not exceed 1,000,000')
      .optional()
      .nullable(),

    unitCost: z.number()
      .positive('Unit cost must be positive')
      .max(99999.99, 'Unit cost must not exceed 99,999.99')
      .multipleOf(0.01, 'Unit cost must have at most 2 decimal places')
      .optional()
  })
    .refine((data) => {
      // At least one field must be provided
      return data.rrp !== undefined || data.lowStockThreshold !== undefined || data.unitCost !== undefined
    }, {
      message: 'At least one field (rrp, lowStockThreshold, or unitCost) must be provided'
    }),

  reason: z.string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must not exceed 500 characters')
    .trim()
    .optional()
})

/**
 * Type exports for TypeScript
 */
export type CreateSeriesInput = z.infer<typeof CreateSeriesSchema>
export type UpdateSeriesInput = z.infer<typeof UpdateSeriesSchema>
export type SeriesListFilters = z.infer<typeof SeriesListFiltersSchema>
export type BulkUpdateTitlesInput = z.infer<typeof BulkUpdateTitlesSchema>
