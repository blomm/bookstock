import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default function SignInPage() {
  return (
    <div
      data-testid="signin-container"
      className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8"
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div
            data-testid="bookstock-logo"
            className="flex items-center space-x-2 text-blue-600"
          >
            <BookOpen className="h-10 w-10" />
            <span className="text-2xl font-bold">BookStock</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Welcome Back to BookStock
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in to access the inventory management system
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <SignIn
            appearance={{
              elements: {
                formButtonPrimary:
                  'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
                card: 'border-0 shadow-none',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden'
              }
            }}
            signUpUrl="/sign-up"
            afterSignInUrl="/dashboard"
          />

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">New to BookStock?</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/sign-up"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign up here
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white py-6 px-4 shadow sm:rounded-lg sm:px-10">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Access Features:</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Book inventory tracking
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Multi-warehouse management
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Real-time analytics
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Role-based access control
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}