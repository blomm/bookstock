'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { WarehouseForm } from '@/components/warehouses/WarehouseForm'
import { UserMenu } from '@/components/auth/user-menu'
import { PermissionGuard } from '@/components/auth/permission-guard'

export default function NewWarehousePage() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()

  if (isLoaded && !isSignedIn) {
    router.push('/sign-in')
    return null
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  return (
    <PermissionGuard permission="warehouse:create">
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Create Warehouse</h1>
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <WarehouseForm
            mode="create"
            onSuccess={(warehouseId) => {
              router.push(`/warehouses/${warehouseId}`)
            }}
            onCancel={() => router.push('/warehouses')}
          />
        </main>
      </div>
    </PermissionGuard>
  )
}
