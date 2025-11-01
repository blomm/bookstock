import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createAdminUser() {
  const email = process.argv[2] || 'mike_geomatics@yahoo.com'
  const name = process.argv[3] || 'Michael Blom'

  console.log('👤 Creating admin user...')
  console.log(`   Email: ${email}`)
  console.log(`   Name: ${name}`)
  console.log('')

  // Find the Admin role
  const adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' }
  })

  if (!adminRole) {
    console.error('❌ Admin role not found. Run: npm run db:seed')
    process.exit(1)
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: true } } }
  })

  if (user) {
    console.log(`✅ User already exists: ${user.firstName} ${user.lastName} (${user.email})`)
  } else {
    // Create the user
    const [firstName, ...lastNameParts] = name.split(' ')
    const lastName = lastNameParts.join(' ')

    user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName: lastName || null,
        clerkId: `local_${Date.now()}`, // Temporary Clerk ID for local development
        isActive: true
      },
      include: { userRoles: { include: { role: true } } }
    })
    console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.email})`)
  }

  // Check if user already has admin role
  const hasAdminRole = user.userRoles.some(ur => ur.roleId === adminRole.id)

  if (hasAdminRole) {
    console.log(`✅ User already has Admin role`)
  } else {
    // Assign the Admin role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id
      }
    })
    console.log(`✅ Assigned Admin role`)
  }

  // Show final roles
  const finalUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { userRoles: { include: { role: true } } }
  })

  console.log('\n📋 User roles:')
  finalUser?.userRoles.forEach(ur => {
    console.log(`  - ${ur.role.name}: ${ur.role.description}`)
  })

  console.log('\n✅ All permissions:')
  const allPermissions = new Set<string>()
  finalUser?.userRoles.forEach(ur => {
    ur.role.permissions.forEach((p: string) => allPermissions.add(p))
  })
  Array.from(allPermissions).sort().forEach(p => {
    console.log(`  - ${p}`)
  })

  console.log('\n🎉 Done! You now have full Admin access.')
  console.log('💡 Note: In production, users are created via Clerk webhook automatically.')
}

createAdminUser()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
