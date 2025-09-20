import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isISBN } from 'isbn3'

const prisma = new PrismaClient()

// Utility function to normalize ISBN
function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '').toUpperCase()
}

// GET /api/titles/check-duplicate/[isbn] - Check for duplicate ISBN
export async function GET(
  request: NextRequest,
  { params }: { params: { isbn: string } }
) {
  try {
    const { isbn } = params
    const { searchParams } = new URL(request.url)
    const excludeId = searchParams.get('excludeId')

    if (!isbn) {
      return NextResponse.json(
        { error: 'ISBN is required' },
        { status: 400 }
      )
    }

    const normalizedISBN = normalizeISBN(isbn)

    // Validate ISBN format
    if (!isISBN(normalizedISBN)) {
      return NextResponse.json(
        {
          error: 'Invalid ISBN format',
          code: 'INVALID_ISBN'
        },
        { status: 400 }
      )
    }

    // Check for existing title with this ISBN
    const existingTitle = await prisma.title.findUnique({
      where: { isbn: normalizedISBN },
      select: {
        id: true,
        title: true,
        subtitle: true,
        author: true,
        isbn: true,
        publicationYear: true,
        publisher: true,
        format: true,
        rrp: true,
        unitCost: true,
        status: true,
        createdAt: true,
        series: {
          select: {
            id: true,
            name: true
          }
        },
        inventory: {
          select: {
            id: true,
            currentStock: true,
            warehouse: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      }
    })

    const isDuplicate = existingTitle && existingTitle.id !== excludeId

    if (isDuplicate) {
      // Calculate total inventory across warehouses
      const totalStock = existingTitle.inventory.reduce(
        (sum, inv) => sum + inv.currentStock,
        0
      )

      return NextResponse.json({
        data: {
          isDuplicate: true,
          normalizedISBN,
          existingTitle: {
            ...existingTitle,
            totalStock,
            warehouseCount: existingTitle.inventory.length
          },
          suggestions: {
            canMerge: totalStock === 0, // Can only merge if no inventory
            actions: [
              'Update existing title with new information',
              'Create new edition with different ISBN',
              totalStock === 0 ? 'Merge duplicate entries' : null
            ].filter(Boolean)
          }
        }
      })
    }

    return NextResponse.json({
      data: {
        isDuplicate: false,
        normalizedISBN,
        existingTitle: null,
        message: 'ISBN is available'
      }
    })
  } catch (error) {
    console.error('Error checking duplicate ISBN:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}