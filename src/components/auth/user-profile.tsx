'use client'

import { useAuth, useUser, UserProfile as ClerkUserProfile } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function UserProfile() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" data-testid="loading-spinner" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!isSignedIn || !user) {
    return null
  }

  const formatRole = (role?: string) => {
    if (!role) return 'No Role Assigned'
    return role
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const userRole = user.publicMetadata?.role as string | undefined
  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.emailAddresses[0]?.emailAddress || 'User'

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div
        data-testid="profile-container"
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your account settings and preferences
              </p>
            </div>

            {/* User Summary */}
            <div className="px-6 py-4 bg-gray-50">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xl font-medium text-blue-600">
                    {user.firstName?.charAt(0)?.toUpperCase() ||
                     user.emailAddresses[0]?.emailAddress?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{displayName}</h2>
                  <p className="text-sm text-gray-600">{user.emailAddresses[0]?.emailAddress}</p>
                  <p className="text-sm text-blue-600 font-medium">{formatRole(userRole)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clerk User Profile Component */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-6">
            <ClerkUserProfile
              appearance={{
                elements: {
                  card: 'shadow-none border-0',
                  navbar: 'hidden',
                  formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                  formFieldInput: 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}