import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUser() {
  console.log('🔍 Checking all users and their roles...\n')

  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log(`Found ${users.length} user(s):\n`)

  users.forEach((user, index) => {
    console.log(`${index + 1}. User: ${user.firstName || ''} ${user.lastName || ''} (${user.email})`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Clerk ID: ${user.clerkId}`)
    console.log(`   Active: ${user.isActive}`)
    console.log(`   Roles: ${user.userRoles.length > 0 ? user.userRoles.map(ur => ur.role.name).join(', ') : 'NONE'}`)
    console.log(`   Created: ${user.createdAt}`)
    console.log('')
  })

  // Check if Admin role exists
  const adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' }
  })

  if (adminRole) {
    console.log(`✅ Admin role exists (ID: ${adminRole.id})`)
  } else {
    console.log(`❌ Admin role not found - run: npm run db:seed`)
  }
}

checkUser()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
