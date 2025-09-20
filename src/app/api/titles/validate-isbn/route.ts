import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { isISBN } from 'isbn3'

const prisma = new PrismaClient()

// Validation schema for ISBN validation request
const validateISBNSchema = z.object({
  isbn: z.string().min(1, 'ISBN is required'),
  excludeId: z.string().uuid().optional()
})

// Utility function to normalize ISBN
function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '').toUpperCase()
}

// Utility function to validate ISBN format
function validateISBNFormat(isbn: string): boolean {
  const cleanISBN = isbn.replace(/[-\s]/g, '')
  return isISBN(cleanISBN)
}

// Utility function to determine ISBN type
function getISBNType(isbn: string): 'ISBN-10' | 'ISBN-13' | null {
  const cleanISBN = isbn.replace(/[-\s]/g, '')
  if (cleanISBN.length === 10 && isISBN(cleanISBN)) return 'ISBN-10'
  if (cleanISBN.length === 13 && isISBN(cleanISBN)) return 'ISBN-13'
  return null
}

// POST /api/titles/validate-isbn - Validate ISBN format and check availability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { isbn, excludeId } = validateISBNSchema.parse(body)

    const normalizedISBN = normalizeISBN(isbn)
    const isValidFormat = validateISBNFormat(isbn)
    const isbnType = getISBNType(isbn)

    let isDuplicate = false
    let existingTitle = null

    if (isValidFormat) {
      // Check if ISBN already exists in database
      const existing = await prisma.title.findUnique({
        where: { isbn: normalizedISBN },
        select: {
          id: true,
          title: true,
          author: true,
          isbn: true,
          publicationYear: true
        }
      })

      if (existing && existing.id !== excludeId) {
        isDuplicate = true
        existingTitle = existing
      }
    }

    const response = {
      data: {
        isValid: isValidFormat,
        isDuplicate,
        normalizedISBN: isValidFormat ? normalizedISBN : null,
        isbnType,
        existingTitle,
        validation: {
          format: isValidFormat ? 'valid' : 'invalid',
          length: normalizedISBN.length,
          expectedLengths: [10, 13]
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error validating ISBN:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}