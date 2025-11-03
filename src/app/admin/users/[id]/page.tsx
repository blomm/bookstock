'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, AlertCircle } from 'lucide-react'

interface Role {
  id: string
  name: string
  description: string | null
}

interface User {
  id: string
  clerkId: string
  email: string
  firstName: string | null
  lastName: string | null
  isActive: boolean
  userRoles: Array<{
    id: string
    role: Role
    isActive: boolean
  }>
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Unwrap params Promise as required by Next.js 15
  const { id } = use(params)

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch user details
        const userResponse = await fetch(`/api/admin/users/${id}`)
        if (!userResponse.ok) {
          throw new Error('Failed to fetch user')
        }
        const userData = await userResponse.json()
        setUser(userData)

        // Set current role
        const currentRole = userData.userRoles.find((ur: any) => ur.isActive)
        if (currentRole) {
          setSelectedRoleId(currentRole.role.id)
        }

        // Fetch available roles
        const rolesResponse = await fetch('/api/admin/roles')
        if (!rolesResponse.ok) {
          throw new Error('Failed to fetch roles')
        }
        const rolesData = await rolesResponse.json()
        setRoles(rolesData.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (isSignedIn) {
      fetchData()
    }
  }, [id, isSignedIn])

  const handleSave = async () => {
    if (!selectedRoleId) {
      setError('Please select a role')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/admin/users/${id}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role_id: selectedRoleId
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update role')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/admin')
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">User Not Found</h2>
          <Link href="/admin" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            Back to Admin
          </Link>
        </div>
      </div>
    )
  }

  const formatRole = (role: string) => {
    return role
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Admin
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* User Info (Read-only) */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">User Information</h3>
              <div className="bg-gray-50 rounded-md p-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Name</label>
                  <p className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Email</label>
                  <p className="text-sm font-medium text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <p className="text-sm">
                    {user.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                id="role"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">Select a role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {formatRole(role.name)}
                    {role.description ? ` - ${role.description}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                This will update the user&apos;s role in both the database and Clerk
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <Save className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      Role updated successfully! Redirecting...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
              <Link
                href="/admin"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={saving || !selectedRoleId}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
