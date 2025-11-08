import { PrismaClient } from '@prisma/client'
import { createClerkClient } from '@clerk/backend'

const prisma = new PrismaClient()
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

/**
 * Assign Admin Role to First User
 *
 * This script assigns the Admin role to the first user in Clerk publicMetadata.
 * Roles are now managed in Clerk, not in the database.
 *
 * Usage:
 *   ADMIN_EMAIL=user@example.com npm run db:assign-admin  # Assign to specific email
 *   npm run db:assign-admin                                # Assign to first user
 */
async function main() {
  console.log('🔧 Assigning Admin role to first user in Clerk...\n')

  // Get the first user (or specified by email)
  const email = process.env.ADMIN_EMAIL
  let user

  if (email) {
    user = await prisma.user.findUnique({
      where: { email }
    })
    if (!user) {
      console.log(`❌ User with email ${email} not found in database`)
      return
    }
  } else {
    user = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' }
    })
    if (!user) {
      console.log('❌ No users found in database. Please sign in first.')
      return
    }
  }

  // Get Clerk user to check current role
  const clerkUser = await clerkClient.users.getUser(user.clerkId)
  const currentRole = clerkUser.publicMetadata?.role

  if (currentRole === 'admin') {
    console.log(`✅ User ${user.email} already has admin role`)
    return
  }

  // Assign admin role in Clerk (lowercase to match ROLE_PERMISSIONS)
  await clerkClient.users.updateUser(user.clerkId, {
    publicMetadata: {
      ...clerkUser.publicMetadata,
      role: 'admin'
    }
  })

  console.log(`✅ Successfully assigned admin role to ${user.email}`)
  console.log(`   User ID: ${user.id}`)
  console.log(`   Clerk ID: ${user.clerkId}`)
  console.log(`   Previous role: ${currentRole || 'none'}`)
  console.log(`   New role: admin`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
