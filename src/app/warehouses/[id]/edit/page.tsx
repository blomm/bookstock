'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { WarehouseForm } from '@/components/warehouses/WarehouseForm'
import { UserMenu } from '@/components/auth/user-menu'
import { PermissionGuard } from '@/components/auth/permission-guard'
import useSWR from 'swr'
import { use } from 'react'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch warehouse')
  }
  return res.json()
}

export default function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()

  // Unwrap params Promise as required by Next.js 15
  const { id } = use(params)
  const warehouseId = parseInt(id)

  const { data: warehouse, error, isLoading } = useSWR(
    isSignedIn ? `/api/warehouses/${warehouseId}` : null,
    fetcher
  )

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
              <h1 className="text-2xl font-bold text-gray-900">Edit Warehouse</h1>
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
              <h1 className="text-2xl font-bold text-gray-900">Edit Warehouse</h1>
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Warehouse not found or error loading data.</p>
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
    <PermissionGuard requiredPermission="warehouse:update">
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Edit Warehouse</h1>
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <WarehouseForm
            mode="edit"
            warehouseId={warehouseId}
            defaultValues={warehouse}
            onSuccess={(warehouseId) => {
              router.push(`/warehouses/${warehouseId}`)
            }}
            onCancel={() => router.push(`/warehouses/${warehouseId}`)}
          />
        </main>
      </div>
    </PermissionGuard>
  )
}
