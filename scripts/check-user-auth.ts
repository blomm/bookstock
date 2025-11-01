import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking user authentication setup...\n')

  // Find your user
  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  })

  console.log(`Found ${users.length} users in database:\n`)

  for (const user of users) {
    console.log(`User: ${user.email}`)
    console.log(`  Clerk ID: ${user.clerkId}`)
    console.log(`  Active: ${user.isActive}`)
    console.log(`  Roles in database:`)

    if (user.userRoles.length === 0) {
      console.log('    ⚠️  NO ROLES ASSIGNED')
    } else {
      for (const userRole of user.userRoles) {
        console.log(`    - ${userRole.role.name}`)
        console.log(`      Permissions:`, userRole.role.permissions)
      }
    }
    console.log('')
  }

  console.log('\n📋 Next Steps:')
  console.log('1. Make sure your user has the Admin role in the database')
  console.log('2. Make sure Clerk metadata has role: "admin" set')
  console.log('   Go to Clerk Dashboard > Users > Select your user > Metadata')
  console.log('   Add to publicMetadata: { "role": "admin" }')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
