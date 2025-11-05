'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { UserMenu } from '@/components/auth/user-menu'
import { PermissionGuard } from '@/components/auth/permission-guard'
import useSWR from 'swr'
import { useState, use } from 'react'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch warehouse')
  }
  return res.json()
}

export default function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()

  // Unwrap params Promise as required by Next.js 15
  const { id } = use(params)
  const warehouseId = parseInt(id)
  const [isUpdating, setIsUpdating] = useState(false)

  const { data: warehouse, error, isLoading, mutate } = useSWR(
    isSignedIn ? `/api/warehouses/${warehouseId}` : null,
    fetcher
  )

  const handleStatusChange = async (action: 'activate' | 'deactivate') => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}/${action}`, {
        method: 'PATCH',
      })
      if (!res.ok) {
        throw new Error(`Failed to ${action} warehouse`)
      }
      await mutate()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update warehouse')
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoaded && !isSignedIn) {
    router.push('/sign-in')
    return null
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Warehouse Details</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading warehouse...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !warehouse) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Warehouse Details</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Warehouse not found.</p>
            <button
              onClick={() => router.push('/warehouses')}
              className="mt-4 text-indigo-600 hover:text-indigo-900"
            >
              Back to Warehouses
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{warehouse.name}</h1>
              <p className="mt-1 text-sm text-gray-500">Code: {warehouse.code}</p>
            </div>
            <div className="flex items-center gap-4">
              <PermissionGuard requiredPermission="warehouse:update">
                <div className="flex gap-2">
                  {warehouse.status !== 'ACTIVE' && (
                    <button
                      onClick={() => handleStatusChange('activate')}
                      disabled={isUpdating}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? 'Updating...' : 'Activate'}
                    </button>
                  )}
                  {warehouse.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleStatusChange('deactivate')}
                      disabled={isUpdating}
                      className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? 'Updating...' : 'Deactivate'}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/warehouses/${warehouseId}/edit`)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    Edit
                  </button>
                </div>
              </PermissionGuard>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{warehouse.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Code</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{warehouse.code}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Type</dt>
              <dd className="mt-1">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {warehouse.type}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    warehouse.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : warehouse.status === 'INACTIVE'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {warehouse.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Address */}
        {(warehouse.addressLine1 || warehouse.city || warehouse.country) && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Address</h2>
            <div className="text-sm text-gray-900 space-y-1">
              {warehouse.addressLine1 && <p>{warehouse.addressLine1}</p>}
              {warehouse.addressLine2 && <p>{warehouse.addressLine2}</p>}
              {(warehouse.city || warehouse.stateProvince) && (
                <p>
                  {warehouse.city}
                  {warehouse.city && warehouse.stateProvince && ', '}
                  {warehouse.stateProvince}
                </p>
              )}
              {warehouse.postalCode && <p>{warehouse.postalCode}</p>}
              {warehouse.country && <p>{warehouse.country}</p>}
            </div>
          </div>
        )}

        {/* Contact Details */}
        {(warehouse.contactName || warehouse.contactEmail || warehouse.contactPhone) && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Details</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {warehouse.contactName && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Contact Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{warehouse.contactName}</dd>
                </div>
              )}
              {warehouse.contactEmail && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`mailto:${warehouse.contactEmail}`} className="text-indigo-600 hover:text-indigo-900">
                      {warehouse.contactEmail}
                    </a>
                  </dd>
                </div>
              )}
              {warehouse.contactPhone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`tel:${warehouse.contactPhone}`} className="text-indigo-600 hover:text-indigo-900">
                      {warehouse.contactPhone}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Notes */}
        {warehouse.notes && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Notes</h2>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{warehouse.notes}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Metadata</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(warehouse.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(warehouse.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={() => router.push('/warehouses')}
            className="text-indigo-600 hover:text-indigo-900"
          >
            ← Back to Warehouses
          </button>
        </div>
      </main>
    </div>
  )
}
