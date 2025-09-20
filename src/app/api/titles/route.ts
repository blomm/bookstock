import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { isISBN } from 'isbn3'

const prisma = new PrismaClient()

// Validation schema for title creation
const createTitleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less'),
  subtitle: z.string().max(500, 'Subtitle must be 500 characters or less').optional(),
  author: z.string().min(1, 'Author is required').max(255, 'Author must be 255 characters or less'),
  isbn: z.string().min(1, 'ISBN is required').refine(
    (isbn) => {
      const cleanISBN = isbn.replace(/[-\s]/g, '')
      return isISBN(cleanISBN)
    },
    'Invalid ISBN format'
  ),
  publicationYear: z.number()
    .min(1000, 'Publication year must be 1000 or later')
    .max(new Date().getFullYear(), `Publication year cannot be later than ${new Date().getFullYear()}`),
  publisher: z.string().max(255, 'Publisher must be 255 characters or less').optional(),
  seriesId: z.string().uuid('Invalid series ID format').optional(),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  format: z.enum(['HARDCOVER', 'PAPERBACK', 'DIGITAL', 'AUDIOBOOK']),
  rrp: z.number().positive('RRP must be positive'),
  unitCost: z.number().positive('Unit cost must be positive'),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  pageCount: z.number().positive().optional(),
  dimensions: z.string().max(50).optional(),
  weight: z.number().positive().optional(),
  bindingType: z.string().max(100).optional(),
  coverFinish: z.string().max(100).optional(),
  tradeDiscount: z.number().min(0).max(100).optional(),
  royaltyRate: z.number().min(0).max(100).optional(),
  royaltyThreshold: z.number().positive().optional(),
  printRunSize: z.number().positive().optional(),
  reprintThreshold: z.number().positive().optional(),
  keywords: z.string().max(500).optional(),
  language: z.string().max(10).optional(),
  territoryRights: z.string().max(255).optional()
})

// Query schema for title listing
const getTitlesSchema = z.object({
  page: z.string().transform(Number).refine((n) => n > 0).optional(),
  limit: z.string().transform(Number).refine((n) => n > 0 && n <= 100).optional(),
  search: z.string().optional(),
  seriesId: z.string().uuid().optional(),
  format: z.enum(['HARDCOVER', 'PAPERBACK', 'DIGITAL', 'AUDIOBOOK']).optional(),
  category: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISCONTINUED', 'PRE_ORDER']).optional()
})

// Utility function to normalize ISBN
function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '').toUpperCase()
}

// POST /api/titles - Create new title
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createTitleSchema.parse(body)

    // Normalize ISBN for storage
    const normalizedISBN = normalizeISBN(validatedData.isbn)

    // Check for duplicate ISBN
    const existingTitle = await prisma.title.findUnique({
      where: { isbn: normalizedISBN }
    })

    if (existingTitle) {
      return NextResponse.json(
        {
          error: 'ISBN already exists',
          code: 'DUPLICATE_ISBN',
          existingTitle: {
            id: existingTitle.id,
            title: existingTitle.title,
            author: existingTitle.author
          }
        },
        { status: 409 }
      )
    }

    // Validate series exists if provided
    if (validatedData.seriesId) {
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

    // Create title with transaction
    const title = await prisma.$transaction(async (tx) => {
      const newTitle = await tx.title.create({
        data: {
          ...validatedData,
          isbn: normalizedISBN,
          status: 'ACTIVE' // Default status
        },
        include: {
          series: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      return newTitle
    })

    return NextResponse.json(
      {
        data: title,
        message: 'Title created successfully'
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating title:', error)

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

// GET /api/titles - List titles with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validatedParams = getTitlesSchema.parse(queryParams)

    const {
      page = 1,
      limit = 10,
      search,
      seriesId,
      format,
      category,
      status
    } = validatedParams

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subtitle: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search.replace(/[-\s]/g, '') } }
      ]
    }

    if (seriesId) where.seriesId = seriesId
    if (format) where.format = format
    if (category) where.category = category
    if (status) where.status = status

    // Execute queries in parallel
    const [titles, total] = await Promise.all([
      prisma.title.findMany({
        where,
        include: {
          series: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              inventory: true
            }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.title.count({ where })
    ])

    return NextResponse.json({
      data: titles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching titles:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
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