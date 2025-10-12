import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="z-10 max-w-3xl w-full">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="flex items-center space-x-3 text-blue-600">
              <BookOpen className="h-16 w-16" />
              <h1 className="text-5xl font-bold">
                BookStock
              </h1>
            </div>
          </div>

          <p className="text-xl text-gray-700 mb-8">
            Publishing Inventory Management System
          </p>

          <p className="text-gray-600 mb-12 max-w-2xl mx-auto">
            Comprehensive inventory management solution for publishing companies.
            Track books across multiple warehouses, manage ISBN records, calculate royalties,
            and get real-time analytics.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/sign-in"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center px-6 py-3 border border-blue-600 text-base font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg"
            >
              Create Account
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg"
            >
              Go to Dashboard
            </Link>
          </div>

          <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Multi-Warehouse Management</h3>
                  <p className="text-sm text-gray-600">Track inventory across multiple locations</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900">ISBN Tracking</h3>
                  <p className="text-sm text-gray-600">Comprehensive book title management</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Role-Based Access Control</h3>
                  <p className="text-sm text-gray-600">Secure authentication with granular permissions</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Real-Time Analytics</h3>
                  <p className="text-sm text-gray-600">Automated financial calculations and reports</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}