import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Assigning admin role to first user...')

  // Get or create admin role
  let adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' }
  })

  if (!adminRole) {
    console.log('Creating Admin role...')
    adminRole = await prisma.role.create({
      data: {
        name: 'Admin',
        description: 'Full system access for system administrators',
        permissions: [
          'user:*',
          'role:*',
          'title:*',
          'inventory:*',
          'warehouse:*',
          'settings:*',
          'audit:read'
        ],
        isSystem: true
      }
    })
  }

  // Get the first user (or specified by email)
  const email = process.env.ADMIN_EMAIL
  let user

  if (email) {
    user = await prisma.user.findUnique({
      where: { email },
      include: { userRoles: true }
    })
    if (!user) {
      console.log(`❌ User with email ${email} not found`)
      return
    }
  } else {
    user = await prisma.user.findFirst({
      include: { userRoles: true },
      orderBy: { createdAt: 'asc' }
    })
    if (!user) {
      console.log('❌ No users found in database. Please sign in first.')
      return
    }
  }

  // Check if user already has admin role
  const hasAdminRole = user.userRoles.some(ur => ur.roleId === adminRole.id)

  if (hasAdminRole) {
    console.log(`✅ User ${user.email} already has Admin role`)
    return
  }

  // Assign admin role
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: adminRole.id,
      assignedBy: 'system',
      assignedAt: new Date(),
      isActive: true
    }
  })

  console.log(`✅ Successfully assigned Admin role to ${user.email}`)
  console.log(`   User ID: ${user.id}`)
  console.log(`   Clerk ID: ${user.clerkId}`)
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
