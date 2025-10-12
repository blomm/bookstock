import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignUpPage from '@/app/sign-up/[[...rest]]/page'

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  SignUp: vi.fn(({ appearance, signInUrl, afterSignUpUrl }) => (
    <div data-testid="clerk-signup">
      <div data-testid="signup-form">Clerk SignUp Component</div>
      <div data-testid="signup-config">
        signInUrl: {signInUrl}
        afterSignUpUrl: {afterSignUpUrl}
      </div>
    </div>
  ))
}))

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should render sign-up page with proper layout', () => {
    render(<SignUpPage />)

    expect(screen.getByText('Welcome to BookStock')).toBeInTheDocument()
    expect(screen.getByText('Create your account to access the inventory management system')).toBeInTheDocument()
    expect(screen.getByTestId('clerk-signup')).toBeInTheDocument()
  })

  test('should display BookStock branding and logo', () => {
    render(<SignUpPage />)

    const logo = screen.getByTestId('bookstock-logo')
    expect(logo).toBeInTheDocument()
    expect(screen.getByText('Welcome to BookStock')).toBeInTheDocument()
  })

  test('should configure Clerk SignUp with correct URLs', () => {
    render(<SignUpPage />)

    const config = screen.getByTestId('signup-config')
    expect(config).toHaveTextContent('signInUrl: /sign-in')
    expect(config).toHaveTextContent('afterSignUpUrl: /dashboard')
  })

  test('should have link to sign-in page', () => {
    render(<SignUpPage />)

    const signInLink = screen.getByRole('link', { name: /sign in here/i })
    expect(signInLink).toBeInTheDocument()
    expect(signInLink).toHaveAttribute('href', '/sign-in')
  })

  test('should display new user information', () => {
    render(<SignUpPage />)

    expect(screen.getByText('New User Information')).toBeInTheDocument()
    expect(screen.getByText('Your account will be created with read-only permissions initially')).toBeInTheDocument()
    expect(screen.getByText('Contact your system administrator to request additional privileges')).toBeInTheDocument()
    expect(screen.getByText("You'll receive a verification email after signing up")).toBeInTheDocument()
  })

  test('should apply custom styling and appearance', () => {
    render(<SignUpPage />)

    const container = screen.getByTestId('signup-container')
    expect(container).toHaveClass('min-h-screen', 'bg-gray-50')
  })

  test('should be responsive', () => {
    render(<SignUpPage />)

    const container = screen.getByTestId('signup-container')
    expect(container).toHaveClass('px-4', 'sm:px-6', 'lg:px-8')
  })
})