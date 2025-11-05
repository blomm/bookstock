import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/database'
import { get_user_role, has_permission, type UserRole } from '@/lib/clerk'

/**
 * Authentication and Authorization Utilities
 *
 * This file contains helper functions for authentication checks,
 * authorization validation, and user management throughout the application.
 */

/**
 * Get the current authenticated user with role information
 * @returns User information with role, or null if not authenticated
 */
export async function get_current_user() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return null
    }

    const user = await currentUser()

    if (!user) {
      return null
    }

    // Get user role from Clerk metadata
    const role = get_user_role(user) as UserRole

    const result = {
      id: userId,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      role,
      user // Raw Clerk user object
    }

    return result
  } catch (error) {
    // Handle auth errors gracefully
    console.error('Authentication error:', error)
    return null
  }
}

/**
 * Require authentication for a page/component
 * Redirects to sign-in if not authenticated
 */
export async function require_auth() {
  const user = await get_current_user()

  if (!user) {
    redirect('/sign-in')
  }

  return user
}

/**
 * Require specific role for access
 * Redirects to access-denied if insufficient permissions
 */
export async function require_role(required_role: UserRole | UserRole[]) {
  const user = await require_auth()
  const required_roles = Array.isArray(required_role) ? required_role : [required_role]

  if (!user.role || !required_roles.includes(user.role)) {
    redirect('/access-denied')
  }

  return user
}

/**
 * Require specific permission for access
 * Redirects to access-denied if insufficient permissions
 */
export async function require_permission(permission: string) {
  const user = await require_auth()

  if (!has_permission(user.role, permission)) {
    redirect('/access-denied')
  }

  return user
}

/**
 * Check if current user has a specific permission
 * @param permission Permission to check
 * @returns True if user has permission, false otherwise
 */
export async function check_permission(permission: string): Promise<boolean> {
  const user = await get_current_user()
  return user ? has_permission(user.role, permission) : false
}

/**
 * Get database user record by Clerk ID
 * @param clerk_id Clerk user ID
 * @returns Database user record or null
 */
export async function get_db_user(clerk_id: string) {
  return await prisma.user.findUnique({
    where: { clerkId: clerk_id },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  })
}

/**
 * Create or update user in database from Clerk user
 * @param clerk_user Clerk user object
 * @returns Database user record
 */
export async function sync_user_to_database(clerk_user: any) {
  const email = clerk_user.emailAddresses[0]?.emailAddress

  if (!email) {
    throw new Error('User email not found')
  }

  // Check if user already exists
  const existing_user = await prisma.user.findUnique({
    where: { clerkId: clerk_user.id }
  })

  if (existing_user) {
    // Update existing user
    return await prisma.user.update({
      where: { clerkId: clerk_user.id },
      data: {
        email,
        firstName: clerk_user.firstName,
        lastName: clerk_user.lastName,
        updatedAt: new Date(),
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    })
  } else {
    // Create new user
    const new_user = await prisma.user.create({
      data: {
        clerkId: clerk_user.id,
        email,
        firstName: clerk_user.firstName,
        lastName: clerk_user.lastName,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    })

    // Assign default role
    const default_role = await prisma.role.findFirst({
      where: { name: 'read_only_user' }
    })

    if (default_role) {
      await prisma.userRole.create({
        data: {
          userId: new_user.id,
          roleId: default_role.id,
          assignedAt: new Date(),
          assignedBy: 'system',
        },
      })
    }

    return new_user
  }
}

/**
 * Validate API request authentication
 * @param request NextRequest object
 * @returns User info or throws error
 */
export async function validate_api_auth(request: NextRequest) {
  console.log('Starting API auth validation...');
  console.log('Request URL:', request.url);

  try {
    // Get auth from Clerk
    const { userId } = await auth()
    console.log('Auth userId:', userId);

    if (!userId) {
      console.log('No userId found, throwing Unauthorized error');
      throw new Error('Unauthorized')
    }

    // Get full user object
    const user = await currentUser()
    console.log('Current user:', {
      id: user?.id,
      email: user?.emailAddresses[0]?.emailAddress
    });

    if (!user) {
      console.log('User object not found, throwing Unauthorized error');
      throw new Error('Unauthorized')
    }

    const role = get_user_role(user) as UserRole
    console.log(`User ID: ${userId}, Role: ${role}`)

    return {
      userId,
      user,
      role,
      email: user.emailAddresses[0]?.emailAddress,
    }
  } catch (error) {
    console.error('Error in validate_api_auth:', error);
    throw new Error('Unauthorized')
  }
}

/**
 * Validate API request authorization
 * @param request NextRequest object
 * @param permission Required permission
 * @returns User info or throws error
 */
export async function validate_api_permission(request: NextRequest, permission: string) {
  const auth_info = await validate_api_auth(request)

  console.log(`Validating permission: ${permission} for role: ${auth_info.role}`)

  if (!has_permission(auth_info.role, permission)) {
    throw new Error('Forbidden')
  }

  return auth_info
}

/**
 * Create audit log entry
 * @param user_id User ID (Clerk ID)
 * @param action Action performed
 * @param details Additional details
 * @param request Optional request object for IP/user agent
 */
export async function create_audit_log(
  user_id: string,
  action: string,
  details: any,
  request?: NextRequest
) {
  await prisma.auditLog.create({
    data: {
      userId: user_id,
      action,
      details,
      ipAddress: request ? get_client_ip(request) : null,
      userAgent: request?.headers.get('user-agent') || null,
      timestamp: new Date(),
    },
  })
}

/**
 * Get client IP address from request
 * @param request NextRequest object
 * @returns Client IP address or null
 */
function get_client_ip(request: NextRequest): string | null {
  // Check various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const real_ip = request.headers.get('x-real-ip')
  if (real_ip) {
    return real_ip
  }

  const cf_ip = request.headers.get('cf-connecting-ip')
  if (cf_ip) {
    return cf_ip
  }

  return null
}