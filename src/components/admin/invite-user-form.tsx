'use client'

import { useState } from 'react'
import { UserPlus, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface InviteUserFormProps {
  onInviteSent?: () => void
}

export function InviteUserForm({ onInviteSent }: InviteUserFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('read_only_user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const roles = [
    { value: 'admin', label: 'Admin', description: 'Full system access' },
    { value: 'operations_manager', label: 'Operations Manager', description: 'Manage inventory and warehouses' },
    { value: 'inventory_clerk', label: 'Inventory Clerk', description: 'Update inventory only' },
    { value: 'financial_controller', label: 'Financial Controller', description: 'View and export reports' },
    { value: 'read_only_user', label: 'Read Only User', description: 'View-only access' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, role })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      setSuccess(true)
      setEmail('')
      setRole('read_only_user')

      if (onInviteSent) {
        onInviteSent()
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <UserPlus className="h-6 w-6 text-blue-600" />
        <h2 className="text-lg font-medium text-gray-900">Invite New User</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="user@example.com"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} - {r.description}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-800">
                  Invitation sent successfully! The user will receive an email with instructions.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Invitation...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Invitation
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">How it works:</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li className="flex items-start">
            <span className="mr-2">1.</span>
            <span>Enter the email address and select the appropriate role</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">2.</span>
            <span>The user will receive an invitation email from Clerk</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">3.</span>
            <span>They click the link to create their account</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">4.</span>
            <span>Their account is automatically created with the assigned role</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
