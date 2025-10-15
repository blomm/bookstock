'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'
import { TitleForm } from '@/components/titles/TitleForm'
import { UserMenu } from '@/components/auth/user-menu'

/**
 * Create Title Page
 *
 * Allows authorized users to create a new book title.
 * Features:
 * - Authentication check
 * - Permission validation (handled by API)
 * - Success redirect to title detail page
 */

export default function CreateTitlePage() {
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Create Title</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
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

  const handleSuccess = (titleId: number) => {
    router.push(`/titles/${titleId}`)
  }

  const handleCancel = () => {
    router.push('/titles')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Title</h1>
              <p className="text-sm text-gray-500 mt-1">
                Add a new book to your catalog
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
            mode="create"
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  )
}
