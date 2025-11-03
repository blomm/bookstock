'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldX, Loader2 } from 'lucide-react'

export default function AccessDeniedPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  const formatRole = (role?: string) => {
    if (!role) return 'No Role Assigned'
    return role
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const goBack = () => {
    router.back()
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  const userRole = user?.publicMetadata?.role as string | undefined

  return (
    <div
      data-testid="access-denied-container"
      className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100">
            <ShieldX
              className="h-8 w-8 text-red-600"
              data-testid="access-denied-icon"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Access Denied
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You don&apos;t have permission to access this resource
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10">
          <div className="space-y-6">
            {/* User Status */}
            {!isSignedIn ? (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Please sign in to access this resource
                </p>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sign In
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-700 mb-2">
                  You are signed in as: {user?.emailAddresses[0]?.emailAddress}
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  Current role: {formatRole(userRole)}
                </p>

                {!userRole && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                    <p className="text-sm text-yellow-800">
                      Your account has not been assigned any permissions yet
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Contact Information */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-base font-medium text-gray-900 mb-2">Need access?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Contact your system administrator to request additional permissions
              </p>

              {/* Navigation Options */}
              <div className="space-y-3">
                <Link
                  href="/dashboard"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Dashboard
                </Link>

                <button
                  onClick={goBack}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}