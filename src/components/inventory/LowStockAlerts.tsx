'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@clerk/nextjs'

/**
 * LowStockAlerts Component
 *
 * Displays titles below their configured low stock thresholds
 * with warehouse breakdown and quick actions.
 */

interface LowStockItem {
  title: {
    id: number
    isbn: string
    title: string
    author: string
    lowStockThreshold: number | null
  }
  warehouses: Array<{
    warehouse: {
      id: number
      name: string
      code: string
    }
    currentStock: number
    reservedStock: number
    availableStock: number
    stockDeficit: number
  }>
  totalStock: number
  totalDeficit: number
}

interface LowStockResponse {
  data: LowStockItem[]
  summary: {
    totalTitlesLow: number
    totalWarehousesAffected: number
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch low stock items')
  }
  return res.json()
}

export function LowStockAlerts() {
  const { isSignedIn } = useAuth()
  const [isExpanded, setIsExpanded] = useState(true)

  const { data, error, isLoading } = useSWR<LowStockResponse>(
    isSignedIn ? '/api/inventory/low-stock' : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: false,
    }
  )

  if (isLoading || error || !data || data.data.length === 0) {
    return null
  }

  const lowStockItems = data.data
  const summary = data.summary

  return (
    <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 bg-yellow-100 border-b border-yellow-200 cursor-pointer hover:bg-yellow-150"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-yellow-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-yellow-900">
                Low Stock Alert
              </h3>
              <p className="text-sm text-yellow-700 mt-0.5">
                {summary.totalTitlesLow} {summary.totalTitlesLow === 1 ? 'title' : 'titles'} below threshold
                across {summary.totalWarehousesAffected} {summary.totalWarehousesAffected === 1 ? 'warehouse' : 'warehouses'}
              </p>
            </div>
          </div>
          <button
            className="text-yellow-600 hover:text-yellow-800"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            <svg
              className={`h-5 w-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 py-4">
          <div className="space-y-4">
            {lowStockItems.map((item) => (
              <div key={item.title.id} className="border border-yellow-200 rounded-md p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{item.title.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.title.author} • ISBN: {item.title.isbn}
                    </p>
                    <div className="mt-2 flex items-center text-xs text-gray-600">
                      <span className="font-medium">Threshold: {item.title.lowStockThreshold}</span>
                      <span className="mx-2">•</span>
                      <span>Total Stock: {item.totalStock}</span>
                      <span className="mx-2">•</span>
                      <span className="text-red-600 font-medium">
                        Short: {item.totalDeficit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warehouse Breakdown */}
                <div className="mt-3 space-y-2">
                  {item.warehouses.map((wh) => (
                    <div key={wh.warehouse.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700 w-24">
                          {wh.warehouse.code}
                        </span>
                        <span className="text-gray-600">
                          {wh.warehouse.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-600">
                          Stock: <span className="font-medium text-red-600">{wh.currentStock}</span>
                        </span>
                        <span className="text-gray-600">
                          Short: <span className="font-medium">{wh.stockDeficit}</span>
                        </span>
                        {wh.reservedStock > 0 && (
                          <span className="text-gray-500">
                            Reserved: {wh.reservedStock}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      // Navigate to title detail page
                      window.location.href = `/titles/${item.title.id}`
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="-ml-0.5 mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Open reorder modal/form
                      alert('Reorder functionality coming soon')
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="-ml-0.5 mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Quick Reorder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
