import { createClerkClient } from '@clerk/backend'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

/**
 * Sync Clerk Users to Database
 *
 * This script syncs basic user information from Clerk to the database.
 * Only user records are synced - roles are managed in Clerk publicMetadata.
 *
 * Use this script to:
 * - Create database records for Clerk users (needed for foreign key relationships)
 * - Sync basic user info (email, name) from Clerk to database
 */
async function main() {
  console.log('🔄 Syncing users from Clerk to database...\n')
  console.log('ℹ️  Note: Roles are managed in Clerk publicMetadata, not in database.\n')

  // Get all users from Clerk
  console.log('📥 Fetching users from Clerk...')
  const clerkUsers = await clerkClient.users.getUserList()
  console.log(`   Found ${clerkUsers.data.length} users in Clerk\n`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const clerkUser of clerkUsers.data) {
    try {
      const primaryEmail = clerkUser.emailAddresses.find(
        email => email.id === clerkUser.primaryEmailAddressId
      )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress

      if (!primaryEmail) {
        console.log(`⚠️  Skipping ${clerkUser.id} - no email address`)
        skipped++
        continue
      }

      // Check if user already exists in database
      const existingUser = await prisma.user.findUnique({
        where: { clerkId: clerkUser.id }
      })

      if (existingUser) {
        console.log(`⏭️  ${primaryEmail} - already exists`)
        skipped++
        continue
      }

      // Create user in database (roles are in Clerk publicMetadata)
      await prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          email: primaryEmail,
          firstName: clerkUser.firstName || undefined,
          lastName: clerkUser.lastName || undefined,
          isActive: true,
          createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt) : new Date(),
          updatedAt: new Date(),
        },
      })

      const role = clerkUser.publicMetadata?.role || 'no role set'
      console.log(`✅ ${primaryEmail} - created (Clerk role: ${role})`)
      created++

    } catch (error) {
      console.error(`❌ Error syncing ${clerkUser.emailAddresses[0]?.emailAddress}:`, error)
      errors++
    }
  }

  console.log('\n📊 Sync Summary:')
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`   📝 Total: ${clerkUsers.data.length}`)
  console.log('\nℹ️  Roles are managed in Clerk publicMetadata.')
  console.log('   Use Clerk dashboard or clerkAuthService to assign roles.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Sync failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
