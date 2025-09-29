'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { usePermissions } from './protected-route'

/**
 * User Menu Component
 *
 * This component displays the current user's information and provides
 * logout functionality along with navigation to user-related pages.
 */

export function UserMenu() {
  const { signOut } = useAuth()
  const { user } = useUser()
  const { user_role, has_role } = usePermissions()
  const router = useRouter()
  const [is_open, set_is_open] = useState(false)
  const menu_ref = useRef<HTMLDivElement>(null)

  const handle_logout = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handle_click_outside = (event: MouseEvent) => {
      if (menu_ref.current && !menu_ref.current.contains(event.target as Node)) {
        set_is_open(false)
      }
    }

    document.addEventListener('mousedown', handle_click_outside)
    return () => document.removeEventListener('mousedown', handle_click_outside)
  }, [])

  if (!user) return null

  const display_name = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.emailAddresses[0]?.emailAddress || 'User'

  const role_display = user_role
    ? user_role.replace('_', ' ').split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    : 'User'

  return (
    <div className="relative inline-block text-left" ref={menu_ref}>
      <div>
        <button
          type="button"
          className="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => set_is_open(!is_open)}
        >
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-sm font-medium text-indigo-600">
              {user.firstName ? user.firstName.charAt(0).toUpperCase() :
               user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <span className="hidden md:block text-sm font-medium text-gray-700">
            {display_name}
          </span>
          <svg
            className="h-5 w-5 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {is_open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1" role="menu">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{display_name}</p>
              <p className="text-xs text-gray-500">{user.emailAddresses[0]?.emailAddress}</p>
              <p className="text-xs text-indigo-600 mt-1">{role_display}</p>
            </div>

            {/* Menu Items */}
            <a
              href="/dashboard"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
              onClick={() => set_is_open(false)}
            >
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
                Dashboard
              </div>
            </a>

            <a
              href="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
              onClick={() => set_is_open(false)}
            >
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </div>
            </a>

            {has_role('admin') && (
              <a
                href="/admin"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => set_is_open(false)}
              >
                <div className="flex items-center">
                  <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Panel
                </div>
              </a>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100 my-1"></div>

            {/* Logout */}
            <button
              onClick={handle_logout}
              className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
              role="menuitem"
            >
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}