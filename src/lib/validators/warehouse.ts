import { z } from 'zod'

// Warehouse Type Enum
export const WarehouseTypeSchema = z.enum(['PHYSICAL', 'VIRTUAL', 'THIRD_PARTY'])

// Warehouse Status Enum
export const WarehouseStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])

// Create Warehouse Schema
export const CreateWarehouseSchema = z.object({
  // Required fields
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code must be 20 characters or less')
    .transform(val => val.toUpperCase())
    .refine(val => /^[A-Z0-9-]+$/.test(val), {
      message: 'Code must contain only uppercase letters, numbers, and hyphens'
    }),

  // Optional fields with defaults
  type: WarehouseTypeSchema.default('PHYSICAL'),
  status: WarehouseStatusSchema.default('ACTIVE'),

  // Address fields (all optional)
  addressLine1: z.string().max(255, 'Address line 1 must be 255 characters or less').optional(),
  addressLine2: z.string().max(255, 'Address line 2 must be 255 characters or less').optional(),
  city: z.string().max(100, 'City must be 100 characters or less').optional(),
  stateProvince: z.string().max(100, 'State/Province must be 100 characters or less').optional(),
  postalCode: z.string().max(20, 'Postal code must be 20 characters or less').optional(),
  country: z
    .string()
    .length(2, 'Country code must be exactly 2 characters (ISO 3166-1 alpha-2)')
    .transform(val => val.toUpperCase())
    .optional(),

  // Contact fields (all optional)
  contactName: z.string().max(100, 'Contact name must be 100 characters or less').optional(),
  contactEmail: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less')
    .optional(),
  contactPhone: z.string().max(20, 'Phone number must be 20 characters or less').optional(),

  // Notes field (optional)
  notes: z.string().optional(),

  // Legacy fields (optional for backward compatibility)
  location: z.string().max(100).optional(),
  fulfillsChannels: z.array(z.string()).optional()
})

// Update Warehouse Schema (partial of Create, all fields optional)
export const UpdateWarehouseSchema = CreateWarehouseSchema.partial()

// Type exports for TypeScript
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>
export type WarehouseType = z.infer<typeof WarehouseTypeSchema>
export type WarehouseStatus = z.infer<typeof WarehouseStatusSchema>
