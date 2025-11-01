import { describe, test, expect } from 'vitest'
import {
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  type CreateWarehouseInput,
  type UpdateWarehouseInput
} from '@/lib/validators/warehouse'

describe('Warehouse Validation Schemas', () => {
  describe('CreateWarehouseSchema', () => {
    describe('Valid Cases', () => {
      test('should validate warehouse with all required fields', () => {
        const input: CreateWarehouseInput = {
          name: 'UK Warehouse',
          code: 'UK-LON'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.name).toBe('UK Warehouse')
          expect(result.data.code).toBe('UK-LON')
          expect(result.data.type).toBe('PHYSICAL') // Default
          expect(result.data.status).toBe('ACTIVE') // Default
        }
      })

      test('should validate warehouse with all fields', () => {
        const input: CreateWarehouseInput = {
          name: 'UK Warehouse - London',
          code: 'UK-LON',
          type: 'PHYSICAL',
          status: 'ACTIVE',
          addressLine1: '123 Publishing Street',
          addressLine2: 'Suite 100',
          city: 'London',
          stateProvince: 'Greater London',
          postalCode: 'EC1A 1BB',
          country: 'GB',
          contactName: 'John Doe',
          contactEmail: 'john@warehouse.com',
          contactPhone: '+44 20 7946 0958',
          notes: 'Main UK distribution center'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(true)
      })

      test('should auto-uppercase warehouse code', () => {
        const input = {
          name: 'Test Warehouse',
          code: 'test-code'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.code).toBe('TEST-CODE')
        }
      })

      test('should auto-uppercase country code', () => {
        const input = {
          name: 'Test Warehouse',
          code: 'TST',
          country: 'gb'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.country).toBe('GB')
        }
      })

      test('should validate all warehouse types', () => {
        const types = ['PHYSICAL', 'VIRTUAL', 'THIRD_PARTY'] as const

        types.forEach(type => {
          const input = {
            name: 'Test Warehouse',
            code: 'TST',
            type
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.type).toBe(type)
          }
        })
      })

      test('should validate all warehouse statuses', () => {
        const statuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const

        statuses.forEach(status => {
          const input = {
            name: 'Test Warehouse',
            code: 'TST',
            status
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.status).toBe(status)
          }
        })
      })

      test('should accept valid email format', () => {
        const validEmails = [
          'test@example.com',
          'warehouse.contact@company.co.uk',
          'user+tag@domain.com'
        ]

        validEmails.forEach(email => {
          const input = {
            name: 'Test',
            code: 'TST',
            contactEmail: email
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(true)
        })
      })

      test('should accept 2-character country codes', () => {
        const validCodes = ['GB', 'US', 'FR', 'DE', 'JP']

        validCodes.forEach(country => {
          const input = {
            name: 'Test',
            code: 'TST',
            country
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(true)
        })
      })

      test('should accept valid code formats', () => {
        const validCodes = [
          'UK',
          'US-NYC',
          'ONLINE',
          'WH-123',
          'ABC123'
        ]

        validCodes.forEach(code => {
          const input = {
            name: 'Test',
            code
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(true)
        })
      })
    })

    describe('Invalid Cases', () => {
      test('should reject missing name', () => {
        const input = {
          code: 'TST'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(false)
      })

      test('should reject missing code', () => {
        const input = {
          name: 'Test Warehouse'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(false)
      })

      test('should reject empty name', () => {
        const input = {
          name: '',
          code: 'TST'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(false)
      })

      test('should reject name exceeding 100 characters', () => {
        const input = {
          name: 'a'.repeat(101),
          code: 'TST'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(false)
      })

      test('should reject code less than 2 characters', () => {
        const input = {
          name: 'Test',
          code: 'A'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(false)
      })

      test('should reject code exceeding 20 characters', () => {
        const input = {
          name: 'Test',
          code: 'A'.repeat(21)
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(false)
      })

      test('should accept and uppercase code with lowercase letters', () => {
        const input = {
          name: 'Test',
          code: 'test'
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.code).toBe('TEST')
        }
      })

      test('should reject code with special characters', () => {
        const invalidCodes = ['TEST@', 'UK_LON', 'US.NYC', 'A B']

        invalidCodes.forEach(code => {
          const input = {
            name: 'Test',
            code
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(false)
        })
      })

      test('should reject invalid warehouse type', () => {
        const input = {
          name: 'Test',
          code: 'TST',
          type: 'INVALID'
        }

        const result = CreateWarehouseSchema.safeParse(input as any)
        expect(result.success).toBe(false)
      })

      test('should reject invalid warehouse status', () => {
        const input = {
          name: 'Test',
          code: 'TST',
          status: 'INVALID'
        }

        const result = CreateWarehouseSchema.safeParse(input as any)
        expect(result.success).toBe(false)
      })

      test('should reject invalid email format', () => {
        const invalidEmails = [
          'notanemail',
          '@example.com',
          'user@',
          'user @example.com'
        ]

        invalidEmails.forEach(email => {
          const input = {
            name: 'Test',
            code: 'TST',
            contactEmail: email
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(false)
        })
      })

      test('should reject country code not 2 characters', () => {
        const invalidCodes = ['G', 'GBR', 'USA', '123']

        invalidCodes.forEach(country => {
          const input = {
            name: 'Test',
            code: 'TST',
            country
          }

          const result = CreateWarehouseSchema.safeParse(input)
          expect(result.success).toBe(false)
        })
      })

      test('should reject excessively long address fields', () => {
        const input = {
          name: 'Test',
          code: 'TST',
          addressLine1: 'a'.repeat(256)
        }

        const result = CreateWarehouseSchema.safeParse(input)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('UpdateWarehouseSchema', () => {
    test('should allow partial updates', () => {
      const input: UpdateWarehouseInput = {
        name: 'Updated Name'
      }

      const result = UpdateWarehouseSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    test('should allow updating only status', () => {
      const input: UpdateWarehouseInput = {
        status: 'MAINTENANCE'
      }

      const result = UpdateWarehouseSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    test('should allow updating multiple fields', () => {
      const input: UpdateWarehouseInput = {
        name: 'Updated Name',
        status: 'INACTIVE',
        notes: 'Warehouse closed for renovation'
      }

      const result = UpdateWarehouseSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    test('should validate field constraints on update', () => {
      const input = {
        name: 'a'.repeat(101) // Too long
      }

      const result = UpdateWarehouseSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    test('should allow empty object (no updates)', () => {
      const input = {}

      const result = UpdateWarehouseSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    test('should uppercase code on update', () => {
      const input = {
        code: 'new-code'
      }

      const result = UpdateWarehouseSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.code).toBe('NEW-CODE')
      }
    })

    test('should uppercase country on update', () => {
      const input = {
        country: 'us'
      }

      const result = UpdateWarehouseSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.country).toBe('US')
      }
    })
  })
})
