'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

/**
 * Sign In Page
 *
 * This page provides user login functionality using Clerk's
 * pre-built SignIn component with custom styling to match
 * the BookStock application design.
 */

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100">
            <svg
              className="h-6 w-6 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to BookStock
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your inventory management dashboard
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10">
          <SignIn
            appearance={{
              elements: {
                formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-700',
                card: 'shadow-none',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50',
                socialButtonsBlockButtonText: 'text-gray-600',
                dividerLine: 'bg-gray-200',
                dividerText: 'text-gray-400',
                formFieldLabel: 'text-sm font-medium text-gray-700',
                formFieldInput: 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500',
                footerActionText: 'text-gray-600',
                footerActionLink: 'text-indigo-600 hover:text-indigo-500'
              }
            }}
            signUpUrl="/sign-up"
            afterSignInUrl="/dashboard"
          />

          <div className="mt-6 border-t border-gray-200 pt-6">
            <p className="text-xs text-gray-500 text-center">
              Don&apos;t have an account?{' '}
              <Link
                href="/sign-up"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign up here
              </Link>
            </p>
          </div>

          <div className="mt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    First Time Users
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      If this is your first time accessing BookStock, please sign up for a new account.
                      Your administrator will assign appropriate permissions based on your role.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}