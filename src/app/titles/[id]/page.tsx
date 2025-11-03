'use client'

import { useState, use } from 'react'
import useSWR from 'swr'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Format } from '@prisma/client'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { UserMenu } from '@/components/auth/user-menu'

/**
 * Title Detail Page
 *
 * Displays comprehensive information about a single book title including:
 * - Title header with key info (title, author, ISBN)
 * - Metadata section (format, publisher, publication date)
 * - Pricing section (RRP, unit cost, trade discount)
 * - Physical specifications (dimensions, weight, binding)
 * - Commercial terms (royalty, print run, reprint)
 * - Price history table
 * - Inventory summary (if inventory exists)
 * - Edit and delete buttons (permission-based)
 */

interface Series {
  id: number
  name: string
}

interface PriceHistory {
  id: number
  rrp: string
  unitCost: string
  tradeDiscount: string | null
  effectiveFrom: string
  effectiveTo: string | null
  reason: string | null
}

interface Warehouse {
  id: number
  name: string
  code: string
}

interface Inventory {
  id: number
  warehouseId: number
  warehouse: Warehouse
  currentStock: number
  reservedStock: number
}

interface TitleDetail {
  id: number
  isbn: string
  title: string
  author: string
  format: Format
  rrp: string
  unitCost: string
  tradeDiscount: string | null
  publisher: string | null
  publicationDate: string | null
  pageCount: number | null
  description: string | null
  category: string | null
  subcategory: string | null
  dimensions: string | null
  weight: number | null
  binding: string | null
  coverFinish: string | null
  royaltyRate: string | null
  royaltyThreshold: number | null
  printRunSize: number | null
  reprintThreshold: number | null
  territory: string | null
  seriesId: number | null
  seriesSequence: number | null
  series: Series | null
  priceHistory: PriceHistory[]
  inventory: Inventory[]
  createdAt: string
  updatedAt: string
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch title' }))
    throw new Error(error.error || 'Failed to fetch title')
  }
  return res.json()
}

// Format currency
const formatCurrency = (value: string | number | null) => {
  if (value === null || value === undefined) return 'N/A'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(num)
}

// Format date
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Format percentage
const formatPercentage = (value: string | null) => {
  if (!value) return 'N/A'
  return `${parseFloat(value).toFixed(2)}%`
}

export default function TitleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Unwrap params Promise as required by Next.js 15
  const { id } = use(params)

  const { data: title, error, isLoading } = useSWR<TitleDetail>(
    isSignedIn ? `/api/titles/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/titles/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete title')
      }

      // Redirect to title list on success
      router.push('/titles')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/titles')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading title details...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/titles')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Error</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading title</h3>
                <p className="text-sm text-red-700 mt-2">
                  {error.message || 'An unexpected error occurred'}
                </p>
                <button
                  onClick={() => router.back()}
                  className="mt-3 text-sm font-medium text-red-800 hover:text-red-900 underline"
                >
                  Go back
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Not found
  if (!title) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/titles')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Not Found</h1>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600">Title not found</p>
          </div>
        </main>
      </div>
    )
  }

  const totalInventory = title.inventory.reduce((sum, inv) => sum + inv.currentStock, 0)
  const totalReserved = title.inventory.reduce((sum, inv) => sum + inv.reservedStock, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/titles')}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Title Details</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Title Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{title.title}</h2>
                <p className="text-xl text-gray-700 mb-2">by {title.author}</p>
                <p className="text-sm text-gray-500">ISBN: {title.isbn}</p>
                {title.series && (
                  <p className="text-sm text-gray-500 mt-1">
                    Series: <span className="text-indigo-600">{title.series.name}</span>
                    {title.seriesSequence && ` (Book ${title.seriesSequence})`}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <PermissionGuard permission="title:update">
                  <button
                    onClick={() => router.push(`/titles/${title.id}/edit`)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Edit
                  </button>
                </PermissionGuard>
                <PermissionGuard permission="title:delete">
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </PermissionGuard>
              </div>
            </div>
          </div>

          {/* Metadata Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Metadata</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Format</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.format}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Publisher</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.publisher || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Publication Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(title.publicationDate)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Page Count</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.pageCount || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.category || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Subcategory</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.subcategory || 'N/A'}</dd>
              </div>
              {title.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{title.description}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Pricing Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">RRP (Recommended Retail Price)</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(title.rrp)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Unit Cost</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(title.unitCost)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Trade Discount</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900">{formatPercentage(title.tradeDiscount)}</dd>
              </div>
            </dl>
          </div>

          {/* Physical Specifications */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Physical Specifications</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Dimensions (L×W×H)</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.dimensions || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Weight (grams)</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.weight ? `${title.weight}g` : 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Binding</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.binding || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Cover Finish</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.coverFinish || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          {/* Commercial Terms */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Commercial Terms</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Royalty Rate</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatPercentage(title.royaltyRate)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Royalty Threshold</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.royaltyThreshold || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Print Run Size</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.printRunSize || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Reprint Threshold</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.reprintThreshold || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Territory</dt>
                <dd className="mt-1 text-sm text-gray-900">{title.territory || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          {/* Price History */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Price History</h3>
            {title.priceHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No price history available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective From
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective To
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        RRP
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Cost
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trade Discount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {title.priceHistory.map((price) => (
                      <tr key={price.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(price.effectiveFrom)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {price.effectiveTo ? formatDate(price.effectiveTo) : 'Current'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(price.rrp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(price.unitCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPercentage(price.tradeDiscount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {price.reason || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inventory Summary */}
          {title.inventory.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Summary</h3>
              <div className="mb-4">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div className="bg-gray-50 px-4 py-3 rounded-md">
                    <dt className="text-sm font-medium text-gray-500">Total Stock</dt>
                    <dd className="mt-1 text-2xl font-bold text-gray-900">{totalInventory}</dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 rounded-md">
                    <dt className="text-sm font-medium text-gray-500">Reserved Stock</dt>
                    <dd className="mt-1 text-2xl font-bold text-gray-900">{totalReserved}</dd>
                  </div>
                </dl>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Warehouse
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Stock
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reserved
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Available
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {title.inventory.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {inv.warehouse.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {inv.warehouse.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {inv.currentStock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {inv.reservedStock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {inv.currentStock - inv.reservedStock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowDeleteDialog(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Delete Title
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete &quot;{title.title}&quot;? This action cannot be undone.
                      {totalInventory > 0 && (
                        <span className="block mt-2 font-medium text-red-600">
                          Warning: This title has {totalInventory} units in inventory and cannot be deleted.
                        </span>
                      )}
                    </p>
                    {deleteError && (
                      <div className="mt-3 text-sm text-red-600">
                        {deleteError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeleteError(null)
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
