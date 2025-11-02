'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useEffect, use } from 'react'
import useSWR from 'swr'
import { TitleForm } from '@/components/titles/TitleForm'
import { UserMenu } from '@/components/auth/user-menu'
import { Format } from '@prisma/client'

/**
 * Edit Title Page
 *
 * Allows authorized users to edit an existing book title.
 * Features:
 * - Fetches existing title data
 * - Pre-populates form with current values
 * - Tracks price changes
 * - Success redirect to title detail page
 */

interface Title {
  id: number
  isbn: string
  title: string
  author: string
  format: Format
  rrp: string
  unitCost: string
  publisher: string | null
  publicationDate: string | null
  pageCount: number | null
  description: string | null
  category: string | null
  subcategory: string | null
  dimensions: string | null
  weight: number | null
  bindingType: string | null
  coverFinish: string | null
  tradeDiscount: string | null
  royaltyRate: string | null
  royaltyThreshold: number | null
  printRunSize: number | null
  reprintThreshold: number | null
  keywords: string | null
  language: string | null
  territoryRights: string | null
  seriesId: number | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch title')
  }
  return res.json()
}

export default function EditTitlePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()

  // Unwrap params Promise as required by Next.js 15
  const { id } = use(params)
  const titleId = parseInt(id, 10)

  // Fetch title data
  const { data: title, error, isLoading } = useSWR<Title>(
    isSignedIn ? `/api/titles/${titleId}` : null,
    fetcher
  )

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit Title</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading title...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Not authenticated
  if (!isSignedIn) {
    return null // Will redirect
  }

  // Error state
  if (error || !title) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Edit Title</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading title</h3>
                <p className="text-sm text-red-700 mt-2">
                  {error?.message || 'Title not found'}
                </p>
                <button
                  onClick={() => router.push('/titles')}
                  className="mt-3 text-sm font-medium text-red-800 hover:text-red-900 underline"
                >
                  Back to titles
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const handleSuccess = (titleId: number) => {
    router.push(`/titles/${titleId}`)
  }

  const handleCancel = () => {
    router.push(`/titles/${titleId}`)
  }

  // Convert title data to form default values
  const defaultValues = {
    isbn: title.isbn,
    title: title.title,
    author: title.author,
    format: title.format,
    rrp: parseFloat(title.rrp),
    unitCost: parseFloat(title.unitCost),
    publisher: title.publisher || undefined,
    publicationDate: title.publicationDate ? new Date(title.publicationDate) : undefined,
    pageCount: title.pageCount || undefined,
    description: title.description || undefined,
    category: title.category || undefined,
    subcategory: title.subcategory || undefined,
    dimensions: title.dimensions || undefined,
    weight: title.weight || undefined,
    bindingType: title.bindingType || undefined,
    coverFinish: title.coverFinish || undefined,
    tradeDiscount: title.tradeDiscount ? parseFloat(title.tradeDiscount) : undefined,
    royaltyRate: title.royaltyRate ? parseFloat(title.royaltyRate) : undefined,
    royaltyThreshold: title.royaltyThreshold || undefined,
    printRunSize: title.printRunSize || undefined,
    reprintThreshold: title.reprintThreshold || undefined,
    keywords: title.keywords || undefined,
    language: title.language || undefined,
    territoryRights: title.territoryRights || undefined,
    seriesId: title.seriesId || undefined,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Title</h1>
              <p className="text-sm text-gray-500 mt-1">
                {title.title}
              </p>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <TitleForm
            mode="edit"
            titleId={titleId}
            defaultValues={defaultValues}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  )
}
