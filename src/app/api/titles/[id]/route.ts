import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { isISBN } from 'isbn3'

const prisma = new PrismaClient()

// Validation schema for title updates
const updateTitleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less').optional(),
  subtitle: z.string().max(500, 'Subtitle must be 500 characters or less').optional(),
  author: z.string().min(1, 'Author is required').max(255, 'Author must be 255 characters or less').optional(),
  isbn: z.string().min(1, 'ISBN is required').refine(
    (isbn) => {
      const cleanISBN = isbn.replace(/[-\s]/g, '')
      return isISBN(cleanISBN)
    },
    'Invalid ISBN format'
  ).optional(),
  publicationYear: z.number()
    .min(1000, 'Publication year must be 1000 or later')
    .max(new Date().getFullYear(), `Publication year cannot be later than ${new Date().getFullYear()}`)
    .optional(),
  publisher: z.string().max(255, 'Publisher must be 255 characters or less').optional(),
  seriesId: z.string().uuid('Invalid series ID format').nullable().optional(),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  format: z.enum(['HARDCOVER', 'PAPERBACK', 'DIGITAL', 'AUDIOBOOK']).optional(),
  rrp: z.number().positive('RRP must be positive').optional(),
  unitCost: z.number().positive('Unit cost must be positive').optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  pageCount: z.number().positive().nullable().optional(),
  dimensions: z.string().max(50).nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  bindingType: z.string().max(100).nullable().optional(),
  coverFinish: z.string().max(100).nullable().optional(),
  tradeDiscount: z.number().min(0).max(100).nullable().optional(),
  royaltyRate: z.number().min(0).max(100).nullable().optional(),
  royaltyThreshold: z.number().positive().nullable().optional(),
  printRunSize: z.number().positive().nullable().optional(),
  reprintThreshold: z.number().positive().nullable().optional(),
  keywords: z.string().max(500).nullable().optional(),
  language: z.string().max(10).nullable().optional(),
  territoryRights: z.string().max(255).nullable().optional(),
  status: z.enum(['ACTIVE', 'DISCONTINUED', 'PRE_ORDER']).optional()
})

// Utility function to normalize ISBN
function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '').toUpperCase()
}

// GET /api/titles/[id] - Get specific title
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const title = await prisma.title.findUnique({
      where: { id: params.id },
      include: {
        series: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inventory: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        stockMovements: {
          take: 10,
          orderBy: { movementDate: 'desc' },
          include: {
            warehouse: {
              select: {
                name: true,
                code: true
              }
            }
          }
        },
        priceHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 5
        }
      }
    })

    if (!title) {
      return NextResponse.json(
        { error: 'Title not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: title })
  } catch (error) {
    console.error('Error fetching title:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/titles/[id] - Update title
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validatedData = updateTitleSchema.parse(body)

    // Check if title exists
    const existingTitle = await prisma.title.findUnique({
      where: { id: params.id }
    })

    if (!existingTitle) {
      return NextResponse.json(
        { error: 'Title not found' },
        { status: 404 }
      )
    }

    // If ISBN is being updated, check for duplicates
    if (validatedData.isbn) {
      const normalizedISBN = normalizeISBN(validatedData.isbn)

      // Check if the new ISBN is already used by another title
      if (normalizedISBN !== existingTitle.isbn) {
        const duplicateTitle = await prisma.title.findUnique({
          where: { isbn: normalizedISBN }
        })

        if (duplicateTitle) {
          return NextResponse.json(
            {
              error: 'ISBN already exists',
              code: 'DUPLICATE_ISBN',
              existingTitle: {
                id: duplicateTitle.id,
                title: duplicateTitle.title,
                author: duplicateTitle.author
              }
            },
            { status: 409 }
          )
        }

        validatedData.isbn = normalizedISBN
      }
    }

    // Validate series exists if provided
    if (validatedData.seriesId !== undefined) {
      if (validatedData.seriesId === null) {
        // Removing from series is allowed
      } else {
        const series = await prisma.series.findUnique({
          where: { id: validatedData.seriesId }
        })

        if (!series) {
          return NextResponse.json(
            { error: 'Series not found', code: 'SERIES_NOT_FOUND' },
            { status: 400 }
          )
        }
      }
    }

    // Update title
    const updatedTitle = await prisma.title.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        series: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      data: updatedTitle,
      message: 'Title updated successfully'
    })
  } catch (error) {
    console.error('Error updating title:', error)

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

// DELETE /api/titles/[id] - Delete title
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if title exists
    const existingTitle = await prisma.title.findUnique({
      where: { id: params.id },
      include: {
        inventory: true,
        stockMovements: true
      }
    })

    if (!existingTitle) {
      return NextResponse.json(
        { error: 'Title not found' },
        { status: 404 }
      )
    }

    // Check if title has associated inventory or stock movements
    if (existingTitle.inventory.length > 0 || existingTitle.stockMovements.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete title with associated inventory or stock movements',
          code: 'HAS_DEPENDENCIES',
          details: {
            inventoryCount: existingTitle.inventory.length,
            movementCount: existingTitle.stockMovements.length
          }
        },
        { status: 409 }
      )
    }

    // Delete title (cascade will handle price history)
    await prisma.title.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      message: 'Title deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting title:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}