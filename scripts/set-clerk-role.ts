import { createClerkClient } from '@clerk/backend'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

async function main() {
  console.log('Setting Clerk metadata for all users based on database roles...\n')

  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        where: { isActive: true },
        include: {
          role: true
        }
      }
    }
  })

  for (const user of users) {
    if (user.userRoles.length === 0) {
      console.log(`⚠️  ${user.email} has no roles assigned`)
      continue
    }

    // Get primary role
    const primaryRole = user.userRoles[0].role
    const roleName = primaryRole.name.toLowerCase().replace(/\s+/g, '_')

    console.log(`Setting ${user.email} -> ${roleName}`)

    try {
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        publicMetadata: {
          role: roleName
        }
      })
      console.log(`✅ Updated Clerk metadata for ${user.email}`)
    } catch (error) {
      console.error(`❌ Failed to update ${user.email}:`, error)
    }
  }

  console.log('\n✨ Done! Refresh your browser to see changes.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
